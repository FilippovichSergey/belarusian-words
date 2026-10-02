import { notFound } from "next/navigation";
import { WordForm } from "@/components/WordForm";
import { getWord, imageUrl } from "@/lib/words";
import { updateWord } from "@/app/words/actions";

export default async function EditWordPage({ params }: PageProps<"/words/[id]/edit">) {
  const { id } = await params;
  const word = await getWord(id);
  if (!word) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Рэдагаваць: {word.be}</h1>
      <WordForm
        action={updateWord.bind(null, word.id)}
        word={word}
        imageSrc={imageUrl(word.image_path)}
        submitLabel="Захаваць"
        cancelHref={`/words/${word.id}`}
      />
    </div>
  );
}
