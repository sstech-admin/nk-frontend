import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { validateApiSetup } from "./lib/api";

// Validate API setup on load (helps debug configuration)
validateApiSetup().then((status) => {
  if (import.meta.env.DEV) {
    console.log("[API Setup]", status.useMock ? "Using mock store" : "Using real API", status);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
