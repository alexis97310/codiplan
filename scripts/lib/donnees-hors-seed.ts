import { SOCIETES } from "../../prisma/seed-data";

/**
 * LA BASE PORTE-T-ELLE UNE DONNÉE QUI NE VIENT PAS DU SEED ? (N1, borne 3)
 *
 * ## LA BORNE QUI PROTÉGERA LE JOUR OÙ PERSONNE NE S'EN SOUVIENDRA
 *
 * L'amendement du §12 laisse une migration atteindre la base de démonstration
 * **sans main**. Cela ne coûte rien tant que cette base ne porte que des
 * fictions ; cela coûterait tout le jour où une donnée réelle y entrerait —
 * *et ce jour-là, personne ne se souviendra de cette décision.* Ce contrôle est
 * ce qui s'en souviendra à sa place.
 *
 * **Le critère n'est pas inventé ici : le §9 du 30/08 l'avait déjà nommé.** En
 * refusant de reporter le partitionnement du journal, il écrivait que le
 * déclencheur aurait été *« gardable »* parce que *« le contrôle de
 * cloisonnement énumère déjà les sociétés à chaque migration, il aurait suffi
 * qu'il échoue dès qu'une société hors démonstration apparaît »*. C'est
 * exactement cela, écrit un an plus tôt pour une autre raison.
 *
 * ## POURQUOI LA SOCIÉTÉ, ET RIEN D'AUTRE
 *
 * Toute table métier porte `societe_id NOT NULL` (I1, première catégorie) :
 * **une ligne réelle suppose une société qui la porte**, et un vrai client
 * reçoit sa société — c'est le produit lui-même (RG-SOC). Les identifiants du
 * jeu de démonstration sont FIXES (`prisma/seed-data.ts`, deux UUID écrits) :
 * la comparaison est donc une différence d'ensembles, pas une heuristique, pas
 * une ressemblance de nom.
 *
 * ## CE QUE CE CONTRÔLE NE VOIT PAS, ET C'EST ÉCRIT PLUTÔT QUE TU
 *
 * **Une ligne réelle écrite À L'INTÉRIEUR d'une société de démonstration lui
 * échappe.** C'est la borne acceptée, et elle se dit plutôt qu'elle ne se
 * devine : écrire les machines d'un vrai client dans « CODIMA
 * Nouvelle-Calédonie » n'est pas le chemin par lequel une base devient réelle,
 * et un critère qui prétendrait l'attraper — un nom, un domaine de courriel, un
 * volume — rendrait des fausses alertes sur l'usage ordinaire de la base de
 * démonstration, jusqu'à ce que plus personne ne le lise (§9, 11/09).
 *
 * *La question à poser à ce contrôle : si la faute que je surveille était
 * commise à l'instant, ce verdict changerait-il ?* Oui — une société de plus, et
 * il refuse. C'est ce qui le distingue d'une ligne de rapport qui ne bouge pas.
 */

/** Les identifiants que `prisma/seed.ts` écrit, et eux seuls. */
export const SOCIETES_DU_SEED: readonly string[] = SOCIETES.map((s) => s.id);

/** Une société telle que la base la rend. */
export type SocieteObservee = {
  readonly id: string;
  readonly code: string;
  readonly raison_sociale: string;
};

/**
 * Le verdict. TROIS valeurs, et la troisième est celle qu'on oublie : n'avoir
 * rien observé n'est pas « la base est saine ». *Un décompte nul ressemble
 * toujours à un sans-faute* (§9, 30/08) — et une base vide de sociétés est un
 * état légitime (une base neuve avant tout seed), qu'il faut pouvoir
 * distinguer d'une lecture filtrée par les politiques.
 */
export type VerdictHorsSeed =
  | { readonly verdict: "seed_seul"; readonly societes: readonly string[] }
  | {
      readonly verdict: "donnees_reelles";
      readonly etrangeres: readonly SocieteObservee[];
    }
  | { readonly verdict: "rien_observe" };

/**
 * Confronte ce que la base porte à ce que le seed écrit.
 *
 * La fonction ne LIT rien — ni base, ni horloge. L'appelant fournit ce qu'il a
 * observé **sous une identité exemptée**, et c'est cette séparation qui rend le
 * critère éprouvable sans base fabriquée.
 */
export function verdictHorsSeed(
  observees: readonly SocieteObservee[],
): VerdictHorsSeed {
  if (observees.length === 0) {
    return { verdict: "rien_observe" };
  }
  const duSeed = new Set(SOCIETES_DU_SEED);
  const etrangeres = observees.filter((s) => !duSeed.has(s.id));
  if (etrangeres.length > 0) {
    return { verdict: "donnees_reelles", etrangeres };
  }
  return { verdict: "seed_seul", societes: observees.map((s) => s.id) };
}

/** Le rapport lu par un humain. Chaque ligne dit d'où elle vient. */
export function rapportHorsSeed(verdict: VerdictHorsSeed): string {
  const entete = [
    "La base ne porte-t-elle que le jeu de démonstration ?",
    "",
    `Sociétés écrites par le seed (dépôt) : ${SOCIETES_DU_SEED.join(", ")}`,
    "",
  ];
  if (verdict.verdict === "rien_observe") {
    return [
      ...entete,
      "VERDICT : RIEN OBSERVÉ — aucune société n'a été lue.",
      "",
      "Ce n'est PAS « la base est saine ». Une base neuve avant tout seed rend",
      "ce verdict, et une lecture filtrée par les politiques AUSSI. Le refus",
      "est donc prononcé : une migration automatique ne part pas sur un doute.",
    ].join("\n");
  }
  if (verdict.verdict === "donnees_reelles") {
    return [
      ...entete,
      `VERDICT : ${verdict.etrangeres.length} société(s) HORS SEED (observées en base).`,
      "",
      ...verdict.etrangeres.map(
        (s) => `  ${s.id}  ${s.code}  ${s.raison_sociale}`,
      ),
      "",
      "Cette base ne porte plus seulement des fictions. L'exécution AUTOMATIQUE",
      "est refusée : la migration reste à jouer à la main, par quelqu'un qui",
      "aura regardé ce que ces lignes sont. C'est la borne 3 de l'amendement du",
      "§12, et elle n'a pas de dérogation.",
    ].join("\n");
  }
  return [
    ...entete,
    `VERDICT : SEED SEUL — ${verdict.societes.length} société(s) observée(s), toutes du jeu de démonstration.`,
    "",
    "L'exécution automatique est autorisée.",
  ].join("\n");
}
