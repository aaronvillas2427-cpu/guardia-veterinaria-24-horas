import { useEffect, useState } from "react";
export const THEME_KEY = "guardia-theme";
export function resolveDarkTheme(saved: string | null, systemDark: boolean): boolean {
  return saved === "dark" ? true : saved === "light" ? false : systemDark;
}
export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { let saved: string | null = null; try { saved = localStorage.getItem(THEME_KEY); } catch { /* Storage unavailable */ } const next = resolveDarkTheme(saved, media.matches); setDark(next); document.documentElement.classList.toggle("dark", next); };
    apply(); media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  const toggle = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch { /* Session-only theme */ } };
  return { dark, toggle };
}
