import Image from "next/image";
import Link from "next/link";
import type { Word } from "@/lib/types";
import { imageUrl } from "@/lib/words";

export function WordCard({ word }: { word: Word }) {
  const src = imageUrl(word.image_path);

  return (
    <Link
      href={`/words/${word.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="relative aspect-square w-full bg-stone-100 dark:bg-stone-800">
        {src ? (
          <Image
            src={src}
            alt={word.be}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-stone-300 dark:text-stone-600">
            ✎
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <div className="text-base font-semibold">{word.be}</div>
        {word.be_lat && (
          <div className="text-sm italic text-stone-500 dark:text-stone-400">
            {word.be_lat}
          </div>
        )}
        {word.en && (
          <div className="text-sm text-stone-600 dark:text-stone-400">
            EN: {word.en}
          </div>
        )}
        {word.ru && (
          <div className="text-sm text-stone-600 dark:text-stone-400">
            RU: {word.ru}
          </div>
        )}
      </div>
    </Link>
  );
}
