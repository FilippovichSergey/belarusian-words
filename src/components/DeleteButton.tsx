"use client";

export function DeleteButton({
  action,
  label = "Выдаліць",
}: {
  action: () => Promise<void>;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Выдаліць гэтае слова разам з малюнкам?")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        {label}
      </button>
    </form>
  );
}
