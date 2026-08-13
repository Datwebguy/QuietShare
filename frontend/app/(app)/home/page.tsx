import { AppHomeContent } from "@/components/AppHomeContent";

// See app/page.tsx for why this is a server-context file with no "use client":
// force-dynamic route segment config is only reliably honored from a server
// page.tsx, not from a page that itself starts with "use client".
export const dynamic = "force-dynamic";

export default function Page() {
  return <AppHomeContent />;
}
