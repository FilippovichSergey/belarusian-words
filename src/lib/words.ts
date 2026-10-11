import { createClient } from "@/lib/supabase/server";
import type { Word } from "@/lib/types";

export const IMAGES_BUCKET = "images";

export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/${IMAGES_BUCKET}/${path}`;
}

/** Спасылка на крыніцу паказваецца толькі для пастоў Telegram. */
export function safeSourceUrl(url: string | null | undefined): string | null {
  return url && /^https:\/\/t\.me\/\w+\/\d+$/.test(url) ? url : null;
}

// Код Postgres «няма такой калонкі»: міграцыя са статусам яшчэ не выкананая.
const UNDEFINED_COLUMN = "42703";

function normalize(row: Record<string, unknown>): Word {
  return { status: "published", source: null, source_url: null, ...row } as Word;
}

function searchFilter(q?: string): string | null {
  const term = q?.trim().replace(/[,()]/g, " ").trim();
  if (!term) return null;
  const pattern = `%${term}%`;
  return ["be", "be_lat", "en", "ru", "comment"]
    .map((column) => `${column}.ilike.${pattern}`)
    .join(",");
}

export async function listWords(
  q?: string,
  status: Word["status"] = "published",
): Promise<Word[]> {
  const supabase = await createClient();
  const filter = searchFilter(q);

  const run = (withStatus: boolean) => {
    let query = supabase
      .from("words")
      .select("*")
      .order("created_at", { ascending: false });
    if (withStatus) query = query.eq("status", status);
    if (filter) query = query.or(filter);
    return query;
  };

  let { data, error } = await run(true);
  if (error?.code === UNDEFINED_COLUMN) {
    // Да міграцыі ўсе словы лічацца апублікаванымі, чарнавікоў няма.
    if (status === "draft") return [];
    ({ data, error } = await run(false));
  }
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalize);
}

export async function countDrafts(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("words")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  return error ? 0 : (count ?? 0);
}

export async function getWord(id: string): Promise<Word | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalize(data) : null;
}
