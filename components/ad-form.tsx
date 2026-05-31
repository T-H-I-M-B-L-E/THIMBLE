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

// Flat dark palette — mirrors app/admin/_ui.tsx so the ad form matches the
// rest of the admin surface.
const C = {
  surface: "#141416",
  bg: "#0a0a0b",
  line: "#232326",
  text: "#ededef",
  dim: "#8a8a90",
  faint: "#5a5a60",
  accent: "#e5b94e",
  red: "#f0616d",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em",
  color: C.faint, fontWeight: 600, display: "block", marginBottom: 6,
};

const fieldInputStyle: React.CSSProperties = {
  width: "100%", background: C.bg, border: `1px solid ${C.line}`,
  borderRadius: 8, padding: "10px 12px", fontSize: 13, color: C.text,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

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
      <div>
        <label style={labelStyle}>Title *</label>
        <input style={fieldInputStyle} value={values.title} onChange={set("title")} required placeholder="Ad headline" />
      </div>

      <div>
        <label style={labelStyle}>Sponsor Name *</label>
        <input style={fieldInputStyle} value={values.sponsorName} onChange={set("sponsorName")} required placeholder="Brand or company name" />
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          style={{ ...fieldInputStyle, resize: "vertical" }}
          value={values.description}
          onChange={set("description")}
          placeholder="Short ad copy (optional)"
          rows={3}
        />
      </div>

      <div>
        <label style={labelStyle}>Image *</label>

        {/* Preview / upload zone */}
        {values.imageUrl ? (
          <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
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
              width: "100%", height: 120, border: `2px dashed ${C.line}`,
              borderRadius: 8, background: C.bg, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
              color: C.dim, fontSize: 13,
            }}
          >
            {imageUploading ? (
              <>
                <div className="animate-spin" style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${C.line}`, borderTopColor: C.accent }} />
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
          style={{ ...fieldInputStyle, marginTop: 8 }}
          value={values.imageUrl}
          onChange={set("imageUrl")}
          placeholder="…or paste an image URL"
        />
      </div>

      <div>
        <label style={labelStyle}>Video URL</label>
        <input style={fieldInputStyle} value={values.videoUrl} onChange={set("videoUrl")} placeholder="https://... (optional)" />
      </div>

      <div>
        <label style={labelStyle}>Redirect URL *</label>
        <input style={fieldInputStyle} value={values.redirectUrl} onChange={set("redirectUrl")} required placeholder="https://..." />
      </div>

      <div>
        <label style={labelStyle}>Placement</label>
        <select style={{ ...fieldInputStyle, cursor: "pointer" }} value={values.placement} onChange={set("placement")}>
          {PLACEMENTS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Start Date *</label>
          <input style={fieldInputStyle} type="date" value={values.startDate} onChange={set("startDate")} required />
        </div>
        <div>
          <label style={labelStyle}>End Date *</label>
          <input style={fieldInputStyle} type="date" value={values.endDate} onChange={set("endDate")} required />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: C.text }}>
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={set("isActive")}
          style={{ width: 16, height: 16, accentColor: C.accent }}
        />
        Active (visible in feed immediately)
      </label>

      {error && (
        <p style={{ fontSize: 13, color: C.red, margin: 0 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={saving || imageUploading}
        style={{
          alignSelf: "flex-start", padding: "10px 18px", background: C.accent,
          color: "#1a1400", border: "none", borderRadius: 8, fontSize: 13,
          fontWeight: 600, cursor: saving || imageUploading ? "not-allowed" : "pointer",
          opacity: saving || imageUploading ? 0.5 : 1,
        }}
      >
        {saving ? "Saving…" : imageUploading ? "Uploading image…" : submitLabel}
      </button>
    </form>
  );
}
