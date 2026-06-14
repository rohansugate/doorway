"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DoorwayHeader } from "@/components/layout/doorway-header";
import { t } from "@/lib/i18n";
import { useDoorwayStore } from "@/lib/store";
import type { UserRole } from "@/lib/types";

const roles: { role: UserRole; title: string; description: string; href: string }[] = [
  {
    role: "SEEKER",
    title: "I'm looking for housing",
    description: "Swipe through Section 8-eligible homes matched to your voucher.",
    href: "/onboarding",
  },
  {
    role: "LANDLORD",
    title: "I'm a landlord",
    description: "List units and receive pre-verified applicants.",
    href: "/landlord",
  },
];

function startTenantDemo(router: ReturnType<typeof useRouter>) {
  const store = useDoorwayStore.getState();
  store.setRole("SEEKER");
  store.setConstraints({
    housingSituation: "SHELTER",
    voucherStatus: "HAS_VOUCHER",
    zipCode: "90011",
    voucherSize: 2,
    maxRent: 1600,
    accessibilityNeeds: false,
    proximityNeeds: ["LA Metro", "Clinic nearby"],
  });
  store.completeOnboarding();
  router.push("/discover");
}

function startLandlordDemo(router: ReturnType<typeof useRouter>) {
  useDoorwayStore.getState().setRole("LANDLORD");
  router.push("/landlord/applicants");
}

export default function HomePage() {
  const router = useRouter();
  const { setRole, onboardingComplete, locale, role } = useDoorwayStore();

  useEffect(() => {
    if (role === "SEEKER" && onboardingComplete) {
      router.replace("/discover");
    } else if (role === "LANDLORD") {
      router.replace("/landlord");
    }
  }, [role, onboardingComplete, router]);

  const handleRoleSelect = (selectedRole: UserRole, href: string) => {
    setRole(selectedRole);
    if (selectedRole === "SEEKER" && onboardingComplete) {
      router.push("/discover");
    } else {
      router.push(href);
    }
  };

  return (
    <div className="app-shell doorway-gradient flex min-h-dvh flex-col">
      <DoorwayHeader subtitle="Section 8 Housing Match" className="pt-12" />

      <div className="px-6 pb-4 text-center">
        <p className="font-serif text-xl leading-snug">{t(locale, "tagline")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t(locale, "vsCompetitor")}</p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-6 pb-4">
        {roles.map((item) => (
          <button
            key={item.role}
            type="button"
            onClick={() => handleRoleSelect(item.role, item.href)}
            className="group flex flex-col gap-1 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <span className="font-medium">{item.title}</span>
            <span className="text-sm text-muted-foreground">{item.description}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 px-6 pb-8">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Quick demo
        </p>
        <button
          type="button"
          onClick={() => startTenantDemo(router)}
          className="rounded-2xl bg-foreground px-4 py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Demo as tenant — swipe homes
        </button>
        <button
          type="button"
          onClick={() => startLandlordDemo(router)}
          className="rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-medium transition-colors hover:border-foreground/30"
        >
          Demo as landlord — review applications
        </button>
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Two-phone demo: open the same URL on both devices
        </p>
      </div>
    </div>
  );
}
