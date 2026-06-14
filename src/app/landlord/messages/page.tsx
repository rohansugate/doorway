"use client";

import { Suspense } from "react";
import { LandlordShell } from "@/components/layout/landlord-shell";
import { DoorwayHeader } from "@/components/layout/doorway-header";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { MessagesPanel } from "@/components/messages/messages-panel";

export default function LandlordMessagesPage() {
  return (
    <LandlordShell>
      <DoorwayHeader subtitle="Messages" />
      <RoleSwitcher compact />
      <Suspense fallback={<p className="px-5 text-sm text-muted-foreground">Loading messages…</p>}>
        <MessagesPanel role="LANDLORD" />
      </Suspense>
    </LandlordShell>
  );
}
