
const config = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
    ];
    const noindex = { key: "X-Robots-Tag", value: "noindex, nofollow" };
    return [
      { source: "/_next/static/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }, ...security] },
      { source: "/media/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }, ...security, noindex] },
      { source: "/api/:path*", headers: [noindex] },
      { source: "/admin", headers: [noindex] },
      { source: "/admin/:path*", headers: [noindex] },
      { source: "/chat", headers: [noindex] },
      { source: "/chat/:path*", headers: [noindex] },
      { source: "/account", headers: [noindex] },
      { source: "/account/:path*", headers: [noindex] },
      { source: "/projects", headers: [noindex] },
      { source: "/projects/:path*", headers: [noindex] },
      { source: "/login", headers: [noindex] },
      { source: "/login/:path*", headers: [noindex] },
      { source: "/(.*)", headers: security },
    ];
  },
};
export default config;
