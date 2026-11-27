import { notFound } from "next/navigation";
import ModelView from "@/components/model/ModelView";
import { currentUser } from "@/lib/session";
import { providerInfo } from "@/lib/inference";
import { getPublicModel, marketingModels } from "@/lib/models";
import { isGeneratedMediaModality, mediaGenerationEnabled } from "@/lib/media";
import { isAdminEmail } from "@/lib/config";
import { referralProgramVisible } from "@/lib/referrals";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = getPublicModel(id);
  if (!model || (isGeneratedMediaModality(model.modality) && !mediaGenerationEnabled())) return { title: "Model · Citad3L" };
  return { title: `${model.name} · Citad3L` };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = getPublicModel(id);
  if (!model || (isGeneratedMediaModality(model.modality) && !mediaGenerationEnabled())) notFound();
  const u = await currentUser();
  return <ModelView signedIn={!!u} provider={providerInfo()} model={model} isAdmin={!!u && isAdminEmail(u.email)} showReferral={referralProgramVisible()} models={marketingModels()} />;
}
