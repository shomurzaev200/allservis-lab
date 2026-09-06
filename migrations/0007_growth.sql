alter table as_clients add column if not exists ref_code text;
alter table as_clients add column if not exists referred_by text;
alter table as_clients add column if not exists ref_source text;
create unique index if not exists as_clients_ref_code_idx on as_clients (user_id, ref_code);

create table if not exists as_ref_links (
  id serial primary key,
  user_id text not null,
  code text not null,
  label text not null,
  source text not null default 'ads',
  clicks integer not null default 0,
  joins integer not null default 0,
  orders integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists as_ref_links_code_idx on as_ref_links (user_id, code);
create index if not exists as_ref_links_user_idx on as_ref_links (user_id);

alter table as_staff add column if not exists can_invite boolean not null default false;
alter table as_staff add column if not exists can_delete boolean not null default true;
alter table as_staff add column if not exists can_assign boolean not null default true;
alter table as_staff add column if not exists can_finance boolean not null default false;
alter table as_staff add column if not exists can_bots boolean not null default false;

alter table as_workspace add column if not exists last_alert_error text;
