-- 1. Create a helper function to generate the same UUIDs as the migration
CREATE OR REPLACE FUNCTION generate_uuid_from_text(name_text TEXT) 
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name_text));
END;
$$ LANGUAGE plpgsql;

-- 2. Insert the new school name
INSERT INTO public.schools (id, name, email_suffix)
VALUES (
    generate_uuid_from_text('Leland Stanford Jr. University'), 
    'Leland Stanford Jr. University', 
    '@stanford.edu'
)
ON CONFLICT (id) DO NOTHING;

-- 3. (Optional) If you want to link existing Stanford grade distributions to this name as well
INSERT INTO public.grade_distributions (school_id, dept, course_number, course_title, count, average_gpa, p25, p50, p75)
SELECT 
    generate_uuid_from_text('Leland Stanford Jr. University'),
    dept, course_number, course_title, count, average_gpa, p25, p50, p75
FROM public.grade_distributions
WHERE school_id = generate_uuid_from_text('Stanford University')
ON CONFLICT DO NOTHING;