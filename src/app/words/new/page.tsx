import { WordForm } from "@/components/WordForm";
import { createWord } from "@/app/words/actions";

export default function NewWordPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Новае слова</h1>
      <WordForm action={createWord} submitLabel="Дадаць" cancelHref="/" />
    </div>
  );
}
