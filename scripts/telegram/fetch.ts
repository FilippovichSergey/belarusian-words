/**
 * Чытанне публічнага вэб-прэв'ю канала: https://t.me/s/<username>.
 * Уваход у Telegram і ключы не патрэбныя.
 */

export type Post = {
  id: number;
  url: string;
  date: string | null;
  /** Тэкст паста: радкі праз \n, цытаты ў «вёлачках». */
  text: string;
  imageUrls: string[];
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; belarusian-words-sync/1.0; +https://github.com/FilippovichSergey/belarusian-words)";

export function decodeHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g, (_, q) => `\n«${q.trim()}»\n`)
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Змесціва першага <div> з дадзеным класам, з улікам укладзеных <div>. */
function innerDiv(html: string, classAttr: string): string | null {
  const open = html.indexOf(`<div class="${classAttr}"`);
  if (open < 0) return null;
  const start = html.indexOf(">", open) + 1;
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = start;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html))) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index);
  }
  return null;
}

export function parseChannelPage(html: string, username: string): Post[] {
  const posts: Post[] = [];
  for (const block of html.split(/<div class="tgme_widget_message_wrap/).slice(1)) {
    const idMatch = block.match(/data-post="[^"/]+\/(\d+)"/);
    if (!idMatch) continue;
    const id = Number(idMatch[1]);
    const raw = innerDiv(block, "tgme_widget_message_text js-message_text");
    const imageUrls = [
      ...block.matchAll(
        /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/g,
      ),
    ]
      .map((m) => m[1])
      .filter((u) => u.startsWith("https://"));

    posts.push({
      id,
      url: `https://t.me/${username}/${id}`,
      date: block.match(/<time datetime="([^"]+)"/)?.[1] ?? null,
      text: raw ? decodeHtml(raw) : "",
      imageUrls,
    });
  }
  return posts.sort((a, b) => a.id - b.id);
}

/** Тэкст сеткавай памылкі з прычынай: «fetch failed» сам па сабе нічога не кажа. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
  const detail = cause?.code ?? cause?.message;
  return detail && !err.message.includes(detail) ? `${err.message} (${detail})` : err.message;
}

async function fetchWithRetry(url: string, tries = 4): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "be,en;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      // 429 і 5xx часовыя: паўтараем. Астатнія коды вяртаем як ёсць.
      if (res.status !== 429 && res.status < 500) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < tries) await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  throw new Error(`${url}: ${describeError(lastError)}`);
}

async function fetchPage(username: string, before?: number): Promise<Post[]> {
  const url = `https://t.me/s/${username}${before ? `?before=${before}` : ""}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const html = await res.text();
  if (!html.includes("tgme_widget_message")) {
    throw new Error(`${url}: няма паведамленняў. Канал прыватны ці прэв'ю выключана.`);
  }
  return parseChannelPage(html, username);
}

/**
 * Вяртае пасты з id > afterId, ад старых да новых.
 * Калі afterId не зададзены (першы запуск), бярэ `firstRunPages` апошніх старонак.
 */
export async function fetchNewPosts(
  username: string,
  afterId: number | null,
  opts: { firstRunPages?: number; maxPages?: number } = {},
): Promise<Post[]> {
  const pageLimit = afterId === null ? (opts.firstRunPages ?? 1) : (opts.maxPages ?? 15);
  const byId = new Map<number, Post>();
  let before: number | undefined;

  for (let page = 0; page < pageLimit; page++) {
    const posts = await fetchPage(username, before);
    if (posts.length === 0) break;
    for (const p of posts) byId.set(p.id, p);
    const oldest = posts[0].id;
    if (afterId !== null && oldest <= afterId + 1) break;
    if (oldest <= 1) break;
    before = oldest;
    await new Promise((r) => setTimeout(r, 800));
  }

  return [...byId.values()]
    .filter((p) => afterId === null || p.id > afterId)
    .sort((a, b) => a.id - b.id);
}
