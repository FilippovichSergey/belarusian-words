"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { ActionState } from "@/app/words/actions";
import { createClient } from "@/lib/supabase/client";
import type { Word } from "@/lib/types";

const IMAGES_BUCKET = "images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  word?: Word;
  imageSrc?: string | null;
  submitLabel: string;
  cancelHref: string;
};

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-stone-700 dark:bg-stone-900 dark:focus:ring-emerald-900";
const labelClass =
  "mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300";

export function WordForm({
  action,
  word,
  imageSrc,
  submitLabel,
  cancelHref,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (!file) {
      setPreview(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("Файл большы за 10 МБ.");
      e.target.value = "";
      setPreview(null);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setRemoveImage(false);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);

    const formData = new FormData(e.currentTarget);
    const file = formData.get("image");
    formData.delete("image");

    if (file instanceof File && file.size > 0) {
      setUploading(true);
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(IMAGES_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      setUploading(false);
      if (error) {
        setUploadError(`Не ўдалося загрузіць малюнак: ${error.message}`);
        return;
      }
      formData.set("image_path", path);
      formData.delete("remove_image");
    }

    startTransition(() => formAction(formData));
  }

  const busy = pending || uploading;
  const currentImage = !removeImage && !preview ? imageSrc : null;
  const shownImage = preview ?? currentImage ?? null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <input
        type="hidden"
        name="image_path"
        defaultValue={word?.image_path ?? ""}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="be" className={labelClass}>
            Беларускі варыянт кірыліцай *
          </label>
          <input
            id="be"
            name="be"
            required
            defaultValue={word?.be ?? ""}
            className={inputClass}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="be_lat" className={labelClass}>
            Беларускі варыянт лацінкай
          </label>
          <input
            id="be_lat"
            name="be_lat"
            defaultValue={word?.be_lat ?? ""}
            className={inputClass}
            placeholder="Znička"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="en" className={labelClass}>
            Ангельскі пераклад
          </label>
          <input
            id="en"
            name="en"
            defaultValue={word?.en ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="ru" className={labelClass}>
            Рускі пераклад
          </label>
          <input
            id="ru"
            name="ru"
            defaultValue={word?.ru ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="comment" className={labelClass}>
          Камент
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={4}
          defaultValue={word?.comment ?? ""}
          className={inputClass}
          placeholder="Прыклад ужывання, этымалогія, асацыяцыя..."
        />
      </div>

      <div>
        <label htmlFor="tags" className={labelClass}>
          Тэгі (праз коску)
        </label>
        <input
          id="tags"
          name="tags"
          defaultValue={word?.tags?.join(", ") ?? ""}
          className={inputClass}
          placeholder="ежа, прырода, дзеяслоў"
        />
      </div>

      <div>
        <label htmlFor="image" className={labelClass}>
          Малюнак
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {shownImage && (
            <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-lg border border-stone-200 dark:border-stone-700">
              <Image
                src={shownImage}
                alt=""
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              id="image"
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onFileChange}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-stone-300 dark:file:bg-stone-700 dark:hover:file:bg-stone-600"
            />
            {imageSrc && !preview && (
              <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                <input
                  type="checkbox"
                  name="remove_image"
                  checked={removeImage}
                  onChange={(e) => setRemoveImage(e.target.checked)}
                />
                Выдаліць бягучы малюнак
              </label>
            )}
            <p className="text-xs text-stone-500">
              PNG, JPEG, WebP ці GIF, да 10 МБ.
            </p>
          </div>
        </div>
      </div>

      {(uploadError || state?.error) && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {uploadError ?? state?.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {uploading
            ? "Загрузка малюнка..."
            : pending
              ? "Захаванне..."
              : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="text-sm text-stone-600 hover:underline dark:text-stone-400"
        >
          Адмена
        </Link>
      </div>
    </form>
  );
}
