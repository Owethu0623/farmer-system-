import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Edit3,
  Layers,
  MapPin,
  Navigation,
  RotateCcw,
  Search,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { geocodeSearch, GeocodeSearchCandidate } from '../lib/api';
import { FieldItem, GeoJsonPolygon, LocationSource } from '../types';

export interface SpatialUpdatePayload {
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
  locationDescription?: string;
  locationConfirmed?: boolean;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracyMeters: number | null;
  gpsCapturedAt: string | null;
  boundaryGeojson: GeoJsonPolygon | null;
}

interface InteractiveFarmMapProps {
  latitude: number;
  longitude: number;
  locationSource?: LocationSource;
  locationDescription?: string;
  locationConfirmed?: boolean;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  gpsAccuracyMeters?: number | null;
  gpsCapturedAt?: string | null;
  boundary?: GeoJsonPolygon | null;
  fields?: FieldItem[];
  onSpatialChange: (payload: SpatialUpdatePayload) => void;
  readOnly?: boolean;
  hideBoundaryControls?: boolean;
  title?: string;
}

const EARTH_RADIUS_M = 6378137;

export function calculateGeodesicAreaHa(pts: [number, number][]): number {
  if (pts.length < 3) return 0;
  const closed = [...pts, pts[0]];
  let areaRad = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [lon1, lat1] = closed[i];
    const [lon2, lat2] = closed[i + 1];
    const rLon1 = (lon1 * Math.PI) / 180;
    const rLat1 = (lat1 * Math.PI) / 180;
    const rLon2 = (lon2 * Math.PI) / 180;
    const rLat2 = (lat2 * Math.PI) / 180;
    areaRad += (rLon2 - rLon1) * (2 + Math.sin(rLat1) + Math.sin(rLat2));
  }
  const sqM = Math.abs((areaRad * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
  return Number((sqM / 10000).toFixed(2));
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcPerimeterMeters(pts: [number, number][]): number {
  if (pts.length < 2) return 0;
  const closed = [...pts, pts[0]];
  let p = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    p += haversineMeters(closed[i][1], closed[i][0], closed[i + 1][1], closed[i + 1][0]);
  }
  return Number(p.toFixed(1));
}

export const InteractiveFarmMap: React.FC<InteractiveFarmMapProps> = ({
  latitude,
  longitude,
  locationSource = 'municipal_center',
  locationDescription = '',
  locationConfirmed = false,
  gpsLatitude = null,
  gpsLongitude = null,
  gpsAccuracyMeters = null,
  gpsCapturedAt = null,
  boundary = null,
  fields = [],
  onSpatialChange,
  readOnly = false,
  hideBoundaryControls = false,
  title = 'Farm Location & Spatial Boundary Map',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [interactionMode, setInteractionMode] = useState<'pin' | 'draw_boundary'>('pin');
  const [offlineMode, setOfflineMode] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [, setTileErrors] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Option A — Location Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeSearchCandidate[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchDisclaimer, setSearchDisclaimer] = useState<string | null>(null);
  const [approximateWarning, setApproximateWarning] = useState<string | null>(null);

  // Local spatial state synchronized cleanly with props
  const [pinLat, setPinLat] = useState<number>(latitude);
  const [pinLng, setPinLng] = useState<number>(longitude);
  const [source, setSource] = useState<LocationSource>(locationSource);
  const [locDescription, setLocDescription] = useState<string>(locationDescription);
  const [confirmed, setConfirmed] = useState<boolean>(Boolean(locationConfirmed));
  const [gpsCoord, setGpsCoord] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    capturedAt: string;
  } | null>(
    gpsLatitude !== null && gpsLongitude !== null
      ? {
          lat: gpsLatitude,
          lng: gpsLongitude,
          accuracy: gpsAccuracyMeters || 15,
          capturedAt: gpsCapturedAt || '',
        }
      : null
  );

  const initialVertices = useMemo<[number, number][]>(() => {
    if (boundary?.coordinates?.[0] && boundary.coordinates[0].length >= 4) {
      return boundary.coordinates[0].slice(0, -1).map(([lng, lat]) => [lng, lat]);
    }
    return [];
  }, [boundary]);

  const [vertices, setVertices] = useState<[number, number][]>(initialVertices);

  // Sync if props change from selecting another farm or parent modal open
  useEffect(() => {
    setPinLat(latitude);
    setPinLng(longitude);
    setSource(locationSource);
    setLocDescription(locationDescription || '');
    setConfirmed(Boolean(locationConfirmed));
    setGpsCoord(
      gpsLatitude !== null && gpsLongitude !== null
        ? {
            lat: gpsLatitude,
            lng: gpsLongitude,
            accuracy: gpsAccuracyMeters || 15,
            capturedAt: gpsCapturedAt || '',
          }
        : null
    );
    setVertices(initialVertices);
    setApproximateWarning(null);
  }, [
    latitude,
    longitude,
    locationSource,
    locationDescription,
    locationConfirmed,
    gpsLatitude,
    gpsLongitude,
    gpsAccuracyMeters,
    gpsCapturedAt,
    initialVertices,
  ]);

  // Connectivity listeners
  useEffect(() => {
    const goOffline = () => setOfflineMode(true);
    const goOnline = () => {
      setOfflineMode(false);
      setTileErrors(0);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const emitSpatial = (
    nextLat: number,
    nextLng: number,
    nextSource: LocationSource,
    nextGps: typeof gpsCoord,
    nextVerts: [number, number][],
    nextDesc: string = locDescription,
    nextConfirmed: boolean = confirmed
  ) => {
    const poly: GeoJsonPolygon | null =
      nextVerts.length >= 3
        ? {
            type: 'Polygon',
            coordinates: [[...nextVerts, nextVerts[0]]],
          }
        : null;

    onSpatialChange({
      latitude: nextLat,
      longitude: nextLng,
      locationSource: nextSource,
      locationDescription: nextDesc,
      locationConfirmed: nextConfirmed,
      gpsLatitude: nextGps?.lat ?? null,
      gpsLongitude: nextGps?.lng ?? null,
      gpsAccuracyMeters: nextGps?.accuracy ?? null,
      gpsCapturedAt: nextGps?.capturedAt ?? null,
      boundaryGeojson: poly,
    });
  };

  // Option A: Location Search handler
  const handleLocationSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchError('Enter at least 2 characters (town, village, district, landmark, or address).');
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const res = await geocodeSearch(q);
      setSearchResults(res.results);
      setSearchDisclaimer(res.disclaimer);
      if (res.results.length === 0) {
        setSearchError(
          'No matching South African place found. Try a nearby town/municipality or place the pin manually on the map.'
        );
      }
    } catch (err: unknown) {
      setSearchError(
        err instanceof Error
          ? err.message
          : 'Location search failed. Use manual map pin selection or device GPS.'
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchCandidate = (cand: GeocodeSearchCandidate) => {
    const nextLat = Number(cand.latitude.toFixed(6));
    const nextLng = Number(cand.longitude.toFixed(6));
    const nextDesc = locDescription.trim() ? locDescription : cand.displayName;
    setPinLat(nextLat);
    setPinLng(nextLng);
    setSource('geocoded_search');
    setLocDescription(nextDesc);
    setConfirmed(false);
    setSearchResults([]);
    setInteractionMode('pin');

    if (cand.precision === 'approximate_municipality') {
      setApproximateWarning(
        cand.warningMessage ||
          'Approximate municipal centre match. Please pan or drag the pin onto your exact farm entrance or gate before clicking Confirm This Location.'
      );
    } else {
      setApproximateWarning(null);
      setGpsStatus(
        `Search matched "${cand.townOrVillage || cand.displayName}". Inspect the map pin and click Confirm This Location.`
      );
    }

    if (leafletMapRef.current) {
      leafletMapRef.current.setView(
        [nextLat, nextLng],
        cand.precision === 'approximate_municipality' ? 12 : 15
      );
    }
    emitSpatial(nextLat, nextLng, 'geocoded_search', gpsCoord, vertices, nextDesc, false);
  };

  // Option C: Request real device GPS location (never fabricated)
  const handleRequestGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('Device GPS is not supported by this browser. Use Search or Manual Map Pin instead.');
      return;
    }
    setGpsLoading(true);
    setApproximateWarning(null);
    setGpsStatus('Requesting device GPS location permission...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy || 15);
        const capturedAt = new Date().toISOString();
        const nextGps = { lat, lng, accuracy, capturedAt };

        setGpsCoord(nextGps);
        setPinLat(lat);
        setPinLng(lng);
        setSource('gps');
        setConfirmed(false);
        setInteractionMode('pin');
        setGpsLoading(false);
        setGpsStatus(
          `GPS captured (±${accuracy}m accuracy). Adjust the pin on the map if needed, then click Confirm This Location.`
        );
        if (leafletMapRef.current) {
          leafletMapRef.current.setView([lat, lng], 15);
        }
        emitSpatial(lat, lng, 'gps', nextGps, vertices, locDescription, false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus(
            'Location permission denied. Use Search Location or Manual Map Pin selection below.'
          );
        } else {
          setGpsStatus(
            'GPS signal unavailable right now. Use Search Location or place the farm marker manually on the map.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleConfirmLocation = () => {
    setConfirmed(true);
    setGpsStatus(
      `Farm coordinates confirmed at ${pinLat.toFixed(5)}, ${pinLng.toFixed(5)}.`
    );
    emitSpatial(pinLat, pinLng, source, gpsCoord, vertices, locDescription, true);
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (offlineMode || !mapContainerRef.current) return;
    if (leafletMapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [pinLat, pinLng],
      zoom: 14,
      zoomControl: true,
    });

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    });

    tileLayer.on('tileerror', () => {
      setTileErrors((prev) => {
        const next = prev + 1;
        if (next >= 4) setOfflineMode(true);
        return next;
      });
    });

    tileLayer.addTo(map);
    const group = L.layerGroup().addTo(map);
    leafletMapRef.current = map;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      leafletMapRef.current = null;
      layerGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineMode]);

  // Handle Map Clicks (move manual marker OR add boundary vertex)
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || readOnly) return;

    const onClick = (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));

      if (interactionMode === 'pin' || hideBoundaryControls) {
        setPinLat(lat);
        setPinLng(lng);
        setSource('manual_map_pin');
        setConfirmed(false);
        setApproximateWarning(null);
        emitSpatial(lat, lng, 'manual_map_pin', gpsCoord, vertices, locDescription, false);
      } else {
        const nextVerts: [number, number][] = [...vertices, [lng, lat]];
        setVertices(nextVerts);
        emitSpatial(pinLat, pinLng, source, gpsCoord, nextVerts, locDescription, confirmed);
      }
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    interactionMode,
    readOnly,
    hideBoundaryControls,
    pinLat,
    pinLng,
    source,
    gpsCoord,
    vertices,
    locDescription,
    confirmed,
  ]);

  // Render Markers, GPS Accuracy Circle, Farm Polygon, Draggable Vertices, and Field Polygons
  useEffect(() => {
    const map = leafletMapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. User's real GPS position (#0B3D91 blue ring + marker)
    if (gpsCoord) {
      L.circle([gpsCoord.lat, gpsCoord.lng], {
        radius: gpsCoord.accuracy,
        color: '#0B3D91',
        fillColor: '#0B3D91',
        fillOpacity: 0.14,
        weight: 1.5,
      }).addTo(group);

      L.circleMarker([gpsCoord.lat, gpsCoord.lng], {
        radius: 7,
        color: '#FFFFFF',
        weight: 2,
        fillColor: '#0B3D91',
        fillOpacity: 1,
      })
        .bindTooltip(`Device GPS (±${gpsCoord.accuracy}m)`)
        .addTo(group);
    }

    // 2. Farm Location Pin (#0B1F3A deep navy when unconfirmed, #174C3C when confirmed)
    const pinColor = confirmed ? '#174C3C' : '#0B1F3A';
    const pinIcon = L.divIcon({
      className: 'fs-map-pin',
      html: `<div style="width:20px;height:20px;border-radius:9999px;background:${pinColor};border:3px solid #ffffff;box-shadow:0 2px 6px rgba(11,31,58,0.4);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const farmMarker = L.marker([pinLat, pinLng], {
      icon: pinIcon,
      draggable: !readOnly,
    })
      .bindTooltip(
        source === 'gps'
          ? 'Farm Pin (from GPS)'
          : source === 'geocoded_search'
          ? 'Farm Pin (Search Match)'
          : source === 'manual_map_pin'
          ? 'Farm Pin (Manual)'
          : 'Municipal Reference Pin'
      )
      .addTo(group);

    if (!readOnly) {
      farmMarker.on('dragend', () => {
        const pos = farmMarker.getLatLng();
        const nextLat = Number(pos.lat.toFixed(6));
        const nextLng = Number(pos.lng.toFixed(6));
        setPinLat(nextLat);
        setPinLng(nextLng);
        setSource('manual_map_pin');
        setConfirmed(false);
        setApproximateWarning(null);
        emitSpatial(nextLat, nextLng, 'manual_map_pin', gpsCoord, vertices, locDescription, false);
      });
    }

    // 3. Field Boundaries inside Farm
    for (const fld of fields) {
      const ring = fld.geojson?.coordinates?.[0];
      if (ring && ring.length >= 4) {
        const latLngs = ring.map(([lng, lat]) => [lat, lng] as [number, number]);
        L.polygon(latLngs, {
          color: '#0B3D91',
          weight: 1.5,
          dashArray: '4 4',
          fillColor: '#0B3D91',
          fillOpacity: 0.14,
        })
          .bindTooltip(`${fld.name} (${fld.areaHectares} ha)`)
          .addTo(group);
      }
    }

    // 4. Drawn Farm Boundary Polygon & Draggable Vertices
    if (vertices.length >= 3) {
      const polyLatLngs = vertices.map(([lng, lat]) => [lat, lng] as [number, number]);
      L.polygon(polyLatLngs, {
        color: '#174C3C',
        weight: 2.5,
        fillColor: '#174C3C',
        fillOpacity: 0.22,
      }).addTo(group);
    } else if (vertices.length === 2) {
      L.polyline(
        vertices.map(([lng, lat]) => [lat, lng] as [number, number]),
        { color: '#174C3C', weight: 2, dashArray: '4 4' }
      ).addTo(group);
    }

    vertices.forEach(([lng, lat], idx) => {
      const vIcon = L.divIcon({
        className: 'fs-vertex',
        html: `<div style="width:12px;height:12px;border-radius:3px;background:#FFFFFF;border:2px solid #174C3C;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const vMarker = L.marker([lat, lng], {
        icon: vIcon,
        draggable: !readOnly,
      }).addTo(group);

      if (!readOnly) {
        vMarker.on('dragend', () => {
          const p = vMarker.getLatLng();
          const updated = vertices.map((pt, i) =>
            i === idx
              ? ([Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))] as [number, number])
              : pt
          );
          setVertices(updated);
          emitSpatial(pinLat, pinLng, source, gpsCoord, updated, locDescription, confirmed);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinLat, pinLng, source, gpsCoord, vertices, fields, readOnly, offlineMode, confirmed]);

  // Center map smoothly when switching farms
  useEffect(() => {
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([latitude, longitude], leafletMapRef.current.getZoom());
    }
  }, [latitude, longitude]);

  const calculatedAreaHa = calculateGeodesicAreaHa(vertices);
  const perimeterM = calcPerimeterMeters(vertices);

  const handleUndoVertex = () => {
    const next = vertices.slice(0, -1);
    setVertices(next);
    emitSpatial(pinLat, pinLng, source, gpsCoord, next, locDescription, confirmed);
  };

  const handleClearBoundary = () => {
    setVertices([]);
    emitSpatial(pinLat, pinLng, source, gpsCoord, [], locDescription, confirmed);
  };

  // Offline SVG grid projection bounds
  const offlineBounds = useMemo(() => {
    const allLngs = [pinLng, ...vertices.map((v) => v[0]), ...(gpsCoord ? [gpsCoord.lng] : [])];
    const allLats = [pinLat, ...vertices.map((v) => v[1]), ...(gpsCoord ? [gpsCoord.lat] : [])];
    const minLng = Math.min(...allLngs) - 0.008;
    const maxLng = Math.max(...allLngs) + 0.008;
    const minLat = Math.min(...allLats) - 0.008;
    const maxLat = Math.max(...allLats) + 0.008;
    return { minLng, maxLng, minLat, maxLat };
  }, [pinLat, pinLng, vertices, gpsCoord]);

  const toOfflineSvg = (lng: number, lat: number) => ({
    x: ((lng - offlineBounds.minLng) / (offlineBounds.maxLng - offlineBounds.minLng)) * 480,
    y: 260 - ((lat - offlineBounds.minLat) / (offlineBounds.maxLat - offlineBounds.minLat)) * 260,
  });

  const handleOfflineSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 480;
    const clickY = ((e.clientY - rect.top) / rect.height) * 260;
    const lng = Number(
      (
        offlineBounds.minLng +
        (clickX / 480) * (offlineBounds.maxLng - offlineBounds.minLng)
      ).toFixed(6)
    );
    const lat = Number(
      (
        offlineBounds.minLat +
        ((260 - clickY) / 260) * (offlineBounds.maxLat - offlineBounds.minLat)
      ).toFixed(6)
    );

    if (interactionMode === 'pin' || hideBoundaryControls) {
      setPinLat(lat);
      setPinLng(lng);
      setSource('manual_map_pin');
      setConfirmed(false);
      setApproximateWarning(null);
      emitSpatial(lat, lng, 'manual_map_pin', gpsCoord, vertices, locDescription, false);
    } else {
      const nextVerts: [number, number][] = [...vertices, [lng, lat]];
      setVertices(nextVerts);
      emitSpatial(pinLat, pinLng, source, gpsCoord, nextVerts, locDescription, confirmed);
    }
  };

  return (
    <div className="bg-white border border-[#CBD5E1] rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MapPin className="w-5 h-5 text-[#0B3D91] shrink-0" />
          <div>
            <h3 className="font-display font-bold text-sm sm:text-base text-[#0B1F3A]">{title}</h3>
            <p className="text-xs text-[#475569]">
              {offlineMode
                ? 'Offline Spatial Grid Fallback · Coordinates & boundary drawing remain active'
                : 'OpenStreetMap Layer · Choose Search, Manual Pin, or Device GPS then confirm'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOfflineMode(!offlineMode)}
          className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-xl border border-[#CBD5E1] bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs font-semibold text-[#0B1F3A] cursor-pointer whitespace-nowrap"
        >
          {offlineMode ? <Layers className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span>{offlineMode ? 'Live Map Tiles' : 'Offline Grid'}</span>
        </button>
      </div>

      {/* 3-Option Farm Location Selector when Editable */}
      {!readOnly && (
        <div className="bg-[#F1F5F9] border border-[#CBD5E1] rounded-xl p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-[#0B1F3A]">
              Step 1: Set Farm Pin (Choose Search, Manual Pin, or GPS)
            </p>
            <span
              className={`text-xs font-semibold inline-flex items-center gap-1 ${
                confirmed ? 'text-[#174C3C]' : 'text-[#B91C1C]'
              }`}
            >
              {confirmed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Location Confirmed</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FC3D21]" />
                  <span>Confirmation Needed Below</span>
                </>
              )}
            </span>
          </div>

          {/* Option A: Search Location */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleLocationSearch();
                  }
                }}
                placeholder="Option A: Search town, village, district, landmark or road (e.g. Bergville, Tzaneen)..."
                className="w-full pl-9 pr-3 py-2.5 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A] placeholder:text-[#64748B]"
              />
            </div>
            <button
              type="button"
              disabled={searchLoading}
              onClick={() => void handleLocationSearch()}
              className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[44px] rounded-xl bg-[#0B3D91] hover:bg-[#082E70] disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{searchLoading ? 'Searching...' : 'Search Location'}</span>
            </button>
          </div>

          {searchError && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-3.5 py-2.5 text-xs font-medium">
              {searchError}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="bg-white border border-[#CBD5E1] rounded-xl divide-y divide-[#E2E8F0] overflow-hidden">
              {searchResults.map((cand) => (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => handleSelectSearchCandidate(cand)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-[#F1F5F9] flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#0B1F3A] truncate">
                      {cand.displayName}
                    </p>
                    <p className="text-[11px] text-[#475569] mt-0.5">
                      {cand.precision === 'approximate_municipality'
                        ? 'Approximate Municipal Centre — adjust pin after selecting'
                        : 'Exact Place Match'}{' '}
                      · <span className="font-mono tabular-nums">{cand.latitude.toFixed(4)}, {cand.longitude.toFixed(4)}</span>
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#0B3D91] whitespace-nowrap shrink-0">
                    Select →
                  </span>
                </button>
              ))}
              {searchDisclaimer && (
                <p className="px-3.5 py-2 text-[11px] text-[#475569] bg-[#F8FAFC]">
                  {searchDisclaimer}
                </p>
              )}
            </div>
          )}

          {/* Options B & C + Boundary Drawing Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setInteractionMode('pin')}
                className={`inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl border text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  interactionMode === 'pin'
                    ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
                    : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#E2E8F0]'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Option B: Manual Map Pin</span>
              </button>

              <button
                type="button"
                disabled={gpsLoading}
                onClick={handleRequestGps}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl bg-[#174C3C] hover:bg-[#113B2E] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{gpsLoading ? 'Locating GPS...' : 'Option C: Use Current GPS'}</span>
              </button>

              {!hideBoundaryControls && (
                <button
                  type="button"
                  onClick={() => setInteractionMode('draw_boundary')}
                  className={`inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl border text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    interactionMode === 'draw_boundary'
                      ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                      : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#E2E8F0]'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Draw Boundary ({vertices.length} pts)</span>
                </button>
              )}
            </div>

            {!hideBoundaryControls && vertices.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndoVertex}
                  className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#E2E8F0] text-xs font-semibold text-[#0F172A] cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo Point</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearBoundary}
                  className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-xl border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#B91C1C] cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Boundary</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {approximateWarning && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-3.5 py-2.5 text-xs font-medium flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#FC3D21] shrink-0 mt-0.5" />
          <span>{approximateWarning}</span>
        </div>
      )}

      {gpsStatus && !approximateWarning && (
        <div className="bg-[#ECF5F2] border border-[#A7D7C5] text-[#0B1F3A] rounded-xl px-3.5 py-2.5 text-xs font-medium">
          {gpsStatus}
        </div>
      )}

      {/* Map Viewport (OpenStreetMap Leaflet OR Offline Spatial Grid) */}
      {!offlineMode ? (
        <div
          ref={mapContainerRef}
          className="w-full h-72 sm:h-80 rounded-xl border border-[#CBD5E1] overflow-hidden z-0"
        />
      ) : (
        <svg
          viewBox="0 0 480 260"
          onClick={handleOfflineSvgClick}
          className={`w-full h-72 sm:h-80 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] ${
            readOnly ? '' : 'cursor-crosshair'
          }`}
          role="img"
          aria-label="Offline spatial coordinate grid"
        >
          {[52, 104, 156, 208].map((y) => (
            <line key={y} x1={0} y1={y} x2={480} y2={y} stroke="#E2E8F0" strokeWidth={1} />
          ))}
          {[96, 192, 288, 384].map((x) => (
            <line key={x} x1={x} y1={0} x2={x} y2={260} stroke="#E2E8F0" strokeWidth={1} />
          ))}

          {vertices.length >= 3 && (
            <polygon
              points={vertices
                .map(([lng, lat]) => {
                  const pt = toOfflineSvg(lng, lat);
                  return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                })
                .join(' ')}
              fill="#174C3C"
              fillOpacity={0.22}
              stroke="#174C3C"
              strokeWidth={2}
            />
          )}

          {vertices.map(([lng, lat], idx) => {
            const pt = toOfflineSvg(lng, lat);
            return (
              <circle
                key={`${lng}-${lat}-${idx}`}
                cx={pt.x}
                cy={pt.y}
                r={4.5}
                fill="#FFFFFF"
                stroke="#174C3C"
                strokeWidth={2}
              />
            );
          })}

          {gpsCoord && (
            <circle
              cx={toOfflineSvg(gpsCoord.lng, gpsCoord.lat).x}
              cy={toOfflineSvg(gpsCoord.lng, gpsCoord.lat).y}
              r={6}
              fill="#0B3D91"
              stroke="#FFFFFF"
              strokeWidth={2}
            />
          )}

          <circle
            cx={toOfflineSvg(pinLng, pinLat).x}
            cy={toOfflineSvg(pinLng, pinLat).y}
            r={6.5}
            fill={confirmed ? '#174C3C' : '#0B1F3A'}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        </svg>
      )}

      {/* Location Description & Explicit Farmer Confirmation */}
      {!readOnly ? (
        <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-3.5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-8 space-y-1">
              <label className="block text-xs font-semibold text-[#0B1F3A]">
                Location Description / Nearest Landmark (Optional)
              </label>
              <input
                type="text"
                value={locDescription}
                onChange={(e) => {
                  const nextDesc = e.target.value;
                  setLocDescription(nextDesc);
                  emitSpatial(pinLat, pinLng, source, gpsCoord, vertices, nextDesc, confirmed);
                }}
                placeholder="e.g. 3 km north of Bergville bridge, gravel turnoff at borehole gate"
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#0F172A]"
              />
            </div>

            <div className="sm:col-span-4">
              <button
                type="button"
                onClick={handleConfirmLocation}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  confirmed
                    ? 'bg-[#174C3C] text-white'
                    : 'bg-[#0B3D91] hover:bg-[#082E70] text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{confirmed ? 'Location Confirmed' : 'Confirm This Location'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="text-xs space-y-1">
              <span className="text-[#475569] font-medium">
                Manual Latitude (South Africa: -22 to -35)
              </span>
              <input
                type="number"
                step={0.0001}
                value={pinLat}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPinLat(val);
                  setSource('manual_map_pin');
                  setConfirmed(false);
                  emitSpatial(val, pinLng, 'manual_map_pin', gpsCoord, vertices, locDescription, false);
                }}
                className="w-full px-3 py-2 min-h-[40px] rounded-xl border border-[#CBD5E1] bg-white font-mono text-xs"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-[#475569] font-medium">
                Manual Longitude (South Africa: 16 to 33)
              </span>
              <input
                type="number"
                step={0.0001}
                value={pinLng}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPinLng(val);
                  setSource('manual_map_pin');
                  setConfirmed(false);
                  emitSpatial(pinLat, val, 'manual_map_pin', gpsCoord, vertices, locDescription, false);
                }}
                className="w-full px-3 py-2 min-h-[40px] rounded-xl border border-[#CBD5E1] bg-white font-mono text-xs"
              />
            </label>
          </div>
        </div>
      ) : (
        locDescription && (
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#334155]">
            <span className="font-semibold text-[#0B1F3A]">Location Description:</span>{' '}
            {locDescription}
          </div>
        )
      )}

      {/* Explicit Spatial Distinction Telemetry Readout */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-[#E2E8F0] text-xs">
        <div className="p-2.5 rounded-xl bg-[#F1F5F9]">
          <p className="text-[#475569]">
            Farm Pin ({source.replace(/_/g, ' ')}) ·{' '}
            <span className={confirmed ? 'text-[#174C3C] font-semibold' : 'text-[#B91C1C] font-semibold'}>
              {confirmed ? 'Confirmed' : 'Unconfirmed'}
            </span>
          </p>
          <p className="font-mono font-semibold tabular-nums text-[#0B1F3A] mt-0.5">
            {pinLat.toFixed(5)}, {pinLng.toFixed(5)}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-[#F1F5F9]">
          <p className="text-[#475569]">Device GPS Coordinate</p>
          <p className="font-mono font-semibold tabular-nums text-[#0B1F3A] mt-0.5">
            {gpsCoord
              ? `${gpsCoord.lat.toFixed(5)}, ${gpsCoord.lng.toFixed(5)} (±${gpsCoord.accuracy}m)`
              : 'Not captured'}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-[#F1F5F9]">
          <p className="text-[#475569]">Farm Boundary Status</p>
          <p className="font-semibold text-[#0B1F3A] mt-0.5">
            {vertices.length >= 3
              ? `${vertices.length} vertices saved`
              : 'Not drawn yet (point only)'}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-[#F1F5F9]">
          <p className="text-[#475569]">Calculated Boundary Area</p>
          <p className="font-mono font-bold tabular-nums text-[#0B3D91] mt-0.5">
            {vertices.length >= 3 ? `${calculatedAreaHa} ha · ${perimeterM} m` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};
