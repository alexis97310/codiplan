/**
 * BASE DE DÉMONSTRATION : UNE INTERVENTION A DEUX MACHINES (P3009).
 *
 * ## D'OÙ VIENT LE DOUBLON, ET POURQUOI IL NE PEUT PLUS NAÎTRE
 *
 * Avant le 23/09/2026 16h50 (commit c324031d), `INTERVENTIONS_AVEC_MACHINES_DEMONSTRATION`
 * (`prisma/seed-data.ts`) donnait `nombreMachines: 2` à deux rangs d'intervention.
 * L'arbitrage PARCOURS-1 (23/09/2026) a refermé « une intervention porte au plus
 * une machine » et la migration `20260923130000_parcours_1_creer_puis_planifier`
 * pose la contrainte — mais elle REFUSE de s'appliquer tant qu'une base porte
 * déjà deux lignes pour une même intervention, et NE SUPPRIME RIEN elle-même :
 * « le rattrapage appartient à l'exploitation » (son propre commentaire).
 *
 * Ce module est ce rattrapage, écrit une fois et éprouvable sans base : il ne
 * touche aucune connexion, aucune horloge. L'appelant fournit ce qu'il a lu
 * (sous une identité qui voit réellement les lignes, `intervention_machine`
 * portant `FORCE ROW LEVEL SECURITY`), et c'est cette séparation qui rend le
 * critère éprouvable sur des états fabriqués.
 *
 * ## POURQUOI LE PLUS PETIT IDENTIFIANT DU SEMIS, ET POURQUOI C'EST SÛR
 *
 * Les lignes qu'un même doublon doit au semis ont été créées par `prisma/seed.ts`
 * dans la MÊME transaction (`upsert` qui ne retrouve rien, faute de rapprochement
 * par clé naturelle) : `cree_le` ne les distingue pas, c'est la même horloge de
 * transaction pour toutes. L'ordre de pose, lui, est stable et documenté par
 * `identifiantParc` (`prisma/seed-data.ts`) : la machine conservée par le semis
 * actuel — la première de `[...modelesInedits, ...modelesDejaVus]` — reçoit
 * toujours le plus petit `rangRattachement`, donc le plus petit suffixe
 * d'identifiant. Garder le plus petit `id` PARMI CEUX DU SEMIS revient donc à
 * garder exactement la machine que le semis d'aujourd'hui pose seule.
 *
 * ## LE RATTACHEMENT HORS SEMIS : RETIRÉ QUAND LE SEMIS EST PRÉSENT, REFUSÉ SINON
 *
 * DÉCISION D'ALEXIS (03/10/2026, `claude/decisions-alexis-03-10.md` point 6) :
 * sur la base de DÉMONSTRATION, quand une intervention porte plusieurs
 * rattachements dont AU MOINS UN du semis, on garde le rattachement DU SEMIS
 * (le plus petit identifiant portant `PREFIXE_RATTACHEMENT_SEED`) et on retire
 * tous les autres, y compris ceux posés à la main — un rattachement posé par
 * l'application (ex. `lib/interventions/depot.ts`) en plus de celui du semis
 * n'est pas une anomalie du semis, c'est un doublon de pose, et le semis fait
 * foi. Si AUCUNE ligne du groupe ne porte le préfixe du semis, cette décision
 * ne couvre pas le cas : ce n'est plus la démo telle que le semis la connaît,
 * choisir laquelle garder serait inventer une règle que personne n'a arbitrée.
 * Le module REFUSE alors — un verdict, jamais une exception — et ne propose
 * aucun retrait.
 *
 * ## LE DOUBLON SANS AUCUNE LIGNE DU SEMIS, MAIS SUR UNE INTERVENTION DU SEMIS
 *
 * Refus mesuré le 24/10/2026 (ticket 9H3-DEMO-DOUBLONS-HORS-SEMIS) : l'INTERVENTION
 * 0192f0a0-6000-7000-8000-000000000001 est bien celle du semis (préfixe
 * `identifiantIntervention`, `prisma/seed-data.ts`), mais AUCUNE de ses lignes
 * `intervention_machine` ne porte `PREFIXE_RATTACHEMENT_SEED` — les deux ont
 * été posées à la main. Le refus ci-dessus était juste pour ce qu'il mesurait
 * (aucune ligne du semis) mais trop large : l'INTERVENTION, elle, est connue.
 *
 * DÉCISION D'ALEXIS (24/10/2026, « Ticket en fin de file ») : sur la base de
 * DÉMONSTRATION SEULEMENT, quand un groupe sans aucune ligne du semis porte une
 * intervention ET une société qui appartiennent toutes deux au jeu de
 * démonstration (`PREFIXE_INTERVENTION_SEED`, `SOCIETES_DU_SEED`), on garde la
 * PREMIÈRE MACHINE — la plus ancienne par `cree_le`, puis par `id` à égalité —
 * et on retire les autres. Mesuré : `intervention_machine.cree_le` existe
 * (`prisma/schema.prisma`, colonne de la table) ; le tri s'appuie donc sur elle
 * en premier, jamais sur `id` seul, à la différence du cas du semis ci-dessus
 * (où `cree_le` ne distingue rien, étant posé dans la même transaction).
 *
 * Si l'intervention OU la société n'appartient pas au jeu de démonstration, ce
 * nouveau cas ne couvre pas non plus la ligne : le refus d'origine reste entier.
 */

import { SOCIETES_DU_SEED } from "./donnees-hors-seed";

/** Une ligne de `intervention_machine`, telle qu'observée en base. */
export type LigneRattachement = {
  readonly id: string;
  readonly societe_id: string;
  readonly intervention_id: string;
  readonly machine_id: string;
  /** `cree_le` (`prisma/schema.prisma`) — ne départage QUE le cas hors semis. */
  readonly cree_le: Date;
};

/**
 * Le préfixe fixe de tout identifiant de rattachement posé par le semis —
 * `identifiantParc("intervention_machine", rangSociete, rang)`, dont seul le
 * suffixe de douze chiffres varie (`prisma/seed-data.ts`).
 */
export const PREFIXE_RATTACHEMENT_SEED = "0192f0a0-b000-7000-8000-";

/**
 * Le préfixe fixe de tout identifiant d'intervention posé par le semis —
 * `identifiantIntervention(rangSociete, rang)` (`prisma/seed-data.ts`).
 */
export const PREFIXE_INTERVENTION_SEED = "0192f0a0-6000-7000-8000-";

/** Un groupe de doublon : une intervention, la ligne gardée, les lignes retirées. */
export type GroupeDoublon = {
  readonly intervention_id: string;
  readonly gardee: LigneRattachement;
  readonly retirees: readonly LigneRattachement[];
};

/**
 * Le verdict du plan de nettoyage. TROIS états — « rien à faire » ne se
 * confond pas avec « un plan existe », et un état hors du semis connu referme
 * tout plutôt que de choisir à l'aveugle.
 */
export type PlanDeNettoyage =
  | { readonly verdict: "aucun_doublon" }
  | { readonly verdict: "plan"; readonly groupes: readonly GroupeDoublon[] }
  | { readonly verdict: "hors_semis"; readonly ligne: LigneRattachement };

function parPlusPetitId(a: LigneRattachement, b: LigneRattachement): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/** La plus ancienne par `cree_le` d'abord, l'identifiant le plus petit ensuite. */
function parPlusAncienne(a: LigneRattachement, b: LigneRattachement): number {
  const diff = a.cree_le.getTime() - b.cree_le.getTime();
  return diff !== 0 ? diff : parPlusPetitId(a, b);
}

/**
 * L'intervention ET la société appartiennent-elles au jeu de démonstration ?
 * Ne dit rien de la ligne elle-même — un groupe sans ligne du semis peut très
 * bien porter cette intervention-là (DÉCISION du 24/10/2026, ci-dessus).
 */
function interventionDeLaDemo(ligne: LigneRattachement): boolean {
  return (
    ligne.intervention_id.startsWith(PREFIXE_INTERVENTION_SEED) &&
    SOCIETES_DU_SEED.includes(ligne.societe_id)
  );
}

/**
 * Construit le plan de nettoyage à partir des lignes observées.
 *
 * Pure : aucune lecture, aucune écriture. L'appelant garantit que `lignes`
 * vient d'une lecture NON FILTRÉE par les politiques (identité exemptée,
 * `row_security = off`) — sans quoi « aucun doublon » serait un silence, pas
 * une observation.
 */
export function planDeNettoyage(
  lignes: readonly LigneRattachement[],
): PlanDeNettoyage {
  const parIntervention = new Map<string, LigneRattachement[]>();
  for (const ligne of lignes) {
    const groupe = parIntervention.get(ligne.intervention_id) ?? [];
    groupe.push(ligne);
    parIntervention.set(ligne.intervention_id, groupe);
  }

  const interventionsEnDoublon = [...parIntervention.keys()].sort();
  const groupes: GroupeDoublon[] = [];
  for (const intervention_id of interventionsEnDoublon) {
    const groupe = parIntervention.get(intervention_id) ?? [];
    if (groupe.length <= 1) {
      continue;
    }
    const duSemis = groupe
      .filter((ligne) => ligne.id.startsWith(PREFIXE_RATTACHEMENT_SEED))
      .sort(parPlusPetitId);
    if (duSemis.length === 0) {
      const [reference] = groupe;
      if (reference === undefined) {
        continue;
      }
      if (!interventionDeLaDemo(reference)) {
        const [horsSemis] = [...groupe].sort(parPlusPetitId);
        if (horsSemis === undefined) {
          continue;
        }
        return { verdict: "hors_semis", ligne: horsSemis };
      }
      // DÉCISION du 24/10/2026 (ci-dessus) : l'intervention ET la société sont
      // du jeu de démonstration, même si aucune ligne ne porte le préfixe du
      // semis — on garde la première machine posée, on retire les autres.
      const [gardeeDemo] = [...groupe].sort(parPlusAncienne);
      if (gardeeDemo === undefined) {
        continue;
      }
      const retireesDemo = groupe
        .filter((ligne) => ligne.id !== gardeeDemo.id)
        .sort(parPlusPetitId);
      groupes.push({
        intervention_id,
        gardee: gardeeDemo,
        retirees: retireesDemo,
      });
      continue;
    }
    const [gardee] = duSemis;
    if (gardee === undefined) {
      continue;
    }
    const retirees = groupe
      .filter((ligne) => ligne.id !== gardee.id)
      .sort(parPlusPetitId);
    groupes.push({ intervention_id, gardee, retirees });
  }

  if (groupes.length === 0) {
    return { verdict: "aucun_doublon" };
  }
  return { verdict: "plan", groupes };
}

/** Le nombre total de lignes qu'un plan retirerait. */
export function totalARetirer(plan: PlanDeNettoyage): number {
  if (plan.verdict !== "plan") {
    return 0;
  }
  return plan.groupes.reduce((n, g) => n + g.retirees.length, 0);
}

/** Le rapport lu par un humain. « Aucun doublon » est ÉCRIT, jamais un silence. */
export function rapportDoublons(plan: PlanDeNettoyage): string {
  if (plan.verdict === "aucun_doublon") {
    return "Aucun doublon : chaque intervention porte au plus une machine.";
  }
  if (plan.verdict === "hors_semis") {
    return [
      `REFUS : la ligne ${plan.ligne.id} (intervention ${plan.ligne.intervention_id},`,
      `société ${plan.ligne.societe_id}) ne porte pas un identifiant du jeu de`,
      "démonstration (préfixe attendu " +
        `${PREFIXE_RATTACHEMENT_SEED}…). Ce n'est plus la démo telle que le semis`,
      "la connaît : rien n'est proposé, rien ne sera retiré.",
    ].join("\n");
  }
  const lignes = plan.groupes.map((g) => {
    // La gardée porte TOUJOURS le préfixe du semis sauf dans le cas du
    // 24/10/2026 (aucune ligne du groupe ne le porte, l'intervention si) :
    // c'est ce qui distingue les deux décisions sans champ supplémentaire.
    const casDemoSansLigneDuSemis = !g.gardee.id.startsWith(
      PREFIXE_RATTACHEMENT_SEED,
    );
    const retirees = g.retirees
      .map((l) => {
        if (l.id.startsWith(PREFIXE_RATTACHEMENT_SEED)) {
          return l.id;
        }
        return casDemoSansLigneDuSemis
          ? `${l.id} (hors semis sur une intervention du semis — retirée, décision du 24/10/2026)`
          : `${l.id} (posée hors du semis — retirée, décision du 03/10/2026)`;
      })
      .join(", ");
    const gardeeLabel = casDemoSansLigneDuSemis
      ? `${g.gardee.id} (première machine par date de pose, décision du 24/10/2026)`
      : g.gardee.id;
    return (
      `  intervention ${g.intervention_id} (société ${g.gardee.societe_id}) — ` +
      `garder ${gardeeLabel}, retirer ${retirees}`
    );
  });
  return [
    `${plan.groupes.length} intervention(s) avec un doublon de machine :`,
    ...lignes,
    "",
    `Total à retirer : ${totalARetirer(plan)} ligne(s).`,
  ].join("\n");
}
