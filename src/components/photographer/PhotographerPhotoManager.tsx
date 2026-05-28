import { useState } from "react";

interface InitialPhoto {
  id: string;
  filename: string;
  r2_key_thumb: string;
  status: string;
}

interface Props {
  token: string;
  eventId: string;
  initialPhotos: InitialPhoto[];
}

/**
 * Grid view for the photographer's existing uploads on a single event. They
 * can hide (toggle live/hidden) and reorder via up/down arrows. Each action
 * fires a small fetch to a sibling /api/p/[token]/[eventId]/photos/* route
 * and updates local state on success.
 */
export default function PhotographerPhotoManager({ token, eventId, initialPhotos }: Props) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  function markBusy(id: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function toggleHide(id: string) {
    markBusy(id, true);
    try {
      const res = await fetch(`/api/p/${token}/${eventId}/photos/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: id }),
      });
      if (!res.ok) throw new Error(`Hide failed (${res.status})`);
      const j = (await res.json()) as { status: string };
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, status: j.status } : p)));
    } finally {
      markBusy(id, false);
    }
  }

  async function move(id: string, direction: "up" | "down") {
    markBusy(id, true);
    try {
      const res = await fetch(`/api/p/${token}/${eventId}/photos/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: id, direction }),
      });
      if (!res.ok) throw new Error(`Reorder failed (${res.status})`);
      const j = (await res.json()) as { moved: boolean };
      if (j.moved) {
        setPhotos((prev) => {
          const idx = prev.findIndex((p) => p.id === id);
          const swap = direction === "up" ? idx - 1 : idx + 1;
          if (idx < 0 || swap < 0 || swap >= prev.length) return prev;
          const copy = prev.slice();
          [copy[idx], copy[swap]] = [copy[swap]!, copy[idx]!];
          return copy;
        });
      }
    } finally {
      markBusy(id, false);
    }
  }

  if (photos.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No photos yet. Use the uploader above to add some.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((p, idx) => {
        const isBusy = busy.has(p.id);
        const hidden = p.status === "hidden";
        return (
          <li
            key={p.id}
            className={`border rounded overflow-hidden bg-white ${
              hidden ? "border-amber-300 opacity-70" : "border-slate-200"
            }`}
          >
            <div className="aspect-square bg-slate-100 overflow-hidden">
              <img
                src={`/media/${p.r2_key_thumb}`}
                alt={p.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="p-2 text-xs">
              <div className="truncate text-slate-700" title={p.filename}>{p.filename}</div>
              {hidden && <div className="text-amber-700 text-[10px] mt-0.5">Hidden from gallery</div>}
              <div className="flex items-center justify-between gap-1 mt-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(p.id, "up")}
                    disabled={isBusy || idx === 0}
                    className="px-1.5 py-0.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                    aria-label="Move earlier"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(p.id, "down")}
                    disabled={isBusy || idx === photos.length - 1}
                    className="px-1.5 py-0.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                    aria-label="Move later"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleHide(p.id)}
                  disabled={isBusy}
                  className={`text-xs ${hidden ? "text-emerald-700" : "text-amber-700"} hover:underline disabled:opacity-50`}
                >
                  {hidden ? "Show" : "Hide"}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
