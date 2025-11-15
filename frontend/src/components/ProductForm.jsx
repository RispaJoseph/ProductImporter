import React, { useState, useEffect } from "react";

/**
 * ProductForm - used for both create and edit
 * Props:
 *  - initial: null | product object
 *  - onCancel: () => void
 *  - onSave: (productData) => Promise
 *
 * For create: initial === null
 * For edit: initial contains { id, sku, name, description, price, active }
 */

export default function ProductForm({ initial = null, onCancel, onSave }) {
  const [sku, setSku] = useState(initial?.sku || "");
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [price, setPrice] = useState(initial?.price || "");
  const [active, setActive] = useState(Boolean(initial?.active));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSku(initial?.sku || "");
    setName(initial?.name || "");
    setDescription(initial?.description || "");
    setPrice(initial?.price || "");
    setActive(Boolean(initial?.active));
  }, [initial]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!sku || !name) {
      setError("SKU and Name are required.");
      return;
    }

    const payload = {
      id: initial?.id,
      sku: sku.trim(),
      name: name.trim(),
      description: description.trim(),
      price: price === "" ? null : Number(price),
      active: Boolean(active),
    };

    setSubmitting(true);
    try {
      await onSave(payload);
    } catch (err) {
      console.error(err);
      setError("Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: "#071026", padding: 18, borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{initial ? "Edit product" : "Create product"}</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onCancel} disabled={submitting}>Cancel</button>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ gridColumn: "1 / 2" }}>
          <label className="muted">SKU</label>
          <input className="input" value={sku} onChange={(e)=>setSku(e.target.value)} />
        </div>

        <div style={{ gridColumn: "2 / 3" }}>
          <label className="muted">Name</label>
          <input className="input" value={name} onChange={(e)=>setName(e.target.value)} />
        </div>

        <div style={{ gridColumn: "1 / 3" }}>
          <label className="muted">Description</label>
          <textarea className="input" value={description} onChange={(e)=>setDescription(e.target.value)} rows={3} />
        </div>

        <div>
          <label className="muted">Price</label>
          <input className="input" value={price ?? ""} onChange={(e)=>setPrice(e.target.value)} placeholder="e.g. 199.99" />
        </div>

        <div>
          <label className="muted">Active</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={active} onChange={(e)=>setActive(e.target.checked)} />
            <span className="muted">Is active</span>
          </div>
        </div>

        <div style={{ gridColumn: "1 / 3", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn primary" disabled={submitting}>{submitting ? "Saving..." : "Save"}</button>
        </div>

        {error && (
          <div style={{ gridColumn: "1 / 3" }} className="note">{error}</div>
        )}
      </form>
    </div>
  );
}
