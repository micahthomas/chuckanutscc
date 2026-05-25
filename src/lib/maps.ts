/**
 * Build an OpenStreetMap embed iframe URL centered on the given coords.
 * Free, no API key, works everywhere. `delta` controls the bbox size in
 * degrees (~0.005 = ~500m at PNW latitudes).
 */
export function osmEmbedUrl(lat: number, lng: number, delta = 0.005): string {
  const left = lng - delta;
  const right = lng + delta;
  const bottom = lat - delta;
  const top = lat + delta;
  const bbox = `${left},${bottom},${right},${top}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;
}

/** "Open in Google Maps" link — drops a pin and lets the user start navigation. */
export function googleMapsDirectionsUrl(lat: number, lng: number, label?: string): string {
  const dest = label ? `${lat},${lng} (${label})` : `${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

/** Pin-only Google Maps link (no directions). */
export function googleMapsPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
