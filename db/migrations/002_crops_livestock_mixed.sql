-- Field Shift: Migration 002 - GPS Distinction, Crop Management, Livestock & Mixed Farming

-- Extend farm_locations to explicitly distinguish GPS coordinates from manual map pins
ALTER TABLE farm_locations
  ADD COLUMN IF NOT EXISTS location_source VARCHAR(32) NOT NULL DEFAULT 'municipal_center',
  ADD COLUMN IF NOT EXISTS gps_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_accuracy_meters NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS gps_captured_at TIMESTAMPTZ;

-- 13. Crops
CREATE TABLE IF NOT EXISTS crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop_name VARCHAR(120) NOT NULL,
  crop_variety VARCHAR(120) NOT NULL,
  planting_date DATE NOT NULL,
  planting_quantity INTEGER NOT NULL DEFAULT 0,
  damaged_plants INTEGER NOT NULL DEFAULT 0,
  cultivated_area_hectares NUMERIC(10, 2) NOT NULL DEFAULT 0,
  soil_information TEXT NOT NULL,
  irrigation_method VARCHAR(120) NOT NULL,
  fertiliser_information TEXT NOT NULL,
  expected_harvesting_date DATE NOT NULL,
  growth_stage VARCHAR(40) NOT NULL DEFAULT 'planted',
  harvested_quantity_kg NUMERIC(12, 2) NOT NULL DEFAULT 0,
  estimated_value_zar NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crops_farm_id ON crops(farm_id);
CREATE INDEX IF NOT EXISTS idx_crops_field_id ON crops(field_id);

-- 14. CropActivities (Historical tracking of stages, irrigation, fertiliser, pests, diseases, damage, harvests, edits)
CREATE TABLE IF NOT EXISTS crop_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  activity_type VARCHAR(40) NOT NULL,
  activity_date DATE NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(32) NOT NULL DEFAULT 'kg',
  value_zar NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_activities_crop_id ON crop_activities(crop_id);

-- 15. LivestockGroups (Supports Cattle, Sheep, Goats, Pigs, Poultry - groups & individual tagged animals)
CREATE TABLE IF NOT EXISTS livestock_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  animal_type VARCHAR(32) NOT NULL,
  group_name VARCHAR(150) NOT NULL,
  breed VARCHAR(120) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  identification_number VARCHAR(120),
  registration_date DATE NOT NULL,
  health_status VARCHAR(64) NOT NULL DEFAULT 'Healthy',
  feeding_information TEXT NOT NULL,
  grazing_information TEXT NOT NULL,
  housing_information TEXT NOT NULL,
  estimated_unit_value_zar NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_livestock_groups_farm_id ON livestock_groups(farm_id);

-- 16. LivestockRecords (Births, Deaths, Purchases, Sales, Transfers, Feeding, Vet, Vaccinations, Production)
CREATE TABLE IF NOT EXISTS livestock_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_group_id UUID NOT NULL REFERENCES livestock_groups(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  record_type VARCHAR(40) NOT NULL,
  record_date DATE NOT NULL,
  quantity_change INTEGER NOT NULL DEFAULT 0,
  production_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  production_unit VARCHAR(32),
  value_zar NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_livestock_records_group_id ON livestock_records(livestock_group_id);

-- 17. MixedFarmingEntries (Shared land, feed production, water logs, combined expenses & production records)
CREATE TABLE IF NOT EXISTS mixed_farming_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_category VARCHAR(48) NOT NULL,
  title VARCHAR(180) NOT NULL,
  entry_date DATE NOT NULL,
  related_crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
  related_livestock_id UUID REFERENCES livestock_groups(id) ON DELETE SET NULL,
  expense_zar NUMERIC(14, 2) NOT NULL DEFAULT 0,
  production_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  production_unit VARCHAR(32),
  water_liters NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mixed_farming_farm_id ON mixed_farming_entries(farm_id);
