"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Нешта пайшло не так</h1>
      <p className="text-stone-600 dark:text-stone-400">
        Не ўдалося звязацца з базай дадзеных. Праверце, што ў файле{" "}
        <code className="rounded bg-stone-200 px-1 dark:bg-stone-800">.env.local</code>{" "}
        (лакальна) ці ў наладах Vercel зададзены правільныя URL і ключ Supabase, і
        што SQL-схема выканана.
      </p>
      {error.message && (
        <pre className="max-w-full overflow-x-auto rounded-md bg-stone-100 p-3 text-left text-xs text-stone-700 dark:bg-stone-900 dark:text-stone-300">
          {error.message}
        </pre>
      )}
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-stone-800 px-4 py-2 text-white hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-300"
      >
        Паспрабаваць зноў
      </button>
    </div>
  );
}
