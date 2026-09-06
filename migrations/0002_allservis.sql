create table if not exists as_workspace (
  user_id text primary key,
  seeded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists as_categories (
  id serial primary key,
  user_id text not null,
  slug text not null,
  title text not null,
  hint text not null default '',
  price_from integer not null default 0,
  diag_fee integer not null default 0
);
create index if not exists as_categories_user_idx on as_categories (user_id);

create table if not exists as_clients (
  id serial primary key,
  user_id text not null,
  telegram_id text,
  name text not null,
  phone text not null default '',
  city text not null default 'Ташкент',
  district text not null default '',
  lat double precision,
  lng double precision,
  rating double precision not null default 5,
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists as_clients_user_idx on as_clients (user_id);

create table if not exists as_masters (
  id serial primary key,
  user_id text not null,
  first_name text not null,
  last_name text not null,
  telegram_id text,
  phone text not null default '',
  city text not null default 'Ташкент',
  district text not null default '',
  specialization text not null,
  rating double precision not null default 5,
  completed_orders integer not null default 0,
  cancelled_orders integer not null default 0,
  rejected_orders integer not null default 0,
  accepted_orders integer not null default 0,
  online_status text not null default 'offline',
  last_seen timestamptz not null default now(),
  lat double precision,
  lng double precision,
  registered_at timestamptz not null default now(),
  avg_minutes integer not null default 40,
  earnings integer not null default 0
);
create index if not exists as_masters_user_idx on as_masters (user_id);
create index if not exists as_masters_status_idx on as_masters (user_id, online_status);

create table if not exists as_orders (
  id serial primary key,
  user_id text not null,
  public_no integer not null,
  client_id integer not null,
  master_id integer,
  category_slug text not null,
  description text not null,
  phone text not null default '',
  city text not null default 'Ташкент',
  district text not null default '',
  address text not null default '',
  lat double precision,
  lng double precision,
  status text not null default 'waiting_admin',
  photos text not null default '[]',
  comment text not null default '',
  price integer not null default 0,
  master_payout integer not null default 0,
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  accepted_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists as_orders_user_idx on as_orders (user_id);
create index if not exists as_orders_status_idx on as_orders (user_id, status);
create index if not exists as_orders_master_idx on as_orders (user_id, master_id);
create index if not exists as_orders_created_idx on as_orders (user_id, created_at desc);

create table if not exists as_order_events (
  id serial primary key,
  user_id text not null,
  order_id integer not null,
  event_type text not null,
  actor text not null default 'system',
  metadata text not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists as_order_events_order_idx on as_order_events (order_id, created_at);

create table if not exists as_reviews (
  id serial primary key,
  user_id text not null,
  order_id integer not null,
  client_id integer,
  master_id integer,
  rating integer not null,
  comment text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists as_reviews_user_idx on as_reviews (user_id);

create table if not exists as_audit (
  id serial primary key,
  user_id text not null,
  action text not null,
  object_type text not null,
  object_id text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index if not exists as_audit_user_idx on as_audit (user_id, created_at desc);

create table if not exists as_notifications (
  id serial primary key,
  user_id text not null,
  kind text not null,
  title text not null,
  body text not null,
  order_id integer,
  master_id integer,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists as_notifications_user_idx on as_notifications (user_id, created_at desc);
