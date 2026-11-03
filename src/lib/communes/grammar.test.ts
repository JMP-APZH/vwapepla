import { describe, expect, it } from "vitest";
import { aCommune, deCommune } from "./grammar";

describe("deCommune", () => {
  it.each([
    ["Le Lamentin", "du Lamentin"],
    ["Le Morne-Rouge", "du Morne-Rouge"],
    ["Les Anses-d'Arlet", "des Anses-d'Arlet"],
    ["Les Trois-Îlets", "des Trois-Îlets"],
    ["La Trinité", "de La Trinité"],
    ["L'Ajoupa-Bouillon", "de L'Ajoupa-Bouillon"],
    ["Fort-de-France", "de Fort-de-France"],
    ["Sainte-Anne", "de Sainte-Anne"],
    ["Ajaccio", "d'Ajaccio"],
  ])("%s -> %s", (name, expected) => expect(deCommune(name)).toBe(expected));
});

describe("aCommune", () => {
  it.each([
    ["Le Lamentin", "au Lamentin"],
    ["Les Anses-d'Arlet", "aux Anses-d'Arlet"],
    ["La Trinité", "à La Trinité"],
    ["Schœlcher", "à Schœlcher"],
  ])("%s -> %s", (name, expected) => expect(aCommune(name)).toBe(expected));
});
