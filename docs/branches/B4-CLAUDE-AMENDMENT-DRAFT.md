# Draft amendment to CLAUDE.md — NOT APPLIED (awaiting JM's approval)

Prepared by B4 on 3 Nov 2026 at JM's request. Once approved, it goes into CLAUDE.md through its own small PR to `dev`
(CLAUDE.md is a shared file), never inside a B4 feature PR. Two changes: (A) an editorial layer under principle 4,
(B) visitor votes on the State's action, which principle 4 today limits to website quality.

## A. Principle 4 — add after the current text

> *Amendment (JM, <date>) — editorial layer « Le regard de Vwapepla ».* A third layer, distinct from facts and from
> visitor opinions, may carry Vwapepla's own analysis:
> - **Separate and labelled.** Its own block (component outside `FactBlock`, distinct style), titled « Le regard de
>   Vwapepla — éditorial ». Never inside a fact block, never in a chart, never in the card header.
> - **Signed and dated.** Each text names its author(s) (person or « la rédaction de Vwapepla »), its date of
>   publication and of last update; a visible log of corrections.
> - **Built on the facts layer.** Every factual claim links to a sourced fact already shown on the site (or to a primary
>   source); no new figure appears only in an editorial. Opinions are written as opinions (« nous estimons que… »).
> - **About actions and institutions, not private lives.** Public role only; no statements on a person's private life,
>   origin, ethnicity or appearance.
> - **Right of reply** applies: the officeholder or institution concerned can answer; the reply is published next to the text.
> - **Reviewed** by a second person before publication; covered by the pre-launch legal review (loi 1881).
> - **Partners.** Content shared with a partner (e.g. SEM radio) keeps the partner's editorial line separate from
>   Vwapepla's; data stays credited to its sources.
> - **Electoral periods.** For elected officeholders, editorial texts are frozen during official campaign periods
>   (rule to confirm in the legal review).
> - Stored in its own table(s) per domain (`<prefix>_editorials`), never mixed with fact tables.

## B. Principle 4 — visitor votes (replace « Visitor votes (website quality only) … »)

> Visitor votes are an opinion layer, allowed on: (1) town-hall website quality (communes); (2) **the State's action in
> Martinique by policy area** (préfet card; criteria in `data/prefet/audit/vote_criteria_etat.yaml`, each with its
> competence tag). Same safeguards everywhere: separate block and table; shown only from 20 votes per criterion as a
> distribution, no global score and no ranking; labelled « avis des visiteurs, non représentatif »; written only
> server-side (secret key), never by the browser; anonymous daily-salted voter hash, no IP stored; rate limits. Votes
> are never about a named person.

And in principle 2 (Neutrality), add: « The préfet card shows no score of a person; visitor votes on the State's action
(principle 4) are not a ranking. »
