-- Field Shift: Migration 004 - Visual Agricultural Analysis, Stock & Valuation, and Farm Incidents

-- 22. Visual Agricultural Analysis History (Photos & Selected Video Frames)
CREATE TABLE IF NOT EXISTS visual_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  livestock_group_id UUID REFERENCES livestock_groups(id) ON DELETE SET NULL,
  crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(60) NOT NULL,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
  media_file_name VARCHAR(255) NOT NULL,
  media_mime_type VARCHAR(80) NOT NULL,
  analyzed_frames_count INTEGER NOT NULL DEFAULT 1,
  media_preview_data_url TEXT,
  user_question TEXT NOT NULL DEFAULT '',
  possible_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT NOT NULL,
  possible_causes JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_level VARCHAR(30) NOT NULL DEFAULT 'Moderate',
  uncertainty_note TEXT NOT NULL,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  safety_disclaimer TEXT NOT NULL,
  powered_by VARCHAR(40) NOT NULL,
  linked_incident_id UUID,
  linked_record_note TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visual_analyses_farm_id ON visual_analyses(farm_id);

-- 23. Immutable Crop Stock Movements & Stored Production Ledger
CREATE TABLE IF NOT EXISTS crop_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id UUID NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  movement_type VARCHAR(40) NOT NULL CHECK (
    movement_type IN ('planting', 'damage', 'harvest', 'storage_in', 'sale', 'spoilage', 'adjustment')
  ),
  movement_date DATE NOT NULL,
  quantity_delta NUMERIC(12, 2) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  unit_price_zar NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_value_zar NUMERIC(14, 2) NOT NULL DEFAULT 0,
  resulting_remaining_plants INTEGER,
  resulting_stored_kg NUMERIC(12, 2),
  notes TEXT NOT NULL DEFAULT '',
  incident_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_stock_movements_crop_id ON crop_stock_movements(crop_id);
CREATE INDEX IF NOT EXISTS idx_crop_stock_movements_farm_id ON crop_stock_movements(farm_id);

-- 24. Farmer-Entered Stock Unit Prices & Valuation Assumptions
CREATE TABLE IF NOT EXISTS stock_price_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('crop_plant', 'crop_harvest', 'livestock')),
  entity_id UUID NOT NULL,
  unit_label VARCHAR(40) NOT NULL,
  unit_price_zar NUMERIC(12, 2) NOT NULL DEFAULT 0,
  price_source VARCHAR(160) NOT NULL DEFAULT 'Farmer-entered unit price',
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_price_entity ON stock_price_settings(entity_type, entity_id);

-- 25. Farm Incidents & Damage Records (Monitoring & Decision Support)
CREATE TABLE IF NOT EXISTS farm_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  crop_id UUID REFERENCES crops(id) ON DELETE SET NULL,
  livestock_group_id UUID REFERENCES livestock_groups(id) ON DELETE SET NULL,
  visual_analysis_id UUID REFERENCES visual_analyses(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  incident_type VARCHAR(60) NOT NULL,
  title VARCHAR(180) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  media_file_name VARCHAR(255),
  media_type VARCHAR(20),
  media_preview_data_url TEXT,
  affected_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  affected_unit VARCHAR(40) NOT NULL DEFAULT 'units',
  affected_area_hectares NUMERIC(10, 2) NOT NULL DEFAULT 0,
  original_recorded_quantity NUMERIC(12, 2),
  remaining_recorded_quantity NUMERIC(12, 2),
  estimated_financial_impact_zar NUMERIC(14, 2) NOT NULL DEFAULT 0,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'monitoring', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farm_incidents_farm_id ON farm_incidents(farm_id);

-- 26. Incident Follow-up Activities & Audit Trail
CREATE TABLE IF NOT EXISTS incident_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES farm_incidents(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  follow_up_date DATE NOT NULL,
  status_after VARCHAR(30) NOT NULL,
  action_taken TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_follow_ups_incident_id ON incident_follow_ups(incident_id);
