import React from "react";
import Upload from "./components/Upload";
import Products from "./components/Products";
import Webhooks from "./components/Webhooks";

export default function App() {
  return (
    <div className="app-bg min-h-screen">
      <div className="container">
        {/* HEADER */}
        <header className="hero">
          <div>
            <h1 className="hero-title">Product Importer</h1>
            {/* <p className="hero-sub">Import large CSVs and manage products.</p> */}
          </div>
          <div className="hero-cta">
            <div className="badge">Acme Inc</div>
          </div>
        </header>

        {/* MAIN LAYOUT: stacked vertically */}
        <main className="layout-vertical">
          {/* 1. Upload */}
          <section className="col-upload">
            <Upload />
          </section>

          {/* 2. Webhooks */}
          <section className="col-webhooks">
            <Webhooks />
          </section>

          {/* 3. Products */}
          <section className="col-products">
            <Products />
          </section>
        </main>
      </div>
    </div>
  );
}
