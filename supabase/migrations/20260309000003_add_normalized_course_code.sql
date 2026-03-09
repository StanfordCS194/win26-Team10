-- Add normalized_course_code column to grade_distributions for easier lookups
ALTER TABLE public.grade_distributions 
ADD COLUMN normalized_course_code text GENERATED ALWAYS AS (UPPER(REPLACE(course_code, ' ', ''))) STORED;

-- Add index for fast lookups
CREATE INDEX idx_grade_distributions_normalized_code ON public.grade_distributions (school_id, normalized_course_code);

-- Update the unique constraint to include the normalized code if needed, 
-- but for now, we just want it for lookups.
COMMENT ON COLUMN public.grade_distributions.normalized_course_code IS 'Course code with spaces removed and uppercased for standardized matching.';
