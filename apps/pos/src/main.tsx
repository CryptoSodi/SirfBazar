import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ToastHost } from "./components/Toast";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <ToastHost />
  </StrictMode>,
);
