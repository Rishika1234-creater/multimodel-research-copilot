import { useState } from "react";
import Navbar from "./components/Navbar";
import UploadPanel from "./components/UploadPanel";
import ChatPanel from "./components/ChatPanel";

function App() {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <div className="w-96 border-r border-slate-800">
          <UploadPanel documents={documents} setDocuments={setDocuments} />
        </div>
        <ChatPanel messages={messages} setMessages={setMessages} documents={documents} />
      </div>
    </div>
  );
}

export default App;