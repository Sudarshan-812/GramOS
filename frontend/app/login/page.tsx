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

/** Left half on desktop: dark brand panel with a flat agriculture-finance
 * illustration — a sprout growing beside a stack of coins, on a forecast arc. */
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-onyx px-14 py-12 text-white lg:flex lg:flex-col lg:justify-between">
      {/* faint tiled seed / plus pattern */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]">
        <defs>
          <pattern id="agri-tile" width="52" height="52" patternUnits="userSpaceOnUse">
            <path d="M13 8v10 M8 13h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="39" cy="37" r="1.6" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#agri-tile)" />
      </svg>

      {/* ambient lime glow */}
      <div
        aria-hidden
        className="animate-aurora pointer-events-none absolute -left-24 -top-28 h-96 w-96 rounded-full bg-lime-500/20 blur-3xl"
      />

      {/* logo */}
      <div className="relative z-10 flex items-center gap-2.5">
        <Image src="/gramos-mark.png" alt="" width={442} height={442} className="h-8 w-8" priority />
        <span className="font-mono text-lg font-semibold tracking-tight text-white">GramOS</span>
      </div>

      {/* headline */}
      <div className="relative z-10 mt-12 max-w-md">
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

      {/* illustration */}
      <div className="relative z-10 flex flex-1 items-center justify-center py-6">
        <AgriScene className="h-auto w-full max-w-sm" />
      </div>

      {/* signal line */}
      <p className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-white/55">
        <span>RTI buyer-payment</span>
        <span className="text-lime-500">·</span>
        <span>India-WRIS climate</span>
        <span className="text-lime-500">·</span>
        <span>Gemini XAI</span>
      </p>
    </aside>
  );
}

/** Flat agri-fintech vector: a sprout rising from soil next to a coin stack,
 * traced by a dashed forecast arc. Leaves sway gently; sparkles twinkle. */
function AgriScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 300" fill="none" className={className} aria-hidden>
      <defs>
        <radialGradient id="agri-glow" cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor="#84cc16" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* halo */}
      <circle cx="168" cy="150" r="124" fill="url(#agri-glow)" />
      <circle
        cx="168"
        cy="150"
        r="120"
        stroke="#a3e635"
        strokeOpacity="0.22"
        strokeDasharray="2 9"
      />

      {/* dashed forecast arc rising to the right */}
      <path
        d="M150 96 C196 66 244 70 286 34"
        stroke="#bef264"
        strokeOpacity="0.7"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="3 6"
      />
      <circle cx="286" cy="34" r="3.5" fill="#bef264" />

      {/* ground */}
      <path
        d="M36 244 C110 224 210 224 284 244 L284 250 C210 276 110 276 36 250 Z"
        fill="#365314"
      />
      <path
        d="M36 244 C110 224 210 224 284 244"
        stroke="#4d7c0f"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* coin stack */}
      <g>
        <ellipse cx="106" cy="238" rx="30" ry="9" fill="#e9e7cf" stroke="#a3e635" strokeOpacity="0.5" />
        <ellipse cx="106" cy="228" rx="30" ry="9" fill="#f2f0dc" stroke="#a3e635" strokeOpacity="0.5" />
        <ellipse cx="106" cy="218" rx="30" ry="9" fill="#faf8ea" stroke="#a3e635" strokeOpacity="0.6" />
        <text
          x="106"
          y="222"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill="#3f6212"
        >
          ₹
        </text>
      </g>

      {/* sprout — sways from its base */}
      <g style={{ transformOrigin: "178px 246px" }} className="animate-sway-slow">
        <path
          d="M178 246 C176 198 182 158 179 108"
          stroke="#65a30d"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* lower-left leaf */}
        <path
          d="M179 172 C150 166 126 178 116 200 C146 210 174 198 179 172 Z"
          fill="#84cc16"
        />
        <path d="M170 187 C150 187 132 194 120 200" stroke="#4d7c0f" strokeOpacity="0.4" strokeWidth="1.5" />
        {/* lower-right leaf */}
        <path
          d="M179 156 C208 146 234 156 246 176 C218 190 188 182 179 156 Z"
          fill="#a3e635"
        />
        <path d="M189 170 C208 168 226 174 238 178" stroke="#4d7c0f" strokeOpacity="0.35" strokeWidth="1.5" />
        {/* crown leaves */}
        <path
          d="M179 108 C168 78 176 46 196 28 C208 56 202 90 179 108 Z"
          fill="#84cc16"
        />
        <path
          d="M179 116 C192 92 218 78 244 78 C238 108 210 126 179 116 Z"
          fill="#bef264"
        />
      </g>

      {/* seeds */}
      <circle cx="150" cy="250" r="2" fill="#a3e635" />
      <circle cx="212" cy="252" r="2" fill="#a3e635" />
      <circle cx="188" cy="256" r="1.6" fill="#84cc16" />

      {/* sparkles */}
      {[
        [64, 70, "0s"],
        [268, 150, "0.7s"],
        [96, 150, "1.3s"],
        [244, 232, "1.9s"],
      ].map(([x, y, delay], i) => (
        <path
          key={i}
          d={`M${x} ${y - 5} v10 M${x - 5} ${y} h10`}
          stroke="#a3e635"
          strokeOpacity="0.6"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="animate-twinkle"
          style={{ animationDelay: delay }}
        />
      ))}
    </svg>
  );
}
