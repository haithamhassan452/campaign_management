import Link from "next/link";
import { ForbiddenPage } from "@/components/ui";

export default async function Forbidden({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <ForbiddenPage from={from ?? ""} />
      <p className="mt-8 text-xs text-slate-400">
        Seoudi Supermarket · Campaign Management Portal
      </p>
    </main>
  );
}
