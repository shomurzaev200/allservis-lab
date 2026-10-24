alter table as_tg_sessions add column if not exists tg_username text;
alter table as_tg_sessions add column if not exists started_at timestamptz;
update as_tg_sessions set started_at = updated_at where started_at is null;
