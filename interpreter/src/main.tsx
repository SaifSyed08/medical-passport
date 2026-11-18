import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import DoctorCard from "./components/DoctorCard";
import "./styles.css";
import "./tandem.css";
import "./focus.css";
import "./refresh.css";

// A card's QR opens /card/<patient>: the doctor's page, not the patient's app.
const doctorCard = /^\/card\/([^/]+)\/?$/.exec(location.pathname)?.[1];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {doctorCard ? <DoctorCard id={doctorCard} /> : <App />}
  </StrictMode>,
);
