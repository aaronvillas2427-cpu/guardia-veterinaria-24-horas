export const fmt = (n: number, d = 1) =>
  Number.isFinite(n) ? n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
export const pct = (n: number, d = 1) => `${fmt(n * 100, d)} %`;
export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
