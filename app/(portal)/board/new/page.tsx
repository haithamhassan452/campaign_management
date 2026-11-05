import Link from "next/link";
import { requireCapability } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { BANNER_TYPES } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import BriefForm from "@/components/board/BriefForm";

export const dynamic = "force-dynamic";

export default async function NewBriefPage() {
  await requireCapability("brief_create", "New brief");

  return (
    <div className="max-w-3xl">
      <Link href="/board" className="text-sm text-brand-600 hover:underline">
        ← Back to board
      </Link>
      <PageHeader
        title="New campaign brief"
        subtitle="On submit, the brief goes to Procurement and Content simultaneously — two independent tracks. You are recorded as the brief owner."
      />
      <BriefForm minDate={todayIso()} bannerTypes={[...BANNER_TYPES]} />
    </div>
  );
}
