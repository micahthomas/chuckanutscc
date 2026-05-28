import { useId, useRef, useState } from "react";
import { resizeToWebP, readExifTakenAt } from "~/lib/client-images";

interface Props {
  token: string;
  eventId: string;
}

type ItemStatus = "queued" | "processing" | "uploading" | "done" | "error";

interface Item {
  id: number;
  name: string;
  bytes: number;
  status: ItemStatus;
  error?: string;
}

const CONCURRENCY = 3;
const THUMB_MAX = 600;
const DISPLAY_MAX = 2400;
const ACCEPTED_EXT = /\.(jpe?g|png|webp|heic|heif|avif)$/i;

/**
 * Photographer-facing uploader. Accepts drag-drop, multi-select file picker,
 * and ZIP archives (streamed via @zip.js/zip.js — handles multi-GB archives
 * without loading them into memory). Each accepted image is decoded, EXIF-
 * read for capture time, resized to thumb (600px) + display (2400px), then
 * POSTed to the secret-URL upload endpoint along with the original.
 *
 * Concurrency is capped at 3 in-flight uploads so we don't melt the
 * photographer's wifi or hammer the Worker.
 */
export default function PhotographerUploader({ token, eventId }: Props) {
  const inputId = useId();
  const dropRef = useRef<HTMLLabelElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [draggingOver, setDraggingOver] = useState(false);
  const [zipProgress, setZipProgress] = useState<{
    name: string;
    extracted: number;
    total: number;
  } | null>(null);

  // Mutable queue/active counter held in refs so handlers don't fight React
  // state batching when several files resolve in quick succession.
  const queueRef = useRef<Array<{ id: number; source: () => Promise<Blob>; name: string }>>([]);
  const activeRef = useRef(0);
  const nextIdRef = useRef(1);

  function updateItem(id: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function enqueueImage(source: () => Promise<Blob>, name: string, bytes: number) {
    const id = nextIdRef.current++;
    setItems((prev) => [...prev, { id, name, bytes, status: "queued" }]);
    queueRef.current.push({ id, source, name });
    pump();
  }

  async function pump() {
    while (activeRef.current < CONCURRENCY && queueRef.current.length > 0) {
      const job = queueRef.current.shift()!;
      activeRef.current++;
      processOne(job)
        .catch((err) => {
          updateItem(job.id, { status: "error", error: err instanceof Error ? err.message : String(err) });
        })
        .finally(() => {
          activeRef.current--;
          pump();
        });
    }
  }

  async function processOne(job: { id: number; source: () => Promise<Blob>; name: string }) {
    updateItem(job.id, { status: "processing" });
    const blob = await job.source();

    const [{ blob: thumbBlob }, { blob: displayBlob, width, height }, exifSec] = await Promise.all([
      resizeToWebP(blob, THUMB_MAX, 0.75),
      resizeToWebP(blob, DISPLAY_MAX, 0.82),
      readExifTakenAt(blob),
    ]);

    updateItem(job.id, { status: "uploading" });

    const body = new FormData();
    body.set("thumb",   new File([thumbBlob],   "thumb.webp",   { type: "image/webp" }));
    body.set("display", new File([displayBlob], "display.webp", { type: "image/webp" }));
    body.set("full",    new File([blob], job.name, { type: blob.type || "application/octet-stream" }));
    body.set("filename", job.name);
    if (width > 0)  body.set("width",  String(width));
    if (height > 0) body.set("height", String(height));
    if (exifSec !== null) body.set("exif_taken_at", String(exifSec));

    const res = await fetch(`/api/p/${token}/${eventId}/upload`, { method: "POST", body });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(j?.error ?? `Upload failed (${res.status})`);
    }
    updateItem(job.id, { status: "done" });
  }

  async function handleFiles(files: File[]) {
    for (const file of files) {
      if (/\.zip$/i.test(file.name) || file.type === "application/zip") {
        await ingestZip(file);
      } else if (ACCEPTED_EXT.test(file.name) || file.type.startsWith("image/")) {
        await enqueueImage(async () => file, file.name, file.size);
      }
    }
  }

  async function ingestZip(zipFile: File) {
    // Dynamic import so the zip.js bundle only loads when actually needed.
    const { ZipReader, BlobReader, BlobWriter } = await import("@zip.js/zip.js");
    type FileEntry = Awaited<ReturnType<InstanceType<typeof ZipReader>["getEntries"]>>[number] & { directory: false };
    const reader = new ZipReader(new BlobReader(zipFile));
    try {
      const entries = await reader.getEntries();
      const imageEntries = entries.filter(
        (e): e is FileEntry => !e.directory && ACCEPTED_EXT.test(e.filename),
      );
      setZipProgress({ name: zipFile.name, extracted: 0, total: imageEntries.length });
      for (let i = 0; i < imageEntries.length; i++) {
        const entry = imageEntries[i]!;
        // Closure over `entry` so the data only loads when this job runs.
        const name = entry.filename.split("/").pop() || entry.filename;
        await enqueueImage(
          async () => (await entry.getData(new BlobWriter())) as Blob,
          name,
          entry.uncompressedSize,
        );
        setZipProgress({ name: zipFile.name, extracted: i + 1, total: imageEntries.length });
      }
    } finally {
      await reader.close().catch(() => {});
    }
    // Clear the banner once everything's queued; per-file progress takes over.
    setZipProgress(null);
  }

  function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.currentTarget.files ?? []);
    e.currentTarget.value = "";
    handleFiles(files);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDraggingOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    // Only clear when the drag leaves the dropzone itself, not when crossing
    // into a child element.
    if (e.target === dropRef.current) setDraggingOver(false);
  }

  const inFlight = items.some((i) => i.status === "queued" || i.status === "processing" || i.status === "uploading");
  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  return (
    <div>
      <label
        ref={dropRef}
        htmlFor={inputId}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
          draggingOver ? "border-brand-700 bg-brand-50" : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        <input
          id={inputId}
          type="file"
          multiple
          accept="image/*,.zip"
          className="hidden"
          onChange={onPicked}
        />
        <div className="text-base font-medium text-slate-700">
          Drop photos or a ZIP here
        </div>
        <div className="text-sm text-slate-500 mt-1">
          or <span className="text-brand-700 underline">click to pick files</span>
        </div>
        <div className="text-xs text-slate-400 mt-3">
          JPEG, PNG, WebP, HEIC, AVIF — or any ZIP containing them
        </div>
      </label>

      {zipProgress && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3 text-sm">
          Reading <span className="font-mono">{zipProgress.name}</span> —{" "}
          {zipProgress.extracted} of {zipProgress.total} photos found
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-700">
              {doneCount} of {items.length} uploaded
              {errorCount > 0 && <span className="text-red-600"> · {errorCount} failed</span>}
            </span>
            {!inFlight && (
              <button
                type="button"
                onClick={() => {
                  setItems([]);
                  // Reload to surface the new photos in the manager grid below.
                  window.location.reload();
                }}
                className="text-sm text-brand-700 hover:underline"
              >
                Done — refresh
              </button>
            )}
          </div>
          <ul className="max-h-64 overflow-auto border border-slate-200 rounded bg-white divide-y divide-slate-100 text-sm">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate flex-1 text-slate-700">{it.name}</span>
                <span className="shrink-0 text-xs">
                  {it.status === "queued" && <span className="text-slate-400">queued</span>}
                  {it.status === "processing" && <span className="text-slate-500">resizing…</span>}
                  {it.status === "uploading" && <span className="text-blue-600">uploading…</span>}
                  {it.status === "done" && <span className="text-emerald-700">✓ uploaded</span>}
                  {it.status === "error" && (
                    <span className="text-red-600" title={it.error}>✗ {it.error?.slice(0, 40)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
