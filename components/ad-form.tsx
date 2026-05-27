"use client";

import { useState } from "react";

export interface AdFormValues {
  title: string;
  sponsorName: string;
  description: string;
  imageUrl: string;
  videoUrl: string;
  redirectUrl: string;
  placement: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

interface AdFormProps {
  initial?: Partial<AdFormValues>;
  onSubmit: (values: AdFormValues) => Promise<void>;
  submitLabel: string;
}

const PLACEMENTS = ["feed", "banner", "sidebar"];

const today = () => new Date().toISOString().slice(0, 10);
const oneMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

export function AdForm({ initial, onSubmit, submitLabel }: AdFormProps) {
  const [values, setValues] = useState<AdFormValues>({
    title: initial?.title ?? "",
    sponsorName: initial?.sponsorName ?? "",
    description: initial?.description ?? "",
    imageUrl: initial?.imageUrl ?? "",
    videoUrl: initial?.videoUrl ?? "",
    redirectUrl: initial?.redirectUrl ?? "",
    placement: initial?.placement ?? "feed",
    isActive: initial?.isActive ?? true,
    startDate: initial?.startDate ?? today(),
    endDate: initial?.endDate ?? oneMonth(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof AdFormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const val = e.target.type === "checkbox"
      ? (e.target as HTMLInputElement).checked
      : e.target.value;
    setValues(v => ({ ...v, [field]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <div className="t-field">
        <label className="t-label">Title *</label>
        <input className="t-input" value={values.title} onChange={set("title")} required placeholder="Ad headline" />
      </div>

      <div className="t-field">
        <label className="t-label">Sponsor Name *</label>
        <input className="t-input" value={values.sponsorName} onChange={set("sponsorName")} required placeholder="Brand or company name" />
      </div>

      <div className="t-field">
        <label className="t-label">Description</label>
        <textarea
          className="t-input"
          value={values.description}
          onChange={set("description")}
          placeholder="Short ad copy (optional)"
          rows={3}
          style={{ resize: "vertical" }}
        />
      </div>

      <div className="t-field">
        <label className="t-label">Image URL *</label>
        <input className="t-input" value={values.imageUrl} onChange={set("imageUrl")} required placeholder="https://..." />
      </div>

      <div className="t-field">
        <label className="t-label">Video URL</label>
        <input className="t-input" value={values.videoUrl} onChange={set("videoUrl")} placeholder="https://... (optional)" />
      </div>

      <div className="t-field">
        <label className="t-label">Redirect URL *</label>
        <input className="t-input" value={values.redirectUrl} onChange={set("redirectUrl")} required placeholder="https://..." />
      </div>

      <div className="t-field">
        <label className="t-label">Placement</label>
        <select className="t-input" value={values.placement} onChange={set("placement")}>
          {PLACEMENTS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="t-field">
          <label className="t-label">Start Date *</label>
          <input className="t-input" type="date" value={values.startDate} onChange={set("startDate")} required />
        </div>
        <div className="t-field">
          <label className="t-label">End Date *</label>
          <input className="t-input" type="date" value={values.endDate} onChange={set("endDate")} required />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={set("isActive")}
          style={{ width: 16, height: 16 }}
        />
        Active (visible in feed immediately)
      </label>

      {error && (
        <p style={{ fontSize: 13, color: "var(--t-danger)", margin: 0 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="t-btn-primary"
        style={{ alignSelf: "flex-start" }}
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
