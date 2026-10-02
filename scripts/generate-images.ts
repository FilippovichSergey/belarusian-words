/**
 * Пакетная генерацыя малюнкаў праз Gemini API для слоў без малюнка.
 *
 * Запуск:  npm run generate-images -- [колькасць] [--dry-run]
 * Прыклад: npm run generate-images -- 5
 *
 * Патрэбныя зменныя ў .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 *   (неабавязкова) GEMINI_IMAGE_MODEL, IMAGE_STYLE
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

loadEnv({ path: ".env.local" });
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
const BUCKET = "images";

// Адзіны стыль для ўсёй калекцыі. Змяняйце пад свой густ.
const STYLE =
  process.env.IMAGE_STYLE ??
  "Flat vector illustration, soft pastel colors, clean white background, " +
    "simple friendly shapes, centered composition, suitable as a flashcard picture.";

type WordRow = {
  id: string;
  be: string;
  be_lat: string | null;
  en: string | null;
  ru: string | null;
  comment: string | null;
};

function buildPrompt(w: WordRow): string {
  const meaning = w.en ?? w.ru;
  const lines = [
    STYLE,
    "",
    `Illustrate the concept of the Belarusian word or phrase "${w.be}"` +
      (meaning ? ` which means "${meaning}".` : "."),
    w.comment ? `Extra context: ${w.comment}` : "",
    "Do not include any text, letters, captions or watermarks in the image.",
  ];
  return lines.filter(Boolean).join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limit = Number(args.find((a) => /^\d+$/.test(a)) ?? 10);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Не зададзены NEXT_PUBLIC_SUPABASE_URL ці SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!GEMINI_KEY && !dryRun) {
    throw new Error("Не зададзены GEMINI_API_KEY.");
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("words")
    .select("id, be, be_lat, en, ru, comment")
    .is("image_path", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const words = (data ?? []) as WordRow[];
  if (words.length === 0) {
    console.log("Усе словы ўжо маюць малюнкі.");
    return;
  }
  console.log(`Слоў без малюнка: ${words.length}. Мадэль: ${MODEL}`);

  const ai = dryRun ? null : new GoogleGenAI({ apiKey: GEMINI_KEY! });

  let ok = 0;
  for (const w of words) {
    const prompt = buildPrompt(w);
    console.log(`\n→ ${w.be}`);
    if (dryRun || !ai) {
      console.log(prompt);
      continue;
    }

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "1:1" },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData?.data,
      );
      if (!part?.inlineData?.data) {
        console.warn("  Мадэль не вярнула малюнак, прапускаю.");
        continue;
      }

      const mime = part.inlineData.mimeType ?? "image/png";
      const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
      const path = `${w.id}.${ext}`;
      const bytes = Buffer.from(part.inlineData.data, "base64");

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: mime, upsert: true });
      if (upErr) throw new Error(`storage: ${upErr.message}`);

      const { error: dbErr } = await supabase
        .from("words")
        .update({ image_path: path })
        .eq("id", w.id);
      if (dbErr) throw new Error(`db: ${dbErr.message}`);

      ok += 1;
      console.log(`  ✓ ${path} (${Math.round(bytes.length / 1024)} КБ)`);
    } catch (err) {
      console.error(`  ✗ Памылка: ${(err as Error).message}`);
    }
  }

  console.log(`\nГатова: ${ok} з ${words.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
