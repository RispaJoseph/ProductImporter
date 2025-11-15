import React from "react";

/**
 * ConfirmDialog
 * Props:
 * - open: boolean
 * - title: string (optional)
 * - message: string
 * - confirmLabel: string (optional) default "Delete"
 * - cancelLabel: string (optional) default "Cancel"
 * - onConfirm: () => void
 * - onCancel: () => void
 * - loading?: boolean (optional) - disables buttons & shows "Deleting..."
 */

export default function ConfirmDialog({
  open,
  title = "Please confirm",
  message = "Are you sure?",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>
        </div>

        <div style={{ marginBottom: 16, color: "#cfeffd" }}>
          {message}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className="btn danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* styles (inline so you don't need to edit CSS) */
const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1300,
};

const dialogStyle = {
  width: "520px",
  maxWidth: "94%",
  borderRadius: 10,
  background: "#071026",
  padding: 18,
  boxShadow: "0 8px 40px rgba(2,6,23,0.6)",
};
