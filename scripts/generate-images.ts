/**
 * Пакетная генерацыя малюнкаў праз Gemini API для апублікаваных слоў без малюнка.
 *
 * Запуск:  npm run generate-images -- [колькасць] [--dry-run]
 * Прыклад: npm run generate-images -- 10
 *
 * Патрэбныя зменныя ў .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 *   (неабавязкова) GEMINI_IMAGE_MODELS: мадэлі праз коску, па чарзе
 *   (неабавязкова) IMAGE_STYLE: апісанне стылю для ўсіх малюнкаў
 *
 * Генерацыя малюнкаў у Gemini API платная: патрэбна ўключаная аплата ў Google AI Studio.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

loadEnv({ path: ".env.local", quiet: true });

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODELS = (
  process.env.GEMINI_IMAGE_MODELS ||
  process.env.GEMINI_IMAGE_MODEL ||
  "gemini-3.1-flash-image,gemini-2.5-flash-image"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const BUCKET = "images";
const SIZE = 768;

// Адзіны стыль для ўсёй калекцыі. Змяняйце пад свой густ.
const STYLE =
  process.env.IMAGE_STYLE ??
  "Flat vector illustration, soft pastel colors, clean white background, " +
    "simple friendly shapes, centered composition, suitable as a flashcard picture.";

type WordRow = {
  id: string;
  be: string;
  en: string | null;
  ru: string | null;
  comment: string | null;
};

function buildPrompt(w: WordRow): string {
  const meanings = [w.en && `English: "${w.en}"`, w.ru && `Russian: "${w.ru}"`]
    .filter(Boolean)
    .join(", ");
  const context = w.comment?.replace(/\s+/g, " ").slice(0, 400);
  return [
    STYLE,
    "",
    `Illustrate the meaning of the Belarusian word or phrase "${w.be}"` +
      (meanings ? ` (${meanings}).` : "."),
    context ? `Context (definition or usage example, in Belarusian): ${context}` : "",
    "Show the concept clearly so that a learner can guess the word from the picture.",
    "Do not include any text, letters, captions or watermarks in the image.",
  ]
    .filter(Boolean)
    .join("\n");
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limit = Math.min(Number(args.find((a) => /^\d+$/.test(a)) ?? 10), 500);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Не зададзены NEXT_PUBLIC_SUPABASE_URL ці SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!GEMINI_KEY && !dryRun) throw new Error("Не зададзены GEMINI_API_KEY.");

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Толькі апублікаваныя: на чарнавікі, якія могуць быць выдаленыя, грошы не трацім.
  const { data, error } = await supabase
    .from("words")
    .select("id, be, en, ru, comment")
    .eq("status", "published")
    .is("image_path", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const words = (data ?? []) as WordRow[];
  if (words.length === 0) {
    console.log("Усе апублікаваныя словы ўжо маюць малюнкі.");
    return;
  }
  console.log(`Слоў для генерацыі: ${words.length}. Мадэлі: ${MODELS.join(", ")}`);

  const ai = dryRun ? null : new GoogleGenAI({ apiKey: GEMINI_KEY! });
  let modelIndex = 0;
  let ok = 0;

  for (const w of words) {
    const prompt = buildPrompt(w);
    console.log(`\n→ ${w.be}`);
    if (!ai) {
      console.log(prompt);
      continue;
    }

    let image: { data: string; mimeType: string } | null = null;
    while (modelIndex < MODELS.length && !image) {
      try {
        const response = await ai.models.generateContent({
          model: MODELS[modelIndex],
          contents: prompt,
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "1:1" },
          },
        });
        const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (!part?.inlineData?.data) {
          console.warn("  мадэль не вярнула малюнак, прапускаю слова");
          break;
        }
        image = { data: part.inlineData.data, mimeType: part.inlineData.mimeType ?? "image/png" };
      } catch (err) {
        const message = errorText(err);
        if (/\b404\b|NOT_FOUND|no longer available/i.test(message)) {
          console.warn(`  мадэль ${MODELS[modelIndex]} недаступная, бяру наступную`);
          modelIndex++;
          continue;
        }
        if (/\b429\b|RESOURCE_EXHAUSTED/.test(message)) {
          const freeTier = /free_tier|limit: 0/i.test(message);
          throw new Error(
            freeTier
              ? "Gemini API не дазваляе генераваць малюнкі на бясплатным тарыфе. " +
                  "Уключыце аплату ў Google AI Studio (Get API key → Set up billing) і запусціце зноў."
              : `Ліміт запытаў Gemini вычарпаны: ${message.slice(0, 300)}`,
          );
        }
        console.error(`  ✗ ${message.slice(0, 300)}`);
        break;
      }
    }
    if (modelIndex >= MODELS.length) throw new Error("Ніводная мадэль малюнкаў недаступная.");
    if (!image) continue;

    try {
      const webp = await sharp(Buffer.from(image.data, "base64"))
        .resize(SIZE, SIZE, { fit: "cover" })
        .webp({ quality: 80 })
        .toBuffer();
      const path = `${w.id}.webp`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, webp, { contentType: "image/webp", upsert: true });
      if (upErr) throw new Error(`сховішча: ${upErr.message}`);

      const { error: dbErr } = await supabase
        .from("words")
        .update({ image_path: path })
        .eq("id", w.id);
      if (dbErr) throw new Error(`база: ${dbErr.message}`);

      ok++;
      console.log(`  ✓ ${path} (${Math.round(webp.length / 1024)} КБ, ${MODELS[modelIndex]})`);
    } catch (err) {
      console.error(`  ✗ ${errorText(err)}`);
    }
  }

  console.log(`\nГатова: ${ok} з ${words.length}.`);
}

main().catch((err) => {
  console.error(errorText(err));
  process.exitCode = 1;
});
