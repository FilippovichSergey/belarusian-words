import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Уваход</h1>
      <LoginForm next={nextPath} />
    </div>
  );
}
