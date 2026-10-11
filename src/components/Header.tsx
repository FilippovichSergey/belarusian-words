import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { countDrafts } from "@/lib/words";

export async function Header() {
  const user = await getCurrentUser();
  const drafts = user ? await countDrafts() : 0;

  return (
    <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Беларускія словы
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              {drafts > 0 && (
                <Link
                  href="/drafts"
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
                >
                  Чарнавікі: {drafts}
                </Link>
              )}
              <Link
                href="/words/new"
                className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
              >
                + Дадаць
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                  title={user.email ?? undefined}
                >
                  Выйсці
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            >
              Увайсці
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
