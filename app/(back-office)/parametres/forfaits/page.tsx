import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { FormulaireForfait } from "@/components/forfaits/formulaire";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
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
 *
 * ## R2-06 — LE JUMEAU DE R2-05, ET LA FORME EST PARTAGÉE
 *
 * Les deux écrans visent le MÊME écran de la maquette — « Sociétés & tarifs » —
 * et la barre les allume tous deux : ils doivent se ressembler. La forme du
 * tableau vit donc dans `components/ui/tableau.tsx`, une seule fois. *Deux
 * implémentations d'un même critère divergent en silence*, et une forme
 * visuelle est un critère comme un autre — c'est même celui dont la divergence
 * se voit le plus et se mesure le moins.
 *
 * **Mesuré le 11/09/2026, fenêtre 1700 × 1000 : contenu de 896 px, document de
 * 1146 px** — la même colonne étroite que les agences, sur une largeur utile
 * de 1400.
 *
 * **Le regroupement par nature reste**, et ce n'est pas une carte par
 * enregistrement : le rang ne se compare qu'entre forfaits de même nature, et
 * l'écran le dit par sa structure plutôt que dans une note.
 *
 * ## R2-20 — L'ÉCRAN CESSE D'ÊTRE EN LECTURE SEULE
 *
 * Le catalogue naissait vide **par décision** (L1-06), et il le restait :
 * aucun chemin ne posait une ligne autrement qu'en SQL. Il porte désormais le
 * formulaire de création, la bascule d'activité et le lien vers la fiche.
 *
 * **Aucune suppression, nulle part.** Une intervention désigne son forfait, et
 * *une facture émise sous un forfait disparu ne s'explique plus* : désactiver
 * retire du CHOIX sans toucher au passé. L'écran le DIT, plutôt que de laisser
 * chercher le bouton qui manque.
 *
 * **Le formulaire est sous le tableau, jamais au-dessus.** La question que cet
 * écran répond d'abord est « pourquoi CE montant », et la réponse est le
 * tableau ; l'ajout est le geste rare.
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

  const parametres = await searchParams;
  const motif = parametres.motif;
  const demandee = parametres.zone;
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
    <Page
      chemin="/parametres/forfaits"
      titre={t("forfaits.titre")}
      sousTitre={t("forfaits.sous_titre")}
      actions={
        <form method="get" className="flex flex-wrap items-center gap-2">
          <label className="text-app-encre-faible text-[12px] font-semibold">
            {t("forfaits.zone")}
          </label>
          <select
            name="zone"
            defaultValue={zone ?? undefined}
            className="border-app-bord bg-app-surface rounded-md border px-2.5 py-1.5 text-[12.5px]"
          >
            {ZONES_GEOGRAPHIQUES.map((valeur) => (
              <option key={valeur} value={valeur}>
                {libelleZone(valeur)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="border-app-bord rounded-md border px-3 py-1.5 text-[12.5px] font-semibold"
          >
            {t("forfaits.voir")}
          </button>
        </form>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      {catalogue.length === 0 ? (
        <section className="bg-app-surface border-app-bord text-app-encre-faible rounded-[10px] border px-4 py-6 text-[13px]">
          {t("forfaits.vide")}
        </section>
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

      <p className="text-app-encre-faible text-[11.5px]">
        {t("forfaits.explication_rang")}
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-[14px] font-bold">{t("forfaits.creer")}</h2>
        <FormulaireForfait action="/api/parametres/forfaits/creer" />
        <p className="text-app-encre-faible text-[11.5px]">
          {t("forfaits.desactiver_explication")}
        </p>
      </section>
    </Page>
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

  const colonnes = [
    { cle: "rang", libelle: t("forfaits.rang"), droite: true, largeur: "70px" },
    { cle: "code", libelle: t("forfaits.code") },
    {
      cle: "montant",
      libelle: t("forfaits.montant"),
      droite: true,
      largeur: "150px",
    },
    { cle: "conditions", libelle: t("forfaits.conditions") },
    { cle: "verdict", libelle: t("forfaits.verdict"), largeur: "230px" },
    { cle: "actions", libelle: t("forfaits.actions"), largeur: "170px" },
  ];

  return (
    <section className="bg-app-surface border-app-bord overflow-hidden rounded-[10px] border">
      <h2 className="border-app-bord border-b px-4 py-3.5 text-[14px] font-bold">
        {libelleType(type)}
      </h2>
      <Tableau colonnes={colonnes} minimum="990px">
        {lignes.length === 0 ? (
          <LignePleine colonnes={colonnes.length}>
            {t("forfaits.vide")}
          </LignePleine>
        ) : null}
        {lignes.map((forfait) => (
          <tr key={forfait.id}>
            <Cellule droite>
              <span className="tabular-nums">{forfait.rang}</span>
            </Cellule>
            <Cellule mono>{nomComplet(forfait)}</Cellule>
            <Cellule droite fort>
              <span className="tabular-nums">
                {montantAffiche(forfait, devise)}
              </span>
            </Cellule>
            <Cellule>{resumeConditions(forfait)}</Cellule>
            <Cellule>
              {verdict(forfait, retenu?.id ?? null, conditions)}
            </Cellule>
            <Cellule>
              <Actions forfait={forfait} />
            </Cellule>
          </tr>
        ))}
      </Tableau>
    </section>
  );
}

/**
 * LES DEUX SEULS GESTES OFFERTS SUR UNE LIGNE : la fiche, et la bascule.
 *
 * **L'état visé est PORTÉ par le formulaire**, jamais déduit de l'état courant
 * au moment du clic : *une bascule qui lit l'état qu'elle change répond à un
 * affichage vieux de plusieurs secondes, et deux clics rapides se rendent
 * mutuellement sans effet.*
 *
 * Et il n'y a pas de troisième geste : **supprimer n'existe pas**, une
 * intervention pouvant désigner ce forfait.
 */
function Actions({ forfait }: { forfait: Ligne }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Link
        href={`/parametres/forfaits/${forfait.id}`}
        className="border-app-bord rounded-md border px-2.5 py-1 text-[12px] font-semibold"
      >
        {t("forfaits.modifier")}
      </Link>
      <form
        method="post"
        action={`/api/parametres/forfaits/${forfait.id}/activite`}
      >
        <input
          type="hidden"
          name="actif"
          value={forfait.actif ? "non" : "oui"}
        />
        <button
          type="submit"
          className="border-app-bord rounded-md border px-2.5 py-1 text-[12px] font-semibold"
        >
          {forfait.actif ? t("forfaits.desactiver") : t("forfaits.activer")}
        </button>
      </form>
    </span>
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
