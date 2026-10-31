# Vwapepla — Project brief (from brainstorming, 31 Oct 2026)

## 1. Vision
A civic "social media" where, by political period/term, each officeholder is displayed as a video-game style
track-record card. All facts are sourced so debate focuses on substance, not on whether facts are true.

## 2. Perimeter
| Office | Nature | Card basis |
|---|---|---|
| Mayors (34 communes) | Elected, term 2026–2032 (municipal elections March 2026) | Budget data (OFGL), then promises vs delivery |
| CTM (Assemblée + Conseil exécutif) | Elected | Budget, octroi de mer decisions, major programmes |
| Deputies (Assemblée nationale) | Elected | Attendance, amendments, bills, written questions, votes |
| Senators | Elected | Same as deputies |
| Préfet | **Appointed** (no programme) | State actions: arrêtés, crisis management, State funding — separate card type, not a "promise" card |

## 3. Methodology — three separate layers
1. **Facts** — figures, votes, documents, each with source link. Team-managed, published method.
2. **Promise assessment** — kept / partly kept / in progress / broken / not verifiable, with written rationale and archived source documents (archive campaign material: it disappears from the web).
3. **Citizen opinion** — comments/reactions, moderated (later phase).

Rules: no global score at start; right of reply for officeholders; public methodology charter.

## 4. Data sources
- OFGL Comptes des communes (all 34 communes, 2012→2025, CSV/JSON, Licence Ouverte) — primary for budgets.
- DGFiP balances comptables — account-level detail.
- AFD Observatoire des communes de Martinique — benchmark and reconciliation.
- RNE (Répertoire national des élus) — who holds which office.
- Assemblée nationale & Sénat open data; NosDéputés / NosSénateurs (Regards Citoyens).
- Chambre régionale des comptes Antilles-Guyane reports.
- HATVP declarations.
- Council minutes, prefecture Recueil des actes administratifs.

Caveats: functional spending breakdown (education, culture…) only mandatory ≥3,500 inhabitants and broken by M57 transition in 2024 → later phase. Intercommunal competences distort commune comparisons → per-inhabitant + strata + caveat.

## 5. Legal checklist (before public launch)
- GDPR art. 9: user votes/comments can reveal political opinions → legal basis, minimisation.
- Loi 1881 (defamation): sourced facts, careful wording, moderation + takedown procedure.
- Electoral periods: strict neutrality.
- Short legal review recommended.

## 6. Partner: SEM radio (only active partner)
RCI = possible future communication channel only (no contact today).
Synergy ideas:
1. "One commune, one show": card published the same day as the episode.
2. Listeners vote in the app for the next commune.
3. Mayor's right of reply, on air and in the app.
4. Budget calendar hooks: DOB (Feb–Mar), budget vote (spring), **first anniversary of terms — March 2027**.
5. Listener-submitted documents, verified before publication.
6. Short URL / QR code (vwapepla.org/sem) to measure radio impact.
7. Recurring segment, e.g. "Bidjé-a an 3 chif" (the budget in 3 figures).
Condition: separate radio editorial line and Vwapepla methodology; data credited to Vwapepla/OFGL.

## 7. Roadmap
- Phase 1 (3–4 months): 34 mayors' budget cards + methodology charter → SEM demo and joint launch. **(= MVP2)**
- Phase 2: promise tracking for 2026 municipal terms.
- Phase 3: deputies & senators (automatable), then CTM.
- Phase 4: Préfet card, past terms, VoxPop integration, shared account with prix-martinique.

## 8. Pending deliverables
1. Vwapepla action plan.
2. MVP2 spec & build (Claude Code) — see CLAUDE.md.
3. Plan for our contribution to SEM radio's upcoming show on mayors' budgets.
4. Concept for a follow-up episode fully exploiting Vwapepla data.
