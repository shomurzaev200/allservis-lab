create index if not exists as_tg_sessions_updated_idx on as_tg_sessions (updated_at);
create index if not exists as_clients_created_idx on as_clients (created_at);
create index if not exists as_alert_threads_created_idx on as_alert_threads (created_at);
