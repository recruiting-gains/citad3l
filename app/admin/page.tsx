import { requireOwnerPage } from "@/lib/admin";
import AdminView from "@/components/admin/AdminView";
export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Citad3L", robots: { index: false, follow: false } };
export default async function Page() {
  await requireOwnerPage();
  return <AdminView />;
}
