"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LandlordShell } from "@/components/layout/landlord-shell";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { SyncStatusBadge } from "@/components/layout/sync-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListingImage } from "@/components/ui/listing-image";
import { mockLandlord } from "@/lib/mock-data";
import { useDoorwayStore } from "@/lib/store";
import type { Listing } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function LandlordPage() {
  const listings = useDoorwayStore((s) => s.listings);
  const applications = useDoorwayStore((s) => s.applications);
  const showings = useDoorwayStore((s) => s.showings);
  const deactivateListing = useDoorwayStore((s) => s.deactivateListing);
  const publishListing = useDoorwayStore((s) => s.publishListing);

  const landlordListings = useMemo(
    () => listings.filter((l) => l.landlordId === mockLandlord.id),
    [listings],
  );

  const landlordListingIds = useMemo(
    () => new Set(landlordListings.map((l) => l.id)),
    [landlordListings],
  );

  const pendingApplicants = applications.filter(
    (a) => landlordListingIds.has(a.listingId) && !["DECLINED", "LEASE_SIGNED"].includes(a.status),
  ).length;

  const pendingShowings = showings.filter(
    (s) => landlordListingIds.has(s.listingId) && s.status === "REQUESTED",
  ).length;

  const active = landlordListings.filter((l) => l.status === "ACTIVE");
  const drafts = landlordListings.filter((l) => l.status === "DRAFT");
  const inactive = landlordListings.filter((l) => l.status === "INACTIVE");

  return (
    <LandlordShell>
      <SyncStatusBadge />
      <RoleSwitcher />
      <header className="flex items-start justify-between px-5 pt-2">
        <div>
          <h1 className="text-2xl font-bold">My Listings</h1>
          <p className="text-sm text-muted-foreground">
            {mockLandlord.firstName} {mockLandlord.lastName}
          </p>
        </div>
        <Badge variant="outline">Pending Review</Badge>
      </header>

      <div className="mx-5 mt-4 flex items-center justify-between rounded-xl bg-muted px-4 py-3">
        <div>
          <p className="text-2xl font-bold">{active.length}</p>
          <p className="text-sm text-muted-foreground">Active</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{drafts.length}</p>
          <p className="text-sm text-muted-foreground">Drafts</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{pendingApplicants}</p>
          <p className="text-sm text-muted-foreground">Applicants</p>
        </div>
      </div>

      {pendingShowings > 0 && (
        <p className="mx-5 text-sm text-muted-foreground">
          {pendingShowings} showing request{pendingShowings === 1 ? "" : "s"} waiting — check Applications
        </p>
      )}

      <div className="px-5 pt-5">
        <Link href="/landlord/add">
          <Button variant="primary" size="lg" className="w-full">
            + Add Listing
          </Button>
        </Link>
      </div>

      {landlordListings.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-center">
          <p className="text-4xl" aria-hidden>
            🏠
          </p>
          <h2 className="text-xl font-bold">No listings yet</h2>
          <p className="text-muted-foreground">
            Add your first Section 8-eligible unit to start receiving
            pre-verified applicants.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-5 py-5">
          {drafts.length > 0 && (
            <ListingSection title="Drafts">
              {drafts.map((listing) => (
                <ListingRow
                  key={listing.id}
                  listing={listing}
                  onPublish={() => publishListing(listing.id)}
                  onRemove={() => deactivateListing(listing.id)}
                />
              ))}
            </ListingSection>
          )}
          {active.length > 0 && (
            <ListingSection title="Active">
              {active.map((listing) => (
                <ListingRow
                  key={listing.id}
                  listing={listing}
                  onRemove={() => deactivateListing(listing.id)}
                />
              ))}
            </ListingSection>
          )}
          {inactive.length > 0 && (
            <ListingSection title="Inactive">
              {inactive.map((listing) => (
                <ListingRow key={listing.id} listing={listing} />
              ))}
            </ListingSection>
          )}
        </div>
      )}
    </LandlordShell>
  );
}

function ListingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}

function ListingRow({
  listing,
  onPublish,
  onRemove,
}: {
  listing: Listing;
  onPublish?: () => void;
  onRemove?: () => void;
}) {
  return (
    <li className="flex gap-3 rounded-2xl border border-border p-3">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        <ListingImage
          src={listing.images[0]}
          alt=""
          fill
          className="object-cover"
          sizes="80px"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <h3 className="truncate font-bold">{listing.title}</h3>
        <p className="text-sm text-muted-foreground">
          {listing.bedrooms} bed · {listing.bathrooms} bath · {listing.zipCode}
          {listing.neighborhood ? ` · ${listing.neighborhood}` : ""}
        </p>
        <p className="font-bold text-primary">
          {formatCurrency(listing.monthlyRent)}/mo
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {listing.isSection8Approved && (
            <Badge variant="success">Section 8</Badge>
          )}
          {listing.isGroundFloor && (
            <Badge variant="outline">Ground floor</Badge>
          )}
          <Badge variant={listing.status === "ACTIVE" ? "default" : "outline"}>
            {listing.status === "ACTIVE"
              ? "Active"
              : listing.status === "DRAFT"
                ? "Draft"
                : "Inactive"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {listing.analytics.views} views · {listing.analytics.saves} saves ·{" "}
          {listing.analytics.applications} apps
        </p>
      </div>
      <div className="flex shrink-0 flex-col justify-center gap-1">
        <Link href={`/landlord/edit/${listing.id}`}>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </Link>
        {onPublish && (
          <Button variant="primary" size="sm" onClick={onPublish}>
            Publish
          </Button>
        )}
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            aria-label={`Remove ${listing.title}`}
            onClick={onRemove}
          >
            Remove
          </Button>
        )}
      </div>
    </li>
  );
}
