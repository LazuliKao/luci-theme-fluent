import type { WidgetConfig } from "../core/types";

/** Small pure selector shared by table widgets; never changes the cached source rows. */
export function filtered<T extends object>(rows: T[], config: WidgetConfig): T[] {
  const query = String(config.query ?? "").toLocaleLowerCase(),
    key = String(config.sortBy ?? "");
  const result = rows.filter((row) => !query || Object.values(row).some((value) => String(value).toLocaleLowerCase().includes(query)));
  if (key)
    result.sort((a, b) => {
      const left = (a as Record<string, unknown>)[key],
        right = (b as Record<string, unknown>)[key];
      const order = typeof left === "number" && typeof right === "number" ? left - right : String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true });
      return config.descending ? -order : order;
    });
  return result.slice(0, Number(config.limit ?? 200));
}
export function validTableConfig(config: WidgetConfig): boolean {
  return (
    (config.query === undefined || (typeof config.query === "string" && config.query.length <= 256)) &&
    (config.limit === undefined || (Number.isInteger(config.limit) && Number(config.limit) >= 1 && Number(config.limit) <= 1000)) &&
    (config.sortBy === undefined || (typeof config.sortBy === "string" && config.sortBy.length <= 64)) &&
    (config.descending === undefined || typeof config.descending === "boolean")
  );
}
