-- Insert all translations into the database
INSERT INTO translations (key, ar, en) VALUES

ON CONFLICT (key) DO UPDATE SET ar = EXCLUDED.ar, en = EXCLUDED.en;