"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { mockLandlord } from "@/lib/mock-data";
import { useDoorwayStore } from "@/lib/store";
import type { UserRole } from "@/lib/types";

const ROLE_CONFIG: Record<
  "SEEKER" | "LANDLORD",
  { label: string; other: string; otherRole: UserRole; defaultHref: string }
> = {
  SEEKER: {
    label: "Tenant",
    other: "Landlord",
    otherRole: "LANDLORD",
    defaultHref: "/landlord",
  },
  LANDLORD: {
    label: "Landlord",
    other: "Tenant",
    otherRole: "SEEKER",
    defaultHref: "/discover",
  },
};

const PARALLEL_ROUTES: Record<string, { SEEKER: string; LANDLORD: string }> = {
  "/discover": { SEEKER: "/discover", LANDLORD: "/landlord" },
  "/matches": { SEEKER: "/matches", LANDLORD: "/landlord/applicants" },
  "/messages": { SEEKER: "/messages", LANDLORD: "/landlord/messages" },
  "/profile": { SEEKER: "/profile", LANDLORD: "/landlord/profile" },
  "/landlord": { SEEKER: "/discover", LANDLORD: "/landlord" },
  "/landlord/applicants": { SEEKER: "/matches", LANDLORD: "/landlord/applicants" },
  "/landlord/messages": { SEEKER: "/messages", LANDLORD: "/landlord/messages" },
  "/landlord/profile": { SEEKER: "/profile", LANDLORD: "/landlord/profile" },
};

function targetHref(pathname: string, nextRole: "SEEKER" | "LANDLORD"): string {
  const map = PARALLEL_ROUTES[pathname];
  if (map) return map[nextRole];
  return ROLE_CONFIG[nextRole].defaultHref;
}

export function RoleSwitcher({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const role = useDoorwayStore((s) => s.role);
  const setRole = useDoorwayStore((s) => s.setRole);

  if (role !== "SEEKER" && role !== "LANDLORD") return null;

  const config = ROLE_CONFIG[role];

  const switchRole = () => {
    const nextRole = config.otherRole as "SEEKER" | "LANDLORD";
    setRole(nextRole);
    router.push(targetHref(pathname, nextRole));
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={switchRole}
        className="mx-5 mb-3 self-start rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Switch to {config.other}
      </button>
    );
  }

  return (
    <div className="mx-5 mb-3 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-sm">
        Viewing as <span className="font-semibold">{config.label}</span>
        {role === "LANDLORD" && (
          <span className="text-muted-foreground">
            {" "}
            · {mockLandlord.firstName} {mockLandlord.lastName}
          </span>
        )}
      </p>
      <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={switchRole}>
        {config.other} view
      </Button>
    </div>
  );
}
