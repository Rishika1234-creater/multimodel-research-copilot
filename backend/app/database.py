
import sqlite3
import json
from pathlib import Path
from datetime import datetime, timezone


BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_FILE = BASE_DIR / "storage" / "research_copilot.db"


def get_connection():
    DATABASE_FILE.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DATABASE_FILE)
    connection.row_factory = sqlite3.Row

    return connection


def initialize_database():
    with get_connection() as connection:

        connection.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                document_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                page_count INTEGER DEFAULT 0,
                chunk_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'ready',
                uploaded_at TEXT NOT NULL
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                chat_type TEXT DEFAULT 'normal',
                document_ids TEXT,
                sources TEXT,
                created_at TEXT NOT NULL
            )
        """)

        connection.commit()


def save_document(
    document_id,
    filename,
    page_count,
    chunk_count
):
    with get_connection() as connection:

        connection.execute("""
            INSERT OR REPLACE INTO documents (
                document_id,
                filename,
                page_count,
                chunk_count,
                status,
                uploaded_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            document_id,
            filename,
            page_count,
            chunk_count,
            "ready",
            datetime.now(timezone.utc).isoformat()
        ))

        connection.commit()


def get_all_documents():
    with get_connection() as connection:

        rows = connection.execute("""
            SELECT *
            FROM documents
            ORDER BY uploaded_at DESC
        """).fetchall()

        return [dict(row) for row in rows]


def save_chat(
    question,
    answer,
    chat_type="normal",
    document_ids=None,
    sources=None
):
    with get_connection() as connection:

        connection.execute("""
            INSERT INTO chat_history (
                question,
                answer,
                chat_type,
                document_ids,
                sources,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            question,
            answer,
            chat_type,
            json.dumps(document_ids or []),
            json.dumps(sources or []),
            datetime.now(timezone.utc).isoformat()
        ))

        connection.commit()


def get_all_chats():
    with get_connection() as connection:

        rows = connection.execute("""
            SELECT *
            FROM chat_history
            ORDER BY id DESC
        """).fetchall()

        history = []

        for row in rows:
            item = dict(row)

            item["document_ids"] = json.loads(
                item["document_ids"] or "[]"
            )

            item["sources"] = json.loads(
                item["sources"] or "[]"
            )

            history.append(item)

        return history


def get_dashboard_stats():
    with get_connection() as connection:

        document_stats = connection.execute("""
            SELECT
                COUNT(*) AS total_papers,
                COALESCE(SUM(page_count), 0) AS total_pages,
                SUM(
                    CASE WHEN status = 'ready'
                    THEN 1 ELSE 0 END
                ) AS ready_papers
            FROM documents
        """).fetchone()

        chat_stats = connection.execute("""
            SELECT COUNT(*) AS total_messages
            FROM chat_history
        """).fetchone()

        return {
            "total_papers": document_stats["total_papers"],
            "ready_papers": document_stats["ready_papers"] or 0,
            "total_pages": document_stats["total_pages"],
            "total_messages": chat_stats["total_messages"]
        }
