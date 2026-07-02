create table if not exists feedback_items (
  id            uuid        primary key default gen_random_uuid(),
  title         text        not null,
  content       text        not null,
  category      text        not null default '要望'
                  check (category in ('改善', 'バグ', '要望', '質問')),
  priority      text        not null default 'Normal'
                  check (priority in ('Low', 'Normal', 'High')),
  status        text        not null default 'Open'
                  check (status in ('Open', 'Doing', 'Done')),
  target_page   text,
  created_by    text        not null,
  assignee      uuid        references auth.users(id) on delete set null,
  display_order integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create table if not exists feedback_votes (
  id          uuid        primary key default gen_random_uuid(),
  feedback_id uuid        not null references feedback_items(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(feedback_id, user_id)
);

alter table feedback_items enable row level security;
alter table feedback_votes  enable row level security;

create policy "auth_full" on feedback_items for all using (auth.role() = 'authenticated');
create policy "auth_full" on feedback_votes  for all using (auth.role() = 'authenticated');

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger feedback_items_updated_at
  before update on feedback_items
  for each row execute function set_updated_at();
