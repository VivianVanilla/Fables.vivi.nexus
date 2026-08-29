// Public, no-login page at /privacy — exists mainly to give Play Console's
// "App content > Privacy policy" field a URL to point at, but also linked
// from the landing page for web visitors.

const EFFECTIVE_DATE = "August 28, 2026";
const CONTACT_EMAIL = "vivian.bonilla@outlook.com";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-16 sm:px-8">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; fables.vivi.nexus
        </a>

        <h1 className="mt-6 text-2xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <p>
            Fables is a Dungeons &amp; Dragons character-management tool, available at{" "}
            <span className="text-foreground">fables.vivi.nexus</span> and as an Android app. This
            page explains what data it collects and how it's used.
          </p>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Information we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="text-foreground">Account information.</span> Signing in uses Discord
                OAuth — we receive your Discord username, avatar, and email address to create and
                identify your account.
              </li>
              <li>
                <span className="text-foreground">Content you create.</span> Character sheets, spell
                lists, and other homebrew content you create or import are stored so you can access
                them across sessions and devices.
              </li>
              <li>
                <span className="text-foreground">Push notification tokens.</span> If you enable
                notifications in the Android app, a device token is registered with Firebase Cloud
                Messaging so we can deliver notifications to that device. It's used for nothing else.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">How we use it</h2>
            <p>
              Solely to operate the app: authenticate you, store and sync your content, and — only if
              you've enabled it — deliver push notifications. We do not sell your data or share it
              with advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Third-party services</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><span className="text-foreground">Discord</span> — sign-in (OAuth)</li>
              <li><span className="text-foreground">Supabase</span> — database, authentication, and file storage</li>
              <li><span className="text-foreground">Firebase Cloud Messaging (Google)</span> — push notification delivery, Android only, only if enabled</li>
            </ul>
            <p className="mt-2">Each provider processes data under its own privacy policy.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Data retention &amp; deletion</h2>
            <p>
              Your content and account data are kept until you delete them or request account
              deletion. To request deletion of your account and associated data, contact us below.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Security</h2>
            <p>
              Data access is enforced with Supabase row-level security, so your content is only ever
              readable by your own account (or via an explicit share link you generate yourself).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Children's privacy</h2>
            <p>Fables isn't directed at children under 13, and we don't knowingly collect data from them.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Changes to this policy</h2>
            <p>This page may be updated as the app changes. Continued use after a change means you accept the update.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Contact</h2>
            <p>
              Questions about this policy, or a data deletion request:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
