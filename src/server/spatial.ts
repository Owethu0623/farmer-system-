import { GeoJsonPolygon } from './types.ts';

/**
 * PostGIS-compatible spatial geometry helpers (WGS84 / SRID 4326)
 * Calculates polygon area in hectares, perimeter in meters, centroids, and WKT strings.
 */

const EARTH_RADIUS_M = 6378137;

export function pointToWkt(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng.toFixed(6)} ${lat.toFixed(6)})`;
}

export function polygonToWkt(geojson: GeoJsonPolygon): string {
  const ring = geojson.coordinates[0] || [];
  const closed = ensureClosedRing(ring);
  const coordsText = closed.map(([lng, lat]) => `${lng.toFixed(6)} ${lat.toFixed(6)}`).join(', ');
  return `SRID=4326;POLYGON((${coordsText}))`;
}

export function ensureClosedRing(ring: number[][]): number[][] {
  if (ring.length === 0) return [];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }
  return [...ring, [...first]];
}

export function createBoxPolygonFromCentroid(
  lat: number,
  lng: number,
  hectares: number
): GeoJsonPolygon {
  const safeHa = Math.max(0.1, hectares || 1);
  const areaSqM = safeHa * 10000;
  const sideM = Math.sqrt(areaSqM);
  const halfLatDeg = (sideM / 2 / EARTH_RADIUS_M) * (180 / Math.PI);
  const halfLngDeg =
    (sideM / 2 / (EARTH_RADIUS_M * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);

  const ring: number[][] = [
    [Number((lng - halfLngDeg).toFixed(6)), Number((lat + halfLatDeg).toFixed(6))],
    [Number((lng + halfLngDeg).toFixed(6)), Number((lat + halfLatDeg).toFixed(6))],
    [Number((lng + halfLngDeg).toFixed(6)), Number((lat - halfLatDeg).toFixed(6))],
    [Number((lng - halfLngDeg).toFixed(6)), Number((lat - halfLatDeg).toFixed(6))],
    [Number((lng - halfLngDeg).toFixed(6)), Number((lat + halfLatDeg).toFixed(6))],
  ];

  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

export function calculatePolygonAreaHectares(geojson: GeoJsonPolygon): number {
  const ring = ensureClosedRing(geojson.coordinates[0] || []);
  if (ring.length < 4) return 0;

  let areaRad = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    const rLon1 = (lon1 * Math.PI) / 180;
    const rLat1 = (lat1 * Math.PI) / 180;
    const rLon2 = (lon2 * Math.PI) / 180;
    const rLat2 = (lat2 * Math.PI) / 180;
    areaRad += (rLon2 - rLon1) * (2 + Math.sin(rLat1) + Math.sin(rLat2));
  }

  const areaSqM = Math.abs((areaRad * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
  return Number((areaSqM / 10000).toFixed(2));
}

export function calculatePolygonPerimeterMeters(geojson: GeoJsonPolygon): number {
  const ring = ensureClosedRing(geojson.coordinates[0] || []);
  if (ring.length < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    perimeter += haversineMeters(ring[i][1], ring[i][0], ring[i + 1][1], ring[i + 1][0]);
  }
  return Number(perimeter.toFixed(1));
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
