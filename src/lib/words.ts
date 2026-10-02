import { createClient } from "@/lib/supabase/server";
import type { Word } from "@/lib/types";

export const IMAGES_BUCKET = "images";

export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/${IMAGES_BUCKET}/${path}`;
}

export async function listWords(q?: string): Promise<Word[]> {
  const supabase = await createClient();
  let query = supabase
    .from("words")
    .select("*")
    .order("created_at", { ascending: false });

  const term = q?.trim().replace(/[,()]/g, " ").trim();
  if (term) {
    const pattern = `%${term}%`;
    query = query.or(
      [
        `be.ilike.${pattern}`,
        `be_lat.ilike.${pattern}`,
        `en.ilike.${pattern}`,
        `ru.ilike.${pattern}`,
        `comment.ilike.${pattern}`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Word[];
}

export async function getWord(id: string): Promise<Word | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Word | null) ?? null;
}
