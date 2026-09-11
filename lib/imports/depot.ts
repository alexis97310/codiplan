import { randomUUID } from "node:crypto";

import { type Prisma, type PrismaClient } from "@prisma/client";

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
