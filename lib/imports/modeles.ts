import { schemaCreationClient } from "@/lib/clients/saisie";
import { cleClientDepuis, type ModeleDImport } from "@/lib/excel/controle";

/**
 * LES GABARITS D'IMPORT QUE CODIPLAN PUBLIE (L1-09a ; D31, RG-IMP-05).
 *
 * ## La distinction qui rend ce fichier possible, et sans laquelle il ne l'est pas
 *
 * Il y a **deux sortes de fichiers d'import**, et les confondre bloque tout :
 *
 * | | D'où viennent ses colonnes | Peut-on l'écrire aujourd'hui ? |
 * |---|---|---|
 * | **le gabarit que CODIPLAN publie** | de NOS schémas de saisie | **oui** — ils sont dans le dépôt |
 * | le fichier de REPRISE d'un outil tiers | du fichier réel du client | non — il n'est pas dans le dépôt (I9) |
 *
 * Ce fichier ne porte que la première sorte. *Un gabarit est un document que
 * nous définissons et que le client remplit : ses colonnes se lisent dans
 * `lib/clients/saisie.ts`, elles ne s'inventent pas.* La reprise de l'historique
 * Winpro est L1-10, et elle attend son fichier.
 *
 * ## Ce que le gardien exige, dans les deux sens
 *
 * `tests/unit/imports/modeles.test.ts` confronte chaque modèle à son schéma de
 * saisie : **aucune colonne orpheline** — une colonne qui ne va nulle part
 * ferait remplir une case pour rien — et **aucun champ obligatoire sans
 * colonne**, *sans quoi le gabarit produirait des fiches que la saisie refuse,
 * et l'import échouerait sur un fichier correctement rempli.*
 *
 * Les champs volontairement ÉCARTÉS sont nommés avec leur motif : le second
 * sens ne se garde pas autrement.
 */

/** Les colonnes du gabarit, dans l'ordre où elles apparaissent. */
export const COLONNES_CLIENTS = {
  codeExterne: "Code externe",
  raisonSociale: "Raison sociale",
  ridet: "RIDET",
  categorie: "Catégorie",
  conditionsReglement: "Conditions de règlement",
  commercialReferent: "Commercial référent",
} as const;

/**
 * LE CHAMP DE SAISIE QUE CHAQUE COLONNE ALIMENTE.
 *
 * C'est ce que le gardien confronte, et c'est aussi ce que l'application lira
 * pour transformer une ligne en saisie. *Écrire la correspondance une fois évite
 * qu'elle soit déduite deux fois — une seconde lecture d'un même critère diverge
 * en silence* (§9, 01/09).
 */
export const CHAMPS_CLIENTS: Readonly<Record<string, string>> = {
  [COLONNES_CLIENTS.codeExterne]: "code_externe",
  [COLONNES_CLIENTS.raisonSociale]: "raison_sociale",
  [COLONNES_CLIENTS.ridet]: "ridet",
  [COLONNES_CLIENTS.categorie]: "categorie",
  [COLONNES_CLIENTS.conditionsReglement]: "conditions_reglement",
  [COLONNES_CLIENTS.commercialReferent]: "commercial_referent",
};

/**
 * LES CHAMPS DE SAISIE QUE LE GABARIT N'EXPOSE PAS — liste close, avec motif.
 *
 * Un champ écarté sans motif est un champ oublié, et rien ne les distingue.
 */
export const CHAMPS_CLIENTS_ECARTES: Readonly<Record<string, string>> = {
  // *Le chapitre 11 ne fixe AUCUNE forme à cette adresse* — c'est un objet
  // libre, et `lib/clients/saisie.ts` l'écrit. Un tableur est plat : l'exposer
  // demanderait d'inventer ses sous-colonnes, c'est-à-dire de FIGER pour tous
  // les clients une forme que personne n'a décidée.
  adresse_facturation:
    "aucune forme n'est fixée : l'aplatir dans un gabarit la figerait",
  // Un import CRÉE et MODIFIE des fiches ; il ne les désactive pas. *Une
  // colonne « Actif » dans un gabarit ferait d'un oubli de saisie une
  // désactivation de masse* — et la désactivation est un geste qui se fait
  // fiche par fiche, avec ce qu'on sait de chacune.
  actif: "un import ne désactive pas : ce geste se fait fiche par fiche",
};

/**
 * LE GABARIT « CLIENTS ».
 *
 * **Les deux colonnes IDENTIFIANTES sont celles de RG-IMP-05** — code externe
 * et raison sociale —, et ce n'est pas une coïncidence : *ce qui identifie une
 * ligne pour le rapprochement est ce sans quoi elle ne désigne rien.* Une ligne
 * qui n'en porte aucune est un gabarit, pas une donnée (L1-08c).
 */
/**
 * LE MOTIF D'UN REJET POUR SAISIE REFUSÉE. Un CODE, jamais du texte : les
 * libellés sont au dictionnaire (L0-11), et le rapport que lit un humain les y
 * prendra le jour où l'écran existera.
 */
export const MOTIF_SAISIE_REFUSEE = "saisie_refusee";

/**
 * TRADUIT UNE LIGNE EN SAISIE — les colonnes vers les champs, et rien d'autre.
 *
 * **Les cellules vides ne deviennent pas des chaînes vides** : elles
 * n'apparaissent pas, et c'est le schéma qui pose alors ses défauts. *Une
 * chaîne vide écrite dans `raison_sociale` la ferait refuser pour une autre
 * raison que la bonne, et l'auteur du fichier chercherait longtemps.*
 */
export function saisieDepuisLaLigne(
  valeurs: Readonly<Record<string, string | undefined>>,
  champs: Readonly<Record<string, string>>,
): Record<string, string> {
  const saisie: Record<string, string> = {};
  for (const [colonne, champ] of Object.entries(champs)) {
    const valeur = valeurs[colonne];
    if (valeur !== undefined && valeur.trim() !== "") {
      saisie[champ] = valeur.trim();
    }
  }
  return saisie;
}

/**
 * CE QUE LA SAISIE REFUSERAIT, vu depuis le rapport (L1-08h).
 *
 * **C'est le schéma de création lui-même qui juge**, jamais une relecture de
 * ses règles : *une seconde lecture d'un même critère diverge en silence* (§9,
 * 01/09), et ici la divergence se verrait au pire moment — un rapport qui
 * annonce 300 créations et une application qui en écrit 297.
 */
function validerContre(
  champs: Readonly<Record<string, string>>,
  schema: { safeParse: (v: unknown) => { success: boolean } },
): (valeurs: Readonly<Record<string, string | undefined>>) => string | null {
  return (valeurs) =>
    schema.safeParse(saisieDepuisLaLigne(valeurs, champs)).success
      ? null
      : MOTIF_SAISIE_REFUSEE;
}

export const MODELE_CLIENTS: ModeleDImport = {
  type: "clients",
  version: 1,
  colonnes: [
    { nom: COLONNES_CLIENTS.codeExterne, obligatoire: false },
    // La SEULE colonne obligatoire, et elle l'est parce que le schéma de saisie
    // l'est : `raison_sociale` refuse l'absence, mesuré.
    { nom: COLONNES_CLIENTS.raisonSociale, obligatoire: true },
    { nom: COLONNES_CLIENTS.ridet, obligatoire: false },
    { nom: COLONNES_CLIENTS.categorie, obligatoire: false },
    { nom: COLONNES_CLIENTS.conditionsReglement, obligatoire: false },
    { nom: COLONNES_CLIENTS.commercialReferent, obligatoire: false },
  ],
  identifiantes: [COLONNES_CLIENTS.codeExterne, COLONNES_CLIENTS.raisonSociale],
  cle: cleClientDepuis(
    COLONNES_CLIENTS.codeExterne,
    COLONNES_CLIENTS.raisonSociale,
  ),
  // *Le rapport montre ce que la saisie refusera*, et il le montre AVANT la
  // validation humaine — I6 veut un rapport, puis une décision, pas une
  // décision suivie de surprises.
  valider: validerContre(CHAMPS_CLIENTS, schemaCreationClient),
};

/**
 * Le marqueur que la première cellule du gabarit doit porter (D31).
 *
 * Il est DÉRIVÉ du modèle, jamais recopié : *une recopie devient fausse le jour
 * où la version change, et elle ne rougit pas.*
 */
export function marqueurDu(modele: ModeleDImport): string {
  return `CODIPLAN-${modele.type}-v${modele.version}`;
}
