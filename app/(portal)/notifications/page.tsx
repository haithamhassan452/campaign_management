// Notifications — PRD §08. Campaign-linked + global planner.

import { requireCapability } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { COPY_LIMITS, MESSAGE_TYPES } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/ui";
import NotificationsClient from "@/components/notifications/NotificationsClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireCapability("notifications_view", "Notifications");
  const { tab = "campaign" } = await searchParams;
  const global = tab === "global";

  const db = await getDb();
  const notifications = await db
    .selectFrom("notifications")
    .selectAll()
    .orderBy("planned_send_at", "desc")
    .execute();
  const campaigns = await db
    .selectFrom("campaigns")
    .select(["id", "campaign_id", "title", "stage", "status", "end_date"])
    .orderBy("campaign_id", "desc")
    .execute();

  const campaignById = new Map(campaigns.map((c) => [c.id, c]));
  const items = notifications
    .filter((n) => (global ? n.campaign_pk === null : n.campaign_pk !== null))
    .map((n) => ({
      ...n,
      campaign: n.campaign_pk ? campaignById.get(n.campaign_pk) ?? null : null,
    }));

  const activeCampaigns = campaigns.filter(
    (c) => c.status === "active" && c.stage !== "live",
  );

  return (
    <div>
      <PageHeader
        title="Notifications & in-app messages"
        subtitle="Campaign-linked notifications must be approved before go-live. Global notifications are planned on a weekly/monthly schedule independently of campaigns."
      />

      <div className="mb-6 flex gap-2">
        <a
          href="/notifications?tab=campaign"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${!global ? "bg-brand-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
        >
          Campaign-linked
        </a>
        <a
          href="/notifications?tab=global"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${global ? "bg-brand-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
        >
          Global planner
        </a>
      </div>

      {items.length === 0 ? (
        <div className="mb-6">
          <EmptyState>
            No notifications created yet — create the first one for an active campaign.
          </EmptyState>
        </div>
      ) : null}

      <NotificationsClient
        items={JSON.parse(JSON.stringify(items))}
        campaigns={JSON.parse(JSON.stringify(activeCampaigns))}
        canManage={can(user.role, "notifications_manage")}
        currentUsername={user.username}
        isGlobal={global}
        messageTypes={[...MESSAGE_TYPES]}
        copyLimits={COPY_LIMITS}
      />
    </div>
  );
}
