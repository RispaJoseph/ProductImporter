import React, { useEffect, useState } from "react";

const EMPTY_FORM = {
  id: null,
  name: "",
  url: "",
  event_type: "import.completed",
  enabled: true,
};

export default function Webhooks() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [testingId, setTestingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [error, setError] = useState("");

  // --------------------------------------------------
  // helpers
  // --------------------------------------------------
  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/webhooks/");
      const data = await res.json();

      // ✅ handle both paginated ({results: []}) and plain array responses
      const rows = Array.isArray(data) ? data : data.results || [];
      setItems(rows);
    } catch (e) {
      console.error(e);
      setError("Failed to load webhooks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const openNewModal = () => {
    setForm(EMPTY_FORM);
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (wh) => {
    setForm({
      id: wh.id,
      name: wh.name || "",
      url: wh.url || "",
      event_type: wh.event_type || "import.completed",
      enabled: !!wh.enabled,
    });
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSaving(false);
    setForm(EMPTY_FORM);
  };

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const saveWebhook = async () => {
    if (!form.url.trim()) {
      setError("URL is required.");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      url: form.url.trim(),
      event_type: form.event_type,
      enabled: form.enabled,
    };

    try {
      const isEdit = !!form.id;
      const url = isEdit ? `/api/webhooks/${form.id}/` : "/api/webhooks/";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save webhook");
      }

      await fetchWebhooks();
      closeModal();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to save webhook.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (wh) => {
    try {
      const res = await fetch(`/api/webhooks/${wh.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !wh.enabled }),
      });
      if (!res.ok) throw new Error();
      await fetchWebhooks();
    } catch (e) {
      console.error(e);
      setError("Failed to toggle enabled.");
    }
  };

  const testWebhook = async (wh) => {
    setTestingId(wh.id);
    setError("");
    try {
      const res = await fetch(`/api/webhooks/${wh.id}/test/`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Test failed");
      }
      await fetchWebhooks();
    } catch (e) {
      console.error(e);
      setError(e.message || "Webhook test failed.");
    } finally {
      setTestingId(null);
    }
  };

  const confirmDelete = (wh) => {
    setDeleteTarget(wh);
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/webhooks/${deleteTarget.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setDeleteTarget(null);
      await fetchWebhooks();
    } catch (e) {
      console.error(e);
      setError("Failed to delete webhook.");
    }
  };

  const renderLastTest = (wh) => {
    if (!wh.last_status && !wh.last_response_time_ms) return "—";
    if (wh.last_status && wh.last_response_time_ms) {
      return `${wh.last_status} • ${wh.last_response_time_ms} ms`;
    }
    if (wh.last_status) return String(wh.last_status);
    return "—";
  };

  // --------------------------------------------------
  // render
  // --------------------------------------------------
  return (
    <div className="card webhooks-card">
      <div
        className="flex-between"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div>
          <h2 className="title" style={{ margin: 0, fontSize: 18 }}>
            Webhooks
          </h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Configure callbacks for product and import events.
          </p>
        </div>
        <button className="btn primary" type="button" onClick={openNewModal}>
          + Add Webhook
        </button>
      </div>

      {error && (
        <div
          className="note"
          style={{ marginTop: 6, color: "#fecaca", fontSize: 13 }}
        >
          {error}
        </div>
      )}

      <div className="table webhook-table" style={{ marginTop: 10 }}>
        <div className="table-head">
          <div>Name</div>
          <div>URL</div>
          <div>Event</div>
          <div>Enabled</div>
          <div>Last test</div>
          <div className="col-actions">Actions</div>
        </div>
        <div className="table-body">
          {loading ? (
            <div className="empty">Loading…</div>
          ) : items.length === 0 ? (
            <div className="empty">No webhooks yet. Add one to get started.</div>
          ) : (
            items.map((wh) => (
              <div className="table-row" key={wh.id}>
                {/* Name column */}
                <div>{wh.name || "—"}</div>

                {/* URL */}
                <div className="webhook-url-cell">
                  {wh.url}
                </div>

                {/* Event */}
                <div>{wh.event_type}</div>

                {/* Enabled */}
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!wh.enabled}
                      onChange={() => toggleEnabled(wh)}
                    />
                    Enabled
                  </label>
                </div>

                {/* Last test */}
                <div>{renderLastTest(wh)}</div>

                {/* Actions */}
                <div className="col-actions">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => openEditModal(wh)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => testWebhook(wh)}
                    disabled={testingId === wh.id}
                  >
                    {testingId === wh.id ? "Testing…" : "Test"}
                  </button>
                  <button
                    className="btn danger"
                    type="button"
                    onClick={() => confirmDelete(wh)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18 }}>
                {form.id ? "Edit Webhook" : "Add Webhook"}
              </h3>
              <p className="muted" style={{ marginTop: 4 }}>
                Webhook calls are sent as JSON POST requests.
              </p>
            </div>

            <div
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <label>
                <div className="muted">Name</div>
                <input
                  className="input"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Demo webhook"
                />
              </label>

              <label>
                <div className="muted">URL</div>
                <input
                  className="input"
                  type="url"
                  value={form.url}
                  onChange={(e) => handleChange("url", e.target.value)}
                  placeholder="https://example.com/webhook"
                />
              </label>

              <label>
                <div className="muted">Event</div>
                <select
                  className="input"
                  value={form.event_type}
                  onChange={(e) => handleChange("event_type", e.target.value)}
                >
                  <option value="import.completed">Import completed</option>
                </select>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => handleChange("enabled", e.target.checked)}
                />
                <span className="muted">Enabled</span>
              </label>

              {error && (
                <div style={{ color: "#fecaca", fontSize: 13 }}>{error}</div>
              )}
            </div>

            <div
              style={{
                padding: 12,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button className="btn" type="button" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={saveWebhook}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal">
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18 }}>Delete webhook</h3>
            </div>
            <div style={{ padding: 16 }}>
              <p>
                Are you sure you want to delete{" "}
                <strong>{deleteTarget.name || deleteTarget.url}</strong>?
              </p>
              <p className="muted">This action cannot be undone.</p>
            </div>
            <div
              style={{
                padding: 12,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button className="btn" type="button" onClick={cancelDelete}>
                Cancel
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={performDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
