"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DoorwayHeader } from "@/components/layout/doorway-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { homePathForUser } from "@/lib/auth-routing";
import { useDoorwayStore } from "@/lib/store";
import type { User } from "@/lib/types";

type AuthMode = "signup" | "login";
type SignupRole = "SEEKER" | "LANDLORD";

interface VerifiedAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "SEEKER" | "LANDLORD";
}

const ROLE_OPTIONS: {
  role: SignupRole;
  title: string;
  description: string;
}[] = [
  {
    role: "SEEKER",
    title: "Tenant",
    description: "Browse Section 8 homes, schedule showings, and apply.",
  },
  {
    role: "LANDLORD",
    title: "Landlord",
    description: "List units and review pre-verified applicants.",
  },
];

function roleLabel(role: SignupRole) {
  return role === "SEEKER" ? "Tenant" : "Landlord";
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSwitching = searchParams.get("switch") === "1";
  const currentUser = useDoorwayStore((s) => s.currentUser);
  const onboardingComplete = useDoorwayStore((s) => s.onboardingComplete);
  const loginUser = useDoorwayStore((s) => s.loginUser);

  const [mode, setMode] = useState<AuthMode>(() => {
    const m = searchParams.get("mode");
    if (m === "login" || m === "signup") return m;
    return isSwitching ? "login" : "signup";
  });
  const [signupRole, setSignupRole] = useState<SignupRole>(() => {
    const role = searchParams.get("role");
    return role === "LANDLORD" ? "LANDLORD" : "SEEKER";
  });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verifiedAccount, setVerifiedAccount] = useState<VerifiedAccount | null>(null);

  useEffect(() => {
    const role = searchParams.get("role");
    if (role === "LANDLORD" || role === "SEEKER") {
      setSignupRole(role);
    }
    const m = searchParams.get("mode");
    if (m === "login" || m === "signup") setMode(m);
    else if (searchParams.get("switch") === "1") setMode("login");
  }, [searchParams]);

  useEffect(() => {
    if (!currentUser || isSwitching) return;
    router.replace(homePathForUser(currentUser, onboardingComplete));
  }, [currentUser, onboardingComplete, router, isSwitching]);

  const redirectAfterAuth = (user: User) => {
    router.push(homePathForUser(user, useDoorwayStore.getState().onboardingComplete));
  };

  const resetVerification = () => {
    setVerifiedAccount(null);
    setError("");
  };

  const checkAccount = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter your email to check your account.");
      return;
    }

    setChecking(true);
    setError("");
    setVerifiedAccount(null);

    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not verify account.");
        return;
      }

      if (!data.exists) {
        setError("No account found in Doorway. Create a new account below.");
        setMode("signup");
        return;
      }

      setVerifiedAccount(data.user);
      setMode("login");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login" && !verifiedAccount) {
        await checkAccount();
        setLoading(false);
        return;
      }

      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        mode === "signup"
          ? { email, password, firstName, lastName, role: signupRole }
          : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      loginUser(data.user);
      redirectAfterAuth(data.user);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell doorway-gradient flex min-h-dvh flex-col">
      <DoorwayHeader
        subtitle={isSwitching ? "Switch account" : "Your account"}
        className="pt-12"
      />

      <div className="px-6 pb-4 text-center">
        <p className="font-serif text-xl leading-snug">
          {isSwitching
            ? "Sign in or create another account"
            : "Join Doorway as a tenant or landlord"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Accounts are verified against Doorway&apos;s database. Passwords are
          stored securely by Supabase when you sign up.
        </p>
      </div>

      <div className="mx-6 mb-4 flex rounded-full border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            resetVerification();
          }}
          className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-colors ${
            mode === "login"
              ? "bg-foreground text-background"
              : "text-muted-foreground"
          }`}
        >
          I have an account
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            resetVerification();
          }}
          className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-colors ${
            mode === "signup"
              ? "bg-foreground text-background"
              : "text-muted-foreground"
          }`}
        >
          New account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-6 pb-8">
        {mode === "signup" && (
          <>
            <p className="text-sm font-semibold">I am a…</p>
            <div className="flex flex-col gap-2">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.role}
                  type="button"
                  onClick={() => setSignupRole(option.role)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    signupRole === option.role
                      ? "border-foreground bg-card"
                      : "border-border bg-card/60 hover:border-foreground/30"
                  }`}
                >
                  <span className="font-medium">{option.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
              <Input
                label="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </>
        )}

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (verifiedAccount) resetVerification();
          }}
          autoComplete="email"
          required
        />

        {mode === "login" && verifiedAccount && (
          <div className="rounded-2xl border border-foreground/20 bg-card px-4 py-3 text-sm">
            <p className="font-medium text-foreground">
              Account found: {verifiedAccount.firstName} {verifiedAccount.lastName}
            </p>
            <p className="text-muted-foreground">
              {roleLabel(verifiedAccount.role)} · {verifiedAccount.email}
            </p>
          </div>
        )}

        {(mode === "signup" || verifiedAccount) && (
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            required
          />
        )}

        {error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {mode === "login" && !verifiedAccount ? (
          <Button
            type="button"
            variant="primary"
            size="md"
            className="mt-2 w-full rounded-2xl"
            disabled={checking}
            onClick={checkAccount}
          >
            {checking ? "Checking account…" : "Check my account"}
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="mt-2 w-full rounded-2xl"
            disabled={loading}
          >
            {loading
              ? "Please wait…"
              : mode === "signup"
                ? `Create ${roleLabel(signupRole)} account`
                : "Log in"}
          </Button>
        )}

        {mode === "login" && verifiedAccount && (
          <button
            type="button"
            onClick={resetVerification}
            className="text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Use a different email
          </button>
        )}

        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to home
        </button>
      </form>
    </div>
  );
}
