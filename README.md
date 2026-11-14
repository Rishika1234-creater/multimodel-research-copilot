# 🧠 Multimodel Research Copilot

> An AI-powered research assistant that reads, understands, and reasons across multiple research papers — not just searches them.

Upload multiple research papers (PDFs) and ask questions like *"Compare the ML models used in the diabetes paper and the heart disease paper"* — the system reasons across documents, retrieves only the relevant sections, verifies its own answer against the source text, and cites exactly where each claim came from.

---

## 📌 Why This Project Exists

Research papers often contain valuable information, but analyzing multiple papers manually can be time-consuming and challenging. Finding specific information, understanding different research approaches, and comparing results across multiple documents requires switching between PDFs and searching through lengthy content.

Most basic PDF chat applications focus on answering questions from individual documents and may not provide a convenient way to explore information across multiple research papers.

**MultiModel Research Copilot** was developed to address this problem by bringing document processing, semantic search, AI-powered question answering, and multi-document comparison into a single application.

The goal is to help users interact with research papers more efficiently by uploading multiple PDFs, asking questions in natural language, retrieving relevant information, and comparing findings across documents using AI.


---

## ✨ Key Features

### 📄 1. Multi-PDF Upload
- Upload multiple research papers in PDF format.
- Extract text from uploaded PDF documents.
- Generate document IDs and store document metadata.
- Track uploaded papers in the Library.

### 🔍 2. Semantic Search
- Generate vector embeddings from document chunks.
- Use Gemini Embeddings to represent document content semantically.
- Retrieve relevant chunks based on the user's question.
- Find contextually relevant information instead of relying only on keyword matching.

### 🤖 3. AI-Powered Research Q&A
- Ask natural-language questions about uploaded research papers.
- Retrieve relevant document context.
- Generate answers using Gemini 2.5 Flash.
- Display answers in a formatted chat interface.

### 🔄 4. Multi-PDF Comparison
- Select multiple research papers.
- Ask questions that require comparing information across documents.
- Retrieve relevant chunks separately for selected documents.
- Generate comparison-based answers with source information.

### 📚 5. Research History
- Store questions and generated answers in SQLite.
- Save document references and source information.
- Reopen previously saved research questions and answers.
- Start a new research chat whenever needed.

### 📊 6. Dashboard
- View total uploaded papers.
- Track ready documents.
- View total pages and saved research interactions.
- Access the document library and research history.

---

## 🏗️ How It Works — Pipeline Overview

The application follows a full-stack architecture:

```text
             USER
               |
               ▼
       React Frontend
               |
               ▼
        FastAPI Backend
               |
       ┌───────┴────────┐
       |                |
       ▼                ▼
   PDF Upload       User Question
       |                |
       ▼                ▼
  Text Extraction   Query Processing
       |                |
       ▼                ▼
     Chunking      Semantic Search
       |                |
       ▼                ▼
 Gemini Embeddings  Relevant Chunks
       |                |
       ▼                ▼
 Local Embeddings    Gemini 2.5 Flash
    Storage              |
                         ▼
                  Generated Answer
                         |
                         ▼
                  SQLite History
                         |
                         ▼
                   React UI

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React.js, Vite | User interface and research chat |
| **Styling** | Tailwind CSS | Responsive UI and styling |
| **Backend** | Python, FastAPI | API development and application logic |
| **PDF Processing** | PyMuPDF | Extracting text from PDF papers |
| **Embeddings** | Gemini `gemini-embedding-001` | Semantic representation of document chunks |
| **LLM** | Gemini 2.5 Flash | AI-powered answer generation |
| **Vector Storage** | Local JSON | Storing document embeddings |
| **Database** | SQLite | Document metadata and chat history |
| **API Testing** | Swagger UI | Testing backend endpoints |
| **Version Control** | Git and GitHub | Source code management |

---

## 📂 Project Structure

```text
multimodel-research-copilot/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   └── database.py
│   │
│   ├── storage/
│   │   ├── embeddings.json
│   │   └── research_copilot.db
│   │
│   ├── requirements.txt
│   ├── .env
│   └── venv/
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── UploadPanel.jsx
│       │   └── ChatPanel.jsx
│       └── App.jsx
│
├── .gitignore
└── README.md

---

### Prerequisites

- Python 3.10+
- Node.js and npm
- Gemini API key

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/multimodel-research-copilot.git
cd multimodel-research-copilot
```

### 2. Backend Setup

Open a terminal:

```powershell
cd backend

python -m venv venv

.\venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

Create a `.env` file inside the `backend` directory and add your Gemini API key using the environment variable name expected by the backend code:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the FastAPI server:

```bash
uvicorn app.main:app --reload
```

- **Backend runs at:** `http://127.0.0.1:8000`
- **Swagger API documentation:** `http://127.0.0.1:8000/docs`

### 3. Frontend Setup

Open a second terminal:

```bash
cd frontend

npm install

npm run dev
```

### 4. Open the Application

Visit:

`http://localhost:5173`

---

## 🔌 Main API Endpoints

| **Endpoint** | **Method** | **Purpose** |
|---|---|---|
| `/upload` | `POST` | Upload and process PDF documents |
| `/search` | `POST` | Perform semantic search |
| `/ask` | `POST` | Ask questions about research papers |
| `/compare` | `POST` | Compare multiple research papers |
| `/documents` | `GET` | Retrieve uploaded documents |
| `/history` | `GET` | Retrieve saved research history |
| `/dashboard` | `GET` | Retrieve dashboard statistics |

---

## 🔮 Future Improvements

Potential improvements for future versions:

- Advanced agentic query planning and decomposition.
- Retrieval sufficiency checking and query reformulation.
- More advanced PDF layout and section-aware parsing.
- Improved citation accuracy with page and section references.
- Answer-grounding and hallucination verification.
- Structured comparison tables for research findings.
- Evaluation framework for retrieval and answer quality.
- Cloud deployment for public access.

---

## 🎯 Project Objective

The goal of **MultiModel Research Copilot** is to simplify research paper analysis by combining document processing, semantic retrieval, and AI-powered question answering in one application.

Instead of manually searching through multiple research papers, users can upload documents, ask questions, and explore comparisons through a unified interface.

---

**Built with React, FastAPI, Python, SQLite, and Google Gemini.**

## 🧑‍💻 Author

Built by **Rishika Sinha** 

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
