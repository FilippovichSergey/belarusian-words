import Link from "next/link";
import { WordCard } from "@/components/WordCard";
import { getCurrentUser } from "@/lib/supabase/server";
import { listWords } from "@/lib/words";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const [words, user] = await Promise.all([
    listWords(query),
    getCurrentUser(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Пошук па слове, перакладзе ці каменце..."
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-stone-700 dark:bg-stone-900 dark:focus:ring-emerald-900"
        />
        <button
          type="submit"
          className="rounded-md bg-stone-800 px-4 py-2 text-white hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300"
        >
          Шукаць
        </button>
      </form>

      {words.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500 dark:border-stone-700">
          {query ? (
            <p>Нічога не знойдзена па запыце «{query}».</p>
          ) : user ? (
            <p>
              Слоў пакуль няма.{" "}
              <Link
                href="/words/new"
                className="text-emerald-700 underline dark:text-emerald-400"
              >
                Дадаць першае
              </Link>
              .
            </p>
          ) : (
            <p>
              Слоў пакуль няма.{" "}
              <Link
                href="/login"
                className="text-emerald-700 underline dark:text-emerald-400"
              >
                Увайдзіце
              </Link>
              , каб дадаць першае.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-stone-500">
            {query ? `Знойдзена: ${words.length}` : `Усяго слоў: ${words.length}`}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {words.map((w) => (
              <WordCard key={w.id} word={w} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
