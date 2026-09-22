import { z } from "zod";

import { cleDeRapprochement } from "@/lib/excel/rapprochement";
import {
  type StatutIntervention,
  type TypeIntervention,
} from "@/lib/interventions/saisie";

/**
 * CE QU'UNE INTERVENTION REPRISE D'ARCHIVE EST — et n'est pas (REPRISE-HISTORIQUE ; D127).
 *
 * Ce module ne lit aucune base et ne connaît aucun classeur : il porte la
 * SAISIE d'une ligne d'historique (Zod, CLAUDE.md §2), les CONSTANTES que
 * l'arbitrage fixe, et le RAPPROCHEMENT de la machine par ses trois rangs.
 * `lib/imports/modeles.ts` le traduit en gabarit, `lib/imports/application.ts`
 * l'écrit, et les deux lisent la même règle.
 *
 * ## LES TROIS FAITS DE L'ARBITRAGE, écrits une fois
 *
 * 1. **Une intervention reprise naît CLÔTURÉE** — `cloturee`, le mot du cycle
 *    de vie, mesuré au schéma (`StatutIntervention`). C'est un fait passé :
 *    elle ne repart pas dans la file de ce qui est à planifier, elle ne
 *    rouvre aucune demande. *Mesuré au 22/09/2026 : aucun module du dépôt ne
 *    calcule encore de statistique de délai* — le jour où l'un naîtra, il
 *    devra écarter les lignes dont `import_lot_ligne.entite = 'intervention'`,
 *    seule trace de leur provenance ; `intervention` ne porte pas de
 *    `source_creation`, et l'ajouter est une migration.
 * 2. **Le temps n'est PAS repris.** L'archive ne le porte pas ; un compteur
 *    inventé serait faux (§8). `temps_mesure_min`, `temps_valide_min` et
 *    leur trace restent NULS — et la base l'admet : `intervention_cycle_de_vie`
 *    est un déclencheur `BEFORE UPDATE`, il ne juge pas une INSERTION close.
 * 3. **Aucune machine n'est créée.** L'import rattache à des machines déjà
 *    présentes, ou à rien — `intervention_machine`, zéro ou une ligne.
 *
 * ## LE TYPE — une valeur, choisie une fois, et pourquoi celle-là
 *
 * `TypeIntervention` est une liste close de NEUF valeurs (chapitre 11.2,
 * `TYPES_INTERVENTION`). L'archive ne porte aucune colonne de type : elle
 * porte un « Objet de l'intervention » en texte libre, et **D127 interdit
 * d'en déduire un type par ressemblance**. Il n'y a donc aucune correspondance
 * sûre — pas « peu », aucune : la mesure n'est pas possible sans lire un
 * texte libre. Toutes les lignes reçoivent la MÊME valeur.
 *
 * **`curatif`**, parce que c'est ce que le mot « SAV » veut dire dans ce
 * cahier des charges : *« chiffre d'affaires SAV entièrement transactionnel »*
 * (§1), *« Préventif + curatif : dépannages illimités »* (§6). L'archive est
 * l'historique du service après-vente, facturé au document ; un dépannage
 * facturé est un curatif. Ce que cette valeur AFFIRME de trop : les
 * entretiens que l'archive contient sûrement, classés curatif faute d'une
 * colonne pour les distinguer.
 *
 * Ce que les autres auraient affirmé de pire — mesuré dans le dépôt :
 * `garantie` et `recensement` disent « non facturable » (D8, déclencheur) et
 * RG-INT-11 fait du recensement une visite sans montant ; `reprise` est la
 * *reprise de matériel* (§3), pas la reprise d'un historique ; `expertise`,
 * `installation`, `controle_reglementaire` et les deux préventifs nomment un
 * geste précis que rien ne mesure. *La valeur la plus neutre est celle qui
 * affirme le moins* (doctrine §3) — et `curatif` est la seule que le nom de
 * l'archive porte déjà.
 *
 * **Condition de réouverture, vérifiable :** le jour où l'archive portera une
 * colonne de type, ou le jour où `TypeIntervention` recevra une valeur qui
 * dit « repris, type inconnu » — l'une et l'autre sont un arbitrage, pas une
 * ligne ici.
 *
 * ## LE SECOND AXE — « facturée », et c'est un FAIT lu, pas une décision
 *
 * D8 : *« `statut_facturation` passe à `a_facturer` automatiquement à
 * l'entrée en CLOTUREE »* — le déclencheur `intervention_facturation_a_la_cloture`
 * le pose quand la colonne est NULLE. **Laisser faire rangerait l'archive
 * entière dans la file « à facturer »** : 1 965 factures déjà émises,
 * présentées comme dues. La ligne EST un document de facturation de l'outil
 * tiers — son N° est la clé —, et *« la facturation reste dans WinPro »* : la
 * valeur `facturee` est celle que le retour de facturation aurait écrite. Le
 * déclencheur n'agit que sur `NULL` : il ne revient pas sur cette valeur.
 * *L'application n'écrivait jamais cette colonne* (schéma) ; cet import est
 * le premier à le faire, et il écrit ce que le fichier dit, pas ce qu'il
 * décide.
 */
export const TYPE_INTERVENTION_REPRISE = "curatif" satisfies TypeIntervention;
export const STATUT_REPRISE = "cloturee" satisfies StatutIntervention;
export const STATUT_FACTURATION_REPRISE = "facturee";

const uuid = z.string().uuid();
const texteFacultatif = (max: number) =>
  z.string().trim().min(1).max(max).nullable().default(null);

/**
 * LA LIGNE D'HISTORIQUE, TELLE QU'ELLE S'ÉCRIT.
 *
 * **Cinq de ces champs n'ont AUCUNE colonne d'arrivée sur `intervention`** —
 * mesuré au schéma le 22/09/2026 : `type_document`, `numero_document`,
 * `reference_or`, `technicien`, `objet`. La table ne porte ni référence
 * externe, ni objet, ni technicien en texte. **Ils sont validés ici et
 * conservés dans `import_lot_ligne.valeurs`**, la ligne du fichier telle
 * qu'elle a été lue, retrouvable par `entite_id` ; ils n'apparaissent pas sur
 * la fiche de l'intervention. *Les porter sur la fiche est une migration —
 * un arbitrage, pas un détail* (ticket) ; les inventer une colonne de
 * fortune (un motif d'annulation, une pièce attendue) ferait mentir la
 * colonne. Le schéma les exige quand même : un fichier qui ne les porte pas
 * n'est pas l'archive, et le jour de la migration ils devront déjà être
 * justes.
 *
 * **`technicien` est un TEXTE**, jamais une clé vers `technicien` : les
 * prénoms de l'archive ne sont pas des comptes de la plateforme.
 */
export const schemaLigneHistorique = z
  .object({
    /** Le jour du document — `date_planifiee` ET `cloturee_le`, au jour près. */
    date: z.date(),
    type_document: z.string().trim().min(1).max(40),
    numero_document: z.string().trim().min(1).max(80),
    client_id: uuid,
    site_id: uuid,
    /** DÉDUITE du site (D56), comme pour toute intervention. */
    agence_id: uuid,
    /** La machine RATTACHÉE (rang 1 ou 2), ou rien (rang 3, ou sans série). */
    machine_id: uuid.nullable(),
    reference_or: texteFacultatif(120),
    technicien: texteFacultatif(120),
    objet: z.string().trim().min(1).max(2000),
    /** ENTIER dans l'unité la plus fine de la devise (I3), avec son code (I2). */
    montant_ht: z.bigint().nullable(),
    devise_code: z.string().min(3).max(3).nullable(),
  })
  .strict()
  .refine((v) => (v.montant_ht === null) === (v.devise_code === null), {
    message: "Un montant voyage avec sa devise, ou aucun des deux (I2).",
    path: ["devise_code"],
  });

export type LigneHistorique = z.output<typeof schemaLigneHistorique>;

/* ────────────────────────────────────────────────────────────────────────
 * LA MACHINE — les trois rangs de D127, avec ce que l'archive porte
 * ──────────────────────────────────────────────────────────────────────── */

/** Une machine du parc, vue par le rapprochement : son identifiant et son client. */
export type CandidatMachine = {
  readonly id: string;
  readonly clientId: string;
};

/**
 * LE PARC DES MACHINES PAR SÉRIE — TOUS les candidats, jamais un seul.
 *
 * `indexerLeParcEquipements` (`parc-cibles.ts`) retire une clé ambiguë de
 * son index : c'est juste pour rapprocher une FICHE — un choix au hasard y
 * serait un écrasement. Ici la question est autre : *« parmi les machines qui
 * portent cette série, une seule est-elle chez CE client ? »* — le rang 2.
 * Elle exige de garder les candidats, avec leur client.
 */
export type ParcMachines = {
  readonly parSerie: ReadonlyMap<string, readonly CandidatMachine[]>;
};

/**
 * LE RÉSULTAT DU RAPPROCHEMENT — et aucun n'est un rejet.
 *
 * **Le rang 3 entre quand même**, non rattaché, avec son motif : *écarter les
 * lignes sans machine perdrait les trois quarts de l'historique* (72 %
 * mesurés ; 1 496 sur 1 996 au 22/09/2026). C'est le point sur lequel
 * l'exploitation ne cède pas, et c'est pourquoi le motif est une INFORMATION
 * du rapport, jamais un `rejetMotif`.
 */
export type MotifNonRattachee =
  "serie_inconnue" | "serie_ambigue" | "serie_autre_client";

export type Rattachement =
  | { readonly rang: "sans_serie" }
  | { readonly rang: 1 | 2; readonly machineId: string }
  | {
      readonly rang: 3;
      readonly motif: MotifNonRattachee;
      /** Ce que la ligne portait, pour que le rapport puisse le montrer. */
      readonly serie: string;
    };

/**
 * RATTACHE UNE LIGNE D'HISTORIQUE À UNE MACHINE, OU DIT POURQUOI PAS (D127).
 *
 * ## Les trois rangs, lus avec ce que ce gabarit porte
 *
 * D127 écrit le rang 2 comme *« la conjonction client + famille + marque +
 * libellé »*. **L'archive ne porte ni famille, ni marque, ni libellé** — dix
 * colonnes mesurées, une seule désigne la machine : son n° de série. La
 * conjonction disponible est donc `client + série`, et c'est elle que le
 * rang 2 lit ici ; le reste de la règle est repris tel quel.
 *
 * - **rang 1** : la série désigne UNE seule machine du parc, et elle est chez
 *   ce client ;
 * - **rang 2** : la série désigne PLUSIEURS machines du parc (la série seule
 *   n'est pas unique — `@@unique([societe_id, modele_id, numero_serie])`,
 *   mesuré), mais UNE seule chez ce client ;
 * - **rang 3** : tout le reste — série inconnue, série connue chez un AUTRE
 *   client seulement, ou plusieurs machines de CE client sous la même série.
 *   *Une correspondance ambiguë n'est pas une correspondance faible : c'est
 *   une non-correspondance.*
 *
 * **Le client de la machine doit être celui de la ligne**, et c'est la seule
 * chose exigée : rattacher l'intervention d'un client à la machine d'un autre
 * attribuerait une facture à un parc qui n'est pas le sien. Le SITE n'est
 * pas exigé — une machine déménage, l'archive dit où elle était.
 *
 * La clé est celle du parc — `cleDeRapprochement`, la fonction de L1-08b —
 * et jamais une seconde : *deux lectures d'un même critère divergent en
 * silence* (§9, 01/09), et ici la divergence serait « rien ne se rattache ».
 */
export function rattacherLaMachine(
  serie: string | undefined,
  /**
   * `null` DEPUIS VGP-IMPORT : le gabarit des vérifications réglementaires ne
   * nomme pas toujours son client — la colonne « Client / Site » n'y est
   * qu'un contrôle de cohérence. Sans client, le rang 2 n'existe pas : la
   * série désigne UNE machine ou elle est ambiguë. *Le rang 1 reste le même
   * rang 1* — une fonction, jamais une seconde lecture (§9, 01/09).
   */
  clientId: string | null,
  machines: ParcMachines,
): Rattachement {
  const cle = cleDeRapprochement({ numeroSerie: serie, rang: 0 });
  if (cle.forme === "rang") {
    return { rang: "sans_serie" };
  }
  const candidats = machines.parSerie.get(cle.cle) ?? [];
  if (candidats.length === 0) {
    return { rang: 3, motif: "serie_inconnue", serie: cle.cle };
  }
  if (clientId === null) {
    const seul = candidats[0];
    return candidats.length === 1 && seul !== undefined
      ? { rang: 1, machineId: seul.id }
      : { rang: 3, motif: "serie_ambigue", serie: cle.cle };
  }
  const duClient = candidats.filter((c) => c.clientId === clientId);
  if (duClient.length === 1 && duClient[0] !== undefined) {
    return {
      rang: candidats.length === 1 ? 1 : 2,
      machineId: duClient[0].id,
    };
  }
  return {
    rang: 3,
    motif: duClient.length === 0 ? "serie_autre_client" : "serie_ambigue",
    serie: cle.cle,
  };
}
