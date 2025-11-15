import React from "react";
import Upload from "./components/Upload";
import Products from "./components/Products";
import Webhooks from "./components/Webhooks";

export default function App() {
  return (
    <div className="app-bg min-h-screen">
      <div className="container layout-vertical">
        {/* HEADER */}
        <header className="hero">
          <div>
            <h1 className="hero-title">Product Importer</h1>
          </div>
          <div className="hero-cta">
            <div className="badge">Acme Inc</div>
          </div>
        </header>

        {/* TOP ROW: Upload + Webhooks */}
        <div
          className="top-row"
          style={{
            display: "flex",
            gap: "18px",
            alignItems: "stretch",
            width: "100%",
          }}
        >
          <div style={{ flex: 1 }}>
            <Upload />
          </div>
          <div style={{ flex: 1 }}>
            <Webhooks />
          </div>
        </div>

        {/* PRODUCTS */}
        <div className="col-products">
          <Products />
        </div>
      </div>
    </div>
  );
}
