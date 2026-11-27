/**
 * Image and video generation.
 * Off unless MEDIA_GENERATION_ENABLED is exactly "true" (wrangler var or env).
 * Viewing images and videos already saved in a chat does not use this flag.
 */
export function mediaGenerationEnabled(): boolean {
  return process.env.MEDIA_GENERATION_ENABLED === "true";
}

export function isGeneratedMediaModality(modality: string | null | undefined): boolean {
  return modality === "image" || modality === "video";
}
