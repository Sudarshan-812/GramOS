"use client";

import { Loader2 } from "@/components/icons/MaterialIcons";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <Image
            src="/gramos-mark.png"
            alt="GramOS"
            width={442}
            height={442}
            className="h-8 w-8"
            priority
          />
          <h1 className="font-mono text-xl font-semibold tracking-tight text-onyx">
            GramOS
          </h1>
        </div>

        {done ? (
          <>
            <p className="mt-4 text-sm text-onyx/60">
              Your password has been updated.
            </p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-lime-300 px-4 py-2.5 text-sm font-semibold text-onyx shadow-sm transition hover:bg-lime-200"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-onyx/60">
              Choose a new password for your account.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="mt-6 flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-sm text-onyx/70">
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-md border border-black/10 bg-paper px-3 py-2 text-sm text-onyx outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-200"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm text-onyx/70">
                  Confirm new password
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                    Updating...
                  </>
                ) : (
                  "Update password"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
