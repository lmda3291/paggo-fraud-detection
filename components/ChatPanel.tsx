"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X, Send, Bot, User, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const DASHBOARD_QUESTIONS = [
  "Which accounts have the most suspicious activity?",
  "Show me all large transfers at night",
  "What patterns do you see?",
  "Are there any repeated suspicious destinations?",
];

const ACCOUNT_QUESTIONS = [
  "What's suspicious about this account?",
  "How does this account compare to others?",
  "What's the risk profile here?",
  "Are there any unusual patterns in this account's history?",
];

function useAccountContext() {
  const pathname = usePathname();
  const match = pathname.match(/^\/account\/(.+)$/);
  return match ? match[1] : null;
}

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [txCount, setTxCount] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const accountId = useAccountContext();
  const suggestedQuestions = accountId ? ACCOUNT_QUESTIONS : DASHBOARD_QUESTIONS;

  // Fetch transaction count for the current account
  useEffect(() => {
    if (!accountId) {
      setTxCount(null);
      return;
    }
    fetch(`/api/account/${accountId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.summary) {
          setTxCount(data.summary.totalTransactions);
        }
      })
      .catch(() => setTxCount(null));
  }, [accountId]);

  // Clear messages when switching context
  useEffect(() => {
    setMessages([]);
  }, [accountId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-chat-panel", handler);
    return () => window.removeEventListener("open-chat-panel", handler);
  }, []);

  const sendMessage = async (question: string) => {
    if (!question.trim() || streaming) return;

    const userMsg: Message = { role: "user", content: question.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.slice(-10),
          question: question.trim(),
          ...(accountId ? { currentAccountId: accountId } : {}),
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: `Error: ${parsed.error}`,
                };
                return updated;
              });
              break;
            }
            if (parsed.text) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: updated[updated.length - 1].content + parsed.text,
                };
                return updated;
              });
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, I couldn't connect to the AI service. Please check your API key.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const contextLabel = accountId
    ? `Analyzing account ${accountId}${txCount !== null ? ` \u00B7 ${txCount} transactions` : ""}`
    : "Analyzing all 7,800 transactions";

  return (
    <>
      {/* Toggle Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-50 flex items-center gap-2 px-4 py-3 bg-[#9B4A1E] hover:bg-[#5A2A0E] text-white rounded-full shadow-lg shadow-blue-500/20 transition-all hover:scale-105 cursor-pointer"
          type="button"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-sm font-medium">AI Analyst</span>
        </button>
      )}

      {/* Chat Panel */}
      <div
        className={`fixed right-0 top-0 h-full z-50 transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "420px" }}
      >
        <div className="h-full bg-[#1C1C1C] border-l border-[#2A2A2A] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2A] bg-gray-850">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#C4622A]/20 rounded-lg">
                <Bot className="w-4 h-4 text-[#C4622A]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-200">
                  Fraud Analyst AI
                </h3>
                <p className="text-[10px] text-gray-500">
                  {contextLabel}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-4 pt-4">
                <div className="text-center">
                  <div className="inline-flex p-3 bg-[#C4622A]/10 rounded-full mb-3">
                    <Sparkles className="w-6 h-6 text-[#C4622A]" />
                  </div>
                  <h4 className="text-sm font-medium text-gray-300 mb-1">
                    {accountId
                      ? `Investigating ${accountId}`
                      : "Ask me about the data"}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {accountId
                      ? "I have full context on this account's transactions, risk scores, and related activity."
                      : "Ask me anything about the data — I have full context on all transactions."}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium px-1">
                    Try asking:
                  </p>
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left px-3 py-2.5 bg-[#141414] hover:bg-gray-700 border border-[#2A2A2A] hover:border-gray-600 rounded-lg text-xs text-gray-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#C4622A]/20 flex items-center justify-center mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-[#C4622A]" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-3 py-2.5 rounded-lg text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#9B4A1E] text-white rounded-br-sm"
                      : "bg-[#141414] text-gray-300 rounded-bl-sm border border-[#2A2A2A]"
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {msg.content}
                    {streaming &&
                      i === messages.length - 1 &&
                      msg.role === "assistant" && (
                        <span className="animate-blink text-[#C4622A]">▊</span>
                      )}
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center mt-0.5">
                    <User className="w-3.5 h-3.5 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#2A2A2A]">
            <div className="flex items-end gap-2 bg-[#141414] border border-gray-600 rounded-lg p-2 focus-within:border-[#9B4A1E] transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  accountId
                    ? `Ask about ${accountId}...`
                    : "Ask about the data..."
                }
                rows={1}
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none max-h-24"
                style={{
                  height: "auto",
                  minHeight: "24px",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 96)}px`;
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || streaming}
                className="p-1.5 rounded-lg bg-[#9B4A1E] text-white hover:bg-[#5A2A0E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 text-center">
              Always verify AI findings before taking action.
            </p>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
