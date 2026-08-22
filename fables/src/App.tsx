import { EncryptedText } from "@/components/ui/encrypted-text"
import { LoginForm } from "@/components/shell/login-form"
import "./App.css"
import Dashboard from "./Dashboard"
import { Routes, Route, useNavigate, useLocation } from "react-router-dom"
import { supabase } from "./supabase"
import { useEffect } from "react"
import Documentation from "./Documentation"
import ShareView from "./ShareView"






function App() {



const navigate = useNavigate();
const location = useLocation();

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
    <span className="fixed bottom-3 left-3 z-50 text-[10px] font-mono font-semibold tracking-widest text-white/25 select-none pointer-events-none">
      BETA VERSION 1.9.6
    </span>
    <Routes>
      <Route path="/" element={
        <div className="min-h-screen bg-background overflow-hidden flex items-center justify-center">
          <div className="w-9/10 md:w-1/2 lg:w-1/2">
            <EncryptedText
              text="fables.vivi.nexus"
              encryptedClassName="text-muted-foreground text-3xl md:text-6xl font-bold tracking-widest"
              revealedClassName="text-foreground text-3xl md:text-6xl font-bold tracking-widest"
              revealDelayMs={50}
            />
            <LoginForm className="" />
          </div>
        </div>
      } />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/documentation" element={<Documentation />} />
      <Route path="/share/:objectId/:token" element={<ShareView />} />
    </Routes>
    </>
  )
}

export default App