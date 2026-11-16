# B4 — Proposals: interim periods from the RAA, service headings over two lines (16 Nov 2026)

Both proposals use only the act list already on disk (`data/raw/prefet/raa/cache/`, 2 431 bulletins read on 16 Nov).
Nothing here is applied. Code changes to `scripts/prefet/raa.py` wait until the running import has finished, so one
import never uses two parsers.

## 1. Interim periods (« intérim », « suppléance »)

### What the RAA holds today
70 act titles say *intérim*, *suppléance*, *absence* or *empêchement*. Most are about **other State services**
(DAAF, DRFiP, douanes, prison, ARS, Direction de la mer, rectorat…). They stay as acts in the « Intérims et
suppléances » theme and are **not** periods on the card.

Only these acts concern the **seven seats** on the card:

| Act | Title (short) | What it gives |
|---|---|---|
| R02-2023-12-04-00004 | intérim des fonctions de sous-préfet du Marin | seat, signature date; no name, no end in the title |
| R02-2024-04-02-00003 | intérim des fonctions de sous-préfet de La Trinité | seat, signature date; no name, no end |
| R02-2024-10-17-00004 / -00005 | nomination de Mme Sophie CHAUVEAU, secrétaire générale par intérim | seat, name, signature date; no end |
| R02-2025-06-06-00006 | suppléance de M. le préfet à M. Paul-François SCHIRA, directeur de cabinet, du 8 juin 16 h au 9 juin 15 h | seat, name, start and end |
| R02-2025-06-06-00007 | same, zone de défense (to the préfet de Guadeloupe) | zone post, **not** a card seat: left out |

2016–2020 will add some once the import has finished.

The ordinary absence or vacancy of the préfet is covered by the secrétaire général **by law**, usually without any act
in the RAA. We do not infer those periods: the existing « aucun décret… (poste vacant, intérim ou décret non retrouvé) »
message stays for them.

### Rules proposed
1. **Selection** — theme `interim` and the title names a card seat: « suppléance de M. le préfet » (not « préfet de la
   zone »), « secrétaire général(e) … par intérim de la préfecture », « directeur/directrice de cabinet par intérim »,
   « intérim des fonctions de sous-préfet de/du <arrondissement> », sous-préfet chargé de mission. A fixed list of
   patterns, printed by the build for review, like the posting decrees.
2. **Start** — the date written in the title (« du 8 juin », « à compter du ») when there is one, else the signature date
   of the act, shown as « arrêté du … ».
3. **End** — the date written in the title when there is one. Otherwise, the earliest of: the next appointment decree on
   the seat (JORF, already in `pref_posting_events`), the next interim act on the seat. Otherwise open, shown as
   « fin non publiée ». A deduced end is labelled as deduced, as for postings.
4. **Holder** — the name as written in the title. When the title has none (Marin 2023, Trinité 2024), read Article 1 on
   the act's own pages: download only those bulletins again (about ten in all, a few minutes at the slow pace), after
   the heavy jobs. Linked to a person only on an exact name match; otherwise shown as written, no new person row.
5. **Storage** — `pref_posting_events` already accepts `interim_start` / `interim_end` with `mandate_id` null: **no
   migration**. Id `raa:<act_id>:<seat>:<kind>:<date>`, `source_id` `raa-<year>`, `source_url` the bulletin PDF with
   `#page=<n>`. `detail` = the holder and title words as published.
6. **Card** — interim periods shown inside the gap of the seat (`gaps()` in `src/lib/prefet/postings.ts`) and in the
   posting list, with the act link. The caveat « Les intérims ne sont pas encore indiqués » becomes « Intérims publiés
   au recueil des actes administratifs ; les suppléances de droit du secrétaire général n'y figurent pas ».
7. **Build gate** — every interim row has an act id present in `pref_acts`; start ≤ end; no overlap with a posting of
   the same seat unless the act is a suppléance (short absence of a titular).

Loading the rows needs JM's go (same as the new RAA years).

## 2. Service headings that wrap over two lines

### The problem, measured
In the Sommaire, each group of acts is preceded by its heading « <issuer> / <service> ». `sommaire()` keeps only the
**last** heading line, so a wrapped heading leaves a tail (« des affaires juridiques / », « Secrétariat »,
« performance, stratégie, contrôle de gestion et qualité de service »). `acts.service()` then drops it.

2022–2026: 3 742 of 7 346 acts (51 %) have no service on the card. 1 772 of the 2 431 cached bulletins (73 %) have at
least one dropped heading.

### Fix proposed
1. **Parser** — every non-act line between two acts belongs to the next act's heading: join them with a space, cut an
   empty sub-service (« X / » → « X »), and put back the apostrophe the PDF font loses (U+25A1 « □ » → « ’ »).
   Prototype tested on a synthetic Sommaire and on bulletin 2026-374 (same result as today on a one-line heading):
   ```
   Préfecture de la Martinique / Secrétariat général commun - bureau   +   des affaires juridiques /
   → Préfecture de la Martinique / Secrétariat général commun - bureau des affaires juridiques
   ARS / Direction de l□offre de soins et de   +   l□autonomie (DOSA)
   → ARS / Direction de l’offre de soins et de l’autonomie (DOSA)
   ```
2. **Keep the raw Sommaire lines** next to each cached act list (`<bulletin>.lines.txt`, a few KB each), so the next
   parser fix needs no download.
3. **`acts.py`** — trust the service of re-read bulletins (new CSV column `heading` = `joined`); keep the
   `WHOLE_SERVICE` guard for rows still read the old way.
4. **Re-read the 1 772 bulletins** (plus 2016–2020 read now with the old parser). The full PDF is needed: the bulletins
   are not linearised, and `pypdf` cannot read the Sommaire from a truncated file (tested at 20–90 % of the bytes). So
   this is a heavy job at the slow pace, close to the original import; queued **after** B2's XVth amendments and B3's
   PR E download. Before it, one check on a real wrapped bulletin (one download) to confirm the layout.
5. Optional, to discuss: a hand-checked list « tail → full heading » would fill the card sooner, but it is a guess until
   the bulletin is re-read; not proposed.

## 3. Side finding: an empty bulletin blocks 2024
`recueil-r02-2024-533-recueil-des-actes-administratifs.pdf` comes back empty (« Cannot read an empty file »), so 2024 is
never recorded as done although 542 bulletins are read. Proposal: when the site serves a 0-byte file twice, record it
as a problem (« fichier vide sur le site ») and finish the year, instead of « not read, re-run ».
