-- Vantum CDEV — Option B · Minimal LinkedIn extension
-- Based on vantum_schema_update_optionB.html

create table if not exists linkedin_scrapes (
  id bigserial primary key,
  person_id int references people(id) on delete set null,
  linkedin_urn text not null,
  linkedin_slug text,
  apify_run_id text,
  scraped_at timestamptz not null default now(),
  raw_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lscrapes_urn on linkedin_scrapes(linkedin_urn);
create index if not exists idx_lscrapes_person on linkedin_scrapes(person_id);
create index if not exists idx_lscrapes_at on linkedin_scrapes(scraped_at desc);

alter table people
  add column if not exists linkedin_urn text,
  add column if not exists linkedin_slug text,
  add column if not exists linkedin_object_urn text,
  add column if not exists about_text text,
  add column if not exists linkedin_registered_at timestamptz,
  add column if not exists follower_count int,
  add column if not exists is_premium boolean,
  add column if not exists is_verified boolean,
  add column if not exists is_creator boolean,
  add column if not exists is_influencer boolean,
  add column if not exists is_hiring boolean,
  add column if not exists is_open_to_work boolean,
  add column if not exists open_profile boolean,
  add column if not exists compose_option_type text,
  add column if not exists country_code text,
  add column if not exists country text,
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists us_based boolean,
  add column if not exists estimated_age int,
  add column if not exists estimated_age_method text,
  add column if not exists estimated_age_confidence text,
  add column if not exists career_years int,
  add column if not exists linkedin_tenure_years int,
  add column if not exists years_since_fractional int,
  add column if not exists fractional_start_year int,
  add column if not exists active_roles_count int,
  add column if not exists active_roles jsonb,
  add column if not exists prev_role_before_fractional text,
  add column if not exists prev_company_before_fractional text,
  add column if not exists has_fractional_in_title boolean,
  add column if not exists is_fractional_coo boolean,
  add column if not exists appears_to_have_team boolean,
  add column if not exists current_employment_type text,
  add column if not exists experience jsonb,
  add column if not exists education jsonb,
  add column if not exists skills jsonb,
  add column if not exists skills_count int,
  add column if not exists certifications jsonb,
  add column if not exists certifications_count int,
  add column if not exists services jsonb,
  add column if not exists recommendations jsonb,
  add column if not exists recommendations_count int,
  add column if not exists volunteering jsonb,
  add column if not exists causes jsonb,
  add column if not exists publications jsonb,
  add column if not exists honors_awards jsonb,
  add column if not exists languages jsonb,
  add column if not exists latest_raw_json jsonb,
  add column if not exists first_scraped_at timestamptz,
  add column if not exists last_scraped_at timestamptz,
  add column if not exists scrape_count int default 0;

create unique index if not exists idx_people_linkedin_urn
  on people(linkedin_urn)
  where linkedin_urn is not null;

create index if not exists idx_people_active_roles on people(active_roles_count);
create index if not exists idx_people_yrs_fractional on people(years_since_fractional);
create index if not exists idx_people_has_fractional on people(has_fractional_in_title);
