import { redirect } from "next/navigation";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import { currentUser, labelFor } from "@/lib/session";
import { providerInfo } from "@/lib/inference";
import { getUsage } from "@/lib/usage";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export const metadata = { title: "Chat · Citad3L" };
export default async function Page({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const u = await currentUser();
  if (!u) redirect("/login?next=/chat");
  const { project } = await searchParams;
  const p = project ? await prisma.project.findFirst({ where: { id: project, userId: u.id }, select: { id: true } }) : null;
  return <ChatWorkspace initialConversationId={null} initialProjectId={p?.id ?? null} userLabel={labelFor(u)} provider={providerInfo()} initialUsage={await getUsage(u.id)} />;
}
