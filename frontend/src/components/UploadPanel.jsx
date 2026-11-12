
function UploadPanel({ documents, setDocuments }) {
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

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const result = await response.json();

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  status: "ready",
                  pageCount: result.page_count,
                  preview: result.preview,
                }
              : doc
          )
        );
      } catch (error) {
        console.error("PDF upload error:", error);

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id
              ? { ...doc, status: "error" }
              : doc
          )
        );
      }
    }

    e.target.value = "";
  }

  return (
    <div className="p-6">
      <label
        htmlFor="pdf-upload"
        className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl py-12 px-6 text-center cursor-pointer hover:border-indigo-500 transition-colors bg-slate-900"
      >
        <div className="w-12 h-12 rounded-lg bg-indigo-600/20 flex items-center justify-center mb-4">
          <span className="text-indigo-400 text-xl">↑</span>
        </div>

        <p className="font-medium text-white mb-1">
          Upload your research paper
        </p>

        <p className="text-sm text-slate-500 mb-4">
          Drag & drop a PDF or click to browse
        </p>

        <span className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          Choose file
        </span>

        <input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <p className="text-xs text-slate-600 mt-4">
          PDF · max 50MB
        </p>
      </label>

      <div className="flex flex-wrap gap-2 mt-4">
        {[
          "Instant summaries",
          "Citation extraction",
          "Methodology analysis",
          "Key findings",
        ].map((tag) => (
          <span
            key={tag}
            className="text-sm text-slate-400 border border-slate-700 rounded-full px-3 py-1.5"
          >
            {tag}
          </span>
        ))}
      </div>

      {documents.length > 0 && (
        <ul className="mt-6 space-y-4">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="text-sm bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-200"
            >
              <p className="font-medium break-all">
                📄 {doc.name} · {doc.status}
              </p>

              {doc.status === "ready" && (
                <>
                  <p className="text-xs text-slate-400 mt-2">
                    Total Pages: {doc.pageCount}
                  </p>

                  <div className="mt-3">
                    <p className="text-indigo-400 font-medium mb-2">
                      Extracted Text Preview
                    </p>

                    <div className="bg-slate-900 rounded-lg p-3 text-slate-300 text-xs leading-6 whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {doc.preview || "No text found in this PDF."}
                    </div>
                  </div>
                </>
              )}

              {doc.status === "error" && (
                <p className="text-xs text-red-400 mt-2">
                  Upload failed. Please try again.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default UploadPanel;
