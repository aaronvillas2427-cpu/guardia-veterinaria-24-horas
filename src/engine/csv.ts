/** Neutraliza inyección de fórmulas: celdas que inician con = + - @ se prefijan con '. */
export function neutralize(v: string): string {
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

export function csvCell(v: unknown): string {
  const s = neutralize(v == null ? "" : String(v));
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function toCSV<T>(rows: readonly T[], cols: readonly CsvColumn<T>[]): string {
  const out = [cols.map((c) => csvCell(c.header)).join(",")];
  for (const r of rows) out.push(cols.map((c) => csvCell(c.value(r))).join(","));
  return out.join("\r\n");
}
