import { notFound, redirect } from "next/navigation";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import { currentUser, labelFor } from "@/lib/session";
import { providerInfo } from "@/lib/inference";
import { getUsage } from "@/lib/usage";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  const { id } = await params;
  if (!u) redirect(`/login?next=/chat/${encodeURIComponent(id)}`);
  const c = await prisma.conversation.findFirst({ where: { id, userId: u.id }, select: { id: true, projectId: true } });
  if (!c) notFound();
  return <ChatWorkspace initialConversationId={c.id} initialProjectId={c.projectId} userLabel={labelFor(u)} provider={providerInfo()} initialUsage={await getUsage(u.id)} />;
}
