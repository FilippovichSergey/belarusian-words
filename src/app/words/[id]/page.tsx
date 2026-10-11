import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { getCurrentUser } from "@/lib/supabase/server";
import { getWord, imageUrl, safeSourceUrl } from "@/lib/words";
import { deleteWord, publishWord } from "@/app/words/actions";

export default async function WordPage({ params }: PageProps<"/words/[id]">) {
  const { id } = await params;
  const [word, user] = await Promise.all([getWord(id), getCurrentUser()]);
  if (!word) notFound();

  const src = imageUrl(word.image_path);
  const source = safeSourceUrl(word.source_url);
  const isDraft = word.status === "draft";
  const created = new Date(word.created_at).toLocaleDateString("be-BY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="flex flex-col gap-6">
      <Link href="/" className="text-sm text-stone-500 hover:underline">
        ← Да спісу
      </Link>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-800">
          {src ? (
            <Image
              src={src}
              alt={word.be}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 320px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl text-stone-300 dark:text-stone-600">
              ✎
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {isDraft && (
            <p className="self-start rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              Чарнавік: гэтае слова бачыце толькі вы
            </p>
          )}
          <h1 className="text-3xl font-bold tracking-tight">{word.be}</h1>
          {word.be_lat && (
            <p className="-mt-2 text-lg italic text-stone-500 dark:text-stone-400">
              {word.be_lat}
            </p>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
            <dt className="font-medium text-stone-500">EN</dt>
            <dd>{word.en ?? <span className="text-stone-400">—</span>}</dd>
            <dt className="font-medium text-stone-500">RU</dt>
            <dd>{word.ru ?? <span className="text-stone-400">—</span>}</dd>
          </dl>

          {word.comment && (
            <p className="whitespace-pre-wrap rounded-lg bg-white p-4 text-stone-700 shadow-sm dark:bg-stone-900 dark:text-stone-300">
              {word.comment}
            </p>
          )}

          {word.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {word.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    href={`/?q=${encodeURIComponent(tag)}`}
                    className="rounded-full bg-stone-200 px-3 py-1 text-xs text-stone-700 hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                  >
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-stone-500">
            Дададзена: {created}
            {source && (
              <>
                {" · "}
                <a
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-stone-700 dark:hover:text-stone-300"
                >
                  крыніца: {word.source}
                </a>
              </>
            )}
          </p>

          {user && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {isDraft && (
                <form action={publishWord.bind(null, word.id)}>
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Апублікаваць
                  </button>
                </form>
              )}
              <Link
                href={`/words/${word.id}/edit`}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
              >
                Рэдагаваць
              </Link>
              <DeleteButton action={deleteWord.bind(null, word.id)} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
