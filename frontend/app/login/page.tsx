"use client";

import { ArrowRight, Eye, EyeOff, Loader2 } from "@/components/icons/MaterialIcons";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "forgot-password">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

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

  const isSignIn = mode === "sign-in";

  return (
    <div className="min-h-screen w-full bg-paper lg:grid lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12">
        <div className="animate-rise mx-auto w-full max-w-sm">
          {/* Compact wordmark — the brand panel carries this on desktop */}
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <Image
              src="/gramos-mark.png"
              alt="GramOS"
              width={442}
              height={442}
              className="h-7 w-7"
              priority
            />
            <span className="font-mono text-base font-semibold tracking-tight text-onyx">
              GramOS
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-onyx sm:text-[1.75rem]">
            {isSignIn ? "Welcome back" : "Reset your password"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-onyx/55">
            {isSignIn
              ? "Sign in to the risk dashboard for your portfolio."
              : resetSent
                ? "Check your email for a link to reset your password."
                : "Enter your account email and we’ll send you a reset link."}
          </p>

          {isSignIn ? (
            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
              <Field label="Email">
                <input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@lender.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field
                label="Password"
                action={
                  <button
                    type="button"
                    onClick={() => switchMode("forgot-password")}
                    className="cursor-pointer text-xs font-medium text-lime-700 transition hover:text-lime-800"
                  >
                    Forgot password?
                  </button>
                }
              >
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-onyx/35 transition hover:bg-mist hover:text-onyx/70"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>

              {error && <ErrorNote>{error}</ErrorNote>}

              <SubmitButton loading={loading} idleLabel="Sign in" busyLabel="Signing in…" />
            </form>
          ) : (
            !resetSent && (
              <form onSubmit={handleResetRequest} className="mt-8 flex flex-col gap-5">
                <Field label="Email">
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@lender.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </Field>

                {error && <ErrorNote>{error}</ErrorNote>}

                <SubmitButton
                  loading={loading}
                  idleLabel="Send reset link"
                  busyLabel="Sending…"
                />
              </form>
            )
          )}

          {isSignIn ? (
            <p className="mt-8 text-sm text-onyx/50">
              Don&rsquo;t have an account?{" "}
              <a
                href="/contact"
                className="font-medium text-lime-700 transition hover:text-lime-800"
              >
                Contact us
              </a>{" "}
              for access.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => switchMode("sign-in")}
              className="mt-8 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-onyx/55 transition hover:text-onyx"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              Back to sign in
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm text-onyx shadow-sm outline-none transition placeholder:text-onyx/25 hover:border-black/20 focus:border-lime-500 focus:ring-2 focus:ring-lime-200";

function Field({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-sm font-medium text-onyx/80">
        {label}
        {action}
      </span>
      {children}
    </label>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}

function SubmitButton({
  loading,
  idleLabel,
  busyLabel,
}: {
  loading: boolean;
  idleLabel: string;
  busyLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="group mt-1 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-onyx shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-lime-200 hover:shadow-md active:translate-y-0 active:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {busyLabel}
        </>
      ) : (
        <>
          {idleLabel}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}

/** Left half on desktop: dark agri-fintech brand panel with an ambient
 * rupee "chakra", plowed-field furrows, and a few twinkling seed points. */
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-onyx px-14 py-12 text-white lg:flex lg:flex-col lg:justify-between">
      {/* ambient lime glow */}
      <div
        aria-hidden
        className="animate-aurora pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-lime-500/20 blur-3xl"
      />

      {/* rotating rupee chakra, anchored off the bottom-right corner */}
      <svg
        aria-hidden
        viewBox="0 0 400 400"
        className="animate-spin-slower pointer-events-none absolute -bottom-40 -right-40 h-[34rem] w-[34rem] opacity-70"
      >
        <circle cx="200" cy="200" r="192" fill="none" stroke="#a3e635" strokeOpacity="0.18" />
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d="M200,145 C182,110 182,60 200,32 C218,60 218,110 200,145 Z"
            fill="#84cc16"
            fillOpacity={i % 2 === 0 ? "0.16" : "0.07"}
            stroke="#bef264"
            strokeOpacity="0.22"
            transform={`rotate(${(i / 12) * 360} 200 200)`}
          />
        ))}
        <circle cx="200" cy="200" r="34" fill="none" stroke="#bef264" strokeOpacity="0.5" />
        <text
          x="200"
          y="212"
          textAnchor="middle"
          fontSize="30"
          fontWeight="600"
          fill="#bef264"
          fillOpacity="0.75"
        >
          ₹
        </text>
      </svg>

      {/* plowed-field furrows */}
      <svg
        aria-hidden
        viewBox="0 0 600 260"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56 w-full"
      >
        {Array.from({ length: 6 }, (_, i) => {
          const y = 60 + i * 34;
          return (
            <path
              key={i}
              d={`M0,${y} C160,${y - 22} 440,${y + 22} 600,${y}`}
              fill="none"
              stroke="#a3e635"
              strokeOpacity={0.05 + i * 0.03}
              strokeWidth="1.5"
            />
          );
        })}
      </svg>

      {/* twinkling seed points */}
      {[
        ["18%", "22%", "0s"],
        ["34%", "68%", "0.6s"],
        ["72%", "30%", "1.1s"],
        ["58%", "80%", "1.7s"],
      ].map(([top, left, delay], i) => (
        <span
          key={i}
          aria-hidden
          className="animate-twinkle absolute h-1.5 w-1.5 rounded-full bg-lime-300/70"
          style={{ top, left, animationDelay: delay }}
        />
      ))}

      {/* content */}
      <div className="relative z-10 flex items-center gap-2.5">
        <Image
          src="/gramos-mark.png"
          alt=""
          width={442}
          height={442}
          className="h-8 w-8"
          priority
        />
        <span className="font-mono text-lg font-semibold tracking-tight text-white">
          GramOS
        </span>
      </div>

      <div className="relative z-10 max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lime-400">
          Rural credit risk, explained
        </p>
        <h2 className="mt-4 text-4xl font-semibold leading-[1.15] tracking-tight xl:text-[2.75rem]">
          See the risk before the missed&nbsp;payment.
        </h2>
        <p className="mt-5 text-[15px] leading-7 text-white/55">
          GramOS fuses buyer-payment arrears, satellite climate, and groundwater
          signals into one auditable NPA score — in the loan officer&rsquo;s hands
          weeks early.
        </p>
      </div>

      <div className="relative z-10 space-y-3 text-xs text-white/40">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-white/55">
          <span>RTI buyer-payment</span>
          <span className="text-lime-500">·</span>
          <span>India-WRIS climate</span>
          <span className="text-lime-500">·</span>
          <span>Gemini XAI</span>
        </p>
        <p>Built for the Google DeepMind &ldquo;AI for the Planet&rdquo; Accelerator.</p>
      </div>
    </aside>
  );
}
