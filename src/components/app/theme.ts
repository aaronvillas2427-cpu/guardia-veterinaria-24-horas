import { useEffect, useState } from "react";
export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { let saved: string | null = null; try { saved = localStorage.getItem("guardia-theme"); } catch { /* Storage unavailable */ } const next = saved ? saved === "dark" : media.matches; setDark(next); document.documentElement.classList.toggle("dark", next); };
    apply(); media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  const toggle = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); try { localStorage.setItem("guardia-theme", next ? "dark" : "light"); } catch { /* Session-only theme */ } };
  return { dark, toggle };
}
