import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";

import {
  annulerLeLotDeClients,
  annulerLeLotDeEquipements,
  annulerLeLotDeFamilles,
  annulerLeLotDeModeles,
  annulerLeLotDePrestations,
  annulerLeLotDeSites,
  type ResultatAnnulation,
} from "./annulation";
import {
  appliquerLeLotDeClients,
  appliquerLeLotDeEquipements,
  appliquerLeLotDeFamilles,
  appliquerLeLotDeModeles,
  appliquerLeLotDePrestations,
  appliquerLeLotDeSites,
  type ResultatApplication,
} from "./application";

/**
 * CE QU'ON SAIT FAIRE D'UN LOT, SELON SON TYPE (R6-01 ; I6, L1-08i).
 *
 * ## La table que L1-08i refusait, et pourquoi celle-ci n'est pas elle
 *
 * L1-08i écrivait, en n'ayant qu'un seul type sous les yeux :
 *
 * > *« Une fonction “applique n'importe quel lot” devrait tenir une table de
 * > correspondance entre un type d'import et une écriture, c'est-à-dire une
 * > liste close de plus, tenue à la main, que le prochain type oublierait. Le
 * > jour où un second type existe, la question se posera avec deux exemplaires
 * > sous les yeux plutôt qu'avec aucun. »*
 *
 * **Ce jour est arrivé, et la question se pose avec cinq exemplaires.** Le
 * raisonnement tenait par sa seconde moitié — *« que le prochain type
 * oublierait »* —, et c'est cette moitié-là qu'on ferme : **la table existe,
 * elle est nécessaire dès qu'une route doit CHOISIR, et elle n'est pas tenue à
 * la main.**
 *
 * `tests/unit/imports/types-dimport.test.ts` exige, contre deux sources que ce
 * fichier ne contrôle pas :
 *
 * 1. que `APPLICATIONS ∪ SANS_APPLICATION` soit **exactement** `TYPES_PUBLIES`,
 *    lui-même dérivé des constructeurs de gabarits — *un sixième gabarit écrit
 *    demain fait rougir `pnpm verify` le jour même, dans les deux sens* ;
 * 2. que les clés d'`APPLICATIONS` soient **exactement** les fonctions
 *    `appliquerLeLotDe<Type>` que les sources de `lib/imports/` portent.
 *
 * *Ce n'est donc pas une liste close de plus : c'est une ASSERTION sur des
 * listes dont aucune n'appartient à ce fichier* (§9, 01/09).
 *
 * ## Un type sans application est un ÉTAT, jamais une exception
 *
 * `SANS_APPLICATION` nomme ce qu'on ne sait pas écrire **et pourquoi** — la
 * forme des `CHAMPS_*_ECARTES` de `modeles.ts`, reprise telle quelle : *un
 * champ écarté sans motif est un champ oublié, et rien ne les distingue.*
 *
 * **Ce que cet état produit à l'écran est l'absence du bouton**, jamais un
 * refus après coup : *un bouton « Appliquer » qui échoue se lit comme une
 * panne*, et le refus serait attribué au fichier plutôt qu'au produit.
 */

export type ApplicationDeLot = {
  readonly appliquer: (
    contexte: ContexteSession,
    lotId: string,
    client?: PrismaClient,
  ) => Promise<ResultatApplication>;
  readonly annuler: (
    contexte: ContexteSession,
    lotId: string,
    client?: PrismaClient,
  ) => Promise<ResultatAnnulation>;
};

/**
 * LES TYPES QU'ON SAIT ÉCRIRE — et l'annulation va avec l'application.
 *
 * **Les deux ne se séparent jamais**, et le type l'impose : *une application
 * sans annulation livrerait la moitié de I6* — « l'annulation est partielle et
 * sûre » n'est pas une option du produit, et un lot qu'on sait appliquer sans
 * savoir le défaire est un lot qu'il ne fallait pas appliquer.
 */
export const APPLICATIONS: Readonly<Record<string, ApplicationDeLot>> = {
  clients: {
    appliquer: appliquerLeLotDeClients,
    annuler: annulerLeLotDeClients,
  },
  sites: { appliquer: appliquerLeLotDeSites, annuler: annulerLeLotDeSites },
  modeles: {
    appliquer: appliquerLeLotDeModeles,
    annuler: annulerLeLotDeModeles,
  },
  prestations: {
    appliquer: appliquerLeLotDePrestations,
    annuler: annulerLeLotDePrestations,
  },
  familles: {
    appliquer: appliquerLeLotDeFamilles,
    annuler: annulerLeLotDeFamilles,
  },
  // **`appliquerLeLotDeEquipements`, et l'élision n'est PAS faite** — ce n'est
  // pas une faute d'inattention. Le gardien DÉRIVE le type du nom de la
  // fonction, par le motif `appliquerLeLotDe(\w+)` : écrire
  // `appliquerLeLotDÉquipements` le rendrait aveugle à cette ligne, et il
  // faudrait élargir la population d'un gardien qui garde `pnpm verify` pour
  // gagner une apostrophe. *Un identifiant est lu par une machine et par un
  // développeur* (L0-11) ; le libellé qu'un humain lit est au dictionnaire.
  equipements: {
    appliquer: appliquerLeLotDeEquipements,
    annuler: annulerLeLotDeEquipements,
  },
};

/**
 * LES TYPES QU'ON SAIT CONTRÔLER ET PAS ÉCRIRE — liste close, avec motif.
 *
 * Un motif se vérifie ; « pas encore fait » ne se vérifie pas. Celui-ci est
 * MESURÉ : `ls lib/contacts/` rend `saisie.ts`, et rien d'autre.
 */
export const SANS_APPLICATION: Readonly<Record<string, string>> = {
  // **Il n'existe AUCUN dépôt de contacts** — `lib/contacts/` ne porte que
  // `saisie.ts`, sans `creerContactDans` ni quoi que ce soit qui écrive. Ce
  // n'est pas un oubli de ce ticket : *c'est L1-03b*, qui ouvre la saisie
  // unitaire depuis la fiche d'un client, et qui écrira ce dépôt. **L'écrire
  // ici en passant déciderait à sa place** de ce qu'un contact peut porter,
  // dans le seul chemin où personne ne relit ce qui entre.
  contacts: "aucun chemin d'écriture : lib/contacts/ n'a pas de dépôt (L1-03b)",
};

/**
 * Ce qu'on sait faire d'un lot de ce type — `null` si on ne sait rien en faire.
 *
 * **La route l'appelle, et elle ne compare aucun nom de type.** *Lire
 * `type_import` dans une route puis choisir par une suite de `if` remettrait la
 * table à la main, à l'endroit exact où elle vieillit sans rougir.*
 */
export function applicationDuType(type: string): ApplicationDeLot | null {
  return APPLICATIONS[type] ?? null;
}
