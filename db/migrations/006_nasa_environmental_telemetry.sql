-- Field Shift: Migration 006 - NASA POWER Telemetry, Parameter Registry,
-- Normalised Observations, Climate Indicators, and Crop Rotation Decision Logs

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environmental_provenance_type') THEN
    CREATE TYPE environmental_provenance_type AS ENUM (
      'nasa_satellite_reanalysis',
      'nasa_model_soil_wetness',
      'nasa_model_evaporation',
      'external_forecast',
      'farmer_reported',
      'laboratory_soil_test',
      'system_indicator',
      'climate_projection'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS nasa_dataset_sources (
  id VARCHAR(64) PRIMARY KEY,
  dataset_name VARCHAR(160) NOT NULL,
  provider VARCHAR(120) NOT NULL,
  community VARCHAR(32) NOT NULL DEFAULT 'AG',
  base_url TEXT NOT NULL,
  spatial_resolution_deg VARCHAR(64) NOT NULL,
  temporal_resolutions TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nasa_parameter_registry (
  parameter_code VARCHAR(48) PRIMARY KEY,
  dataset_source_id VARCHAR(64) NOT NULL REFERENCES nasa_dataset_sources(id) ON DELETE CASCADE,
  parameter_name VARCHAR(160) NOT NULL,
  unit VARCHAR(48) NOT NULL,
  provenance_type environmental_provenance_type NOT NULL,
  supported_resolutions TEXT[] NOT NULL,
  fill_value NUMERIC(12, 3) NOT NULL DEFAULT -999,
  latency_note TEXT NOT NULL,
  agronomic_limitation TEXT NOT NULL,
  verified_live BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS nasa_raw_retrievals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(80),
  farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
  latitude NUMERIC(9, 6) NOT NULL CHECK (latitude BETWEEN -35.0 AND -21.8),
  longitude NUMERIC(9, 6) NOT NULL CHECK (longitude BETWEEN 16.0 AND 33.5),
  temporal_resolution VARCHAR(32) NOT NULL CHECK (temporal_resolution IN ('daily', 'monthly', 'climatology')),
  date_window_label VARCHAR(80) NOT NULL,
  endpoint_url TEXT NOT NULL,
  parameters_requested TEXT[] NOT NULL,
  http_status INTEGER,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  valid_observation_count INTEGER NOT NULL DEFAULT 0,
  fill_value_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nasa_raw_retrievals_coords_time
  ON nasa_raw_retrievals (latitude, longitude, temporal_resolution, retrieved_at DESC);

CREATE TABLE IF NOT EXISTS environmental_observations_normalized (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retrieval_id UUID NOT NULL REFERENCES nasa_raw_retrievals(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  observation_date DATE NOT NULL,
  temporal_granularity VARCHAR(16) NOT NULL CHECK (temporal_granularity IN ('daily', 'monthly')),
  parameter_code VARCHAR(48) NOT NULL REFERENCES nasa_parameter_registry(parameter_code),
  numeric_value NUMERIC(12, 4), -- NULL when missing or -999 fill value (never coerced to 0)
  unit VARCHAR(48) NOT NULL,
  provenance_type environmental_provenance_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_env_obs_farm_date
  ON environmental_observations_normalized (farm_id, observation_date DESC, parameter_code);

CREATE TABLE IF NOT EXISTS calculated_climate_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  indicator_code VARCHAR(64) NOT NULL,
  indicator_label VARCHAR(160) NOT NULL,
  temporal_window VARCHAR(64) NOT NULL,
  numeric_value NUMERIC(12, 4),
  unit VARCHAR(48) NOT NULL,
  provenance_type environmental_provenance_type NOT NULL DEFAULT 'system_indicator',
  formula_description TEXT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crop_rotation_decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
  field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  recommended_strategy_id VARCHAR(80) NOT NULL,
  strategy_name VARCHAR(200) NOT NULL,
  decision_support_score NUMERIC(5, 2) NOT NULL CHECK (decision_support_score BETWEEN 0 AND 100),
  data_confidence VARCHAR(32) NOT NULL,
  farmer_priorities TEXT[] NOT NULL DEFAULT '{}',
  nasa_retrieval_id UUID REFERENCES nasa_raw_retrievals(id) ON DELETE SET NULL,
  assumptions TEXT[] NOT NULL DEFAULT '{}',
  limitations TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
