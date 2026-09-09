import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { obtenirSession } from "@/lib/auth/session";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { formatMoney } from "@/lib/money/format";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";
import {
  forfaitApplicable,
  forfaitRetenu,
  TYPES_FORFAIT,
  type TypeForfait,
} from "@/lib/tarification/forfaits";

/**
 * L'ÉCRAN QUI MONTRE, POUR UNE ZONE DONNÉE, QUELS FORFAITS S'APPLIQUENT ET
 * DANS QUEL ORDRE (D86).
 *
 * *Un tarif qu'on ne peut pas inspecter est un tarif qu'on ne peut pas défendre
 * devant un client.* La question qu'un client pose n'est jamais « quel est
 * votre catalogue » : c'est « pourquoi CE montant sur MA facture ». Cet écran y
 * répond en montrant le rang, les conditions, et **lequel l'emporte**.
 *
 * **Rien n'est recalculé ici.** La liste des applicables et le retenu viennent
 * de `forfaitRetenu` et de `forfaitApplicable`, c'est-à-dire des mêmes
 * fonctions que la création d'intervention. Un écran qui referait le tri
 * serait une seconde lecture d'un même critère, et il divergerait en silence
 * (§9, 01/09) — c'est-à-dire qu'il montrerait un forfait et que la facture en
 * porterait un autre.
 */
export default async function PageForfaits({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  const demandee = (await searchParams).zone;
  const zone =
    typeof demandee === "string" &&
    (ZONES_GEOGRAPHIQUES as readonly string[]).includes(demandee)
      ? demandee
      : (ZONES_GEOGRAPHIQUES[0] ?? null);

  const { catalogue, devise } = await avecContexteApplicatif(
    session.contexte,
    async (tx) => {
      const forfaits = await tx.forfait.findMany({
        select: {
          id: true,
          code: true,
          libelle: true,
          type: true,
          rang: true,
          montant_mineur: true,
          devise_code: true,
          zone_geo: true,
          famille_id: true,
          type_intervention: true,
          actif: true,
        },
        orderBy: [{ type: "asc" }, { rang: "asc" }],
      });
      const societe = await tx.societe.findFirst({
        select: {
          devise: { select: { code: true, decimales: true, symbole: true } },
        },
      });
      return { catalogue: forfaits, devise: societe?.devise ?? null };
    },
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("forfaits.titre")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("forfaits.sous_titre")}
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("forfaits.zone")}
          <select
            name="zone"
            defaultValue={zone ?? undefined}
            className="border-input bg-background rounded-md border px-3 py-2 font-normal"
          >
            {ZONES_GEOGRAPHIQUES.map((valeur) => (
              <option key={valeur} value={valeur}>
                {libelleZone(valeur)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="border-input rounded-md border px-3 py-2 text-sm"
        >
          {t("forfaits.voir")}
        </button>
      </form>

      {catalogue.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("forfaits.vide")}</p>
      ) : (
        TYPES_FORFAIT.map((type) => (
          <Nature
            key={type}
            type={type}
            zone={zone}
            lignes={catalogue.filter((f) => f.type === type)}
            devise={devise}
          />
        ))
      )}

      <p className="text-muted-foreground text-xs">
        {t("forfaits.explication_rang")}
      </p>
    </main>
  );
}

type Ligne = {
  id: string;
  code: string;
  libelle: string;
  type: string;
  rang: number;
  montant_mineur: bigint;
  devise_code: string;
  zone_geo: string[];
  famille_id: string | null;
  type_intervention: string[];
  actif: boolean;
};

/**
 * Une nature de forfait, avec son ordre d'application pour la zone choisie.
 *
 * Le rang ne se compare qu'entre forfaits de MÊME nature — un déplacement
 * n'est jamais en concurrence avec une prestation —, et le regroupement le dit
 * à l'écran plutôt que dans une note.
 */
function Nature({
  type,
  zone,
  lignes,
  devise,
}: {
  type: TypeForfait;
  zone: string | null;
  lignes: readonly Ligne[];
  devise: { code: string; decimales: number; symbole: string | null } | null;
}) {
  if (lignes.length === 0) {
    return null;
  }
  const conditions = { zone, familleId: null, typeIntervention: null };
  // Un forfait inactif ne se facture pas : il figure au tableau, jamais parmi
  // les candidats — l'écran doit dire pourquoi il n'apparaît pas plus bas.
  const actifs = lignes.filter((f) => f.actif);
  const retenu = forfaitRetenu(
    actifs.map((f) => ({ ...f, id: f.id, rang: f.rang })),
    conditions,
  );

  return (
    <section className="border-border flex flex-col gap-3 rounded-lg border px-4 py-4">
      <h2 className="text-lg font-medium">{libelleType(type)}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left">
            <tr>
              <th className="py-1 pr-3 font-normal">{t("forfaits.rang")}</th>
              <th className="py-1 pr-3 font-normal">{t("forfaits.code")}</th>
              <th className="py-1 pr-3 font-normal">{t("forfaits.montant")}</th>
              <th className="py-1 pr-3 font-normal">
                {t("forfaits.conditions")}
              </th>
              <th className="py-1 font-normal">{t("forfaits.verdict")}</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((forfait) => (
              <tr key={forfait.id} className="border-border border-t">
                <td className="py-1.5 pr-3 tabular-nums">{forfait.rang}</td>
                <td className="py-1.5 pr-3">{nomComplet(forfait)}</td>
                <td className="py-1.5 pr-3 tabular-nums">
                  {montantAffiche(forfait, devise)}
                </td>
                <td className="py-1.5 pr-3">{resumeConditions(forfait)}</td>
                <td className="py-1.5">
                  {verdict(forfait, retenu?.id ?? null, conditions)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Le code et le libellé, composés HORS du JSX : un littéral n'y est pas admis,
 * fût-il un tiret (L0-11). C'est le gardien qui l'a dit, pas la relecture.
 */
function nomComplet(forfait: Ligne): string {
  return `${forfait.code} — ${forfait.libelle}`;
}

/**
 * Le montant, ou son absence.
 *
 * **Aucun formatage écrit ici** : `formatMoney` est le point de passage unique
 * (I3), et la devise d'un forfait ne peut pas différer de celle de sa société —
 * un déclencheur le refuse. Si elle diffère malgré tout, on n'invente pas un
 * format : on n'affiche rien.
 */
function montantAffiche(
  forfait: Ligne,
  devise: { code: string; decimales: number; symbole: string | null } | null,
): string {
  if (devise === null || devise.code !== forfait.devise_code) {
    return ABSENT;
  }
  return formatMoney(
    {
      nature: "reel",
      valeur: forfait.montant_mineur,
      devise: forfait.devise_code,
    },
    devise,
  );
}

/** Le tiret cadratin d'une valeur absente — un signe, pas une phrase. */
const ABSENT = "\u2014";

/** Ce que le forfait exige, en clair — l'absence de condition se DIT. */
function resumeConditions(forfait: Ligne): string {
  const parts: string[] = [];
  if (forfait.zone_geo.length > 0) {
    parts.push(forfait.zone_geo.map((z) => libelleZone(z)).join(", "));
  }
  if (forfait.famille_id !== null) {
    parts.push(t("forfaits.condition_famille"));
  }
  if (forfait.type_intervention.length > 0) {
    parts.push(forfait.type_intervention.join(", "));
  }
  return parts.length === 0 ? t("forfaits.sans_condition") : parts.join(" · ");
}

/**
 * Trois verdicts, et le troisième est celui qui manque partout ailleurs :
 * « applicable, mais un autre passe avant ». Sans lui, un tarif absent d'une
 * facture paraîtrait exclu par ses conditions alors qu'il l'est par son rang.
 */
function verdict(
  forfait: Ligne,
  retenuId: string | null,
  conditions: {
    zone: string | null;
    familleId: string | null;
    typeIntervention: string | null;
  },
): string {
  if (!forfait.actif) {
    return t("forfaits.inactif");
  }
  if (forfait.id === retenuId) {
    return t("forfaits.retenu");
  }
  return forfaitApplicable(forfait, conditions)
    ? t("forfaits.applicable_apres")
    : t("forfaits.ecarte");
}

/** Le libellé d'une zone — au dictionnaire, jamais écrit dans le composant. */
function libelleZone(zone: string): string {
  const cle = `zone.${zone}`;
  return estCleTraduction(cle) ? t(cle) : zone;
}

/** Le libellé d'une nature de forfait — au dictionnaire également. */
function libelleType(type: string): string {
  const cle = `type_forfait.${type}`;
  return estCleTraduction(cle) ? t(cle) : type;
}
