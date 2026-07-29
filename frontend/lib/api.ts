import type { HistoryPoint, RiskAssessmentRequest, RiskAssessmentResponse } from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
  const res = await fetch(`${API_BASE_URL}/api/mock-profiles`);
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  const data: { profiles: string[] } = await res.json();
  return data.profiles;
}

export async function getMockProfile(
  key: string
): Promise<RiskAssessmentRequest> {
  const res = await fetch(`${API_BASE_URL}/api/mock-profiles/${key}`);
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function getEnterpriseHistory(
  enterpriseId: string
): Promise<HistoryPoint[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/enterprises/${enterpriseId}/history`
  );
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}

export async function assessRisk(
  payload: RiskAssessmentRequest
): Promise<RiskAssessmentResponse> {
  const res = await fetch(`${API_BASE_URL}/api/assess-risk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res));
  return res.json();
}
