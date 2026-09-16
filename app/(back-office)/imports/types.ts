import { t, type CleTraduction } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

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
 * existe pour les cinq (les cinq gabarits de `lib/imports/modeles.ts`) ;
 * **l'application en couvre quatre depuis R6-01**, et la cinquième — les
 * contacts — attend son dépôt : `lib/contacts/` ne porte que `saisie.ts`, et
 * l'écrire est L1-03b. *Le motif vit dans `SANS_APPLICATION`, où il se lit à
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
};

export const TYPES_DIMPORT: readonly TypeDImport[] = [
  {
    cle: "clients",
    titre: "imports.type.clients",
    detail: "imports.type.clients_detail",
    complet: true,
  },
  {
    cle: "contacts",
    titre: "imports.type.contacts",
    detail: "imports.type.contacts_detail",
    complet: false,
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
  },
  {
    cle: "modeles",
    titre: "imports.type.modeles",
    detail: "imports.type.modeles_detail",
    complet: true,
  },
  {
    cle: "prestations",
    titre: "imports.type.prestations",
    detail: "imports.type.prestations_detail",
    complet: true,
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

/** Le libellé d'un motif de rejet de ligne — même règle que les statuts. */
export function cleDuMotif(motif: string): CleTraduction | null {
  switch (motif) {
    case "saisie_refusee":
      return "imports.motif.saisie_refusee";
    case "parent_introuvable":
      return "imports.motif.parent_introuvable";
    case "cle_ambigue":
      return "imports.motif.cle_ambigue";
    default:
      return null;
  }
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
