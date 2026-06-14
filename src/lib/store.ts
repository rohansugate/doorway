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
  UserRole,
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
import { localStateToSyncPayload, mergeDemoPayload } from "./sync-merge";
import { isDuplicateListing, sortByRelevance } from "./sort-listings";

interface DoorwayState {
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
  syncStatus: SyncStatus | null;
  setSyncStatus: (status: SyncStatus) => void;
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
  applyRemoteSync: (payload: DemoSyncPayload) => void;
  markNotificationRead: (id: string) => void;
  saveListing: (input: ListingInput, status: "DRAFT" | "ACTIVE") => Listing | null;
  updateListing: (id: string, input: ListingInput) => boolean;
  publishListing: (id: string) => void;
  deactivateListing: (listingId: string) => void;
  reset: () => void;
}

const defaultConstraints = mockSeeker.constraints ?? {
  housingSituation: "SHELTER" as const,
  voucherStatus: "HAS_VOUCHER" as const,
  zipCode: "90011",
  voucherSize: 2,
  maxRent: 1600,
  accessibilityNeeds: false,
  proximityNeeds: [],
};

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
  return sortByRelevance(filtered, activeConstraints, likedListings);
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
    landlordId: mockLandlord.id,
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
  };
}

function pushNotification(
  notifications: Notification[],
  title: string,
  message: string,
  conversationId?: string,
): Notification[] {
  const n: Notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    message,
    channels: ["in_app", "email", "sms"],
    read: false,
    createdAt: new Date().toISOString(),
    conversationId,
  };
  return [n, ...notifications];
}

function openConversationForApplication(
  app: Application,
  listing: Listing | undefined,
  conversations: Conversation[],
): { conversations: Conversation[]; conversation: Conversation } {
  const existing = conversations.find((c) => c.applicationId === app.id);
  if (existing) return { conversations, conversation: existing };

  const conversation: Conversation = {
    id: `convo-${app.id}`,
    applicationId: app.id,
    listingId: app.listingId,
    listingTitle: listing?.title ?? "Listing",
    seekerId: app.seekerId,
    seekerName: app.seekerName,
    landlordId: mockLandlord.id,
    landlordName: `${mockLandlord.firstName} ${mockLandlord.lastName}`,
    createdAt: new Date().toISOString(),
  };
  return { conversations: [...conversations, conversation], conversation };
}

export const useDoorwayStore = create<DoorwayState>()(
  persist(
    (set, get) => ({
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
      syncStatus: null,

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
        const { deck, likedListings, matches, listings, swipeHistory } = get();
        const listing = deck.find((l) => l.id === listingId);
        if (!listing) return;

        const matchId = `match-${Date.now()}`;
        const newMatch: Match = {
          id: matchId,
          seekerId: mockSeeker.id,
          listingId,
          status: direction === "right" ? "LIKED" : "PASSED",
          actorId: mockSeeker.id,
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
        const showing = get()
          .showings.filter(
            (s) => s.listingId === listingId && s.seekerId === mockSeeker.id,
          )
          .find((s) => s.status === "ACCEPTED");
        if (!showing) return false;

        const app: Application = {
          id: `app-${Date.now()}`,
          listingId,
          showingId: showing.id,
          seekerId: mockSeeker.id,
          seekerName: `${mockSeeker.firstName} ${mockSeeker.lastName}`,
          packet,
          status: "SENT",
          sentAt: new Date().toISOString(),
        };

        const listing = get().listings.find((l) => l.id === listingId);
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
            `${mockSeeker.firstName} ${mockSeeker.lastName} applied for ${listing?.title ?? "your listing"}. Review it in Applications.`,
          ),
        });
        return true;
      },

      canApply: (listingId) =>
        get()
          .showings.some(
            (s) =>
              s.listingId === listingId &&
              s.seekerId === mockSeeker.id &&
              s.status === "ACCEPTED",
          ),

      getShowingForListing: (listingId) =>
        get().showings.find(
          (s) => s.listingId === listingId && s.seekerId === mockSeeker.id,
        ),

      scheduleShowing: (listingId, date, time, contactMethod, contactValue) => {
        const showing: Showing = {
          id: `showing-${Date.now()}`,
          listingId,
          seekerId: mockSeeker.id,
          seekerName: `${mockSeeker.firstName} ${mockSeeker.lastName}`,
          date,
          time,
          contactMethod,
          contactValue,
          status: "REQUESTED",
          createdAt: new Date().toISOString(),
        };
        const listing = get().listings.find((l) => l.id === listingId);
        set({
          showings: [...get().showings, showing],
          notifications: pushNotification(
            get().notifications,
            "Showing requested",
            `Showing request for ${listing?.title ?? "listing"} on ${date} at ${time}.`,
          ),
        });
      },

      acceptShowing: (id, message) => {
        const showing = get().showings.find((s) => s.id === id);
        if (!showing) return;
        const updated = get().showings.map((s) =>
          s.id === id
            ? { ...s, status: "ACCEPTED" as const, landlordMessage: message }
            : s,
        );
        set({
          showings: updated,
          lastConfirmedShowing:
            showing.seekerId === mockSeeker.id
              ? { ...showing, status: "ACCEPTED", landlordMessage: message }
              : get().lastConfirmedShowing,
          notifications: pushNotification(
            get().notifications,
            "Showing accepted",
            `Showing for ${showing.seekerName} on ${showing.date} confirmed.`,
          ),
        });
      },

      declineShowing: (id, message) => {
        set({
          showings: get().showings.map((s) =>
            s.id === id
              ? { ...s, status: "DECLINED" as const, landlordMessage: message }
              : s,
          ),
          notifications: pushNotification(
            get().notifications,
            "Showing declined",
            message ?? "Showing request was declined.",
          ),
        });
      },

      clearConfirmedShowing: () => set({ lastConfirmedShowing: null }),

      updateApplicationStatus: (id, status) => {
        const app = get().applications.find((a) => a.id === id);
        if (!app) return;

        const listing = get().listings.find((l) => l.id === app.listingId);
        let conversations = get().conversations;
        let messages = get().messages;
        let conversationId: string | undefined;

        if (status === "ACCEPTED") {
          const opened = openConversationForApplication(app, listing, conversations);
          conversations = opened.conversations;
          conversationId = opened.conversation.id;

          const welcome: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            conversationId: opened.conversation.id,
            senderId: mockLandlord.id,
            senderRole: "LANDLORD",
            text: `Hi ${app.seekerName.split(" ")[0]}, your application for ${listing?.title ?? "the unit"} was accepted. Feel free to message me here if you have questions.`,
            sentAt: new Date().toISOString(),
          };
          messages = [...messages, welcome];
        }

        const notifTitle =
          status === "ACCEPTED"
            ? "Application accepted"
            : status === "DECLINED"
              ? "Application declined"
              : "Application updated";

        const notifMessage =
          status === "ACCEPTED"
            ? `Your application for ${listing?.title ?? "the listing"} was accepted. You can now message the landlord.`
            : status === "DECLINED"
              ? `Your application for ${listing?.title ?? "the listing"} was not accepted.`
              : `Application status changed to ${status.replace(/_/g, " ")}.`;

        set({
          applications: get().applications.map((a) =>
            a.id === id ? { ...a, status } : a,
          ),
          conversations,
          messages,
          notifications: pushNotification(
            get().notifications,
            notifTitle,
            notifMessage,
            conversationId,
          ),
        });
      },

      sendMessage: (conversationId, text, role) => {
        const conversation = get().conversations.find((c) => c.id === conversationId);
        if (!conversation) return;

        const senderId = role === "SEEKER" ? mockSeeker.id : mockLandlord.id;
        const senderName =
          role === "SEEKER"
            ? `${mockSeeker.firstName} ${mockSeeker.lastName}`
            : `${mockLandlord.firstName} ${mockLandlord.lastName}`;

        const msg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          conversationId,
          senderId,
          senderRole: role,
          text,
          sentAt: new Date().toISOString(),
        };

        set({
          messages: [...get().messages, msg],
          notifications: pushNotification(
            get().notifications,
            `New message from ${senderName}`,
            text,
            conversationId,
          ),
        });
      },

      markConversationRead: (conversationId, role) => {
        set({
          notifications: get().notifications.map((n) =>
            n.conversationId === conversationId ? { ...n, read: true } : n,
          ),
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
        set({
          listings: merged.listings,
          applications: merged.applications,
          showings: merged.showings,
          conversations: merged.conversations,
          messages: merged.messages,
          notifications: merged.notifications,
          lastSyncedAt: merged.updatedAt,
          deck: buildDeck(
            merged.listings,
            constraints ?? defaultConstraints,
            likedListings,
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
        if (
          isDuplicateListing(get().listings, {
            landlordId: mockLandlord.id,
            ...input,
          })
        ) {
          return null;
        }
        const listing = inputToListing(input, status);
        const updatedListings = [listing, ...get().listings];
        applyListingsUpdate(get, set, updatedListings);
        return listing;
      },

      updateListing: (id, input) => {
        const existing = get().listings.find((l) => l.id === id);
        if (!existing) return false;
        if (
          isDuplicateListing(
            get().listings,
            { landlordId: mockLandlord.id, ...input },
            id,
          )
        ) {
          return false;
        }
        const keptImages =
          input.images.length > 0
            ? input.images
            : existing.images;
        const updatedListings = get().listings.map((l) =>
          l.id === id
            ? { ...inputToListing(input, l.status, id, existing), images: keptImages.slice(0, 5) }
            : l,
        );
        applyListingsUpdate(get, set, updatedListings);
        return true;
      },

      publishListing: (id) => {
        const updatedListings = get().listings.map((l) =>
          l.id === id ? { ...l, status: "ACTIVE" as const } : l,
        );
        applyListingsUpdate(get, set, updatedListings);
      },

      deactivateListing: (listingId) => {
        const updatedListings = get().listings.map((l) =>
          l.id === listingId ? { ...l, status: "INACTIVE" as const } : l,
        );
        applyListingsUpdate(get, set, updatedListings);
      },

      reset: () =>
        set({
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
      version: 5,
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
        return {
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
          listings: merged,
          likedListings: state.likedListings ?? [],
          matches: state.matches ?? [],
          swipeHistory: state.swipeHistory ?? [],
          applications,
          showings,
          conversations,
          messages: state.messages ?? [],
          notifications: state.notifications ?? [],
        };
      },
      partialize: (state) => ({
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
        applications: state.applications,
        showings: state.showings,
        conversations: state.conversations,
        messages: state.messages,
        notifications: state.notifications,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
);
