/**
 * Імпарт слоў з HTML-экспарту Telegram-канала.
 *
 * Чакае паведамленні ў фармаце:
 *   Кірыліца / Lacinka / English / Русский
 *   (неабавязкова) тлумачэнне
 *   (неабавязкова) цытата ў <blockquote>
 *
 * Запуск:
 *   npm run import-telegram -- words/messages2.html            (запіс у базу)
 *   npm run import-telegram -- words/messages2.html --dry-run  (толькі статыстыка)
 *   npm run import-telegram -- words/messages2.html --sql out.sql
 *
 * Запіс у базу патрабуе SUPABASE_SERVICE_ROLE_KEY у .env.local.
 * Без яго скрыпт стварае SQL-файл, які трэба выканаць у Supabase SQL Editor.
 * Словы, якія ўжо ёсць у базе (па полі be), не дублююцца. Калі ў іх яшчэ няма
 * крыніцы, скрыпт прапісвае канал і спасылку на пост.
 *
 * Канал па змаўчанні verbarium_by, іншы задаецца праз --channel <username>.
 * Нумары паведамленняў у экспарце супадаюць з нумарамі пастоў на t.me.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { CHANNELS } from "../src/lib/telegram-channels";
import { wordKey } from "./telegram/lacinka";

loadEnv({ path: ".env.local", quiet: true });

const channelArg = process.argv.indexOf("--channel");
const CHANNEL = channelArg >= 0 ? process.argv[channelArg + 1] : "verbarium_by";
const SOURCE_TAG = CHANNELS.find((c) => c.username === CHANNEL)?.tag ?? CHANNEL.toLowerCase();

type Row = {
  be: string;
  be_lat: string;
  en: string;
  ru: string;
  comment: string | null;
  tags: string[];
  created_at: string | null;
  source: string;
  source_url: string | null;
};

function decode(s: string): string {
  return s
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

const CYRILLIC = /[Ѐ-ӿ]/;
const LATIN = /[A-Za-zÀ-ɏ]/;

function parseWordLine(line: string) {
  const parts = line.split(/\s*\/\s*/).map((p) => p.trim());
  if (parts.length !== 4 || parts.some((p) => !p || p.length > 80)) return null;
  const [be, be_lat, en, ru] = parts;
  if (!CYRILLIC.test(be) || !LATIN.test(be_lat) || !LATIN.test(en)) return null;
  return { be, be_lat, en, ru };
}

// "08.08.2025 11:31:01 UTC+04:00" -> ISO
function parseDate(title: string | undefined): string | null {
  const m = title?.match(
    /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2}) UTC([+-]\d{2}:\d{2})$/,
  );
  if (!m) return null;
  const [, d, mo, y, t, tz] = m;
  return new Date(`${y}-${mo}-${d}T${t}${tz}`).toISOString();
}

export function parseExport(html: string): { rows: Row[]; skipped: number } {
  const rows: Row[] = [];
  let skipped = 0;

  for (const msg of html.split(/<div class="message default/).slice(1)) {
    const textMatch = msg.match(/<div class="text">\s*([\s\S]*?)\s*<\/div>/);
    if (!textMatch) {
      skipped++;
      continue;
    }
    const raw = textMatch[1];
    const quotes = [...raw.matchAll(/<blockquote>([\s\S]*?)<\/blockquote>/g)]
      .map((q) => decode(q[1]).trim())
      .filter(Boolean);
    const lines = decode(raw.replace(/<blockquote>[\s\S]*?<\/blockquote>/g, ""))
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const words = lines.map(parseWordLine);
    const found = words.filter((w): w is NonNullable<typeof w> => w !== null);
    if (found.length === 0) {
      skipped++;
      continue;
    }

    const notes = lines.filter((_, i) => words[i] === null);
    const comment = [...notes, ...quotes.map((q) => `«${q}»`)].join("\n\n") || null;
    const created_at = parseDate(
      msg.match(/class="pull_right date details" title="([^"]+)"/)?.[1],
    );
    const messageId = msg.match(/id="message(\d+)"/)?.[1];
    const source_url = messageId ? `https://t.me/${CHANNEL}/${messageId}` : null;

    for (const w of found) {
      rows.push({ ...w, comment, tags: [SOURCE_TAG], created_at, source: CHANNEL, source_url });
    }
  }

  return { rows, skipped };
}

function dedupe(rows: Row[]): Row[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = wordKey(r.be);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sqlString(v: string | null): string {
  return v === null ? "null" : `'${v.replace(/'/g, "''")}'`;
}

function toSql(rows: Row[]): string {
  const values = rows
    .map(
      (r) =>
        `  (${sqlString(r.be)}, ${sqlString(r.be_lat)}, ${sqlString(r.en)}, ${sqlString(r.ru)}, ` +
        `${sqlString(r.comment)}, array[${r.tags.map(sqlString).join(", ")}]::text[], ` +
        `${r.created_at ? `${sqlString(r.created_at)}::timestamptz` : "now()"}, ` +
        `${sqlString(r.source)}, ${sqlString(r.source_url)})`,
    )
    .join(",\n");

  return `-- Імпарт ${rows.length} слоў. Выканайце ў Supabase SQL Editor.
-- Паўторны запуск бяспечны: існуючыя словы (па полі be) не дублююцца,
-- а тым, у каго няма крыніцы, прапісваюцца канал і спасылка на пост.

with v(be, be_lat, en, ru, comment, tags, created_at, source, source_url) as (values
${values}
),
updated as (
  update public.words w
  set source = v.source, source_url = v.source_url
  from v
  where lower(w.be) = lower(v.be) and w.source is null
  returning w.id
)
insert into public.words (be, be_lat, en, ru, comment, tags, created_at, source, source_url)
select v.be, v.be_lat, v.en, v.ru, v.comment, v.tags, v.created_at, v.source, v.source_url
from v
where not exists (
  select 1 from public.words w where lower(w.be) = lower(v.be)
);
`;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find(
    (a, i) => !a.startsWith("--") && !a.endsWith(".sql") && args[i - 1] !== "--channel",
  );
  const dryRun = args.includes("--dry-run");
  const sqlIdx = args.indexOf("--sql");
  let sqlOut = sqlIdx >= 0 ? args[sqlIdx + 1] : undefined;

  if (!file) throw new Error("Пазначце шлях да HTML-экспарту.");

  const { rows: all, skipped } = parseExport(readFileSync(file, "utf8"));
  const rows = dedupe(all);
  console.log(
    `Знойдзена слоў: ${all.length}, унікальных: ${rows.length}, ` +
      `прапушчана паведамленняў без слоў: ${skipped}.`,
  );

  if (dryRun) {
    rows.slice(0, 5).forEach((r) => console.log(" ", r.be, "/", r.be_lat, "/", r.en, "/", r.ru));
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!sqlOut && (!url || !serviceKey)) {
    sqlOut = file.replace(/\.html?$/i, "") + ".import.sql";
    console.log("SUPABASE_SERVICE_ROLE_KEY не зададзены, ствараю SQL-файл.");
  }

  if (sqlOut) {
    writeFileSync(sqlOut, toSql(rows), "utf8");
    console.log(`SQL запісаны ў ${sqlOut}. Выканайце яго ў Supabase SQL Editor.`);
    return;
  }

  const supabase = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const existing: { id: string; be: string; source: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("words")
      .select("id, be, source")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    existing.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const byKey = new Map(existing.map((w) => [wordKey(w.be), w]));
  const fresh = rows.filter((r) => !byKey.has(wordKey(r.be)));

  // Словы, імпартаваныя раней без крыніцы: прапісваем канал і спасылку на пост.
  let sourced = 0;
  for (const r of rows) {
    const match = byKey.get(wordKey(r.be));
    if (!match || match.source) continue;
    const { error } = await supabase
      .from("words")
      .update({ source: r.source, source_url: r.source_url })
      .eq("id", match.id)
      .is("source", null);
    if (error) throw new Error(`крыніца для «${r.be}»: ${error.message}`);
    sourced++;
  }

  for (let i = 0; i < fresh.length; i += 100) {
    const batch = fresh.slice(i, i + 100).map((r) => ({
      ...r,
      created_at: r.created_at ?? undefined,
    }));
    const { error } = await supabase.from("words").insert(batch);
    if (error) throw new Error(error.message);
  }
  console.log(
    `Дададзена: ${fresh.length}. Ужо было ў базе: ${rows.length - fresh.length}. ` +
      `Прапісана крыніца: ${sourced}.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
