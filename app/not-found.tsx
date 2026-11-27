import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
export default function NotFound() {
  return (
    <>
      <main className="state-page"><h1>Not found</h1><p>That page doesn&apos;t exist or isn&apos;t yours.</p><Link className="btn btn-primary" href="/chat">Go to chat</Link></main>
      <SiteFooter />
    </>
  );
}
