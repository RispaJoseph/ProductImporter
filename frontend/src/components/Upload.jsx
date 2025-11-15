import React, { useRef, useState, useEffect } from "react";

export default function Upload() {
  const fileRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Idle");
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pollTimer, setPollTimer] = useState(null);

  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFileSize, setSelectedFileSize] = useState(null);

  // Clean up polling when component unmounts
  useEffect(() => {
    return () => {
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [pollTimer]);

  const humanBytes = (n) => {
    if (!n && n !== 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(1)} ${units[i]}`;
  };

  const pollImportStatus = (jobId, fileName) => {
    setStatus("Queued");
    setMessage("");
    setProgress(0);

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/imports/${jobId}/status/`);
        if (!res.ok) {
          throw new Error("Failed to fetch import status");
        }
        const job = await res.json();
        const { status: s, total_rows, processed, error } = job;

        let pct = 0;
        if (total_rows && total_rows > 0) {
          pct = Math.round((processed / total_rows) * 100);
        }
        if (pct < 5 && s === "processing") {
          pct = 5;
        }

        setProgress(pct);

        if (s === "queued") {
          setStatus("Queued");
        } else if (s === "processing") {
          setStatus("Processing");
        } else if (s === "done") {
          clearInterval(interval);
          setPollTimer(null);
          setStatus("Import Complete");
          setProgress(100);
          setMessage(
            `Imported ${processed} products from ${fileName}${
              total_rows ? ` (rows in file: ${total_rows})` : ""
            }`
          );
          window.dispatchEvent(new Event("products:reload"));
        } else if (s === "failed") {
          clearInterval(interval);
          setPollTimer(null);
          setStatus("Failed");
          setMessage(error || "Import failed. Please check server logs.");
        }
      } catch (err) {
        clearInterval(interval);
        setPollTimer(null);
        setStatus("Error");
        setMessage(err.message || "Error while checking import status.");
      }
    }, 1000);

    setPollTimer(interval);
  };

  const getSelectedFile = () => {
    if (fileRef.current && fileRef.current.files && fileRef.current.files[0]) {
      return fileRef.current.files[0];
    }
    return null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setSelectedFileName(file.name);
      setSelectedFileSize(file.size);
    } else {
      setSelectedFileName("");
      setSelectedFileSize(null);
    }
  };

  const uploadFile = async () => {
    const file = getSelectedFile();

    if (!file) {
      setMessage("Please select a CSV file");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Only CSV files are accepted.");
      return;
    }

    if (pollTimer) {
      clearInterval(pollTimer);
      setPollTimer(null);
    }

    setProgress(0);
    setStatus("Uploading");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload/", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Upload failed (${res.status}). ${text || "Please try again."}`
        );
      }

      const job = await res.json();
      if (!job.id) {
        throw new Error("Upload response did not include a job id.");
      }

      setStatus("Upload Complete, starting import…");
      setMessage(
        `File ${file.name} (${humanBytes(file.size)}) uploaded. Import job #${job.id} started.`
      );
      setProgress(10);

      pollImportStatus(job.id, file.name);
    } catch (err) {
      setStatus("Upload Failed");
      setMessage(err.message || "Upload error. Please try again.");
      setProgress(0);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dtFile = e.dataTransfer.files && e.dataTransfer.files[0];
    if (dtFile && fileRef.current) {
      fileRef.current.files = e.dataTransfer.files;
      setSelectedFileName(dtFile.name);
      setSelectedFileSize(dtFile.size);
    }
  };

  return (
    // full-width so it matches the Products section width
    <div className="card upload-card full-width">
      <div className="flex-between">
        <div>
          <h2 className="title">Upload Products CSV</h2>
          {/* <p className="muted">
            Up to 500,000 rows. SKU uniqueness enforced (case-insensitive).
          </p> */}
        </div>

        {/* <div className="meta">
          <div className="chip">Asynchronous</div>
          <div className="chip">CSV</div>
        </div> */}
      </div>

      <div
        className={`dropzone ${dragOver ? "dragover" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => fileRef.current && fileRef.current.click()}
        >
          {selectedFileName ? "Change CSV" : "Choose CSV"}
        </button>

        <span className="muted">
          {selectedFileName
            ? `Selected: ${selectedFileName}${
                selectedFileSize ? ` (${humanBytes(selectedFileSize)})` : ""
              }`
            : "     or drag & drop here"}
        </span>
      </div>

      <div className="actions">
        <button type="button" className="btn btn-accent" onClick={uploadFile}>
          Start Import
        </button>
      </div>

      <div className="progress-wrap" aria-hidden={progress === 0}>
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="progress-meta">
          <div>{status}</div>
          <div className="muted">{progress}%</div>
        </div>
      </div>

      {message && <div className="note">{message}</div>}
    </div>
  );
}
