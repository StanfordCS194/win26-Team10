#!/usr/bin/env python3
"""
Generate SQL migration from jobs.json seed data
"""
import json
import uuid
from pathlib import Path
from datetime import datetime

def escape_sql_string(s):
    """Escape single quotes for SQL"""
    if s is None:
        return 'null'
    return s.replace("'", "''")

def format_array(arr):
    """Format Python list as PostgreSQL array"""
    if not arr:
        return "array[]::text[]"
    escaped = [f"'{escape_sql_string(item)}'" for item in arr]
    return f"array[{','.join(escaped)}]"

def format_value(value):
    """Format a value for SQL"""
    if value is None:
        return 'null'
    elif isinstance(value, bool):
        return 'true' if value else 'false'
    elif isinstance(value, (int, float)):
        return str(value)
    elif isinstance(value, list):
        return format_array(value)
    else:
        return f"'{escape_sql_string(str(value))}'"

def generate_migration():
    # Read the jobs JSON
    script_dir = Path(__file__).parent
    json_path = script_dir.parent / 'supabase' / 'seed_data' / 'jobs.json'
    
    with open(json_path, 'r') as f:
        jobs = json.load(f)
    
    # Generate timestamp for migration filename
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    migration_filename = f'{timestamp}_seed_additional_jobs.sql'
    migration_path = script_dir.parent / 'supabase' / 'migrations' / migration_filename
    
    # Start building SQL
    sql_lines = [
        '-- Seed 50 additional diverse job listings',
        'INSERT INTO public.jobs (',
        '    id,',
        '    recruiter_id,',
        '    title,',
        '    company,',
        '    location,',
        '    type,',
        '    salary_display,',
        '    salary_min,',
        '    description,',
        '    skills,',
        '    requirements,',
        '    benefits,',
        '    preferred_majors,',
        '    preferred_grad_years,',
        '    min_gpa,',
        '    required_work_authorization,',
        '    is_active,',
        '    created_at',
        ')',
        'VALUES'
    ]
    
    # Generate UUID starting from 0007 (since existing seeds go up to 0006)
    base_uuid = '9f7ab991-ef45-4d4f-a8a8-4c75c4df'
    
    for idx, job in enumerate(jobs, start=7):
        # Generate UUID
        job_id = f"{base_uuid}{idx:04d}"
        
        # Create days offset for created_at (spread over last 30 days)
        days_offset = (idx - 7) % 30 + 1
        
        # Build the VALUES entry
        values = [
            f"        '{job_id}',",
            "        null,",  # recruiter_id
            f"        '{escape_sql_string(job['title'])}',",
            f"        '{escape_sql_string(job['company'])}',",
            f"        '{escape_sql_string(job['location'])}',",
            f"        '{job['type']}',",
            f"        '{escape_sql_string(job['salary_display'])}',",
            f"        {job['salary_min']},",
            f"        '{escape_sql_string(job['description'])}',",
            f"        {format_array(job['skills'])},",
            f"        {format_array(job['requirements'])},",
            f"        {format_array(job['benefits'])},",
            f"        {format_array(job['preferred_majors'])},",
            f"        {format_array(job['preferred_grad_years'])},",
            f"        {job.get('min_gpa', 'null')},",
            f"        {format_value(job.get('required_work_authorization'))},",
            "        true,",
            f"        now() - interval '{days_offset} days'"
        ]
        
        # Add opening parenthesis and values
        if idx == 7:
            sql_lines.append('    (')
        else:
            sql_lines.append('    ,(')
        
        sql_lines.extend(values)
        sql_lines.append('    )')
    
    # Add conflict handling
    sql_lines.append('ON CONFLICT (id) DO NOTHING;')
    
    # Write migration file
    migration_content = '\n'.join(sql_lines)
    
    with open(migration_path, 'w') as f:
        f.write(migration_content)
    
    print(f"✓ Generated migration: {migration_filename}")
    print(f"  Location: {migration_path}")
    print(f"  Jobs count: {len(jobs)}")
    
    return migration_path

if __name__ == '__main__':
    generate_migration()
