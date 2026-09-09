alter table as_ref_links add column if not exists campaign text not null default '';
alter table as_ref_links add column if not exists ad_group text not null default '';
alter table as_ref_links add column if not exists creative text not null default '';
alter table as_ref_links add column if not exists utm_source text not null default '';
alter table as_ref_links add column if not exists utm_medium text not null default '';
alter table as_ref_links add column if not exists utm_campaign text not null default '';
alter table as_ref_links add column if not exists utm_content text not null default '';
alter table as_ref_links add column if not exists utm_term text not null default '';
alter table as_ref_links add column if not exists spend numeric not null default 0;
alter table as_ref_links add column if not exists active boolean not null default true;
alter table as_ref_links add column if not exists notes text not null default '';

create table if not exists as_ref_events (
  id serial primary key,
  user_id text not null,
  code text not null default '',
  kind text not null,
  telegram_id text,
  created_at timestamptz not null default now()
);
create index if not exists as_ref_events_user_idx on as_ref_events (user_id, created_at desc);
create index if not exists as_ref_events_code_idx on as_ref_events (user_id, code, kind);

alter table as_workspace add column if not exists subscribe_prompt text;
alter table as_workspace add column if not exists alert_on_join boolean not null default false;
alter table as_workspace add column if not exists alert_on_error boolean not null default true;
