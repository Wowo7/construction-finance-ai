-- ============================================================
-- Construction Finance SaaS - Database Schema
-- Multi-tenant with RLS, designed for AI chat tool-calling
-- ============================================================

-- Organizations (tenants)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Users belong to organizations
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  org_id uuid references organizations(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz default now()
);

-- Projects (construction projects)
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  code text not null,                    -- e.g. "PRJ-001"
  status text default 'active' check (status in ('planning', 'active', 'on_hold', 'completed', 'closed')),
  address text,
  city text,
  state text,
  start_date date,
  estimated_completion date,
  original_contract_value numeric(14,2) default 0,
  created_at timestamptz default now()
);

-- Trades (CSI divisions / work categories)
create table trades (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  name text not null,                    -- e.g. "Masonry", "Electrical"
  csi_code text,                         -- CSI MasterFormat code e.g. "04 00 00"
  created_at timestamptz default now()
);

-- Budget packages (line items within a project + trade)
create table packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  trade_id uuid references trades(id) on delete restrict not null,
  org_id uuid references organizations(id) on delete cascade not null,
  name text not null,                    -- e.g. "Exterior Brick Veneer"
  description text,
  original_budget numeric(14,2) default 0,
  approved_changes numeric(14,2) default 0,    -- sum of approved change orders
  -- revised_budget = original_budget + approved_changes (computed)
  committed numeric(14,2) default 0,           -- POs + subcontracts issued
  invoiced numeric(14,2) default 0,            -- billed by vendor/sub
  paid numeric(14,2) default 0,                -- actually paid out
  status text default 'open' check (status in ('open', 'closed', 'on_hold')),
  created_at timestamptz default now()
);

-- Change orders
create table change_orders (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references packages(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  org_id uuid references organizations(id) on delete cascade not null,
  co_number text not null,               -- e.g. "CO-001"
  description text not null,
  amount numeric(14,2) not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_date date default current_date,
  approved_date date,
  created_at timestamptz default now()
);

-- Vendors / Subcontractors
create table vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  contact_email text,
  phone text,
  trade_specialty text,
  created_at timestamptz default now()
);

-- Commitments (POs and subcontracts)
create table commitments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid references packages(id) on delete cascade not null,
  vendor_id uuid references vendors(id) on delete restrict not null,
  org_id uuid references organizations(id) on delete cascade not null,
  commitment_type text default 'subcontract' check (commitment_type in ('purchase_order', 'subcontract')),
  reference_number text,                 -- PO or contract number
  amount numeric(14,2) not null,
  description text,
  status text default 'active' check (status in ('draft', 'active', 'completed', 'cancelled')),
  created_at timestamptz default now()
);

-- Invoices (bills from vendors against commitments)
create table invoices (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid references commitments(id) on delete cascade not null,
  package_id uuid references packages(id) on delete cascade not null,
  org_id uuid references organizations(id) on delete cascade not null,
  invoice_number text not null,
  amount numeric(14,2) not null,
  invoice_date date default current_date,
  due_date date,
  status text default 'pending' check (status in ('pending', 'approved', 'paid', 'disputed')),
  created_at timestamptz default now()
);

-- Chat logs (for AI assistant audit trail)
create table chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  org_id uuid references organizations(id) on delete cascade not null,
  question text not null,
  tool_calls jsonb default '[]',
  response text,
  tokens_used integer,
  model text,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table organizations enable row level security;
alter table users enable row level security;
alter table projects enable row level security;
alter table trades enable row level security;
alter table packages enable row level security;
alter table change_orders enable row level security;
alter table vendors enable row level security;
alter table commitments enable row level security;
alter table invoices enable row level security;
alter table chat_logs enable row level security;

-- For the demo, we use a simple service-role bypass.
-- In production, policies would check auth.uid() against users.org_id.
-- Example production policy:
-- create policy "Users see own org data" on projects
--   for select using (
--     org_id in (select org_id from users where id = auth.uid())
--   );

-- Demo: allow all for service role (anon key blocked by default)
create policy "Service role full access" on organizations for all using (true);
create policy "Service role full access" on users for all using (true);
create policy "Service role full access" on projects for all using (true);
create policy "Service role full access" on trades for all using (true);
create policy "Service role full access" on packages for all using (true);
create policy "Service role full access" on change_orders for all using (true);
create policy "Service role full access" on vendors for all using (true);
create policy "Service role full access" on commitments for all using (true);
create policy "Service role full access" on invoices for all using (true);
create policy "Service role full access" on chat_logs for all using (true);

-- ============================================================
-- Indexes for performance
-- ============================================================

create index idx_packages_project on packages(project_id);
create index idx_packages_trade on packages(trade_id);
create index idx_packages_org on packages(org_id);
create index idx_commitments_package on commitments(package_id);
create index idx_invoices_commitment on invoices(commitment_id);
create index idx_change_orders_package on change_orders(package_id);
create index idx_chat_logs_org on chat_logs(org_id);

-- ============================================================
-- RPC Functions (called by AI tools)
-- ============================================================

-- Tool 1: Remaining budget by trade
create or replace function get_budget_by_trade(p_org_id uuid, p_project_id uuid default null)
returns table (
  trade_name text,
  csi_code text,
  package_count bigint,
  original_budget numeric,
  approved_changes numeric,
  revised_budget numeric,
  committed numeric,
  invoiced numeric,
  paid numeric,
  remaining numeric
) language sql stable as $$
  select
    t.name as trade_name,
    t.csi_code,
    count(p.id) as package_count,
    coalesce(sum(p.original_budget), 0) as original_budget,
    coalesce(sum(p.approved_changes), 0) as approved_changes,
    coalesce(sum(p.original_budget + p.approved_changes), 0) as revised_budget,
    coalesce(sum(p.committed), 0) as committed,
    coalesce(sum(p.invoiced), 0) as invoiced,
    coalesce(sum(p.paid), 0) as paid,
    coalesce(sum((p.original_budget + p.approved_changes) - p.committed), 0) as remaining
  from packages p
  join trades t on p.trade_id = t.id
  where p.org_id = p_org_id
    and (p_project_id is null or p.project_id = p_project_id)
    and p.status = 'open'
  group by t.name, t.csi_code
  order by t.name;
$$;

-- Tool 2: Remaining budget by project
create or replace function get_budget_by_project(p_org_id uuid)
returns table (
  project_name text,
  project_code text,
  project_status text,
  original_budget numeric,
  approved_changes numeric,
  revised_budget numeric,
  committed numeric,
  invoiced numeric,
  paid numeric,
  remaining numeric,
  pct_spent numeric
) language sql stable as $$
  select
    pr.name as project_name,
    pr.code as project_code,
    pr.status as project_status,
    coalesce(sum(p.original_budget), 0) as original_budget,
    coalesce(sum(p.approved_changes), 0) as approved_changes,
    coalesce(sum(p.original_budget + p.approved_changes), 0) as revised_budget,
    coalesce(sum(p.committed), 0) as committed,
    coalesce(sum(p.invoiced), 0) as invoiced,
    coalesce(sum(p.paid), 0) as paid,
    coalesce(sum((p.original_budget + p.approved_changes) - p.committed), 0) as remaining,
    case
      when sum(p.original_budget + p.approved_changes) > 0
      then round(sum(p.committed) / sum(p.original_budget + p.approved_changes) * 100, 1)
      else 0
    end as pct_spent
  from projects pr
  left join packages p on p.project_id = pr.id
  where pr.org_id = p_org_id
  group by pr.name, pr.code, pr.status
  order by pr.name;
$$;

-- Tool 3: Overspent packages
create or replace function get_overspent_packages(p_org_id uuid, p_project_id uuid default null)
returns table (
  project_name text,
  trade_name text,
  package_name text,
  revised_budget numeric,
  committed numeric,
  overspent_amount numeric,
  overspent_pct numeric
) language sql stable as $$
  select
    pr.name as project_name,
    t.name as trade_name,
    p.name as package_name,
    (p.original_budget + p.approved_changes) as revised_budget,
    p.committed,
    (p.committed - (p.original_budget + p.approved_changes)) as overspent_amount,
    case
      when (p.original_budget + p.approved_changes) > 0
      then round((p.committed - (p.original_budget + p.approved_changes)) / (p.original_budget + p.approved_changes) * 100, 1)
      else 0
    end as overspent_pct
  from packages p
  join projects pr on p.project_id = pr.id
  join trades t on p.trade_id = t.id
  where p.org_id = p_org_id
    and (p_project_id is null or p.project_id = p_project_id)
    and p.committed > (p.original_budget + p.approved_changes)
    and p.status = 'open'
  order by (p.committed - (p.original_budget + p.approved_changes)) desc;
$$;

-- Tool 4: Committed vs Spent vs Remaining summary
create or replace function get_financial_summary(p_org_id uuid, p_project_id uuid default null)
returns table (
  total_original_budget numeric,
  total_approved_changes numeric,
  total_revised_budget numeric,
  total_committed numeric,
  total_invoiced numeric,
  total_paid numeric,
  total_remaining numeric,
  pct_committed numeric,
  pct_invoiced numeric,
  pct_paid numeric,
  open_packages bigint,
  overspent_packages bigint
) language sql stable as $$
  select
    coalesce(sum(p.original_budget), 0),
    coalesce(sum(p.approved_changes), 0),
    coalesce(sum(p.original_budget + p.approved_changes), 0),
    coalesce(sum(p.committed), 0),
    coalesce(sum(p.invoiced), 0),
    coalesce(sum(p.paid), 0),
    coalesce(sum((p.original_budget + p.approved_changes) - p.committed), 0),
    case when sum(p.original_budget + p.approved_changes) > 0
      then round(sum(p.committed) / sum(p.original_budget + p.approved_changes) * 100, 1) else 0 end,
    case when sum(p.original_budget + p.approved_changes) > 0
      then round(sum(p.invoiced) / sum(p.original_budget + p.approved_changes) * 100, 1) else 0 end,
    case when sum(p.original_budget + p.approved_changes) > 0
      then round(sum(p.paid) / sum(p.original_budget + p.approved_changes) * 100, 1) else 0 end,
    count(*) filter (where p.status = 'open'),
    count(*) filter (where p.committed > (p.original_budget + p.approved_changes))
  from packages p
  where p.org_id = p_org_id
    and (p_project_id is null or p.project_id = p_project_id);
$$;

-- Tool 5: Drilldown packages by trade
create or replace function get_packages_by_trade(p_org_id uuid, p_trade_name text, p_project_id uuid default null)
returns table (
  project_name text,
  package_name text,
  description text,
  original_budget numeric,
  approved_changes numeric,
  revised_budget numeric,
  committed numeric,
  invoiced numeric,
  paid numeric,
  remaining numeric,
  status text
) language sql stable as $$
  select
    pr.name as project_name,
    p.name as package_name,
    p.description,
    p.original_budget,
    p.approved_changes,
    (p.original_budget + p.approved_changes) as revised_budget,
    p.committed,
    p.invoiced,
    p.paid,
    ((p.original_budget + p.approved_changes) - p.committed) as remaining,
    p.status
  from packages p
  join projects pr on p.project_id = pr.id
  join trades t on p.trade_id = t.id
  where p.org_id = p_org_id
    and lower(t.name) = lower(p_trade_name)
    and (p_project_id is null or p.project_id = p_project_id)
  order by pr.name, p.name;
$$;

-- Helper: List all trades for an org
create or replace function get_trades_list(p_org_id uuid)
returns table (trade_name text, csi_code text)
language sql stable as $$
  select name, csi_code from trades where org_id = p_org_id order by name;
$$;

-- Helper: List all projects for an org
create or replace function get_projects_list(p_org_id uuid)
returns table (project_name text, project_code text, project_status text)
language sql stable as $$
  select name, code, status from projects where org_id = p_org_id order by code;
$$;
