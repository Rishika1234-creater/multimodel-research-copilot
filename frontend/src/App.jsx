
import { useState, useEffect, useCallback } from "react";
import Navbar from "./components/Navbar";
import UploadPanel from "./components/UploadPanel";
import ChatPanel from "./components/ChatPanel";

const API = "http://localhost:8000";

function App() {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);

  const [dashboard, setDashboard] = useState({
    total_papers: 0,
    ready_papers: 0,
    total_pages: 0,
    total_messages: 0,
  });

  const [activePage, setActivePage] = useState("Dashboard");
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const readyDocuments = documents.filter(
    (doc) => doc.status === "ready"
  );

  const loadData = useCallback(async () => {
    try {
      setLoadError("");

      const [
        documentsResponse,
        historyResponse,
        dashboardResponse,
      ] = await Promise.all([
        fetch(`${API}/documents`),
        fetch(`${API}/history`),
        fetch(`${API}/dashboard`),
      ]);

      if (
        !documentsResponse.ok ||
        !historyResponse.ok ||
        !dashboardResponse.ok
      ) {
        throw new Error("Could not load workspace data");
      }

      const documentsData = await documentsResponse.json();
      const historyData = await historyResponse.json();
      const dashboardData = await dashboardResponse.json();

      const formattedDocuments = (
        documentsData.documents || []
      ).map((doc) => ({
        id: doc.document_id,
        backendDocumentId: doc.document_id,
        name: doc.filename,
        pageCount: doc.page_count,
        chunkCount: doc.chunk_count,
        status: doc.status || "ready",
        uploadedAt: doc.uploaded_at,
      }));

      setDocuments(formattedDocuments);
      setConversations(historyData.history || []);
      setDashboard(dashboardData);

    } catch (error) {
      console.error("Workspace loading error:", error);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const navigation = [
    { name: "Dashboard", icon: "▦" },
    { name: "Library", icon: "▤" },
    { name: "Research Chat", icon: "✧" },
    { name: "History", icon: "◷" },
  ];

  function openChat() {
    setActivePage("Research Chat");
  }

  // Start a fresh chat
  function startNewChat() {
    setMessages([]);
    setSelectedChatId(null);
    setActivePage("Research Chat");
  }

  // Reopen a saved question and answer
  function openSavedChat(chat) {
    const savedMessages = [
      {
        id: `user-${chat.id}`,
        role: "user",
        text: chat.question,
      },
      {
        id: `assistant-${chat.id}`,
        role: "assistant",
        text: chat.answer,
        citations: chat.sources || [],
      },
    ];

    setMessages(savedMessages);
    setSelectedChatId(chat.id);
    setActivePage("Research Chat");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <Navbar />

      <div className="flex flex-1 min-h-0">

        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950 p-5">
          <div className="mb-8">
            <h2 className="text-xl font-bold">
              Research Copilot
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              AI-powered research workspace
            </p>
          </div>

          <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">
            Workspace
          </p>

          <nav className="space-y-2">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => setActivePage(item.name)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition ${
                  activePage === item.name
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.name}
              </button>
            ))}
          </nav>

          <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm font-semibold">
              Your Workspace
            </p>

            <p className="text-xs text-slate-400 mt-2">
              {readyDocuments.length} research papers available
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">

          {loading ? (
            <div className="p-8 text-slate-400">
              Loading your research workspace...
            </div>
          ) : loadError ? (
            <div className="p-8">
              <p className="text-red-400">{loadError}</p>

              <button
                onClick={loadData}
                className="mt-4 bg-blue-600 px-4 py-2 rounded-lg"
              >
                Retry
              </button>
            </div>
          ) : (
            <>

              {/* Dashboard */}
              {activePage === "Dashboard" && (
                <div className="p-8">
                  <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                    <div>
                      <h1 className="text-3xl font-bold">
                        Dashboard
                      </h1>

                      <p className="text-slate-400 mt-2">
                        Welcome to your research workspace.
                      </p>
                    </div>

                    <button
                      onClick={startNewChat}
                      className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-lg text-sm font-semibold"
                    >
                      + Start Research
                    </button>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                    {[
                      {
                        label: "Total Papers",
                        value: dashboard.total_papers,
                        icon: "▤",
                      },
                      {
                        label: "Ready Papers",
                        value: dashboard.ready_papers,
                        icon: "✓",
                      },
                      {
                        label: "Total Pages",
                        value: dashboard.total_pages,
                        icon: "▧",
                      },
                      {
                        label: "Chat Messages",
                        value: dashboard.total_messages,
                        icon: "✧",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                      >
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-slate-400">
                            {stat.label}
                          </p>

                          <span className="text-blue-400 text-xl">
                            {stat.icon}
                          </span>
                        </div>

                        <h2 className="text-3xl font-bold mt-4">
                          {stat.value}
                        </h2>
                      </div>
                    ))}
                  </div>

                  {/* Quick Actions */}
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">
                      Quick Actions
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {[
                        {
                          icon: "📄",
                          title: "Upload Research Paper",
                          description: "Add a PDF to your research library.",
                        },
                        {
                          icon: "✧",
                          title: "Ask AI",
                          description: "Ask questions about your research papers.",
                        },
                        {
                          icon: "⇄",
                          title: "Compare Papers",
                          description: "Compare multiple research papers.",
                        },
                      ].map((action) => (
                        <button
                          key={action.title}
                          onClick={openChat}
                          className="text-left rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 p-6 transition"
                        >
                          <span className="text-2xl">
                            {action.icon}
                          </span>

                          <h3 className="font-semibold mt-4">
                            {action.title}
                          </h3>

                          <p className="text-sm text-slate-400 mt-2">
                            {action.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recent Documents */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                    <div className="flex justify-between items-center mb-5">
                      <h2 className="text-xl font-semibold">
                        Recent Research Papers
                      </h2>

                      <button
                        onClick={() => setActivePage("Library")}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        View Library →
                      </button>
                    </div>

                    {documents.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No research papers uploaded yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {documents.slice(-5).reverse().map((doc) => (
                          <div
                            key={doc.id}
                            className="flex justify-between items-center gap-4 border-b border-slate-800 pb-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {doc.name}
                              </p>

                              <p className="text-xs text-slate-500 mt-1">
                                {doc.pageCount || 0} pages
                              </p>
                            </div>

                            <span className="text-xs text-green-400">
                              {doc.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Library */}
              {activePage === "Library" && (
                <div className="p-8">
                  <h1 className="text-3xl font-bold">
                    Research Library
                  </h1>

                  <p className="text-slate-400 mt-2 mb-8">
                    Manage all your uploaded research papers.
                  </p>

                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-lg font-semibold">
                        All Documents ({documents.length})
                      </h2>

                      <button
                        onClick={openChat}
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm"
                      >
                        + Upload PDF
                      </button>
                    </div>

                    {documents.length === 0 ? (
                      <div className="text-center py-16">
                        <p className="text-4xl mb-4">📚</p>

                        <h3 className="font-semibold">
                          Your library is empty
                        </h3>

                        <p className="text-sm text-slate-400 mt-2">
                          Upload your first research paper to get started.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="border border-slate-800 rounded-lg p-4 flex flex-wrap justify-between items-center gap-4"
                          >
                            <div className="min-w-0">
                              <h3 className="font-medium break-all">
                                📄 {doc.name}
                              </h3>

                              <p className="text-xs text-slate-400 mt-2">
                                {doc.pageCount || 0} pages
                                {" · "}
                                {doc.chunkCount || 0} chunks
                              </p>

                              <p className="text-xs text-slate-500 mt-1 break-all">
                                ID: {doc.backendDocumentId}
                              </p>

                              {doc.uploadedAt && (
                                <p className="text-xs text-slate-500 mt-1">
                                  Uploaded: {doc.uploadedAt}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-xs text-green-400">
                                {doc.status}
                              </span>

                              <button
                                onClick={openChat}
                                className="text-sm text-blue-400 hover:text-blue-300"
                              >
                                Open Chat →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Research Chat */}
              {activePage === "Research Chat" && (
                <div className="flex h-[calc(100vh-65px)] min-h-[600px]">
                  <div className="w-96 shrink-0 border-r border-slate-800 overflow-y-auto">
                    <UploadPanel
                      documents={documents}
                      setDocuments={setDocuments}
                      onUploadComplete={loadData}
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="p-3 border-b border-slate-800 flex justify-between items-center">
                      <p className="text-xs text-slate-400">
                        {selectedChatId
                          ? "Viewing saved conversation"
                          : "New research session"}
                      </p>

                      <button
                        onClick={startNewChat}
                        className="text-sm bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg"
                      >
                        + New Chat
                      </button>
                    </div>

                    <ChatPanel
                      messages={messages}
                      setMessages={setMessages}
                      documents={documents}
                      onChatComplete={loadData}
                    />
                  </div>
                </div>
              )}

              {/* History */}
              {activePage === "History" && (
                <div className="p-8">
                  <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                    <div>
                      <h1 className="text-3xl font-bold">
                        Research History
                      </h1>

                      <p className="text-slate-400 mt-2">
                        Reopen your previously saved research conversations.
                      </p>
                    </div>

                    <button
                      onClick={startNewChat}
                      className="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-lg text-sm font-semibold"
                    >
                      + New Chat
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                    <h2 className="text-lg font-semibold mb-5">
                      Saved Conversations ({conversations.length})
                    </h2>

                    {conversations.length === 0 ? (
                      <div className="text-center py-16">
                        <p className="text-4xl mb-4">◷</p>

                        <h3 className="font-semibold">
                          No conversation yet
                        </h3>

                        <p className="text-sm text-slate-400 mt-2">
                          Your research questions will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {conversations.map((chat) => (
                          <button
                            key={chat.id}
                            onClick={() => openSavedChat(chat)}
                            className="w-full text-left border border-slate-700 hover:border-blue-500 bg-slate-800/60 hover:bg-slate-800 rounded-xl p-5 transition"
                          >
                            <div className="flex justify-between items-center gap-3 mb-3">
                              <span className="text-xs text-blue-400 font-semibold">
                                {chat.chat_type === "comparison"
                                  ? "PAPER COMPARISON"
                                  : "RESEARCH QUESTION"}
                              </span>

                              <span className="text-xs text-slate-500">
                                {chat.created_at
                                  ? new Date(chat.created_at).toLocaleString()
                                  : ""}
                              </span>
                            </div>

                            <p className="text-sm font-semibold text-white mb-2">
                              {chat.question}
                            </p>

                            <p className="text-sm text-slate-400 line-clamp-2">
                              {chat.answer}
                            </p>

                            <div className="flex justify-between items-center mt-4">
                              <span className="text-xs text-slate-500">
                                {chat.sources?.length || 0} sources
                              </span>

                              <span className="text-sm text-blue-400">
                                Reopen Chat →
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
