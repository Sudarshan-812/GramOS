"use client";

import { AlertTriangle, Loader2, X } from "@/components/icons/MaterialIcons";
import { type FormEvent, useEffect, useState } from "react";
import { overrideScore } from "@/lib/api";
import type { AuditLog } from "@/lib/types";

interface OverrideScoreModalProps {
  enterpriseId: string;
  currentScore: number;
  onClose: () => void;
  onSuccess: (auditLog: AuditLog) => void;
}

export default function OverrideScoreModal({
  enterpriseId,
  currentScore,
  onClose,
  onSuccess,
}: OverrideScoreModalProps) {
  const [overriddenScore, setOverriddenScore] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedScore = Number(overriddenScore);
    if (
      overriddenScore.trim() === "" ||
      !Number.isInteger(parsedScore) ||
      parsedScore < 0 ||
      parsedScore > 100
    ) {
      setError("Enter a whole number between 0 and 100.");
      return;
    }
    if (justification.trim() === "") {
      setError("A justification is required for the audit log.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const auditLog = await overrideScore(enterpriseId, {
        original_score: currentScore,
        overridden_score: parsedScore,
        justification: justification.trim(),
      });
      onSuccess(auditLog);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Override failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-onyx">
              Manual Score Override
            </h2>
            <p className="mt-1 text-xs text-onyx/40">
              Current AI score:{" "}
              <span className="font-semibold text-onyx/70">
                {currentScore} / 100
              </span>
              . This action is logged to the compliance audit trail.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-md p-1 text-onyx/40 transition hover:bg-mist hover:text-onyx"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-onyx/70">
            New Score (0–100)
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              required
              value={overriddenScore}
              onChange={(e) => setOverriddenScore(e.target.value)}
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-onyx outline-none focus:border-lime-400"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-onyx/70">
            Justification
            <textarea
              required
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="e.g. Site visit confirmed stronger fodder reserves than satellite NDVI suggested."
              className="resize-none rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-onyx outline-none placeholder:text-onyx/30 focus:border-lime-400"
            />
          </label>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-onyx/70 transition hover:bg-mist"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-lime-300 px-4 py-2 text-sm font-semibold text-onyx transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Override"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
