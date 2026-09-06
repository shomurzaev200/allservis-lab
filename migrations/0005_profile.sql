alter table as_clients add column if not exists lang text not null default 'ru';
alter table as_clients add column if not exists role text not null default 'client';
alter table as_workspace add column if not exists alerts_channel_id text;
