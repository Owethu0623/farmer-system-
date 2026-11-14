import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Crosshair,
  Edit3,
  Layers,
  MapPin,
  Navigation,
  RotateCcw,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { FieldItem, GeoJsonPolygon, LocationSource } from '../types';

export interface SpatialUpdatePayload {
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
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
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  gpsAccuracyMeters?: number | null;
  gpsCapturedAt?: string | null;
  boundary?: GeoJsonPolygon | null;
  fields?: FieldItem[];
  onSpatialChange: (payload: SpatialUpdatePayload) => void;
  readOnly?: boolean;
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
  gpsLatitude = null,
  gpsLongitude = null,
  gpsAccuracyMeters = null,
  gpsCapturedAt = null,
  boundary = null,
  fields = [],
  onSpatialChange,
  readOnly = false,
  title = 'Farm Spatial Map (OpenStreetMap & PostGIS)',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [interactionMode, setInteractionMode] = useState<'pin' | 'draw_boundary'>('pin');
  const [offlineMode, setOfflineMode] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [tileErrors, setTileErrors] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Local state synchronized cleanly with props
  const [pinLat, setPinLat] = useState<number>(latitude);
  const [pinLng, setPinLng] = useState<number>(longitude);
  const [source, setSource] = useState<LocationSource>(locationSource);
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

  // Sync if props change from selecting another farm
  useEffect(() => {
    setPinLat(latitude);
    setPinLng(longitude);
    setSource(locationSource);
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
  }, [
    latitude,
    longitude,
    locationSource,
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
    nextVerts: [number, number][]
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
      gpsLatitude: nextGps?.lat ?? null,
      gpsLongitude: nextGps?.lng ?? null,
      gpsAccuracyMeters: nextGps?.accuracy ?? null,
      gpsCapturedAt: nextGps?.capturedAt ?? null,
      boundaryGeojson: poly,
    });
  };

  // Request real device GPS location (never fabricated)
  const handleRequestGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('Device GPS is not supported by this browser. Use manual map pin instead.');
      return;
    }
    setGpsLoading(true);
    setGpsStatus('Requesting device location permission...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy || 15);
        const capturedAt = new Date().toISOString();
        const nextGps = { lat, lng, accuracy, capturedAt };

        // IMPORTANT: Update GPS point and position marker, NEVER invent a farm boundary from GPS point
        setGpsCoord(nextGps);
        setPinLat(lat);
        setPinLng(lng);
        setSource('gps');
        setGpsLoading(false);
        setGpsStatus(
          `GPS captured (±${accuracy}m). Draw your farm boundary corners separately on the map.`
        );
        if (leafletMapRef.current) {
          leafletMapRef.current.setView([lat, lng], 15);
        }
        emitSpatial(lat, lng, 'gps', nextGps, vertices);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus(
            'Location permission denied. Tap the map or enter coordinates manually below.'
          );
        } else {
          setGpsStatus(
            'GPS signal unavailable right now. You can place or drag the farm marker manually.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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

      if (interactionMode === 'pin') {
        setPinLat(lat);
        setPinLng(lng);
        setSource('manual_map_pin');
        emitSpatial(lat, lng, 'manual_map_pin', gpsCoord, vertices);
      } else {
        const nextVerts: [number, number][] = [...vertices, [lng, lat]];
        setVertices(nextVerts);
        emitSpatial(pinLat, pinLng, source, gpsCoord, nextVerts);
      }
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactionMode, readOnly, pinLat, pinLng, source, gpsCoord, vertices]);

  // Render Markers, GPS Accuracy Circle, Farm Polygon, Draggable Vertices, and Field Polygons
  useEffect(() => {
    const map = leafletMapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. User's real GPS position (distinct teal ring + circle marker)
    if (gpsCoord) {
      L.circle([gpsCoord.lat, gpsCoord.lng], {
        radius: gpsCoord.accuracy,
        color: '#0284C7',
        fillColor: '#0284C7',
        fillOpacity: 0.14,
        weight: 1.5,
      }).addTo(group);

      L.circleMarker([gpsCoord.lat, gpsCoord.lng], {
        radius: 7,
        color: '#FFFFFF',
        weight: 2,
        fillColor: '#0284C7',
        fillOpacity: 1,
      })
        .bindTooltip(`Device GPS (±${gpsCoord.accuracy}m)`)
        .addTo(group);
    }

    // 2. Farm Location Pin (draggable when editable)
    const pinIcon = L.divIcon({
      className: 'fs-map-pin',
      html: `<div style="width:18px;height:18px;border-radius:9999px;background:#143326;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const farmMarker = L.marker([pinLat, pinLng], {
      icon: pinIcon,
      draggable: !readOnly,
    })
      .bindTooltip(
        source === 'gps'
          ? 'Farm Pin (from GPS)'
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
        emitSpatial(nextLat, nextLng, 'manual_map_pin', gpsCoord, vertices);
      });
    }

    // 3. Field Boundaries inside Farm
    for (const fld of fields) {
      const ring = fld.geojson?.coordinates?.[0];
      if (ring && ring.length >= 4) {
        const latLngs = ring.map(([lng, lat]) => [lat, lng] as [number, number]);
        L.polygon(latLngs, {
          color: '#40916C',
          weight: 1.5,
          dashArray: '4 4',
          fillColor: '#40916C',
          fillOpacity: 0.16,
        })
          .bindTooltip(`${fld.name} (${fld.areaHectares} ha)`)
          .addTo(group);
      }
    }

    // 4. Drawn Farm Boundary Polygon & Draggable Vertices
    if (vertices.length >= 3) {
      const polyLatLngs = vertices.map(([lng, lat]) => [lat, lng] as [number, number]);
      L.polygon(polyLatLngs, {
        color: '#1B4332',
        weight: 2.5,
        fillColor: '#2D6A4F',
        fillOpacity: 0.22,
      }).addTo(group);
    } else if (vertices.length === 2) {
      L.polyline(
        vertices.map(([lng, lat]) => [lat, lng] as [number, number]),
        { color: '#1B4332', weight: 2, dashArray: '4 4' }
      ).addTo(group);
    }

    // Vertex handles for editing saved boundaries
    vertices.forEach(([lng, lat], idx) => {
      const vIcon = L.divIcon({
        className: 'fs-vertex',
        html: `<div style="width:12px;height:12px;border-radius:3px;background:#FFFFFF;border:2px solid #1B4332;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
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
          emitSpatial(pinLat, pinLng, source, gpsCoord, updated);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinLat, pinLng, source, gpsCoord, vertices, fields, readOnly, offlineMode]);

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
    emitSpatial(pinLat, pinLng, source, gpsCoord, next);
  };

  const handleClearBoundary = () => {
    setVertices([]);
    emitSpatial(pinLat, pinLng, source, gpsCoord, []);
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

    if (interactionMode === 'pin') {
      setPinLat(lat);
      setPinLng(lng);
      setSource('manual_map_pin');
      emitSpatial(lat, lng, 'manual_map_pin', gpsCoord, vertices);
    } else {
      const nextVerts: [number, number][] = [...vertices, [lng, lat]];
      setVertices(nextVerts);
      emitSpatial(pinLat, pinLng, source, gpsCoord, nextVerts);
    }
  };

  return (
    <div className="bg-white border border-[#E2E6DF] rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#1B4332]" />
          <div>
            <h3 className="font-display font-bold text-sm sm:text-base text-[#143326]">{title}</h3>
            <p className="text-xs text-[#4A5A50]">
              {offlineMode
                ? 'Offline Spatial Grid Fallback (Coordinates & boundary drawing remain active)'
                : 'OpenStreetMap Interactive Layer · Drag pins or draw boundary corners'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <button
              type="button"
              disabled={gpsLoading}
              onClick={handleRequestGps}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-semibold cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{gpsLoading ? 'Locating...' : 'Use My GPS Location'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setOfflineMode(!offlineMode)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D4DDD2] bg-[#F6F7F4] hover:bg-[#EDF2EC] text-xs font-semibold text-[#17201B] cursor-pointer"
          >
            {offlineMode ? <Layers className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{offlineMode ? 'Try Map Tiles' : 'Offline Grid'}</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher when Editable */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-2.5">
          <div className="flex items-center gap-1 p-0.5 bg-white border border-[#D4DDD2] rounded-lg">
            <button
              type="button"
              onClick={() => setInteractionMode('pin')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                interactionMode === 'pin'
                  ? 'bg-[#1B4332] text-white'
                  : 'text-[#35443B] hover:bg-[#EDF2EC]'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Move Farm Pin</span>
            </button>
            <button
              type="button"
              onClick={() => setInteractionMode('draw_boundary')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                interactionMode === 'draw_boundary'
                  ? 'bg-[#1B4332] text-white'
                  : 'text-[#35443B] hover:bg-[#EDF2EC]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Draw / Edit Boundary ({vertices.length} pts)</span>
            </button>
          </div>

          {vertices.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndoVertex}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D4DDD2] bg-white text-xs font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo Point</span>
              </button>
              <button
                type="button"
                onClick={handleClearBoundary}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E8B4B4] bg-[#FDF2F2] text-xs font-semibold text-[#8E2424] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Boundary</span>
              </button>
            </div>
          )}
        </div>
      )}

      {gpsStatus && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] text-[#143326] rounded-xl px-3.5 py-2.5 text-xs font-medium">
          {gpsStatus}
        </div>
      )}

      {/* Map Viewport (OpenStreetMap Leaflet OR Offline Spatial Grid) */}
      {!offlineMode ? (
        <div
          ref={mapContainerRef}
          className="w-full h-72 sm:h-80 rounded-xl border border-[#D4DDD2] overflow-hidden z-0"
        />
      ) : (
        <svg
          viewBox="0 0 480 260"
          onClick={handleOfflineSvgClick}
          className={`w-full h-72 sm:h-80 rounded-xl border border-[#D4DDD2] bg-[#EFF4EE] ${
            readOnly ? '' : 'cursor-crosshair'
          }`}
          role="img"
          aria-label="Offline spatial coordinate grid"
        >
          {[52, 104, 156, 208].map((y) => (
            <line key={y} x1={0} y1={y} x2={480} y2={y} stroke="#DCE5DA" strokeWidth={1} />
          ))}
          {[96, 192, 288, 384].map((x) => (
            <line key={x} x1={x} y1={0} x2={x} y2={260} stroke="#DCE5DA" strokeWidth={1} />
          ))}

          {vertices.length >= 3 && (
            <polygon
              points={vertices
                .map(([lng, lat]) => {
                  const pt = toOfflineSvg(lng, lat);
                  return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                })
                .join(' ')}
              fill="#2D6A4F"
              fillOpacity={0.22}
              stroke="#1B4332"
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
                stroke="#1B4332"
                strokeWidth={2}
              />
            );
          })}

          {gpsCoord && (
            <circle
              cx={toOfflineSvg(gpsCoord.lng, gpsCoord.lat).x}
              cy={toOfflineSvg(gpsCoord.lng, gpsCoord.lat).y}
              r={6}
              fill="#0284C7"
              stroke="#FFFFFF"
              strokeWidth={2}
            />
          )}

          <circle
            cx={toOfflineSvg(pinLng, pinLat).x}
            cy={toOfflineSvg(pinLng, pinLat).y}
            r={6}
            fill="#143326"
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        </svg>
      )}

      {/* Explicit Spatial Distinction Telemetry Readout */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-[#E2E6DF] text-xs">
        <div className="p-2.5 rounded-lg bg-[#F6F7F4]">
          <p className="text-[#4A5A50]">Selected Farm Pin ({source.replace(/_/g, ' ')})</p>
          <p className="font-mono font-semibold tabular-nums text-[#143326] mt-0.5">
            {pinLat.toFixed(5)}, {pinLng.toFixed(5)}
          </p>
        </div>

        <div className="p-2.5 rounded-lg bg-[#F6F7F4]">
          <p className="text-[#4A5A50]">Device GPS Coordinate</p>
          <p className="font-mono font-semibold tabular-nums text-[#143326] mt-0.5">
            {gpsCoord
              ? `${gpsCoord.lat.toFixed(5)}, ${gpsCoord.lng.toFixed(5)} (±${gpsCoord.accuracy}m)`
              : 'Not captured'}
          </p>
        </div>

        <div className="p-2.5 rounded-lg bg-[#F6F7F4]">
          <p className="text-[#4A5A50]">Farm Boundary Status</p>
          <p className="font-semibold text-[#143326] mt-0.5">
            {vertices.length >= 3
              ? `${vertices.length} vertices saved`
              : 'Not drawn yet (GPS is point only)'}
          </p>
        </div>

        <div className="p-2.5 rounded-lg bg-[#F6F7F4]">
          <p className="text-[#4A5A50]">Calculated Boundary Area</p>
          <p className="font-mono font-bold tabular-nums text-[#1B4332] mt-0.5">
            {vertices.length >= 3 ? `${calculatedAreaHa} ha · ${perimeterM} m` : '—'}
          </p>
        </div>
      </div>

      {/* Manual Coordinate Input Fallback */}
      {!readOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label className="text-xs space-y-1">
            <span className="text-[#4A5A50] font-medium">Manual Latitude (South Africa: -22 to -35)</span>
            <input
              type="number"
              step={0.0001}
              value={pinLat}
              onChange={(e) => {
                const val = Number(e.target.value);
                setPinLat(val);
                setSource('manual_map_pin');
                emitSpatial(val, pinLng, 'manual_map_pin', gpsCoord, vertices);
              }}
              className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] font-mono text-xs"
            />
          </label>
          <label className="text-xs space-y-1">
            <span className="text-[#4A5A50] font-medium">Manual Longitude (South Africa: 16 to 33)</span>
            <input
              type="number"
              step={0.0001}
              value={pinLng}
              onChange={(e) => {
                const val = Number(e.target.value);
                setPinLng(val);
                setSource('manual_map_pin');
                emitSpatial(pinLat, val, 'manual_map_pin', gpsCoord, vertices);
              }}
              className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] font-mono text-xs"
            />
          </label>
        </div>
      )}
    </div>
  );
};
