import ModelsIndexView from "@/components/model/ModelsIndexView";
import { currentUser } from "@/lib/session";
import { providerInfo } from "@/lib/inference";
import { visibleModels } from "@/lib/models";
import { isAdminEmail } from "@/lib/config";
export const dynamic = "force-dynamic";
export const metadata = { title: "Models · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  return <ModelsIndexView signedIn={!!u} provider={providerInfo()} models={visibleModels()} isAdmin={!!u && isAdminEmail(u.email)} />;
}
