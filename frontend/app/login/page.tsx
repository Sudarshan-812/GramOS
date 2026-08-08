"use client";

import { Loader2 } from "@/components/icons/MaterialIcons";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "forgot-password">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.refresh();
    router.push("/dashboard");
  }

  async function handleResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/reset-password` }
    );

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  }

  function switchMode(next: "sign-in" | "forgot-password") {
    setMode(next);
    setError(null);
    setResetSent(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <Image
            src="/GramOStpt.png"
            alt="GramOS"
            width={1024}
            height={1024}
            className="h-8 w-8"
            priority
          />
          <h1 className="text-xl font-semibold tracking-tight text-onyx">
            GramOS
          </h1>
        </div>

        {mode === "sign-in" ? (
          <>
            <p className="mt-4 text-sm text-onyx/60">
              Sign in to access the risk dashboard.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="mt-6 flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-sm text-onyx/70">
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-md border border-black/10 bg-paper px-3 py-2 text-sm text-onyx outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-200"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm text-onyx/70">
                  <div className="flex items-center justify-between">
                    Password
                    <button
                      type="button"
                      onClick={() => switchMode("forgot-password")}
                      className="cursor-pointer text-xs font-medium text-lime-700 hover:text-lime-800"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-md border border-black/10 bg-paper px-3 py-2 text-sm text-onyx outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-200"
                  />
                </label>
              </div>

              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-lime-300 px-4 py-2.5 text-sm font-semibold text-onyx shadow-sm transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-onyx/60">
              {resetSent
                ? "Check your email for a link to reset your password."
                : "Enter your account email and we'll send you a reset link."}
            </p>

            {!resetSent && (
              <form onSubmit={handleResetRequest}>
                <div className="mt-6 flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5 text-sm text-onyx/70">
                    Email
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-md border border-black/10 bg-paper px-3 py-2 text-sm text-onyx outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-200"
                    />
                  </label>
                </div>

                {error && (
                  <p className="mt-4 text-sm text-red-600">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-lime-300 px-4 py-2.5 text-sm font-semibold text-onyx shadow-sm transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => switchMode("sign-in")}
              className="mt-4 cursor-pointer text-sm font-medium text-onyx/60 hover:text-onyx"
            >
              &larr; Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
