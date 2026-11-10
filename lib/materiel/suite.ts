import { z } from "zod";

/**
 * LA SUITE DU RÉFÉRENTIEL MATÉRIEL (9K18A-MATERIEL-RETOUR-ONGLET).
 *
 * Signalé par Alexis le 10/11/2026 : ajouter un sous-type depuis l'onglet
 * « Modèles » renvoyait systématiquement sur l'onglet « Familles », les
 * filtres perdus. `app/(back-office)/parametres/materiel/page.tsx` sait déjà
 * composer une adresse qui porte l'onglet et les filtres (`hrefEcran`) ; ce
 * fichier porte la moitié SERVEUR de la même règle — lire cette « suite »
 * depuis les champs cachés d'un formulaire POST, sans jamais lui faire
 * confiance au-delà d'une liste close, d'un UUID ou d'une longueur bornée
 * (CLAUDE.md §2, Zod sur toute entrée serveur).
 *
 * Les deux bouts doivent rester d'accord sur les noms d'onglet et d'état :
 * c'est pourquoi ce fichier, et lui seul, porte `OngletMateriel`, `EtatFiltre`
 * et `TypeVolet` — la page les importe plutôt que de les redéfinir.
 */
export type OngletMateriel = "familles" | "modeles" | "sous-types";
export type EtatFiltre = "actifs" | "inactifs" | "tous";
export type Filtres = Readonly<{ q: string; etat: EtatFiltre }>;
export type TypeVolet = "famille" | "modele" | "sous-type";

export type Suite = Readonly<{
  onglet: OngletMateriel;
  filtres: Filtres;
  familleFiltre?: string;
}>;

/** Même borne que les textes libres du référentiel (`lib/sites/saisie.ts`, etc.). */
const LONGUEUR_MAX_RECHERCHE = 200;

const schemaOnglet = z.union([
  z.literal("familles"),
  z.literal("modeles"),
  z.literal("sous-types"),
]);
const schemaEtat = z.union([
  z.literal("actifs"),
  z.literal("inactifs"),
  z.literal("tous"),
]);
const schemaUuid = z.string().uuid();
const schemaRecherche = z.string().max(LONGUEUR_MAX_RECHERCHE);

/**
 * LA SUITE LUE D'UN FORMULAIRE — un onglet, un état ou une recherche
 * INCONNUS valent le défaut, jamais un refus : ce ne sont que des commodités
 * d'affichage, à la différence de la saisie qui crée ou modifie.
 */
export function suiteRecue(formulaire: FormData): Suite {
  const ongletBrut = schemaOnglet.safeParse(
    valeurChamp(formulaire, "suite_onglet"),
  );
  const etatBrut = schemaEtat.safeParse(valeurChamp(formulaire, "suite_etat"));
  const rechercheBrute = schemaRecherche.safeParse(
    valeurChamp(formulaire, "suite_q"),
  );
  const familleFiltreBrute = schemaUuid.safeParse(
    valeurChamp(formulaire, "suite_famille"),
  );
  return {
    onglet: ongletBrut.success ? ongletBrut.data : "familles",
    filtres: {
      q: rechercheBrute.success ? rechercheBrute.data : "",
      etat: etatBrut.success ? etatBrut.data : "actifs",
    },
    familleFiltre: familleFiltreBrute.success
      ? familleFiltreBrute.data
      : undefined,
  };
}

function valeurChamp(formulaire: FormData, nom: string): string | undefined {
  const brut = formulaire.get(nom);
  return typeof brut === "string" ? brut : undefined;
}

/** Les paramètres d'adresse d'une suite — communs à la page et à l'API. */
export function paramsDeLaSuite(suite: Suite): URLSearchParams {
  const params = new URLSearchParams();
  if (suite.filtres.q.trim() !== "") {
    params.set("q", suite.filtres.q);
  }
  if (suite.filtres.etat !== "actifs") {
    params.set("etat", suite.filtres.etat);
  }
  if (suite.onglet !== "familles") {
    params.set("onglet", suite.onglet);
    if (suite.familleFiltre !== undefined) {
      params.set("famille", suite.familleFiltre);
    }
  }
  return params;
}
