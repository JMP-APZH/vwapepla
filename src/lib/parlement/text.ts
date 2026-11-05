/** Fill « {name} » placeholders of a message. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** First letter upper case (official labels such as « commission des affaires sociales »). */
export function upperFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
