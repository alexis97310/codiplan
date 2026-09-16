import { randomUUID } from "node:crypto";

import { type Prisma, type PrismaClient } from "@prisma/client";

import { annuaireDesPersonnes, type Designation } from "@/lib/auth/annuaire";
import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  type LigneControlee,
  proposerDepuisLesLignes,
} from "@/lib/excel/controle";

/**
 * LE LOT D'IMPORT, RENDU DURABLE (L1-08e ; I6, D15, D31, D100).
 *
 * ## Pourquoi le lot naît au CONTRÔLE et non à l'application
 *
 * I6 : un import « produit d'abord un rapport, puis attend une validation
 * explicite ». **L'application ne peut appliquer que ce que le rapport a
 * MONTRÉ** — sans quoi la validation porte sur un écran et l'écriture sur autre
 * chose. Le rapport doit donc vivre entre les deux, et le chapitre 11 le disait
 * depuis l'origine sans qu'on l'ait lu ainsi : `import_lot.statut` vaut
 * `controle`, `applique` ou `annule`. *Le lot existe dès le contrôle.*
 *
 * ## Ce module ÉCRIT, il ne décide rien
 *
 * Toute la décision — nature, clé, création ou modification — a été prise par
 * `lib/excel/controle.ts`, qui ne connaît aucune base. Ce module la **pose**,
 * telle quelle. *Recalculer ici quoi que ce soit serait une seconde lecture
 * d'un même critère, qui diverge en silence* (§9, 01/09) — et dans le pire
 * endroit : entre ce qu'un humain a validé à l'écran et ce qui sera écrit.
 *
 * ## Et il ne compare aucune société
 *
 * L'écriture passe par `avecContexteApplicatif`, donc sous le contexte
 * cloisonné : la politique des deux tables est de forme « interne » (D100) —
 * société **et** `app.client_id` absent —, et rien n'est recomparé au-dessus.
 * *Un compte de portail ne peut ni lire ni écrire ici, quel que soit son
 * client, et c'est la base qui le prononce.*
 */

/** Ce que l'appelant sait du fichier, et que le rapport ignore. */
export type Fichier = {
  readonly nom: string;
  /** Le type du marqueur `CODIPLAN-<type>-v<n>` (D31), et sa version. */
  readonly type: string;
  readonly version: number;
};

/**
 * Les décomptes posés sur le lot — et ils viennent de `proposerDepuisLesLignes`,
 * jamais d'un second parcours écrit ici.
 *
 * **Ce module a d'abord porté sa propre boucle de comptage, et c'était la faute
 * du §9 (01/09) écrite une fois de plus** : un même critère implémenté deux
 * fois, dans deux modules légitimes, que rien ne confronte. Elle a été retirée
 * plutôt que gardée par un test d'égalité — *« soit on la remplace par un appel
 * à la première, ce qui est presque toujours possible et presque toujours
 * meilleur, soit on écrit dans le même geste ce qui les confrontera »*. C'est
 * la première branche, et elle ne coûte rien ici.
 *
 * Ce que cette fonction fait encore, et qui lui appartient : **choisir les cinq
 * décomptes que la BASE porte**. La proposition en compte sept — `nonRattachees`
 * et `incompletes` QUALIFIENT des lignes déjà comptées et ne s'additionnent pas
 * (L1-08d) ; les stocker à côté des cinq autres mettrait en base un total
 * supérieur au fichier.
 */
export type Decomptes = {
  readonly creations: number;
  readonly modifications: number;
  readonly rejets: number;
  readonly gabarits: number;
  readonly vides: number;
  /**
   * AJOUTÉ le 16/09/2026 (point 1 de la session du dépassement de délai).
   * **Ce n'est PAS un sixième décompte du même genre que les cinq autres** :
   * ceux-là viennent de `proposerDepuisLesLignes`, une PROPOSITION que le
   * contrôle peut faire sans toucher la base. Celui-ci ne peut pas se
   * proposer — savoir si une fiche va bouger exige de la comparer à ce
   * qu'elle porte déjà en base, et le contrôle ne lit aucune fiche par ligne.
   * Il vaut donc TOUJOURS zéro ici ; seule l'application le mesure
   * (`porteEncore`, `lib/imports/application.ts`) et le pose sur le lot, une
   * fois, en même temps que `statut` et `applique_le`.
   */
  readonly inchangees: number;
};

export function decompter(lignes: readonly LigneControlee[]): Decomptes {
  const proposition = proposerDepuisLesLignes(lignes);
  return {
    creations: proposition.creations,
    modifications: proposition.modifications,
    // `rejets` suit la proposition. Il vaut zéro tant que le CONTRÔLE n'en
    // produit pas — ses anomalies sont situées sur la feuille, jamais portées
    // par une ligne retenue —, et c'est l'APPLICATION qui en produira.
    // *La colonne n'est pas remplie d'un chiffre inventé en attendant.*
    rejets: proposition.rejets,
    gabarits: proposition.gabarits,
    vides: proposition.vides,
    // Zéro au contrôle, TOUJOURS — voir le docblock du type. L'application le
    // réécrit sur le lot ; elle ne relit jamais cette fonction.
    inchangees: 0,
  };
}

/** La ligne, telle qu'elle sera posée en base. */
function enLigneDeBase(
  societeId: string,
  lotId: string,
  ligne: LigneControlee,
): Prisma.ImportLotLigneCreateManyInput {
  return {
    id: randomUUID(),
    societe_id: societeId,
    import_lot_id: lotId,
    rang: ligne.rang,
    action: ligne.action,
    // *Un gabarit et une ligne vide ne portent AUCUNE clé* : leur en inventer
    // une les ferait entrer dans l'espace des clés réelles, où deux lignes
    // muettes deviendraient la même machine (L1-08c). La base tient la même
    // propriété, dans les deux sens.
    cle: ligne.cle?.cle ?? null,
    complete: ligne.cle === undefined ? null : ligne.cle.complet,
    // **LE MOTIF SUIT LE REJET, et la base tient l'équivalence dans les deux
    // sens** (L1-08e). *Cette ligne manquait, et c'est la CONTRAINTE qui l'a
    // dit* — `import_lot_ligne_rejet_a_son_motif`, code 23514, sur le premier
    // rejet réellement enregistré. Le rapport portait le motif depuis L1-08h ;
    // l'enregistrement le jetait, et aucun test ne pouvait le voir avant qu'un
    // rejet traverse la chaîne entière.
    rejet_motif: ligne.rejetMotif ?? null,
    valeurs: ligne.valeurs as Prisma.InputJsonValue,
  };
}

/**
 * Enregistre un rapport de contrôle : le lot, et toutes ses lignes.
 *
 * **Une seule transaction.** Un lot sans ses lignes serait un rapport qui
 * annonce des décomptes et ne montre rien — c'est-à-dire exactement ce que
 * L1-08d a réparé, reconstitué par une écriture à moitié faite.
 *
 * L'identifiant est un UUID engendré ici, comme partout dans ce dépôt (I10) ;
 * `numero` n'existe pas sur ces tables — un lot d'import ne s'affiche pas sous
 * un numéro de société.
 */
export async function enregistrerLeControle(
  contexte: ContexteSession,
  fichier: Fichier,
  lignes: readonly LigneControlee[],
  /**
   * La connexion, quand l'appelant en fournit une. C'est le paramètre que
   * `avecContexteApplicatif` porte déjà, et pour la même raison : *une couche
   * sans appelant ne se garde pas* — le scénario qui traverse la chaîne doit
   * pouvoir l'emprunter contre la base jetable, sans quoi il éprouverait une
   * variante écrite pour lui.
   */
  client?: PrismaClient,
): Promise<{ readonly lotId: string; readonly decomptes: Decomptes }> {
  const lotId = randomUUID();
  const decomptes = decompter(lignes);
  // `exigerSocieteActive` plutôt qu'un test écrit ici : trois écritures d'un
  // même critère avaient déjà divergé sur ce point (§9, 01/09), et la parade
  // est d'appeler la première, jamais d'en écrire une quatrième.
  const societeId = exigerSocieteActive(contexte);

  await avecContexteApplicatif(
    contexte,
    async (tx) => {
      await tx.importLot.create({
        data: {
          id: lotId,
          societe_id: societeId,
          type_import: fichier.type,
          version_modele: fichier.version,
          utilisateur_id: contexte.utilisateurId,
          nom_fichier: fichier.nom,
          lignes_creations: decomptes.creations,
          lignes_modifications: decomptes.modifications,
          lignes_rejets: decomptes.rejets,
          lignes_gabarits: decomptes.gabarits,
          lignes_vides: decomptes.vides,
          lignes_inchangees: decomptes.inchangees,
        },
      });
      if (lignes.length > 0) {
        await tx.importLotLigne.createMany({
          data: lignes.map((ligne) => enLigneDeBase(societeId, lotId, ligne)),
        });
      }
    },
    client,
  );

  return { lotId, decomptes };
}

/* ────────────────────────────────────────────────────────────────────────
 * LA LECTURE DES LOTS (L1-11)
 *
 * **Elle n'existait pas, et c'est pourquoi l'écran n'existait pas.** Ce module
 * savait ÉCRIRE un rapport depuis L1-08e ; rien ne savait le relire. *Une
 * couche qui écrit ce que personne ne relit est une couche dont on ne peut pas
 * dire si elle écrit juste.*
 *
 * **Aucune comparaison de société n'est écrite ici non plus** : les deux tables
 * sont de forme « interne » (D100), la lecture passe par
 * `avecContexteApplicatif`, et un lot d'une autre société est simplement
 * ABSENT. *Rendre « interdit » plutôt qu'« introuvable » ferait un oracle*
 * (D35, D50) — et c'est déjà le choix que `appliquerLeLotDeClients` a fait.
 * ──────────────────────────────────────────────────────────────────────── */

/** Un lot tel que la LISTE le montre : jamais ses lignes, qui sont des milliers. */
export type LotEnListe = {
  readonly id: string;
  /**
   * QUI a importé, avec la SOMME qui dit pourquoi un nom manque.
   *
   * *Une `Map` n'a qu'une façon de ne pas répondre* : l'écran du planning
   * confondait le refus du cloisonnement avec son propre oubli, et
   * `lib/auth/annuaire.ts` a été écrit pour les séparer (14/09/2026). La même
   * confusion serait ici : un lot importé par quelqu'un d'une autre société
   * n'existe pas, mais un compte SUPPRIMÉ depuis, si. **La résolution se fait
   * DANS la transaction cloisonnée**, seul endroit où la politique parle.
   */
  readonly auteur: Designation;
  readonly nomFichier: string;
  readonly typeImport: string;
  /**
   * La version du gabarit contrôlé — AJOUTÉ le 16/09/2026, pour que le
   * fichier annoté des rejets (RG-IMP-03) puisse reposer le même marqueur
   * `CODIPLAN-<type>-v<n>` qu'un gabarit publié, et rester rechargeable.
   */
  readonly versionModele: number;
  readonly statut: string;
  readonly controleLe: Date;
  readonly appliqueLe: Date | null;
  readonly annuleLe: Date | null;
  readonly decomptes: Decomptes;
};

/** Une ligne du rapport, telle que l'écran la montre. */
export type LigneDeLot = {
  readonly rang: number;
  readonly action: string;
  readonly cle: string | null;
  readonly rejetMotif: string | null;
  readonly valeurs: Prisma.JsonValue;
};

export type LotDetaille = LotEnListe & {
  readonly lignes: readonly LigneDeLot[];
};

function enListe(
  lot: {
    id: string;
    nom_fichier: string;
    type_import: string;
    version_modele: number;
    statut: string;
    controle_le: Date;
    applique_le: Date | null;
    annule_le: Date | null;
    lignes_creations: number;
    lignes_modifications: number;
    lignes_rejets: number;
    lignes_gabarits: number;
    lignes_vides: number;
    lignes_inchangees: number;
    utilisateur_id: string;
  },
  auteur: Designation,
): LotEnListe {
  return {
    id: lot.id,
    auteur,
    nomFichier: lot.nom_fichier,
    typeImport: lot.type_import,
    versionModele: lot.version_modele,
    statut: lot.statut,
    controleLe: lot.controle_le,
    appliqueLe: lot.applique_le,
    annuleLe: lot.annule_le,
    // Les décomptes viennent de la BASE, où le rapport les a posés — jamais
    // d'un second parcours des lignes. *Deux lectures d'un même critère
    // divergent en silence* (§9, 01/09), et ici la seconde serait affichée à
    // côté de la première, sans qu'on sache laquelle croire.
    decomptes: {
      creations: lot.lignes_creations,
      modifications: lot.lignes_modifications,
      rejets: lot.lignes_rejets,
      gabarits: lot.lignes_gabarits,
      vides: lot.lignes_vides,
      inchangees: lot.lignes_inchangees,
    },
  };
}

/**
 * LE TYPE D'UN LOT, ET RIEN D'AUTRE (R6-01).
 *
 * **La route en a besoin AVANT de choisir quoi appeler**, et `lireLeLot`
 * rendrait pour cela toutes les lignes du rapport — plusieurs centaines sur un
 * classeur réel — dont elle n'a que faire.
 *
 * **`null` couvre deux cas, et c'est voulu** : le lot n'existe pas, ou il
 * appartient à une autre société et la politique le cache. *Les distinguer
 * ferait un oracle* (D35, D50) — et la route rend donc le MÊME refus que pour
 * un lot introuvable, exactement comme l'application le fait déjà.
 */
export async function typeDuLot(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<string | null> {
  const lot = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.importLot.findUnique({
        where: { id },
        select: { type_import: true },
      }),
    client,
  );
  return lot?.type_import ?? null;
}

/** Les lots de la société active, du plus récent au plus ancien. */
export async function listerLesLots(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly LotEnListe[]> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const lots = await tx.importLot.findMany({
        orderBy: { controle_le: "desc" },
        // Une BORNE, et elle est écrite : un import par semaine pendant deux
        // ans fait cent lots, et un écran qui les rend tous devient illisible
        // avant de devenir lent. *Ce n'est pas une pagination — c'est l'aveu
        // qu'il n'y en a pas encore*, et la liste dit combien elle montre.
        take: PLAFOND_LISTE,
      });
      const annuaire = await annuaireDesPersonnes(
        tx,
        lots.map((lot) => lot.utilisateur_id),
      );
      return lots.map((lot) => enListe(lot, annuaire(lot.utilisateur_id)));
    },
    client,
  );
}

/**
 * Le PLAFOND de la liste. *Un nombre écrit une fois, et lisible par l'écran
 * qui doit dire « les N derniers ».*
 */
export const PLAFOND_LISTE = 50;

/**
 * UN lot et ses lignes, ou `null`.
 *
 * **`null` couvre deux cas que rien ne distingue ici, et c'est voulu** : le lot
 * n'existe pas, ou il appartient à une autre société et la politique le cache.
 * *Les distinguer ferait un oracle* (D35, D50).
 */
export async function lireLeLot(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<LotDetaille | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const lot = await tx.importLot.findUnique({
        where: { id: lotId },
        include: { lignes: { orderBy: { rang: "asc" } } },
      });
      if (lot === null) {
        return null;
      }
      const annuaire = await annuaireDesPersonnes(tx, [lot.utilisateur_id]);
      return {
        ...enListe(lot, annuaire(lot.utilisateur_id)),
        lignes: lot.lignes.map((ligne) => ({
          rang: ligne.rang,
          action: ligne.action,
          cle: ligne.cle,
          rejetMotif: ligne.rejet_motif,
          valeurs: ligne.valeurs,
        })),
      };
    },
    client,
  );
}
