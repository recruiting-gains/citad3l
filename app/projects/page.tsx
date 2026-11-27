import { redirect } from "next/navigation";
import ProjectsView from "@/components/projects/ProjectsView";
import { currentUser } from "@/lib/session";
import { listProjects } from "@/lib/projects";
import { SiteFooter } from "@/components/SiteFooter";
export const dynamic = "force-dynamic";
export const metadata = { title: "Projects · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  if (!u) redirect("/login?next=/projects");
  return (
    <>
      <ProjectsView initialProjects={await listProjects(u.id)} />
      <SiteFooter />
    </>
  );
}
