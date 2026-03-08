-- Migration to add school_aliases table and trigger for normalization
-- This allows mapping multiple school name variations to a single canonical school record.

-- 0. Ensure generate_uuid_from_text uses schema-qualified uuid_generate_v5 (Supabase extensions schema)
CREATE OR REPLACE FUNCTION generate_uuid_from_text(text_input TEXT)
RETURNS UUID AS $$
BEGIN
    RETURN extensions.uuid_generate_v5(
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
        text_input
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Create the school_aliases table
CREATE TABLE IF NOT EXISTS public.school_aliases (
    alias TEXT PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS (Read-only for most, service role for all)
ALTER TABLE public.school_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to school aliases"
    ON public.school_aliases FOR SELECT
    USING (true);

-- 3. Seed schools from the provided list
-- This ensures all schools in our seed list are present in the database
INSERT INTO public.schools (name, email_suffix)
VALUES 
    ('Stanford University', '@stanford.edu'),
    ('Harvard University', '@harvard.edu'),
    ('Massachusetts Institute of Technology', '@mit.edu'),
    ('California Institute of Technology', '@caltech.edu'),
    ('Princeton University', '@princeton.edu'),
    ('Yale University', '@yale.edu'),
    ('Columbia University', '@columbia.edu'),
    ('University of Chicago', '@uchicago.edu'),
    ('University of Pennsylvania', '@upenn.edu'),
    ('Cornell University', '@cornell.edu'),
    ('Duke University', '@duke.edu'),
    ('Johns Hopkins University', '@jhu.edu'),
    ('Northwestern University', '@northwestern.edu'),
    ('Brown University', '@brown.edu'),
    ('Dartmouth College', '@dartmouth.edu'),
    ('Vanderbilt University', '@vanderbilt.edu'),
    ('Rice University', '@rice.edu'),
    ('Washington University in St. Louis', '@wustl.edu'),
    ('University of Notre Dame', '@nd.edu'),
    ('Georgetown University', '@georgetown.edu'),
    ('Carnegie Mellon University', '@cmu.edu'),
    ('University of California, Berkeley', '@berkeley.edu'),
    ('University of California, Los Angeles', '@ucla.edu'),
    ('University of Michigan', '@umich.edu'),
    ('University of Virginia', '@virginia.edu'),
    ('University of North Carolina at Chapel Hill', '@unc.edu'),
    ('University of Florida', '@ufl.edu'),
    ('University of Texas at Austin', '@utexas.edu'),
    ('University of Washington', '@uw.edu'),
    ('Georgia Institute of Technology', '@gatech.edu'),
    ('University of Southern California', '@usc.edu'),
    ('New York University', '@nyu.edu'),
    ('Boston University', '@bu.edu'),
    ('Boston College', '@bc.edu'),
    ('Tufts University', '@tufts.edu'),
    ('Emory University', '@emory.edu'),
    ('Wake Forest University', '@wfu.edu'),
    ('Case Western Reserve University', '@case.edu'),
    ('University of Wisconsin–Madison', '@wisc.edu'),
    ('University of Illinois Urbana-Champaign', '@illinois.edu'),
    ('Purdue University', '@purdue.edu'),
    ('University of Maryland', '@umd.edu'),
    ('Ohio State University', '@osu.edu'),
    ('Pennsylvania State University', '@psu.edu'),
    ('University of Minnesota', '@umn.edu'),
    ('University of Pittsburgh', '@pitt.edu'),
    ('University of California, San Diego', '@ucsd.edu'),
    ('University of California, Santa Barbara', '@ucsb.edu'),
    ('University of California, Davis', '@ucdavis.edu'),
    ('University of California, Irvine', '@uci.edu'),
    ('University of Rochester', '@rochester.edu'),
    ('Brandeis University', '@brandeis.edu'),
    ('Northeastern University', '@northeastern.edu'),
    ('Tulane University', '@tulane.edu'),
    ('Lehigh University', '@lehigh.edu'),
    ('Villanova University', '@villanova.edu'),
    ('University of Miami', '@miami.edu'),
    ('George Washington University', '@gwu.edu'),
    ('University of Georgia', '@uga.edu'),
    ('Pepperdine University', '@pepperdine.edu'),
    ('Fordham University', '@fordham.edu'),
    ('Southern Methodist University', '@smu.edu'),
    ('University of Connecticut', '@uconn.edu'),
    ('Rensselaer Polytechnic Institute', '@rpi.edu'),
    ('Worcester Polytechnic Institute', '@wpi.edu'),
    ('Colorado School of Mines', '@mines.edu'),
    ('Stevens Institute of Technology', '@stevens.edu'),
    ('Illinois Institute of Technology', '@iit.edu'),
    ('Clark University', '@clarku.edu'),
    ('Loyola Marymount University', '@lmu.edu'),
    ('Santa Clara University', '@scu.edu'),
    ('American University', '@american.edu'),
    ('Howard University', '@howard.edu'),
    ('University of Delaware', '@udel.edu'),
    ('University of Denver', '@du.edu'),
    ('Indiana University Bloomington', '@indiana.edu'),
    ('Michigan State University', '@msu.edu'),
    ('Texas A&M University', '@tamu.edu'),
    ('Virginia Tech', '@vt.edu'),
    ('University of Arizona', '@arizona.edu'),
    ('Arizona State University', '@asu.edu'),
    ('University of Colorado Boulder', '@colorado.edu'),
    ('University of Utah', '@utah.edu'),
    ('University of Iowa', '@uiowa.edu'),
    ('Iowa State University', '@iastate.edu'),
    ('University of Kansas', '@ku.edu'),
    ('Kansas State University', '@ksu.edu'),
    ('University of Missouri', '@missouri.edu'),
    ('University of Nebraska–Lincoln', '@unl.edu'),
    ('University of Tennessee', '@utk.edu'),
    ('University of Alabama', '@ua.edu'),
    ('Auburn University', '@auburn.edu'),
    ('University of South Carolina', '@sc.edu'),
    ('Clemson University', '@clemson.edu'),
    ('Florida State University', '@fsu.edu'),
    ('University of Central Florida', '@ucf.edu'),
    ('University of South Florida', '@usf.edu'),
    ('San Diego State University', '@sdsu.edu'),
    ('California State University, Long Beach', '@csulb.edu')
ON CONFLICT (id) DO NOTHING;

-- 4. Add initial aliases for Stanford
DO $$
DECLARE
    stanford_id UUID;
BEGIN
    -- We want 'Stanford' to be the canonical name for all variations
    -- First, ensure 'Stanford' exists
    INSERT INTO public.schools (name, email_suffix)
    VALUES ('Stanford', '@stanford.edu')
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO stanford_id FROM public.schools WHERE name = 'Stanford' LIMIT 1;
    
    IF stanford_id IS NOT NULL THEN
        INSERT INTO public.school_aliases (alias, school_id)
        VALUES 
            ('Leland Stanford Jr. University', stanford_id),
            ('Stanford University', stanford_id),
            ('Leland Stanford Junior University', stanford_id),
            ('Leland Stanford Jr University', stanford_id)
        ON CONFLICT (alias) DO NOTHING;
    END IF;
END $$;

-- 5. Create a function to normalize school names
CREATE OR REPLACE FUNCTION public.normalize_school_name(input_name TEXT)
RETURNS UUID AS $$
DECLARE
    found_id UUID;
BEGIN
    -- 1. Try exact match on schools table
    SELECT id INTO found_id FROM public.schools WHERE name = input_name LIMIT 1;
    IF found_id IS NOT NULL THEN RETURN found_id; END IF;

    -- 2. Try match on aliases table
    SELECT school_id INTO found_id FROM public.school_aliases WHERE alias = input_name LIMIT 1;
    IF found_id IS NOT NULL THEN RETURN found_id; END IF;

    -- 3. Try case-insensitive match on schools
    SELECT id INTO found_id FROM public.schools WHERE LOWER(name) = LOWER(input_name) LIMIT 1;
    IF found_id IS NOT NULL THEN RETURN found_id; END IF;

    -- 4. Try case-insensitive match on aliases
    SELECT school_id INTO found_id FROM public.school_aliases WHERE LOWER(alias) = LOWER(input_name) LIMIT 1;
    IF found_id IS NOT NULL THEN RETURN found_id; END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
