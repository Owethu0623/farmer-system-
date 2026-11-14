-- Field Shift: PostgreSQL + PostGIS Foundational Migration (001_initial_postgis.sql)
-- Requires PostgreSQL 15+ and PostGIS 3+

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Languages (All 12 Official South African Languages)
CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  native_name VARCHAR(100) NOT NULL,
  has_audio_support BOOLEAN NOT NULL DEFAULT TRUE,
  has_sign_language_support BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id) ON UPDATE CASCADE,
  preferred_language_code VARCHAR(16) NOT NULL REFERENCES languages(code) ON UPDATE CASCADE DEFAULT 'en',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  activation_token VARCHAR(128),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 4. UserProfiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(200) NOT NULL,
  phone_number VARCHAR(32),
  province VARCHAR(100),
  district VARCHAR(150),
  farmer_experience_years INTEGER DEFAULT 0,
  accessibility_large_text BOOLEAN NOT NULL DEFAULT FALSE,
  accessibility_audio_guidance BOOLEAN NOT NULL DEFAULT FALSE,
  accessibility_voice_input BOOLEAN NOT NULL DEFAULT FALSE,
  prospective_data JSONB,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. UserPermissions
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permission_key VARCHAR(120) NOT NULL,
  is_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_role ON user_permissions(role_id);

-- 6. FarmingTypes
CREATE TABLE IF NOT EXISTS farming_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(64) NOT NULL,
  description TEXT NOT NULL
);

-- 7. Farms
CREATE TABLE IF NOT EXISTS farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  farming_activities TEXT[] NOT NULL DEFAULT '{}',
  farm_size_hectares NUMERIC(12, 2) NOT NULL DEFAULT 0,
  years_of_experience INTEGER NOT NULL DEFAULT 0,
  water_availability VARCHAR(120) NOT NULL,
  existing_crops TEXT[] NOT NULL DEFAULT '{}',
  existing_livestock TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farms_owner_id ON farms(owner_id);

-- 8. FarmLocations (PostGIS Point Geometry in WGS84 / SRID 4326)
CREATE TABLE IF NOT EXISTS farm_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL UNIQUE REFERENCES farms(id) ON DELETE CASCADE,
  province VARCHAR(100) NOT NULL,
  district_municipality VARCHAR(150) NOT NULL,
  local_municipality VARCHAR(150) NOT NULL,
  town_or_village VARCHAR(150) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  centroid GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
  elevation_meters NUMERIC(8, 2)
);

CREATE INDEX IF NOT EXISTS idx_farm_locations_centroid ON farm_locations USING GIST(centroid);

-- 9. FarmBoundaries (PostGIS Polygon Geometry in WGS84 / SRID 4326)
CREATE TABLE IF NOT EXISTS farm_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL UNIQUE REFERENCES farms(id) ON DELETE CASCADE,
  boundary_geom GEOMETRY(Polygon, 4326),
  geojson JSONB NOT NULL,
  calculated_area_hectares NUMERIC(12, 2) NOT NULL DEFAULT 0,
  perimeter_meters NUMERIC(12, 2) NOT NULL DEFAULT 0,
  source VARCHAR(64) NOT NULL DEFAULT 'user_sketch',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farm_boundaries_geom ON farm_boundaries USING GIST(boundary_geom);

-- 10. Fields (Sub-parcels belonging to a Farm)
CREATE TABLE IF NOT EXISTS fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  farming_type_id UUID REFERENCES farming_types(id) ON DELETE SET NULL,
  crop_or_livestock VARCHAR(150) NOT NULL,
  area_hectares NUMERIC(10, 2) NOT NULL DEFAULT 0,
  soil_type VARCHAR(100),
  irrigation_type VARCHAR(100),
  field_geom GEOMETRY(Polygon, 4326),
  geojson JSONB,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fields_farm_id ON fields(farm_id);
CREATE INDEX IF NOT EXISTS idx_fields_geom ON fields USING GIST(field_geom);

-- 11. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'advisory',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  action_url VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- 12. AuditLogs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(128),
  details JSONB,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Session Management & Password Reset Architecture
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
