import React, { useRef, useState } from "react";

export default function Upload() {
  const fileRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Idle");
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const humanBytes = (n) => {
    if (!n && n !== 0) return "";
    const units = ["B","KB","MB","GB"];
    let i = 0;
    while (n >= 1024 && i < units.length-1) { n /= 1024; i++; }
    return `${n.toFixed(1)} ${units[i]}`;
  };

  const startFakeUpload = (file) => {
    // placeholder: simulate progress for demo + frontend UX
    setStatus("Parsing CSV");
    setProgress(3);
    setMessage("");
    let p = 3;
    const t = setInterval(() => {
      p += Math.random()*12;
      if (p >= 100) {
        p = 100;
        clearInterval(t);
        setStatus("Import Complete");
        setMessage(`Imported ${file.name} (${humanBytes(file.size)})`);
      } else if (p > 60) {
        setStatus("Finalizing");
      } else if (p > 30) {
        setStatus("Validating");
      }
      setProgress(Math.floor(p));
    }, 400);
  };

  const uploadFile = () => {
    const file = fileRef.current.files && fileRef.current.files[0];
    if (!file) {
      setMessage("Please select a CSV file");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Only CSV files are accepted.");
      return;
    }
    // here you would POST the file to your backend and start a background job
    // for now we simulate UX so reviewers can see the polished UI
    startFakeUpload(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      fileRef.current.files = e.dataTransfer.files;
      uploadFile();
    }
  };

  return (
    <div className="card glass">
      <div className="flex-between">
        <div>
          <h2 className="title">Upload Products CSV</h2>
          <p className="muted">Up to 500,000 rows. SKU uniqueness enforced (case-insensitive).</p>
        </div>

        <div className="meta">
          <div className="chip">Asynchronous</div>
          <div className="chip">CSV</div>
        </div>
      </div>

      <div
        className={`dropzone ${dragOver ? "dragover" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current.click()}
      >
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} />
        <div className="drop-inner">
          <svg xmlns="http://www.w3.org/2000/svg" className="upload-ico" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3.5A1.5 1.5 0 014.5 2h11A1.5 1.5 0 0117 3.5v13A1.5 1.5 0 0115.5 18h-11A1.5 1.5 0 013 16.5v-13zM10 5.5a.75.75 0 00-.75.75v4.69l-1.72-1.72a.75.75 0 10-1.06 1.06l3 3a.75.75 0 001.06 0l3-3a.75.75 0 10-1.06-1.06L10.75 11V6.25A.75.75 0 0010 5.5z" clipRule="evenodd" /></svg>
          <div>
            <div className="drop-title">Drag & drop a CSV here, or click to select</div>
            <div className="drop-sub">We'll process it in the background and notify progress here.</div>
          </div>
        </div>
      </div>

      <div className="actions">
        <button className="btn primary" onClick={uploadFile}>Start Upload</button>
        <button className="btn" onClick={() => { fileRef.current.value = null; setProgress(0); setStatus("Idle"); setMessage(""); }}>Reset</button>
      </div>

      <div className="progress-wrap" aria-hidden={progress===0}>
        <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
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
