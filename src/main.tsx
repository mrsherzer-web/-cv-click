import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// כל משקל כולל unicode-range, כך שהדפדפן מוריד רק עברית/לטינית לפי הצורך
import "@fontsource/karantina/400";
import "@fontsource/karantina/700";
import "@fontsource/assistant/400";
import "@fontsource/assistant/600";
import "@fontsource/assistant/700";
import "@fontsource/assistant/800";
import "@fontsource/big-shoulders-display/800";
import "@fontsource/big-shoulders-display/900";
import "@fontsource/jetbrains-mono/400";
import "@fontsource/jetbrains-mono/500";
import "./styles/base.css";
import "./styles/sections.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
