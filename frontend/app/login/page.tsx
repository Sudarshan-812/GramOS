"use client";

import { Loader2 } from "@/components/icons/MaterialIcons";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm"
      >
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
        <p className="mt-4 text-sm text-onyx/60">
          Sign in to access the risk dashboard.
        </p>

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
            Password
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
    </div>
  );
}
