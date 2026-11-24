import { LegalPage } from "@/components/legal/LegalPage";
import { TERMS } from "@/lib/legal";

export const metadata = { title: "Terms of Service · Citad3L", description: "The rules for using Citad3L: plans, billing, content, safety and liability." };
export default function Page() {
  return <LegalPage doc={TERMS} />;
}
