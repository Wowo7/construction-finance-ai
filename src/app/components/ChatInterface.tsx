"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState } from "react";

const SAMPLE_QUESTIONS = [
  "How much money do I have remaining across all masonry packages?",
  "Which packages are overspent?",
  "Show me committed vs spent vs remaining for the Downtown Office Tower",
  "Give me a budget breakdown by trade for the Medical Center",
  "Drill down into the Electrical trade packages",
];

export default function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({ api: "/api/chat" });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  const handleSampleClick = (question: string) => {
    handleInputChange({
      target: { value: question },
    } as React.ChangeEvent<HTMLInputElement>);
    // Submit after setting value
    setTimeout(() => {
      const form = document.querySelector("form");
      form?.requestSubmit();
    }, 50);
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🏗️</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Construction Finance Assistant
            </h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Ask questions about your project budgets, trades, and financial
              status in plain English.
            </p>
            <div className="grid gap-2 max-w-lg mx-auto">
              {SAMPLE_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSampleClick(q)}
                  className="text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-gray-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.role === "assistant" && m.parts ? (
                <div className="space-y-2">
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <div
                          key={i}
                          className="whitespace-pre-wrap text-sm leading-relaxed prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: formatMarkdown(part.text),
                          }}
                        />
                      );
                    }
                    if (part.type === "tool-invocation") {
                      return (
                        <div
                          key={i}
                          className="my-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs"
                        >
                          <span className="font-mono text-amber-700">
                            ⚡ Querying: {part.toolInvocation.toolName}
                          </span>
                          {part.toolInvocation.state === "result" && (
                            <span className="ml-2 text-green-600">
                              ✓ Done
                            </span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {m.content}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 px-4 py-4 bg-white">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about your construction finances..."
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2 text-center">
          AI assistant queries your Supabase database securely via server-side
          tool calls
        </p>
      </div>
    </div>
  );
}

// Simple markdown-to-HTML for tables and bold
function formatMarkdown(text: string): string {
  // Convert markdown tables
  const lines = text.split("\n");
  let html = "";
  let inTable = false;
  let headerDone = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (trimmed.replace(/[|\-\s]/g, "") === "") {
        // Separator row
        headerDone = true;
        continue;
      }

      if (!inTable) {
        html += '<table class="min-w-full text-xs border-collapse my-2">';
        inTable = true;
        headerDone = false;
      }

      const cells = trimmed
        .split("|")
        .filter((c) => c.trim() !== "")
        .map((c) => c.trim());
      const tag = !headerDone ? "th" : "td";
      const bgClass = !headerDone ? ' class="bg-gray-200 font-semibold"' : "";

      html += `<tr${bgClass}>`;
      for (const cell of cells) {
        const align = /^\$|^\d/.test(cell) || cell.endsWith("%")
          ? ' class="text-right px-2 py-1 border border-gray-300"'
          : ' class="px-2 py-1 border border-gray-300"';
        html += `<${tag}${align}>${cell}</${tag}>`;
      }
      html += "</tr>";

      if (!headerDone) headerDone = true;
    } else {
      if (inTable) {
        html += "</table>";
        inTable = false;
        headerDone = false;
      }
      // Bold
      const processed = trimmed
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/⚠️/g, '<span class="text-amber-500">&#9888;&#65039;</span>');
      html += processed ? `<p class="my-1">${processed}</p>` : "<br/>";
    }
  }

  if (inTable) html += "</table>";
  return html;
}
