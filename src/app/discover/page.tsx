"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DoorwayHeader } from "@/components/layout/doorway-header";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { SyncStatusBadge } from "@/components/layout/sync-status-badge";
import { DiscoverFilters } from "@/components/discover/discover-filters";
import { SwipeDeck } from "@/components/discover/swipe-deck";
import { TutorialOverlay } from "@/components/discover/tutorial-overlay";
import { ShowingConfirmation } from "@/components/matches/showing-confirmation";
import { SEEKER_DECK_SIZE } from "@/lib/mock-data";
import { useDoorwayStore } from "@/lib/store";

export default function DiscoverPage() {
  const router = useRouter();
  const onboardingComplete = useDoorwayStore((s) => s.onboardingComplete);
  const constraints = useDoorwayStore((s) => s.constraints);
  const completeOnboarding = useDoorwayStore((s) => s.completeOnboarding);
  const refreshDeck = useDoorwayStore((s) => s.refreshDeck);
  const deck = useDoorwayStore((s) => s.deck);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!onboardingComplete && !constraints) {
      router.replace("/onboarding");
      return;
    }
    if (!onboardingComplete && constraints) completeOnboarding();
    refreshDeck();
  }, [onboardingComplete, constraints, router, completeOnboarding, refreshDeck]);

  const zip = constraints?.zipCode ?? "90011";

  return (
    <AppShell>
      <DoorwayHeader subtitle={`Section 8 near ${zip}`} />
      <SyncStatusBadge />
      <RoleSwitcher compact />

      <div className="flex flex-1 flex-col px-5 pb-2">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {deck.length} of {SEEKER_DECK_SIZE} homes
          </p>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
          >
            {filtersOpen ? "Hide filters" : "Filters"}
          </button>
        </div>

        {filtersOpen && <DiscoverFilters />}

        <div className="flex flex-1 flex-col rounded-[1.75rem] bg-surface p-1">
          <SwipeDeck />
        </div>
      </div>

      <TutorialOverlay />
      <ShowingConfirmation />
    </AppShell>
  );
}
