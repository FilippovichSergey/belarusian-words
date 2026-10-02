"use client";

import { useActionState } from "react";
import { signIn } from "@/app/login/actions";

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-stone-700 dark:bg-stone-900 dark:focus:ring-emerald-900";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Уваход..." : "Увайсці"}
      </button>
      <p className="text-xs text-stone-500">
        Акаўнт ствараецца ўручную ў Supabase: Authentication → Users → Add user.
      </p>
    </form>
  );
}
