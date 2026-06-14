"use client";

import { useEffect, useState } from "react";
import { useDoorwayStore } from "@/lib/store";

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const finish = () => {
      const state = useDoorwayStore.getState();
      if (state.onboardingComplete && state.deck.length === 0) {
        state.refreshDeck();
      }
      setReady(true);
    };

    if (useDoorwayStore.persist.hasHydrated()) {
      finish();
      return;
    }

    return useDoorwayStore.persist.onFinishHydration(() => finish());
  }, []);

  if (!ready) {
    return (
      <div className="doorway-gradient flex min-h-dvh items-center justify-center px-8">
        <div className="text-center">
          <p className="font-serif text-2xl">Doorway</p>
          <p className="mt-2 text-sm text-muted-foreground">Loading your matches…</p>
        </div>
      </div>
    );
  }

  return children;
}
