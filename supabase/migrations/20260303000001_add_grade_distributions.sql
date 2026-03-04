-- Create schools table
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create grade_distributions table
CREATE TABLE IF NOT EXISTS grade_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    course_code TEXT NOT NULL,
    distribution JSONB NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT now(),
    UNIQUE(school_id, course_code)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_grade_distributions_school_course ON grade_distributions(school_id, course_code);

-- Enable Row Level Security
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_distributions ENABLE ROW LEVEL SECURITY;

-- Create policies for schools
CREATE POLICY "Schools are viewable by service role only" 
ON schools FOR SELECT 
TO service_role
USING (true);

-- Create policies for grade_distributions
CREATE POLICY "Grade distributions are viewable by service role only" 
ON grade_distributions FOR SELECT 
TO service_role
USING (true);

-- Note: Insert/Update/Delete should be restricted to service role by default (no policies)
