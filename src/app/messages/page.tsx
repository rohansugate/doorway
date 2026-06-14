"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DoorwayHeader } from "@/components/layout/doorway-header";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { MessagesPanel } from "@/components/messages/messages-panel";

export default function MessagesPage() {
  return (
    <AppShell>
      <DoorwayHeader subtitle="Messages" />
      <RoleSwitcher compact />
      <Suspense fallback={<p className="px-5 text-sm text-muted-foreground">Loading messages…</p>}>
        <MessagesPanel role="SEEKER" />
      </Suspense>
    </AppShell>
  );
}
