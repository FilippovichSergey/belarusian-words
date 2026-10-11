"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IMAGES_BUCKET } from "@/lib/words";

export type ActionState = { error: string } | null;

type WordInput = {
  be: string;
  be_lat: string | null;
  en: string | null;
  ru: string | null;
  comment: string | null;
  image_path: string | null;
  tags: string[];
};

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseForm(formData: FormData): WordInput | { error: string } {
  const be = text(formData, "be");
  if (!be) return { error: "Слова ці выраз па-беларуску абавязковае." };

  const tags = (text(formData, "tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const removeImage = formData.get("remove_image") === "on";

  return {
    be,
    be_lat: text(formData, "be_lat"),
    en: text(formData, "en"),
    ru: text(formData, "ru"),
    comment: text(formData, "comment"),
    image_path: removeImage ? null : text(formData, "image_path"),
    tags: Array.from(new Set(tags)),
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createWord(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Каб дадаваць словы, трэба ўвайсці." };

  const input = parseForm(formData);
  if ("error" in input) return input;

  const { data, error } = await supabase
    .from("words")
    .insert(input)
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/");
  redirect(`/words/${data.id}`);
}

export async function updateWord(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Каб рэдагаваць словы, трэба ўвайсці." };

  const input = parseForm(formData);
  if ("error" in input) return input;

  const { data: existing } = await supabase
    .from("words")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("words").update(input).eq("id", id);
  if (error) return { error: error.message };

  const oldPath = existing?.image_path as string | null | undefined;
  if (oldPath && oldPath !== input.image_path) {
    await supabase.storage.from(IMAGES_BUCKET).remove([oldPath]);
  }

  revalidatePath("/");
  revalidatePath(`/words/${id}`);
  redirect(`/words/${id}`);
}

export async function deleteWord(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("words")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("words").delete().eq("id", id);
  if (error) throw new Error(error.message);

  const oldPath = existing?.image_path as string | null | undefined;
  if (oldPath) {
    await supabase.storage.from(IMAGES_BUCKET).remove([oldPath]);
  }

  revalidatePath("/");
  redirect("/");
}

/** Публікуе адзін чарнавік. */
export async function publishWord(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("words")
    .update({ status: "published" })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/drafts");
  revalidatePath(`/words/${id}`);
}

/** Публікуе ўсе чарнавікі адразу. */
export async function publishAllDrafts(): Promise<void> {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("words")
    .update({ status: "published" })
    .eq("status", "draft");
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/drafts");
}

/** Выдаляе чарнавік і застаецца на старонцы чаргі. */
export async function discardDraft(id: string): Promise<void> {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("words")
    .delete()
    .eq("id", id)
    .eq("status", "draft");
  if (error) throw new Error(error.message);

  revalidatePath("/drafts");
}
