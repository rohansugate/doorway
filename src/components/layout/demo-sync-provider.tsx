"use client";

import { useCallback, useEffect, useRef } from "react";
import { buildSyncPayload, pullDemoSync, pushDemoSync } from "@/lib/demo-sync";
import { useDoorwayStore } from "@/lib/store";

const POLL_MS = 1000;

export function DemoSyncProvider({ children }: { children: React.ReactNode }) {
  const pushing = useRef(false);
  const setSyncStatus = useDoorwayStore((s) => s.setSyncStatus);

  const pull = useCallback(async () => {
    const remote = await pullDemoSync();
    if (!remote) {
      setSyncStatus({
        storage: "memory",
        ready: false,
        lastPulledAt: new Date().toISOString(),
        syncing: false,
      });
      return;
    }

    setSyncStatus({
      storage: remote.storage,
      ready: remote.ready,
      lastPulledAt: new Date().toISOString(),
      syncing: false,
    });

    if (!remote.state?.updatedAt) return;

    const localUpdated = useDoorwayStore.getState().lastSyncedAt ?? "";
    if (remote.state.updatedAt > localUpdated) {
      useDoorwayStore.getState().applyRemoteSync(remote.state);
    }
  }, [setSyncStatus]);

  useEffect(() => {
    let cancelled = false;

    const runPull = async () => {
      if (cancelled) return;
      setSyncStatus({
        storage: useDoorwayStore.getState().syncStatus?.storage ?? "memory",
        ready: useDoorwayStore.getState().syncStatus?.ready ?? false,
        lastPulledAt: useDoorwayStore.getState().syncStatus?.lastPulledAt ?? null,
        syncing: true,
      });
      await pull();
    };

    runPull();
    const interval = setInterval(runPull, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pull, setSyncStatus]);

  useEffect(() => {
    const unsub = useDoorwayStore.subscribe((state, prev) => {
      if (pushing.current) return;

      const changed =
        state.listings !== prev.listings ||
        state.applications !== prev.applications ||
        state.showings !== prev.showings ||
        state.conversations !== prev.conversations ||
        state.messages !== prev.messages ||
        state.notifications !== prev.notifications;

      if (!changed) return;

      pushing.current = true;
      setSyncStatus({
        storage: state.syncStatus?.storage ?? "memory",
        ready: state.syncStatus?.ready ?? false,
        lastPulledAt: state.syncStatus?.lastPulledAt ?? null,
        syncing: true,
      });

      const payload = buildSyncPayload({
        listings: state.listings,
        applications: state.applications,
        showings: state.showings,
        conversations: state.conversations,
        messages: state.messages,
        notifications: state.notifications,
      });

      pushDemoSync(payload)
        .finally(async () => {
          useDoorwayStore.setState({ lastSyncedAt: payload.updatedAt });
          pushing.current = false;
          await pull();
        });
    });

    return unsub;
  }, [pull, setSyncStatus]);

  return children;
}
