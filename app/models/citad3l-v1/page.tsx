import ModelView from "@/components/model/ModelView";
import { currentUser } from "@/lib/session";
import { providerInfo } from "@/lib/inference";
export const dynamic = "force-dynamic";
export const metadata = { title: "Citad3L V1 · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  return <ModelView signedIn={!!u} provider={providerInfo()} />;
}
