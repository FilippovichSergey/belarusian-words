/**
 * Малюнкі праз дадатак Gemini (падпіска), без Gemini API.
 *
 * 1) Падрыхтаваць пачак слоў:
 *      npm run images:batch -- 10
 *    Ствараецца папка images-batch/<дата-час>/ з файламі prompt.txt і words.json.
 *    Тэкст з prompt.txt устаўляецца ў Gem «Беларускія карткі» (гл. docs/gemini-gem.md).
 *
 * 2) Спампаваць малюнкі з Gemini у тую ж папку па парадку: 1, 2, 3...
 *
 * 3) Праверыць, якое слова атрымае які малюнак:
 *      npm run images:upload -- images-batch/<папка>
 *    Скрыпт стварае preview.html і нічога не загружае.
 *
 * 4) Загрузіць:
 *      npm run images:upload -- images-batch/<папка> --yes
 *
 * Адпаведнасць малюнкаў словам:
 *  - калі назвы ўсіх файлаў пачынаюцца з нумара («3.png», «03 спявак.jpg»), бярэцца нумар;
 *  - інакш файлы сартуюцца па часе спампоўкі, і іх колькасць мусіць супадаць з колькасцю слоў.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

loadEnv({ path: ".env.local", quiet: true });

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const BUCKET = "images";
const SIZE = 768;
const BATCH_ROOT = "images-batch";
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

type BatchWord = { n: number; id: string; be: string; en: string | null; ru: string | null };

function db() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Не зададзены NEXT_PUBLIC_SUPABASE_URL ці SUPABASE_SERVICE_ROLE_KEY у .env.local.");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

/** Першы змястоўны радок каменту, без цытат: кароткі сэнс для мастака. */
function shortMeaning(comment: string | null): string | null {
  if (!comment) return null;
  const line = comment
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("«"));
  return line ? line.slice(0, 160) : null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

async function makeBatch(count: number) {
  const supabase = db();
  const { data, error } = await supabase
    .from("words")
    .select("id, be, en, ru, comment")
    .eq("status", "published")
    .is("image_path", null)
    .order("created_at", { ascending: true })
    .limit(count);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    console.log("Усе апублікаваныя словы ўжо маюць малюнкі.");
    return;
  }

  // Словы, якія ўжо ляжаць у неразгружаных пачках, не паўтараем.
  const pending = new Set<string>();
  if (existsSync(BATCH_ROOT)) {
    for (const dir of readdirSync(BATCH_ROOT)) {
      const file = join(BATCH_ROOT, dir, "words.json");
      if (existsSync(file) && !existsSync(join(BATCH_ROOT, dir, "uploaded.txt"))) {
        for (const w of JSON.parse(readFileSync(file, "utf8")) as BatchWord[]) pending.add(w.id);
      }
    }
  }
  const fresh = data.filter((w) => !pending.has(w.id));
  if (fresh.length === 0) {
    console.log("Усе адабраныя словы ўжо ёсць у неразгружаных пачках у images-batch/.");
    return;
  }

  const words: BatchWord[] = fresh.map((w, i) => ({
    n: i + 1,
    id: w.id,
    be: w.be,
    en: w.en,
    ru: w.ru,
  }));
  const lines = fresh.map((w, i) => {
    const meaning = shortMeaning(w.comment);
    const translations = [w.en, w.ru].filter(Boolean).join(" / ");
    return `${i + 1}. ${w.be}${translations ? ` — ${translations}` : ""}${meaning ? `. Сэнс: ${meaning}` : ""}`;
  });

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})/, "$1-");
  const dir = join(BATCH_ROOT, stamp);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "words.json"), JSON.stringify(words, null, 2), "utf8");
  writeFileSync(
    join(dir, "prompt.txt"),
    `Намалюй карткі для гэтых ${words.length} слоў. Адзін малюнак на кожны пункт, па парадку.\n\n${lines.join("\n")}\n`,
    "utf8",
  );

  console.log(`Пачак з ${words.length} слоў: ${dir}`);
  console.log(`1. Скапіруйце тэкст з ${join(dir, "prompt.txt")} у Gem «Беларускія карткі».`);
  console.log(`2. Спампуйце малюнкі ў папку ${dir} па парадку, ад 1 да ${words.length}.`);
  console.log(`3. Праверце: npm run images:upload -- ${dir.replace(/\\/g, "/")}`);
}

function matchImages(dir: string, words: BatchWord[]) {
  const files = readdirSync(dir).filter((f) => IMAGE_EXT.test(f));
  if (files.length === 0) throw new Error(`У папцы ${dir} няма малюнкаў (png, jpg, webp).`);

  const numbered = files.map((f) => ({ f, n: Number(f.match(/^(\d+)/)?.[1]) }));
  const pairs = new Map<number, string>();

  if (numbered.every((x) => Number.isInteger(x.n))) {
    for (const { f, n } of numbered) {
      if (pairs.has(n)) throw new Error(`Два файлы з нумарам ${n}: ${pairs.get(n)} і ${f}.`);
      if (!words.some((w) => w.n === n)) throw new Error(`Файл ${f}: у пачку няма слова з нумарам ${n}.`);
      pairs.set(n, f);
    }
    return { pairs, mode: "па нумары ў назве файла" };
  }

  if (files.length !== words.length) {
    throw new Error(
      `Малюнкаў ${files.length}, а слоў ${words.length}. Калі нейкі малюнак прапушчаны, ` +
        "перайменуйце файлы па нумары слова (1.png, 2.png...) і запусціце зноў.",
    );
  }
  const byTime = files
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => a.t - b.t || a.f.localeCompare(b.f));
  byTime.forEach(({ f }, i) => pairs.set(words[i].n, f));
  return { pairs, mode: "па часе спампоўкі" };
}

function writePreview(dir: string, words: BatchWord[], pairs: Map<number, string>, mode: string) {
  const cards = words
    .map((w) => {
      const file = pairs.get(w.n);
      const img = file
        ? `<img src="${escapeHtml(encodeURIComponent(file))}" alt="">`
        : `<div class="none">няма малюнка</div>`;
      return `<figure>${img}<figcaption><b>${w.n}. ${escapeHtml(w.be)}</b><br>${escapeHtml(
        [w.en, w.ru].filter(Boolean).join(" / "),
      )}<br><small>${file ? escapeHtml(file) : ""}</small></figcaption></figure>`;
    })
    .join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>Праверка малюнкаў</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;background:#fafaf9;color:#1c1917}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
figure{margin:0;background:#fff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden}
img,.none{width:100%;aspect-ratio:1;object-fit:cover;display:block}.none{display:grid;place-items:center;color:#a8a29e}
figcaption{padding:10px}small{color:#78716c}</style>
<h1>Праверка: ${words.length} слоў, адпаведнасць ${escapeHtml(mode)}</h1>
<p>Калі ўсё правільна, запусціце загрузку з параметрам --yes.</p>
<div class="grid">${cards}</div>`;
  const file = join(dir, "preview.html");
  writeFileSync(file, html, "utf8");
  return file;
}

async function upload(dirArg: string, confirmed: boolean, force: boolean) {
  const dir = resolve(dirArg);
  const wordsFile = join(dir, "words.json");
  if (!existsSync(wordsFile)) throw new Error(`Няма ${wordsFile}. Пачак ствараецца камандай images:batch.`);
  const words = JSON.parse(readFileSync(wordsFile, "utf8")) as BatchWord[];

  const { pairs, mode } = matchImages(dir, words);
  const preview = writePreview(dir, words, pairs, mode);
  console.log(`Адпаведнасць ${mode}:`);
  for (const w of words) console.log(`  ${w.n}. ${w.be}  ←  ${pairs.get(w.n) ?? "(няма малюнка)"}`);
  console.log(`\nПраверка ў браўзеры: ${pathToFileURL(preview).href}`);

  if (!confirmed) {
    console.log("Нічога не загружана. Калі ўсё правільна, дадайце --yes.");
    return;
  }

  const supabase = db();
  let ok = 0;
  for (const w of words) {
    const file = pairs.get(w.n);
    if (!file) continue;

    const { data: current, error: readErr } = await supabase
      .from("words")
      .select("image_path")
      .eq("id", w.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) {
      console.warn(`  ${w.n}. ${w.be}: слова выдалена з базы, прапускаю`);
      continue;
    }
    if (current.image_path && !force) {
      console.warn(`  ${w.n}. ${w.be}: ужо мае малюнак, прапускаю (каб замяніць, дадайце --force)`);
      continue;
    }

    const webp = await sharp(readFileSync(join(dir, file)))
      .resize(SIZE, SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
    const path = `${w.id}.webp`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, webp, { contentType: "image/webp", upsert: true });
    if (upErr) throw new Error(`${w.be}: сховішча: ${upErr.message}`);
    const { error: dbErr } = await supabase.from("words").update({ image_path: path }).eq("id", w.id);
    if (dbErr) throw new Error(`${w.be}: база: ${dbErr.message}`);
    ok++;
    console.log(`  ✓ ${w.n}. ${w.be} (${Math.round(webp.length / 1024)} КБ)`);
  }

  writeFileSync(join(dir, "uploaded.txt"), `${new Date().toISOString()}\n${ok} малюнкаў\n`, "utf8");
  console.log(`\nЗагружана: ${ok} з ${words.length}. Пачак ${basename(dir)} пазначаны як загружаны.`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "batch") {
    const count = Number(rest.find((a) => /^\d+$/.test(a)) ?? 10);
    await makeBatch(Math.min(Math.max(count, 1), 50));
  } else if (command === "upload") {
    const dir = rest.find((a) => !a.startsWith("--"));
    if (!dir) throw new Error("Пазначце папку пачка: npm run images:upload -- images-batch/<папка>");
    await upload(dir, rest.includes("--yes"), rest.includes("--force"));
  } else {
    throw new Error("Каманды: batch [колькасць] | upload <папка> [--yes] [--force]");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
