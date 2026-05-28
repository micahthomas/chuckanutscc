import { useId, useRef, useState } from "react";
import { resizeToWebP } from "~/lib/client-images";

interface Props {
  /** Form input name — a hidden text input ends up with the chosen R2 key. */
  name: string;
  /** Upload category. Must match an entry in /admin/api/upload's ALLOWED_CATEGORIES. */
  category:
    | "venue-map"
    | "course-map"
    | "event-hero"
    | "merch"
    | "photographer-headshot";
  /** Current R2 key (already-saved value, shows a preview). */
  defaultValue?: string | null;
  /** Public-side label, e.g. "Course map". */
  label: string;
  /** Optional helper text under the label. */
  hint?: string;
  /** Max pixel width to resize down to before upload. Defaults to 2400. */
  maxWidth?: number;
}

/**
 * Image upload with client-side resize. Picks a file, draws it to a canvas
 * at maxWidth, exports as WebP, posts to /admin/api/upload, and stores the
 * returned R2 key in a hidden input so the surrounding form can save it.
 *
 * The hidden input also doubles as a "remove" mechanism — clicking Remove
 * just clears the input + preview without deleting the R2 object (orphan
 * cleanup is a v2 problem).
 */
export default function ImageUpload({
  name,
  category,
  defaultValue,
  label,
  hint,
  maxWidth = 2400,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState(defaultValue ?? "");
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handlePick(file: File) {
    setStatus("uploading");
    setError(null);
    try {
      const { blob } = await resizeToWebP(file, maxWidth);
      const body = new FormData();
      body.set("file", blob, "upload.webp");
      body.set("category", category);
      const res = await fetch("/admin/api/upload", { method: "POST", body });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `Upload failed (${res.status})`);
      }
      const json = (await res.json()) as { key: string };
      setKey(json.key);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  function handleRemove() {
    setKey("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="block">
      <div className="flex items-baseline justify-between">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        {key && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-red-600 hover:underline"
          >
            Remove
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-slate-400 mt-0.5 mb-1">{hint}</p>}

      <input type="hidden" name={name} value={key} />

      {key && (
        <div className="mt-2 mb-3 border border-slate-200 rounded overflow-hidden bg-slate-50">
          <img
            src={`/media/${key}`}
            alt=""
            className="block w-full max-h-72 object-contain bg-slate-100"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={status === "uploading"}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) handlePick(f);
          }}
          className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0
                     file:bg-brand-700 file:text-white file:font-medium
                     file:hover:bg-brand-900 file:cursor-pointer"
        />
        {status === "uploading" && (
          <span className="text-xs text-slate-500">Uploading…</span>
        )}
        {status === "error" && (
          <span className="text-xs text-red-600">{error}</span>
        )}
      </div>
    </div>
  );
}

