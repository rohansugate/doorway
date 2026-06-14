"use client";

import { useDoorwayStore } from "@/lib/store";
import { pullDemoSync } from "@/lib/demo-sync";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

export function SyncStatusBadge() {
  const syncStatus = useDoorwayStore((s) => s.syncStatus);
  const setSyncStatus = useDoorwayStore((s) => s.setSyncStatus);

  const handleRefresh = async () => {
    setSyncStatus({
      storage: syncStatus?.storage ?? "memory",
      ready: syncStatus?.ready ?? false,
      lastPulledAt: syncStatus?.lastPulledAt ?? null,
      syncing: true,
    });
    const remote = await pullDemoSync();
    if (remote?.state?.updatedAt) {
      const localUpdated = useDoorwayStore.getState().lastSyncedAt ?? "";
      if (remote.state.updatedAt > localUpdated) {
        useDoorwayStore.getState().applyRemoteSync(remote.state);
      }
    }
    setSyncStatus({
      storage: remote?.storage ?? "memory",
      ready: remote?.ready ?? false,
      lastPulledAt: new Date().toISOString(),
      syncing: false,
    });
  };

  const isLive = syncStatus?.storage === "redis" && syncStatus.ready;
  const syncing = syncStatus?.syncing;

  return (
    <button
      type="button"
      onClick={handleRefresh}
      className="mx-5 mb-3 flex w-[calc(100%-2.5rem)] items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/20"
    >
      <span
        className={`size-2 shrink-0 rounded-full ${
          syncing
            ? "animate-pulse bg-sky-400"
            : isLive
              ? "bg-emerald-500"
              : "bg-amber-400"
        }`}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">
        {syncing
          ? "Syncing…"
          : isLive
            ? "Live — changes sync across devices"
            : "Demo mode — use same URL on both phones"}
        {syncStatus?.lastPulledAt && !syncing
          ? ` · ${timeAgo(syncStatus.lastPulledAt)}`
          : null}
      </span>
    </button>
  );
}
