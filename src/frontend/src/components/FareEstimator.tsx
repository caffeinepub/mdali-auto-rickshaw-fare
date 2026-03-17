import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Clock,
  Loader2,
  MapPin,
  Moon,
  Navigation,
  Route,
  Sun,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LatLng {
  lat: number;
  lng: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteInfo {
  distance: number; // km
  durationMin: number; // minutes
  isEstimate: boolean;
  polyline?: [number, number][];
}

declare global {
  interface Window {
    L: LeafletLib;
  }
}

// Minimal Leaflet typings for CDN usage
interface LeafletLib {
  map: (el: HTMLElement, opts?: object) => LeafletMap;
  tileLayer: (url: string, opts?: object) => LeafletLayer;
  marker: (latlng: [number, number], opts?: object) => LeafletMarker;
  polyline: (latlngs: [number, number][], opts?: object) => LeafletPolyline;
  icon: (opts: object) => LeafletIcon;
  latLngBounds: (a: [number, number], b: [number, number]) => LeafletBounds;
}
interface LeafletMap {
  addLayer: (l: LeafletLayer | LeafletMarker | LeafletPolyline) => void;
  removeLayer: (l: LeafletLayer | LeafletMarker | LeafletPolyline) => void;
  fitBounds: (b: LeafletBounds, opts?: object) => void;
  setView: (latlng: [number, number], zoom: number) => void;
  remove: () => void;
  invalidateSize: () => void;
}
interface LeafletLayer {
  addTo: (m: LeafletMap) => LeafletLayer;
}
interface LeafletMarker {
  addTo: (m: LeafletMap) => LeafletMarker;
  bindPopup: (s: string) => LeafletMarker;
}
interface LeafletPolyline {
  addTo: (m: LeafletMap) => LeafletPolyline;
}
type LeafletIcon = Record<string, never>;
type LeafletBounds = Record<string, never>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BANGALORE = { lat: 12.9716, lng: 77.5946 };

function isNightTime() {
  const h = new Date().getHours();
  return h >= 21 || h < 7;
}

function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLon / 2);
  const c =
    2 *
    Math.asin(
      Math.sqrt(
        sin1 * sin1 +
          Math.cos((a.lat * Math.PI) / 180) *
            Math.cos((b.lat * Math.PI) / 180) *
            sin2 *
            sin2,
      ),
    );
  return R * c;
}

function calcFare(distKm: number, night: boolean) {
  const base = 40;
  const extra = Math.max(0, distKm - 2);
  const rate = night ? 30 : 20;
  const extraCharge = Math.round(extra * rate);
  return { base, extraCharge, rate, total: base + extraCharge };
}

async function fetchNominatim(query: string): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=in`;
  const res = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "BangaloreAutoMeter/1.0",
    },
  });
  return res.json();
}

async function fetchRoute(from: LatLng, to: LatLng): Promise<RouteInfo> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.[0]) {
      const route = data.routes[0];
      const distKm = route.distance / 1000;
      const durationMin = route.duration / 60;
      const coords: [number, number][] = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
      );
      return {
        distance: distKm,
        durationMin,
        isEstimate: false,
        polyline: coords,
      };
    }
  } catch {
    // fallback
  }
  const dist = haversineKm(from, to);
  return {
    distance: dist * 1.3, // road factor estimate
    durationMin: (dist * 1.3) / (20 / 60),
    isEstimate: true,
  };
}

// ─── Leaflet CDN Loader ───────────────────────────────────────────────────────
function useLeafletCDN() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.L) {
      setReady(true);
      return;
    }

    // CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  return ready;
}

// ─── Search Input with Suggestions ────────────────────────────────────────────
function LocationInput({
  id,
  label,
  value,
  placeholder,
  ocid,
  onChange,
  onSelect,
  leftIcon,
  accentColor,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  ocid: string;
  onChange: (v: string) => void;
  onSelect: (r: NominatimResult) => void;
  leftIcon?: React.ReactNode;
  accentColor: string;
}) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(v: string) {
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await fetchNominatim(v);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  function handleSelect(r: NominatimResult) {
    onSelect(r);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="space-y-1.5 relative">
      <Label
        htmlFor={id}
        className="text-xs text-muted-foreground flex items-center gap-1"
      >
        {leftIcon}
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          data-ocid={ocid}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm bg-background/60 border-border/70 pr-8"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 rounded-lg overflow-hidden shadow-xl"
            style={{
              top: "100%",
              marginTop: 4,
              background: "oklch(0.19 0.02 80)",
              border: "1px solid oklch(0.30 0.025 80)",
            }}
          >
            {suggestions.map((s) => (
              <button
                key={s.place_id}
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3 py-2.5 text-xs hover:bg-white/5 transition-colors flex items-start gap-2 border-b border-border/30 last:border-0"
              >
                <MapPin
                  className="w-3 h-3 mt-0.5 shrink-0"
                  style={{ color: accentColor }}
                />
                <span className="text-foreground/85 line-clamp-2">
                  {s.display_name}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function FareEstimator({
  onUseDistance,
}: {
  onUseDistance: (dist: number) => void;
}) {
  const leafletReady = useLeafletCDN();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const pickupMarkerRef = useRef<LeafletMarker | null>(null);
  const dropMarkerRef = useRef<LeafletMarker | null>(null);
  const polylineRef = useRef<LeafletPolyline | null>(null);

  const [pickupText, setPickupText] = useState("Detecting your location...");
  const [dropText, setDropText] = useState("");
  const [pickupLatLng, setPickupLatLng] = useState<LatLng | null>(null);
  const [dropLatLng, setDropLatLng] = useState<LatLng | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [night, setNight] = useState(isNightTime());
  const [speed, setSpeed] = useState<number | null>(null);

  // ── GPS pickup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS not available in this browser.");
      setGpsLoading(false);
      setPickupText("Bangalore, Karnataka");
      setPickupLatLng(BANGALORE);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, speed: s } = pos.coords;
        setPickupLatLng({ lat: latitude, lng: longitude });
        setSpeed(s ? Math.round(s * 3.6) : null); // m/s → km/h
        setGpsLoading(false);
        // Reverse geocode
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "en" } },
          );
          const data = await res.json();
          const { road, suburb, city } = data.address || {};
          setPickupText(
            [road, suburb, city].filter(Boolean).join(", ") ||
              data.display_name,
          );
        } catch {
          setPickupText(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      },
      () => {
        setGpsError("Could not get GPS location. Using Bangalore centre.");
        setGpsLoading(false);
        setPickupLatLng(BANGALORE);
        setPickupText("Bangalore City Centre");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // ── Night time refresh ─────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => setNight(isNightTime()), 60_000);
    return () => clearInterval(iv);
  }, []);

  // ── Init map once leaflet is ready ─────────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    const m = L.map(mapRef.current, { zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(m);
    m.setView([BANGALORE.lat, BANGALORE.lng], 12);
    mapInstanceRef.current = m;
    return () => {
      m.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletReady]);

  // ── Update map when pickup/drop changes ────────────────────────────────────
  const updateMap = useCallback(() => {
    const m = mapInstanceRef.current;
    if (!m || !window.L) return;
    const L = window.L;

    // Remove old layers
    if (pickupMarkerRef.current) m.removeLayer(pickupMarkerRef.current);
    if (dropMarkerRef.current) m.removeLayer(dropMarkerRef.current);
    if (polylineRef.current) m.removeLayer(polylineRef.current);

    // Pickup marker (blue)
    if (pickupLatLng) {
      const icon = L.icon({
        iconUrl:
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      pickupMarkerRef.current = L.marker([pickupLatLng.lat, pickupLatLng.lng], {
        icon,
      })
        .addTo(m)
        .bindPopup("📍 Pickup");
    }

    // Drop marker (orange)
    if (dropLatLng) {
      const icon = L.icon({
        iconUrl:
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      dropMarkerRef.current = L.marker([dropLatLng.lat, dropLatLng.lng], {
        icon,
      })
        .addTo(m)
        .bindPopup("🎯 Drop");
    }

    // Polyline
    if (pickupLatLng && dropLatLng) {
      const coords: [number, number][] = routeInfo?.polyline || [
        [pickupLatLng.lat, pickupLatLng.lng],
        [dropLatLng.lat, dropLatLng.lng],
      ];
      polylineRef.current = L.polyline(coords, {
        color: "#f0c040",
        weight: 4,
        opacity: 0.85,
        dashArray: routeInfo?.isEstimate ? "8 6" : undefined,
      }).addTo(m);

      // Fit bounds
      const bounds = L.latLngBounds(
        [pickupLatLng.lat, pickupLatLng.lng],
        [dropLatLng.lat, dropLatLng.lng],
      );
      m.fitBounds(bounds, { padding: [40, 40] });
    } else if (pickupLatLng) {
      m.setView([pickupLatLng.lat, pickupLatLng.lng], 14);
    }
  }, [pickupLatLng, dropLatLng, routeInfo]);

  useEffect(() => {
    updateMap();
  }, [updateMap]);

  // ── Fetch route when both points set ──────────────────────────────────────
  useEffect(() => {
    if (!pickupLatLng || !dropLatLng) {
      setRouteInfo(null);
      return;
    }
    setRouteLoading(true);
    fetchRoute(pickupLatLng, dropLatLng).then((info) => {
      setRouteInfo(info);
      setRouteLoading(false);
    });
  }, [pickupLatLng, dropLatLng]);

  // ── Handle manual pickup text change (user typed, not GPS) ────────────────
  function handlePickupSelect(r: NominatimResult) {
    setPickupText(r.display_name);
    setPickupLatLng({ lat: Number(r.lat), lng: Number(r.lon) });
  }

  function handleDropSelect(r: NominatimResult) {
    setDropText(r.display_name);
    setDropLatLng({ lat: Number(r.lat), lng: Number(r.lon) });
  }

  const fare = routeInfo ? calcFare(routeInfo.distance, night) : null;

  return (
    <div className="space-y-4">
      {/* Search Inputs Card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl overflow-visible"
        style={{
          background: "oklch(0.17 0.018 80)",
          border: "1px solid oklch(0.28 0.02 80)",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid oklch(0.24 0.018 80)" }}
        >
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold text-sm text-foreground">
              GPS Fare Estimator
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {night ? (
              <>
                <Moon
                  className="w-3 h-3"
                  style={{ color: "oklch(0.75 0.12 260)" }}
                />
                <span
                  className="text-xs"
                  style={{ color: "oklch(0.75 0.12 260)" }}
                >
                  Night ₹30
                </span>
              </>
            ) : (
              <>
                <Sun
                  className="w-3 h-3"
                  style={{ color: "oklch(0.86 0.18 85)" }}
                />
                <span
                  className="text-xs"
                  style={{ color: "oklch(0.86 0.18 85)" }}
                >
                  Day ₹20
                </span>
              </>
            )}
          </div>
        </div>

        {/* Inputs */}
        <div className="px-5 py-4 space-y-4">
          {/* GPS status */}
          {gpsLoading && (
            <div
              data-ocid="estimator.loading_state"
              className="flex items-center gap-2 py-1"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Getting your GPS location...
              </span>
            </div>
          )}
          {gpsError && !gpsLoading && (
            <div
              data-ocid="estimator.error_state"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{
                background: "oklch(0.18 0.04 25 / 0.6)",
                border: "1px solid oklch(0.40 0.12 25 / 0.4)",
                color: "oklch(0.75 0.12 25)",
              }}
            >
              <Navigation className="w-3 h-3 shrink-0" />
              {gpsError}
            </div>
          )}

          <LocationInput
            id="pickup"
            ocid="estimator.pickup_input"
            label="Pickup Location"
            value={pickupText}
            placeholder="Your current location"
            onChange={(v) => setPickupText(v)}
            onSelect={handlePickupSelect}
            leftIcon={
              <MapPin
                className="w-3 h-3"
                style={{ color: "oklch(0.55 0.18 230)" }}
              />
            }
            accentColor="oklch(0.55 0.18 230)"
          />

          {/* Connector line */}
          <div className="flex items-center gap-3 py-0">
            <div
              className="w-px h-4 ml-1.5"
              style={{ background: "oklch(0.35 0.025 80)" }}
            />
          </div>

          <LocationInput
            id="drop"
            ocid="estimator.drop_input"
            label="Drop Location"
            value={dropText}
            placeholder="Where is the passenger going?"
            onChange={(v) => setDropText(v)}
            onSelect={handleDropSelect}
            leftIcon={
              <MapPin
                className="w-3 h-3"
                style={{ color: "oklch(0.72 0.18 35)" }}
              />
            }
            accentColor="oklch(0.72 0.18 35)"
          />
        </div>
      </motion.div>

      {/* Map */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        data-ocid="estimator.map_marker"
        className="rounded-xl overflow-hidden relative"
        style={{
          border: "1px solid oklch(0.28 0.02 80)",
          height: 300,
          background: "oklch(0.14 0.016 82)",
        }}
      >
        {!leafletReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">
              Loading map...
            </span>
          </div>
        )}
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
      </motion.div>

      {/* Info Panel */}
      <AnimatePresence>
        {(routeLoading || routeInfo) && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.35 }}
            data-ocid="estimator.panel"
            className="rounded-xl overflow-hidden"
            style={{
              background: "oklch(0.17 0.018 80)",
              border: "1px solid oklch(0.28 0.02 80)",
            }}
          >
            {routeLoading ? (
              <div className="py-8 flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">
                  Calculating route...
                </span>
              </div>
            ) : routeInfo && fare ? (
              <>
                {/* Fare display */}
                <div className="meter-panel mx-4 mt-4 rounded-lg p-4">
                  <div className="text-center">
                    <p
                      className="text-xs uppercase tracking-widest mb-1"
                      style={{ color: "oklch(0.86 0.18 85 / 0.6)" }}
                    >
                      Estimated Fare
                    </p>
                    <motion.p
                      key={fare.total}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className="font-mono font-bold meter-glow"
                      style={{
                        fontSize: "clamp(2.2rem, 10vw, 3rem)",
                        color: "oklch(0.86 0.18 85)",
                        lineHeight: 1.1,
                      }}
                    >
                      ₹{fare.total}
                    </motion.p>
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      {night ? (
                        <>
                          <Moon
                            className="w-3 h-3"
                            style={{ color: "oklch(0.75 0.12 260)" }}
                          />
                          <span
                            className="text-xs"
                            style={{ color: "oklch(0.75 0.12 260)" }}
                          >
                            Night ₹30/km
                          </span>
                        </>
                      ) : (
                        <>
                          <Sun
                            className="w-3 h-3"
                            style={{ color: "oklch(0.86 0.18 85 / 0.7)" }}
                          />
                          <span
                            className="text-xs"
                            style={{ color: "oklch(0.86 0.18 85 / 0.7)" }}
                          >
                            Day ₹20/km
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 px-4 py-4">
                  <StatBox
                    icon={<Route className="w-3.5 h-3.5" />}
                    label="Distance"
                    value={`${routeInfo.distance.toFixed(1)} km${routeInfo.isEstimate ? " (est." : ""}`}
                    sub={
                      routeInfo.isEstimate
                        ? "straight-line × 1.3"
                        : "road distance"
                    }
                  />
                  <StatBox
                    icon={<Clock className="w-3.5 h-3.5" />}
                    label="Est. Travel Time"
                    value={`${Math.round(routeInfo.durationMin)} min`}
                    sub="at avg 20 km/h"
                  />
                  {speed !== null && (
                    <StatBox
                      icon={<Navigation className="w-3.5 h-3.5" />}
                      label="Current Speed"
                      value={`${speed} km/h`}
                      sub="from GPS"
                    />
                  )}
                  <StatBox
                    icon={<Zap className="w-3.5 h-3.5" />}
                    label="Fare Breakdown"
                    value={`₹${fare.base} + ₹${fare.extraCharge}`}
                    sub={`base + ${Math.max(0, routeInfo.distance - 2).toFixed(1)} km × ₹${fare.rate}`}
                  />
                </div>

                {/* CTA */}
                <div className="px-4 pb-4">
                  <Button
                    data-ocid="estimator.primary_button"
                    onClick={() =>
                      onUseDistance(Math.round(routeInfo.distance * 10) / 10)
                    }
                    className="w-full font-display font-semibold text-sm h-11"
                    style={{
                      background: "oklch(0.86 0.18 85)",
                      color: "oklch(0.12 0.015 85)",
                      boxShadow: "0 2px 16px oklch(0.86 0.18 85 / 0.35)",
                    }}
                  >
                    <Zap className="w-4 h-4 mr-1.5" />
                    Use This Distance in Meter
                  </Button>
                </div>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      className="rounded-lg px-3 py-3"
      style={{
        background: "oklch(0.13 0.015 80)",
        border: "1px solid oklch(0.24 0.018 80)",
      }}
    >
      <div
        className="flex items-center gap-1.5 mb-1"
        style={{ color: "oklch(0.86 0.18 85 / 0.7)" }}
      >
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-mono font-semibold text-sm text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
