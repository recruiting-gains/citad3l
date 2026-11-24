import { notFound, redirect } from "next/navigation";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import { currentUser, labelFor } from "@/lib/session";
import { providerInfo } from "@/lib/inference";
import { DEFAULT_MODEL_ID, pickerModels } from "@/lib/models";
import { getUsage } from "@/lib/usage";
import { isAdminEmail } from "@/lib/config";
import { prisma } from "@/lib/db";
import { HERMES_MODEL, HERMES_MODEL_ID, HERMES_TITLE_PREFIX, isHermesEmail } from "@/lib/hermes";
import { hermesBrainOptions } from "@/lib/hermes-brains";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  const { id } = await params;
  if (!u) redirect(`/login?next=/chat/${encodeURIComponent(id)}`);
  const c = await prisma.conversation.findFirst({ where: { id, userId: u.id }, select: { id: true, projectId: true, title: true } });
  if (!c) notFound();
  const hermes = isHermesEmail(u.email);
  const models = [...pickerModels(true, isAdminEmail(u.email)), ...(hermes ? [HERMES_MODEL] : [])];
  const defaultModelId = hermes && c.title.startsWith(HERMES_TITLE_PREFIX) ? HERMES_MODEL_ID : DEFAULT_MODEL_ID;
  return <ChatWorkspace initialConversationId={c.id} initialProjectId={c.projectId} userLabel={labelFor(u)} provider={providerInfo()} initialUsage={await getUsage(u.id)} models={models} defaultModelId={defaultModelId} signedIn isOwner={isAdminEmail(u.email)} computerEnabled={isAdminEmail(u.email)} hermesEnabled={hermes} hermesBrains={hermes ? hermesBrainOptions() : []} />;
}
