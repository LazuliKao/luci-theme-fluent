let counter = 0;

/** Generates a short, URL/UCI-safe unique id with an optional prefix. */
export function createId(prefix = "n"): string {
  counter = (counter + 1) % 1_679_616;
  const time = Date.now().toString(36).slice(-6);
  const random = Math.floor(Math.random() * 1_679_616)
    .toString(36)
    .padStart(4, "0");
  return `${prefix}_${time}${counter.toString(36).padStart(4, "0")}${random}`;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

/** Returns `base` or `base_2`, `base_3`, ... so that it is not contained in `taken`. */
export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base.slice(0, 58)}_${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
