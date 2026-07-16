import type { Metadata } from "next";
import RiskDashboard from "./risk-dashboard";

export const metadata: Metadata = {
  title: "Risk Dashboard | GramOS",
  description: "Explainable AI cash flow risk assessment for rural enterprises.",
};

export default function DashboardPage() {
  return <RiskDashboard />;
}
