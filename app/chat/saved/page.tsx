import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import SavedGuestChat from "@/components/chat/SavedGuestChat";
export const dynamic = "force-dynamic";
export const metadata = { title: "Saving your chat · Citad3L" };
export default async function Page() {
  if (!(await currentUser())) redirect("/login?mode=save&next=/chat/saved");
  return <SavedGuestChat />;
}
