-- Field Shift: Migration 005 - Complete Runtime Table Parity, SA Geographic Bounds,
-- Missing Foreign Keys, Integrity Check Constraints, and Demonstration Record Separation

-- 0. Demonstration vs Real Production Account/Farm Separation
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_demonstration BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE farms
  ADD COLUMN IF NOT EXISTS is_demonstration BOOLEAN NOT NULL DEFAULT FALSE;

-- 1. Enforce South African Coordinate Bounds & Domain Non-Negative Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_farm_locations_sa_bounds') THEN
    ALTER TABLE farm_locations
      ADD CONSTRAINT chk_farm_locations_sa_bounds
      CHECK (latitude BETWEEN -35.0 AND -21.8 AND longitude BETWEEN 16.0 AND 33.5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_farms_non_negative_size') THEN
    ALTER TABLE farms
      ADD CONSTRAINT chk_farms_non_negative_size
      CHECK (farm_size_hectares >= 0 AND years_of_experience >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fields_non_negative_area') THEN
    ALTER TABLE fields
      ADD CONSTRAINT chk_fields_non_negative_area
      CHECK (area_hectares >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_crops_quantities_valid') THEN
    ALTER TABLE crops
      ADD CONSTRAINT chk_crops_quantities_valid
      CHECK (
        planting_quantity >= 0
        AND damaged_plants >= 0
        AND damaged_plants <= planting_quantity
        AND cultivated_area_hectares >= 0
        AND harvested_quantity_kg >= 0
        AND estimated_value_zar >= 0
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_livestock_non_negative') THEN
    ALTER TABLE livestock_groups
      ADD CONSTRAINT chk_livestock_non_negative
      CHECK (quantity >= 0 AND estimated_unit_value_zar >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_price_non_negative') THEN
    ALTER TABLE stock_price_settings
      ADD CONSTRAINT chk_stock_price_non_negative
      CHECK (unit_price_zar >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_incidents_non_negative') THEN
    ALTER TABLE farm_incidents
      ADD CONSTRAINT chk_incidents_non_negative
      CHECK (
        affected_quantity >= 0
        AND affected_area_hectares >= 0
        AND estimated_financial_impact_zar >= 0
      );
  END IF;
END $$;

-- 2. Missing Foreign Keys across Visual Analyses & Stock Movements
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_visual_analyses_incident') THEN
    ALTER TABLE visual_analyses
      ADD CONSTRAINT fk_visual_analyses_incident
      FOREIGN KEY (linked_incident_id) REFERENCES farm_incidents(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_crop_stock_movements_incident') THEN
    ALTER TABLE crop_stock_movements
      ADD CONSTRAINT fk_crop_stock_movements_incident
      FOREIGN KEY (incident_id) REFERENCES farm_incidents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Weather Forecast Snapshots & Farmer Rain-Gauge Observations (Weather Feedback Loop)
CREATE TABLE IF NOT EXISTS weather_forecast_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_name VARCHAR(160) NOT NULL,
  source_category VARCHAR(48) NOT NULL DEFAULT 'forecast_information',
  verified_station_name VARCHAR(160),
  verified_station_rain_mm NUMERIC(8, 2),
  verified_station_temp_c NUMERIC(5, 2),
  predicted_rainfall_mm NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (predicted_rainfall_mm >= 0),
  predicted_temp_min_c NUMERIC(5, 2) NOT NULL,
  predicted_temp_max_c NUMERIC(5, 2) NOT NULL,
  predicted_wind_max_kmh NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (predicted_wind_max_kmh >= 0),
  weather_description VARCHAR(200) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weather_forecast_records_farm_date
  ON weather_forecast_records(farm_id, forecast_date DESC);

CREATE TABLE IF NOT EXISTS farmer_weather_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_location_label VARCHAR(200) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -35.0 AND -21.8),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN 16.0 AND 33.5),
  observation_date DATE NOT NULL,
  rainfall_occurred BOOLEAN NOT NULL DEFAULT FALSE,
  rainfall_intensity VARCHAR(24) NOT NULL CHECK (rainfall_intensity IN ('none', 'light', 'moderate', 'heavy', 'extreme')),
  measured_rainfall_mm NUMERIC(8, 2) CHECK (measured_rainfall_mm IS NULL OR measured_rainfall_mm >= 0),
  temperature_c NUMERIC(5, 2),
  wind_observation VARCHAR(32) NOT NULL CHECK (wind_observation IN ('calm', 'light_breeze', 'moderate_wind', 'strong_wind', 'gale')),
  wind_speed_estimate_kmh NUMERIC(6, 2) CHECK (wind_speed_estimate_kmh IS NULL OR wind_speed_estimate_kmh >= 0),
  notes TEXT NOT NULL DEFAULT '',
  source_category VARCHAR(48) NOT NULL DEFAULT 'farmer_reported_observation',
  qc_status VARCHAR(40) NOT NULL DEFAULT 'pending_qc' CHECK (qc_status IN ('pending_qc', 'qc_passed_reference', 'qc_flagged_outlier')),
  qc_notes TEXT NOT NULL DEFAULT '',
  compared_forecast_record_id UUID REFERENCES weather_forecast_records(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_weather_obs_farm_date
  ON farmer_weather_observations(farm_id, observation_date DESC);

-- 4. Farming Business Plans & Saved Prospective Locations
CREATE TABLE IF NOT EXISTS business_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
  plan_name VARCHAR(200) NOT NULL,
  farming_type VARCHAR(120) NOT NULL,
  scale_tier VARCHAR(32) NOT NULL CHECK (scale_tier IN ('small_scale', 'medium_scale', 'large_scale')),
  province VARCHAR(100) NOT NULL,
  district VARCHAR(150) NOT NULL DEFAULT '',
  farm_size_hectares NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (farm_size_hectares >= 0),
  production_goals TEXT NOT NULL DEFAULT '',
  market_channel VARCHAR(160) NOT NULL DEFAULT '',
  equipment_cost_zar NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (equipment_cost_zar >= 0),
  equipment_notes TEXT NOT NULL DEFAULT '',
  seeds_planting_cost_zar NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (seeds_planting_cost_zar >= 0),
  fertilisers_cost_zar NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (fertilisers_cost_zar >= 0),
  feed_cost_zar NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (feed_cost_zar >= 0),
  water_cost_zar NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (water_cost_zar >= 0),
  water_demand_m3 NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (water_demand_m3 >= 0),
  labour_workers INTEGER NOT NULL DEFAULT 0 CHECK (labour_workers >= 0),
  labour_cost_zar NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (labour_cost_zar >= 0),
  infrastructure_cost_zar NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (infrastructure_cost_zar >= 0),
  operating_expenses_zar NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (operating_expenses_zar >= 0),
  expected_production_qty NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (expected_production_qty >= 0),
  production_unit VARCHAR(40) NOT NULL DEFAULT 'units',
  selling_price_per_unit_zar NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (selling_price_per_unit_zar >= 0),
  assumptions_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_plans_owner ON business_plans(owner_id);

CREATE TABLE IF NOT EXISTS saved_prospective_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  province VARCHAR(100) NOT NULL,
  district VARCHAR(150) NOT NULL,
  town_or_area VARCHAR(150) NOT NULL,
  intended_hectares NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (intended_hectares >= 0),
  water_source_note TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_prospective_locations_user ON saved_prospective_locations(user_id);

-- 5. Learning Centre Materials & Progress
CREATE TABLE IF NOT EXISTS learning_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(160) NOT NULL UNIQUE,
  category VARCHAR(64) NOT NULL,
  content_type VARCHAR(32) NOT NULL CHECK (content_type IN ('article', 'step_by_step_guide', 'illustrated_guide', 'video_lesson')),
  difficulty VARCHAR(24) NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'experienced')),
  illustration_key VARCHAR(100) NOT NULL,
  custom_illustration_data_url TEXT,
  video_url TEXT,
  video_duration_label VARCHAR(40),
  video_slides JSONB,
  source_attribution VARCHAR(255) NOT NULL,
  verified_official_reference BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(24) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived')),
  estimated_minutes INTEGER NOT NULL DEFAULT 5 CHECK (estimated_minutes > 0),
  tags TEXT[] NOT NULL DEFAULT '{}',
  translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES learning_materials(id) ON DELETE CASCADE,
  is_saved BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(24) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  completed_steps INTEGER[] NOT NULL DEFAULT '{}',
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, material_id)
);

-- 6. Reporting Exports, Translation Overrides, System Configuration & Announcements
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code VARCHAR(64) NOT NULL,
  report_type VARCHAR(64) NOT NULL,
  report_title VARCHAR(200) NOT NULL,
  farm_id VARCHAR(80) NOT NULL,
  farm_label VARCHAR(200) NOT NULL,
  is_aggregated_organisation_report BOOLEAN NOT NULL DEFAULT FALSE,
  start_date VARCHAR(20) NOT NULL DEFAULT '',
  end_date VARCHAR(20) NOT NULL DEFAULT '',
  farming_category VARCHAR(64) NOT NULL DEFAULT 'all',
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  contains_estimated_values BOOLEAN NOT NULL DEFAULT FALSE,
  summary_headline TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_user ON generated_reports(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS translation_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(16) NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
  key VARCHAR(120) NOT NULL,
  value TEXT NOT NULL,
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(language_code, key)
);

CREATE TABLE IF NOT EXISTS system_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  application JSONB NOT NULL,
  notifications JSONB NOT NULL,
  agricultural_reference JSONB NOT NULL,
  ai JSONB NOT NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  target_role VARCHAR(64) NOT NULL DEFAULT 'all',
  severity VARCHAR(24) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'advisory', 'warning')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- 7. Agricultural Experts, Organisations & Farmer POPIA Consent Grants
CREATE TABLE IF NOT EXISTS expert_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  specialisation VARCHAR(64) NOT NULL,
  secondary_specialisations TEXT[] NOT NULL DEFAULT '{}',
  qualifications TEXT NOT NULL DEFAULT '',
  professional_body_number VARCHAR(120) NOT NULL DEFAULT '',
  years_experience INTEGER NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
  provinces_served TEXT[] NOT NULL DEFAULT '{}',
  languages_spoken TEXT[] NOT NULL DEFAULT '{}',
  bio TEXT NOT NULL DEFAULT '',
  availability_status VARCHAR(24) NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'limited', 'unavailable')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  organisation_type VARCHAR(48) NOT NULL CHECK (organisation_type IN ('cooperative', 'agricultural_company', 'extension_agency', 'research_body')),
  registration_number VARCHAR(120) NOT NULL DEFAULT '',
  province VARCHAR(100) NOT NULL,
  district VARCHAR(150) NOT NULL DEFAULT '',
  primary_focus VARCHAR(180) NOT NULL DEFAULT '',
  contact_email VARCHAR(255) NOT NULL DEFAULT '',
  contact_phone VARCHAR(40) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organisation_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_role VARCHAR(32) NOT NULL CHECK (org_role IN ('owner', 'manager', 'analyst', 'advisor')),
  status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id, user_id)
);

CREATE TABLE IF NOT EXISTS farm_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farmer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grantee_type VARCHAR(24) NOT NULL CHECK (grantee_type IN ('expert', 'organisation')),
  grantee_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  grantee_label VARCHAR(200) NOT NULL,
  scopes JSONB NOT NULL,
  authorised_basis TEXT NOT NULL DEFAULT '',
  status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CHECK (
    (grantee_type = 'expert' AND grantee_user_id IS NOT NULL)
    OR (grantee_type = 'organisation' AND organisation_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_farm_access_grants_farm ON farm_access_grants(farm_id, status);
CREATE INDEX IF NOT EXISTS idx_farm_access_grants_grantee_user ON farm_access_grants(grantee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_farm_access_grants_org ON farm_access_grants(organisation_id, status);

CREATE TABLE IF NOT EXISTS expert_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expert_name VARCHAR(200) NOT NULL,
  expert_specialisation VARCHAR(64) NOT NULL,
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES farm_incidents(id) ON DELETE SET NULL,
  crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
  livestock_group_id UUID REFERENCES livestock_groups(id) ON DELETE SET NULL,
  soil_report_id UUID REFERENCES soil_reports(id) ON DELETE SET NULL,
  ai_insight_id UUID,
  concern_category VARCHAR(48) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  assessment TEXT NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'in_progress', 'completed')),
  farmer_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expert_feedbacks_farm ON expert_feedbacks(farm_id, created_at DESC);

-- 8. Notification Preferences, Deliveries & Offline Sync Idempotency Registry
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  channels JSONB NOT NULL,
  categories JSONB NOT NULL,
  quiet_hours_start VARCHAR(10) NOT NULL DEFAULT '22:00',
  quiet_hours_end VARCHAR(10) NOT NULL DEFAULT '05:30',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(64) NOT NULL,
  channel VARCHAR(24) NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
  status VARCHAR(40) NOT NULL,
  target_masked VARCHAR(160) NOT NULL DEFAULT '',
  provider_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_sync_ids (
  client_mutation_id VARCHAR(128) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mutation_type VARCHAR(64) NOT NULL,
  server_entity_id VARCHAR(128),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, client_mutation_id)
);

-- 9. High-Value Composite Indexes for Multi-Farm Queries & Security Audits
CREATE INDEX IF NOT EXISTS idx_crop_activities_farm_date ON crop_activities(farm_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_livestock_records_farm_date ON livestock_records(farm_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_mixed_farming_farm_date ON mixed_farming_entries(farm_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_incidents_farm_occurred ON farm_incidents(farm_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at);
