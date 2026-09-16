import { schemaCreationClient } from "@/lib/clients/saisie";
import { schemaCreationContact } from "@/lib/contacts/saisie";
import { schemaModeleMateriel } from "@/lib/materiel/saisie";
import { schemaCreationSite } from "@/lib/sites/saisie";
import {
  cleDeClient,
  normaliserRaisonSociale,
} from "@/lib/excel/rapprochement";

import { type ParcAgences } from "./parc-agences";
import { type ParcFamilles } from "./parc-familles";
import { type ParcClientsIndexe } from "./parc-clients";
import { cleClientDepuis, type ModeleDImport } from "@/lib/excel/controle";
import { type Cellule, typeAnnonce } from "@/lib/excel/format";
import { schemaPrestation } from "@/lib/prestations/saisie";

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
  const designation = valeurs[COLONNES_SITES.client]?.trim();
  if (designation === undefined || designation === "") return undefined;
  return (
    clients.fiches.get(
      cleDeClient({
        codeExterne: designation,
        raisonSociale: undefined,
        rang: 0,
      }).cle,
    ) ??
    clients.fiches.get(
      cleDeClient({
        codeExterne: undefined,
        raisonSociale: designation,
        rang: 0,
      }).cle,
    )
  );
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
};

/**
 * LES CINQ GABARITS, CONSTRUITS ENSEMBLE.
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
  ];
}

/**
 * LE GABARIT QUE LE MARQUEUR D'UNE FEUILLE DÉSIGNE, ou `null`.
 *
 * **Elle ne JUGE rien.** Un marqueur absent, illisible, ou d'une version qu'on
 * ne sait pas lire ne se distingue pas ici d'un type inconnu : *c'est
 * `controlerFeuille` qui prononce, et lui seul* — il porte déjà les cinq
 * anomalies de D31, avec leur ligne et leur valeur. Cette fonction répond à une
 * question plus étroite : **lequel des cinq gabarits ce fichier prétend-il
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
 * LES CINQ TYPES PUBLIÉS, DÉRIVÉS DES GABARITS EUX-MÊMES.
 *
 * **Jamais une seconde liste écrite à la main** : elle appelle les
 * constructeurs avec des parcs VIDES, parce que le `type` d'un gabarit ne
 * dépend d'aucun parc. *Une énumération recopiée « pour la lisibilité »
 * deviendrait fausse le jour d'un sixième gabarit, sans rougir* (§9, 01/09).
 */
export const TYPES_PUBLIES: readonly string[] = gabaritsPublies({
  clients: { cles: new Set(), ambigues: new Set(), fiches: new Map() },
  agences: { parCode: new Map() },
  familles: { parCode: new Map() },
}).map((modele) => modele.type);
