import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { UserProvider } from "./contexts/UserContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App";

// Lets index.css give native builds a little extra top breathing room (see
// the .native-app rule there) without affecting the web build — set as
// early as possible, before the first paint, so there's no flash of
// unpadded content. StatusBar's overlaysWebView:false already reserves
// exact status bar height on native; this is purely a touch-comfort buffer
// on top of that, since a header button sitting flush against the status
// bar boundary is awkward to tap precisely.
if (Capacitor.isNativePlatform()) document.documentElement.classList.add("native-app");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <UserProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </UserProvider>
    </ThemeProvider>
  </React.StrictMode>
);