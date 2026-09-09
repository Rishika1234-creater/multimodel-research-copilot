# 🧠 Multimodel Research Copilot

> An AI-powered research assistant that reads, understands, and reasons across multiple research papers — not just searches them.

Upload multiple research papers (PDFs) and ask questions like *"Compare the ML models used in the diabetes paper and the heart disease paper"* — the system reasons across documents, retrieves only the relevant sections, verifies its own answer against the source text, and cites exactly where each claim came from.

---

## 📌 Why This Project Exists

Most "chat with your PDF" tools break down the moment you ask a question that spans **multiple documents**. A plain RAG (Retrieval-Augmented Generation) pipeline retrieves the top-k most "similar" chunks — but for a comparison question across two papers, that often means it pulls 4 chunks from one paper and 1 from the other, giving you a lopsided, incomplete answer.

**Multimodel Research Copilot** solves this with an **agentic retrieval pipeline** that:
1. Understands *what kind* of question is being asked (single-document vs. multi-document/comparison)
2. Breaks complex questions into per-document sub-questions
3. Retrieves relevant context **separately per document**
4. Self-checks whether retrieval was sufficient — and retries with reformulated queries if not
5. Generates an answer strictly grounded in retrieved text, with citations
6. Verifies the final answer against the source chunks to catch hallucinations before showing it to you

---

## ✨ Key Features

- 📄 **Multi-PDF upload** — upload any number of research papers at once
- 🧩 **Layout-aware parsing** — correctly handles two-column academic PDF layouts and section structure (Abstract, Methods, Results, Conclusion)
- 🔍 **Semantic + section-aware chunking** — chunks respect document structure instead of arbitrary character splits
- 🤖 **Agentic query planning** — automatically detects comparison questions and decomposes them into sub-questions
- 🗂️ **Per-document retrieval** — ensures balanced, relevant context from *every* referenced document, not just the highest-scoring one
- ✅ **Self-verification step** — cross-checks retrieval sufficiency and re-queries if the context is weak
- 🔗 **Grounded citations** — every claim in the answer links back to the exact paper, section, and page it came from
- 🛡️ **Hallucination check** — final answer is validated against retrieved chunks before being returned
- 📊 **Structured comparison output** — key findings (models, datasets, metrics) can be extracted into a comparison table, not just prose
- 🌐 **Full-stack, deployed application** — live, usable product, not just a notebook

---

## 🏗️ How It Works — Pipeline Overview

```
 ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
 │  PDF Upload │ --> │  Parsing &   │ --> │   Chunking +   │
 │             │     │  Extraction  │     │   Embeddings   │
 └─────────────┘     └──────────────┘     └───────┬───────┘
                                                    │
                                                    ▼
                                          ┌───────────────────┐
                                          │   Vector Database  │
                                          │  (Qdrant / Chroma) │
                                          └─────────┬─────────┘
                                                    │
User Question ──────────────────────────────────►  │
                                                    ▼
                                        ┌────────────────────────┐
                                        │   Agent: Query Planner  │
                                        │  (decompose if multi-doc)│
                                        └───────────┬────────────┘
                                                    │
                                                    ▼
                                        ┌────────────────────────┐
                                        │  Per-Document Retrieval │
                                        │  + Sufficiency Check    │
                                        └───────────┬────────────┘
                                                    │
                                                    ▼
                                        ┌────────────────────────┐
                                        │   LLM Answer Generation │
                                        │   (grounded + cited)    │
                                        └───────────┬────────────┘
                                                    │
                                                    ▼
                                        ┌────────────────────────┐
                                        │  Hallucination Check    │
                                        │  (answer vs. source)    │
                                        └───────────┬────────────┘
                                                    │
                                                    ▼
                                          ┌────────────────────┐
                                          │  Final Cited Answer │
                                          │   (shown in React)  │
                                          └────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React (Vite) + Tailwind CSS | Upload interface, chat UI, citation display |
| **Backend** | FastAPI (Python) | Orchestrates the entire pipeline |
| **PDF Parsing** | PyMuPDF (`fitz`) | Layout-aware text extraction from academic PDFs |
| **Embeddings** | OpenAI `text-embedding-3-small` / BAAI `bge` (via `sentence-transformers`) | Converts text chunks into semantic vectors |
| **Vector Database** | Qdrant (or Chroma for local dev) | Stores and searches chunk embeddings by meaning |
| **Agent / Orchestration** | Custom Python logic | Query decomposition, retrieval planning, self-checking |
| **LLM** | Claude API / OpenAI API | Final answer generation with grounded citations |
| **Relational DB** | PostgreSQL | Stores chat history, uploaded document metadata |
| **Deployment** | Vercel (frontend), Render/Railway (backend), Qdrant Cloud (vector DB) | Live, publicly accessible deployment |

---

## 📂 Project Structure

```
multimodel-research-copilot/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI entrypoint
│   │   ├── parsing/                # PDF parsing & section extraction
│   │   ├── chunking/               # Section-aware chunking logic
│   │   ├── embeddings/             # Embedding generation
│   │   ├── retrieval/              # Vector search + per-document retrieval
│   │   ├── agent/                  # Query planning, decomposition, self-check
│   │   ├── generation/             # LLM prompt + citation handling
│   │   ├── verification/           # Hallucination / grounding check
│   │   └── db/                     # PostgreSQL models
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/             # Upload, Chat, Citation viewer
│   │   ├── pages/
│   │   └── App.jsx
│   ├── package.json
│   └── .env.example
├── evaluation/
│   ├── test_questions.json         # Sample Q&A set for evaluating retrieval/answer quality
│   └── run_eval.py
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- A Qdrant instance (local via Docker, or Qdrant Cloud free tier)
- API key for Claude or OpenAI

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/multimodel-research-copilot.git
cd multimodel-research-copilot
```

### 2. Backend setup
```bash
cd backend
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # Add your API keys and Qdrant URL here
uvicorn app.main:app --reload
```

### 3. Frontend setup
```bash
cd frontend
npm install
cp .env.example .env          # Add backend API URL here
npm run dev
```

### 4. Open the app
Visit `http://localhost:5173` in your browser.

---

## 📊 Evaluation

This project includes a small evaluation harness (`evaluation/`) to measure:
- **Retrieval precision** — are the retrieved chunks actually relevant?
- **Citation accuracy** — do citations point to the correct source?
- **Answer groundedness** — does every claim in the answer trace back to retrieved text?

Run it with:
```bash
python evaluation/run_eval.py
```

---

## 🗺️ Roadmap

- [ ] Multi-PDF upload and parsing
- [ ] Section-aware chunking
- [ ] Vector database integration
- [ ] Agentic query decomposition for multi-document questions
- [ ] Per-document retrieval with sufficiency checking
- [ ] Grounded answer generation with citations
- [ ] Hallucination verification step
- [ ] Structured comparison table extraction
- [ ] Evaluation dashboard
- [ ] Full deployment (frontend + backend + vector DB)

---

## 🧑‍💻 Author

Built by **Rishika Sinha** 

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.