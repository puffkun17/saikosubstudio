const warned = new Set<string>();

/** Log once per isolate when an optional binding is absent (e.g. local dev without it). */
export function warnMissingBinding(name: string, effect: string): void {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(`[saikosubstudio] binding ${name} is missing; ${effect}`);
}
