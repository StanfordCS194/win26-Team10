-- Add alias for University of Texas at Austin
INSERT INTO public.school_aliases (alias, school_id)
SELECT 'THE UNIVERSITY OF TEXAS AT AUSTIN', id
FROM public.schools
WHERE name = 'University of Texas at Austin'
ON CONFLICT DO NOTHING;
