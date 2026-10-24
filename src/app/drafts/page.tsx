import Link from "next/link";
import { DeleteButton } from "@/components/DeleteButton";
import { listWords, safeSourceUrl } from "@/lib/words";
import { channelTitle } from "@/lib/telegram-channels";
import { discardDraft, publishAllDrafts, publishWord } from "@/app/words/actions";

export const metadata = { title: "Чарнавікі" };

const buttonClass =
  "rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60";

export default async function DraftsPage() {
  const drafts = await listWords(undefined, "draft");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Чарнавікі</h1>
          <p className="text-sm text-stone-500">
            Словы, сабраныя аўтаматычна з Telegram-каналаў. Іх бачыце толькі вы,
            пакуль не апублікуеце.
          </p>
        </div>
        {drafts.length > 1 && (
          <form action={publishAllDrafts}>
            <button
              type="submit"
              className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              Апублікаваць усе ({drafts.length})
            </button>
          </form>
        )}
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500 dark:border-stone-700">
          Чарнавікоў няма. Новыя з&apos;явяцца пасля наступнай сінхранізацыі.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {drafts.map((word) => {
            const source = safeSourceUrl(word.source_url);
            return (
              <li
                key={word.id}
                className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="text-lg font-semibold">{word.be}</div>
                  {word.be_lat && (
                    <div className="text-sm italic text-stone-500 dark:text-stone-400">
                      {word.be_lat}
                    </div>
                  )}
                  <div className="text-sm text-stone-700 dark:text-stone-300">
                    <span className="font-medium text-stone-500">EN</span> {word.en ?? "—"}
                    <span className="mx-2 text-stone-300 dark:text-stone-600">|</span>
                    <span className="font-medium text-stone-500">RU</span> {word.ru ?? "—"}
                  </div>
                  {word.comment && (
                    <p className="whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-400">
                      {word.comment}
                    </p>
                  )}
                  {source && (
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-700 underline dark:text-emerald-400"
                    >
                      Пост у канале «{channelTitle(word.source)}»
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <form action={publishWord.bind(null, word.id)}>
                    <button
                      type="submit"
                      className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-700`}
                    >
                      Апублікаваць
                    </button>
                  </form>
                  <Link
                    href={`/words/${word.id}/edit`}
                    className={`${buttonClass} border border-stone-300 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800`}
                  >
                    Рэдагаваць
                  </Link>
                  <DeleteButton
                    action={discardDraft.bind(null, word.id)}
                    confirmText="Выдаліць гэты чарнавік?"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
