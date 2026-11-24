import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY } from "@/lib/legal";

export const metadata = { title: "Privacy Policy · Citad3L", description: "What Citad3L stores, why, who processes it, and how to export or delete it." };
export default function Page() {
  return <LegalPage doc={PRIVACY} />;
}
