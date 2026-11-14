
function UploadPanel({ documents, setDocuments, onUploadComplete }) {
  async function handleFileChange(e) {
    const files = Array.from(e.target.files);

    for (const file of files) {
      const id = crypto.randomUUID();

      setDocuments((prev) => [
        ...prev,
        {
          id,
          name: file.name,
          file,
          status: "processing",
        },
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("http://localhost:8000/upload", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.detail || "Upload failed");
        }

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  status: "ready",
                  backendDocumentId: result.document_id,
                  pageCount: result.page_count,
                  preview: result.preview,
                  chunkCount: result.chunk_count,
                  embeddingDimensions: result.embedding_dimensions,
                }
              : doc
          )
        );
      } catch (error) {
        console.error("PDF upload error:", error);

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  status: "error",
                  error: error.message,
                }
              : doc
          )
        );
      }
    }

    // Refresh documents and dashboard data from the database
    if (onUploadComplete) {
      await onUploadComplete();
    }

    e.target.value = "";
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
      <h2 className="text-xl font-semibold mb-2">
        Upload Research Papers
      </h2>

      <p className="text-slate-400 text-sm mb-4">
        Upload PDF files to start researching with AI.
      </p>

      <input
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileChange}
        className="block w-full text-sm text-slate-300
        file:mr-4 file:py-2 file:px-4
        file:rounded-lg file:border-0
        file:bg-blue-600 file:text-white
        hover:file:bg-blue-700"
      />

      <div className="mt-5 space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4"
          >
            <div className="flex justify-between items-center gap-3">
              <p className="font-medium break-all">
                {doc.name}
              </p>

              <span
                className={`text-xs px-2 py-1 rounded ${
                  doc.status === "ready"
                    ? "bg-green-900 text-green-300"
                    : doc.status === "error"
                    ? "bg-red-900 text-red-300"
                    : "bg-yellow-900 text-yellow-300"
                }`}
              >
                {doc.status}
              </span>
            </div>

            {doc.status === "ready" && (
              <div className="mt-3 text-sm text-slate-400 space-y-1">
                <p>Pages: {doc.pageCount ?? "N/A"}</p>
                <p>Chunks: {doc.chunkCount ?? "N/A"}</p>
                <p>
                  Embedding Dimensions:{" "}
                  {doc.embeddingDimensions ?? "N/A"}
                </p>
                {doc.backendDocumentId && (
                  <p className="break-all">
                    Document ID: {doc.backendDocumentId}
                  </p>
                )}
              </div>
            )}

            {doc.status === "error" && (
              <p className="text-red-400 text-sm mt-2">
                {doc.error}
              </p>
            )}

            {doc.preview && (
              <div className="mt-3">
                <p className="text-sm font-medium text-slate-300 mb-1">
                  Extracted Text Preview:
                </p>
                <p className="text-xs text-slate-400 whitespace-pre-wrap">
                  {doc.preview}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default UploadPanel;
