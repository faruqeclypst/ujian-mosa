import "./styles/globals.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { cleanupReloadQueryParam } from "./utils/hardReload";

// Bersihkan parameter cache-buster jika ada setelah hard reload
cleanupReloadQueryParam();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
