import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface MosaicPhoto {
  id: string;
  thumb: string;        // R2 key
  display: string;      // R2 key
  full: string;         // R2 key
  photographer: string;
  photographerSlug: string;
  eventTitle: string;
  eventSlug: string;
  width: number | null;
  height: number | null;
}

interface Props {
  photos: MosaicPhoto[];
  /** When true, hides per-photo event/photographer captions — used on per-event pages. */
  hideEventLabel?: boolean;
  /**
   * Cap the number of thumbnails rendered in the mosaic. The lightbox can
   * still navigate the full `photos` array — useful when a page wants to
   * preview a subset but let users browse everything from the lightbox.
   */
  previewLimit?: number;
}

/**
 * CSS-columns mosaic of photo thumbs + a portal-mounted lightbox with
 * keyboard nav (Esc / ← / →) and a thumbnail strip that auto-scrolls to the
 * current photo. Neighbors are preloaded so navigation feels instant.
 */
export default function PhotoMosaic({ photos, hideEventLabel = false, previewLimit }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return <p className="text-slate-500">No photos yet.</p>;
  }

  const visiblePhotos = previewLimit ? photos.slice(0, previewLimit) : photos;

  return (
    <>
      <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-2 [column-fill:_balance]">
        {visiblePhotos.map((ph, i) => {
          const ratio =
            ph.width && ph.height ? `${ph.width} / ${ph.height}` : "4 / 3";
          return (
            <button
              key={ph.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="mb-2 block w-full break-inside-avoid overflow-hidden rounded bg-slate-100 group"
              style={{ aspectRatio: ratio }}
              aria-label={`Open photo by ${ph.photographer}`}
            >
              <img
                src={`/media/${ph.thumb}`}
                alt={`Photo by ${ph.photographer}`}
                loading="lazy"
                className="block h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </button>
          );
        })}
      </div>

      {openIndex !== null && (
        <Lightbox
          photos={photos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNav={setOpenIndex}
          hideEventLabel={hideEventLabel}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

interface LightboxProps {
  photos: MosaicPhoto[];
  index: number;
  onClose: () => void;
  onNav: (idx: number) => void;
  hideEventLabel: boolean;
}

function Lightbox({ photos, index, onClose, onNav, hideEventLabel }: LightboxProps) {
  const current = photos[index];
  const stripRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement>(null);

  const next = () => onNav((index + 1) % photos.length);
  const prev = () => onNav((index - 1 + photos.length) % photos.length);

  // Keyboard nav.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Auto-scroll the thumb strip to keep the current photo in view.
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [index]);

  // Preload neighbors for snappy nav.
  const preloadKeys = useMemo(() => {
    const nextI = (index + 1) % photos.length;
    const prevI = (index - 1 + photos.length) % photos.length;
    return [photos[nextI]?.display, photos[prevI]?.display].filter(Boolean) as string[];
  }, [index, photos]);

  return createPortal(
    // z-[9999] sits above Leaflet's tile and control panes (which top out
    // around z-index 1000) — needed for events with an embedded map below.
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95 text-white"
      onClick={(e) => {
        // Click backdrop (not the image / controls) closes.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top bar */}
      <div className="flex items-start justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="text-sm">
          {!hideEventLabel && (
            <div className="font-medium">
              <a href={`/events/${current.eventSlug}`} className="hover:underline">
                {current.eventTitle}
              </a>
            </div>
          )}
          <div className="text-white/70 text-xs">
            Photo by{" "}
            <a href={`/photographers/${current.photographerSlug}`} className="hover:underline">
              {current.photographer}
            </a>
            {" · "}
            <span>{index + 1} / {photos.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/media/${current.full}`}
            target="_blank"
            rel="noopener"
            className="px-2 py-1 text-xs rounded border border-white/30 hover:bg-white/10"
          >
            Open original
          </a>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xl leading-none"
            aria-label="Close lightbox"
          >
            ×
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 relative flex items-center justify-center min-h-0">
        {/* Prev/Next buttons */}
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-2xl"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-2xl"
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}

        <img
          key={current.id}
          src={`/media/${current.display}`}
          alt={`Photo by ${current.photographer}`}
          className="max-h-full max-w-full object-contain px-16"
        />
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div
          ref={stripRef}
          className="flex gap-2 overflow-x-auto px-4 py-3 bg-gradient-to-t from-black/80 to-transparent"
        >
          {photos.map((ph, i) => (
            <button
              key={ph.id}
              ref={i === index ? activeThumbRef : undefined}
              onClick={() => onNav(i)}
              className={`shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-colors ${
                i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
              }`}
              aria-label={`Show photo ${i + 1}`}
            >
              <img
                src={`/media/${ph.thumb}`}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Hidden preload images */}
      <div aria-hidden="true" className="hidden">
        {preloadKeys.map((k) => (
          <img key={k} src={`/media/${k}`} alt="" />
        ))}
      </div>
    </div>,
    document.body,
  );
}
