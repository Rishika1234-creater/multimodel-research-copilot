
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MarkdownAnswer({ content }) {
  return (
    <div className="text-sm leading-7 break-words space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-white mt-5 mb-3">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-white mt-5 mb-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-white mt-4 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-3 text-slate-200">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-300">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-4 space-y-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-4 space-y-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-1 text-slate-200">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-purple-500 pl-4 py-1 my-4 text-slate-300">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-slate-600">
              <table className="w-full text-left text-sm border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-700 text-white">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="border border-slate-600 px-4 py-3 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-600 px-4 py-3 text-slate-200 align-top">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-slate-700/40">{children}</tr>
          ),
          code: ({ children, className }) => {
            const isBlock = Boolean(className);

            return isBlock ? (
              <code className="block text-sm text-green-300">
                {children}
              </code>
            ) : (
              <code className="bg-slate-950 px-1.5 py-0.5 rounded text-purple-300">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-slate-950 rounded-lg p-4 overflow-x-auto my-4">
              {children}
            </pre>
          ),
          hr: () => <hr className="border-slate-600 my-5" />,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline hover:text-blue-300"
            >
              {children}
            </a>
          ),
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}

function ChatPanel({
  messages,
  setMessages,
  documents,
  onChatComplete,
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);

  const readyDocuments = documents.filter(
    (doc) => doc.status === "ready" && doc.backendDocumentId
  );

  const hasDocuments = readyDocuments.length > 0;

  // Scroll to the latest message whenever messages change
  useEffect(() => {
    const container = document.getElementById("chat-messages");

    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, loading]);

  function toggleCompareMode() {
    const nextMode = !compareMode;

    setCompareMode(nextMode);

    if (nextMode) {
      setSelectedDocumentIds(
        readyDocuments.map((doc) => doc.backendDocumentId)
      );
    }
  }

  function handleDocumentSelection(documentId) {
    setSelectedDocumentIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId]
    );
  }

  async function handleSend() {
    const question = input.trim();

    if (!question || !hasDocuments || loading) return;

    if (compareMode && selectedDocumentIds.length < 2) {
      alert("Please select at least two research papers to compare.");
      return;
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const endpoint = compareMode
        ? "http://localhost:8000/compare"
        : "http://localhost:8000/ask";

      const requestBody = compareMode
        ? {
            question,
            document_ids: selectedDocumentIds,
            top_k_per_document: 4,
          }
        : {
            question,
            top_k: 5,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
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

      // Refresh saved history and dashboard from SQLite
      if (onChatComplete) {
        await onChatComplete();
      }

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
    <div className="flex-1 flex flex-col h-full border-l border-slate-800 min-w-0">

      {/* Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {compareMode ? "Research Comparison" : "Ask anything"}
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              {readyDocuments.length} research papers ready
            </p>
          </div>

          <button
            onClick={toggleCompareMode}
            disabled={readyDocuments.length < 2 || loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              compareMode
                ? "bg-purple-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {compareMode ? "Exit Compare" : "Compare Papers"}
          </button>
        </div>

        {/* Document selection */}
        {compareMode && (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">
              Select research papers to compare
            </h3>

            <div className="space-y-3">
              {readyDocuments.map((doc) => (
                <label
                  key={doc.id}
                  className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDocumentIds.includes(
                      doc.backendDocumentId
                    )}
                    onChange={() =>
                      handleDocumentSelection(doc.backendDocumentId)
                    }
                    disabled={loading}
                    className="h-4 w-4 accent-purple-500"
                  />

                  <span className="break-all">{doc.name}</span>
                </label>
              ))}
            </div>

            <p className="text-xs text-slate-400 mt-3">
              {selectedDocumentIds.length} paper(s) selected.
              Select at least 2 to compare.
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        id="chat-messages"
        className="flex-1 overflow-y-auto p-5 space-y-5"
      >
        {messages.length === 0 && (
          <div className="text-center mt-16">
            <h3 className="text-xl font-semibold text-white">
              {compareMode
                ? "Compare your research papers"
                : "Welcome to Research Copilot"}
            </h3>

            <p className="text-sm text-slate-400 mt-2">
              {compareMode
                ? "Ask about differences in methodology, findings, objectives and limitations."
                : "Upload research papers and ask questions about them."}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div
              className={`max-w-[90%] min-w-0 rounded-xl p-4 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-200"
              }`}
            >
              <p className="text-xs font-semibold mb-2 opacity-70">
                {message.role === "user" ? "You" : "Research Copilot"}
              </p>

              {message.role === "assistant" ? (
                <MarkdownAnswer content={message.text} />
              ) : (
                <div className="text-sm whitespace-pre-wrap break-words leading-6">
                  {message.text}
                </div>
              )}

              {message.citations?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-600">
                  <p className="text-xs font-semibold mb-2">
                    Sources
                  </p>

                  <div className="space-y-2">
                    {message.citations.map((citation, index) => (
                      <div
                        key={`${citation.document_id || citation.filename}-${citation.page}-${index}`}
                        className="text-xs text-slate-300"
                      >
                        <span className="font-medium">
                          {citation.filename}
                        </span>
                        {" · "}
                        Page {citation.page}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="text-sm text-slate-400 animate-pulse">
            {compareMode
              ? "Analyzing and comparing research papers..."
              : "Research Copilot is thinking..."}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-5 border-t border-slate-800">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !hasDocuments
                ? "Upload a research paper first..."
                : compareMode
                ? "Ask something to compare selected papers..."
                : "Ask a question about your research papers..."
            }
            disabled={!hasDocuments || loading}
            rows={2}
            className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
          />

          <button
            onClick={handleSend}
            disabled={
              !input.trim() ||
              !hasDocuments ||
              loading ||
              (compareMode && selectedDocumentIds.length < 2)
            }
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Press Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </div>
  );
}

export default ChatPanel;
