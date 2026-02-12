import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { financeTools } from "@/lib/tools";
import { createServerSupabase, DEMO_ORG_ID } from "@/lib/supabase";

// OpenRouter as the LLM provider (OpenAI-compatible API)
const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

const SYSTEM_PROMPT = `You are a construction finance AI assistant for Apex Construction Group. You help project managers and finance teams understand their budget data by querying the database using your available tools.

You have access to data for the following projects:
- PRJ-001: Downtown Office Tower ($28.5M) - 18-story office building in Austin, TX
- PRJ-002: Riverside Medical Center ($42M) - Hospital facility in Austin, TX
- PRJ-003: Lakewood Elementary Renovation ($8.2M) - School renovation in Round Rock, TX

Available trades: Concrete, Masonry, Metals, Electrical, Plumbing, HVAC, Finishes, Roofing, Fire Protection, Elevators

Key terminology:
- Original Budget: Initial budgeted amount
- Approved Changes: Sum of approved change orders
- Revised Budget: Original + Approved Changes
- Committed: Amount contracted via POs/subcontracts
- Invoiced: Amount billed by vendors/subs
- Paid: Amount actually paid out
- Remaining: Revised Budget minus Committed (uncommitted funds)
- Overspent: When Committed exceeds Revised Budget

Guidelines:
- Always use the tools to get real data. Never make up numbers.
- Present financial data in clear tables when showing multiple rows.
- When showing currency, use the formatted values from tool results.
- If a question is ambiguous, ask for clarification (which project? which trade?).
- Highlight overspent items as warnings.
- Be concise but thorough. Construction PMs are busy.
- When asked about "remaining money" or "how much is left", use the remaining column (revised budget - committed).`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openrouter("anthropic/claude-sonnet-4"),
    system: SYSTEM_PROMPT,
    messages,
    tools: financeTools,
    maxSteps: 5,
    onFinish: async ({ text, toolCalls }) => {
      // Log the conversation to Supabase
      try {
        const supabase = createServerSupabase();
        const lastUserMessage = messages
          .filter((m: { role: string }) => m.role === "user")
          .pop();

        await supabase.from("chat_logs").insert({
          org_id: DEMO_ORG_ID,
          question: lastUserMessage?.content ?? "",
          tool_calls: toolCalls ?? [],
          response: text,
          model: "anthropic/claude-sonnet-4",
        });
      } catch {
        // Non-blocking: don't fail the response if logging fails
        console.error("Failed to log chat");
      }
    },
  });

  return result.toDataStreamResponse();
}
