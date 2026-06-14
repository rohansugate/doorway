"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LandlordShell } from "@/components/layout/landlord-shell";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { mockLandlord } from "@/lib/mock-data";
import { useDoorwayStore } from "@/lib/store";

export default function LandlordApplicantsPage() {
  const listings = useDoorwayStore((s) => s.listings);
  const applications = useDoorwayStore((s) => s.applications);
  const showings = useDoorwayStore((s) => s.showings);
  const locale = useDoorwayStore((s) => s.locale);
  const acceptShowing = useDoorwayStore((s) => s.acceptShowing);
  const declineShowing = useDoorwayStore((s) => s.declineShowing);
  const updateApplicationStatus = useDoorwayStore((s) => s.updateApplicationStatus);
  const [showingMessages, setShowingMessages] = useState<Record<string, string>>({});

  const landlordListingIds = useMemo(
    () => new Set(listings.filter((l) => l.landlordId === mockLandlord.id).map((l) => l.id)),
    [listings],
  );

  const landlordShowings = showings.filter((s) => landlordListingIds.has(s.listingId));
  const landlordApps = applications.filter((a) => landlordListingIds.has(a.listingId));

  return (
    <LandlordShell>
      <RoleSwitcher compact />
      <header className="px-5 pt-3">
        <h1 className="text-2xl font-bold">{t(locale, "applications")}</h1>
        <p className="text-sm text-muted-foreground">Showings first, then applications</p>
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Showing requests</h2>
          {landlordShowings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No showing requests</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {landlordShowings.map((s) => {
                const listing = listings.find((l) => l.id === s.listingId);
                return (
                  <li key={s.id} className="rounded-2xl border border-border p-4">
                    <h3 className="font-bold">{s.seekerName}</h3>
                    <p className="text-sm text-muted-foreground">{listing?.title}</p>
                    <p className="text-sm">{s.date} at {s.time} · {s.contactMethod}: {s.contactValue}</p>
                    <Badge variant="outline" className="mt-2">{s.status}</Badge>
                    {s.status === "REQUESTED" && (
                      <div className="mt-3 flex flex-col gap-2">
                        <Input
                          label={t(locale, "landlordMessage")}
                          value={showingMessages[s.id] ?? ""}
                          onChange={(e) =>
                            setShowingMessages((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              acceptShowing(s.id, showingMessages[s.id]);
                              setShowingMessages((prev) => ({ ...prev, [s.id]: "" }));
                            }}
                          >
                            {t(locale, "accept")}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              declineShowing(s.id, showingMessages[s.id]);
                              setShowingMessages((prev) => ({ ...prev, [s.id]: "" }));
                            }}
                          >
                            {t(locale, "decline")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Applications</h2>
          {landlordApps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications yet</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {landlordApps.map((app) => {
                const listing = listings.find((l) => l.id === app.listingId);
                return (
                  <li key={app.id} className="rounded-2xl border border-border p-4">
                    <h3 className="font-bold">{app.seekerName}</h3>
                    <p className="text-sm text-muted-foreground">{listing?.title}</p>
                    <Badge variant="outline" className="mt-1">{app.status.replace(/_/g, " ")}</Badge>
                    <dl className="mt-2 text-sm">
                      <dt className="text-muted-foreground">Voucher #</dt>
                      <dd className="font-medium">{app.packet.voucherCaseNumber}</dd>
                      <dt className="text-muted-foreground">Employment</dt>
                      <dd>{app.packet.employment}</dd>
                      <dt className="text-muted-foreground">References</dt>
                      <dd>{app.packet.references}</dd>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {app.status === "SENT" && (
                        <Button variant="outline" size="sm" onClick={() => updateApplicationStatus(app.id, "VIEWED")}>Mark viewed</Button>
                      )}
                      {!["ACCEPTED", "DECLINED", "LEASE_SIGNED"].includes(app.status) && (
                        <>
                          <Button variant="primary" size="sm" onClick={() => updateApplicationStatus(app.id, "ACCEPTED")}>{t(locale, "accept")}</Button>
                          <Button variant="destructive" size="sm" onClick={() => updateApplicationStatus(app.id, "DECLINED")}>{t(locale, "decline")}</Button>
                        </>
                      )}
                      {app.status === "ACCEPTED" && (
                        <>
                          <Link href={`/landlord/messages?conversationId=convo-${app.id}`}>
                            <Button variant="outline" size="sm">Message tenant</Button>
                          </Link>
                          <Button variant="primary" size="sm" onClick={() => updateApplicationStatus(app.id, "LEASE_SIGNED")}>Lease signed</Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </LandlordShell>
  );
}
