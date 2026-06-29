import { EncryptedText } from "@/components/ui/encrypted-text"
import { LoginForm } from "@/components/login-form"
import "./App.css"
import Dashboard from "./Dashboard"
import { Routes, Route, useNavigate } from "react-router-dom"
import { supabase } from "./supabase"
import { useEffect } from "react"
import Documentation from "./Documentation"






function App() {



const navigate = useNavigate();

useEffect(() => {
  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      navigate("/dashboard");
    }
  }

  checkSession();
}, []);


  return (
    <>
    <span className="fixed bottom-3 left-3 z-50 text-[10px] font-mono font-semibold tracking-widest text-white/25 select-none pointer-events-none">
      BETA VERSION 1.2
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
    </Routes>
    </>
  )
}

export default App