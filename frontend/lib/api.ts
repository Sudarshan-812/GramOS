import { createClient } from "./supabase/client";
import type {
  DocumentInsight,
  HistoryPoint,
  RiskAssessmentRequest,
  RiskAssessmentResponse,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function authHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // response body wasn't JSON, fall through to status text
  }
  return `${res.status} ${res.statusText}`;
}

export async function listMockProfileKeys(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/api/mock-profiles`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  const data: { profiles: string[] } = await res.json();
  return data.profiles;
}

export async function getMockProfile(
  key: string
): Promise<RiskAssessmentRequest> {
  const res = await fetch(`${API_BASE_URL}/api/mock-profiles/${key}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function getEnterpriseHistory(
  enterpriseId: string
): Promise<HistoryPoint[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/enterprises/${enterpriseId}/history`,
    { headers: await authHeaders() }
  );
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function assessRisk(
  payload: RiskAssessmentRequest
): Promise<RiskAssessmentResponse> {
  const res = await fetch(`${API_BASE_URL}/api/assess-risk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function uploadDocument(
  enterpriseId: string,
  file: File
): Promise<DocumentInsight> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE_URL}/api/enterprises/${enterpriseId}/upload-document`,
    {
      method: "POST",
      // Do not set Content-Type here — the browser must set it (with the
      // multipart boundary) itself when the body is a FormData instance.
      headers: await authHeaders(),
      body: formData,
    }
  );
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function getDocumentInsights(
  enterpriseId: string
): Promise<DocumentInsight[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/enterprises/${enterpriseId}/documents`,
    { headers: await authHeaders() }
  );
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}
