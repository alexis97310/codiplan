import { t, type CleTraduction } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { type TonMessage } from "@/lib/theme/statuts";

/**
 * LES TYPES D'IMPORT, ET CE QU'ON SAIT EN FAIRE AUJOURD'HUI (L1-11).
 *
 * ## Pourquoi cette liste vit ici et non dans l'écran
 *
 * C'est la raison de `lib/navigation/portes-parametrage.ts`, mot pour mot :
 * *une liste de destinations est une donnée*, et le gardien des chaînes en dur
 * (L0-11) lit un fichier qui porte du JSX et prend ses littéraux pour du texte
 * visible. Un tableau de clés n'en est pas. **Il a raison de ne pas savoir :
 * c'est la DESTINATION d'un texte qui décide, et il ne peut pas la lire.**
 *
 * ## Ce que `complet` veut dire, et pourquoi il n'est pas déduit
 *
 * Un type est **complet** quand il sait contrôler ET appliquer. Le contrôle
 * existe pour tous les gabarits de `lib/imports/modeles.ts` ; **l'application
 * les couvre tous sauf un** — R6-01 en a ouvert quatre, R6-03 y ajoute les
 * familles et les équipements —, et le dernier, les CONTACTS, attend son
 * dépôt : `lib/contacts/` ne porte que `saisie.ts`, et l'écrire est L1-03b. *Le motif vit dans `SANS_APPLICATION`, où il se lit à
 * côté de ce qu'il écarte.*
 *
 * **Le drapeau est écrit ICI et CONFRONTÉ ailleurs**, et la seconde moitié est
 * celle qui compte. La première rédaction s'arrêtait à la première et annonçait
 * son prix : *« le jour où un second type devient applicable, cette ligne ment
 * jusqu'à ce qu'on la corrige, et rien ne le dira ».* **C'était la liste close
 * tenue à la main que le §9 refuse**, et elle était dérivable — les fonctions
 * d'application sont dans le dépôt.
 *
 * `tests/unit/imports/types-dimport.test.ts` lit `lib/imports/` et exige que
 * les types marqués `complet` soient EXACTEMENT ceux qui portent une fonction
 * `appliquerLeLotDe<Type>`. *La confrontation porte sur une source que cet
 * écran ne contrôle pas et qui ne se plie pas à ce qu'il déclare* (§9, 01/09) :
 * le jour où `appliquerLeLotDeContacts` sera écrite, le gardien rougira le jour
 * même. Ce n'est donc pas une table de correspondance nom → fonction — celle
 * que L1-08i refuse à bon droit —, c'est une ASSERTION sur deux listes.
 */
export type TypeDImport = {
  readonly cle: string;
  /**
   * Le titre, quand ce n'est PAS un mot imposé. `null` quand c'en est un : il
   * se compose alors depuis `mot(notion)`, jamais depuis le dictionnaire (D5,
   * D47) — c'est la règle de `PorteParametrage`, et elle vaut mot pour mot.
   */
  readonly titre: CleTraduction | null;
  /** La notion imposée, quand le titre en est une. */
  readonly vocabulaire?: "site";
  readonly detail: CleTraduction;
  /** Sait-on l'appliquer, et pas seulement le contrôler ? */
  readonly complet: boolean;
  /**
   * LE RÉFÉRENTIEL QU'UN REJET « parent_introuvable » DÉSIGNE POUR CE TYPE.
   *
   * *Mesuré en production le 16/09/2026 :* le motif générique dit « la fiche
   * que cette ligne désigne n'existe pas dans le parc », quel que soit le type
   * importé — sur un import de SITES, le parent manquant est un CLIENT, pas
   * une machine, et le message envoyait chercher au mauvais endroit. `null`
   * quand ce type n'a aucun parent, ou nomme déjà chacun des siens séparément
   * (les équipements, R6-03, avec leurs trois motifs propres).
   *
   * **Elle a une limite, annoncée plutôt que cachée** : les sites désignent
   * DEUX parents — client et agence — sous ce même motif générique, et cette
   * clé n'en nomme qu'un. *Condition de réouverture, vérifiable : le jour où
   * les sites nommeront leurs deux parents séparément, comme les équipements
   * nomment déjà les leurs.*
   */
  readonly motifParentIntrouvable: CleTraduction | null;
};

export const TYPES_DIMPORT: readonly TypeDImport[] = [
  {
    cle: "clients",
    titre: "imports.type.clients",
    detail: "imports.type.clients_detail",
    complet: true,
    // Racine : un client ne désigne aucun parent.
    motifParentIntrouvable: null,
  },
  {
    cle: "contacts",
    titre: "imports.type.contacts",
    detail: "imports.type.contacts_detail",
    complet: false,
    motifParentIntrouvable: "imports.motif.client_introuvable",
  },
  {
    cle: "sites",
    // Le titre est le MOT IMPOSÉ lui-même : il vient de `mot("site")`, jamais
    // du dictionnaire. *Le gardien du vocabulaire a rougi sur la première
    // rédaction, à raison* (D5, D47).
    titre: null,
    vocabulaire: "site",
    detail: "imports.type.sites_detail",
    complet: true,
    // Le CLIENT — c'est celui des deux parents que la production a mesuré ;
    // voir la limite annoncée au-dessus de `motifParentIntrouvable`.
    motifParentIntrouvable: "imports.motif.client_introuvable",
  },
  {
    cle: "modeles",
    titre: "imports.type.modeles",
    detail: "imports.type.modeles_detail",
    complet: true,
    motifParentIntrouvable: "imports.motif.famille_introuvable",
  },
  {
    cle: "prestations",
    titre: "imports.type.prestations",
    detail: "imports.type.prestations_detail",
    complet: true,
    motifParentIntrouvable: "imports.motif.famille_introuvable",
  },
  {
    cle: "familles",
    titre: "imports.type.familles",
    detail: "imports.type.familles_detail",
    complet: true,
    // Racine du matériel (R6-03) : une famille ne désigne aucun parent.
    motifParentIntrouvable: null,
  },
  {
    cle: "equipements",
    titre: "imports.type.equipements",
    detail: "imports.type.equipements_detail",
    complet: true,
    // Ses trois parents se nomment DÉJÀ séparément (client_introuvable,
    // site_introuvable, modele_introuvable) : ce type n'émet jamais le motif
    // générique, et n'a donc pas besoin de cette clé.
    motifParentIntrouvable: null,
  },
  {
    // L'ARCHIVE SAV (REPRISE-HISTORIQUE, D127) — le huitième gabarit.
    cle: "historique",
    titre: "imports.type.historique",
    detail: "imports.type.historique_detail",
    complet: true,
    // Ses parents se nomment séparément (client_introuvable, site_introuvable,
    // site_indetermine) : jamais le motif générique.
    motifParentIntrouvable: null,
  },
];

/** Le libellé d'un statut de lot — un CODE en base, une clé ici. */
export function cleDuStatut(statut: string): CleTraduction | null {
  switch (statut) {
    case "controle":
      return "imports.statut.controle";
    case "applique":
      return "imports.statut.applique";
    case "annule":
      return "imports.statut.annule";
    default:
      // *Un statut que le dictionnaire ne connaît pas ne s'affiche pas en
      // brut* : il serait du texte technique rendu à un humain, ce que la
      // coupure de L0-11 refuse. L'écran montrera le code, sans le traduire.
      return null;
  }
}

/**
 * Le libellé d'un motif de rejet de ligne — même règle que les statuts.
 *
 * **`type` est FACULTATIF, et un seul motif le regarde.** `parent_introuvable`
 * est le seul générique aux cinq gabarits qui n'ont qu'un parent (ou deux
 * corrigés au même endroit) ; le nom exact du référentiel manquant se lit sur
 * `TYPES_DIMPORT` — la table des types, jamais une seconde liste recopiée ici
 * — et retombe sur le générique quand le type est absent ou muet sur la
 * question (mesuré le 16/09/2026 : voir `motifParentIntrouvable`).
 */
export function cleDuMotif(motif: string, type?: string): CleTraduction | null {
  if (motif === "parent_introuvable") {
    const specifique = TYPES_DIMPORT.find(
      (candidat) => candidat.cle === type,
    )?.motifParentIntrouvable;
    return specifique ?? "imports.motif.parent_introuvable";
  }
  switch (motif) {
    case "saisie_refusee":
      return "imports.motif.saisie_refusee";
    case "cle_ambigue":
      return "imports.motif.cle_ambigue";
    // **Deux lignes du MÊME fichier, jamais une ligne contre le parc** — c'est
    // ce qui le distingue de `cle_ambigue`, et pourquoi la correction qu'il
    // nomme n'est pas la même (point 4 de la session du 16/09/2026).
    case "doublon_fichier":
      return "imports.motif.doublon_fichier";
    // **Les trois parents d'un équipement se nomment séparément** (R6-03) :
    // *« parent introuvable » sur une ligne qui en désigne trois envoie
    // chercher dans trois référentiels.*
    case "client_introuvable":
      return "imports.motif.client_introuvable";
    case "site_introuvable":
      return "imports.motif.site_introuvable";
    case "modele_introuvable":
      return "imports.motif.modele_introuvable";
    // **LES MOTIFS DE L'HISTORIQUE** (REPRISE-HISTORIQUE) : quatre propres au
    // gabarit, et les CODES DE LA GRAMMAIRE DES DATES — `preparerUneReprise`
    // rend tel quel ce que `lireDate` a dit, et le libellé est celui de
    // l'anomalie, écrit une fois pour le rapport et pour la ligne.
    case "document_deja_repris":
      return "imports.motif.document_deja_repris";
    case "site_indetermine":
      return "imports.motif.site_indetermine";
    case "montant_illisible":
      return "imports.motif.montant_illisible";
    case "montant_devise":
      return "imports.motif.montant_devise";
    case "date_format":
      return "import.anomalie.date_format";
    case "date_hors_plage":
      return "import.anomalie.date_hors_plage";
    case "date_avec_heure":
      return "import.anomalie.date_avec_heure";
    default:
      return null;
  }
}

/**
 * LE TON D'UN MESSAGE DE RETOUR, DÉDUIT DE SA CLÉ — jamais d'un paramètre que
 * l'appelant pourrait oublier de poser (point 1 de la session du 16/09/2026).
 *
 * *Mesuré :* « Le lot a été appliqué » sortait dans le bandeau rouge du refus,
 * faute d'habillage distinct. **La déduction se fait sur la CLÉ elle-même**,
 * jamais sur une liste de cas tenue à la main : un refus se nomme « refus »
 * partout où il apparaît dans ce dictionnaire (`auth.refus`,
 * `imports.refus.*`, dynamique compris) et une annulation partielle porte
 * « partiel » dans la sienne — les deux conventions existent déjà dans
 * `lib/i18n/fr.ts`, elles ne sont pas inventées ici. Tout le reste qui
 * atterrit sur ce bandeau est un succès plein : `imports.applique` et
 * `imports.annule`.
 */
export function tonDuMotif(cle: CleTraduction): TonMessage {
  if (cle.includes("refus")) return "refus";
  if (cle.includes("partiel")) return "avertissement";
  return "succes";
}

/**
 * Le titre d'un type — le dictionnaire, ou le MOT IMPOSÉ.
 *
 * *Le code nomme la NOTION, jamais le mot* (D5, D47) : `mot("site")` rend
 * « Site », et le dictionnaire ne l'écrit nulle part ailleurs.
 */
export function titreDuType(type: TypeDImport): string {
  if (type.vocabulaire !== undefined) {
    return mot(type.vocabulaire, true);
  }
  // Le type garantit qu'un titre existe quand aucune notion n'est nommée : les
  // deux ne peuvent pas manquer ensemble sans que TypeScript le dise.
  return type.titre === null ? "" : t(type.titre);
}
