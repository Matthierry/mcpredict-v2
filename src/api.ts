import type { DashboardPayload } from "./types";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export async function getDashboard(): Promise<DashboardPayload> {
  const response = await fetch(`${baseUrl}/api/v1/dashboard`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
  return response.json() as Promise<DashboardPayload>;
}
