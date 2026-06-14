"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDoorwayStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const landlordNav = [
  {
    href: "/landlord",
    label: "Listings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    href: "/landlord/applicants",
    label: "Applications",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    href: "/landlord/messages",
    label: "Messages",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="size-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  },
  {
    href: "/landlord/profile",
    label: "You",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
      </svg>
    ),
  },
];

export function LandlordShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const notifications = useDoorwayStore((s) => s.notifications);
  const applications = useDoorwayStore((s) => s.applications);
  const showings = useDoorwayStore((s) => s.showings);

  const unreadMessages = notifications.filter((n) => n.conversationId && !n.read).length;
  const pendingApps = applications.filter((a) => !["DECLINED", "LEASE_SIGNED"].includes(a.status)).length;
  const pendingShowings = showings.filter((s) => s.status === "REQUESTED").length;

  const badges: Record<string, number> = {
    "/landlord/applicants": pendingApps + pendingShowings,
    "/landlord/messages": unreadMessages,
  };

  const hideNav =
    pathname === "/landlord/add" || pathname.startsWith("/landlord/edit");

  return (
    <div className="app-shell flex flex-col">
      <main className={cn("flex flex-1 flex-col", !hideNav && "pb-20")}>
        {children}
      </main>
      {!hideNav && (
        <nav
          className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-border bg-background"
          style={{ paddingBottom: "var(--safe-bottom)" }}
          aria-label="Landlord navigation"
        >
          <div className="flex items-stretch justify-around px-3 py-2">
            {landlordNav.map((item) => {
              const active =
                item.href === "/landlord"
                  ? pathname === "/landlord" || pathname === "/landlord/add"
                  : pathname === item.href;
              const badge = badges[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors touch-target",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="relative">
                    {item.icon}
                    {badge ? (
                      <span className="absolute -right-2 -top-1 flex size-4 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-background">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    ) : null}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
