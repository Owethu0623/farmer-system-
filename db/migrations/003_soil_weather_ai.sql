-- Field Shift: Migration 003 - Soil & Land Intelligence, Agricultural Weather, and AI Decision-Support Logs

-- 18. Farmer-Uploaded Laboratory Soil Reports (Actual Lab Measurements)
CREATE TABLE IF NOT EXISTS soil_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  laboratory_name VARCHAR(160) NOT NULL,
  sample_code VARCHAR(80) NOT NULL,
  sample_date DATE NOT NULL,
  sample_depth_cm VARCHAR(40) NOT NULL DEFAULT '0-20 cm',
  soil_ph_water NUMERIC(4, 2),
  soil_ph_kcl NUMERIC(4, 2),
  soil_texture_class VARCHAR(80) NOT NULL,
  clay_percent NUMERIC(5, 2),
  silt_percent NUMERIC(5, 2),
  sand_percent NUMERIC(5, 2),
  organic_matter_percent NUMERIC(5, 2),
  nitrogen_mg_kg NUMERIC(8, 2),
  phosphorus_mg_kg NUMERIC(8, 2),
  potassium_mg_kg NUMERIC(8, 2),
  calcium_mg_kg NUMERIC(8, 2),
  magnesium_mg_kg NUMERIC(8, 2),
  cec_cmol_kg NUMERIC(6, 2),
  fertility_rating VARCHAR(40) NOT NULL DEFAULT 'Moderate',
  drainage_class VARCHAR(60) NOT NULL DEFAULT 'Well Drained',
  water_holding_capacity_mm_m NUMERIC(6, 1),
  attachment_file_name VARCHAR(255),
  attachment_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soil_reports_farm_id ON soil_reports(farm_id);

-- 19. Mapped Geospatial Soil & Land Estimates Cache (ARC / DALRRD / ISRIC SoilGrids)
CREATE TABLE IF NOT EXISTS soil_estimates_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  source_provider VARCHAR(120) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  elevation_meters NUMERIC(7, 1),
  terrain_class VARCHAR(120),
  mapped_ph_water NUMERIC(4, 2),
  mapped_clay_percent NUMERIC(5, 2),
  mapped_sand_percent NUMERIC(5, 2),
  mapped_silt_percent NUMERIC(5, 2),
  mapped_organic_carbon_g_kg NUMERIC(6, 2),
  mapped_nitrogen_g_kg NUMERIC(6, 2),
  mapped_cec_mmol_kg NUMERIC(6, 1),
  raw_payload JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soil_estimates_farm_id ON soil_estimates_cache(farm_id);

-- 20. Agricultural Weather Snapshots & Warnings Log (Open-Meteo / SAWS)
CREATE TABLE IF NOT EXISTS weather_observations_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  provider_name VARCHAR(120) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  current_payload JSONB NOT NULL,
  daily_payload JSONB NOT NULL,
  historical_payload JSONB,
  warnings_payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_cache_farm_id ON weather_observations_cache(farm_id);

-- 21. AI Agricultural Decision-Support & Analytics Logs
CREATE TABLE IF NOT EXISTS ai_advisory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
  query_type VARCHAR(32) NOT NULL DEFAULT 'qa',
  language_code VARCHAR(10) NOT NULL,
  question_text TEXT NOT NULL,
  response_payload JSONB NOT NULL,
  powered_by VARCHAR(40) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON ai_advisory_logs(user_id);
