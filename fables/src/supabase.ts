import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_PUBLIC_SUPABASE_URL,
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY
)

// Supabase fires the same "SIGNED_OUT" auth event whether a user clicked
// Log Out or their refresh token just failed (session timed out). Call this
// right before an intentional supabase.auth.signOut() so UserContext's
// listener (see consumeIntentionalSignOut) can tell the two apart and only
// show a "your session timed out" message for the latter.
let intentionalSignOut = false
export function markIntentionalSignOut() { intentionalSignOut = true }
export function consumeIntentionalSignOut(): boolean {
  const was = intentionalSignOut
  intentionalSignOut = false
  return was
}

