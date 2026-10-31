// French contractions in front of a commune name: "Commune du Lamentin", "aux Anses-d'Arlet", "de La Trinité".
// Use these helpers everywhere a commune name follows "de" or "à" — never concatenate "de " + name.

const VOWEL = /^[aeiouyhâàéèêëîïôöûüœ]/i;

/** "de" + name: Le Lamentin -> du Lamentin, Les Anses-d'Arlet -> des Anses-d'Arlet, La Trinité -> de La Trinité. */
export function deCommune(name: string): string {
  if (name.startsWith("Le ")) return `du ${name.slice(3)}`;
  if (name.startsWith("Les ")) return `des ${name.slice(4)}`;
  if (name.startsWith("La ") || name.startsWith("L'")) return `de ${name}`;
  return VOWEL.test(name) ? `d'${name}` : `de ${name}`;
}

/** "à" + name: Le Lamentin -> au Lamentin, Les Trois-Îlets -> aux Trois-Îlets, La Trinité -> à La Trinité. */
export function aCommune(name: string): string {
  if (name.startsWith("Le ")) return `au ${name.slice(3)}`;
  if (name.startsWith("Les ")) return `aux ${name.slice(4)}`;
  return `à ${name}`;
}
