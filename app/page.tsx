import HomeView from "@/components/marketing/HomeView";
import { currentUser } from "@/lib/session";
import { providerInfo } from "@/lib/inference";
export const dynamic = "force-dynamic";
export default async function Page() {
  const u = await currentUser();
  return <HomeView signedIn={!!u} provider={providerInfo()} />;
}
