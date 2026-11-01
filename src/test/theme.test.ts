import { describe, it, expect } from "vitest";
import { resolveDarkTheme, THEME_KEY } from "@/components/app/theme";
describe("Visual theme preference", () => {
  it("respects the system preference without a persisted choice", () => {
    expect(resolveDarkTheme(null, true)).toBe(true);
    expect(resolveDarkTheme(null, false)).toBe(false);
  });
  it("uses a persisted explicit toggle choice instead of the system preference", () => {
    expect(resolveDarkTheme("light", true)).toBe(false);
    expect(resolveDarkTheme("dark", false)).toBe(true);
    expect(THEME_KEY).toBe("guardia-theme");
  });
});
