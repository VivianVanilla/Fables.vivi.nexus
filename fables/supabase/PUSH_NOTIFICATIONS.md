# Chat push notifications — setup

Everything that decides *when* and *who* to notify lives in Supabase (a
Postgres trigger + `send-chat-push` Edge Function). Firebase's only job is
being the pipe Android uses to wake the app in the background — that part
isn't optional (it's how Android background push physically works,
regardless of vendor branding), but you're not writing or hosting any
Firebase-side backend code for it.

Everything below is a one-time setup. Total cost: $0 (Firebase's Spark/free
plan covers FCM sends at any volume this app will see).

## 1. Create the Firebase project

1. https://console.firebase.google.com → **Add project** → any name (e.g. "Fables").
   Analytics can stay off, it's not used here.
2. Inside the project: **Build → Add app → Android**.
   - Package name: `nexus.fables.vivi` (must match exactly — this is
     `capacitor.config.ts`'s `appId`, which is also your Play Store package
     name — they all have to agree).
   - Nickname/SHA-1 are optional, skip them.
3. Download **`google-services.json`** from that screen and place it at:
   `fables/android/app/google-services.json`
   (gitignored on purpose — see `.gitignore` — this is project-specific
   config, never commit it).

## 2. Get a service-account key (for the Edge Function to send with)

1. Firebase Console → ⚙️ **Project settings → Service accounts**.
2. **Generate new private key** → downloads a JSON file. Keep it safe; it
   grants send access to your Firebase project.
3. Set it as a Supabase secret (from the `fables/` directory, with the
   [Supabase CLI](https://supabase.com/docs/guides/cli) installed and
   `supabase login` / `supabase link --project-ref <your-ref>` already done):

   ```bash
   supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat path/to/the-downloaded-key.json)"
   ```

## 3. Run the migration and deploy the function

```bash
supabase db push                      # creates push_tokens (see migrations/)
supabase functions deploy send-chat-push --no-verify-jwt
```

`--no-verify-jwt` is needed because the caller is Supabase's own Database
Webhook, not a signed-in user — the function itself has no other
credential-gated behavior beyond what Postgres already decided to send it.

## 4. Wire the trigger

Supabase Dashboard → **Database → Webhooks → Create a new hook** is the
"official" way to do this, but on some projects it fails with
`ERROR: 3F000: schema "supabase_functions" does not exist` — that dashboard
feature depends on internal setup that isn't provisioned on every project.
A Database Webhook *is* just a Postgres trigger that does an HTTP POST, so
the fix is to create that trigger directly — same effect, no dependency on
the broken dashboard feature, and it's honestly more transparent/debuggable
this way regardless. Requires the `pg_net` extension (enabled below).

Dashboard → **SQL Editor** → **New query** → paste (swap in your own
project's Edge Function URL if it differs — Dashboard → Edge Functions →
`send-chat-push` shows it) → **Run**:

```sql
create extension if not exists pg_net;

create or replace function public.notify_chat_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/send-chat-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('type', 'INSERT', 'table', 'messages', 'record', to_jsonb(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists on_message_insert_notify_push on public.messages;
create trigger on_message_insert_notify_push
  after insert on public.messages
  for each row
  execute function public.notify_chat_push();
```

`net.http_post` is fire-and-forget (async) — a message send never waits on
the push notification call. You can see recent requests/responses (useful
for debugging) via `select * from net._http_response order by id desc
limit 10;` in the SQL Editor.

That's it — every new row in `messages` now fires the function, which
resolves recipients, looks up their `push_tokens`, and sends via FCM.

## 5. Native app changes needed on your end

- Rebuild the Android app (`npm run build && npx cap sync android`) so
  `google-services.json` gets picked up — `android/app/build.gradle`
  already applies the Google Services Gradle plugin automatically
  whenever that file is present (the `@capacitor/push-notifications`
  plugin template wires this in on its own; nothing to edit by hand).
- First launch will prompt for notification permission (Android 13+) via
  `src/hooks/usePushNotifications.ts`, which then upserts the device's FCM
  token into `push_tokens`.

## How a send actually happens (for future reference)

```
INSERT INTO messages           (ChatPane.tsx → usePartyServer.ts)
        │
        ▼  Database Webhook (Dashboard-configured, no code)
supabase/functions/send-chat-push
        │  1. DM → [recipient_id]; channel msg → party roster minus sender
        │     (same `objects` table usePartyServer.ts's roster reads)
        │  2. look up push_tokens for those user ids
        │  3. exchange the service-account key for a short-lived Google
        │     OAuth2 token (RS256 JWT, done with Deno's Web Crypto — no
        │     extra dependency)
        │  4. POST each device's token to FCM's HTTP v1 API
        ▼
   Android device (FCM → Capacitor Push Notifications plugin → OS tray)
```

Stale/uninstalled-app tokens that FCM reports as `UNREGISTERED` get pruned
from `push_tokens` automatically on the next send that hits them.
