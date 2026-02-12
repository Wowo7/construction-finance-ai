# Construction Finance AI Assistant

An AI-powered chat assistant that lets construction project managers query budget data in plain English. Built with Next.js 15, Supabase, and OpenRouter (Claude Sonnet 4).

## What It Does

Instead of digging through spreadsheets, PMs type natural language questions like "How much money is left for masonry?" or "Which packages are overspent?" The AI calls the right Supabase RPC function, gets the data, and responds with formatted tables and summaries.

## Tech Stack

- **Next.js 15** (App Router) + **React 19**
- **Supabase** (PostgreSQL + RPC functions + Row Level Security)
- **OpenRouter** (LLM provider - uses Claude Sonnet 4)
- **Vercel AI SDK 4.1** (streaming chat with tool calling)
- **Tailwind CSS 3.4** (responsive chat UI)
- **TypeScript 5.7** (full type safety)
- **Zod** (tool parameter validation)

## Architecture

```
User types question
    |
    v
ChatInterface.tsx (client) ---> POST /api/chat (server)
                                    |
                                    v
                              OpenRouter LLM (Claude Sonnet 4)
                                    |
                                    v
                              AI decides which tool to call
                                    |
                                    v
                              tools.ts executes Supabase RPC
                                    |
                                    v
                              Supabase returns data
                                    |
                                    v
                              AI formats response with tables
                                    |
                                    v
                              Streamed back to chat UI
```

All database calls happen server-side only. The Supabase service role key never reaches the browser.

## The 5 AI Tools

| Tool | What It Queries | Example Question |
|------|----------------|------------------|
| `getBudgetByTrade` | Remaining budget grouped by trade (masonry, electrical, etc.) | "How much is left for masonry?" |
| `getBudgetByProject` | Budget summary per project with percent spent | "Show me all project budgets" |
| `getOverspentPackages` | Packages where committed exceeds revised budget | "Which packages are over budget?" |
| `getFinancialSummary` | High-level committed vs invoiced vs paid vs remaining | "Give me a financial overview" |
| `getPackagesByTrade` | Detailed package list for a specific trade | "Drill into the Electrical trade" |

Each tool maps to a PostgreSQL RPC function in Supabase. The AI decides which tool to call based on the user's question, extracts parameters (project name, trade name), and formats the results.

## Demo Data

The database comes pre-loaded with realistic construction financial data:

### 3 Projects
| Code | Name | Budget | Location |
|------|------|--------|----------|
| PRJ-001 | Downtown Office Tower | $28.5M | Austin, TX |
| PRJ-002 | Riverside Medical Center | $42M | Austin, TX |
| PRJ-003 | Lakewood Elementary Renovation | $8.2M | Round Rock, TX |

### 10 Trades (CSI MasterFormat)
Concrete, Masonry, Metals, Electrical, Plumbing, HVAC, Finishes, Roofing, Fire Protection, Elevators

### 44 Budget Packages
A mix of on-budget, under-budget, and overspent packages across all 3 projects. Includes change orders, vendor commitments, and invoices for realistic financial tracking.

## Sample Questions to Try

- "How much money do I have remaining across all masonry packages?"
- "Which packages are overspent?"
- "Show me committed vs spent vs remaining for the Downtown Office Tower"
- "Give me a budget breakdown by trade for the Medical Center"
- "Drill down into the Electrical trade packages"
- "What's the total budget across all projects?"
- "How much has been paid out for HVAC?"
- "Are there any overspent items on the school renovation?"

## Setup Instructions

### Prerequisites
- Node.js 18+ (or Bun)
- A Supabase account (free tier works)
- An OpenRouter API key (pay-per-use, cheap)

### 1. Clone and install

```bash
cd 049-nextjs-supabase-ai-chat
bun install
```

### 2. Create Supabase project

1. Go to supabase.com and create a new project
2. Go to SQL Editor and run the schema file:
   - Copy contents of `supabase/schema.sql` and execute
3. Then run the seed data:
   - Copy contents of `supabase/seed.sql` and execute
4. Copy your project URL and service role key from Settings > API

### 3. Get OpenRouter API key

1. Go to openrouter.ai and sign up
2. Add credits ($5 is plenty for testing)
3. Create an API key

### 4. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### 5. Run the dev server

```bash
bun run dev
```

Open http://localhost:3000 and start asking questions.

## Database Schema Overview

9 tables with Row Level Security enabled:

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant org isolation |
| `users` | Team members with roles (owner/admin/member/viewer) |
| `projects` | Construction projects with status and contract values |
| `trades` | CSI MasterFormat trade categories |
| `packages` | Budget line items (original, changes, committed, invoiced, paid) |
| `change_orders` | Approved/pending change orders per package |
| `vendors` | Subcontractors and suppliers |
| `commitments` | POs and subcontracts against packages |
| `invoices` | Bills from vendors against commitments |
| `chat_logs` | AI conversation audit trail |

5 RPC functions handle all the aggregation logic server-side in PostgreSQL for performance and security.

## Project Structure

```
src/
  app/
    api/chat/route.ts       - API route: streams AI responses with tool calls
    components/
      ChatInterface.tsx      - Chat UI with message bubbles, sample questions
    globals.css              - Tailwind base styles
    layout.tsx               - Root layout with metadata
    page.tsx                 - Main page with header and chat
  lib/
    supabase.ts              - Server-side Supabase client factory
    tools.ts                 - 5 AI tool definitions (Zod schemas + Supabase RPC calls)
supabase/
  schema.sql                 - Full database schema with RLS and RPC functions
  seed.sql                   - 3 projects, 10 trades, 44 packages, change orders, invoices
```

## Key Design Decisions

- **Server-side only database access** - Supabase service role key stays on the server. No client-side queries.
- **RPC functions over raw queries** - All aggregation happens in PostgreSQL for performance. The AI tools call simple RPCs, not complex SQL.
- **Streaming responses** - Uses Vercel AI SDK's `streamText` for real-time response streaming.
- **Multi-tenant ready** - Everything is scoped by `org_id`. Adding auth just means resolving the org from the user's session.
- **Tool call visibility** - The chat UI shows which tool was called so users understand how data was retrieved.
- **Chat logging** - Every conversation is logged to `chat_logs` for audit and improvement.
