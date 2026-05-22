import { EncryptedText } from "@/components/ui/encrypted-text"
import { LoginForm } from "@/components/login-form"
import "./App.css"
import Dashboard from "./Dashboard"
import { Routes, Route } from "react-router-dom"

function App() {
  return (
    <Routes>
      <Route path="/" element={
        <div className="min-h-screen bg-taupe-900 overflow-hidden flex items-center justify-center">
          <div className="w-9/10 md:w-1/2 lg:w-1/2">
            <EncryptedText
              text="fables.vivi.nexus"
              encryptedClassName="text-neutral-500 text-3xl md:text-6xl font-bold tracking-widest"
              revealedClassName="text-white text-3xl md:text-6xl font-bold tracking-widest"
              revealDelayMs={50}
            />
            <LoginForm className="" />
          </div>
        </div>
      } />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  )
}

export default App