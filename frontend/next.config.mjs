/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Next.js gives fully static pages (/, /app) a 1-year s-maxage by default.
  // Fly's front door doesn't purge that across deploys, so a stale build can
  // keep getting served indefinitely regardless of how many times we
  // redeploy. `export const dynamic = "force-dynamic"` doesn't change this
  // for pure client components (Next still prerenders their static shell) —
  // overriding the response header directly is what actually controls what
  // gets cached in front of the app.
  async headers() {
    const cacheControl = [{ key: "Cache-Control", value: "no-store, must-revalidate" }];
    return [
      { source: "/", headers: cacheControl },
      { source: "/:path*", headers: cacheControl }
    ];
  }
};

export default nextConfig;
