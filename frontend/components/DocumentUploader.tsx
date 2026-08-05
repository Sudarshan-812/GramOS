"use client";

import { AlertTriangle, Loader2, UploadCloud } from "@/components/icons/MaterialIcons";
import { type DragEvent, useRef, useState } from "react";
import { uploadDocument } from "@/lib/api";
import type { DocumentInsight } from "@/lib/types";

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

interface DocumentUploaderProps {
  enterpriseId: string;
  onUploadSuccess: (insight: DocumentInsight) => void;
}

export default function DocumentUploader({
  enterpriseId,
  onUploadSuccess,
}: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (uploading) return;

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setError(
        "Unsupported file type. Upload a PDF, JPEG, PNG, WEBP, or HEIC image."
      );
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const insight = await uploadDocument(enterpriseId, file);
      onUploadSuccess(insight);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Document upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-onyx/40">
        Upload Document
      </h2>
      <p className="mt-1 text-sm text-onyx/40">
        Upload a bank statement, KCC passbook, invoice, or other financial
        document to extract underwriting insights.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          uploading
            ? "cursor-not-allowed border-black/10 bg-mist"
            : isDragging
              ? "cursor-pointer border-lime-400 bg-lime-50"
              : "cursor-pointer border-black/15 hover:border-black/25 hover:bg-mist"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES.join(",")}
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-lime-600" />
            <p className="text-sm text-onyx/50">
              Extracting insights with Gemini...
            </p>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-onyx/30" />
            <p className="text-sm font-medium text-onyx/70">
              Drag &amp; drop a file here, or click to browse
            </p>
            <p className="text-xs text-onyx/40">
              PDF, JPEG, PNG, WEBP, HEIC (up to 20MB)
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
