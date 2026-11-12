
import json
import math
import uuid
import urllib.request
import urllib.error
from pathlib import Path

import pymupdf
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

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


# Request model for search API
class SearchRequest(BaseModel):
    question: str
    top_k: int = 5


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
                f"{error.read().decode('utf-8')}"
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
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))

    except urllib.error.HTTPError as error:
        raise RuntimeError(
            f"Gemini API error ({error.code}): "
            f"{error.read().decode('utf-8')}"
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

    return sum(
        a * b for a, b in zip(vector1, vector2)
    )


# Search relevant chunks
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

    query_vector = create_query_embedding(
        question, api_key
    )

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

@app.post("/ask")
def ask_question(request: SearchRequest):
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    try:
        # Step 1: Retrieve relevant chunks
        results = search_relevant_chunks(
            question,
            request.top_k
        )

        if not results:
            raise HTTPException(
                status_code=404,
                detail="No relevant information found"
            )

        # Step 2: Prepare research paper context
        context = ""

        for index, item in enumerate(results, start=1):
            context += (
                f"\nSource {index}\n"
                f"Filename: {item['filename']}\n"
                f"Page: {item['page']}\n"
                f"Content: {item['text']}\n"
            )

        # Step 3: Create Gemini prompt
        prompt = f"""
You are a helpful research paper assistant.

Answer the user's question using ONLY the
provided research paper context.

Instructions:
1. Give a clear and understandable answer.
2. Do not invent facts or information.
3. If the context does not contain the answer,
   clearly say that the information is not available.
4. Mention page citations like [Page 5].
5. Explain technical concepts in simple language.

Research Paper Context:
{context}

User Question:
{question}

Answer:
"""

        # Step 4: Get Gemini API key
        api_key = get_api_key()

        # Step 5: Call Gemini API
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
                "temperature": 0.2
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
            timeout=60
        ) as response:
            gemini_response = json.loads(
                response.read().decode("utf-8")
            )

        # Step 6: Extract generated answer
        answer = gemini_response[
            "candidates"
        ][0]["content"]["parts"][0]["text"]

        # Step 7: Return answer and citations
        sources = [
            {
                "filename": item["filename"],
                "page": item["page"],
                "similarity_score": item["similarity_score"]
            }
            for item in results
        ]

        return {
            "question": question,
            "answer": answer,
            "sources": sources
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Answer generation failed: {str(e)}"
        )

