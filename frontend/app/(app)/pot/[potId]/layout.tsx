"use client";

import { useParams } from "next/navigation";
import { PotProvider } from "@/components/PotProvider";
import { PotChrome } from "@/components/PotChrome";

export default function PotLayout({ children }: { children: React.ReactNode }) {
  const { potId } = useParams<{ potId: string }>();

  return (
    <PotProvider potId={potId}>
      <PotChrome>{children}</PotChrome>
    </PotProvider>
  );
}
