
import json
import math
import uuid
import urllib.request
import urllib.error
import time
from pathlib import Path

import pymupdf
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.database import (
    initialize_database,
    save_document,
    save_chat,
    get_all_documents,
    get_all_chats,
    get_dashboard_stats
)


app = FastAPI()


@app.on_event("startup")
def startup_event():
    initialize_database()
    print("SQLite database initialized successfully!")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Load Gemini API key
def get_api_key():
    env_path = Path(__file__).resolve().parent.parent / ".env"

    if not env_path.exists():
        raise RuntimeError("backend/.env file was not found")

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()

        if line.startswith("GEMINI_API_KEY="):
            key = line.split("=", 1)[1].strip().strip('"').strip("'")

            if key:
                return key

    raise RuntimeError("GEMINI_API_KEY is missing")


# Request models
class SearchRequest(BaseModel):
    question: str
    top_k: int = 5


class CompareRequest(BaseModel):
    question: str
    document_ids: list[str]
    top_k_per_document: int = 4


# Divide PDF text into chunks
def create_chunks(pages, chunk_size=1000, overlap=200):
    chunks = []

    for page_number, page_text in enumerate(pages, start=1):
        text = page_text.strip()
        start = 0

        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk_text = text[start:end].strip()

            if chunk_text:
                chunks.append({
                    "chunk_id": len(chunks) + 1,
                    "page": page_number,
                    "text": chunk_text
                })

            if end == len(text):
                break

            start = end - overlap

    return chunks


# Generate document embeddings
def create_embeddings(chunks, api_key):
    all_embeddings = []

    url = (
        "https://generativelanguage.googleapis.com/"
        "v1beta/models/gemini-embedding-001:batchEmbedContents"
    )

    for start in range(0, len(chunks), 20):
        batch = chunks[start:start + 20]
        requests_data = []

        for chunk in batch:
            requests_data.append({
                "model": "models/gemini-embedding-001",
                "content": {
                    "parts": [{"text": chunk["text"]}]
                },
                "taskType": "RETRIEVAL_DOCUMENT",
                "outputDimensionality": 768
            })

        payload = json.dumps({
            "requests": requests_data
        }).encode("utf-8")

        request = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                result = json.loads(response.read().decode("utf-8"))

        except urllib.error.HTTPError as error:
            raise RuntimeError(
                f"Gemini API error ({error.code}): "
                f"{error.read().decode('utf-8', errors='replace')}"
            )

        except urllib.error.URLError as error:
            raise RuntimeError(f"Network error: {error.reason}")

        returned_embeddings = result.get("embeddings", [])

        if len(returned_embeddings) != len(batch):
            raise RuntimeError("Unexpected number of embeddings returned")

        for chunk, embedding_result in zip(batch, returned_embeddings):
            vector = embedding_result["values"]

            if len(vector) != 768:
                raise RuntimeError("Embedding dimension mismatch")

            magnitude = math.sqrt(sum(value * value for value in vector))

            if magnitude:
                vector = [value / magnitude for value in vector]

            all_embeddings.append({
                **chunk,
                "embedding": vector
            })

    return all_embeddings


# Generate embedding for user's question
def create_query_embedding(question, api_key):
    url = (
        "https://generativelanguage.googleapis.com/"
        "v1beta/models/gemini-embedding-001:embedContent"
    )

    payload = {
        "model": "models/gemini-embedding-001",
        "content": {
            "parts": [{"text": question}]
        },
        "taskType": "RETRIEVAL_QUERY",
        "outputDimensionality": 768
    }

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))

    except urllib.error.HTTPError as error:
        raise RuntimeError(
            f"Gemini API error ({error.code}): "
            f"{error.read().decode('utf-8', errors='replace')}"
        )

    except urllib.error.URLError as error:
        raise RuntimeError(f"Network error: {error.reason}")

    vector = result["embedding"]["values"]

    if len(vector) != 768:
        raise RuntimeError("Query embedding dimension mismatch")

    magnitude = math.sqrt(sum(value * value for value in vector))

    if magnitude:
        vector = [value / magnitude for value in vector]

    return vector


# Calculate cosine similarity
def cosine_similarity(vector1, vector2):
    if len(vector1) != len(vector2):
        raise ValueError("Embedding dimensions do not match")

    return sum(a * b for a, b in zip(vector1, vector2))


# Search relevant chunks across all uploaded documents
def search_relevant_chunks(question, top_k=5):
    storage_file = (
        Path(__file__).resolve().parent.parent
        / "storage"
        / "embeddings.json"
    )

    if not storage_file.exists():
        raise RuntimeError("No stored embeddings found")

    saved_documents = json.loads(
        storage_file.read_text(encoding="utf-8")
    )

    if not saved_documents:
        raise RuntimeError("No documents uploaded yet")

    api_key = get_api_key()
    query_vector = create_query_embedding(question, api_key)
    results = []

    for document in saved_documents:
        for chunk in document["chunks"]:
            score = cosine_similarity(
                query_vector,
                chunk["embedding"]
            )

            results.append({
                "document_id": document["document_id"],
                "filename": document["filename"],
                "page": chunk["page"],
                "chunk_id": chunk["chunk_id"],
                "text": chunk["text"],
                "similarity_score": round(score, 4)
            })

    results.sort(
        key=lambda item: item["similarity_score"],
        reverse=True
    )

    return results[:top_k]


# Retrieve relevant chunks separately from each selected PDF
def search_comparison_chunks(question, document_ids, top_k_per_document=4):
    storage_file = (
        Path(__file__).resolve().parent.parent
        / "storage"
        / "embeddings.json"
    )

    if not storage_file.exists():
        raise RuntimeError("No stored embeddings found")

    saved_documents = json.loads(
        storage_file.read_text(encoding="utf-8")
    )

    selected_documents = [
        document
        for document in saved_documents
        if document.get("document_id") in document_ids
    ]

    found_ids = {
        document.get("document_id")
        for document in selected_documents
    }

    missing_ids = set(document_ids) - found_ids

    if missing_ids:
        raise ValueError("One or more selected documents were not found")

    api_key = get_api_key()
    query_vector = create_query_embedding(question, api_key)
    results = []

    for document in selected_documents:
        document_results = []

        for chunk in document.get("chunks", []):
            score = cosine_similarity(
                query_vector,
                chunk["embedding"]
            )

            document_results.append({
                "document_id": document["document_id"],
                "filename": document["filename"],
                "page": chunk["page"],
                "chunk_id": chunk["chunk_id"],
                "text": chunk["text"],
                "similarity_score": round(score, 4)
            })

        document_results.sort(
            key=lambda item: item["similarity_score"],
            reverse=True
        )

        results.extend(document_results[:top_k_per_document])

    return results


# Save embeddings
def save_embeddings(document_id, filename, embeddings):
    storage_folder = (
        Path(__file__).resolve().parent.parent / "storage"
    )

    storage_folder.mkdir(parents=True, exist_ok=True)

    storage_file = storage_folder / "embeddings.json"

    if storage_file.exists():
        saved_documents = json.loads(
            storage_file.read_text(encoding="utf-8")
        )
    else:
        saved_documents = []

    saved_documents.append({
        "document_id": document_id,
        "filename": filename,
        "chunks": embeddings
    })

    storage_file.write_text(
        json.dumps(saved_documents),
        encoding="utf-8"
    )


@app.get("/health")
def health():
    return {"status": "ok"}


# Upload PDF
@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    data = await file.read()

    try:
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            pages = [page.get_text() for page in doc]

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read PDF"
        )

    chunks = create_chunks(pages)

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No readable text found in this PDF"
        )

    try:
        api_key = get_api_key()
        embeddings = create_embeddings(chunks, api_key)
        document_id = str(uuid.uuid4())

        save_embeddings(
            document_id,
            file.filename,
            embeddings
        )

        save_document(
            document_id=document_id,
            filename=file.filename,
            page_count=len(pages),
            chunk_count=len(chunks)
        )

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=str(error)
        )

    return {
        "filename": file.filename,
        "document_id": document_id,
        "page_count": len(pages),
        "preview": pages[0][:500] if pages else "",
        "chunk_count": len(chunks),
        "embedding_count": len(embeddings),
        "embedding_dimensions": len(embeddings[0]["embedding"]),
        "embedding_preview": embeddings[0]["embedding"][:5]
    }


# Semantic Search API
@app.post("/search")
def search(request: SearchRequest):
    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    if not 1 <= request.top_k <= 20:
        raise HTTPException(
            status_code=400,
            detail="top_k must be between 1 and 20"
        )

    try:
        results = search_relevant_chunks(
            request.question,
            request.top_k
        )

        return {
            "question": request.question,
            "results_count": len(results),
            "results": results
        }

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=str(error)
        )


# Normal question-answering API
@app.post("/ask")
def ask_question(request: SearchRequest):
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    try:
        results = search_relevant_chunks(
            question,
            request.top_k
        )

        if not results:
            raise HTTPException(
                status_code=404,
                detail="No relevant information found"
            )

        context_parts = []

        for index, item in enumerate(results, start=1):
            context_parts.append(
                f"Source {index}\n"
                f"Filename: {item['filename']}\n"
                f"Page: {item['page']}\n"
                f"Content: {item['text']}"
            )

        context = "\n\n".join(context_parts)

        prompt = f"""
You are a helpful research paper assistant.

Answer the user's question using ONLY the provided research paper context.

Instructions:
1. Give a clear, complete, and understandable answer.
2. Explain the relevant idea in simple language.
3. Do not invent facts or information.
4. If the context does not contain the answer, clearly say that the
   information is not available in the provided excerpts.
5. Mention page citations like [filename, Page 5].
6. Explain technical concepts briefly when needed.
7. Avoid incomplete sentences and unsupported conclusions.

Research Paper Context:
{context}

User Question:
{question}

Answer:
"""

        api_key = get_api_key()

        url = (
            "https://generativelanguage.googleapis.com/"
            "v1beta/models/gemini-2.5-flash:generateContent"
            f"?key={api_key}"
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1800
            }
        }

        data = json.dumps(payload).encode("utf-8")

        api_request = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json"
            },
            method="POST"
        )

        with urllib.request.urlopen(
            api_request,
            timeout=90
        ) as response:
            gemini_response = json.loads(
                response.read().decode("utf-8")
            )

        candidates = gemini_response.get("candidates", [])

        if not candidates:
            prompt_feedback = gemini_response.get("promptFeedback", {})

            raise RuntimeError(
                f"Gemini returned no answer. Details: {prompt_feedback}"
            )

        answer_parts = candidates[0].get("content", {}).get("parts", [])

        answer = "\n".join(
            part.get("text", "")
            for part in answer_parts
            if part.get("text")
        ).strip()

        if not answer:
            raise RuntimeError("Gemini returned an empty answer")

        sources = [
            {
                "filename": item["filename"],
                "page": item["page"],
                "similarity_score": item["similarity_score"]
            }
            for item in results
        ]

        # Save normal chat to SQLite
        save_chat(
            question=question,
            answer=answer,
            chat_type="normal",
            document_ids=list({
                item["document_id"]
                for item in results
            }),
            sources=sources
        )

        return {
            "question": question,
            "answer": answer,
            "sources": sources
        }

    except HTTPException:
        raise

    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")

        raise HTTPException(
            status_code=502,
            detail=f"Gemini API error ({error.code}): {error_body}"
        )

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Answer generation failed: {type(error).__name__}: {str(error)}"
        )


# Compare selected research papers
@app.post("/compare")
def compare_documents(request: CompareRequest):
    started_at = time.perf_counter()

    question = request.question.strip()

    document_ids = [
        item.strip()
        for item in request.document_ids
        if item.strip()
    ]

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Comparison question cannot be empty"
        )

    if len(document_ids) < 2:
        raise HTTPException(
            status_code=400,
            detail="Select at least two documents to compare"
        )

    if len(set(document_ids)) != len(document_ids):
        raise HTTPException(
            status_code=400,
            detail="Duplicate document IDs are not allowed"
        )

    if not 1 <= request.top_k_per_document <= 10:
        raise HTTPException(
            status_code=400,
            detail="top_k_per_document must be between 1 and 10"
        )

    try:
        retrieval_started = time.perf_counter()

        results = search_comparison_chunks(
            question,
            document_ids,
            top_k_per_document=request.top_k_per_document
        )

        print(
            f"[COMPARE] Retrieval completed in "
            f"{time.perf_counter() - retrieval_started:.2f}s; "
            f"retrieved {len(results)} chunks."
        )

        if not results:
            raise HTTPException(
                status_code=404,
                detail="No relevant information found in the selected papers"
            )

        context_parts = []

        for index, item in enumerate(results, start=1):
            excerpt = item["text"][:1400]

            context_parts.append(
                f"EXCERPT {index}\n"
                f"Paper filename: {item['filename']}\n"
                f"Document ID: {item['document_id']}\n"
                f"Page number: {item['page']}\n"
                f"Relevant paper text:\n{excerpt}"
            )

        context = "\n\n".join(context_parts)

        prompt = f"""
You are an expert academic research-paper analysis assistant.
Your job is to explain and compare the selected research papers accurately,
in detail, and in clear, accessible English.

USER'S QUESTION:
{question}

STRICT EVIDENCE RULES:
1. Use only facts supported by the research-paper excerpts below.
2. Never invent objectives, methods, datasets, results, numbers, or conclusions.
3. Do not treat your general knowledge as evidence about either paper.
4. Attach a citation to each important paper-specific claim using this exact
   format: [Paper filename, Page N].
5. If a requested detail is not present in the supplied excerpts, say:
   "This detail is not available in the provided excerpts."
6. Do not claim that a paper has no limitations merely because the excerpts
   do not mention limitations.
7. Keep the two papers clearly distinguished by their filenames.
8. Do not write incomplete sentences or unexplained technical keywords.

HOW TO EXPLAIN:
- Write in clear, natural English.
- Explain technical terms in simple words when they first appear.
- Explain what a method does and why it is used, but do not add unsupported
  details about how the authors implemented it.
- Prefer meaningful paragraphs with supporting bullet points where useful.
- Do not make the answer unnecessarily repetitive.

REQUIRED RESPONSE STRUCTURE:

# 1. Introduction
Briefly identify both papers by filename and explain what aspect the user's
question asks you to compare.

# 2. Paper-by-Paper Analysis

## Paper 1: [use its exact filename]
Explain the relevant information in detail:
- Research objective
- Proposed approach or methodology
- Dataset or experimental setup
- Results and findings
- Limitations or future directions

## Paper 2: [use its exact filename]
Use the same subheadings and level of detail as Paper 1.

# 3. Side-by-Side Comparison
Create a readable table with these columns:
| Comparison aspect | Paper 1 | Paper 2 | Key similarity or difference |

Include relevant rows for:
- Main objective
- Problem addressed
- Methodology
- Models or techniques
- Dataset or experiments
- Main findings
- Limitations, if available

After the table, explain the most important similarities and differences
in complete sentences. Do not simply repeat the table.

# 4. Detailed Interpretation
Explain what the similarities and differences mean. Clarify whether the papers
approach the same problem differently or address different aspects of a
broader problem. Only make claims supported by the excerpts.

# 5. Final Summary
Give a clear, useful summary of the comparison in 1-3 paragraphs.
Mention any important information that could not be verified from the excerpts.

FINAL QUALITY CHECK:
Before finishing, verify that:
- Both selected papers have been discussed separately.
- The comparison includes evidence from both papers.
- Important claims have page citations.
- No unsupported facts have been added.
- The answer directly addresses the user's question.
- The answer is detailed enough to be useful to a student reading these papers.

RESEARCH PAPER EXCERPTS:
{context}

Write the detailed comparison now:
"""

        api_key = get_api_key()

        url = (
            "https://generativelanguage.googleapis.com/"
            "v1beta/models/gemini-2.5-flash:generateContent"
            f"?key={api_key}"
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 3000
            }
        }

        api_request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json"
            },
            method="POST"
        )

        generation_started = time.perf_counter()

        print(
            f"[COMPARE] Sending detailed prompt "
            f"({len(prompt)} characters) to Gemini..."
        )

        with urllib.request.urlopen(
            api_request,
            timeout=180
        ) as response:
            gemini_response = json.loads(
                response.read().decode("utf-8")
            )

        print(
            f"[COMPARE] Gemini generation completed in "
            f"{time.perf_counter() - generation_started:.2f}s."
        )

        candidates = gemini_response.get("candidates", [])

        if not candidates:
            prompt_feedback = gemini_response.get("promptFeedback", {})

            raise RuntimeError(
                f"Gemini returned no answer. Details: {prompt_feedback}"
            )

        candidate = candidates[0]

        answer_parts = candidate.get("content", {}).get("parts", [])

        answer = "\n".join(
            part.get("text", "")
            for part in answer_parts
            if part.get("text")
        ).strip()

        if not answer:
            finish_reason = candidate.get("finishReason", "Unknown")

            raise RuntimeError(
                f"Gemini returned an empty comparison. "
                f"Finish reason: {finish_reason}"
            )

        finish_reason = candidate.get("finishReason", "Unknown")

        print(f"[COMPARE] Gemini finish reason: {finish_reason}")

        sources = [
            {
                "document_id": item["document_id"],
                "filename": item["filename"],
                "page": item["page"],
                "similarity_score": item["similarity_score"]
            }
            for item in results
        ]

        compared_documents = []
        seen_document_ids = set()

        for item in results:
            if item["document_id"] not in seen_document_ids:
                compared_documents.append({
                    "document_id": item["document_id"],
                    "filename": item["filename"]
                })

                seen_document_ids.add(item["document_id"])

        print(
            f"[COMPARE] Total request completed in "
            f"{time.perf_counter() - started_at:.2f}s."
        )

        # Save comparison chat to SQLite
        save_chat(
            question=question,
            answer=answer,
            chat_type="comparison",
            document_ids=document_ids,
            sources=sources
        )

        return {
            "question": question,
            "answer": answer,
            "compared_documents": compared_documents,
            "sources": sources
        }

    except HTTPException:
        raise

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")

        print(
            f"[COMPARE] Gemini HTTP error {error.code}: "
            f"{error_body[:1000]}"
        )

        raise HTTPException(
            status_code=502,
            detail=f"Gemini API error ({error.code}): {error_body}"
        )

    except urllib.error.URLError as error:
        print(f"[COMPARE] Network error: {error.reason}")

        raise HTTPException(
            status_code=502,
            detail=f"Network error: {error.reason}"
        )

    except Exception as error:
        print(
            f"[COMPARE] Failed after "
            f"{time.perf_counter() - started_at:.2f}s: "
            f"{type(error).__name__}: {error}"
        )

        raise HTTPException(
            status_code=502,
            detail=(
                f"Comparison failed: "
                f"{type(error).__name__}: {str(error)}"
            )
        )


# Get all uploaded documents
@app.get("/documents")
def get_documents():
    try:
        return {
            "documents": get_all_documents()
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# Get complete chat history
@app.get("/history")
def get_history():
    try:
        return {
            "history": get_all_chats()
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# Get dashboard statistics
@app.get("/dashboard")
def get_dashboard():
    try:
        return get_dashboard_stats()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )
