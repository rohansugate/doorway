import type {
  Application,
  ApplicationStatus,
  ChatMessage,
  Conversation,
  DemoSyncPayload,
  Listing,
  Notification,
  Showing,
} from "./types";

const STATUS_RANK: Record<ApplicationStatus, number> = {
  SENT: 0,
  VIEWED: 1,
  ACCEPTED: 2,
  DECLINED: 2,
  INTERVIEW_SCHEDULED: 3,
  LEASE_SIGNED: 4,
};

function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of a) map.set(item.id, item);
  for (const item of b) map.set(item.id, item);
  return Array.from(map.values());
}

function mergeApplications(a: Application[], b: Application[]): Application[] {
  const map = new Map<string, Application>();
  for (const app of [...a, ...b]) {
    const existing = map.get(app.id);
    if (!existing) {
      map.set(app.id, app);
      continue;
    }
    const keep =
      STATUS_RANK[app.status] >= STATUS_RANK[existing.status] ? app : existing;
    map.set(app.id, keep);
  }
  return Array.from(map.values());
}

function mergeListings(a: Listing[], b: Listing[]): Listing[] {
  const map = new Map<string, Listing>();
  for (const listing of a) map.set(listing.id, listing);
  for (const listing of b) {
    const existing = map.get(listing.id);
    if (!existing) {
      map.set(listing.id, listing);
      continue;
    }
    map.set(listing.id, {
      ...existing,
      ...listing,
      analytics: {
        views: Math.max(existing.analytics.views, listing.analytics.views),
        saves: Math.max(existing.analytics.saves, listing.analytics.saves),
        applications: Math.max(
          existing.analytics.applications,
          listing.analytics.applications,
        ),
      },
    });
  }
  return Array.from(map.values());
}

function mergeMessages(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  return mergeById(a, b).sort((x, y) => x.sentAt.localeCompare(y.sentAt));
}

/** Combine two sync snapshots — used on server write and client pull. */
export function mergeDemoPayload(
  base: DemoSyncPayload | null,
  incoming: DemoSyncPayload,
): DemoSyncPayload {
  if (!base) {
    return { ...incoming, updatedAt: new Date().toISOString() };
  }

  return {
    listings: mergeListings(base.listings, incoming.listings),
    applications: mergeApplications(base.applications, incoming.applications),
    showings: mergeById(base.showings, incoming.showings),
    conversations: mergeById(base.conversations, incoming.conversations),
    messages: mergeMessages(base.messages, incoming.messages),
    notifications: mergeById(base.notifications, incoming.notifications),
    updatedAt: new Date().toISOString(),
  };
}

export function localStateToSyncPayload(state: {
  listings: Listing[];
  applications: Application[];
  showings: Showing[];
  conversations: Conversation[];
  messages: ChatMessage[];
  notifications: Notification[];
}): DemoSyncPayload {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
  };
}
