-- Field Shift: Initial Seed Data (001_seed_data.sql)

INSERT INTO roles (code, name, description) VALUES
  ('prospective_farmer', 'Prospective Farmer', 'Aspiring farmer discovering land suitability, opportunities, and beginner guidance.'),
  ('existing_farmer', 'Existing Farmer', 'Farm owner or operator managing farms, spatial boundaries, fields, crops, and livestock.'),
  ('agricultural_expert', 'Agricultural Expert', 'Agronomist or extension officer reviewing farms and advising farmers.'),
  ('organisation_manager', 'Organisation Manager', 'Cooperative or agribusiness manager overseeing regional farm portfolios.'),
  ('system_administrator', 'System Administrator', 'Platform administrator managing users, roles, account activation, and audit logs.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO languages (code, name, native_name, has_audio_support, has_sign_language_support, is_active) VALUES
  ('en', 'English', 'English', TRUE, FALSE, TRUE),
  ('af', 'Afrikaans', 'Afrikaans', TRUE, FALSE, TRUE),
  ('zu', 'isiZulu', 'isiZulu', TRUE, FALSE, TRUE),
  ('xh', 'isiXhosa', 'isiXhosa', TRUE, FALSE, TRUE),
  ('nso', 'Sepedi', 'Sepedi (Sesotho sa Leboa)', TRUE, FALSE, TRUE),
  ('st', 'Sesotho', 'Sesotho', TRUE, FALSE, TRUE),
  ('tn', 'Setswana', 'Setswana', TRUE, FALSE, TRUE),
  ('ss', 'siSwati', 'siSwati', TRUE, FALSE, TRUE),
  ('ve', 'Tshivenda', 'Tshivenḓa', TRUE, FALSE, TRUE),
  ('ts', 'Xitsonga', 'Xitsonga', TRUE, FALSE, TRUE),
  ('nr', 'isiNdebele', 'isiNdebele', TRUE, FALSE, TRUE),
  ('sasl', 'South African Sign Language', 'SASL (Visual & Sign Guide)', FALSE, TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO farming_types (code, name, category, description) VALUES
  ('grain_maize', 'Maize & Dryland Grain', 'Crops', 'White and yellow maize, sorghum, sunflower, and soybean dryland or irrigated production.'),
  ('horticulture_veg', 'Vegetables & Horticulture', 'Crops', 'Spinach, cabbage, tomatoes, onions, potatoes, and high-value tunnel vegetables.'),
  ('citrus_orchards', 'Citrus & Subtropical Fruit', 'Orchards', 'Oranges, lemons, avocados, macadamia, and mangoes for local and export markets.'),
  ('beef_cattle', 'Beef & Nguni Cattle', 'Livestock', 'Rotational veld grazing, Nguni, Bonsmara, and Brahman cattle farming.'),
  ('small_stock', 'Goats & Sheep', 'Livestock', 'Boer goats, Dorper sheep, and resilient small-stock pastoralism.'),
  ('poultry_eggs', 'Poultry & Layers', 'Livestock', 'Broiler and free-range layer production with biosecurity management.'),
  ('mixed_farming', 'Mixed Crop & Livestock', 'Mixed', 'Integrated crop-livestock systems maximizing soil fertility and income resilience.')
ON CONFLICT (code) DO NOTHING;
