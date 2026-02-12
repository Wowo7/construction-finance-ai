import { z } from "zod";
import { tool } from "ai";
import { createServerSupabase, DEMO_ORG_ID } from "./supabase";

// ============================================================
// Tool definitions for AI chat - each maps to a Supabase RPC
// ============================================================

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// Helper: resolve project name to ID
async function resolveProjectId(
  projectName: string | undefined
): Promise<string | null> {
  if (!projectName) return null;
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .eq("org_id", DEMO_ORG_ID)
    .ilike("name", `%${projectName}%`)
    .limit(1)
    .single();
  return data?.id ?? null;
}

// Tool 1: Budget by trade
export const getBudgetByTrade = tool({
  description:
    "Get remaining budget breakdown by trade (e.g. masonry, electrical). Shows original budget, changes, committed, invoiced, paid, and remaining amounts. Use this when the user asks about money remaining for a specific trade or all trades.",
  parameters: z.object({
    project_name: z
      .string()
      .optional()
      .describe(
        "Optional project name to filter by (e.g. 'Downtown Office Tower'). Leave empty for all projects."
      ),
  }),
  execute: async ({ project_name }) => {
    const supabase = createServerSupabase();
    const projectId = await resolveProjectId(project_name);

    const { data, error } = await supabase.rpc("get_budget_by_trade", {
      p_org_id: DEMO_ORG_ID,
      p_project_id: projectId,
    });

    if (error) return { error: error.message };
    if (!data || data.length === 0) return { message: "No data found." };

    return {
      trades: data.map(
        (row: {
          trade_name: string;
          csi_code: string;
          package_count: number;
          original_budget: number;
          approved_changes: number;
          revised_budget: number;
          committed: number;
          invoiced: number;
          paid: number;
          remaining: number;
        }) => ({
          trade: row.trade_name,
          csi_code: row.csi_code,
          packages: row.package_count,
          original_budget: fmt(row.original_budget),
          approved_changes: fmt(row.approved_changes),
          revised_budget: fmt(row.revised_budget),
          committed: fmt(row.committed),
          invoiced: fmt(row.invoiced),
          paid: fmt(row.paid),
          remaining: fmt(row.remaining),
          remaining_raw: Number(row.remaining),
        })
      ),
      filter: project_name || "All Projects",
    };
  },
});

// Tool 2: Budget by project
export const getBudgetByProject = tool({
  description:
    "Get remaining budget summary for each project. Shows total budget, committed, invoiced, paid, remaining, and percent spent. Use when the user asks about project-level finances.",
  parameters: z.object({}),
  execute: async () => {
    const supabase = createServerSupabase();

    const { data, error } = await supabase.rpc("get_budget_by_project", {
      p_org_id: DEMO_ORG_ID,
    });

    if (error) return { error: error.message };
    if (!data || data.length === 0) return { message: "No projects found." };

    return {
      projects: data.map(
        (row: {
          project_name: string;
          project_code: string;
          project_status: string;
          original_budget: number;
          approved_changes: number;
          revised_budget: number;
          committed: number;
          invoiced: number;
          paid: number;
          remaining: number;
          pct_spent: number;
        }) => ({
          name: row.project_name,
          code: row.project_code,
          status: row.project_status,
          original_budget: fmt(row.original_budget),
          approved_changes: fmt(row.approved_changes),
          revised_budget: fmt(row.revised_budget),
          committed: fmt(row.committed),
          invoiced: fmt(row.invoiced),
          paid: fmt(row.paid),
          remaining: fmt(row.remaining),
          pct_committed: `${row.pct_spent}%`,
        })
      ),
    };
  },
});

// Tool 3: Overspent packages
export const getOverspentPackages = tool({
  description:
    "Find all packages where committed amount exceeds the revised budget (overspent). Shows the overspent amount and percentage. Use when the user asks about overspending, over-budget items, or cost overruns.",
  parameters: z.object({
    project_name: z
      .string()
      .optional()
      .describe("Optional project name to filter by."),
  }),
  execute: async ({ project_name }) => {
    const supabase = createServerSupabase();
    const projectId = await resolveProjectId(project_name);

    const { data, error } = await supabase.rpc("get_overspent_packages", {
      p_org_id: DEMO_ORG_ID,
      p_project_id: projectId,
    });

    if (error) return { error: error.message };
    if (!data || data.length === 0)
      return { message: "No overspent packages found. All packages are within budget." };

    return {
      overspent_packages: data.map(
        (row: {
          project_name: string;
          trade_name: string;
          package_name: string;
          revised_budget: number;
          committed: number;
          overspent_amount: number;
          overspent_pct: number;
        }) => ({
          project: row.project_name,
          trade: row.trade_name,
          package: row.package_name,
          revised_budget: fmt(row.revised_budget),
          committed: fmt(row.committed),
          overspent_by: fmt(row.overspent_amount),
          overspent_pct: `${row.overspent_pct}%`,
        })
      ),
      total_overspent: fmt(
        data.reduce(
          (sum: number, row: { overspent_amount: number }) =>
            sum + Number(row.overspent_amount),
          0
        )
      ),
      count: data.length,
      filter: project_name || "All Projects",
    };
  },
});

// Tool 4: Financial summary (committed vs spent vs remaining)
export const getFinancialSummary = tool({
  description:
    "Get a high-level financial summary showing committed vs invoiced vs paid vs remaining. Use when the user asks for an overview, total budget status, or committed vs spent vs remaining.",
  parameters: z.object({
    project_name: z
      .string()
      .optional()
      .describe("Optional project name to filter by."),
  }),
  execute: async ({ project_name }) => {
    const supabase = createServerSupabase();
    const projectId = await resolveProjectId(project_name);

    const { data, error } = await supabase.rpc("get_financial_summary", {
      p_org_id: DEMO_ORG_ID,
      p_project_id: projectId,
    });

    if (error) return { error: error.message };
    if (!data || data.length === 0) return { message: "No data found." };

    const row = data[0];
    return {
      summary: {
        original_budget: fmt(row.total_original_budget),
        approved_changes: fmt(row.total_approved_changes),
        revised_budget: fmt(row.total_revised_budget),
        committed: fmt(row.total_committed),
        invoiced: fmt(row.total_invoiced),
        paid: fmt(row.total_paid),
        remaining: fmt(row.total_remaining),
        pct_committed: `${row.pct_committed}%`,
        pct_invoiced: `${row.pct_invoiced}%`,
        pct_paid: `${row.pct_paid}%`,
        open_packages: row.open_packages,
        overspent_packages: row.overspent_packages,
      },
      filter: project_name || "All Projects",
    };
  },
});

// Tool 5: Drilldown packages by trade
export const getPackagesByTrade = tool({
  description:
    "Get detailed list of all packages for a specific trade. Shows each package's budget, committed, invoiced, paid, remaining, and status. Use when the user wants to drill down into a specific trade like masonry or electrical.",
  parameters: z.object({
    trade_name: z
      .string()
      .describe(
        "The trade name to look up (e.g. 'Masonry', 'Electrical', 'HVAC', 'Concrete')"
      ),
    project_name: z
      .string()
      .optional()
      .describe("Optional project name to filter by."),
  }),
  execute: async ({ trade_name, project_name }) => {
    const supabase = createServerSupabase();
    const projectId = await resolveProjectId(project_name);

    const { data, error } = await supabase.rpc("get_packages_by_trade", {
      p_org_id: DEMO_ORG_ID,
      p_trade_name: trade_name,
      p_project_id: projectId,
    });

    if (error) return { error: error.message };
    if (!data || data.length === 0)
      return {
        message: `No packages found for trade "${trade_name}". Check spelling or try: Concrete, Masonry, Metals, Electrical, Plumbing, HVAC, Finishes, Roofing, Fire Protection, Elevators.`,
      };

    return {
      trade: trade_name,
      packages: data.map(
        (row: {
          project_name: string;
          package_name: string;
          description: string;
          original_budget: number;
          approved_changes: number;
          revised_budget: number;
          committed: number;
          invoiced: number;
          paid: number;
          remaining: number;
          status: string;
        }) => ({
          project: row.project_name,
          package: row.package_name,
          description: row.description,
          original_budget: fmt(row.original_budget),
          approved_changes: fmt(row.approved_changes),
          revised_budget: fmt(row.revised_budget),
          committed: fmt(row.committed),
          invoiced: fmt(row.invoiced),
          paid: fmt(row.paid),
          remaining: fmt(row.remaining),
          status: row.status,
        })
      ),
      total_packages: data.length,
      filter: project_name || "All Projects",
    };
  },
});

// Export all tools as a single object
export const financeTools = {
  getBudgetByTrade,
  getBudgetByProject,
  getOverspentPackages,
  getFinancialSummary,
  getPackagesByTrade,
};
