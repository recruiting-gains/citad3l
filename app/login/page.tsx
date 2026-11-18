import { redirect } from "next/navigation";
import LoginView from "@/components/auth/LoginView";
import { currentUser } from "@/lib/session";
import { providerList } from "@/auth";
import { demoLoginEnabled } from "@/lib/config";
export const dynamic = "force-dynamic";
export const metadata = { title: "Log in · Citad3L" };
function safeNext(n?: string) { return n && n.startsWith("/") && !n.startsWith("//") ? n : "/chat"; }
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentUser()) redirect(safeNext(next));
  return <LoginView demoEnabled={demoLoginEnabled()} providers={providerList} next={safeNext(next)} />;
}
