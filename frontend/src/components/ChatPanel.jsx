
import { useState } from "react";

function ChatPanel({ messages, setMessages, documents }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const hasDocuments = documents.length > 0;

  async function handleSend() {
    const question = input.trim();

    if (!question || !hasDocuments || loading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question,
          top_k: 5,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Something went wrong");
      }

      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.answer,
        citations: data.sources || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: `Error: ${error.message}`,
        citations: [],
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full border-l border-slate-800">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div>
          <h2 className="font-semibold text-white text-lg">
            Ask anything
          </h2>

          <p className="text-sm text-slate-500">
            {hasDocuments
              ? `${documents.length} paper(s) loaded`
              : "Upload a paper to begin"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center mb-4">
              <span className="text-slate-500 text-lg">⏱</span>
            </div>

            <p className="font-medium text-slate-300">
              {hasDocuments ? "No questions yet" : "No paper loaded"}
            </p>

            <p className="text-sm text-slate-500">
              {hasDocuments
                ? "Ask something to get started"
                : "Upload a PDF to start asking questions"}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            <div
              className={`max-w-2xl rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-indigo-600 ml-auto text-white"
                  : "bg-slate-800 border border-slate-700 text-slate-100"
              }`}
            >
              {msg.text}
            </div>

            {msg.role === "assistant" &&
              msg.citations?.length > 0 && (
                <div className="mt-2 ml-2 max-w-2xl">
                  <p className="text-xs text-slate-400 mb-2">
                    Sources
                  </p>

                  {msg.citations.map((source, index) => (
                    <div
                      key={index}
                      className="text-xs text-slate-400 mb-1"
                    >
                      {source.filename} · Page {source.page}
                    </div>
                  ))}
                </div>
              )}
          </div>
        ))}

        {loading && (
          <div className="max-w-2xl bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-400">
            Research Copilot is thinking...
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 p-4">
        <div className="flex gap-2 items-end bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 focus-within:border-indigo-500 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!hasDocuments || loading}
            rows={1}
            placeholder={
              hasDocuments
                ? "Ask something about your papers..."
                : "Upload a paper first to start asking questions"
            }
            className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder:text-slate-600 disabled:cursor-not-allowed"
          />

          <button
            onClick={handleSend}
            disabled={!hasDocuments || loading || !input.trim()}
            className="text-indigo-400 hover:text-indigo-300 disabled:text-slate-700 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "..." : "→"}
          </button>
        </div>

        <p className="text-sm text-slate-500 mt-2">
          Enter ↵ to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

export default ChatPanel;
