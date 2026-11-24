import ChatWorkspace from "@/components/chat/ChatWorkspace";
import { currentUser, labelFor } from "@/lib/session";
import { providerInfo } from "@/lib/inference";
import { DEFAULT_MODEL_ID, isGuestModelId, pickerModels } from "@/lib/models";
import { GUEST_MODEL_ID } from "@/lib/config";
import { getUsage } from "@/lib/usage";
import { prisma } from "@/lib/db";
import { guestUsageSummary } from "@/lib/guest";
import { isAdminEmail } from "@/lib/config";
import { HERMES_MODEL, isHermesEmail } from "@/lib/hermes";
import { hermesBrainOptions } from "@/lib/hermes-brains";
export const dynamic = "force-dynamic";
export const metadata = { title: "Chat · Citad3L" };
export default async function Page({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = await currentUser();
  const { project } = await searchParams;
  const p = u && project ? await prisma.project.findFirst({ where: { id: project, userId: u.id }, select: { id: true } }) : null;
  const usage = u ? await getUsage(u.id) : guestUsageSummary(0);
  // Guests get Fast only; signed-in accounts see the whole lineup (the server enforces plans: Image Pro/Max, Video Max).
  const hermes = !!u && isHermesEmail(u.email);
  const all = [...pickerModels(!!u, !!u && isAdminEmail(u.email)), ...(hermes ? [HERMES_MODEL] : [])];
  // Guests: Fast only (the server enforces this too).
  const models = u ? all : all.filter((m) => isGuestModelId(m.id));
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
      hermesEnabled={hermes} hermesBrains={hermes ? hermesBrainOptions() : []}
    />
  );
}
