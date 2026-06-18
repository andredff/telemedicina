import { createContext } from "react";

/**
 * True when a page is rendered inside the PatientLayout shell (sidebar + topbar).
 * The shared <Header> reads this to hide itself, since the layout provides the top bar.
 */
export const PatientShellContext = createContext(false);
