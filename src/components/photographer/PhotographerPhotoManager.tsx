import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
 * Grid view for the photographer's existing uploads on a single event.
 *
 * Reordering modes (all converge on the same bulk-reorder POST):
 *   - Drag the photo tile to a new slot (pointer + keyboard via dnd-kit).
 *   - "Top" / "Bottom" buttons to jump in one click — important when the
 *     grid has hundreds of items.
 *   - Up/Down arrows for one-slot nudges.
 *
 * Hide toggles status between live and hidden via its own endpoint.
 */
export default function PhotographerPhotoManager({ token, eventId, initialPhotos }: Props) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [reorderError, setReorderError] = useState<string | null>(null);

  const sensors = useSensors(
    // 8px activation distance so a click on Hide/arrow buttons doesn't start a
    // drag accidentally.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => photos.map((p) => p.id), [photos]);

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

  /**
   * Send the new ordering to the server. Optimistic: state has already been
   * updated by the caller, so on a failure we roll back to `previous`.
   */
  async function commitOrder(next: InitialPhoto[], previous: InitialPhoto[]) {
    setReorderError(null);
    try {
      const res = await fetch(`/api/p/${token}/${eventId}/photos/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: next.map((p) => p.id) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Reorder failed (${res.status})`);
      }
    } catch (err) {
      setPhotos(previous);
      setReorderError(err instanceof Error ? err.message : String(err));
    }
  }

  function moveToTop(id: string) {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const next = [prev[idx]!, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      void commitOrder(next, prev);
      return next;
    });
  }

  function moveToBottom(id: string) {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0 || idx === prev.length - 1) return prev;
      const next = [...prev.slice(0, idx), ...prev.slice(idx + 1), prev[idx]!];
      void commitOrder(next, prev);
      return next;
    });
  }

  function moveStep(id: string, direction: "up" | "down") {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || swap < 0 || swap >= prev.length) return prev;
      const next = arrayMove(prev, idx, swap);
      void commitOrder(next, prev);
      return next;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setPhotos((prev) => {
      const fromIdx = prev.findIndex((p) => p.id === active.id);
      const toIdx = prev.findIndex((p) => p.id === over.id);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = arrayMove(prev, fromIdx, toIdx);
      void commitOrder(next, prev);
      return next;
    });
  }

  if (photos.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        No photos yet. Use the uploader above to add some.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs text-zinc-400 mb-3">
        Drag a photo to reorder, or use the buttons to jump to the top or bottom.
      </p>
      {reorderError && (
        <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {reorderError}
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p, idx) => (
              <SortablePhoto
                key={p.id}
                photo={p}
                isBusy={busy.has(p.id)}
                isFirst={idx === 0}
                isLast={idx === photos.length - 1}
                onToggleHide={() => toggleHide(p.id)}
                onMoveTop={() => moveToTop(p.id)}
                onMoveBottom={() => moveToBottom(p.id)}
                onMoveUp={() => moveStep(p.id, "up")}
                onMoveDown={() => moveStep(p.id, "down")}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface SortablePhotoProps {
  photo: InitialPhoto;
  isBusy: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggleHide: () => void;
  onMoveTop: () => void;
  onMoveBottom: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SortablePhoto({
  photo,
  isBusy,
  isFirst,
  isLast,
  onToggleHide,
  onMoveTop,
  onMoveBottom,
  onMoveUp,
  onMoveDown,
}: SortablePhotoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  });
  const hidden = photo.status === "hidden";
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`border rounded overflow-hidden bg-zinc-900 ${
        hidden ? "border-amber-700 opacity-70" : "border-zinc-800"
      } ${isDragging ? "ring-2 ring-brand-500" : ""}`}
    >
      <div
        className="aspect-square bg-zinc-800 overflow-hidden cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <img
          src={`/media/${photo.r2_key_thumb}`}
          alt={photo.filename}
          className="w-full h-full object-cover pointer-events-none select-none"
          loading="lazy"
          draggable={false}
        />
      </div>
      <div className="p-2 text-xs">
        <div className="truncate text-zinc-200" title={photo.filename}>{photo.filename}</div>
        {hidden && <div className="text-amber-500 text-[10px] mt-0.5">Hidden from gallery</div>}
        <div className="flex items-center justify-between gap-1 mt-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onMoveTop}
              disabled={isBusy || isFirst}
              className="px-1.5 py-0.5 border border-zinc-700 rounded text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
              aria-label="Move to top"
              title="Move to top"
            >
              ⤒
            </button>
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isBusy || isFirst}
              className="px-1.5 py-0.5 border border-zinc-700 rounded text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
              aria-label="Move earlier"
              title="Move earlier"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isBusy || isLast}
              className="px-1.5 py-0.5 border border-zinc-700 rounded text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
              aria-label="Move later"
              title="Move later"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={onMoveBottom}
              disabled={isBusy || isLast}
              className="px-1.5 py-0.5 border border-zinc-700 rounded text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
              aria-label="Move to bottom"
              title="Move to bottom"
            >
              ⤓
            </button>
          </div>
          <button
            type="button"
            onClick={onToggleHide}
            disabled={isBusy}
            className={`text-xs ${hidden ? "text-emerald-400" : "text-amber-400"} hover:underline disabled:opacity-50`}
          >
            {hidden ? "Show" : "Hide"}
          </button>
        </div>
      </div>
    </li>
  );
}
