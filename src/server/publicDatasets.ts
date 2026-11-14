import { PublicDatasetRecord } from './types.ts';

export function getPublicDatasetRegistry(): PublicDatasetRecord[] {
  const retrievedToday = new Date().toISOString().slice(0, 10);
  const sawsConfigured = Boolean(process.env.SAWS_API_KEY && process.env.SAWS_API_URL);
  const dalrrdConfigured = Boolean(process.env.DALRRD_SOIL_WFS_URL);

  return [
    {
      id: 'ds-open-meteo-forecast',
      sourceName: 'Open-Meteo',
      sourceUrl: 'https://api.open-meteo.com/v1/forecast',
      datasetOrApiName: 'Open-Meteo Coordinate Weather Forecast & 30-Day Past Archive API',
      category: 'weather',
      retrievedAt: retrievedToday,
      geographicCoverage: 'All 9 South African provinces (coordinate-level ~11 km grid)',
      units: '°C (temperature), mm (precipitation & ET0), km/h (wind), % (humidity)',
      licenceAndTerms:
        'CC BY 4.0 for non-commercial open API tier; commercial deployments require Open-Meteo commercial API plan/agreement.',
      limitations:
        'Gridded numerical weather prediction model output, not an on-farm physical weather station measurement. Local microclimate and convective hailstorms can vary significantly.',
      integrationMode: 'live_api',
      status: 'active',
    },
    {
      id: 'ds-open-meteo-archive',
      sourceName: 'Open-Meteo Historical Weather',
      sourceUrl: 'https://archive-api.open-meteo.com/v1/archive',
      datasetOrApiName: 'ERA5 / ERA5-Land Historical Weather Reanalysis API',
      category: 'weather',
      retrievedAt: retrievedToday,
      geographicCoverage: 'South Africa national grid (historical daily series)',
      units: 'mm/day (precipitation), °C (Tmin/Tmax), km/h (wind)',
      licenceAndTerms:
        'Copernicus Climate Change Service (C3S) ERA5 open licence via Open-Meteo CC BY 4.0.',
      limitations:
        'Reanalysis grid (~9–25 km) lags real time by 2–5 days and smooths localized thunderstorm extremes.',
      integrationMode: 'live_api',
      status: 'active',
    },
    {
      id: 'ds-nasa-power',
      sourceName: 'NASA Langley Research Center POWER Project',
      sourceUrl: 'https://power.larc.nasa.gov/api/temporal/daily/point',
      datasetOrApiName: 'NASA POWER Agroclimatology Daily Point API (Community: AG)',
      category: 'climate_agromet',
      retrievedAt: retrievedToday,
      geographicCoverage: 'Global 0.5° × 0.625° grid covering all South African agricultural districts',
      units: 'MJ/m²/day (solar irradiance), mm/day (PRECTOTCORR), °C (T2M), % (RH2M)',
      licenceAndTerms:
        'Public domain / NASA Earth Science Open Data Policy (attribution requested; no trademark endorsement).',
      limitations:
        'Coarse spatial resolution (~50 km grid); intended for regional solar/agrometeorological context rather than paddock-scale rain gauge replacement.',
      integrationMode: 'live_api',
      status: 'active',
    },
    {
      id: 'ds-open-meteo-elevation',
      sourceName: 'Open-Meteo / Copernicus DEM',
      sourceUrl: 'https://api.open-meteo.com/v1/elevation',
      datasetOrApiName: 'Copernicus DEM GLO-90 Elevation API',
      category: 'elevation_terrain',
      retrievedAt: retrievedToday,
      geographicCoverage: 'South Africa national terrain model (90 m resolution)',
      units: 'metres above mean sea level (m.a.s.l.)',
      licenceAndTerms: 'Copernicus DEM Licence / Open-Meteo CC BY 4.0.',
      limitations:
        'Point elevation at farm pin; does not replace a full topographic contour survey for dam design or contour bunding.',
      integrationMode: 'live_api',
      status: 'active',
    },
    {
      id: 'ds-isric-soilgrids',
      sourceName: 'ISRIC — World Soil Information',
      sourceUrl: 'https://rest.isric.org/soilgrids/v2.0/properties/query',
      datasetOrApiName: 'SoilGrids 250m v2.0 REST Property Query API',
      category: 'soil',
      retrievedAt: retrievedToday,
      geographicCoverage: 'Global 250 m gridded soil predictions including South Africa',
      units: 'pH ×10, g/kg (clay/silt/sand/SOC), cmol(c)/kg (CEC)',
      licenceAndTerms: 'CC BY 4.0 (ISRIC World Soil Information).',
      limitations:
        'Predicted 250 m statistical model estimates only — NEVER a substitute for an accredited South African laboratory soil test (e.g., ARC-ISCW / NviroTek / Cedara). Public REST endpoint may also experience latency or rate limiting.',
      integrationMode: 'live_api',
      status: 'rate_limited_or_slow',
    },
    {
      id: 'ds-osm-nominatim',
      sourceName: 'OpenStreetMap Foundation / Nominatim',
      sourceUrl: 'https://nominatim.openstreetmap.org/search',
      datasetOrApiName: 'OSM Nominatim Geocoding Search (countrycodes=za)',
      category: 'geographical_boundaries',
      retrievedAt: retrievedToday,
      geographicCoverage: 'South African towns, villages, suburbs, farms, and administrative regions',
      units: 'WGS84 decimal degrees (latitude, longitude)',
      licenceAndTerms: 'Open Database License (ODbL); subject to OSM Nominatim usage policy.',
      limitations:
        'Rural farm portions or informal settlements may return municipal or town centroids requiring manual map pin adjustment and farmer confirmation.',
      integrationMode: 'live_api',
      status: 'active',
    },
    {
      id: 'ds-open-meteo-geocoding',
      sourceName: 'Open-Meteo / GeoNames',
      sourceUrl: 'https://geocoding-api.open-meteo.com/v1/search',
      datasetOrApiName: 'Open-Meteo Place & Settlement Geocoding API (countryCode=ZA)',
      category: 'geographical_boundaries',
      retrievedAt: retrievedToday,
      geographicCoverage: 'South African cities, towns, and rural settlements',
      units: 'WGS84 decimal degrees, m.a.s.l. elevation',
      licenceAndTerms: 'GeoNames CC BY 4.0 via Open-Meteo.',
      limitations:
        'Covers named settlements and administrative centres; exact farm gates must be refined manually on the map.',
      integrationMode: 'live_api',
      status: 'active',
    },
    {
      id: 'ds-statssa-ag',
      sourceName: 'Statistics South Africa (Stats SA)',
      sourceUrl: 'https://www.statssa.gov.za/',
      datasetOrApiName:
        'Census of Commercial Agriculture (CoCA 2017) & Provincial Administrative Geography Reference',
      category: 'statistics',
      retrievedAt: retrievedToday,
      geographicCoverage: 'All 9 South African provinces & 52 district/metropolitan municipalities',
      units: 'Hectares, Rand (ZAR), provincial commodity shares',
      licenceAndTerms:
        'Stats SA Open Data / Government Publication with attribution; web portal does not expose an unauthenticated JSON REST endpoint.',
      limitations:
        'Provincial & district baselines in Field Shift are structured reference summaries derived from official provincial boundaries and agricultural classifications — never presented as live customer counts or automated API feeds.',
      integrationMode: 'portal_reference',
      status: 'reference_only',
    },
    {
      id: 'ds-arc-iscw',
      sourceName: 'Agricultural Research Council — Institute for Soil, Climate and Water (ARC-ISCW)',
      sourceUrl: 'https://www.arc.agric.za/arc-iscw',
      datasetOrApiName: 'South African Land Type Survey & Provincial Agro-Climatology Reference',
      category: 'soil',
      retrievedAt: retrievedToday,
      geographicCoverage: 'South Africa national land-type & rainfall-regime taxonomy',
      units: 'Climate zone, annual rainfall bands (mm/yr), broad soil capability groups',
      licenceAndTerms:
        'ARC Research Reference; programmatic access requires institutional agreement/data licence.',
      limitations:
        'Regional agro-ecological descriptors only; not a site-specific farm soil survey.',
      integrationMode: 'portal_reference',
      status: 'reference_only',
    },
    {
      id: 'ds-soils4africa',
      sourceName: 'Soils4Africa (EU Horizon 2020 / FAO-ISRIC)',
      sourceUrl: 'https://www.soils4africa-h2020.eu/',
      datasetOrApiName: 'Soils4Africa Continental Soil Information System',
      category: 'soil',
      retrievedAt: retrievedToday,
      geographicCoverage: 'Continental Africa 20 km sampling framework (portal download)',
      units: 'Soil physicochemical indicators',
      licenceAndTerms:
        'Open scientific portal with registration/terms; no open unauthenticated REST query API integrated.',
      limitations:
        'Documented as an external portal reference; SoilGrids 250m and farmer-uploaded South African lab reports provide field-level context in Field Shift.',
      integrationMode: 'portal_reference',
      status: 'reference_only',
    },
    {
      id: 'ds-saws-adapter',
      sourceName: 'South African Weather Service (SAWS)',
      sourceUrl: process.env.SAWS_API_URL || 'https://www.weathersa.co.za/',
      datasetOrApiName: 'SAWS Official Station & CAP Alert Adapter',
      category: 'weather',
      retrievedAt: retrievedToday,
      geographicCoverage: 'South Africa official meteorological station network',
      units: 'mm (rainfall), °C (temp), km/h (wind), CAP alert levels',
      licenceAndTerms:
        'Commercial/Institutional SAWS data licence required (SAWS_API_URL & SAWS_API_KEY env vars).',
      limitations: sawsConfigured
        ? 'Connected via environment configuration.'
        : 'Not configured in this environment (SAWS_API_KEY not set); Open-Meteo + NASA POWER provide weather and agro-met telemetry transparently.',
      integrationMode: 'optional_env_adapter',
      status: sawsConfigured ? 'active' : 'unconfigured',
    },
    {
      id: 'ds-dalrrd-wfs',
      sourceName: 'Department of Agriculture, Land Reform and Rural Development (DALRRD)',
      sourceUrl: process.env.DALRRD_SOIL_WFS_URL || 'https://www.dalrrd.gov.za/',
      datasetOrApiName: 'DALRRD Soil & Agricultural Land Capability WFS Adapter',
      category: 'soil',
      retrievedAt: retrievedToday,
      geographicCoverage: 'South Africa agricultural land capability zones',
      units: 'GeoJSON / WFS capability classes',
      licenceAndTerms:
        'Requires configured DALRRD WFS endpoint (DALRRD_SOIL_WFS_URL env var).',
      limitations: dalrrdConfigured
        ? 'Configured WFS endpoint active.'
        : 'Optional WFS URL not set; regional soil reference + SoilGrids 250m used as context while advising physical lab tests.',
      integrationMode: 'optional_env_adapter',
      status: dalrrdConfigured ? 'active' : 'unconfigured',
    },
  ];
}
