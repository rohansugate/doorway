"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  A11ySettings,
  Application,
  ApplicationPacket,
  ApplicationStatus,
  ChatMessage,
  ContactMethod,
  Conversation,
  DemoSyncPayload,
  DiscoverFilters,
  Listing,
  ListingInput,
  ListingStatus,
  Locale,
  Match,
  Notification,
  SeekerConstraints,
  Showing,
  SwipeAction,
  TenantSession,
  User,
  UserRole,
  LandlordSession,
} from "./types";
import {
  DEFAULT_IMAGE,
  filterListingsForSeeker,
  mockLandlord,
  mockListings,
  mockSeeker,
  SEEKER_DECK_SIZE,
  zipToCoords,
} from "./mock-data";
import { SEED_APPLICATIONS, SEED_SHOWINGS } from "./seed-data";
import type { SyncStatus } from "./demo-sync";
import { localStateToSyncPayload, mergeDemoPayload, isBlockedListingTitle, sanitizeDemoPayload } from "./sync-merge";
import { sortByRelevance } from "./sort-listings";
import {
  displayName,
  resolveActingLandlordId,
  resolveLandlord,
  resolveLandlordForListing,
  resolveSeeker,
} from "./current-user";
import {
  markConversationNotificationsRead,
  markLandlordApplicationNotificationsRead,
} from "./unread-counts";

interface DoorwayState {
  currentUser: User | null;
  role: UserRole | null;
  locale: Locale;
  darkMode: boolean;
  tutorialSeen: boolean;
  a11y: A11ySettings;
  discoverFilters: DiscoverFilters;
  onboardingComplete: boolean;
  constraints: SeekerConstraints | null;
  listings: Listing[];
  deck: Listing[];
  likedListings: Listing[];
  matches: Match[];
  swipeHistory: SwipeAction[];
  applications: Application[];
  showings: Showing[];
  conversations: Conversation[];
  messages: ChatMessage[];
  notifications: Notification[];
  lastConfirmedShowing: Showing | null;
  lastSyncedAt: string | null;
  lastLocalRevision: number;
  syncStatus: SyncStatus | null;
  tenantSessions: Record<string, TenantSession>;
  landlordSessions: Record<string, LandlordSession>;
  seenLandlordApplicationIds: string[];
  seenLandlordShowingIds: string[];
  seenSeekerApplicationIds: string[];
  seenSeekerShowingIds: string[];
  setSyncStatus: (status: SyncStatus) => void;
  loginUser: (user: User) => void;
  logoutUser: () => void;
  setRole: (role: UserRole) => void;
  setLocale: (locale: Locale) => void;
  setDarkMode: (dark: boolean) => void;
  dismissTutorial: () => void;
  setDiscoverFilters: (filters: Partial<DiscoverFilters>) => void;
  setA11y: (a11y: Partial<A11ySettings>) => void;
  setConstraints: (constraints: SeekerConstraints) => void;
  completeOnboarding: () => void;
  refreshDeck: () => void;
  swipe: (listingId: string, direction: "left" | "right") => void;
  undoSwipe: () => void;
  canApply: (listingId: string) => boolean;
  getShowingForListing: (listingId: string) => Showing | undefined;
  submitApplication: (listingId: string, packet: ApplicationPacket) => boolean;
  scheduleShowing: (
    listingId: string,
    date: string,
    time: string,
    contactMethod: ContactMethod,
    contactValue: string,
  ) => void;
  acceptShowing: (id: string, message?: string) => void;
  declineShowing: (id: string, message?: string) => void;
  clearConfirmedShowing: () => void;
  updateApplicationStatus: (id: string, status: ApplicationStatus) => void;
  sendMessage: (conversationId: string, text: string, role: "SEEKER" | "LANDLORD") => void;
  markConversationRead: (conversationId: string, role: "SEEKER" | "LANDLORD") => void;
  markLandlordApplicationsSeen: () => void;
  markSeekerApplicationUpdatesSeen: () => void;
  ensureMessagingReady: () => void;
  applyRemoteSync: (payload: DemoSyncPayload) => void;
  markNotificationRead: (id: string) => void;
  saveListing: (input: ListingInput, status: "DRAFT" | "ACTIVE") => Listing | null;
  updateListing: (id: string, input: ListingInput) => boolean;
  publishListing: (id: string) => void;
  deactivateListing: (listingId: string) => void;
  removeListing: (listingId: string) => void;
  reset: () => void;
}

const defaultConstraints = mockSeeker.constraints ?? {
  housingSituation: "SHELTER" as const,
  voucherStatus: "HAS_VOUCHER" as const,
  zipCode: "19104",
  voucherSize: 2,
  maxRent: 1600,
  accessibilityNeeds: false,
  proximityNeeds: [],
};

const defaultDiscoverFilters: DiscoverFilters = {
  maxRent: 1600,
  groundFloorOnly: false,
  neighborhood: "",
};

function snapshotTenantSession(state: {
  onboardingComplete: boolean;
  constraints: SeekerConstraints | null;
  likedListings: Listing[];
  matches: Match[];
  swipeHistory: SwipeAction[];
  tutorialSeen: boolean;
  discoverFilters: DiscoverFilters;
}): TenantSession {
  return {
    onboardingComplete: state.onboardingComplete,
    constraints: state.constraints,
    likedListings: state.likedListings,
    matches: state.matches,
    swipeHistory: state.swipeHistory,
    tutorialSeen: state.tutorialSeen,
    discoverFilters: state.discoverFilters,
  };
}

function freshTenantState(): Pick<
  DoorwayState,
  | "onboardingComplete"
  | "constraints"
  | "likedListings"
  | "matches"
  | "swipeHistory"
  | "deck"
  | "tutorialSeen"
  | "discoverFilters"
> {
  return {
    onboardingComplete: false,
    constraints: null,
    likedListings: [],
    matches: [],
    swipeHistory: [],
    deck: [],
    tutorialSeen: false,
    discoverFilters: { ...defaultDiscoverFilters },
  };
}

function snapshotLandlordSession(state: {
  seenLandlordApplicationIds: string[];
  seenLandlordShowingIds: string[];
}): LandlordSession {
  return {
    seenApplicationIds: state.seenLandlordApplicationIds,
    seenShowingIds: state.seenLandlordShowingIds,
  };
}

function freshLandlordSeenState(): Pick<
  DoorwayState,
  "seenLandlordApplicationIds" | "seenLandlordShowingIds"
> {
  return {
    seenLandlordApplicationIds: [],
    seenLandlordShowingIds: [],
  };
}

function applyTenantSession(
  session: TenantSession,
  listings: Listing[],
): Pick<
  DoorwayState,
  | "onboardingComplete"
  | "constraints"
  | "likedListings"
  | "matches"
  | "swipeHistory"
  | "deck"
  | "tutorialSeen"
  | "discoverFilters"
> {
  const discoverFilters = session.discoverFilters ?? defaultDiscoverFilters;
  const constraints = session.constraints;
  return {
    onboardingComplete: session.onboardingComplete,
    constraints: session.constraints,
    likedListings: session.likedListings,
    matches: session.matches,
    swipeHistory: session.swipeHistory,
    tutorialSeen: session.tutorialSeen,
    discoverFilters,
    deck: session.onboardingComplete
      ? buildDeck(
          listings,
          constraints ?? defaultConstraints,
          session.likedListings,
          session.matches,
          discoverFilters,
        )
      : [],
  };
}

function buildDeck(
  listings: Listing[],
  constraints: SeekerConstraints | null,
  likedListings: Listing[],
  matches: Match[],
  filters: DiscoverFilters,
) {
  const passedIds = new Set(
    matches.filter((m) => m.status === "PASSED").map((m) => m.listingId),
  );
  const likedIds = new Set(likedListings.map((l) => l.id));
  const activeConstraints = constraints ?? defaultConstraints;
  let filtered = filterListingsForSeeker(listings, activeConstraints).filter(
    (l) => !passedIds.has(l.id) && !likedIds.has(l.id),
  );
  if (filters.maxRent < activeConstraints.maxRent) {
    filtered = filtered.filter((l) => l.monthlyRent <= filters.maxRent);
  }
  if (filters.groundFloorOnly) {
    filtered = filtered.filter((l) => l.isGroundFloor);
  }
  if (filters.neighborhood) {
    filtered = filtered.filter((l) => l.neighborhood === filters.neighborhood);
  }
  return sortByRelevance(filtered, activeConstraints, likedListings).slice(
    0,
    SEEKER_DECK_SIZE,
  );
}

function applyListingsUpdate(
  get: () => DoorwayState,
  set: (partial: Partial<DoorwayState>) => void,
  updatedListings: Listing[],
) {
  const { constraints, likedListings, matches, discoverFilters } = get();
  set({
    listings: updatedListings,
    deck: buildDeck(
      updatedListings,
      constraints ?? defaultConstraints,
      likedListings,
      matches,
      discoverFilters,
    ),
  });
}

function inputToListing(
  input: ListingInput,
  status: ListingStatus,
  landlordId: string,
  id?: string,
  existing?: Listing,
): Listing {
  const coords = zipToCoords(input.zipCode);
  const images =
    input.images.length > 0
      ? input.images.slice(0, 5)
      : [DEFAULT_IMAGE];
  return {
    id: id ?? `listing-${Date.now()}`,
    landlordId,
    title: input.title.trim(),
    monthlyRent: input.monthlyRent,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    zipCode: input.zipCode,
    neighborhood: input.neighborhood,
    transitLines: input.transitLines,
    isGroundFloor: input.isGroundFloor,
    isSection8Approved: input.isSection8Approved,
    landlordVerified: existing?.landlordVerified ?? false,
    images,
    latitude: coords.latitude,
    longitude: coords.longitude,
    source: "MANUAL",
    status,
    analytics: existing?.analytics ?? { views: 0, saves: 0, applications: 0 },
    updatedAt: new Date().toISOString(),
  };
}

function pushNotification(
  notifications: Notification[],
  title: string,
  message: string,
  options: {
    conversationId?: string;
    seekerId?: string;
    landlordId?: string;
    fromName?: string;
  },
): Notification[] {
  const n: Notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    message,
    channels: ["in_app", "email", "sms"],
    read: false,
    createdAt: new Date().toISOString(),
    conversationId: options.conversationId,
    seekerId: options.seekerId,
    landlordId: options.landlordId,
    fromName: options.fromName,
  };
  return [n, ...notifications];
}

function buildWelcomeMessage(
  conversationId: string,
  landlord: { id: string; name: string },
  seekerFirstName: string,
  listingTitle: string,
  kind: "showing" | "application",
): ChatMessage {
  const text =
    kind === "showing"
      ? `Hi ${seekerFirstName}, your showing for ${listingTitle} is confirmed. Message me here if you need directions or have questions.`
      : `Hi ${seekerFirstName}, your application for ${listingTitle} was accepted. Feel free to message me here if you have questions.`;

  return {
    id: `msg-welcome-${conversationId}`,
    conversationId,
    senderId: landlord.id,
    senderRole: "LANDLORD",
    text,
    sentAt: new Date().toISOString(),
  };
}

function upsertConversation(
  conversations: Conversation[],
  conversation: Conversation,
): Conversation[] {
  const index = conversations.findIndex((c) => c.id === conversation.id);
  if (index === -1) return [...conversations, conversation];
  const next = [...conversations];
  next[index] = { ...next[index], ...conversation };
  return next;
}

function openConversationForShowing(
  showing: Showing,
  listing: Listing | undefined,
  conversations: Conversation[],
  currentUser: User | null,
): { conversations: Conversation[]; conversation: Conversation } {
  const existing = conversations.find(
    (c) => c.showingId === showing.id || c.id === `convo-showing-${showing.id}`,
  );
  const landlord = resolveLandlordForListing(listing, currentUser);

  if (existing) {
    const repaired = {
      ...existing,
      seekerId: showing.seekerId,
      seekerName: showing.seekerName,
      landlordId: listing?.landlordId ?? landlord.id,
      landlordName: landlord.name,
      listingTitle: listing?.title ?? existing.listingTitle,
      showingId: showing.id,
    };
    return {
      conversations: upsertConversation(conversations, repaired),
      conversation: repaired,
    };
  }

  const conversation: Conversation = {
    id: `convo-showing-${showing.id}`,
    showingId: showing.id,
    listingId: showing.listingId,
    listingTitle: listing?.title ?? "Listing",
    seekerId: showing.seekerId,
    seekerName: showing.seekerName,
    landlordId: listing?.landlordId ?? landlord.id,
    landlordName: landlord.name,
    createdAt: new Date().toISOString(),
  };
  return { conversations: [...conversations, conversation], conversation };
}

function openConversationForApplication(
  app: Application,
  listing: Listing | undefined,
  conversations: Conversation[],
  currentUser: User | null,
): { conversations: Conversation[]; conversation: Conversation } {
  const existingByApp = conversations.find((c) => c.applicationId === app.id);
  if (existingByApp) {
    const landlord = resolveLandlordForListing(listing, currentUser);
    const repaired = {
      ...existingByApp,
      seekerId: app.seekerId,
      seekerName: app.seekerName,
      landlordId: listing?.landlordId ?? landlord.id,
      landlordName: landlord.name,
      listingTitle: listing?.title ?? existingByApp.listingTitle,
      applicationId: app.id,
      showingId: app.showingId,
    };
    return {
      conversations: upsertConversation(conversations, repaired),
      conversation: repaired,
    };
  }

  const linkedShowing = conversations.find((c) => c.showingId === app.showingId);
  if (linkedShowing) {
    const landlord = resolveLandlordForListing(listing, currentUser);
    const conversation: Conversation = {
      ...linkedShowing,
      applicationId: app.id,
      seekerId: app.seekerId,
      seekerName: app.seekerName,
      landlordId: listing?.landlordId ?? landlord.id,
      landlordName: landlord.name,
      listingTitle: listing?.title ?? linkedShowing.listingTitle,
    };
    return {
      conversations: upsertConversation(conversations, conversation),
      conversation,
    };
  }

  const landlord = resolveLandlordForListing(listing, currentUser);
  const conversation: Conversation = {
    id: `convo-${app.id}`,
    applicationId: app.id,
    showingId: app.showingId,
    listingId: app.listingId,
    listingTitle: listing?.title ?? "Listing",
    seekerId: app.seekerId,
    seekerName: app.seekerName,
    landlordId: listing?.landlordId ?? landlord.id,
    landlordName: landlord.name,
    createdAt: new Date().toISOString(),
  };
  return { conversations: [...conversations, conversation], conversation };
}

export const useDoorwayStore = create<DoorwayState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      role: null,
      locale: "en",
      darkMode: false,
      tutorialSeen: false,
      a11y: { largeText: false, highContrast: false, reduceMotion: false },
      discoverFilters: { maxRent: 1600, groundFloorOnly: false, neighborhood: "" },
      onboardingComplete: false,
      constraints: null,
      listings: mockListings,
      deck: [],
      likedListings: [],
      matches: [],
      swipeHistory: [],
      applications: SEED_APPLICATIONS,
      showings: SEED_SHOWINGS,
      conversations: [],
      messages: [],
      notifications: [],
      lastConfirmedShowing: null,
      lastSyncedAt: null,
      lastLocalRevision: 0,
      syncStatus: null,
      tenantSessions: {},
      landlordSessions: {},
      seenLandlordApplicationIds: [],
      seenLandlordShowingIds: [],
      seenSeekerApplicationIds: [],
      seenSeekerShowingIds: [],

      loginUser: (user) => {
        const state = get();
        const tenantSessions = { ...state.tenantSessions };
        const landlordSessions = { ...state.landlordSessions };

        if (state.currentUser?.role === "SEEKER") {
          tenantSessions[state.currentUser.id] = snapshotTenantSession(state);
        }
        if (state.currentUser?.role === "LANDLORD") {
          landlordSessions[state.currentUser.id] = snapshotLandlordSession(state);
        }

        const base = {
          currentUser: user,
          role: (user.role === "LANDLORD" ? "LANDLORD" : "SEEKER") as UserRole,
          tenantSessions,
          landlordSessions,
        };

        if (user.role === "SEEKER") {
          const saved = tenantSessions[user.id];
          set({
            ...base,
            ...(saved
              ? applyTenantSession(saved, state.listings)
              : freshTenantState()),
          });
          return;
        }

        const savedLandlord = landlordSessions[user.id];
        set({
          ...base,
          ...(savedLandlord
            ? {
                seenLandlordApplicationIds: savedLandlord.seenApplicationIds,
                seenLandlordShowingIds: savedLandlord.seenShowingIds,
              }
            : freshLandlordSeenState()),
        });
      },
      logoutUser: () => {
        const state = get();
        const tenantSessions = { ...state.tenantSessions };
        const landlordSessions = { ...state.landlordSessions };

        if (state.currentUser?.role === "SEEKER") {
          tenantSessions[state.currentUser.id] = snapshotTenantSession(state);
        }
        if (state.currentUser?.role === "LANDLORD") {
          landlordSessions[state.currentUser.id] = snapshotLandlordSession(state);
        }

        set({
          currentUser: null,
          role: null,
          tenantSessions,
          landlordSessions,
          ...freshTenantState(),
          ...freshLandlordSeenState(),
        });
      },
      setRole: (role) => set({ role }),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setLocale: (locale) => set({ locale }),
      setDarkMode: (darkMode) => set({ darkMode }),
      dismissTutorial: () => set({ tutorialSeen: true }),
      setDiscoverFilters: (filters) => {
        const discoverFilters = { ...get().discoverFilters, ...filters };
        const { listings, constraints, likedListings, matches } = get();
        set({
          discoverFilters,
          deck: buildDeck(
            listings,
            constraints ?? defaultConstraints,
            likedListings,
            matches,
            discoverFilters,
          ),
        });
      },

      setA11y: (a11y) => set({ a11y: { ...get().a11y, ...a11y } }),

      setConstraints: (constraints) => {
        const { listings, likedListings, matches, discoverFilters } = get();
        set({
          constraints,
          deck: buildDeck(listings, constraints, likedListings, matches, discoverFilters),
        });
      },

      completeOnboarding: () => {
        const { constraints, listings, likedListings, matches, discoverFilters } = get();
        const activeConstraints = constraints ?? defaultConstraints;
        const filters: DiscoverFilters = {
          maxRent: activeConstraints.maxRent,
          groundFloorOnly: activeConstraints.accessibilityNeeds,
          neighborhood: discoverFilters.neighborhood,
        };
        set({
          onboardingComplete: true,
          constraints: activeConstraints,
          discoverFilters: filters,
          deck: buildDeck(listings, activeConstraints, likedListings, matches, filters),
        });

        const user = get().currentUser;
        if (user?.role === "SEEKER") {
          set({
            tenantSessions: {
              ...get().tenantSessions,
              [user.id]: snapshotTenantSession(get()),
            },
          });
        }
      },

      refreshDeck: () => {
        const { listings, constraints, likedListings, matches, discoverFilters } = get();
        const activeConstraints = constraints ?? defaultConstraints;
        let deck = buildDeck(
          listings,
          activeConstraints,
          likedListings,
          matches,
          discoverFilters,
        );

        // Demo-friendly: recycle passed listings when deck runs dry
        if (deck.length === 0) {
          const recycledMatches = matches.filter((m) => m.status !== "PASSED");
          deck = buildDeck(
            listings,
            activeConstraints,
            likedListings,
            recycledMatches,
            discoverFilters,
          );
          if (deck.length > 0) {
            set({ matches: recycledMatches, swipeHistory: [], deck });
            return;
          }
        }

        set({ deck });
      },

      swipe: (listingId, direction) => {
        const { deck, likedListings, matches, listings, swipeHistory, currentUser } = get();
        const listing = deck.find((l) => l.id === listingId);
        if (!listing) return;

        const seeker = resolveSeeker(currentUser);
        const matchId = `match-${Date.now()}`;
        const newMatch: Match = {
          id: matchId,
          seekerId: seeker.id,
          listingId,
          status: direction === "right" ? "LIKED" : "PASSED",
          actorId: seeker.id,
          createdAt: new Date().toISOString(),
        };

        const updatedListings = listings.map((l) =>
          l.id === listingId
            ? {
                ...l,
                analytics: {
                  ...l.analytics,
                  views: l.analytics.views + 1,
                  saves:
                    direction === "right"
                      ? l.analytics.saves + 1
                      : l.analytics.saves,
                },
              }
            : l,
        );

        set({
          listings: updatedListings,
          deck: deck.filter((l) => l.id !== listingId),
          likedListings:
            direction === "right"
              ? [...likedListings, listing]
              : likedListings,
          matches: [...matches, newMatch],
          swipeHistory: [
            ...swipeHistory,
            { listing, direction, matchId },
          ].slice(-10),
        });
      },

      undoSwipe: () => {
        const history = get().swipeHistory;
        if (history.length === 0) return;
        const last = history[history.length - 1];
        const { deck, likedListings, matches, listings } = get();

        const updatedMatches = matches.filter((m) => m.id !== last.matchId);
        const updatedLiked =
          last.direction === "right"
            ? likedListings.filter((l) => l.id !== last.listing.id)
            : likedListings;

        const updatedListings = listings.map((l) =>
          l.id === last.listing.id
            ? {
                ...l,
                analytics: {
                  ...l.analytics,
                  saves: Math.max(0, l.analytics.saves - (last.direction === "right" ? 1 : 0)),
                },
              }
            : l,
        );

        const { constraints } = get();
        const newDeck = [last.listing, ...deck.filter((l) => l.id !== last.listing.id)];

        set({
          listings: updatedListings,
          matches: updatedMatches,
          likedListings: updatedLiked,
          deck: newDeck,
          swipeHistory: history.slice(0, -1),
        });
      },

      submitApplication: (listingId, packet) => {
        const { currentUser, showings } = get();
        const seeker = resolveSeeker(currentUser);
        const showing = showings
          .filter((s) => s.listingId === listingId && s.seekerId === seeker.id)
          .find((s) => s.status === "ACCEPTED");
        if (!showing) return false;

        const app: Application = {
          id: `app-${Date.now()}`,
          listingId,
          showingId: showing.id,
          seekerId: seeker.id,
          seekerName: `${seeker.firstName} ${seeker.lastName}`,
          packet,
          status: "SENT",
          sentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const listing = get().listings.find((l) => l.id === listingId);
        const landlord = resolveLandlordForListing(listing, null);
        const landlordId = listing?.landlordId ?? landlord.id;
        const updatedListings = get().listings.map((l) =>
          l.id === listingId
            ? { ...l, analytics: { ...l.analytics, applications: l.analytics.applications + 1 } }
            : l,
        );
        set({
          applications: [...get().applications, app],
          listings: updatedListings,
          matches: get().matches.map((m) =>
            m.listingId === listingId ? { ...m, status: "APPLIED" as const } : m,
          ),
          notifications: pushNotification(
            get().notifications,
            "New application",
            `${seeker.firstName} ${seeker.lastName} applied for ${listing?.title ?? "your listing"}. Review it in Applications.`,
            {
              landlordId,
              fromName: `${seeker.firstName} ${seeker.lastName}`,
            },
          ),
        });
        return true;
      },

      canApply: (listingId) => {
        const seeker = resolveSeeker(get().currentUser);
        return get().showings.some(
          (s) =>
            s.listingId === listingId &&
            s.seekerId === seeker.id &&
            s.status === "ACCEPTED",
        );
      },

      getShowingForListing: (listingId) => {
        const seeker = resolveSeeker(get().currentUser);
        return get().showings.find(
          (s) => s.listingId === listingId && s.seekerId === seeker.id,
        );
      },

      scheduleShowing: (listingId, date, time, contactMethod, contactValue) => {
        const seeker = resolveSeeker(get().currentUser);
        const showing: Showing = {
          id: `showing-${Date.now()}`,
          listingId,
          seekerId: seeker.id,
          seekerName: `${seeker.firstName} ${seeker.lastName}`,
          date,
          time,
          contactMethod,
          contactValue,
          status: "REQUESTED",
          createdAt: new Date().toISOString(),
        };
        const listing = get().listings.find((l) => l.id === listingId);
        const landlord = resolveLandlordForListing(listing, null);
        const landlordId = listing?.landlordId ?? landlord.id;
        set({
          showings: [...get().showings, showing],
          notifications: pushNotification(
            get().notifications,
            "Showing requested",
            `${seeker.firstName} ${seeker.lastName} requested a showing for ${listing?.title ?? "your listing"} on ${date} at ${time}.`,
            {
              landlordId,
              fromName: `${seeker.firstName} ${seeker.lastName}`,
            },
          ),
        });
      },

      acceptShowing: (id, message) => {
        const showing = get().showings.find((s) => s.id === id);
        if (!showing) return;
        const seeker = resolveSeeker(get().currentUser);
        const listing = get().listings.find((l) => l.id === showing.listingId);
        const now = new Date().toISOString();
        const accepted = {
          ...showing,
          status: "ACCEPTED" as const,
          landlordMessage: message,
          updatedAt: now,
        };

        const { currentUser } = get();
        const opened = openConversationForShowing(
          accepted,
          listing,
          get().conversations,
          currentUser,
        );
        const landlord = resolveLandlordForListing(listing, currentUser);
        const welcome = buildWelcomeMessage(
          opened.conversation.id,
          landlord,
          showing.seekerName.split(" ")[0],
          listing?.title ?? "the unit",
          "showing",
        );
        const hasWelcome = get().messages.some((m) => m.id === welcome.id);

        set({
          showings: get().showings.map((s) => (s.id === id ? accepted : s)),
          conversations: opened.conversations,
          messages: hasWelcome ? get().messages : [...get().messages, welcome],
          lastConfirmedShowing:
            showing.seekerId === seeker.id ? accepted : get().lastConfirmedShowing,
          notifications: pushNotification(
            get().notifications,
            "Showing accepted",
            `Your showing for ${showing.date} at ${showing.time} was confirmed. Open Messages to chat with your landlord.`,
            {
              seekerId: showing.seekerId,
              conversationId: opened.conversation.id,
              fromName: landlord.name,
            },
          ),
        });
      },

      declineShowing: (id, message) => {
        const showing = get().showings.find((s) => s.id === id);
        const now = new Date().toISOString();
        set({
          showings: get().showings.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "DECLINED" as const,
                  landlordMessage: message,
                  updatedAt: now,
                }
              : s,
          ),
          notifications: pushNotification(
            get().notifications,
            "Showing declined",
            message ?? "Showing request was declined.",
            {
              seekerId: showing?.seekerId,
              fromName: displayName(resolveLandlord(get().currentUser)),
            },
          ),
        });
      },

      clearConfirmedShowing: () => set({ lastConfirmedShowing: null }),

      updateApplicationStatus: (id, status) => {
        const { currentUser } = get();
        const app = get().applications.find((a) => a.id === id);
        if (!app) return;

        const listing = get().listings.find((l) => l.id === app.listingId);
        let conversations = get().conversations;
        let messages = get().messages;
        let conversationId: string | undefined;
        const now = new Date().toISOString();

        if (status === "ACCEPTED") {
          const opened = openConversationForApplication(
            app,
            listing,
            conversations,
            currentUser,
          );
          conversations = opened.conversations;
          conversationId = opened.conversation.id;

          const landlord = resolveLandlordForListing(listing, currentUser);
          const welcome = buildWelcomeMessage(
            opened.conversation.id,
            landlord,
            app.seekerName.split(" ")[0],
            listing?.title ?? "the unit",
            "application",
          );
          if (!messages.some((m) => m.id === welcome.id)) {
            messages = [...messages, welcome];
          }
        }

        const notifTitle =
          status === "ACCEPTED"
            ? "Application accepted!"
            : status === "DECLINED"
              ? "Application update"
              : "Application updated";

        const notifMessage =
          status === "ACCEPTED"
            ? `Great news — your application for ${listing?.title ?? "the listing"} was accepted. Open Messages to chat with your landlord now.`
            : status === "DECLINED"
              ? `Your application for ${listing?.title ?? "the listing"} was not accepted.`
              : `Application status changed to ${status.replace(/_/g, " ")}.`;

        set({
          applications: get().applications.map((a) =>
            a.id === id ? { ...a, status, updatedAt: now } : a,
          ),
          conversations,
          messages,
          notifications: pushNotification(
            get().notifications,
            notifTitle,
            notifMessage,
            {
              conversationId,
              seekerId: app.seekerId,
              fromName: resolveLandlordForListing(listing, currentUser).name,
            },
          ),
        });
      },

      sendMessage: (conversationId, text, role) => {
        const conversation = get().conversations.find((c) => c.id === conversationId);
        if (!conversation) return;

        const { currentUser } = get();
        const actor =
          role === "SEEKER"
            ? resolveSeeker(currentUser)
            : resolveLandlord(currentUser);
        const senderName = `${actor.firstName} ${actor.lastName}`;

        const msg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          conversationId,
          senderId: actor.id,
          senderRole: role,
          text,
          sentAt: new Date().toISOString(),
        };

        const recipientOptions =
          role === "SEEKER"
            ? {
                conversationId,
                landlordId: conversation.landlordId,
                fromName: senderName,
              }
            : {
                conversationId,
                seekerId: conversation.seekerId,
                fromName: senderName,
              };

        set({
          messages: [...get().messages, msg],
          notifications: pushNotification(
            get().notifications,
            `New message from ${senderName}`,
            text,
            recipientOptions,
          ),
        });
      },

      ensureMessagingReady: () => {
        const { applications, showings, listings, conversations, messages, currentUser } =
          get();
        let nextConversations = [...conversations];
        let nextMessages = [...messages];
        const startSignature = nextConversations
          .map((c) => `${c.id}:${c.landlordId}:${c.seekerId}`)
          .join(",");
        const startMessageCount = nextMessages.length;

        for (const showing of showings.filter((s) => s.status === "ACCEPTED")) {
          const listing = listings.find((l) => l.id === showing.listingId);
          const opened = openConversationForShowing(
            showing,
            listing,
            nextConversations,
            currentUser,
          );
          nextConversations = opened.conversations;

          const landlord = resolveLandlordForListing(listing, currentUser);
          const welcome = buildWelcomeMessage(
            opened.conversation.id,
            landlord,
            showing.seekerName.split(" ")[0],
            listing?.title ?? "the unit",
            "showing",
          );
          if (!nextMessages.some((m) => m.id === welcome.id)) {
            nextMessages = [...nextMessages, welcome];
          }
        }

        for (const app of applications.filter((a) =>
          ["ACCEPTED", "LEASE_SIGNED"].includes(a.status),
        )) {
          const listing = listings.find((l) => l.id === app.listingId);
          const opened = openConversationForApplication(
            app,
            listing,
            nextConversations,
            currentUser,
          );
          nextConversations = opened.conversations;

          const landlord = resolveLandlordForListing(listing, currentUser);
          const welcome = buildWelcomeMessage(
            opened.conversation.id,
            landlord,
            app.seekerName.split(" ")[0],
            listing?.title ?? "the unit",
            "application",
          );
          if (!nextMessages.some((m) => m.id === welcome.id)) {
            nextMessages = [...nextMessages, welcome];
          }
        }

        const endSignature = nextConversations
          .map((c) => `${c.id}:${c.landlordId}:${c.seekerId}`)
          .join(",");
        if (endSignature === startSignature && nextMessages.length === startMessageCount) {
          return;
        }
        set({ conversations: nextConversations, messages: nextMessages });
      },

      markConversationRead: (conversationId, role) => {
        const { currentUser, conversations, messages, notifications } = get();
        const myId =
          role === "SEEKER"
            ? resolveSeeker(currentUser).id
            : resolveLandlord(currentUser).id;
        const thread = messages
          .filter((m) => m.conversationId === conversationId)
          .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
        const latestIncoming = thread.find((m) => m.senderRole !== role)?.sentAt;
        const readAt = latestIncoming ?? new Date().toISOString();

        set({
          conversations: conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  seekerLastReadAt:
                    role === "SEEKER" ? readAt : c.seekerLastReadAt,
                  landlordLastReadAt:
                    role === "LANDLORD" ? readAt : c.landlordLastReadAt,
                }
              : c,
          ),
          notifications: markConversationNotificationsRead(
            notifications,
            conversationId,
            role,
            myId,
          ),
        });
      },

      markLandlordApplicationsSeen: () => {
        const landlord = resolveLandlord(get().currentUser);
        const listingIds = new Set(
          get()
            .listings.filter((l) => l.landlordId === landlord.id)
            .map((l) => l.id),
        );
        const appIds = get()
          .applications.filter((a) => listingIds.has(a.listingId))
          .map((a) => a.id);
        const showingIds = get()
          .showings.filter((s) => listingIds.has(s.listingId))
          .map((s) => s.id);

        set({
          seenLandlordApplicationIds: [
            ...new Set([...get().seenLandlordApplicationIds, ...appIds]),
          ],
          seenLandlordShowingIds: [
            ...new Set([...get().seenLandlordShowingIds, ...showingIds]),
          ],
          landlordSessions: {
            ...get().landlordSessions,
            [landlord.id]: {
              seenApplicationIds: [
                ...new Set([...get().seenLandlordApplicationIds, ...appIds]),
              ],
              seenShowingIds: [
                ...new Set([...get().seenLandlordShowingIds, ...showingIds]),
              ],
            },
          },
          notifications: markLandlordApplicationNotificationsRead(
            get().notifications,
            landlord.id,
          ),
        });
      },

      markSeekerApplicationUpdatesSeen: () => {
        const seeker = resolveSeeker(get().currentUser);
        const appIds = get()
          .applications.filter((a) => a.seekerId === seeker.id)
          .map((a) => a.id);
        const showingIds = get()
          .showings.filter((s) => s.seekerId === seeker.id)
          .map((s) => s.id);

        set({
          seenSeekerApplicationIds: [
            ...new Set([...get().seenSeekerApplicationIds, ...appIds]),
          ],
          seenSeekerShowingIds: [
            ...new Set([...get().seenSeekerShowingIds, ...showingIds]),
          ],
        });
      },

      applyRemoteSync: (payload) => {
        const local = get();
        const merged = mergeDemoPayload(
          localStateToSyncPayload({
            listings: local.listings,
            applications: local.applications,
            showings: local.showings,
            conversations: local.conversations,
            messages: local.messages,
            notifications: local.notifications,
          }),
          payload,
        );
        const { constraints, likedListings, matches, discoverFilters } = local;
        const cleanedLiked = likedListings.filter(
          (l) => !isBlockedListingTitle(l.title),
        );
        set({
          listings: merged.listings,
          applications: merged.applications,
          showings: merged.showings,
          conversations: merged.conversations,
          messages: merged.messages,
          notifications: merged.notifications,
          likedListings: cleanedLiked,
          lastSyncedAt: merged.updatedAt,
          deck: buildDeck(
            merged.listings,
            constraints ?? defaultConstraints,
            cleanedLiked,
            matches,
            discoverFilters,
          ),
        });
      },

      markNotificationRead: (id) => {
        set({
          notifications: get().notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        });
      },

      saveListing: (input, status) => {
        const { currentUser, role } = get();
        const landlordId = resolveActingLandlordId(currentUser, role);
        if (!landlordId) return null;
        const listing = inputToListing(input, status, landlordId);
        const updatedListings = [listing, ...get().listings];
        applyListingsUpdate(get, set, updatedListings);
        return listing;
      },

      updateListing: (id, input) => {
        const { currentUser, role } = get();
        const landlordId = resolveActingLandlordId(currentUser, role);
        if (!landlordId) return false;
        const existing = get().listings.find((l) => l.id === id);
        if (!existing || existing.landlordId !== landlordId) return false;
        const keptImages =
          input.images.length > 0
            ? input.images
            : existing.images;
        const updatedListings = get().listings.map((l) =>
          l.id === id
            ? {
                ...inputToListing(input, l.status, landlordId, id, existing),
                images: keptImages.slice(0, 5),
              }
            : l,
        );
        applyListingsUpdate(get, set, updatedListings);
        return true;
      },

      publishListing: (id) => {
        const landlord = resolveLandlord(get().currentUser);
        const now = new Date().toISOString();
        const updatedListings = get().listings.map((l) =>
          l.id === id && l.landlordId === landlord.id
            ? { ...l, status: "ACTIVE" as const, updatedAt: now }
            : l,
        );
        applyListingsUpdate(get, set, updatedListings);
      },

      deactivateListing: (listingId) => {
        const landlord = resolveLandlord(get().currentUser);
        const now = new Date().toISOString();
        const updatedListings = get().listings.map((l) =>
          l.id === listingId && l.landlordId === landlord.id
            ? { ...l, status: "INACTIVE" as const, updatedAt: now }
            : l,
        );
        applyListingsUpdate(get, set, updatedListings);
      },

      removeListing: (listingId) => {
        const landlord = resolveLandlord(get().currentUser);
        const listing = get().listings.find((l) => l.id === listingId);
        if (!listing || listing.landlordId !== landlord.id) return;

        const now = new Date().toISOString();
        const updatedListings =
          listing.status === "ACTIVE"
            ? get().listings.map((l) =>
                l.id === listingId
                  ? { ...l, status: "INACTIVE" as const, updatedAt: now }
                  : l,
              )
            : get().listings.filter((l) => l.id !== listingId);

        applyListingsUpdate(get, set, updatedListings);
      },

      reset: () =>
        set({
          currentUser: null,
          role: null,
          locale: "en",
          darkMode: false,
          tutorialSeen: false,
          a11y: { largeText: false, highContrast: false, reduceMotion: false },
          discoverFilters: { maxRent: 1600, groundFloorOnly: false, neighborhood: "" },
          onboardingComplete: false,
          constraints: null,
          listings: mockListings,
          deck: [],
          likedListings: [],
          matches: [],
          swipeHistory: [],
          applications: SEED_APPLICATIONS,
          showings: SEED_SHOWINGS,
          conversations: [],
          messages: [],
          notifications: [],
          lastConfirmedShowing: null,
          lastSyncedAt: null,
        }),
    }),
    {
      name: "doorway-store",
      version: 10,
      migrate: (persisted, version) => {
        const state = persisted as Partial<DoorwayState>;
        const existing = (state.listings ?? []).map((l) => {
          const seed = mockListings.find((m) => m.id === l.id);
          return {
            ...seed,
            ...l,
            transitLines: l.transitLines ?? seed?.transitLines ?? [],
            landlordVerified: l.landlordVerified ?? seed?.landlordVerified ?? false,
            analytics: l.analytics ?? seed?.analytics ?? { views: 0, saves: 0, applications: 0 },
          } as Listing;
        });
        const existingIds = new Set(existing.map((l) => l.id));
        const merged = [
          ...existing,
          ...mockListings.filter((l) => !existingIds.has(l.id)),
        ];
        const applications = (state.applications?.length ? state.applications : SEED_APPLICATIONS).map(
          (app) =>
            app.id === "app-seed-1" && app.seekerId === "seeker-demo-2"
              ? {
                  ...app,
                  seekerId: mockSeeker.id,
                  seekerName: `${mockSeeker.firstName} ${mockSeeker.lastName}`,
                }
              : app,
        );
        const showings = (state.showings?.length ? state.showings : SEED_SHOWINGS).map((s) =>
          s.id === "showing-seed-2" && s.seekerId === "seeker-demo-2"
            ? {
                ...s,
                seekerId: mockSeeker.id,
                seekerName: `${mockSeeker.firstName} ${mockSeeker.lastName}`,
              }
            : s,
        );
        const conversations = (state.conversations ?? []).map((c) =>
          c.applicationId === "app-seed-1" && c.seekerId === "seeker-demo-2"
            ? {
                ...c,
                seekerId: mockSeeker.id,
                seekerName: `${mockSeeker.firstName} ${mockSeeker.lastName}`,
              }
            : c,
        );
        const tenantSessions: Record<string, TenantSession> = {
          ...(state.tenantSessions ?? {}),
        };
        if (
          state.currentUser?.role === "SEEKER" &&
          !tenantSessions[state.currentUser.id]
        ) {
          tenantSessions[state.currentUser.id] = snapshotTenantSession({
            onboardingComplete: state.onboardingComplete ?? false,
            constraints: state.constraints ?? null,
            likedListings: state.likedListings ?? [],
            matches: state.matches ?? [],
            swipeHistory: state.swipeHistory ?? [],
            tutorialSeen: state.tutorialSeen ?? false,
            discoverFilters: state.discoverFilters ?? {
              maxRent: 1600,
              groundFloorOnly: false,
              neighborhood: "",
            },
          });
        }

        const landlordSessions: Record<string, LandlordSession> = {
          ...(state.landlordSessions ?? {}),
        };
        if (
          state.currentUser?.role === "LANDLORD" &&
          !landlordSessions[state.currentUser.id]
        ) {
          landlordSessions[state.currentUser.id] = {
            seenApplicationIds: state.seenLandlordApplicationIds ?? [],
            seenShowingIds: state.seenLandlordShowingIds ?? [],
          };
        }

        const sanitized = sanitizeDemoPayload({
          listings: merged,
          applications,
          showings,
          conversations,
          messages: state.messages ?? [],
          notifications: state.notifications ?? [],
          updatedAt: new Date().toISOString(),
        });
        const likedListings = (state.likedListings ?? []).filter(
          (l) => !isBlockedListingTitle(l.title),
        );

        return {
          currentUser: state.currentUser ?? null,
          role: state.role ?? null,
          locale: state.locale ?? "en",
          darkMode: state.darkMode ?? false,
          tutorialSeen: state.tutorialSeen ?? false,
          discoverFilters: state.discoverFilters ?? {
            maxRent: 1600,
            groundFloorOnly: false,
            neighborhood: "",
          },
          a11y: state.a11y ?? {
            largeText: false,
            highContrast: false,
            reduceMotion: false,
          },
          onboardingComplete: state.onboardingComplete ?? false,
          constraints: state.constraints ?? null,
          listings: sanitized.listings,
          likedListings,
          matches: state.matches ?? [],
          swipeHistory: state.swipeHistory ?? [],
          applications: sanitized.applications,
          showings: sanitized.showings,
          conversations: sanitized.conversations,
          messages: sanitized.messages,
          notifications: sanitized.notifications,
          tenantSessions,
          landlordSessions,
          seenLandlordApplicationIds: state.seenLandlordApplicationIds ?? [],
          seenLandlordShowingIds: state.seenLandlordShowingIds ?? [],
          seenSeekerApplicationIds: state.seenSeekerApplicationIds ?? [],
          seenSeekerShowingIds: state.seenSeekerShowingIds ?? [],
        };
      },
      partialize: (state) => ({
        currentUser: state.currentUser,
        role: state.role,
        locale: state.locale,
        darkMode: state.darkMode,
        tutorialSeen: state.tutorialSeen,
        discoverFilters: state.discoverFilters,
        a11y: state.a11y,
        onboardingComplete: state.onboardingComplete,
        constraints: state.constraints,
        listings: state.listings,
        likedListings: state.likedListings,
        matches: state.matches,
        swipeHistory: state.swipeHistory,
        tenantSessions: state.tenantSessions,
        landlordSessions: state.landlordSessions,
        seenLandlordApplicationIds: state.seenLandlordApplicationIds,
        seenLandlordShowingIds: state.seenLandlordShowingIds,
        seenSeekerApplicationIds: state.seenSeekerApplicationIds,
        seenSeekerShowingIds: state.seenSeekerShowingIds,
        applications: state.applications,
        showings: state.showings,
        conversations: state.conversations,
        messages: state.messages,
        notifications: state.notifications,
        lastSyncedAt: state.lastSyncedAt,
        lastLocalRevision: state.lastLocalRevision ?? 0,
      }),
    },
  ),
);
