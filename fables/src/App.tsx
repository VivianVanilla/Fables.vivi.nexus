import { EncryptedText } from "@/components/ui/encrypted-text"
import { LoginForm } from "@/components/shell/login-form"
import "./App.css"
import Dashboard from "./Dashboard"
import { Routes, Route, useNavigate, useLocation } from "react-router-dom"
import { supabase } from "./supabase"
import { useEffect } from "react"
import Documentation from "./Documentation"
import ShareView from "./ShareView"
import PrivacyPolicy from "./PrivacyPolicy"
import { Capacitor } from "@capacitor/core"
import { SplashScreen } from "@capacitor/splash-screen"
import { useAndroidBackButton } from "./hooks/useAndroidBackButton"
import { usePushNotifications } from "./hooks/usePushNotifications"
import { useOAuthDeepLink } from "./hooks/useOAuthDeepLink"
import { useUser } from "./contexts/UserContext"






function App() {



const navigate = useNavigate();
const location = useLocation();
const user = useUser();

useAndroidBackButton();
usePushNotifications(user?.id);
useOAuthDeepLink();

// Native splash screen (see capacitor.config.ts — launchAutoHide: false)
// stays up until this fires, so the first paint the user sees is the real
// app rather than a blank white flash while React/providers/session-check
// spin up. Web build: Capacitor.isNativePlatform() is false, no-op.
useEffect(() => {
  if (Capacitor.isNativePlatform()) SplashScreen.hide()
}, []);

// Only the "/" landing page should bounce a logged-in visitor straight to
// their Dashboard — this effect used to fire on every route (App wraps
// <Routes>, so it never unmounts between pages), which meant opening a
// /share link while logged into your own account got hijacked straight to
// /dashboard before ShareView ever rendered.
useEffect(() => {
  if (location.pathname !== "/") return;

  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      navigate("/dashboard");
    }
  }

  checkSession();
}, [location.pathname]);


  return (
    <>
    
    <Routes>
      <Route path="/" element={
        <div className="relative min-h-screen bg-background overflow-hidden flex items-center justify-center">
          <div className="w-9/10 md:w-1/2 lg:w-1/2">
            <EncryptedText
              text="fables.vivi.nexus"
              encryptedClassName="text-muted-foreground text-3xl md:text-6xl font-bold tracking-widest"
              revealedClassName="text-foreground text-3xl md:text-6xl font-bold tracking-widest"
              revealDelayMs={50}
            />
            <LoginForm className="" />
          </div>
          <a
            href="/privacy"
            className="absolute bottom-4 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      } />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/documentation" element={<Documentation />} />
      <Route path="/share/:objectId/:token" element={<ShareView />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
    </Routes>
    </>
  )
}

export default App