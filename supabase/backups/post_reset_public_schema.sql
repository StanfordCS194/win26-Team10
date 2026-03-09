


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."claim_parse_job"("p_worker_id" "text", "p_lock_seconds" integer DEFAULT 900) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
declare
    v_job public.parse_jobs%rowtype;
begin
    select * into v_job
    from public.parse_jobs
    where (
        status = 'queued'
        or (
            status = 'running'
            and locked_at is not null
            and locked_at < now() - make_interval(secs => p_lock_seconds)
        )
    )
    and (
        locked_at is null
        or locked_at < now() - make_interval(secs => p_lock_seconds)
    )
    order by
        case when status = 'running' then 0 else 1 end,
        created_at asc
    limit 1
    for update skip locked;

    if not found then
        return null;
    end if;

    update public.parse_jobs
    set status = 'running',
        started_at = coalesce(started_at, now()),
        locked_at = now(),
        locked_by = p_worker_id,
        attempts = coalesce(attempts, 0) + 1
    where id = v_job.id;

    return (
        select to_json(pj.*)
        from public.parse_jobs pj
        where pj.id = v_job.id
    );
end;
$$;


ALTER FUNCTION "public"."claim_parse_job"("p_worker_id" "text", "p_lock_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_uuid_from_text"("text_input" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    RETURN extensions.uuid_generate_v5(
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
        text_input
    );
END;
$$;


ALTER FUNCTION "public"."generate_uuid_from_text"("text_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_school_id_by_name"("school_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    found_id UUID;
BEGIN
    SELECT id INTO found_id
    FROM schools
    WHERE name = school_name
    LIMIT 1;
    
    RETURN found_id;
END;
$$;


ALTER FUNCTION "public"."get_school_id_by_name"("school_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_applicant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    if new.type = 'student' then
        insert into public.applicants (id, email)
        values (new.id, new.email)
        on conflict (id) do nothing;
    end if;
    return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_applicant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    insert into public.users (id, email)
    values (new.id, new.email);
    return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_recruiter_company_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    v_domain text;
    v_company_id uuid;
    v_local_name text;
begin
    if new.type <> 'recruiter' or new.email is null then
        return new;
    end if;

    v_domain := lower(split_part(new.email, '@', 2));
    if v_domain is null or v_domain = '' then
        return new;
    end if;

    if v_domain = any (array['gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','proton.me']) then
        return new;
    end if;

    select c.id into v_company_id
    from public.companies c
    where exists (
        select 1
        from unnest(c.domains) d
        where lower(d) = v_domain
    )
    limit 1;

    if v_company_id is null then
        v_local_name := initcap(replace(split_part(v_domain, '.', 1), '-', ' '));
        insert into public.companies (name, slug, domains, is_verified)
        values (v_local_name, split_part(v_domain, '.', 1), array[v_domain], true)
        on conflict (name) do update
            set domains = (
                select array_agg(distinct d)
                from unnest(public.companies.domains || excluded.domains) d
            )
        returning id into v_company_id;
    end if;

    insert into public.company_memberships (user_id, company_id, role, status)
    values (new.id, v_company_id, 'recruiter_member', 'approved')
    on conflict (user_id, company_id) do nothing;

    return new;
end;
$$;


ALTER FUNCTION "public"."handle_recruiter_company_membership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_school_name"("input_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."normalize_school_name"("input_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_school_id_from_name"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.id IS NULL THEN
        NEW.id := generate_uuid_from_text(NEW.name);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_school_id_from_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."applicants" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "major" "text",
    "graduation_year" "text",
    "gpa" numeric(3,2),
    "skills" "text"[] DEFAULT '{}'::"text"[],
    "latest_repr_path" "text",
    "is_complete" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "latest_report_path" "text",
    "school_id" "uuid",
    "school" "text",
    "work_authorization" "text",
    "resume_path" "text"
);


ALTER TABLE "public"."applicants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applicants_detail" (
    "id" "uuid" NOT NULL,
    "transcript_raw" "jsonb",
    "transcript_stats" "jsonb",
    "transcript_analysis" "jsonb",
    "resume_raw" "jsonb",
    "resume_analysis" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."applicants_detail" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "description" "text",
    "website" "text",
    "domains" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'recruiter_member'::"text" NOT NULL,
    "status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_memberships_role_check" CHECK (("role" = ANY (ARRAY['recruiter_admin'::"text", 'recruiter_member'::"text"]))),
    CONSTRAINT "company_memberships_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."company_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "message" "text" NOT NULL,
    "rating" integer,
    "page_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grade_distributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid",
    "course_code" "text" NOT NULL,
    "distribution" "jsonb" NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."grade_distributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eeo_response" "text",
    "work_authorization" "text",
    "disability_status" "text",
    "veteran_status" "text",
    "location_preference" "text",
    "message_to_recruiter" "text"
);


ALTER TABLE "public"."job_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid",
    "title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "location" "text" NOT NULL,
    "type" "text" NOT NULL,
    "salary_display" "text",
    "salary_min" integer,
    "description" "text" NOT NULL,
    "skills" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "requirements" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "benefits" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "preferred_majors" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "preferred_grad_years" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "min_gpa" numeric(3,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    "required_work_authorization" "text",
    CONSTRAINT "jobs_type_check" CHECK (("type" = ANY (ARRAY['Internship'::"text", 'Full-time'::"text", 'Part-time'::"text", 'Contract'::"text"])))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parse_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parsed_file_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "error" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "locked_at" timestamp with time zone,
    "locked_by" "text",
    "storage_path" "text",
    "job_type" "text" DEFAULT 'transcript'::"text" NOT NULL,
    CONSTRAINT "parse_jobs_job_type_check" CHECK (("job_type" = ANY (ARRAY['transcript'::"text", 'resume'::"text"]))),
    CONSTRAINT "parse_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'succeeded'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."parse_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."school_aliases" (
    "alias" "text" NOT NULL,
    "school_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."school_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schools" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email_suffix" "text"
);


ALTER TABLE "public"."schools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "type" "text" DEFAULT 'student'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "users_type_check" CHECK (("type" = ANY (ARRAY['student'::"text", 'recruiter'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."applicants_detail"
    ADD CONSTRAINT "applicants_detail_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applicants"
    ADD CONSTRAINT "applicants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_user_id_company_id_key" UNIQUE ("user_id", "company_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_recruiter_id_student_id_key" UNIQUE ("recruiter_id", "student_id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grade_distributions"
    ADD CONSTRAINT "grade_distributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grade_distributions"
    ADD CONSTRAINT "grade_distributions_school_id_course_code_key" UNIQUE ("school_id", "course_code");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_job_id_student_id_key" UNIQUE ("job_id", "student_id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parse_jobs"
    ADD CONSTRAINT "parse_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."school_aliases"
    ADD CONSTRAINT "school_aliases_pkey" PRIMARY KEY ("alias");



ALTER TABLE ONLY "public"."schools"
    ADD CONSTRAINT "schools_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."schools"
    ADD CONSTRAINT "schools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "applicants_is_complete_idx" ON "public"."applicants" USING "btree" ("is_complete");



CREATE INDEX "applicants_major_idx" ON "public"."applicants" USING "btree" ("major");



CREATE INDEX "companies_slug_idx" ON "public"."companies" USING "btree" ("slug");



CREATE INDEX "company_memberships_company_status_idx" ON "public"."company_memberships" USING "btree" ("company_id", "status");



CREATE INDEX "company_memberships_user_status_idx" ON "public"."company_memberships" USING "btree" ("user_id", "status");



CREATE INDEX "conversations_recruiter_id_idx" ON "public"."conversations" USING "btree" ("recruiter_id");



CREATE INDEX "conversations_student_id_idx" ON "public"."conversations" USING "btree" ("student_id");



CREATE INDEX "idx_applicants_school_id" ON "public"."applicants" USING "btree" ("school_id");



CREATE INDEX "idx_grade_distributions_school_course" ON "public"."grade_distributions" USING "btree" ("school_id", "course_code");



CREATE INDEX "job_applications_job_id_idx" ON "public"."job_applications" USING "btree" ("job_id");



CREATE INDEX "job_applications_student_id_idx" ON "public"."job_applications" USING "btree" ("student_id");



CREATE INDEX "jobs_company_id_idx" ON "public"."jobs" USING "btree" ("company_id");



CREATE INDEX "jobs_company_idx" ON "public"."jobs" USING "btree" ("company");



CREATE INDEX "jobs_created_at_idx" ON "public"."jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "jobs_is_active_idx" ON "public"."jobs" USING "btree" ("is_active");



CREATE INDEX "jobs_type_idx" ON "public"."jobs" USING "btree" ("type");



CREATE INDEX "messages_conversation_id_idx" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "messages_created_at_idx" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "parse_jobs_status_created_at_idx" ON "public"."parse_jobs" USING "btree" ("status", "created_at");



CREATE INDEX "parse_jobs_user_id_idx" ON "public"."parse_jobs" USING "btree" ("user_id");



CREATE INDEX "users_type_idx" ON "public"."users" USING "btree" ("type");



CREATE OR REPLACE TRIGGER "applicants_updated_at" BEFORE UPDATE ON "public"."applicants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "company_memberships_updated_at" BEFORE UPDATE ON "public"."company_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "jobs_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "on_applicants_detail_updated" BEFORE UPDATE ON "public"."applicants_detail" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_recruiter_user_upsert_membership" AFTER INSERT OR UPDATE OF "type", "email" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_recruiter_company_membership"();



CREATE OR REPLACE TRIGGER "on_user_created_applicant" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_applicant"();



CREATE OR REPLACE TRIGGER "trigger_set_school_id" BEFORE INSERT ON "public"."schools" FOR EACH ROW EXECUTE FUNCTION "public"."set_school_id_from_name"();



CREATE OR REPLACE TRIGGER "users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."applicants_detail"
    ADD CONSTRAINT "applicants_detail_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."applicants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applicants"
    ADD CONSTRAINT "applicants_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applicants"
    ADD CONSTRAINT "applicants_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."grade_distributions"
    ADD CONSTRAINT "grade_distributions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."school_aliases"
    ADD CONSTRAINT "school_aliases_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow public read access to school aliases" ON "public"."school_aliases" FOR SELECT USING (true);



CREATE POLICY "Anyone can insert feedback" ON "public"."feedback" FOR INSERT WITH CHECK (true);



CREATE POLICY "Applicants can read own profile" ON "public"."applicants" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Applicants can update own profile" ON "public"."applicants" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Authenticated users can read companies" ON "public"."companies" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can read jobs" ON "public"."jobs" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Grade distributions are viewable by service role only" ON "public"."grade_distributions" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Participants can read conversation" ON "public"."conversations" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (("auth"."uid"() = "recruiter_id") OR ("auth"."uid"() = "student_id"))));



CREATE POLICY "Participants can read messages" ON "public"."messages" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."recruiter_id" = "auth"."uid"()) OR ("c"."student_id" = "auth"."uid"())))))));



CREATE POLICY "Participants can send message" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."recruiter_id" = "auth"."uid"()) OR ("c"."student_id" = "auth"."uid"())))))));



CREATE POLICY "Participants can update conversation" ON "public"."conversations" FOR UPDATE USING ((("auth"."uid"() = "recruiter_id") OR ("auth"."uid"() = "student_id")));



CREATE POLICY "Recruiters can create conversation" ON "public"."conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "recruiter_id"));



CREATE POLICY "Recruiters can delete their own jobs in approved company" ON "public"."jobs" FOR DELETE USING ((("recruiter_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND ("cm"."company_id" = "jobs"."company_id") AND ("cm"."status" = 'approved'::"text"))))));



CREATE POLICY "Recruiters can insert jobs for approved company" ON "public"."jobs" FOR INSERT WITH CHECK ((("recruiter_id" = "auth"."uid"()) AND ("company_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND ("cm"."company_id" = "jobs"."company_id") AND ("cm"."status" = 'approved'::"text"))))));



CREATE POLICY "Recruiters can read all details" ON "public"."applicants_detail" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."type" = 'recruiter'::"text")))));



CREATE POLICY "Recruiters can read applicants for screening" ON "public"."applicants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."type" = 'recruiter'::"text")))));



CREATE POLICY "Recruiters can read applications for their company jobs" ON "public"."job_applications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."jobs" "j"
     JOIN "public"."company_memberships" "cm" ON (("cm"."company_id" = "j"."company_id")))
  WHERE (("j"."id" = "job_applications"."job_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."status" = 'approved'::"text")))));



CREATE POLICY "Recruiters can update their own jobs in approved company" ON "public"."jobs" FOR UPDATE USING ((("recruiter_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND ("cm"."company_id" = "jobs"."company_id") AND ("cm"."status" = 'approved'::"text")))))) WITH CHECK ((("recruiter_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."company_memberships" "cm"
  WHERE (("cm"."user_id" = "auth"."uid"()) AND ("cm"."company_id" = "jobs"."company_id") AND ("cm"."status" = 'approved'::"text"))))));



CREATE POLICY "Schools are viewable by service role only" ON "public"."schools" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role can manage all details" ON "public"."applicants_detail" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to companies" ON "public"."companies" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to job_applications" ON "public"."job_applications" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to jobs" ON "public"."jobs" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to memberships" ON "public"."company_memberships" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to parse_jobs" ON "public"."parse_jobs" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to users" ON "public"."users" USING (true) WITH CHECK (true);



CREATE POLICY "Students can create their own applications" ON "public"."job_applications" FOR INSERT WITH CHECK ((("student_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."type" = 'student'::"text"))))));



CREATE POLICY "Students can read their own applications" ON "public"."job_applications" FOR SELECT USING (("student_id" = "auth"."uid"()));



CREATE POLICY "Users can read own data" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own detail" ON "public"."applicants_detail" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read their memberships" ON "public"."company_memberships" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own data" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own feedback" ON "public"."feedback" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."applicants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."applicants_detail" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."grade_distributions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parse_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."school_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schools" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_parse_job"("p_worker_id" "text", "p_lock_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_parse_job"("p_worker_id" "text", "p_lock_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_parse_job"("p_worker_id" "text", "p_lock_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_uuid_from_text"("text_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_uuid_from_text"("text_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_uuid_from_text"("text_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_school_id_by_name"("school_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_school_id_by_name"("school_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_school_id_by_name"("school_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_applicant"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_applicant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_applicant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_recruiter_company_membership"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_recruiter_company_membership"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_recruiter_company_membership"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_school_name"("input_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_school_name"("input_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_school_name"("input_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_school_id_from_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_school_id_from_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_school_id_from_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."applicants" TO "anon";
GRANT ALL ON TABLE "public"."applicants" TO "authenticated";
GRANT ALL ON TABLE "public"."applicants" TO "service_role";



GRANT ALL ON TABLE "public"."applicants_detail" TO "anon";
GRANT ALL ON TABLE "public"."applicants_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."applicants_detail" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_memberships" TO "anon";
GRANT ALL ON TABLE "public"."company_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."company_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."grade_distributions" TO "anon";
GRANT ALL ON TABLE "public"."grade_distributions" TO "authenticated";
GRANT ALL ON TABLE "public"."grade_distributions" TO "service_role";



GRANT ALL ON TABLE "public"."job_applications" TO "anon";
GRANT ALL ON TABLE "public"."job_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."job_applications" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."parse_jobs" TO "anon";
GRANT ALL ON TABLE "public"."parse_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."parse_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."school_aliases" TO "anon";
GRANT ALL ON TABLE "public"."school_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."school_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."schools" TO "anon";
GRANT ALL ON TABLE "public"."schools" TO "authenticated";
GRANT ALL ON TABLE "public"."schools" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







