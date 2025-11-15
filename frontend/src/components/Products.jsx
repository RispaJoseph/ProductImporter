import React, { useEffect, useState, useRef } from "react";
import ProductForm from "./ProductForm";
import ConfirmDialog from "./ConfirmDialog";

/**
 * Cleaned final Products.jsx
 * - Removes unused `products` state (uses visibleProducts only)
 * - Debounced global search
 * - Server query params sent (q, sku, name, active, page)
 * - Client-side fallback filtering on page results
 * - Create / Edit modal (ProductForm) + Confirm delete modal (ConfirmDialog)
 *
 * Adjust endpoint paths/response parsing if your backend uses different names.
 */

export default function Products() {
  const [visibleProducts, setVisibleProducts] = useState([]); // rendered list (after client-side filtering)
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0); // server-provided total (or fallback)
  const [q, setQ] = useState("");
  const [skuFilter, setSkuFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState(""); // "", "true", "false"
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  // modal states
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // delete confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const PAGE_SIZE = 25;
  const searchDebounceRef = useRef(null);

  // Debounced fetch when filters/page change
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchProducts();
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line
  }, [page, q, skuFilter, nameFilter, activeFilter]);

  const buildListUrl = () => {
    const params = new URLSearchParams();
    params.set("page", page);
    if (q) params.set("q", q);
    if (skuFilter) params.set("sku", skuFilter);
    if (nameFilter) params.set("name", nameFilter);
    if (activeFilter) params.set("active", activeFilter);
    return `/api/products/?${params.toString()}`;
  };

  async function fetchProducts() {
    setLoading(true);
    setMsg(null);
    try {
      const url = buildListUrl();
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();

      const pageResults = Array.isArray(data.results) ? data.results : [];
      const serverCount = typeof data.count === "number" ? data.count : pageResults.length;
      setCount(serverCount);

      // Apply client-side fallback filters on returned page results
      const filtered = applyClientSideFilters(pageResults, { q, skuFilter, nameFilter, activeFilter });
      setVisibleProducts(filtered);
    } catch (err) {
      console.error(err);
      setMsg({ type: "error", text: "Unable to load products." });
      setVisibleProducts([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }

  function applyClientSideFilters(items, { q, skuFilter, nameFilter, activeFilter }) {
    if (!items || items.length === 0) return [];
    return items.filter((p) => {
      const text = `${p.sku ?? ""} ${p.name ?? ""} ${p.description ?? ""}`.toLowerCase();
      if (q && !text.includes(q.toLowerCase())) return false;
      if (skuFilter && !(p.sku ?? "").toLowerCase().includes(skuFilter.toLowerCase())) return false;
      if (nameFilter && !(p.name ?? "").toLowerCase().includes(nameFilter.toLowerCase())) return false;
      if (activeFilter) {
        const want = activeFilter === "true";
        if (Boolean(p.active) !== want) return false;
      }
      return true;
    });
  }

  // CRUD helpers
  const onCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const onEdit = (product) => {
    setEditing(product);
    setFormOpen(true);
  };

  const onSave = async (productData) => {
    try {
      const isEdit = Boolean(productData.id);
      const url = isEdit ? `/api/products/${productData.id}/` : `/api/products/`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Save failed (${res.status}): ${text}`);
      }

      await res.json(); // consume body

      setMsg({ type: "success", text: isEdit ? "Product updated." : "Product created." });

      // after create, go to page 1 to show new record if backend lists new items first
      setPage(1);
      fetchProducts();
      setFormOpen(false);
    } catch (err) {
      console.error(err);
      setMsg({ type: "error", text: "Save failed. See console." });
    }
  };

  // Delete flow: open confirm dialog then perform delete
  const requestDelete = (product) => {
    setDeleteTarget(product);
    setConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!deleteTarget) {
      setConfirmOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (res.status === 204 || res.ok) {
        setMsg({ type: "success", text: "Product deleted." });
        const newCount = Math.max(0, count - 1);
        const lastPage = Math.max(1, Math.ceil(newCount / PAGE_SIZE));
        if (page > lastPage) setPage(lastPage);
        setConfirmOpen(false);
        setDeleteTarget(null);
        fetchProducts();
      } else {
        const text = await res.text();
        throw new Error(`Delete failed (${res.status}): ${text}`);
      }
    } catch (err) {
      console.error(err);
      setMsg({ type: "error", text: "Delete failed. See console." });
      setConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const clearFilters = () => {
    setQ("");
    setSkuFilter("");
    setNameFilter("");
    setActiveFilter("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil((typeof count === "number" ? count : visibleProducts.length) / PAGE_SIZE));

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="flex-between" style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <h3 className="title-sm">Products</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onCreate}>+ New</button>
            <button
              className="btn"
              onClick={() => {
                setPage(1);
                fetchProducts();
              }}
              title="Refresh"
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            placeholder="Global search (sku, name, description)"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            style={{ minWidth: 260 }}
          />
          <select
            className="input"
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button className="btn" onClick={clearFilters}>Clear</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          className="input"
          placeholder="Filter by SKU"
          value={skuFilter}
          onChange={(e) => { setSkuFilter(e.target.value); setPage(1); }}
        />
        <input
          className="input"
          placeholder="Filter by Name"
          value={nameFilter}
          onChange={(e) => { setNameFilter(e.target.value); setPage(1); }}
        />
      </div>

      <div className="table" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="table-head">
          <div>SKU</div>
          <div>Name</div>
          <div className="col-desc">Description</div>
          <div className="col-price">Price</div>
          <div className="col-active">Active</div>
          <div className="col-actions">Actions</div>
        </div>

        <div className="table-body" style={{ flex: 1 }}>
          {loading && <div className="empty">Loading…</div>}

          {!loading && visibleProducts.length === 0 && (
            <div className="empty">No products found. Try changing filters or clearing them.</div>
          )}

          {visibleProducts.map((p) => (
            <div key={p.id || p.sku} className="table-row" style={{ alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>{p.sku}</div>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div className="col-desc" style={{ color: "#cfeffd" }}>{p.description}</div>
              <div className="col-price">{p.price ? `₹${p.price}` : "-"}</div>
              <div className="col-active">{p.active ? "Yes" : "No"}</div>
              <div className="col-actions" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => onEdit(p)}>Edit</button>
                <button className="btn" onClick={() => requestDelete(p)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pager" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setPage(x => Math.max(1, x - 1))} disabled={page <= 1}>Prev</button>
          <button className="btn" onClick={() => setPage(x => Math.min(totalPages, x + 1))} disabled={page >= totalPages}>Next</button>
        </div>
        <div className="muted">Page {page} / {totalPages} • {count} items</div>
      </div>

      {msg && <div style={{ marginTop: 10 }} className="note">{msg.text}</div>}

      {/* Edit / Create modal */}
      {formOpen && (
        <div className="modal-overlay" style={modalOverlayStyle}>
          <div className="modal" style={modalStyle}>
            <ProductForm initial={editing} onCancel={() => setFormOpen(false)} onSave={onSave} />
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete product"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name || deleteTarget.sku}"? This action cannot be undone.` : "Are you sure?"}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={performDelete}
        onCancel={() => { setConfirmOpen(false); setDeleteTarget(null); }}
      />
    </div>
  );
}

// inline modal styles (you can move these into index.css)
const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1200,
};

const modalStyle = {
  width: "720px",
  maxWidth: "95%",
  borderRadius: 10,
  overflow: "hidden",
};
