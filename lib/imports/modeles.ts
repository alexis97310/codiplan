import { schemaCreationClient } from "@/lib/clients/saisie";
import { schemaCreationContact } from "@/lib/contacts/saisie";
import { schemaMachine } from "@/lib/machines/saisie";
import {
  schemaFamilleMateriel,
  schemaModeleMateriel,
} from "@/lib/materiel/saisie";
import { schemaCreationSite } from "@/lib/sites/saisie";
import {
  NAISSANCE,
  schemaAssujettissementFamille,
  type SaisieAssujettissementFamille,
} from "@/lib/vgp/assujettissement";
import {
  cleDeClient,
  normaliserRaisonSociale,
} from "@/lib/excel/rapprochement";

import { type ParcAgences } from "./parc-agences";
import { type ParcFamilles } from "./parc-familles";
import { type ParcClientsIndexe } from "./parc-clients";
import {
  cleClientDepuis,
  cleMachineDepuis,
  type ModeleDImport,
} from "@/lib/excel/controle";
import {
  analyserMarqueur,
  codeDuMarqueur,
  lireDate,
  lireNombre,
  type Cellule,
  type CodeAnomalie,
  typeAnnonce,
} from "@/lib/excel/format";
import { schemaPrestation } from "@/lib/prestations/saisie";

import { type Devise, uniteParDevise } from "@/lib/money";

import { type DetailDeSite } from "./parc-cibles";
import { deviseNonLue } from "./parc-societe";
import {
  type ParcMachines,
  type Rattachement,
  rattacherLaMachine,
  schemaLigneHistorique,
  type LigneHistorique,
} from "./reprise";

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
export function marqueurDu(
  modele: Pick<ModeleDImport, "type" | "version">,
): string {
  return `CODIPLAN-${modele.type}-v${modele.version}`;
}

/* ────────────────────────────────────────────────────────────────────────
 * LE GABARIT « CONTACTS » — et le premier qui DÉSIGNE UN PARENT (L1-09b)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LE MOTIF DE REJET D'UNE RÉFÉRENCE QUI NE DÉSIGNE RIEN.
 *
 * *Distinct de `MOTIF_SAISIE_REFUSEE`, et c'est ce qui le rend utile* : une
 * saisie refusée se corrige dans le FICHIER, un client introuvable se corrige
 * dans le PARC — ou dans la colonne qui le nomme. **Rendre le même code ferait
 * chercher au mauvais endroit**, ce qui est le motif pour lequel l'ambiguïté
 * passe avant la saisie.
 */
export const MOTIF_PARENT_INTROUVABLE = "parent_introuvable";

export const COLONNES_CONTACTS = {
  client: "Client (code ou raison sociale)",
  nom: "Nom",
  fonction: "Fonction",
  telephone: "Téléphone",
  mobile: "Mobile",
  email: "Courriel",
  roles: "Rôles",
} as const;

export const CHAMPS_CONTACTS: Readonly<Record<string, string>> = {
  [COLONNES_CONTACTS.nom]: "nom",
  [COLONNES_CONTACTS.fonction]: "fonction",
  [COLONNES_CONTACTS.telephone]: "telephone",
  [COLONNES_CONTACTS.mobile]: "mobile",
  [COLONNES_CONTACTS.email]: "email",
};

/**
 * LES CHAMPS QUE LE GABARIT N'EXPOSE PAS — liste close, avec motif.
 */
export const CHAMPS_CONTACTS_ECARTES: Readonly<Record<string, string>> = {
  // Il n'est pas une donnée du fichier : il est RÉSOLU depuis la colonne
  // « Client », par la clé de RG-IMP-05. *Une colonne d'UUID dans un gabarit
  // demanderait au client de connaître nos identifiants techniques.*
  client_id: "résolu depuis la colonne « Client », jamais saisi (I10)",
  // Le site est FACULTATIF (§6) et se désigne comme le client — mais **rien ne
  // dit encore comment rapprocher un site**, qui n'a ni code externe ni règle
  // équivalente à RG-IMP-05. *Un contact sans site est un contact du CLIENT, et
  // c'est un cas légitime* : le gabarit le sert entièrement.
  site_id: "aucune règle de rapprochement des sites n'est écrite (L1-09)",
  // ⟵ `actif` était écarté ICI, par symétrie avec le gabarit des clients. **Le
  //    gardien l'a refusé** : il n'existe pas dans `schemaCreationContact` — un
  //    contact naît actif, et seul le schéma de MODIFICATION le porte. *Une
  //    exemption qui ne s'adosse à rien n'exempte plus personne et ne rougit
  //    jamais* (§9, 31/08) ; celle-ci a rougi le jour où elle a été écrite.
  // Un seul canal existe (`email`), et il est le DÉFAUT. Une colonne pour une
  // énumération à une valeur est une colonne que personne ne remplit.
  //
  // **Et ce défaut a une conséquence, mesurée plutôt que devinée** : `canaux`
  // valant `["email"]`, `exigerCourrielSiCanalEmail` REFUSE tout contact sans
  // courriel — le premier scénario du gabarit l'a montré en rejetant une ligne
  // parfaitement remplie par ailleurs. La colonne « Courriel » est donc
  // **obligatoire** ici, et ce n'est pas une décision du gabarit : c'est la
  // règle de L1-03, lue à l'endroit où elle mord.
  //
  // *Le jour où un contact joignable par téléphone SEUL devra être importé,
  // c'est `canaux` qu'il faudra exposer* — et ce jour-là un second canal
  // existera probablement, ce qui rendra la colonne utile pour deux raisons.
  canaux: "une seule valeur existe, et elle est le défaut — voir le courriel",
};

/** Les rôles, tels qu'un humain les écrit dans une cellule, séparés par `;`. */
function lireLesRoles(brut: string | undefined): string[] {
  return (brut ?? "")
    .split(";")
    .map((role) => role.trim())
    .filter((role) => role !== "");
}

/**
 * LE GABARIT « CONTACTS » — **une FONCTION du parc des clients**, et c'est ce
 * qui le distingue du gabarit « clients ».
 *
 * *Un gabarit qui désigne un parent ne peut pas être contrôlé sans ce parent* :
 * savoir si « Garage Dupont » existe demande de regarder le parc. Le modèle est
 * donc **fabriqué** avec l'index, plutôt que de recevoir le parc en paramètre à
 * chaque appel — ce qui aurait changé le contrat du contrôle pour tous les
 * modèles, y compris ceux qui ne désignent rien.
 *
 * **La colonne « Client » se rapproche par la MÊME clé que le gabarit des
 * clients** (`cleDeClient`, RG-IMP-05) : code externe, à défaut raison sociale
 * normalisée. *Une seconde règle de rapprochement des clients serait une
 * seconde lecture d'un même critère, et celle-ci se verrait au pire moment —
 * des contacts accrochés au mauvais client.*
 */
export function modeleContacts(parc: ParcClientsIndexe): ModeleDImport {
  const resoudre = (
    valeurs: Readonly<Record<string, string | undefined>>,
  ): string | undefined => {
    const designation = valeurs[COLONNES_CONTACTS.client];
    if (designation === undefined || designation.trim() === "") {
      return undefined;
    }
    // Le rang est sans objet : une désignation vide a déjà été écartée, et la
    // clé de dernier recours ne peut donc pas être atteinte.
    const cle = cleDeClient({
      codeExterne: designation,
      raisonSociale: undefined,
      rang: 0,
    }).cle;
    return (
      parc.fiches.get(cle) ??
      parc.fiches.get(
        cleDeClient({
          codeExterne: undefined,
          raisonSociale: designation,
          rang: 0,
        }).cle,
      )
    );
  };

  return {
    type: "contacts",
    version: 1,
    colonnes: [
      { nom: COLONNES_CONTACTS.client, obligatoire: true },
      { nom: COLONNES_CONTACTS.nom, obligatoire: true },
      { nom: COLONNES_CONTACTS.fonction, obligatoire: false },
      { nom: COLONNES_CONTACTS.telephone, obligatoire: false },
      { nom: COLONNES_CONTACTS.mobile, obligatoire: false },
      // OBLIGATOIRE, et la raison n'est pas dans ce fichier : `canaux` vaut
      // `["email"]` par défaut, et la saisie refuse alors un contact sans
      // courriel. *Mesuré, pas supposé.*
      { nom: COLONNES_CONTACTS.email, obligatoire: true },
      { nom: COLONNES_CONTACTS.roles, obligatoire: true },
    ],
    // **Ce qui identifie un contact est le couple client + nom.** Une ligne qui
    // n'en porte aucun des deux ne désigne rien — c'est un gabarit.
    identifiantes: [COLONNES_CONTACTS.client, COLONNES_CONTACTS.nom],
    // *Deux contacts du même nom chez deux clients différents sont deux
    // personnes* : la clé porte donc le client, et le nom seul n'y suffit pas.
    cle: (valeurs, rang) => {
      const client = resoudre(valeurs);
      const nom = valeurs[COLONNES_CONTACTS.nom]?.trim();
      if (client === undefined || nom === undefined || nom === "") {
        return { forme: "rang", cle: `LIGNE-${rang}`, complet: false };
      }
      return {
        forme: "reference",
        cle: `CONTACT-${client}-${normaliserRaisonSociale(nom)}`,
        complet: false,
      };
    },
    valider: (valeurs) => {
      const client = resoudre(valeurs);
      if (client === undefined) {
        return MOTIF_PARENT_INTROUVABLE;
      }
      const saisie = {
        ...saisieDepuisLaLigne(valeurs, CHAMPS_CONTACTS),
        client_id: client,
        roles: lireLesRoles(valeurs[COLONNES_CONTACTS.roles]),
      };
      return schemaCreationContact.safeParse(saisie).success
        ? null
        : MOTIF_SAISIE_REFUSEE;
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * LE GABARIT « SITES » — DEUX parents, et deux règles distinctes (L1-09c, D101)
 * ──────────────────────────────────────────────────────────────────────── */

export const COLONNES_SITES = {
  client: "Client (code ou raison sociale)",
  agence: "Agence (code)",
  libelle: "Libellé du site",
  adresse: "Adresse",
  commune: "Commune",
  zone: "Zone géographique",
  consignes: "Consignes d'accès",
  trajet: "Temps de trajet depuis l'agence (min)",
} as const;

export const CHAMPS_SITES: Readonly<Record<string, string>> = {
  [COLONNES_SITES.libelle]: "libelle",
  [COLONNES_SITES.commune]: "commune",
  [COLONNES_SITES.zone]: "zone_geo",
  [COLONNES_SITES.consignes]: "consignes_acces",
};

/** Les champs du schéma que le gabarit n'expose pas — liste close, avec motif. */
export const CHAMPS_SITES_ECARTES: Readonly<Record<string, string>> = {
  client_id: "résolu depuis la colonne « Client », jamais saisi (I10)",
  agence_id: "résolu depuis la colonne « Agence », par son CODE (D101)",
  // Le chapitre 11 ne fixe aucune forme à cette adresse : un tableur est plat,
  // et l'aplatir la figerait pour tous — le même motif que sur les clients.
  adresse: "aucune forme n'est fixée : l'aplatir dans un gabarit la figerait",
  // *Elles ne se saisissent pas, elles se relèvent.* Un tableur rempli à la
  // main porterait des coordonnées approximatives que personne ne pourrait
  // distinguer d'un relevé, et le planning s'en sert pour ordonner des
  // tournées.
  latitude: "une coordonnée se relève, elle ne se saisit pas dans un tableur",
  longitude: "une coordonnée se relève, elle ne se saisit pas dans un tableur",
  // Même forme libre que l'adresse, même motif.
  horaires: "aucune forme n'est fixée : l'aplatir dans un gabarit la figerait",
  // *Un nombre dont la signification dépend d'une autre colonne ne voyage
  // jamais seul* (D56) : le trajet part de l'agence, et il est exposé — mais
  // par une colonne qui le DIT, et sa lecture reste à écrire.
  temps_trajet_min:
    "exposé par une colonne qui nomme son origine, mais sa lecture reste à écrire (L1-09)",
  actif: "un import ne désactive pas : ce geste se fait fiche par fiche",
};

/**
 * LES TROIS CLÉS, ÉCRITES UNE SEULE FOIS (R6-01).
 *
 * ## Pourquoi elles sortent des gabarits
 *
 * Un gabarit dit ce qu'une LIGNE DE FICHIER désigne ; un index de parc dit ce
 * qu'une FICHE EN BASE désigne. **Les deux doivent rendre la même chaîne, sinon
 * rien ne se rapproche et tout devient création** — c'est-à-dire un doublon par
 * ligne au second import, exactement ce que RG-IMP-05 interdit.
 *
 * *C'est le défaut que L1-08f avait mesuré et réparé sur les clients* : le
 * contrôle calculait la clé des machines pour tout type d'import, et deux
 * clients que le parc connaissait déjà sont ressortis en création. La parade
 * est la même — **une seule fonction, appelée des deux côtés, jamais recopiée**
 * (§9, 01/09) — et elle est appliquée ici AVANT que le défaut se produise
 * plutôt qu'après.
 */

/** La clé d'un site : le couple (client, libellé). */
export function cleDuSite(clientId: string, libelle: string): string {
  return `SITE-${clientId}-${normaliserRaisonSociale(libelle)}`;
}

/** La clé d'un modèle : le couple (marque, référence) — jamais la famille. */
export function cleDuModele(marque: string, reference: string): string {
  return `MODELE-${normaliserRaisonSociale(marque)}-${normaliserRaisonSociale(reference)}`;
}

/** La clé d'une prestation : son code seul, que la base tient par un index. */
export function cleDeLaPrestation(code: string): string {
  return `PRESTATION-${normaliserRaisonSociale(code)}`;
}

/**
 * La clé d'une ligne d'historique : son N° DOCUMENT seul (REPRISE-HISTORIQUE).
 *
 * *1 996 valeurs distinctes sur 1 996 lignes, mesuré le 22/09/2026* : le numéro
 * est une clé parce que l'outil tiers le garantit — et la base ne le porte
 * nulle part, si bien que c'est `import_lot_ligne.cle` qui le tient
 * (`indexerLeParcHistorique`). La normalisation est celle des autres clés :
 * la GRAPHIE seulement, jamais le numéro.
 */
export function cleDuDocument(numero: string): string {
  return `HISTORIQUE-${normaliserRaisonSociale(numero)}`;
}

/**
 * LE GABARIT « SITES » — **deux parents, deux règles, et c'est le point** (D101).
 *
 * *On aurait pu vouloir « la même règle partout ».* Elle aurait été fausse :
 * **ce qui rend une clé utilisable n'est pas sa forme, c'est ce que la base
 * garantit d'elle.** Le code d'agence est une clé parce qu'un index unique le
 * dit ; la raison sociale d'un client n'en est une qu'à défaut de code, et le
 * libellé d'un site n'en est pas une du tout.
 */
export function modeleSites(
  clients: ParcClientsIndexe,
  agences: ParcAgences,
): ModeleDImport {
  return {
    type: "sites",
    version: 1,
    colonnes: [
      { nom: COLONNES_SITES.client, obligatoire: true },
      { nom: COLONNES_SITES.agence, obligatoire: true },
      { nom: COLONNES_SITES.libelle, obligatoire: true },
      { nom: COLONNES_SITES.adresse, obligatoire: false },
      { nom: COLONNES_SITES.commune, obligatoire: false },
      { nom: COLONNES_SITES.zone, obligatoire: false },
      { nom: COLONNES_SITES.consignes, obligatoire: false },
      { nom: COLONNES_SITES.trajet, obligatoire: false },
    ],
    identifiantes: [COLONNES_SITES.client, COLONNES_SITES.libelle],
    // **Le COUPLE (client, libellé)**, et rien d'autre : *un site n'existe pas
    // sans son client, et deux ateliers du même nom chez deux clients
    // différents sont deux lieux.*
    cle: (valeurs, rang) => {
      const client = clientDuSite(clients, valeurs);
      const libelle = valeurs[COLONNES_SITES.libelle]?.trim();
      if (client === undefined || libelle === undefined || libelle === "") {
        return { forme: "rang", cle: `LIGNE-${rang}`, complet: false };
      }
      return {
        forme: "reference",
        cle: cleDuSite(client, libelle),
        complet: false,
      };
    },
    // **Le VERDICT est celui de `preparerUnSite`, et il n'est pas recalculé
    // ici.** *Le contrôle et l'application lisent la MÊME fonction* : une
    // seconde lecture d'un même critère diverge en silence (§9, 01/09), et la
    // divergence se verrait au pire endroit — entre ce qu'un humain a validé et
    // ce qui sera écrit.
    valider: (valeurs) => {
      const prepare = preparerUnSite(clients, agences, valeurs);
      return prepare.prete ? null : prepare.motif;
    },
  };
}

/**
 * LE CLIENT QU'UNE LIGNE DE SITE DÉSIGNE — par son code, puis par sa raison
 * sociale, et dans cet ordre (D101).
 *
 * **Elle est appelée par `cle` ET par `preparerUnSite`**, et c'est ce qui la
 * fait exister : la clé d'un site est le couple (client, libellé), si bien que
 * *le rapprochement et la validation lisent le même client ou ne parlent pas du
 * même site.*
 */
export function clientDuSite(
  clients: ParcClientsIndexe,
  valeurs: Readonly<Record<string, string | undefined>>,
): string | undefined {
  // **Le CORPS est parti dans `clientDesignePar`** (R6-03), et cette fonction
  // ne fait plus que nommer sa colonne. *Trois gabarits désignent désormais un
  // client — contacts, sites, équipements — et une seconde règle de
  // rapprochement se verrait au pire moment.*
  return clientDesignePar(clients, valeurs[COLONNES_SITES.client]);
}

/**
 * CE QU'UNE LIGNE DE SITE DÉSIGNE, RÉSOLU UNE SEULE FOIS (R6-01).
 *
 * ## Pourquoi elle est exportée, et ce que cela ferme
 *
 * Les deux parents d'un site — son client, son agence — se résolvent contre le
 * PARC, et jusqu'à R6-01 cette résolution vivait dans une fermeture privée que
 * seul `valider` appelait. **L'application avait alors deux issues, et les deux
 * étaient mauvaises** : recopier la résolution, c'est-à-dire écrire la seconde
 * lecture d'un critère que le §9 (01/09) nomme comme un défaut ; ou relire le
 * parent depuis la base, c'est-à-dire redécider après la validation humaine, ce
 * que I6 interdit.
 *
 * *Elle est donc extraite, et les trois appelants — le contrôle, l'application
 * et l'annulation — lisent la même.*
 *
 * ## Les deux parents AVANT la saisie
 *
 * Et c'est la raison de l'ambiguïté, reprise telle quelle : *une ligne dont le
 * parent est introuvable se corrige dans le parc, pas dans les autres colonnes
 * du fichier.* Les annoncer ensemble ferait chercher au mauvais endroit.
 */
export type SiteALecrire =
  | { readonly prete: true; readonly saisie: Record<string, unknown> }
  | { readonly prete: false; readonly motif: string };

export function preparerUnSite(
  clients: ParcClientsIndexe,
  agences: ParcAgences,
  valeurs: Readonly<Record<string, string | undefined>>,
): SiteALecrire {
  const client = clientDuSite(clients, valeurs);
  const code = valeurs[COLONNES_SITES.agence]?.trim().toUpperCase();
  const agence =
    code === undefined || code === "" ? undefined : agences.parCode.get(code);

  if (client === undefined || agence === undefined) {
    return { prete: false, motif: MOTIF_PARENT_INTROUVABLE };
  }
  const saisie = {
    ...saisieDepuisLaLigne(valeurs, CHAMPS_SITES),
    client_id: client,
    agence_id: agence,
  };
  return schemaCreationSite.safeParse(saisie).success
    ? { prete: true, saisie }
    : { prete: false, motif: MOTIF_SAISIE_REFUSEE };
}

/* ────────────────────────────────────────────────────────────────────────
 * LE GABARIT « MODÈLES DE MATÉRIEL » (L1-09d ; D101, D4 amendé)
 * ──────────────────────────────────────────────────────────────────────── */

export const COLONNES_MODELES = {
  famille: "Famille (code)",
  marque: "Marque",
  reference: "Référence",
  periodiciteJours: "Périodicité (jours)",
  periodiciteCompteur: "Périodicité (compteur)",
} as const;

export const CHAMPS_MODELES: Readonly<Record<string, string>> = {
  [COLONNES_MODELES.marque]: "marque",
  [COLONNES_MODELES.reference]: "reference",
};

export const CHAMPS_MODELES_ECARTES: Readonly<Record<string, string>> = {
  famille_id: "résolu depuis la colonne « Famille », par son CODE (D101)",
  // *Leur CONTENU n'est fixé par personne* — `lib/materiel/saisie.ts` l'écrit —,
  // et un tableur ne peut pas porter une forme que personne n'a décidée.
  caracteristiques:
    "aucune forme n'est fixée : l'aplatir dans un gabarit la figerait",
  actif: "un import ne désactive pas : ce geste se fait fiche par fiche",
  // Exposées par des colonnes qui NOMMENT leur unité, et lues comme des
  // nombres — la traduction vit dans le modèle, pas dans la grammaire.
  periodicite_jours: "exposée par « Périodicité (jours) », lue comme un nombre",
  periodicite_compteur:
    "exposée par « Périodicité (compteur) », lue comme un nombre",
};

/**
 * Un entier écrit dans une cellule. **Une cellule vide rend `null`**, une
 * cellule illisible rend **le texte brut**.
 *
 * *Rendre `undefined` pour une cellule illisible serait un piège, et c'est
 * mesuré* : le schéma porte `.default(null)`, si bien qu'`undefined` déclenche
 * le DÉFAUT — une faute de frappe deviendrait une périodicité absente, en
 * silence. Le texte brut, lui, fait échouer `z.number()` et le rapport dit
 * « saisie refusée ».
 */
function lireUnEntier(brut: string | undefined): number | null | string {
  const texte = brut?.trim();
  if (texte === undefined || texte === "") return null;
  const nombre = Number(texte.replace(",", "."));
  return Number.isInteger(nombre) ? nombre : texte;
}

/**
 * LE GABARIT « MODÈLES » — la famille par son CODE (D101).
 *
 * **Ce qui identifie un modèle est le couple MARQUE + RÉFÉRENCE**, et non la
 * famille : *deux familles peuvent contenir un « KPX-337 » de marques
 * différentes, et une même marque ne réédite pas sa référence.* La famille est
 * un parent à résoudre, pas une part de l'identité.
 */
export function modeleModeles(familles: ParcFamilles): ModeleDImport {
  return {
    type: "modeles",
    version: 1,
    colonnes: [
      { nom: COLONNES_MODELES.famille, obligatoire: true },
      { nom: COLONNES_MODELES.marque, obligatoire: true },
      { nom: COLONNES_MODELES.reference, obligatoire: true },
      { nom: COLONNES_MODELES.periodiciteJours, obligatoire: false },
      { nom: COLONNES_MODELES.periodiciteCompteur, obligatoire: false },
    ],
    identifiantes: [COLONNES_MODELES.marque, COLONNES_MODELES.reference],
    cle: (valeurs, rang) => {
      const marque = valeurs[COLONNES_MODELES.marque]?.trim();
      const reference = valeurs[COLONNES_MODELES.reference]?.trim();
      if (
        marque === undefined ||
        marque === "" ||
        reference === undefined ||
        reference === ""
      ) {
        return { forme: "rang", cle: `LIGNE-${rang}`, complet: false };
      }
      return {
        forme: "reference",
        cle: cleDuModele(marque, reference),
        complet: false,
      };
    },
    // Le VERDICT est celui de `preparerUnModele` — même raison qu'aux sites :
    // *le contrôle et l'application lisent la MÊME fonction* (§9, 01/09).
    valider: (valeurs) => {
      const prepare = preparerUnModele(familles, valeurs);
      return prepare.prete ? null : prepare.motif;
    },
  };
}

/**
 * CE QU'UNE LIGNE DE MODÈLE DÉSIGNE, RÉSOLU UNE SEULE FOIS (R6-01).
 *
 * **La famille est OBLIGATOIRE ici**, et ce n'est pas la règle des
 * prestations : un modèle de matériel appartient toujours à une famille, une
 * prestation pas nécessairement. *Les deux se ressemblent et ne disent pas la
 * même chose* — c'est pourquoi ce sont deux fonctions et non une, paramétrée.
 */
export type ModeleALecrire =
  | { readonly prete: true; readonly saisie: Record<string, unknown> }
  | { readonly prete: false; readonly motif: string };

export function preparerUnModele(
  familles: ParcFamilles,
  valeurs: Readonly<Record<string, string | undefined>>,
): ModeleALecrire {
  const code = valeurs[COLONNES_MODELES.famille]?.trim().toUpperCase();
  const famille =
    code === undefined || code === "" ? undefined : familles.parCode.get(code);
  if (famille === undefined) {
    return { prete: false, motif: MOTIF_PARENT_INTROUVABLE };
  }
  const saisie = {
    ...saisieDepuisLaLigne(valeurs, CHAMPS_MODELES),
    famille_id: famille,
    periodicite_jours: lireUnEntier(valeurs[COLONNES_MODELES.periodiciteJours]),
    periodicite_compteur: lireUnEntier(
      valeurs[COLONNES_MODELES.periodiciteCompteur],
    ),
  };
  return schemaModeleMateriel.safeParse(saisie).success
    ? { prete: true, saisie }
    : { prete: false, motif: MOTIF_SAISIE_REFUSEE };
}

/* ────────────────────────────────────────────────────────────────────────
 * LE GABARIT « PRESTATIONS » (L1-12 ; D109, D113)
 * ──────────────────────────────────────────────────────────────────────── */

export const COLONNES_PRESTATIONS = {
  code: "Code",
  libelle: "Libellé",
  famille: "Famille (code)",
  dureeStandard: "Durée standard (minutes)",
  checklist: "Checklist type",
} as const;

export const CHAMPS_PRESTATIONS: Readonly<Record<string, string>> = {
  [COLONNES_PRESTATIONS.code]: "code",
  [COLONNES_PRESTATIONS.libelle]: "libelle",
  [COLONNES_PRESTATIONS.checklist]: "checklist_type",
};

/**
 * LES CHAMPS ÉCARTÉS, chacun avec son motif — *un champ écarté sans motif est
 * un champ oublié, et rien ne les distingue.*
 */
export const CHAMPS_PRESTATIONS_ECARTES: Readonly<Record<string, string>> = {
  famille_id: "résolu depuis la colonne « Famille », par son CODE (D101)",
  duree_standard_min:
    "exposée par « Durée standard (minutes) », lue comme un nombre",
  actif: "un import ne désactive pas : ce geste se fait fiche par fiche",
};

/**
 * LE GABARIT « PRESTATIONS » — et il n'expose AUCUNE colonne de prix.
 *
 * **Ce n'est pas une omission, c'est D109 :** *une prestation porte une durée,
 * jamais un taux.* Une colonne « Tarif » dans ce tableur ferait entrer un
 * montant par la porte que la table a fermée — et un import est précisément le
 * chemin où personne ne relit ce qui entre.
 *
 * **Et aucune colonne de forfait non plus** (D113) : le pont de D109 passe par
 * l'INTERVENTION, qui reçoit son forfait par les trois axes de RG-TAR-06.
 *
 * ## LA FAMILLE EST UN PARENT FACULTATIF, et c'est le premier de ce fichier
 *
 * Les gabarits qui désignent un parent le rendent jusqu'ici OBLIGATOIRE — un
 * contact a un client, un modèle a une famille. **Celui-ci ne l'exige pas** :
 * *un déplacement, un diagnostic ou une formation ne visent aucune famille de
 * matériel.* La conséquence est écrite plutôt que déduite : une cellule VIDE
 * n'est pas un parent introuvable — elle est l'absence de parent, et elle
 * passe. Une cellule RENSEIGNÉE qui ne désigne rien est, elle, un rejet.
 *
 * *Confondre les deux ferait rejeter toutes les prestations sans famille, soit
 * la moitié d'un catalogue ordinaire.*
 */
export function modelePrestations(familles: ParcFamilles): ModeleDImport {
  return {
    type: "prestations",
    version: 1,
    colonnes: [
      { nom: COLONNES_PRESTATIONS.code, obligatoire: true },
      { nom: COLONNES_PRESTATIONS.libelle, obligatoire: true },
      { nom: COLONNES_PRESTATIONS.famille, obligatoire: false },
      { nom: COLONNES_PRESTATIONS.dureeStandard, obligatoire: false },
      { nom: COLONNES_PRESTATIONS.checklist, obligatoire: false },
    ],
    // LE CODE SEUL IDENTIFIE, et la base le tient : `@@unique([societe_id,
    // code])`. *Ce qui rend une clé utilisable n'est pas sa forme, c'est ce que
    // la base garantit d'elle* — le libellé n'en est pas une.
    identifiantes: [COLONNES_PRESTATIONS.code],
    cle: (valeurs, rang) => {
      const code = valeurs[COLONNES_PRESTATIONS.code]?.trim();
      if (code === undefined || code === "") {
        return { forme: "rang", cle: `LIGNE-${rang}`, complet: false };
      }
      return {
        forme: "reference",
        cle: cleDeLaPrestation(code),
        complet: false,
      };
    },
    // Le VERDICT est celui de `preparerUnePrestation` — même raison qu'aux
    // sites et aux modèles : *le contrôle et l'application lisent la MÊME
    // fonction* (§9, 01/09).
    valider: (valeurs) => {
      const prepare = preparerUnePrestation(familles, valeurs);
      return prepare.prete ? null : prepare.motif;
    },
  };
}

/**
 * CE QU'UNE LIGNE DE PRESTATION DÉSIGNE, RÉSOLU UNE SEULE FOIS (R6-01).
 *
 * **La famille est FACULTATIVE, et c'est la seule des trois à l'être.** Une
 * cellule VIDE n'est pas un parent introuvable — elle est l'absence de parent,
 * et elle passe ; une cellule RENSEIGNÉE qui ne désigne rien est un rejet.
 * *Confondre les deux ferait rejeter toutes les prestations sans famille, soit
 * la moitié d'un catalogue ordinaire.*
 *
 * C'est pour cette distinction qu'elle n'est pas `preparerUnModele` avec un
 * drapeau : *les deux se ressemblent et ne disent pas la même chose*, et un
 * paramètre `familleObligatoire` ferait décider à l'appelant une règle qui
 * appartient au gabarit.
 */
export type PrestationALecrire =
  | { readonly prete: true; readonly saisie: Record<string, unknown> }
  | { readonly prete: false; readonly motif: string };

export function preparerUnePrestation(
  familles: ParcFamilles,
  valeurs: Readonly<Record<string, string | undefined>>,
): PrestationALecrire {
  const brut = valeurs[COLONNES_PRESTATIONS.famille]?.trim();
  const nommee = brut !== undefined && brut !== "";
  const famille = nommee ? familles.parCode.get(brut.toUpperCase()) : undefined;
  if (nommee && famille === undefined) {
    return { prete: false, motif: MOTIF_PARENT_INTROUVABLE };
  }
  const saisie = {
    ...saisieDepuisLaLigne(valeurs, CHAMPS_PRESTATIONS),
    famille_id: famille ?? null,
    duree_standard_min: lireUnEntier(
      valeurs[COLONNES_PRESTATIONS.dureeStandard],
    ),
  };
  return schemaPrestation.safeParse(saisie).success
    ? { prete: true, saisie }
    : { prete: false, motif: MOTIF_SAISIE_REFUSEE };
}

/* ────────────────────────────────────────────────────────────────────────
 * LE GABARIT « FAMILLES » (R6-03 ; L9-03, L9-04, L9-06, D101)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LA CHAÎNE ÉTAIT COUPÉE EN DEUX ENDROITS, ET C'ÉTAIT UN ENCHAÎNEMENT.
 *
 * *Mesuré le 15/09/2026 puis le 16/09 :* une machine exige un modèle (D6,
 * quatre champs obligatoires), un modèle exige une famille, **et la famille
 * n'avait pas de gabarit**. `parc-familles.ts` existait déjà et indexait les
 * familles comme PARENTS des modèles — *il savait les retrouver, jamais les
 * créer.* Le parc ne pouvait donc se remplir que par saisie unitaire, ce
 * qu'aucun client tiers ne fera au premier jour : l'exploitation a relevé **653
 * clients, 599 machines**.
 *
 * ## CE GABARIT ÉCRIT DE LA VGP, ET L1-05b N'EN ÉCRIVAIT PAS — la différence
 *
 * L1-05b a refusé toute colonne de VGP à son formulaire, avec ce motif : *« une
 * seconde entrée sur la même règle ne connaîtrait pas la première. »* **Le
 * motif est juste, et il ne s'applique pas ici**, ce qui se vérifie plutôt que
 * se plaide : ce gabarit ne REDIT aucune règle de L9-04 — il appelle
 * `schemaAssujettissementFamille`, le seul endroit du dépôt où elle est écrite,
 * et la base la tient une seconde fois par une contrainte. *Une entrée qui
 * appelle la règle n'est pas une seconde entrée sur la règle.*
 *
 * **Et c'est le lot 9 qui l'exige, pas la commodité** : une famille est le
 * niveau où la question a un sens réglementaire (L9-03). Un import qui
 * remplirait seize familles en les laissant toutes `a_determiner` ferait du
 * registre VGP une liste d'indéterminés de seize lignes — *l'état honnête rendu
 * inutile par le volume.*
 *
 * ## LA COLONNE VIDE NAÎT `a_determiner`, ET CE N'EST PAS UN DÉFAUT INVENTÉ
 *
 * C'est `NAISSANCE`, lu dans `lib/vgp/assujettissement.ts`, lui-même adossé au
 * `@default` de la colonne. *Écrire la valeur ici en ferait une seconde source
 * du même fait* (§9, 01/09). **Elle ne se confond pas avec « non soumise »** :
 * `non_soumis` dit « quelqu'un a répondu », `a_determiner` dit « on n'a pas
 * regardé » — et c'est exactement la distinction qu'une case à cocher détruit,
 * en faisant sortir un pont élévateur du registre en silence.
 *
 * ## LA PÉRIODICITÉ DE CETTE COLONNE N'EST PAS CELLE DU GABARIT « MODÈLES »
 *
 * **Elles sont en MOIS ici, en JOURS et en COMPTEUR là-bas, et le libellé des
 * colonnes le dit des deux côtés.** L'une est une obligation légale qui se
 * fonde sur un texte (L9-04) ; l'autre est une recommandation d'entretien du
 * constructeur. *Les mêler ferait facturer un entretien pour une vérification
 * légale, ou l'inverse.*
 */
export const COLONNES_FAMILLES = {
  code: "Code",
  libelle: "Libellé",
  assujettissement: "Assujettissement VGP",
  periodicite: "Périodicité VGP (mois)",
  reference: "Référence du texte VGP",
} as const;

/** Les colonnes qui alimentent `schemaFamilleMateriel`. */
export const CHAMPS_FAMILLES: Readonly<Record<string, string>> = {
  [COLONNES_FAMILLES.code]: "code",
  [COLONNES_FAMILLES.libelle]: "libelle",
};

/**
 * Les colonnes qui alimentent `schemaAssujettissementFamille` (L9-03, L9-04).
 *
 * **Une seconde correspondance, parce qu'il y a deux schémas** — et les fondre
 * ferait croire à un seul. *La famille et son assujettissement ne sont pas
 * validés par la même règle, et ils ne se corrigent pas au même endroit.*
 */
export const CHAMPS_FAMILLES_VGP: Readonly<Record<string, string>> = {
  [COLONNES_FAMILLES.assujettissement]: "assujettissement",
  [COLONNES_FAMILLES.periodicite]: "periodiciteMois",
  [COLONNES_FAMILLES.reference]: "referenceTexte",
};

/** Les champs de `schemaFamilleMateriel` que le gabarit n'expose pas. */
export const CHAMPS_FAMILLES_ECARTES: Readonly<Record<string, string>> = {
  actif: "un import ne désactive pas : ce geste se fait fiche par fiche",
};

/**
 * Les champs de `schemaAssujettissementFamille` non exposés — **aucun**.
 *
 * *Une liste vide est une AFFIRMATION lisible* — « les trois voyagent, et ils
 * voyagent ensemble » —, et le gardien exige qu'elle reste vraie : le jour où
 * L9 ajoutera un champ à ce schéma, il faudra l'exposer ou l'écarter ici.
 */
export const CHAMPS_FAMILLES_VGP_ECARTES: Readonly<Record<string, string>> = {};

/** La clé d'une famille : son code seul, que la base tient par un index (D101). */
export function cleDeLaFamille(code: string): string {
  return `FAMILLE-${normaliserRaisonSociale(code)}`;
}

/**
 * L'ASSUJETTISSEMENT QU'UNE CELLULE DÉCLARE — et la population vient de
 * l'ÉNUMÉRATION, jamais d'une liste recopiée ici.
 *
 * > **LE TICKET DIT « TROIS VALEURS », LA MESURE EN COMPTE QUATRE.** L9-03
 * > écrit *« TROIS valeurs : `soumis` · `non_soumis`, et `verifie` ·
 * > `a_determiner` »* — il les présente par PAIRES, et il en nomme quatre.
 * > `AssujettissementVgp` en porte quatre, et le backlog l'a déjà redressé une
 * > fois le 12/09 (*« le ticket disait trois régimes, la mesure en compte
 * > quatre »*). **Rien n'est tranché ici** : `z.enum(AssujettissementVgp)` juge,
 * > si bien que le gabarit accepte exactement ce que la base accepte, et qu'une
 * > cinquième valeur ajoutée demain sera lisible le jour même. *Recopier trois
 * > noms aurait fait refuser `verifie` — une valeur légitime rejetée pour une
 * > raison qui n'est écrite nulle part.*
 *
 * **La seule tolérance est la CASSE**, et c'est celle du code d'agence (D101) :
 * un tableur met une majuscule à la première lettre sans qu'on le lui demande.
 * *« À déterminer » n'est pas `a_determiner`* — l'accent et l'espace font une
 * autre chaîne, et elle est REFUSÉE avec son motif plutôt que devinée : une
 * tolérance qui rapprocherait les deux choisirait à la place de qui a saisi.
 */
function assujettissementDeclare(brut: string | undefined): string {
  const texte = brut?.trim();
  // **La cellule VIDE est la NAISSANCE**, et la valeur n'est pas écrite ici :
  // elle est lue dans `lib/vgp/assujettissement.ts`, qui la tient du `@default`
  // de la colonne. *Une troisième copie du même fait finirait par diverger.*
  return texte === undefined || texte === "" ? NAISSANCE : texte.toLowerCase();
}

/**
 * CE QU'UNE LIGNE DE FAMILLE DÉSIGNE, RÉSOLU UNE SEULE FOIS (R6-03).
 *
 * **Les DEUX schémas jugent**, et l'ordre se lit : la famille d'abord, son
 * assujettissement ensuite. *Un code vide et une périodicité manquante ne se
 * corrigent pas au même endroit*, mais le rapport ne rend qu'un motif — et
 * `saisie_refusee` renvoie au FICHIER dans les deux cas, ce qui est exact.
 *
 * **Une famille n'a AUCUN parent**, et c'est le seul gabarit du matériel dans
 * ce cas : elle est la racine de l'enchaînement que R6-03 décrit.
 */
export type FamilleALecrire =
  | {
      readonly prete: true;
      readonly saisie: Record<string, unknown>;
      readonly vgp: SaisieAssujettissementFamille;
    }
  | { readonly prete: false; readonly motif: string };

export function preparerUneFamille(
  valeurs: Readonly<Record<string, string | undefined>>,
): FamilleALecrire {
  const saisie = saisieDepuisLaLigne(valeurs, CHAMPS_FAMILLES);
  if (!schemaFamilleMateriel.safeParse(saisie).success) {
    return { prete: false, motif: MOTIF_SAISIE_REFUSEE };
  }

  const reference = valeurs[COLONNES_FAMILLES.reference]?.trim();
  const vgp = schemaAssujettissementFamille.safeParse({
    assujettissement: assujettissementDeclare(
      valeurs[COLONNES_FAMILLES.assujettissement],
    ),
    periodiciteMois: lireUnEntier(valeurs[COLONNES_FAMILLES.periodicite]),
    // **`null` explicite, jamais une clé absente** : le schéma porte
    // `.nullable()` SANS défaut, si bien qu'une clé manquante serait refusée
    // pour une raison qui n'est pas la bonne — et l'auteur du fichier
    // chercherait une faute dans une cellule qu'il a laissée vide exprès.
    referenceTexte:
      reference === undefined || reference === "" ? null : reference,
  });
  // C'est ICI que L9-04 mord : `soumis` sans périodicité ou sans le texte qui
  // la fonde est refusé par le `superRefine`, et la base le refuserait une
  // seconde fois. *Sans le texte, la périodicité est un chiffre que personne ne
  // peut défendre.*
  return vgp.success
    ? { prete: true, saisie, vgp: vgp.data }
    : { prete: false, motif: MOTIF_SAISIE_REFUSEE };
}

/**
 * LE GABARIT « FAMILLES » — aucun parent, et le CODE seul identifie (D101).
 *
 * *Ce qui rend une clé utilisable n'est pas sa forme, c'est ce que la base
 * garantit d'elle* : `famille_materiel` porte `@@unique([societe_id, code])`, le
 * libellé n'a aucune unicité.
 */
export const MODELE_FAMILLES: ModeleDImport = {
  type: "familles",
  version: 1,
  colonnes: [
    { nom: COLONNES_FAMILLES.code, obligatoire: true },
    { nom: COLONNES_FAMILLES.libelle, obligatoire: true },
    // **FACULTATIVES toutes les trois, et c'est la décision du ticket.** Une
    // famille dont l'assujettissement n'est pas fourni naît `a_determiner` :
    // *l'exiger ferait refuser un fichier de reprise ordinaire*, et remplir la
    // colonne au hasard pour passer le contrôle serait pire que de ne pas
    // l'avoir. L'état honnête apparaît le jour même dans `/vgp/a-determiner`.
    { nom: COLONNES_FAMILLES.assujettissement, obligatoire: false },
    { nom: COLONNES_FAMILLES.periodicite, obligatoire: false },
    { nom: COLONNES_FAMILLES.reference, obligatoire: false },
  ],
  identifiantes: [COLONNES_FAMILLES.code],
  cle: (valeurs, rang) => {
    const code = valeurs[COLONNES_FAMILLES.code]?.trim();
    if (code === undefined || code === "") {
      return { forme: "rang", cle: `LIGNE-${rang}`, complet: false };
    }
    return { forme: "reference", cle: cleDeLaFamille(code), complet: false };
  },
  valider: (valeurs) => {
    const prepare = preparerUneFamille(valeurs);
    return prepare.prete ? null : prepare.motif;
  },
};

/* ────────────────────────────────────────────────────────────────────────
 * LE GABARIT « ÉQUIPEMENTS » — TROIS parents, et le premier du dépôt (R6-03)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LES TROIS PARENTS SE NOMMENT SÉPARÉMENT DANS LE REJET (R6-03).
 *
 * `MOTIF_PARENT_INTROUVABLE` a suffi tant qu'un gabarit n'avait qu'un parent, ou
 * deux qu'on corrigeait au même endroit. **Une machine en a trois** — son
 * modèle, son client, son site (D6) —, et *« parent introuvable » sur une ligne
 * qui en nomme trois envoie chercher dans trois référentiels.* Le ticket
 * l'exige nommément : le motif dit LEQUEL.
 *
 * **Ils sont résolus dans cet ORDRE, et l'ordre est une décision** : le client,
 * puis le site, puis le modèle. *La clé d'un site CONTIENT son client*
 * (`cleDuSite`), si bien qu'un client introuvable rend le site introuvable par
 * construction — annoncer les deux ferait chercher deux corrections là où il
 * n'y en a qu'une. Le modèle est indépendant des deux : il vient en dernier
 * parce qu'il n'éclaire rien sur eux, et non parce qu'il compterait moins.
 */
export const MOTIF_CLIENT_INTROUVABLE = "client_introuvable";
export const MOTIF_SITE_INTROUVABLE = "site_introuvable";
export const MOTIF_MODELE_INTROUVABLE = "modele_introuvable";

export const COLONNES_EQUIPEMENTS = {
  client: "Client (code ou raison sociale)",
  site: "Site (libellé)",
  marque: "Marque du modèle",
  reference: "Référence du modèle",
  numeroSerie: "Numéro de série",
  referenceInterne: "Référence interne",
  localisation: "Localisation",
  criticite: "Criticité",
} as const;

export const CHAMPS_EQUIPEMENTS: Readonly<Record<string, string>> = {
  [COLONNES_EQUIPEMENTS.localisation]: "localisation",
  [COLONNES_EQUIPEMENTS.criticite]: "criticite",
};

/**
 * LA CRITICITÉ DÉCLARÉE — la même tolérance de CASSE que l'assujettissement
 * (`assujettissementDeclare`, `lib/vgp/assujettissement.ts`) et que les codes
 * d'agence et de famille (D101). *Mesuré (D-05) : une ligne autrement valide,
 * avec « Normale » recopiée telle qu'un tableur la met en forme tout seul, se
 * rejetait `saisie_refusee` — indistinguable d'une criticité réellement
 * fausse.* **Rien n'est tranché ici** : `z.enum(CRITICITES_MACHINE)` reste le
 * seul juge, et une valeur qui ne lui correspond toujours pas après ce
 * rabattement est refusée comme avant, avec le même motif.
 *
 * *Ce que ceci n'est PAS* : aucune distance d'édition, aucun score, aucun
 * rapprochement sur une ressemblance — seulement l'équivalence de casse déjà
 * appliquée ailleurs dans ce fichier pour la même raison.
 */
function criticiteDeclaree(brut: string | undefined): string | undefined {
  const texte = brut?.trim();
  return texte === undefined || texte === "" ? undefined : texte.toLowerCase();
}

/**
 * LES CHAMPS DE `champsMachine` QUE LE GABARIT N'EXPOSE PAS — avec leur motif.
 *
 * *Un champ écarté sans motif est un champ oublié, et rien ne les distingue.*
 */
export const CHAMPS_EQUIPEMENTS_ECARTES: Readonly<Record<string, string>> = {
  client_id: "résolu depuis la colonne « Client », jamais saisi (I10)",
  site_id:
    "résolu depuis « Site », par le couple (client, libellé) — la règle de D101",
  modele_id:
    "résolu depuis « Marque » et « Référence », le couple qui identifie un modèle (L1-09d)",
  // **Le numéro de série et la référence interne sont exposés, mais PAS par ce
  // tableau** : ils ne se recopient pas d'une cellule dans un champ, ils
  // passent par la clé de rapprochement — voir `preparerUnEquipement`.
  numero_serie:
    "exposé par « Numéro de série », mais DÉRIVÉ de la clé de rapprochement (D6)",
  reference_interne:
    "exposé par « Référence interne », et lu par la même clé que le numéro de série",
  // *Mesuré le 16/09/2026, dans `lib/excel/controle.ts` :* `texte()` lisait
  // `cellule.texte` puis `cellule.nombre`, et une cellule de DATE ne porte ni
  // l'un ni l'autre — elle porte `serie`. Le dictionnaire de ligne rendait donc
  // `undefined` pour toute date, et la condition de levée était écrite : *« le
  // jour où le dictionnaire de ligne rendra une date »*.
  //
  // **CE JOUR EST ARRIVÉ le 22/09/2026** (REPRISE-HISTORIQUE) : le dictionnaire
  // rend `JJ/MM/AAAA`, et le gabarit de l'historique lit une date. Ces trois
  // colonnes restent ÉCARTÉES pour une autre raison, écrite plutôt que tue :
  // les exposer demande de les LIRE (`lireDate`), de les ÉCRIRE
  // (`schemaMachine` attend un `Date`) et de les COMPARER à l'annulation — un
  // ticket du gabarit des équipements, pas de celui qui a levé la borne.
  // **Condition de levée, vérifiable :** un ticket sur ce gabarit qui appelle
  // `lireDate` sur ces trois colonnes et éprouve leur annulation.
  date_mise_en_service:
    "lisible depuis le 22/09/2026, non exposée : lecture, écriture et annulation d'une date sont un ticket de ce gabarit",
  date_vente:
    "lisible depuis le 22/09/2026, non exposée : lecture, écriture et annulation d'une date sont un ticket de ce gabarit",
  garantie_fin:
    "lisible depuis le 22/09/2026, non exposée : lecture, écriture et annulation d'une date sont un ticket de ce gabarit",
  // *Un nombre dont la signification dépend d'une autre colonne ne voyage
  // jamais seul* (D56), et une référence de facture sans sa date de vente ni sa
  // fin de garantie est exactement cela : une trace qu'on ne peut pas dater.
  facture_origine:
    "elle ne voyage pas sans la date de vente ni la fin de garantie, que la grammaire ne rend pas (D56)",
  // Le cycle de vie est un geste daté — une réforme, une panne constatée —, et
  // `fusionnee` n'a qu'un producteur (D28, L3-10). *Une colonne « Statut »
  // permettrait à un fichier de déclarer une fusion que personne n'a faite.*
  statut:
    "le cycle de vie se joue fiche par fiche ; `fusionnee` n'a qu'un producteur (D28)",
  // **Il n'est pas une donnée du fichier : c'est le CHEMIN qui le sait**, et il
  // vaut `import`. *Un fichier qui prétendrait « terrain » mentirait sur la
  // provenance d'une fiche, dans le seul chemin où personne ne relit ce qui
  // entre.*
  source_creation:
    "posé par le chemin lui-même — il vaut `import`, jamais ce qu'un fichier déclare",
  // Un remplacement se désigne par un identifiant technique que personne ne
  // connaît (I10), et c'est un geste daté plutôt qu'une colonne.
  machine_remplacee_id:
    "un remplacement est un geste daté, et il désignerait un identifiant technique (I10)",
};

/**
 * CE QU'UNE LIGNE D'ÉQUIPEMENT DÉSIGNE, RÉSOLU UNE SEULE FOIS (R6-03).
 *
 * ## LA CLÉ EST CELLE DU CONTRÔLE, APPELÉE ET JAMAIS RECOPIÉE
 *
 * `cleDeRapprochement` — la fonction de L1-08b, dont L2-01 et L1-08f ont déjà
 * arrêté la forme : **série nue, référence préfixée `SN-INCONNU-`, rang préfixé
 * `LIGNE-`, trois espaces DISJOINTS.** *Elle n'avait aucun appelant réel* — la
 * maladie que R3-12 nomme —, et ce gabarit est le premier.
 *
 * **Et c'est elle qui compose le numéro de série**, plutôt qu'une seconde règle
 * écrite ici : quand la plaque est illisible, `cle.cle` vaut déjà
 * `SN-INCONNU-<référence>` (D6). *Recomposer la chaîne ici ferait deux lectures
 * d'un même critère, et la divergence se verrait au pire endroit — entre la clé
 * qui rapproche et le numéro qui s'écrit.*
 *
 * **La forme `rang` ne devient PAS un numéro de série**, et c'est le piège que
 * ce commentaire existe pour fermer : `LIGNE-3` est une chaîne non vide, donc
 * `texteNonVide` l'accepterait — une machine naîtrait avec « LIGNE-3 » gravé
 * pour toujours. La ligne n'en reçoit donc aucun, et la saisie la refuse.
 *
 * ## `complet` N'EST PAS ÉCRIT ICI NON PLUS
 *
 * `schemaMachine` le DÉDUIT du numéro de série (§6). *Un gabarit qui exposerait
 * une colonne « Complet » laisserait un fichier mentir sur la qualité d'une
 * fiche* — et le champ n'existe pas dans `champsMachine`, si bien qu'on ne peut
 * pas l'ajouter par distraction.
 */
export type EquipementALecrire =
  | { readonly prete: true; readonly saisie: Record<string, unknown> }
  | { readonly prete: false; readonly motif: string };

export function preparerUnEquipement(
  clients: ParcClientsIndexe,
  sites: ParcDesFiches,
  modeles: ParcDesFiches,
  valeurs: Readonly<Record<string, string | undefined>>,
  rang: number,
): EquipementALecrire {
  const client = clientDesignePar(
    clients,
    valeurs[COLONNES_EQUIPEMENTS.client],
  );
  if (client === undefined) {
    return { prete: false, motif: MOTIF_CLIENT_INTROUVABLE };
  }

  const libelle = valeurs[COLONNES_EQUIPEMENTS.site]?.trim();
  const site =
    libelle === undefined || libelle === ""
      ? undefined
      : sites.fiches.get(cleDuSite(client, libelle));
  if (site === undefined) {
    return { prete: false, motif: MOTIF_SITE_INTROUVABLE };
  }

  const marque = valeurs[COLONNES_EQUIPEMENTS.marque]?.trim();
  const reference = valeurs[COLONNES_EQUIPEMENTS.reference]?.trim();
  const modele =
    marque === undefined ||
    marque === "" ||
    reference === undefined ||
    reference === ""
      ? undefined
      : modeles.fiches.get(cleDuModele(marque, reference));
  if (modele === undefined) {
    return { prete: false, motif: MOTIF_MODELE_INTROUVABLE };
  }

  const cle = cleEquipement(valeurs, rang);
  const criticite = criticiteDeclaree(valeurs[COLONNES_EQUIPEMENTS.criticite]);
  const saisie = {
    ...saisieDepuisLaLigne(valeurs, CHAMPS_EQUIPEMENTS),
    modele_id: modele,
    client_id: client,
    site_id: site,
    // La forme `rang` ne désigne AUCUNE machine : la ligne n'a ni série ni
    // référence, et lui donner `LIGNE-<n>` pour numéro de série graverait le
    // rang d'un tableur sur une fiche. Le champ reste absent, `texteNonVide`
    // refuse, et le rapport dit « saisie refusée ».
    ...(cle.forme === "rang" ? {} : { numero_serie: cle.cle }),
    reference_interne: valeurs[COLONNES_EQUIPEMENTS.referenceInterne]?.trim(),
    // **Le CHEMIN le sait, le fichier ne le déclare pas** (voir les écartés).
    source_creation: "import",
    // Remplace la copie brute de `CHAMPS_EQUIPEMENTS` par sa forme rabattue —
    // voir `criticiteDeclaree`. Absente si la cellule l'est : le défaut du
    // schéma (`normale`) s'applique alors, inchangé.
    ...(criticite === undefined ? {} : { criticite }),
  };
  return schemaMachine.safeParse(saisie).success
    ? { prete: true, saisie }
    : { prete: false, motif: MOTIF_SAISIE_REFUSEE };
}

/**
 * LA CLÉ D'UNE LIGNE D'ÉQUIPEMENT — `cleMachineDepuis`, et rien d'autre.
 *
 * Elle est écrite une fois et appelée par `cle` ET par `preparerUnEquipement` :
 * *le rapprochement et l'écriture lisent la même clé, ou ils ne parlent pas de
 * la même machine.*
 */
const cleEquipement = cleMachineDepuis(
  COLONNES_EQUIPEMENTS.numeroSerie,
  COLONNES_EQUIPEMENTS.referenceInterne,
);

/**
 * LE CLIENT QU'UNE CELLULE DÉSIGNE — par son code, puis par sa raison sociale.
 *
 * **Extraite de `clientDuSite` plutôt que recopiée** (R6-03) : trois gabarits
 * nomment désormais un client — contacts, sites, équipements — et *une seconde
 * règle de rapprochement des clients se verrait au pire moment, des machines
 * accrochées au mauvais client.* `clientDuSite` l'appelle, et ne fait plus que
 * lui passer sa colonne.
 */
export function clientDesignePar(
  clients: ParcClientsIndexe,
  designation: string | undefined,
): string | undefined {
  const brut = designation?.trim();
  if (brut === undefined || brut === "") return undefined;
  return (
    clients.fiches.get(
      cleDeClient({ codeExterne: brut, raisonSociale: undefined, rang: 0 }).cle,
    ) ??
    clients.fiches.get(
      cleDeClient({ codeExterne: undefined, raisonSociale: brut, rang: 0 }).cle,
    )
  );
}

/**
 * LE GABARIT « ÉQUIPEMENTS » — les quatre obligatoires de D6, et pas un de plus.
 *
 * **Quatre colonnes obligatoires pour quatre champs obligatoires** : le client,
 * le site, la marque et la référence du modèle — et le numéro de série, qui est
 * le quatrième de D6 sans être une colonne obligatoire. *C'est la seule entorse
 * apparente, et elle est mesurée* : D6 veut un numéro de série, et il accepte
 * que la plaque soit illisible — la colonne « Référence interne » prend alors le
 * relais, et la fiche entre `complet = false`. **Exiger la colonne « Numéro de
 * série » rejetterait précisément les fiches que la file de complétion existe
 * pour rattraper.**
 */
export function modeleEquipements(
  clients: ParcClientsIndexe,
  sites: ParcDesFiches,
  modeles: ParcDesFiches,
): ModeleDImport {
  return {
    type: "equipements",
    version: 1,
    colonnes: [
      { nom: COLONNES_EQUIPEMENTS.client, obligatoire: true },
      { nom: COLONNES_EQUIPEMENTS.site, obligatoire: true },
      { nom: COLONNES_EQUIPEMENTS.marque, obligatoire: true },
      { nom: COLONNES_EQUIPEMENTS.reference, obligatoire: true },
      { nom: COLONNES_EQUIPEMENTS.numeroSerie, obligatoire: false },
      { nom: COLONNES_EQUIPEMENTS.referenceInterne, obligatoire: false },
      { nom: COLONNES_EQUIPEMENTS.localisation, obligatoire: false },
      { nom: COLONNES_EQUIPEMENTS.criticite, obligatoire: false },
    ],
    // **Le CLIENT est identifiant, et c'est ce qui évite une perte silencieuse.**
    // Avec les seules colonnes de série et de référence, une ligne qui nomme un
    // client et un site sans numéro serait lue comme un reste de GABARIT (§
    // `natureDeLigne`) — *comptée, ignorée, et jamais rejetée.* Elle est donc
    // une DONNÉE, et la saisie la refuse bruyamment.
    identifiantes: [
      COLONNES_EQUIPEMENTS.client,
      COLONNES_EQUIPEMENTS.numeroSerie,
      COLONNES_EQUIPEMENTS.referenceInterne,
    ],
    cle: cleEquipement,
    valider: (valeurs, rang) => {
      const prepare = preparerUnEquipement(
        clients,
        sites,
        modeles,
        valeurs,
        rang,
      );
      return prepare.prete ? null : prepare.motif;
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * LE GABARIT « HISTORIQUE » — l'archive SAV, reprise close (REPRISE-HISTORIQUE ; D127)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LE HUITIÈME GABARIT, ET LE PREMIER QUI ÉCRIT UN FAIT PASSÉ.
 *
 * ## Ce qu'il est, mesuré et non supposé
 *
 * Sept gabarits publiaient des RÉFÉRENTIELS ; aucun ne portait l'historique
 * des interventions, et l'exploitation avait **1 996 lignes d'archive SAV**
 * prêtes, aux dix colonnes ci-dessous — mesurées sur le classeur réel le
 * 22/09/2026, jamais supposées (I9 : le fichier n'entre pas au dépôt, le
 * gabarit si). Ce qui a été mesuré, et ce que chaque mesure impose :
 *
 * | Mesure | Ce qu'elle impose |
 * |---|---|
 * | `N° document` : **1 996 distincts sur 1 996** | c'est la CLÉ ; un second dépôt du même fichier ne duplique rien |
 * | 34 lignes sans code client, **toutes** avec une raison sociale | `cleDeClient` (RG-IMP-05) les sert entièrement — **aucune seconde règle** |
 * | **1 496 sur 1 996** sans n° de série | la machine est FACULTATIVE, et « non rattachée » est une issue, jamais un rejet |
 * | 1 965 FACTURE, 31 AVOIR | le type de document est un texte gardé tel quel — aucune liste close n'existe au schéma pour lui (doctrine §5) |
 * | dates en texte ISO dans le classeur d'origine | REFUSÉES `date_format` : le fichier remis a été converti en vraies dates, la grammaire n'est pas assouplie |
 *
 * ## Ce que ce gabarit ÉCRIT, et ce qu'il ne peut pas écrire
 *
 * Il écrit une intervention `cloturee`, `facturee`, de type `curatif`, sans
 * temps, avec sa date, son client, son site, son agence, son montant — et
 * zéro ou une machine (`lib/imports/reprise.ts` porte les trois faits de
 * l'arbitrage et le choix du type, avec leurs motifs). **Cinq colonnes n'ont
 * aucune arrivée sur `intervention`** — type et n° de document, référence OR,
 * technicien, objet — et vivent dans `import_lot_ligne.valeurs` : c'est écrit
 * au schéma de la ligne, pas tu. *Une migration est un arbitrage.*
 *
 * ## LE SITE, quand la ligne ne le nomme pas — la seule règle que ce gabarit pose
 *
 * `intervention.site_id` est `NOT NULL` et la colonne « Site » est
 * facultative, mesurée. Quand elle est vide : **si le client n'a qu'UN site,
 * c'est lui** — le seul possible, le même raisonnement que le rang 2 de D127,
 * *une conjonction qui n'en désigne qu'une* ; **s'il en a plusieurs, ou
 * aucun, la ligne est REJETÉE** `site_indetermine` — elle ne dit pas où, et
 * deviner attribuerait une visite à un lieu. Aucune ressemblance, aucun
 * « site principal » : la base ne connaît pas cette notion.
 * **Condition de réouverture, vérifiable :** une règle du chapitre 10 qui dit
 * quel site une ligne d'archive sans site désigne.
 */
export const COLONNES_HISTORIQUE = {
  date: "Date",
  typeDocument: "Type de document",
  numeroDocument: "N° document",
  client: "Client (code ou raison sociale)",
  site: "Site (libellé)",
  machine: "Machine (n° de série)",
  referenceOr: "Référence OR",
  technicien: "Technicien",
  objet: "Objet de l'intervention",
  montant: "Montant HT (XPF)",
} as const;

/** Les colonnes recopiées TELLES QUELLES dans un champ du schéma de la ligne. */
export const CHAMPS_HISTORIQUE: Readonly<Record<string, string>> = {
  [COLONNES_HISTORIQUE.typeDocument]: "type_document",
  [COLONNES_HISTORIQUE.numeroDocument]: "numero_document",
  [COLONNES_HISTORIQUE.referenceOr]: "reference_or",
  // **UN TEXTE, jamais une clé vers `technicien`** : les prénoms de l'archive
  // ne sont pas des comptes de la plateforme.
  [COLONNES_HISTORIQUE.technicien]: "technicien",
  // Un texte libre, et il le RESTE : *aucun `TypeIntervention` ne se déduit
  // d'un texte libre par ressemblance* (D127).
  [COLONNES_HISTORIQUE.objet]: "objet",
};

/**
 * Les champs du schéma de la ligne que le gabarit n'expose pas TELS QUELS —
 * chacun avec la colonne qui le porte et la lecture qui le traduit.
 */
export const CHAMPS_HISTORIQUE_ECARTES: Readonly<Record<string, string>> = {
  date: "exposée par « Date », lue par `lireDate` — sérial de tableur ou JJ/MM/AAAA, rien d'autre (D31)",
  client_id:
    "résolu depuis « Client (code ou raison sociale) », par `cleDeClient` (RG-IMP-05), jamais saisi (I10)",
  site_id:
    "résolu depuis « Site (libellé) » par le couple (client, libellé) ; à défaut, le SEUL site du client",
  agence_id:
    "déduite du site, jamais saisie (D56) — comme pour toute intervention",
  machine_id:
    "rapprochée depuis « Machine (n° de série) » par les trois rangs de D127 ; nulle au rang 3, jamais créée",
  montant_ht:
    "exposé par « Montant HT (XPF) », lu comme un nombre ENTIER dans l'unité de la devise (I3), jamais converti (I2)",
  devise_code:
    "celle de la société, posée avec le montant — la colonne est en XPF, et une autre devise refuse la colonne (I2)",
};

/** Les motifs propres à ce gabarit — des CODES, les libellés sont au dictionnaire. */
export const MOTIF_SITE_INDETERMINE = "site_indetermine";
export const MOTIF_DOCUMENT_DEJA_REPRIS = "document_deja_repris";
export const MOTIF_MONTANT_ILLISIBLE = "montant_illisible";
export const MOTIF_MONTANT_DEVISE = "montant_devise";

export type RepriseALecrire =
  | {
      readonly prete: true;
      readonly saisie: LigneHistorique;
      readonly rattachement: Rattachement;
    }
  | { readonly prete: false; readonly motif: string };

/**
 * LE MONTANT, LU PAR LA GRAMMAIRE DES NOMBRES — et rien de plus tolérant.
 *
 * Le dictionnaire de ligne a effacé la différence entre une cellule
 * NUMÉRIQUE (`12500`, rendue `"12500"`) et un texte : `lireNombre({ texte })`
 * les lit toutes deux par la forme de D31 — virgule décimale, aucun
 * séparateur de milliers —, et un entier de francs n'a ni l'une ni l'autre.
 * *Ce qui ne se lit pas ainsi ne se devine pas.* Rend `null` pour une
 * cellule vide, le montant en bigint sinon, ou le motif.
 */
function lireLeMontant(
  brut: string | undefined,
  devise: Devise,
):
  | { readonly ok: true; readonly montant: bigint | null }
  | { readonly ok: false; readonly motif: string } {
  const texte = brut?.trim();
  if (texte === undefined || texte === "") {
    return { ok: true, montant: null };
  }
  const lu = lireNombre({ texte });
  if (!lu.ok) {
    return { ok: false, motif: MOTIF_MONTANT_ILLISIBLE };
  }
  // I3 : jamais plus de décimales que la devise n'en admet. **Le calcul est
  // celui de `lib/money`** — `uniteParDevise`, seul point du dépôt où la
  // puissance de dix se calcule — et il se fait en entiers : les chiffres lus,
  // portés à l'unité la plus fine, doivent tomber juste. `12,5` sous XPF ne
  // tombe pas juste ; il n'est pas arrondi, il refuse.
  const diviseur = BigInt(10) ** BigInt(lu.valeur.decimales);
  const porte = lu.valeur.chiffres * uniteParDevise(devise);
  if (porte % diviseur !== BigInt(0)) {
    return { ok: false, motif: MOTIF_MONTANT_ILLISIBLE };
  }
  // La colonne est libellée en XPF ; une société qui tient ses comptes dans
  // une autre devise ne peut pas la recevoir sans conversion — refusée (I2).
  if (devise.code !== "XPF") {
    return { ok: false, motif: MOTIF_MONTANT_DEVISE };
  }
  return { ok: true, montant: porte / diviseur };
}

/**
 * LA DATE, RELUE PAR LA GRAMMAIRE depuis le texte que le dictionnaire rend.
 *
 * Le dictionnaire a rendu `JJ/MM/AAAA` pour une vraie date de tableur, et le
 * texte brut pour tout le reste — l'ISO du classeur d'origine, une faute de
 * frappe, un sérial fractionnaire. `lireDate` juge ; le CODE d'anomalie
 * devient le motif de rejet de la ligne, et le dictionnaire le libelle.
 */
function lireLaDate(
  brut: string | undefined,
):
  | { readonly ok: true; readonly date: Date | null }
  | { readonly ok: false; readonly motif: CodeAnomalie } {
  const texte = brut?.trim();
  if (texte === undefined || texte === "") {
    // L'absence est jugée par le schéma (`z.date()` refuse `undefined`), sous
    // `saisie_refusee` — la correction est dans le fichier.
    return { ok: true, date: null };
  }
  const lue = lireDate({ texte });
  return lue.ok
    ? { ok: true, date: lue.valeur }
    : { ok: false, motif: lue.anomalie.code };
}

/**
 * CE QU'UNE LIGNE D'HISTORIQUE DÉSIGNE, RÉSOLU UNE SEULE FOIS — le contrôle,
 * l'application, l'annulation et le rapport lisent la MÊME fonction (§9, 01/09).
 *
 * **L'ordre des refus est une décision, et il se lit** : le document déjà
 * repris d'abord — *rien d'autre ne mérite d'être corrigé sur une ligne qui
 * n'entrera pas* —, puis le client, le site, la date, le montant, et le
 * schéma en dernier. Chaque motif dit où corriger : le parc, le fichier, ou
 * nulle part.
 *
 * **La machine ne refuse JAMAIS** : son rattachement est rendu à côté de la
 * saisie, pour que le rapport le compte par rang.
 */
export function preparerUneReprise(
  parcs: ParcsDImport,
  valeurs: Readonly<Record<string, string | undefined>>,
): RepriseALecrire {
  const numero = valeurs[COLONNES_HISTORIQUE.numeroDocument]?.trim();
  if (
    numero !== undefined &&
    numero !== "" &&
    parcs.historique.fiches.has(cleDuDocument(numero))
  ) {
    return { prete: false, motif: MOTIF_DOCUMENT_DEJA_REPRIS };
  }

  const client = clientDesignePar(
    parcs.clients,
    valeurs[COLONNES_HISTORIQUE.client],
  );
  if (client === undefined) {
    return { prete: false, motif: MOTIF_CLIENT_INTROUVABLE };
  }

  const site = siteDeLaReprise(
    parcs,
    client,
    valeurs[COLONNES_HISTORIQUE.site],
  );
  if (!site.ok) {
    return { prete: false, motif: site.motif };
  }

  const date = lireLaDate(valeurs[COLONNES_HISTORIQUE.date]);
  if (!date.ok) {
    return { prete: false, motif: date.motif };
  }

  const montant = lireLeMontant(
    valeurs[COLONNES_HISTORIQUE.montant],
    parcs.devise,
  );
  if (!montant.ok) {
    return { prete: false, motif: montant.motif };
  }

  const rattachement = rattacherLaMachine(
    valeurs[COLONNES_HISTORIQUE.machine],
    client,
    parcs.machines,
  );

  const saisie = schemaLigneHistorique.safeParse({
    ...saisieDepuisLaLigne(valeurs, CHAMPS_HISTORIQUE),
    // `null` explicite pour les facultatifs vides : le schéma les porte
    // `.nullable().default(null)`, et une clé absente y suffit aussi — mais
    // les nommer rend la ligne lisible.
    reference_or: valeurs[COLONNES_HISTORIQUE.referenceOr]?.trim() || null,
    technicien: valeurs[COLONNES_HISTORIQUE.technicien]?.trim() || null,
    // `undefined` quand la date manque : `z.date()` refuse, et c'est
    // `saisie_refusee` — la correction est dans le fichier.
    ...(date.date === null ? {} : { date: date.date }),
    client_id: client,
    site_id: site.siteId,
    agence_id: site.agenceId,
    machine_id: "machineId" in rattachement ? rattachement.machineId : null,
    montant_ht: montant.montant,
    devise_code: montant.montant === null ? null : parcs.devise.code,
  });
  return saisie.success
    ? { prete: true, saisie: saisie.data, rattachement }
    : { prete: false, motif: MOTIF_SAISIE_REFUSEE };
}

/** Le site d'une ligne d'historique — nommé, ou le seul du client. */
function siteDeLaReprise(
  parcs: ParcsDImport,
  clientId: string,
  libelle: string | undefined,
):
  | { readonly ok: true; readonly siteId: string; readonly agenceId: string }
  | { readonly ok: false; readonly motif: string } {
  const nomme = libelle?.trim();
  if (nomme !== undefined && nomme !== "") {
    const siteId = parcs.sites.fiches.get(cleDuSite(clientId, nomme));
    const detail =
      siteId === undefined ? undefined : parcs.sitesDetails.get(siteId);
    return siteId === undefined || detail === undefined
      ? { ok: false, motif: MOTIF_SITE_INTROUVABLE }
      : { ok: true, siteId, agenceId: detail.agenceId };
  }
  const duClient = [...parcs.sitesDetails].filter(
    ([, detail]) => detail.clientId === clientId,
  );
  const seul = duClient[0];
  if (duClient.length !== 1 || seul === undefined) {
    return { ok: false, motif: MOTIF_SITE_INDETERMINE };
  }
  return { ok: true, siteId: seul[0], agenceId: seul[1].agenceId };
}

/**
 * LE GABARIT « HISTORIQUE » — le N° document identifie, et lui seul.
 *
 * **Le client et l'objet sont identifiants avec lui**, pour la raison des
 * équipements : une ligne qui nomme un client et décrit un travail sans
 * porter de numéro est une DONNÉE qui manque de sa clé — refusée
 * bruyamment —, jamais un reste de gabarit compté en silence.
 *
 * **`complet` vaut `true`** (forme « serie ») : la clé est un vrai numéro,
 * jamais reconstituée.
 * Le rattachement de la machine n'y est pas encodé — *un drapeau ne porte pas
 * trois rangs* —, il se lit par `preparerUneReprise`, comme le rapport le fait.
 */
export function modeleHistorique(parcs: ParcsDImport): ModeleDImport {
  return {
    type: "historique",
    version: 1,
    colonnes: [
      { nom: COLONNES_HISTORIQUE.date, obligatoire: true },
      { nom: COLONNES_HISTORIQUE.typeDocument, obligatoire: true },
      { nom: COLONNES_HISTORIQUE.numeroDocument, obligatoire: true },
      { nom: COLONNES_HISTORIQUE.client, obligatoire: true },
      { nom: COLONNES_HISTORIQUE.site, obligatoire: false },
      { nom: COLONNES_HISTORIQUE.machine, obligatoire: false },
      { nom: COLONNES_HISTORIQUE.referenceOr, obligatoire: false },
      { nom: COLONNES_HISTORIQUE.technicien, obligatoire: false },
      { nom: COLONNES_HISTORIQUE.objet, obligatoire: true },
      { nom: COLONNES_HISTORIQUE.montant, obligatoire: false },
    ],
    identifiantes: [
      COLONNES_HISTORIQUE.numeroDocument,
      COLONNES_HISTORIQUE.client,
      COLONNES_HISTORIQUE.objet,
    ],
    cle: (valeurs, rang) => {
      const numero = valeurs[COLONNES_HISTORIQUE.numeroDocument]?.trim();
      if (numero === undefined || numero === "") {
        return { forme: "rang", cle: `LIGNE-${rang}`, complet: false };
      }
      // La forme « serie » est celle d'une clé COMPLÈTE — le code externe d'un
      // client la prend aussi (`cleDeClient`) : *ce qui identifie vraiment*.
      return { forme: "serie", cle: cleDuDocument(numero), complet: true };
    },
    valider: (valeurs) => {
      const prepare = preparerUneReprise(parcs, valeurs);
      return prepare.prete ? null : prepare.motif;
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * LES GABARITS QUE CODIPLAN PUBLIE, ÉNUMÉRÉS UNE SEULE FOIS (R6-01)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LES TROIS PARCS DONT LES GABARITS ONT BESOIN pour résoudre leurs parents.
 *
 * *Ils répondent à « que désigne cette cellule ? » et jamais à « cette fiche
 * existe-t-elle déjà ? »* — la seconde question est celle de `parc-cibles.ts`,
 * et les confondre fait de chaque ligne une création.
 */
export type ParcsDImport = {
  readonly clients: ParcClientsIndexe;
  readonly agences: ParcAgences;
  readonly familles: ParcFamilles;
  /**
   * LES SITES ET LES MODÈLES, PARENTS D'UN ÉQUIPEMENT (R6-03).
   *
   * **Ils répondaient déjà à l'autre question**, et c'est le fait qui décide de
   * ne pas écrire deux modules de plus : `indexerLeParcSites` et
   * `indexerLeParcModeles` vivent dans `parc-cibles.ts` parce qu'ils disent
   * *« cette fiche existe-t-elle déjà ? »*. À partir d'aujourd'hui ils disent
   * aussi *« que désigne cette cellule ? »*, exactement comme l'index des
   * clients le fait depuis L1-08g.
   *
   * *La note de `parc-cibles.ts` disait « l'index des clients est le SEUL qui
   * réponde aux deux, parce qu'un client n'a pas de parent ».* **C'est cette
   * phrase que R6-03 périme, et non le découpage** : ce qui rendait le client
   * unique n'était pas qu'il réponde aux deux questions, c'est que rien ne le
   * désignait. Écrire un `parc-sites.ts` de parents à côté serait la seconde
   * implémentation d'une clé — *rien ne se rapprocherait plus, et tout
   * deviendrait création* (§9, 01/09).
   */
  readonly sites: ParcDesFiches;
  readonly modeles: ParcDesFiches;
  /**
   * CE QUE LE GABARIT DE L'HISTORIQUE DEMANDE EN PLUS (REPRISE-HISTORIQUE).
   *
   * Les détails des sites — client et agence de chacun —, pour résoudre le
   * SEUL site d'un client quand la ligne n'en nomme aucun ; les machines par
   * série avec leur client, pour les trois rangs de D127 ; les documents déjà
   * repris, pour que la clé ne duplique rien ; et la devise de la société,
   * pour lire un montant sans le convertir (I2, I3). **Aucun n'a de défaut** :
   * un parc oublié ferait de chaque document une création, en silence.
   */
  readonly sitesDetails: ReadonlyMap<string, DetailDeSite>;
  readonly machines: ParcMachines;
  readonly historique: ParcDesFiches;
  readonly devise: Devise;
};

/**
 * CE QU'UN PARENT EXIGE D'UN INDEX, et rien de plus.
 *
 * *Un gabarit a besoin de retrouver une fiche par sa clé ; il n'a que faire des
 * clés ambiguës, que le CONTRÔLE consulte.* Le type est donc structurel plutôt
 * qu'importé : `ParcCible` le satisfait, `ParcClientsIndexe` aussi, et ce
 * fichier ne dépend d'aucun des deux — ce qui lui évite un cycle avec
 * `parc-cibles.ts`, qui appelle ses clés.
 */
export type ParcDesFiches = {
  readonly fiches: ReadonlyMap<string, string>;
};

/**
 * LES HUIT GABARITS, CONSTRUITS ENSEMBLE — sept référentiels, et l'historique.
 *
 * **Jusqu'à R6-01, aucune liste ne les réunissait** : la route de contrôle
 * nommait `MODELE_CLIENTS` et elle seule, si bien que les quatre autres
 * n'avaient **aucun appelant** — mesuré le 16/09/2026, en contrôlant une
 * feuille de sites par le chemin de la route : anomalie `marqueur_autre_type`,
 * c'est-à-dire *un fichier de sites refusé à la première cellule.* Les gabarits
 * existaient, leur contrôle était éprouvé, et rien ne pouvait les atteindre.
 *
 * **L'ordre n'a aucune importance** : le choix se fait par le MARQUEUR (D31),
 * jamais par un rang.
 */
export function gabaritsPublies(parcs: ParcsDImport): readonly ModeleDImport[] {
  return [
    MODELE_CLIENTS,
    modeleContacts(parcs.clients),
    modeleSites(parcs.clients, parcs.agences),
    modeleModeles(parcs.familles),
    modelePrestations(parcs.familles),
    MODELE_FAMILLES,
    modeleEquipements(parcs.clients, parcs.sites, parcs.modeles),
    modeleHistorique(parcs),
  ];
}

/**
 * LE GABARIT QUE LE MARQUEUR D'UNE FEUILLE DÉSIGNE, ou `null`.
 *
 * **Elle ne JUGE rien.** Un marqueur absent, illisible, ou d'une version qu'on
 * ne sait pas lire ne se distingue pas ici d'un type inconnu : *c'est
 * `controlerFeuille` qui prononce, et lui seul* — il porte déjà les cinq
 * anomalies de D31, avec leur ligne et leur valeur. Cette fonction répond à une
 * question plus étroite : **lequel des gabarits publiés ce fichier prétend-il
 * remplir ?** — de quoi choisir le juge, jamais de quoi rendre le verdict.
 *
 * *Deux questions différentes, deux fonctions* : les fondre ferait rendre à la
 * sélection les motifs de refus, c'est-à-dire deux lectures d'un même critère
 * (§9, 01/09).
 */
export function gabaritDuMarqueur(
  cellule: Cellule | undefined,
  parcs: ParcsDImport,
): ModeleDImport | null {
  const type = typeAnnonce(cellule);
  if (type === null) return null;
  return gabaritsPublies(parcs).find((modele) => modele.type === type) ?? null;
}

/**
 * LES TYPES PUBLIÉS, DÉRIVÉS DES GABARITS EUX-MÊMES.
 *
 * **Jamais une seconde liste écrite à la main** : elle appelle les
 * constructeurs avec des parcs VIDES, parce que le `type` d'un gabarit ne
 * dépend d'aucun parc. *Une énumération recopiée « pour la lisibilité »
 * deviendrait fausse le jour d'un gabarit de plus, sans rougir* (§9, 01/09).
 *
 * **Et ce jour est arrivé deux fois le 16/09/2026** : R6-03 en ajoute deux, et
 * aucune ligne de ce fichier n'a eu à être recomptée.
 */
export const TYPES_PUBLIES: readonly string[] = gabaritsPublies({
  clients: { cles: new Set(), ambigues: new Set(), fiches: new Map() },
  agences: { parCode: new Map() },
  familles: { parCode: new Map() },
  sites: { fiches: new Map() },
  modeles: { fiches: new Map() },
  sitesDetails: new Map(),
  machines: { parSerie: new Map() },
  historique: { fiches: new Map() },
  // Aucune devise n'a été lue, et celle-ci le dit en LEVANT si on la lit :
  // un zéro écrit ici serait un nombre de décimales en dur (I3).
  devise: deviseNonLue(),
}).map((modele) => modele.type);

/**
 * LE REFUS D'UN MARQUEUR QU'AUCUN GABARIT NE LIT (REPRISE-HISTORIQUE).
 *
 * `gabaritDuMarqueur` rend `null` sans dire pourquoi, et la route rendait
 * alors `marqueur_autre_type` — *« vérifiez le type d'import choisi »*. **Il
 * n'y a aucun type à choisir** (D31 : le marqueur décide), et le message a
 * fait chercher au mauvais endroit, mesuré en production le 22/09/2026 sur le
 * fichier même que ce ticket rend lisible.
 *
 * Deux situations, deux gestes : un marqueur LISIBLE dont le type n'est
 * publié par personne — *cette version ne sait pas encore l'importer, il n'y
 * a rien à corriger* — rend le code NEUF, avec le type qu'il annonce ; une
 * cellule qui n'est pas un marqueur lisible garde le refus que la GRAMMAIRE
 * prononce (`analyserMarqueur`, contre un type vide qu'aucun fichier ne peut
 * porter — les trois premiers états ne dépendent pas de l'attendu), et il
 * n'est pas rejugé ici.
 */
export function refusSansGabarit(cellule: Cellule | undefined): {
  readonly code: CodeAnomalie;
  readonly type?: string;
} {
  const type = typeAnnonce(cellule);
  if (type !== null) {
    return { code: "marqueur_type_inconnu", type };
  }
  const marqueur = analyserMarqueur(cellule, { type: "", version: 1 });
  return { code: codeDuMarqueur(marqueur) ?? "marqueur_illisible" };
}
