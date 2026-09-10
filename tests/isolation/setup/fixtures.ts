import type { Role } from "@/lib/auth/roles";
import {
  anneeCourante,
  cleJour,
  jourSemaineIso,
  jourSuivant,
  lireCleJour,
  LUNDI,
  type JourLocal,
} from "@/lib/calendar";

/**
 * Données déterministes et briques SQL partagées par le harnais d'isolation
 * (ticket L0-05). Aucune donnée de production (I9) : deux sociétés fictives et
 * leurs objets, tous en identifiants fixes lisibles.
 *
 * Les tables `client`, `site`, `machine`, `modele_materiel` sont des FIXTURES
 * « contrat » : les vraies tables métier arrivent aux lots 1 et 2. Elles portent
 * exactement la même politique de cloisonnement que les tables réelles et
 * modèlent les chemins que L0-05 doit obligatoirement couvrir — résolution QR
 * inter-société (D22), accès portail à un autre client et respect du périmètre
 * de sites (D10).
 *
 * **Ce contrat n'est plus un commentaire** (ticket R0-a, écart É14) : il est
 * déclaré dans `contrat.ts` et tenu par trois gardiens indépendants — la forme
 * des politiques mesurée dans `pg_policies`, la liste close `TABLES_PARC`, et
 * le plancher de scénarios par exigence de L0-05. Une réparation qui
 * remplacerait la fixture par une vraie table à politique société seule fait
 * désormais rougir quelque chose, au lieu de passer inaperçue.
 */

/**
 * Rôle PostgreSQL non propriétaire, non-BYPASSRLS, sous lequel tournent les
 * scénarios. Ce n'est pas un rôle de test : c'est LE rôle applicatif, créé par
 * la migration `20260820130000_force_rls_role_applicatif`. Les scénarios
 * éprouvent donc les droits réellement accordés en production.
 */
export const ROLE_APP = "codiplan_app";

/**
 * Rôle PostgreSQL de consolidation (D21) — BYPASSRLS, SELECT seul, créé par la
 * migration `20260820150000_authentification_et_roles`. Éprouvé tel quel, comme
 * `codiplan_app` : les scénarios portent sur les droits réels, pas sur une
 * imitation.
 */
export const ROLE_REPORTING = "codiplan_reporting";

/**
 * Variables de session et constructeurs de politique : ils vivent désormais
 * dans `contrat.ts`, avec le CONTRAT que les vraies tables devront honorer
 * (ticket R0-a, écart É14). Ils sont réexportés ici pour que les scénarios
 * n'aient pas à savoir lequel des deux fichiers les porte.
 */
export {
  VAR_SOCIETE,
  VAR_ROLE,
  VAR_CLIENT,
  VAR_PERIMETRE,
  politiqueCloisonnementSql,
  politiqueParcSql,
} from "./contrat";

/** Sociétés A et B — cloisonnées l'une de l'autre. UUID v7 bien formés. */
export const SOCIETE_A = "aaaaaaaa-0000-7000-8000-000000000001";
export const SOCIETE_B = "bbbbbbbb-0000-7000-8000-000000000002";

/**
 * Chartes fixtures (L0-09). Les deux sociétés portent des couleurs
 * DISTINCTES : sans cela, « le thème appliqué est celui de la société active »
 * serait vert même si le code lisait toujours la même ligne.
 *
 * La charte de B est volontairement CLAIRE côté accentuation : son encre
 * calculée est noire là où celle de A est blanche, si bien qu'une bascule
 * change non seulement les fonds mais aussi les encres.
 */
export const CHARTE_A = { primaire: "#0b5cad", accent: "#f4a300" } as const;
export const CHARTE_B = { primaire: "#7a1f3d", accent: "#c9f2d8" } as const;

/** Clients (fixture). A1 et A2 appartiennent à la société A ; B1 à la société B. */
export const CLIENT_A1 = "aaaaaaaa-0000-7000-8000-0000000000c1";
export const CLIENT_A2 = "aaaaaaaa-0000-7000-8000-0000000000c2";
export const CLIENT_B1 = "bbbbbbbb-0000-7000-8000-0000000000c1";

/** Sites (fixture). Deux sites pour le client A1, un pour B1. */
export const SITE_A1_S1 = "aaaaaaaa-0000-7000-8000-00000000551a";
export const SITE_A1_S2 = "aaaaaaaa-0000-7000-8000-00000000551b";
/** Un site du client A2 — MÊME société que A1. Sans lui, l'épreuve de la clé
 * triple (société, client, site) ne pourrait pas distinguer « autre client » de
 * « autre société », et prouverait la mauvaise chose. */
export const SITE_A2_S1 = "aaaaaaaa-0000-7000-8000-00000000552a";
export const SITE_B1_S1 = "bbbbbbbb-0000-7000-8000-00000000551a";

/** Machines (fixture) et leurs jetons QR (uniques globalement, D22). */
/**
 * LES INTERVENTIONS DU HARNAIS (lot 2, D84).
 *
 * Trois, choisies pour que les TROIS filtres de la forme « parc » se séparent :
 * `INTERVENTION_A1` est du client A1 sur le site du périmètre — la seule qu'un
 * compte portail restreint doit voir ; `INTERVENTION_A2` est du MÊME client sur
 * un AUTRE site, et c'est elle qui prouve que le filtre de périmètre mord ;
 * `INTERVENTION_B1` est d'une autre société.
 */
export const INTERVENTION_A1 = "aaaaaaaa-0000-7000-8000-0000000000f1";
export const INTERVENTION_A2 = "aaaaaaaa-0000-7000-8000-0000000000f2";
export const INTERVENTION_B1 = "bbbbbbbb-0000-7000-8000-0000000000f1";

export const MACHINE_A1 = "aaaaaaaa-0000-7000-8000-0000000000a1";
export const MACHINE_A2 = "aaaaaaaa-0000-7000-8000-0000000000a2";
export const MACHINE_B1 = "bbbbbbbb-0000-7000-8000-0000000000b1";
/**
 * LES JETONS QR DES FIXTURES — fixes, et de la FORME que la production produit.
 *
 * ## Ils ont eu trois valeurs en une journée, et la troisième est la bonne
 *
 * `"qr-token-machine-a1"` d'abord — une chaîne qu'aucun chemin de production ne
 * peut produire. Puis `jetonDeMachine(MACHINE_A1)`, quand le jeton se dérivait.
 * Puis `engendrerJetonQr()` quand il est devenu un secret (D71) — **et cette
 * troisième version était FAUSSE**, pour une raison qui n'a rien à voir avec le
 * cloisonnement : `globalSetup` et les fichiers de scénarios n'exécutent pas la
 * même instance de ce module. Chacun tirait ses propres jetons, et rien de ce
 * qui était semé n'était retrouvé. *Une valeur aléatoire au niveau d'un module
 * n'est stable que dans un processus.*
 *
 * ## Pourquoi des littéraux, et pourquoi ce n'est PAS un affaiblissement
 *
 * J'avais écrit qu'un jeton figé « redeviendrait une valeur que le dépôt
 * connaît, donc un jeton qui n'éprouve pas ce qu'on veut éprouver ». C'était
 * une confusion : **la propriété « le jeton est un secret » est celle du
 * GÉNÉRATEUR**, et elle s'éprouve sur lui — `tests/unit/machines/qr.test.ts`
 * mesure qu'il ne se répète jamais, que les 32 caractères sortent tous, et que
 * la dérivation rétablie fait rougir cinq scénarios. Ce que les fixtures
 * doivent être, c'est **stables et de la bonne forme** : ce sont des jetons
 * déjà stockés, exactement ce que la résolution rencontre en base.
 *
 * Ils portent donc 26 caractères de l'alphabet base32, comme la production les
 * tire, et `tests/isolation/resolution-qr.test.ts` le vérifie plutôt que de le
 * supposer.
 */
export const QR_A1 = "K7QMZ4TXWB2NRJ5FHCV3PDGSA6";
export const QR_A2 = "P3XNVB7KQZ4MRT2WJFHD5CGSA6";
export const QR_B1 = "W5ZJQ2NRTKB7XMVP4HFDC3GSA6";

/** Modèles matériel (fixture) — référentiel plateforme surchargeable (D4). */
/**
 * Familles et modèles de matériel — RÉELS depuis L1-05, plus fixtures.
 *
 * Les trois identifiants d'avant modelaient le schéma « plateforme + surcharge »
 * que l'amendement à D4 a RETIRÉ le 08/09/2026 : `MODELE_PLATEFORME` portait
 * `societe_id NULL`, et les deux autres étaient ses copies masquantes. Il n'y a
 * plus de ligne sans société — chaque société a les siennes, et c'est tout ce
 * qu'il y a à éprouver.
 */
export const FAMILLE_A = "aaaaaaaa-0000-7000-8000-0000000000f0";
export const FAMILLE_B = "bbbbbbbb-0000-7000-8000-0000000000f0";
export const MODELE_A = "aaaaaaaa-0000-7000-8000-0000000000f1";
export const MODELE_B = "bbbbbbbb-0000-7000-8000-0000000000f2";

/** Agences (fixture d'isolation, distinctes du seed applicatif). */
export const AGENCE_A = "aaaaaaaa-0000-7000-8000-0000000000e1";
export const AGENCE_B = "bbbbbbbb-0000-7000-8000-0000000000e2";

/** Calendriers d'ouverture des deux agences (L0-08, D5, D13). */
export const CALENDRIER_A = "aaaaaaaa-0000-7000-8000-0000000000ca";
export const CALENDRIER_B = "bbbbbbbb-0000-7000-8000-0000000000cb";
export const PLAGE_A = "aaaaaaaa-0000-7000-8000-0000000000c5";
export const PLAGE_B = "bbbbbbbb-0000-7000-8000-0000000000c6";

/**
 * Fuseaux des deux sociétés fixtures.
 *
 * **L'agence B surcharge le sien pour valoir CELUI DE L'AGENCE A** (D5), alors
 * que leurs TERRITOIRES diffèrent. La fixture est délibérément adversaire :
 * deux agences qui partagent une heure et pas un calendrier de fêtes. Tout
 * code qui déduirait le territoire du fuseau — ou l'inverse — tomberait ici,
 * et non chez un client d'Alsace-Moselle deux ans plus tard (D46,
 * complément 1).
 */
export const FUSEAU_SOCIETE_A = "Pacific/Noumea";
export const FUSEAU_SOCIETE_B = "Europe/Paris";
export const FUSEAU_AGENCE_B = FUSEAU_SOCIETE_A;

/**
 * Territoires fictifs, en codes ISO 3166-1 alpha-2 **réservés à l'usage
 * privé** (`ZZ`, `XA`) : la norme garantit qu'aucun pays ne les portera jamais.
 * Un jeu de test ne doit désigner aucun territoire réel (I9), et la forme reste
 * celle que `jour_ferie` exige — deux lettres majuscules.
 */
export const TERRITOIRE_A = "ZZ";
export const TERRITOIRE_B = "XA";

/** Écarts locaux de l'agence A — un férié travaillé, et un pont. */
export const SURCHARGE_FERIE_A = "aaaaaaaa-0000-7000-8000-0000000000c7";
export const PONT_FIXTURE_A = "aaaaaaaa-0000-7000-8000-0000000000c8";

/**
 * Un compte par rôle canonique (L0-06). Les identifiants portent le rang du
 * rôle dans l'énumération, pour rester lisibles à la lecture d'un échec.
 *
 * Les six rôles internes — `admin_societe` compris depuis D37 — sont habilités
 * sur la société A. Les trois rôles
 * éditeur ne le sont sur AUCUNE société : c'est le principe du §22.5 — « un
 * salarié de l'éditeur n'a aucun accès par défaut aux données d'un client » —,
 * et c'est ce qui rend leur scénario négatif réel plutôt que théorique. Le rôle
 * `client` est rattaché au client A1 par `utilisateur_client` (D10).
 */
export const UTILISATEUR_PAR_ROLE: Readonly<Record<Role, string>> = {
  admin_plateforme: "00000000-0000-7000-8000-000000000701",
  editeur_commercial: "00000000-0000-7000-8000-000000000702",
  editeur_support: "00000000-0000-7000-8000-000000000703",
  admin_societe: "aaaaaaaa-0000-7000-8000-00000000070a",
  direction: "aaaaaaaa-0000-7000-8000-000000000704",
  responsable_materiel: "aaaaaaaa-0000-7000-8000-000000000705",
  responsable_sav: "aaaaaaaa-0000-7000-8000-000000000706",
  adv: "aaaaaaaa-0000-7000-8000-000000000707",
  technicien: "aaaaaaaa-0000-7000-8000-000000000708",
  client: "aaaaaaaa-0000-7000-8000-000000000709",
};

/**
 * UN NOM QUI DISAIT L'INVERSE DE CE QU'IL TENAIT — corrigé le 09/09/2026 (D70).
 *
 * `UTILISATEUR_PORTAIL_A` désignait le compte **interne** : « Interne A »,
 * `interne-a@iso.test`, rôle `adv` dans `utilisateur_societe`, et **zéro** ligne
 * dans `utilisateur_client` (mesuré). Le compte portail, lui, s'appelait
 * `PORTAIL_A_CLIENT`.
 *
 * Ce que le nom a coûté : `categorie-authentification.test.ts` armait un
 * contexte de rôle `client` **sur le compte interne**, c'est-à-dire un contexte
 * qui ne peut pas exister en production. Personne ne l'a vu pendant un ticket
 * entier — jusqu'à ce que la validation de D70 le refuse.
 *
 * *Un nom de fixture affirme une propriété ; rien ne le confrontait à la
 * donnée.* `tests/isolation/fixtures-conformes.test.ts` le fait désormais.
 */
export const UTILISATEUR_INTERNE_A = "aaaaaaaa-0000-7000-8000-0000000000d1";
export const UTILISATEUR_INTERNE_B = "bbbbbbbb-0000-7000-8000-0000000000d2";

/** Comptes PORTAIL (une ligne dans `utilisateur_client`, jamais dans `utilisateur_societe`). */
export const PORTAIL_A_CLIENT = "aaaaaaaa-0000-7000-8000-0000000000d3";
export const PORTAIL_B_CLIENT = "bbbbbbbb-0000-7000-8000-0000000000d4";

/**
 * Un compte portail du client A2 — le VOISIN, dans la MÊME société (L1-02b).
 *
 * Sans lui, la forme « habilitation » serait indémontrable : il n'y aurait rien
 * d'autre à voir que sa propre ligne, et un scénario qui ne voit qu'une ligne
 * là où il n'en existe qu'une ne prouve rien. C'est le témoin de non-vacuité de
 * la fuite mesurée le 07/09/2026.
 */
export const PORTAIL_A2_CLIENT = "aaaaaaaa-0000-7000-8000-0000000000d6";

/**
 * Un compte portail rattaché à DEUX sociétés — le cas de RG-SOC-03, côté client.
 *
 * *Une même personne travaille légitimement pour deux sociétés*, et cela vaut
 * pour un contact client autant que pour un salarié : le même acheteur peut
 * suivre un parc chez CODIMA-NC et un autre chez CODIMA-EU. Sans cette fixture,
 * la question « un compte portail atteint-il les écrans de ses DEUX sociétés ? »
 * ne se mesurerait sur rien — et un scénario qui ne voit qu'une société là où
 * il n'en existe qu'une ne prouve rien (le témoin de non-vacuité de D92).
 */
export const PORTAIL_DEUX_SOCIETES = "aaaaaaaa-0000-7000-8000-0000000000d7";

/** L'entrée de périmètre du compte portail A1 : le site S1, et lui seul. */
export const PERIMETRE_A1_S1 = "aaaaaaaa-0000-7000-8000-0000000000e1";

/**
 * Deux contacts du client A1 (L1-03), et c'est leur COUPLE qui démontre.
 *
 * `CONTACT_A1_COMPTABLE` n'a AUCUN site : c'est un contact du client.
 * `CONTACT_A1_ATELIER` est rattaché à `SITE_A1_S2`, hors du périmètre du compte
 * portail. Un seul des deux disparaît pour ce compte — et si les deux
 * disparaissaient, on aurait perdu le comptable en restreignant un atelier.
 */
export const CONTACT_A1_COMPTABLE = "aaaaaaaa-0000-7000-8000-0000000000f1";
export const CONTACT_A1_ATELIER = "aaaaaaaa-0000-7000-8000-0000000000f2";

/**
 * Jours fériés fictifs des deux territoires, sur un **horizon glissant**
 * (D46, complément 3).
 *
 * Trois années à partir de l'année en cours, deux fériés par an. L'horizon est
 * calculé, jamais écrit : une fixture figée à des dates passées ferait échouer
 * `scripts/horizon-feries.mts` un jour de janvier, sans que personne comprenne
 * pourquoi — et ce contrôle-là a précisément pour objet de refuser les données
 * périmées. Il s'exécute à chaque `verify:full` sur cette base.
 *
 * Les deux fériés tombent un LUNDI, seul jour où les calendriers fixtures
 * ouvrent : c'est ce qui permet d'éprouver « un férié travaillé compte comme
 * ouvré » (RG-PLA-02) sur une date réelle plutôt que théorique.
 */
export const ANNEE_FIXTURE = anneeCourante(FUSEAU_SOCIETE_A);

/** Les trois années couvertes — l'année en cours et les deux suivantes. */
export const ANNEES_FIXTURE = [0, 1, 2].map(
  (decalage) => ANNEE_FIXTURE + decalage,
);

/** Premier lundi du mois indiqué, en clé `AAAA-MM-JJ`. */
function premierLundi(annee: number, mois: number): string {
  let jour: JourLocal = { annee, mois, jour: 1 };
  while (jourSemaineIso(jour) !== LUNDI) {
    jour = jourSuivant(jour);
  }
  return cleJour(jour);
}

/** Un férié fictif du jeu d'isolation : sa date et son libellé. */
export type FerieFixture = { date: string; libelle: string };

/**
 * Les fériés d'un territoire fixture, sur l'horizon glissant. Le premier lundi
 * de juin et celui de décembre : deux dates par an, dont la dernière garantit
 * plus de douze mois d'avance en toute saison.
 */
export function feriesFixture(territoire: string): FerieFixture[] {
  return ANNEES_FIXTURE.flatMap((annee) => [
    {
      date: premierLundi(annee, 6),
      libelle: `Férié fictif de juin ${territoire}`,
    },
    {
      date: premierLundi(annee, 12),
      libelle: `Férié fictif de décembre ${territoire}`,
    },
  ]);
}

/**
 * Le férié que l'AGENCE A travaille : le premier de son territoire sur
 * l'horizon. C'est l'écart local de D46, complément 2 — le fait public dit
 * « férié », l'agence dit « on travaille », et l'ordre ne s'inverse pas.
 */
export const FERIE_TRAVAILLE_A = feriesFixture(TERRITOIRE_A)[0] as FerieFixture;

/**
 * Le PONT de l'agence A : un jour ordinaire qu'elle chôme, sans aucun férié en
 * face. Seconde forme d'écart local, et la seule qui ne s'adosse à aucun fait
 * public. Posé le lundi suivant le férié travaillé — donc un jour où le
 * calendrier ouvre, sans quoi le pont ne retirerait rien.
 */
export const PONT_A = cleJour(
  jourSuivant(lireCleJour(FERIE_TRAVAILLE_A.date), 7),
);
