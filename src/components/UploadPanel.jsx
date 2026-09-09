function UploadPanel({ documents, setDocuments }) {
  function handleFileChange(e) {
    const files = Array.from(e.target.files);
    const newDocs = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      file,
      status: "uploaded",
    }));
    setDocuments((prev) => [...prev, ...newDocs]);
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
        <p className="font-medium text-white mb-1">Upload your research paper</p>
        <p className="text-sm text-slate-500 mb-4">Drag & drop a PDF or click to browse</p>

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

        <p className="text-xs text-slate-600 mt-4">PDF · max 50MB</p>
      </label>

      <div className="flex flex-wrap gap-2 mt-4">
  {["Instant summaries", "Citation extraction", "Methodology analysis", "Key findings"].map(
    (tag) => (
      <span
        key={tag}
        className="text-sm text-slate-400 border border-slate-700 rounded-full px-3 py-1.5"
      >
        {tag}
      </span>
    )
  )}
</div>

      {documents.length > 0 && (
        <ul className="mt-6 space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 truncate text-slate-200"
            >
              📄 {doc.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default UploadPanel;