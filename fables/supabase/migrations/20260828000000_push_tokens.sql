-- push_tokens — one row per device registered for chat push notifications
-- (see src/hooks/usePushNotifications.ts, which upserts into this on every
-- native app launch, and supabase/functions/send-chat-push, which reads
-- from it with the service role to actually send). A user can have more
-- than one row (phone + tablet), hence the composite unique key rather than
-- user_id being the primary key.

create table if not exists push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null,
  platform   text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_id_idx on push_tokens(user_id);

alter table push_tokens enable row level security;

-- A signed-in user may only ever read/write their own device tokens. The
-- Edge Function reads this table with the service-role key, which bypasses
-- RLS entirely, so this policy only ever governs direct client access.
create policy "push_tokens_own_rows" on push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The (user_id, token) unique constraint above is also what lets the client
-- upsert(onConflict: "user_id,token") from usePushNotifications.ts without
-- a separate select-then-insert-or-update round trip.
