-- Add school_id column to applicants table with foreign key to schools
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;

-- Add school column if it doesn't exist (for backward compatibility)
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS school TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_applicants_school_id ON applicants(school_id);

-- Create a function to lookup school_id by name
CREATE OR REPLACE FUNCTION get_school_id_by_name(school_name TEXT)
RETURNS UUID AS $$
DECLARE
    found_id UUID;
BEGIN
    SELECT id INTO found_id
    FROM schools
    WHERE name = school_name
    LIMIT 1;
    
    RETURN found_id;
END;
$$ LANGUAGE plpgsql STABLE;
