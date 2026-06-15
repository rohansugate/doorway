"use client";

import { useState } from "react";
import { DoorwayHeader } from "@/components/layout/doorway-header";
import { Button } from "@/components/ui/button";
import { useDoorwayStore } from "@/lib/store";
import type { HousingSituation, SeekerConstraints, VoucherStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CA_TRANSIT_OPTIONS } from "@/lib/neighborhoods";

const PROXIMITY_OPTIONS = CA_TRANSIT_OPTIONS;

const HOUSING_OPTIONS: {
  value: HousingSituation;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "SHELTER",
    label: "In a Shelter / Transitional Housing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    value: "UNSHELTERED",
    label: "Unsheltered / Outdoors / Vehicle",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
  },
  {
    value: "COUCH_SURFING",
    label: "Staying with Friends / Couch Surfing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
      </svg>
    ),
  },
];

function SelectionCard({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/30",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-background/30 bg-background/10" : "border-border bg-muted",
        )}
      >
        {icon}
      </span>
      <span className="text-[15px] font-medium leading-snug">{label}</span>
    </button>
  );
}

function ToggleButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-full border px-6 py-4 text-center text-[15px] font-medium transition-all",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  );
}

export function OnboardingForm() {
  const { setConstraints, completeOnboarding } = useDoorwayStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SeekerConstraints>({
    housingSituation: "SHELTER",
    voucherStatus: "HAS_VOUCHER",
    zipCode: "90011",
    voucherSize: 2,
    maxRent: 1600,
    accessibilityNeeds: false,
    proximityNeeds: [],
  });

  const totalSteps = 4;
  const isLast = step === totalSteps - 1;

  const handleNext = () => {
    if (isLast) {
      setConstraints(form);
      completeOnboarding();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="doorway-gradient flex min-h-dvh flex-1 flex-col">
      <div className="mx-6 mt-3 h-0.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
        />
      </div>

      <DoorwayHeader subtitle="Getting Started" />

      <div className="flex flex-1 flex-col px-6 pb-6">
        {step === 0 && (
          <div className="flex flex-1 flex-col gap-6">
            <div>
              <h2 className="font-serif text-[1.75rem] leading-tight">
                Where are you staying tonight?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                There is no wrong answer. This helps us show the right homes and resources for you.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {HOUSING_OPTIONS.map((opt) => (
                <SelectionCard
                  key={opt.value}
                  selected={form.housingSituation === opt.value}
                  onClick={() => setForm({ ...form, housingSituation: opt.value })}
                  icon={opt.icon}
                  label={opt.label}
                />
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col gap-6">
            <div>
              <h2 className="font-serif text-[1.75rem] leading-tight">
                Do you have a Section 8 Voucher?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Either path is welcome here. We&apos;ll tailor your matches accordingly.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <ToggleButton
                selected={form.voucherStatus === "HAS_VOUCHER"}
                onClick={() => setForm({ ...form, voucherStatus: "HAS_VOUCHER" as VoucherStatus })}
              >
                Yes, I have a voucher
              </ToggleButton>
              <ToggleButton
                selected={form.voucherStatus === "NEEDS_ASSISTANCE"}
                onClick={() => setForm({ ...form, voucherStatus: "NEEDS_ASSISTANCE" as VoucherStatus })}
              >
                No, I need shelter / assistance
              </ToggleButton>
            </div>
            {form.voucherStatus === "HAS_VOUCHER" && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    Voucher Bedroom Size
                  </label>
                  <select
                    value={form.voucherSize}
                    onChange={(e) => setForm({ ...form, voucherSize: Number(e.target.value) })}
                    className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-base outline-none focus:border-foreground"
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}BR
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    Max Approved Rent
                  </label>
                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <input
                      type="number"
                      min={600}
                      max={3500}
                      step={50}
                      value={form.maxRent}
                      onChange={(e) => setForm({ ...form, maxRent: Number(e.target.value) })}
                      className="w-full rounded-2xl border border-border bg-card py-3.5 pl-8 pr-4 text-base outline-none focus:border-foreground"
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Estimated HUD payment standard for your area
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col gap-6">
            <div>
              <h2 className="font-serif text-[1.75rem] leading-tight">Accessibility needs?</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                We&apos;ll prioritize ground-floor units when you need them.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <ToggleButton
                selected={form.accessibilityNeeds}
                onClick={() => setForm({ ...form, accessibilityNeeds: true })}
              >
                Yes, ground floor only
              </ToggleButton>
              <ToggleButton
                selected={!form.accessibilityNeeds}
                onClick={() => setForm({ ...form, accessibilityNeeds: false })}
              >
                No preference
              </ToggleButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-1 flex-col gap-6">
            <div>
              <h2 className="font-serif text-[1.75rem] leading-tight">What&apos;s nearby?</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Tap all that matter to you — transit, clinics, schools, and more.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROXIMITY_OPTIONS.map((option) => {
                const selected = form.proximityNeeds.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        proximityNeeds: selected
                          ? form.proximityNeeds.filter((p) => p !== option)
                          : [...form.proximityNeeds, option],
                      })
                    }
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-auto flex gap-3 pt-8">
          {step > 0 && (
            <Button variant="outline" size="lg" className="flex-1 rounded-full" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button variant="primary" size="lg" className="flex-1 rounded-full" onClick={handleNext}>
            {isLast ? "Start Discovering" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
