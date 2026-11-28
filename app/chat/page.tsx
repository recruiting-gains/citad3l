import ChatWorkspace from "@/components/chat/ChatWorkspace";
import { currentUser, labelFor } from "@/lib/session";
import { providerInfo } from "@/lib/inference";
import { DEFAULT_MODEL_ID, pickerModels } from "@/lib/models";
import { GUEST_MODEL_ID } from "@/lib/config";
import { getUsage } from "@/lib/usage";
import { prisma } from "@/lib/db";
import { guestUsageSummary } from "@/lib/guest";
import { isAdminEmail } from "@/lib/config";
import { billingOpenFor } from "@/lib/stripe";
import { HERMES_MODEL, isHermesEmail } from "@/lib/hermes";
import { hermesBrainOptions } from "@/lib/hermes-brains";
export const dynamic = "force-dynamic";
export const metadata = { title: "Chat · Citad3L" };
export default async function Page({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = await currentUser();
  const { project } = await searchParams;
  const p = u && project ? await prisma.project.findFirst({ where: { id: project, userId: u.id }, select: { id: true } }) : null;
  const usage = u ? await getUsage(u.id) : guestUsageSummary(0);
  // Everyone sees the full lineup. Guests and free accounts can only *use* V1 Fast; the server enforces that.
  const hermes = !!u && isHermesEmail(u.email);
  const models = [...pickerModels(!!u, !!u && isAdminEmail(u.email)), ...(hermes ? [HERMES_MODEL] : [])];
  return (
    <ChatWorkspace
      initialConversationId={null}
      initialProjectId={p?.id ?? null}
      userLabel={u ? labelFor(u) : ""}
      provider={providerInfo()}
      initialUsage={usage}
      models={models}
      defaultModelId={u ? DEFAULT_MODEL_ID : GUEST_MODEL_ID}
      signedIn={!!u}
      isOwner={!!u && isAdminEmail(u.email)}
      computerEnabled={!!u && isAdminEmail(u.email)}
      billingOpen={billingOpenFor(u?.email)}
      hermesEnabled={hermes} hermesBrains={hermes ? hermesBrainOptions() : []}
    />
  );
}
