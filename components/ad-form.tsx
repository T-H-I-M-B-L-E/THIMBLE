"use client";

import { useState, useRef } from "react";
import { ImageIcon, X } from "lucide-react";
import { uploadFile } from "@/lib/upload";

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
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof AdFormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const val = e.target.type === "checkbox"
      ? (e.target as HTMLInputElement).checked
      : e.target.value;
    setValues(v => ({ ...v, [field]: val }));
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImageUploading(true);
    setImageProgress(1);
    try {
      const url = await uploadFile(file, (p) => setImageProgress(p), "posts");
      setValues(v => ({ ...v, imageUrl: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setImageUploading(false);
      setImageProgress(0);
    }
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
        <label className="t-label">Image *</label>

        {/* Preview / upload zone */}
        {values.imageUrl ? (
          <div style={{ position: "relative", display: "inline-block" }}>
            <img
              src={values.imageUrl}
              alt="Ad preview"
              style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, display: "block" }}
            />
            <button
              type="button"
              onClick={() => setValues(v => ({ ...v, imageUrl: "" }))}
              style={{
                position: "absolute", top: 6, right: 6,
                background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
                width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="Remove image"
            >
              <X size={13} color="#fff" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: "absolute", bottom: 6, right: 6,
                background: "rgba(0,0,0,0.6)", border: "none", borderRadius: 6,
                padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#fff",
              }}
            >
              Replace
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={imageUploading}
            style={{
              width: "100%", height: 120, border: "2px dashed var(--t-line)",
              borderRadius: 8, background: "var(--t-surface-2)", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
              color: "var(--t-ink-3)", fontSize: 13,
            }}
          >
            {imageUploading ? (
              <>
                <div className="animate-spin" style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--t-line)", borderTopColor: "var(--t-gold)" }} />
                <span>{imageProgress}%</span>
              </>
            ) : (
              <>
                <ImageIcon size={22} />
                <span>Click to upload from device</span>
              </>
            )}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageFile}
        />

        {/* Fallback: paste a URL directly */}
        <input
          className="t-input"
          value={values.imageUrl}
          onChange={set("imageUrl")}
          placeholder="…or paste an image URL"
          style={{ marginTop: 8 }}
        />
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
        disabled={saving || imageUploading}
        className="t-btn-primary"
        style={{ alignSelf: "flex-start" }}
      >
        {saving ? "Saving…" : imageUploading ? "Uploading image…" : submitLabel}
      </button>
    </form>
  );
}
