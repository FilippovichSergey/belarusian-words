/**
 * Штодзённая сінхранізацыя: новыя пасты з Telegram-каналаў -> словы ў базе.
 *
 * Запуск:
 *   npm run sync-telegram                      усе каналы
 *   npm run sync-telegram -- --dry-run         нічога не запісвае, толькі паказвае
 *   npm run sync-telegram -- --channel modaNaMovu
 *   npm run sync-telegram -- --pages 5         глыбіня першага запуску (20 пастоў на старонку)
 *
 * Зменныя асяроддзя (.env.local лакальна, Secrets у GitHub Actions):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 *   (неабавязкова) GEMINI_TEXT_MODELS: спіс мадэляў праз коску
 *
 * Спіс каналаў: scripts/telegram/channels.ts
 */
import { appendFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CHANNELS, type ChannelConfig } from "./telegram/channels";
import {
  createAiExtractor,
  extractExact,
  QuotaExhaustedError,
  splitIntoBatches,
  type AiExtractor,
  type Entry,
} from "./telegram/extract";
import { fetchNewPosts } from "./telegram/fetch";
import { wordKey } from "./telegram/lacinka";

loadEnv({ path: ".env.local", quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
// Бясплатны тарыф дае каля 20 запытаў на дзень на мадэль, таму ёсць запасныя.
const TEXT_MODELS = (
  process.env.GEMINI_TEXT_MODELS ||
  "gemini-flash-latest,gemini-3.6-flash,gemini-3.5-flash,gemini-flash-lite-latest"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
// Паўза паміж запытамі да Gemini, каб не ўпірацца ў ліміт бясплатнага тарыфу.
const AI_DELAY_MS = Number(process.env.GEMINI_DELAY_MS ?? 4500);

type Stats = {
  channel: string;
  posts: number;
  published: number;
  drafts: number;
  duplicates: number;
  error: string | null;
  /** Не памылка: напрыклад, ліміт Gemini вычарпаны і працяг будзе заўтра. */
  note: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadExistingKeys(db: SupabaseClient): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("words").select("be").range(from, from + 999);
    if (error) throw new Error(`чытанне слоў: ${error.message}`);
    for (const row of data ?? []) keys.add(wordKey(row.be as string));
    if (!data || data.length < 1000) break;
  }
  return keys;
}

async function syncChannel(
  channel: ChannelConfig,
  ctx: {
    db: SupabaseClient | null;
    keys: Set<string>;
    ai: AiExtractor | null;
    dryRun: boolean;
    firstRunPages: number;
  },
): Promise<Stats> {
  const stats: Stats = {
    channel: channel.username,
    posts: 0,
    published: 0,
    drafts: 0,
    duplicates: 0,
    error: null,
    note: null,
  };
  const { db, keys, ai, dryRun } = ctx;

  let lastId: number | null = null;
  if (db) {
    const { data, error } = await db
      .from("telegram_sync")
      .select("last_post_id")
      .eq("channel", channel.username)
      .maybeSingle();
    if (error && !dryRun) throw new Error(`чытанне стану: ${error.message}`);
    if (error) console.warn(`Стан сінхранізацыі недаступны (${error.message}). Лічу запуск першым.`);
    lastId = (data?.last_post_id as number | undefined) ?? null;
  }

  const posts = await fetchNewPosts(channel.username, lastId, {
    firstRunPages: ctx.firstRunPages,
  });
  console.log(
    `\n== ${channel.username}: новых пастоў ${posts.length}` +
      (lastId === null ? " (першы запуск)" : `, пасля №${lastId}`),
  );

  // 1) Дакладны фармат разбіраецца правіламі, без ШІ.
  const entriesByPost = new Map<number, Entry[]>();
  const needAi = [];
  for (const post of posts) {
    const exact = extractExact(post.text);
    if (exact.length > 0) {
      entriesByPost.set(post.id, exact);
    } else if (post.text.length > 0 || (channel.readImages && post.imageUrls.length > 0)) {
      needAi.push(post);
    } else {
      entriesByPost.set(post.id, []);
    }
  }

  // 2) Астатнія пасты ідуць у Gemini пачкамі. Пры збоі спыняемся на першым
  //    неразабраным пасце: наступны запуск пачне з яго.
  let stopBeforeId = Infinity;
  if (needAi.length > 0 && !ai) {
    stats.error = "GEMINI_API_KEY не зададзены, пасты ў вольным фармаце не разабраныя";
    stopBeforeId = needAi[0].id;
  } else if (ai) {
    const batches = splitIntoBatches(needAi, channel.readImages);
    for (let i = 0; i < batches.length; i++) {
      try {
        if (i > 0) await sleep(AI_DELAY_MS);
        const found = await ai(batches[i], channel.readImages);
        for (const [id, entries] of found) entriesByPost.set(id, entries);
      } catch (err) {
        stopBeforeId = batches[i][0].id;
        const left = posts.filter((p) => p.id >= stopBeforeId).length;
        if (err instanceof QuotaExhaustedError) {
          stats.note = `ліміт Gemini вычарпаны, засталося пастоў: ${left}. Працяг пры наступным запуску`;
        } else {
          stats.error = `Gemini, пост ${batches[i][0].url}: ${(err as Error).message.slice(0, 200)}`;
        }
        break;
      }
    }
  }

  // 3) Запіс па парадку пастоў.
  let processedUpTo = lastId;
  for (const post of posts) {
    if (post.id >= stopBeforeId) break;
    const entries = entriesByPost.get(post.id) ?? [];
    stats.posts++;

    const rows = [];
    for (const e of entries) {
      const key = wordKey(e.be);
      if (!key || keys.has(key)) {
        stats.duplicates++;
        continue;
      }
      keys.add(key);
      const status = e.exact && channel.autoPublishExact ? "published" : "draft";
      if (status === "published") stats.published++;
      else stats.drafts++;
      rows.push({
        be: e.be,
        be_lat: e.be_lat,
        en: e.en,
        ru: e.ru,
        comment: e.comment,
        tags: [channel.tag],
        status,
        source: channel.username,
        source_url: post.url,
        ...(post.date ? { created_at: post.date } : {}),
      });
      console.log(
        `  ${status === "draft" ? "чарнавік" : "апублікавана"}: ${e.be} / ${e.be_lat} / ${e.en ?? "-"} / ${e.ru ?? "-"}`,
      );
    }
    if (entries.length === 0) console.log(`  (нічога) ${post.url}`);

    if (!dryRun && db) {
      if (rows.length > 0) {
        const { error } = await db.from("words").insert(rows);
        if (error) {
          stats.error = `запіс, пост ${post.url}: ${error.message}`;
          break;
        }
      }
      processedUpTo = post.id;
    }
  }

  if (!dryRun && db && processedUpTo !== null && processedUpTo !== lastId) {
    const { error } = await db.from("telegram_sync").upsert({
      channel: channel.username,
      last_post_id: processedUpTo,
      updated_at: new Date().toISOString(),
    });
    if (error) stats.error = `захаванне стану: ${error.message}`;
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const only = args.includes("--channel") ? args[args.indexOf("--channel") + 1] : null;
  const pagesArg = args.includes("--pages") ? Number(args[args.indexOf("--pages") + 1]) : 1;
  const firstRunPages = Number.isInteger(pagesArg) && pagesArg > 0 ? Math.min(pagesArg, 30) : 1;

  const channels = CHANNELS.filter(
    (c) => !only || c.username.toLowerCase() === only.toLowerCase(),
  );
  if (channels.length === 0) throw new Error(`Канал «${only}» не знойдзены ў channels.ts.`);

  let db: SupabaseClient | null = null;
  let keys = new Set<string>();
  if (SUPABASE_URL && SERVICE_KEY) {
    db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    try {
      keys = await loadExistingKeys(db);
      console.log(`Слоў у базе: ${keys.size}.`);
    } catch (err) {
      if (!dryRun) throw err;
      console.warn(`База недаступная (${(err as Error).message}). Dry-run без праверкі дублікатаў.`);
      db = null;
    }
  } else if (!dryRun) {
    throw new Error("Не зададзены NEXT_PUBLIC_SUPABASE_URL ці SUPABASE_SERVICE_ROLE_KEY.");
  }

  const ai = GEMINI_KEY ? createAiExtractor(GEMINI_KEY, TEXT_MODELS) : null;
  if (dryRun) console.log("DRY RUN: у базу нічога не запісваецца.");

  const all: Stats[] = [];
  for (const channel of channels) {
    try {
      all.push(await syncChannel(channel, { db, keys, ai, dryRun, firstRunPages }));
    } catch (err) {
      all.push({
        channel: channel.username,
        posts: 0,
        published: 0,
        drafts: 0,
        duplicates: 0,
        error: (err as Error).message,
        note: null,
      });
    }
  }

  const lines = [
    "| Канал | Пастоў | Апублікавана | Чарнавікоў | Дублікатаў | Заўвага |",
    "|---|---|---|---|---|---|",
    ...all.map(
      (s) =>
        `| ${s.channel} | ${s.posts} | ${s.published} | ${s.drafts} | ${s.duplicates} | ${s.error ? `ПАМЫЛКА: ${s.error}` : (s.note ?? "")} |`,
    ),
  ];
  console.log("\n" + lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Сінхранізацыя Telegram\n\n${lines.join("\n")}\n`);
  }

  if (all.some((s) => s.error)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
