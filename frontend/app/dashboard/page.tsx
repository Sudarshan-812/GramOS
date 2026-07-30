import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import RiskDashboard from "./risk-dashboard";

export const metadata: Metadata = {
  title: "Risk Dashboard | GramOS",
  description: "Explainable AI cash flow risk assessment for rural enterprises.",
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <RiskDashboard />;
}
