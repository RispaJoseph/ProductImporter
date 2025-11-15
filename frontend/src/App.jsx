import React from "react";
import Upload from "./components/Upload";
import Products from "./components/Products";

export default function App() {
  return (
    <div className="app-bg min-h-screen">
      <div className="container layout-vertical">
        <header className="hero">
          <div>
            <h1 className="hero-title">Product Importer</h1>
            <p className="hero-sub">Upload large CSVs, track import progress, manage and review products — built for scale.</p>
          </div>
          <div className="hero-cta">
            <div className="badge">Acme — Tech Challenge</div>
            <div className="small muted">Demo UI improvements</div>
          </div>
        </header>

        {/* Upload sits at the top, compact */}
        <div className="col-upload">
          <Upload />
        </div>

        {/* Products takes the remaining space and is visually dominant */}
        <div className="col-products">
          <Products />
        </div>

        <footer className="muted foot">Tip: Backend handles heavy lifting — frontend shows progress and controls.</footer>
      </div>
    </div>
  );
}
