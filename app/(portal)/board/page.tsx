import { requireCapability } from "@/lib/auth";
import { loadAllCampaignCards } from "@/lib/queries";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import BoardClient from "@/components/board/BoardClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const user = await requireCapability("board_view", "Board");
  const cards = (await loadAllCampaignCards()).filter((c) => c.view === "board");

  return (
    <div>
      <PageHeader
        title="Campaign pipeline"
        subtitle="Five-stage board — In Pipeline → Hub Pending → Depots Pending → Content Pending → Live. The board is read-only: open a campaign card to take actions in its detail panel."
        actions={
          can(user.role, "brief_create") ? (
            <Link href="/board/new" className="btn-primary">
              + New brief
            </Link>
          ) : null
        }
      />
      <BoardClient cards={cards} />
    </div>
  );
}
