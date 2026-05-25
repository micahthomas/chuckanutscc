import { useEffect, useRef } from "react";

interface Props {
  lat: number;
  lng: number;
  label?: string;
  zoom?: number;
  /** CSS height for the map container. */
  height?: string;
}

/**
 * Leaflet-backed map with satellite imagery from ESRI World Imagery (free,
 * no key, no attribution token required for low traffic). Includes a toggle
 * to switch to OpenStreetMap streets.
 *
 * Leaflet is dynamically imported inside the effect so SSR never touches the
 * `window` reference at its module scope.
 */
export default function SatelliteMap({
  lat,
  lng,
  label,
  zoom = 17,
  height = "100%",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      // Inline SVG pin — avoids shipping Leaflet's bundled PNG markers,
      // which Vite/Astro don't resolve from leaflet's CSS automatically.
      const pinIcon = L.divIcon({
        className: "satellite-map-pin",
        html: `<svg viewBox="0 0 24 36" width="34" height="51" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0c6.6 0 12 5.4 12 12 0 9-12 24-12 24S0 21 0 12C0 5.4 5.4 0 12 0z"
            fill="#dc2626" stroke="white" stroke-width="2"/>
          <circle cx="12" cy="12" r="4.5" fill="white"/>
        </svg>`,
        iconSize: [34, 51],
        iconAnchor: [17, 51],
      });

      const satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution:
            "Imagery © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        },
      );

      const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      });

      const m = L.map(containerRef.current, {
        center: [lat, lng],
        zoom,
        layers: [satellite],
        scrollWheelZoom: false,
      });

      L.control
        .layers(
          { "Satellite": satellite, "Streets": streets },
          undefined,
          { position: "topright", collapsed: false },
        )
        .addTo(m);

      L.marker([lat, lng], { icon: pinIcon, title: label ?? "" }).addTo(m);

      map = m;
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, zoom, label]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      aria-label={label ? `Map of ${label}` : "Map"}
    />
  );
}
