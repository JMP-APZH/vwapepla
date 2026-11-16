import { FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import { groupByKind, isCurrent, type Member, type Membership } from "@/lib/parlement/members";
import { fill, upperFirst } from "@/lib/parlement/text";
import { parlement } from "@/i18n";

const KIND_FR: Record<string, string> = {
  GP: "Groupe politique", COMPER: "Commission permanente", COM: "Commission permanente", DELEG: "Délégations",
  CNPE: "Commissions d'enquête", MISINFO: "Missions d'information", MISINFOCOM: "Missions d'information",
  MISINFOPRE: "Missions d'information", CMP: "Commissions mixtes paritaires", ORGEXTPARL: "Organismes extraparlementaires",
  COMNL: "Autres commissions", CNPS: "Commissions spéciales", MINISTERE: "Missions auprès du Gouvernement",
  GE: "Groupes d'études", GEVI: "Groupes d'études à vocation internationale", GA: "Groupes d'amitié", API: "Assemblées internationales",
};
const COLLAPSED = new Set(["GA", "GE", "GEVI"]); // many rows: shown folded, never counted

function period(m: Membership) {
  return m.end_date ? fill(parlement.fromTo.fr, { from: date(m.start_date), to: date(m.end_date) })
    : `${parlement.since.fr} ${date(m.start_date)}`;
}

function Items({ items }: { items: Membership[] }) {
  return (
    <ul className="mt-1 space-y-1">
      {items.map((m) => (
        <li key={m.id}>
          {upperFirst(m.parl_organes.label_fr)}
          {m.function && <span className="text-slate-600"> · {m.function}</span>}
          <span className="text-xs text-slate-500"> · {period(m)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Groups, committees and functions during the current mandate, with official names and dates (charter §3.1). */
export function MandateBlock({ member, memberships, today, sources }: {
  member: Member; memberships: Membership[]; today: string; sources: Source[];
}) {
  const current = groupByKind(memberships.filter((m) => isCurrent(m, today)));
  const past = groupByKind(memberships.filter((m) => !isCurrent(m, today)));
  return (
    <FactBlock title={parlement.mandateTitle.fr} sources={sources} periodLabel="" year={member.chamber === "AN" ? "XVIIe législature" : "mandat en cours"}>
      <p className="mt-1 text-sm text-slate-600">{parlement.mandateIntro.fr}</p>
      {member.suppleant && (
        <p className="mt-3 text-sm">
          <span className="font-medium">{(member.suppleant.sex === "F" ? parlement.suppleantF : parlement.suppleant).fr} :</span>{" "}
          {member.suppleant.firstName} {member.suppleant.lastName}
          <span className="block text-xs text-slate-500">{parlement.suppleantSource.fr}</span>
        </p>
      )}
      <h3 className="mt-4 text-sm font-semibold">{parlement.currentFunctions.fr}</h3>
      <div className="mt-1 space-y-3 text-sm">
        {current.map((g) => COLLAPSED.has(g.kind) ? (
          <details key={g.kind}>
            <summary className="cursor-pointer font-medium">{KIND_FR[g.kind] ?? g.kind}</summary>
            <Items items={g.items} />
          </details>
        ) : (
          <div key={g.kind}>
            <p className="font-medium">{KIND_FR[g.kind] ?? g.kind}</p>
            <Items items={g.items} />
          </div>
        ))}
      </div>
      {past.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold">{parlement.pastFunctions.fr}</summary>
          <div className="mt-2 space-y-3">
            {past.map((g) => (
              <div key={g.kind}>
                <p className="font-medium">{KIND_FR[g.kind] ?? g.kind}</p>
                <Items items={g.items} />
              </div>
            ))}
          </div>
        </details>
      )}
    </FactBlock>
  );
}
