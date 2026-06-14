import type { DemoSyncPayload } from "./types";

const SYNC_PATH = "/api/demo/sync";

export type SyncStorage = "redis" | "memory";

export interface SyncStatus {
  storage: SyncStorage;
  ready: boolean;
  lastPulledAt: string | null;
  syncing?: boolean;
}

export function buildSyncPayload(state: {
  listings: DemoSyncPayload["listings"];
  applications: DemoSyncPayload["applications"];
  showings: DemoSyncPayload["showings"];
  conversations: DemoSyncPayload["conversations"];
  messages: DemoSyncPayload["messages"];
  notifications: DemoSyncPayload["notifications"];
}): DemoSyncPayload {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
  };
}

export async function pullDemoSync(): Promise<{
  state: DemoSyncPayload | null;
  storage: SyncStorage;
  ready: boolean;
} | null> {
  try {
    const res = await fetch(SYNC_PATH, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      state: data.state ?? null,
      storage: data.storage ?? "memory",
      ready: Boolean(data.ready),
    };
  } catch {
    return null;
  }
}

export async function pushDemoSync(payload: DemoSyncPayload): Promise<boolean> {
  try {
    const res = await fetch(SYNC_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: payload }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
