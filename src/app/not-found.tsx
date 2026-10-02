import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Старонка не знойдзена</h1>
      <Link href="/" className="text-emerald-700 underline dark:text-emerald-400">
        На галоўную
      </Link>
    </div>
  );
}
