// Builds the Leaflet inline-HTML map document. Extracted as a pure function so
// the XSS hardening can be exercised by unit tests without rendering RN.
//
// SECURITY: event titles originate from scraped sources (untrusted). Marker
// data is serialized as a JSON blob and rendered into the DOM via textContent
// — never interpolated into the <script> body as a string. Do not switch back
// to template-string concatenation; that opens stored XSS via crafted titles.

import { DANCE_STYLE_COLORS, DANCE_STYLE_LABELS } from "@/shared/constants";

export interface MapEvent {
  latitude: string | number | null | undefined;
  longitude: string | number | null | undefined;
  title?: string | null;
  danceStyle?: string | null;
  // True when the coordinates are a city-center fallback rather than the
  // actual venue location. Rendered with a dashed, faded marker.
  approx?: boolean;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
}

export function buildMapHtml(events: MapEvent[], region: MapRegion): string {
  const markerData = events.map((ev) => ({
    lat: Number(ev.latitude),
    lng: Number(ev.longitude),
    color: DANCE_STYLE_COLORS[ev.danceStyle ?? "other"] ?? "#718096",
    title: String(ev.title ?? ""),
    style: DANCE_STYLE_LABELS[ev.danceStyle ?? "other"] ?? "Dance",
    approx: ev.approx === true,
  }));

  // Embed inside <script type="application/json"> — `</script` in the data is
  // neutralized by escaping `<` to its < form so the JSON block can never
  // be terminated early.
  const json = JSON.stringify(markerData).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head><body>
<div id="map"></div>
<script id="markers" type="application/json">${json}</script>
<script>
var map = L.map('map').setView([${Number(region.latitude)}, ${Number(region.longitude)}], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
  maxZoom: 18
}).addTo(map);
var data = JSON.parse(document.getElementById('markers').textContent);
data.forEach(function(m) {
  if (!isFinite(m.lat) || !isFinite(m.lng)) return;
  var popup = document.createElement('div');
  var b = document.createElement('b'); b.textContent = m.title; popup.appendChild(b);
  popup.appendChild(document.createElement('br'));
  var s = document.createElement('small');
  s.textContent = m.approx ? m.style + ' \\u00b7 approximate area' : m.style;
  popup.appendChild(s);
  var opts = m.approx
    ? {radius: 9, fillColor: m.color, color: '#fff', weight: 1.5, dashArray: '3 3', opacity: 0.9, fillOpacity: 0.45}
    : {radius: 8, fillColor: m.color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9};
  L.circleMarker([m.lat, m.lng], opts).addTo(map).bindPopup(popup);
});
</script>
</body></html>`;
}
