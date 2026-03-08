-- Add email_suffix column to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS email_suffix TEXT;

-- Drop the default UUID generation for id column
ALTER TABLE schools ALTER COLUMN id DROP DEFAULT;

-- Create a function to generate deterministic UUID from text
CREATE OR REPLACE FUNCTION generate_uuid_from_text(text_input TEXT)
RETURNS UUID AS $$
BEGIN
    -- Use MD5 hash of the input text to generate a deterministic UUID
    RETURN uuid_generate_v5(
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, -- DNS namespace UUID
        text_input
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a trigger function to set id based on name hash
CREATE OR REPLACE FUNCTION set_school_id_from_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL THEN
        NEW.id := generate_uuid_from_text(NEW.name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set id before insert
DROP TRIGGER IF EXISTS trigger_set_school_id ON schools;
CREATE TRIGGER trigger_set_school_id
    BEFORE INSERT ON schools
    FOR EACH ROW
    EXECUTE FUNCTION set_school_id_from_name();

-- Update existing schools to have hash-based IDs (if any exist)
-- This will create a temporary mapping and update references
DO $$
DECLARE
    school_record RECORD;
    new_id UUID;
BEGIN
    -- For each existing school, generate new hash-based ID
    FOR school_record IN SELECT id, name FROM schools LOOP
        new_id := generate_uuid_from_text(school_record.name);
        
        -- If the ID is already correct, skip
        IF new_id = school_record.id THEN
            CONTINUE;
        END IF;

        -- Update the school's ID first
        -- We use a temporary ID to avoid collision if new_id already exists as an old ID
        -- but here we just update the school ID. 
        -- The FK constraint is the issue. We need to update them in the correct order.
        
        -- 1. Create the new school record with the new ID but same data
        INSERT INTO schools (id, name, location, email_suffix)
        SELECT new_id, name, location, email_suffix 
        FROM schools 
        WHERE id = school_record.id
        ON CONFLICT (id) DO NOTHING;

        -- 2. Update references in other tables to point to the new ID
        UPDATE grade_distributions SET school_id = new_id WHERE school_id = school_record.id;
        UPDATE applicants SET school_id = new_id WHERE school_id = school_record.id;
        
        -- 3. Delete the old school record
        DELETE FROM schools WHERE id = school_record.id;
    END LOOP;
END $$;
