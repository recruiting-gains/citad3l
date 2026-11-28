/** Public structured data for the home page (Organization + SoftwareApplication). Mirrors visible site copy; nothing hidden. */
import { mediaGenerationEnabled } from "./media";

export function siteJsonLd(origin = "https://citad3l.io") {
  const base = origin.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#org`,
        name: "Citad3L",
        url: `${base}/`,
        logo: `${base}/icon-512.png`,
        founder: { "@type": "Person", name: "Cruz Garza" },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${base}/#app`,
        name: "Citad3L",
        url: `${base}/`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: mediaGenerationEnabled()
          ? "A private, less-filtered AI chat app. Chat with Citad3L V1 Fast, and generate images with Citad3L Image. Sign in with a 6-digit email code; no passwords."
          : "A private, less-filtered AI chat app. Chat with Citad3L V1 Fast or Citad3L Private. Sign in with a 6-digit email code; no passwords.",
        publisher: { "@id": `${base}/#org` },
        offers: [
          { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD", url: `${base}/pricing` },
          { "@type": "Offer", name: "Pro", price: "20", priceCurrency: "USD", url: `${base}/pricing`, description: "Monthly subscription" },
          { "@type": "Offer", name: "Max", price: "50", priceCurrency: "USD", url: `${base}/pricing`, description: "Monthly subscription, 2.5x the Pro allowance" },
        ],
      },
    ],
  };
}
