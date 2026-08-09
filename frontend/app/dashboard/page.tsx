import type { Metadata } from "next";
import RiskDashboard from "./risk-dashboard";

export const metadata: Metadata = {
  title: "Risk Dashboard | GramOS",
  description: "Explainable AI cash flow risk assessment for rural enterprises.",
};

// Public: no login wall. Signed-out visitors get a Supabase anonymous session
// client-side (see risk-dashboard.tsx) so they can still hit the JWT-gated
// backend API. Requires "Anonymous Sign-ins" enabled in the Supabase project.
export default function DashboardPage() {
  return <RiskDashboard />;
}
