import { LandingContent } from "@/components/LandingContent";

// This file has no "use client" directive on purpose: `force-dynamic` route
// segment config is only reliably honored by Next.js from a server-context
// page.tsx. A page that itself starts with "use client" still gets
// statically prerendered regardless of this export, which is what caused
// Fly to keep serving a stale build across deploys (its front door doesn't
// purge Next's 1-year static cache-control on redeploy). All the actual
// interactive content lives in LandingContent, a real client component.
export const dynamic = "force-dynamic";

export default function Page() {
  return <LandingContent />;
}
