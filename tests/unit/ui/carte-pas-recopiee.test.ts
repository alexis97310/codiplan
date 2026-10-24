import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  fichiersSource,
  RACINE,
  sansCommentaires,
} from "../outils/fichiers-source";

/**
 * LE GARDE-FOU DE `Carte` — une page ou un composant ne recopie plus
 * `bg-app-surface` + `border-app-bord` + un rayon + `border` à la main
 * (audit du 21/10/2026, 9G9A, point 7 ; devenu CONTRAIGNANT par 9G9D,
 * 25/10/2026).
 *
 * ## CE QU'IL DÉTECTE, ET DEPUIS 9G9D COMMENT
 *
 * La même forme de classes que `components/ui/carte.tsx` lui-même porte,
 * dans UN MÊME littéral (chaîne ou gabarit) — mais, depuis 9G9D, JETON PAR
 * JETON plutôt qu'une sous-chaîne exacte : `rounded-lg border` et
 * `border rounded-lg` comptent pareil, et `rounded-md`/`rounded-xl`
 * comptent aussi, plus seulement `rounded-lg`. 9G9A n'avait converti qu'une
 * petite partie du dépôt et laissait ce gardien muet sur `components/**` ;
 * 9G9D a fini la conversion de son propre territoire (paramètres, planning,
 * une partie de `components/ui/**`) et étend le gardien à `components/**`
 * tout entier (hors `components/terrain/**`, hors territoire de 9G9D —
 * traité par un autre lot en parallèle).
 *
 * ## CE QUI N'EST PAS UN ENCADRÉ, ET NE LE DEVIENT PAS EN LE BORDANT
 *
 * Un champ de saisie, un bouton, une pastille, un menu déroulant, une
 * infobulle, une boîte de dialogue modale, une zone d'impression ou un
 * cadre technique (viseur de caméra) peuvent légitimement porter les mêmes
 * QUATRE jetons que `Carte` sans être, pour autant, un ENCADRÉ au sens de
 * l'audit — « un conteneur qui REGROUPE un contenu ». ÉGALEMENT : un
 * composant qui mesure une pièce DISTINCTE de la maquette (`.kpi`,
 * `.entity-card`), dont le ROOT ne peut pas être la `<section>` fixe de
 * `Carte` (racine `<a>`/`<article>`/`<h3>` au lieu de `<section>`/`<h2>`),
 * reste à part — et c'est documenté dans CE fichier précisément pour ça.
 *
 * ## LA LISTE EST FERMÉE DANS LES DEUX SENS (même discipline que I8,
 * `scripts/lib/perimetre-audit.ts`, et que `chemins-de-depot.test.ts`)
 *
 * Chaque entrée nomme un fichier ET une RAISON (une des catégories
 * ci-dessous) — jamais une ligne nue. Un fichier qui porte le motif et
 * n'apparaît pas dans `EXCEPTIONS` fait rougir ce gardien. Une entrée de
 * `EXCEPTIONS` dont le fichier NE PORTE PLUS le motif fait rougir aussi :
 * une exemption qui ne protège plus rien doit sortir de la liste (§9,
 * 01/09). Le test de non-régression, en fin de fichier, prouve qu'une
 * recopie neuve dans un fichier de `components/**` ferait rougir ce
 * gardien — sans écrire de fichier sur disque, en éprouvant directement la
 * fonction de détection.
 */

/** Jeton de rayon accepté — `rounded-lg` (Carte), mais aussi `-md`/`-xl`. */
const ROUNDED = /^rounded-(lg|md|xl)$/;

/**
 * Un littéral (chaîne `"…"` ou gabarit `` `…` ``) porte le motif s'il
 * contient, EN JETONS (ordre libre), `bg-app-surface`, `border-app-bord`,
 * `border` seul, ET un rayon — les quatre dans le MÊME littéral, comme
 * `Carte` les porte elle-même.
 */
function litteralPorteLeMotif(litteral: string): boolean {
  const jetons = new Set(litteral.split(/\s+/));
  if (!jetons.has("bg-app-surface")) return false;
  if (!jetons.has("border-app-bord")) return false;
  if (!jetons.has("border")) return false;
  for (const jeton of jetons) {
    if (ROUNDED.test(jeton)) return true;
  }
  return false;
}

/** Tous les littéraux `"…"` et `` `…` `` d'une source — ni l'un ni l'autre ne traverse les deux. */
function extraireLitteraux(source: string): readonly string[] {
  const resultat: string[] = [];
  const motifs = [/"((?:[^"\\]|\\.)*)"/g, /`((?:[^`\\]|\\.)*)`/g];
  for (const motif of motifs) {
    for (const trouve of source.matchAll(motif)) {
      resultat.push(trouve[1] ?? "");
    }
  }
  return resultat;
}

function porteLeMotif(source: string): boolean {
  return extraireLitteraux(sansCommentaires(source)).some(litteralPorteLeMotif);
}

type Categorie =
  /** Un `<input>`/`<select>`/`<textarea>`, ou un `<label>` qui en tient lieu — jamais un regroupement. */
  | "champ"
  /** Un `<button>` ou un `<Link>` qui AGIT, jamais une carte à lire. */
  | "bouton"
  /** Un `<kbd>`/`<span>` court — un raccourci, un repère, jamais un conteneur. */
  | "pastille"
  /** Un panneau `role="menu"` ou une liste de résultats qui s'ouvre et se ferme. */
  | "menu-deroulant"
  /** Un popover d'aide, posé en `absolute`, jamais un contenu de page. */
  | "infobulle"
  /** Un `<p>`/`<section>` `role="status"`/`role="alert"` — un MESSAGE, pas un regroupement. */
  | "bandeau"
  /** Une boîte modale (`<dialog>`), superposée à l'écran plutôt que posée dans son flux. */
  | "dialogue"
  /** Une zone dont l'impression (`window.print()`) fixe la mise en page — hors écran. */
  | "zone-impression"
  /** Un cadre d'appareil (viseur de caméra) — un rendu technique, pas un regroupement de contenu. */
  | "cadre-technique"
  /** Un `<details>` natif — Carte ne porte aucune sémantique de repli (voir 9G9A). */
  | "details-natif"
  /** Une pièce de maquette MESURÉE à part (`.kpi`, `.entity-card`), racine incompatible avec `Carte`. */
  | "composant-maquette-distinct"
  /** Hors du territoire de 9G9D — un autre lot le traite, ou le traitera, en parallèle. */
  | "hors-territoire";

type Exception = {
  readonly chemin: string;
  readonly categories: readonly Categorie[];
  readonly raison: string;
};

/**
 * CHAQUE ENTRÉE EST MESURÉE — un fichier qui porte encore le motif, avec sa
 * ou ses raisons. Rien ici n'est un écran « approuvé pour toujours » : un
 * lot qui le convertit vers `Carte` RETIRE sa ligne, il ne l'y laisse pas.
 */
const EXCEPTIONS: readonly Exception[] = [
  {
    chemin: "app/(back-office)/absences/page.tsx",
    categories: ["bandeau", "champ"],
    raison:
      'un <section role="status"> (compte rendu) et des <input> de date/technicien — hors territoire de 9G9D',
  },
  {
    chemin: "app/(back-office)/imports/[id]/page.tsx",
    categories: ["bandeau"],
    raison: 'trois <p role="status"> — hors territoire de 9G9D',
  },
  {
    chemin: "app/(back-office)/interventions/[id]/bon/page.tsx",
    categories: ["zone-impression"],
    raison:
      "le bon d'intervention imprimable — déjà une exemption de 9G9A, hors territoire de 9G9D",
  },
  {
    chemin: "app/(back-office)/parametres/agences/[agenceId]/page.tsx",
    categories: ["bandeau"],
    raison:
      "le <p> d'aide vers le calendrier — un message, pas un regroupement",
  },
  {
    chemin: "app/(back-office)/parametres/agences/calendrier/[id]/page.tsx",
    categories: ["champ"],
    raison: "le <input> d'heure de ChampHeure",
  },
  {
    chemin: "app/(back-office)/parametres/agences/composants.tsx",
    categories: ["champ"],
    raison: "un <select> de LigneAgence",
  },
  {
    chemin: "app/(back-office)/parametres/agences/nouvelle/page.tsx",
    categories: ["bandeau", "champ"],
    raison:
      "le <p> d'aide « calendrier vide » et les <input>/<select> du formulaire (code, libellé, territoire, fuseau)",
  },
  {
    chemin: "app/(back-office)/parametres/equipe/dialogue-renouveler.tsx",
    categories: ["champ"],
    raison: "deux <input> de date dans le dialogue de renouvellement",
  },
  {
    chemin: "app/(back-office)/parametres/equipe/page.tsx",
    categories: ["bandeau", "champ", "details-natif"],
    raison:
      'deux <p role="status">, cinq <select> de filtre, et le <details> de repli par technicien (Carte ne porte aucune sémantique de repli)',
  },
  {
    chemin: "app/(back-office)/parametres/forfaits/[id]/page.tsx",
    categories: ["champ"],
    raison: "le <select> de zone du sélecteur de forfait de déplacement",
  },
  {
    chemin: "app/(back-office)/parametres/habilitations/page.tsx",
    categories: ["details-natif", "champ"],
    raison:
      "le <details> de repli par habilitation, et un <select> à largeur variable",
  },
  {
    chemin: "app/(back-office)/parametres/materiel/page.tsx",
    categories: ["details-natif", "champ"],
    raison:
      "les deux <details> de repli (famille, modèle) et un <select> de filtre",
  },
  {
    chemin: "app/(back-office)/parametres/prestations/page.tsx",
    categories: ["champ"],
    raison: "deux <select>, dont un à largeur variable",
  },
  {
    chemin: "app/(back-office)/parametres/trajets/page.tsx",
    categories: ["champ"],
    raison: "le <input> d'une ligne de zone",
  },
  {
    chemin: "app/(back-office)/parc/[id]/page.tsx",
    categories: ["zone-impression"],
    raison:
      "l'étiquette QR imprimable — hors territoire de 9G9D (fiche machine, un autre lot)",
  },
  {
    chemin: "app/(back-office)/planning/page.tsx",
    categories: ["bandeau"],
    raison: 'le <p role="status"> du compte rendu de transmission',
  },
  {
    chemin: "app/(back-office)/planning/statistiques.tsx",
    categories: ["details-natif"],
    raison:
      "le <details open> du panneau de charge — documenté en tête de ce fichier (9G9A)",
  },
  {
    chemin: "app/(back-office)/sites/[id]/page.tsx",
    categories: ["hors-territoire", "champ"],
    raison:
      "un encadré réel et un <select> — hors territoire de 9G9D (fiche site, un autre lot)",
  },
  {
    chemin: "app/(back-office)/vgp/page.tsx",
    categories: ["hors-territoire", "champ", "zone-impression"],
    raison:
      "un encadré réel, deux <select> de filtre, et le registre imprimable — hors territoire de 9G9D",
  },
  {
    chemin: "components/demandes/champs-nouvelle-demande.tsx",
    categories: ["champ"],
    raison: "un <select> de site et un <textarea> de description",
  },
  {
    chemin: "components/forfaits/formulaire.tsx",
    categories: ["champ"],
    raison:
      "le <input>/<select> partagé du formulaire (le composant lui-même ne porte plus sa carte, 9G9D)",
  },
  {
    chemin: "components/interventions/photos-terrain.tsx",
    categories: ["champ"],
    raison: "le <input> de libellé d'une photo",
  },
  {
    chemin: "components/interventions/site-et-machines.tsx",
    categories: ["hors-territoire"],
    raison:
      "deux encadrés réels, déjà bordés avant 9G9D — hors territoire (interventions/nouvelle, un autre lot)",
  },
  {
    chemin: "components/machines/actions-qr.tsx",
    categories: ["bouton"],
    raison: "le bouton « copier l'identifiant »",
  },
  {
    chemin: "components/machines/scanner-qr.tsx",
    categories: ["bouton", "cadre-technique", "hors-territoire"],
    raison:
      "le bouton « relancer », le cadre du viseur de caméra, et le formulaire de saisie manuelle — hors territoire (scanner QR)",
  },
  {
    chemin: "components/navigation/menu-creer.tsx",
    categories: ["menu-deroulant"],
    raison: 'le panneau role="menu" de création',
  },
  {
    chemin: "components/navigation/recherche-globale.tsx",
    categories: ["pastille"],
    raison: "le <kbd> de raccourci clavier",
  },
  {
    chemin: "components/parc/formulaire-machine.tsx",
    categories: ["hors-territoire"],
    raison:
      "un encadré réel, déjà bordé avant 9G9D — hors territoire (parc/nouvelle, un autre lot)",
  },
  {
    chemin: "components/planning/fenetre-pose.tsx",
    categories: ["dialogue", "champ"],
    raison: "la boîte <dialog> de pose, et son <input> d'heure",
  },
  {
    chemin: "components/planning/pose.tsx",
    categories: ["dialogue"],
    raison: "la boîte <dialog> de confirmation de pose",
  },
  {
    chemin: "components/tableau-de-bord/select-priorites.tsx",
    categories: ["champ"],
    raison: "le <select> de priorités opérationnelles",
  },
  {
    chemin: "components/ui/aide-champ.tsx",
    categories: ["infobulle"],
    raison: "le popover d'aide, posé en absolute",
  },
  {
    chemin: "components/ui/barre-selection.tsx",
    categories: ["bouton"],
    raison: "le bouton d'action groupée désactivable",
  },
  {
    chemin: "components/ui/carte-entite.tsx",
    categories: ["composant-maquette-distinct"],
    raison:
      "`.entity-card` de la maquette, racine <article>/<h3> — documenté en tête de ce fichier, jamais fusionné à Carte",
  },
  {
    chemin: "components/ui/champ-fichier.tsx",
    categories: ["champ"],
    raison: "le <label> qui tient lieu de champ de fichier",
  },
  {
    chemin: "components/ui/champ.tsx",
    categories: ["champ"],
    raison: "le composant Champ — c'est lui-même un champ de saisie",
  },
  {
    chemin: "components/ui/kpi.tsx",
    categories: ["composant-maquette-distinct"],
    raison:
      "`.kpi` de la maquette, racine <a>/<div> tuile avec filet de couleur — documenté en tête de ce fichier",
  },
  {
    chemin: "components/ui/liste-cartes.tsx",
    categories: ["hors-territoire"],
    raison:
      "un second composant nommé « Carte », lien plein vers une fiche — candidat à une fusion future, utilisé par des écrans hors territoire de 9G9D (interventions, demandes, parc)",
  },
  {
    chemin: "components/ui/menu-plus.tsx",
    categories: ["menu-deroulant"],
    raison: "le panneau déroulant « plus d'actions »",
  },
  {
    chemin: "components/ui/selecteur-recherche.tsx",
    categories: ["champ", "menu-deroulant"],
    raison: "le <input> de recherche et sa liste de résultats déroulante",
  },
  {
    chemin: "components/vgp/impression-registre.tsx",
    categories: ["bouton"],
    raison: "le bouton « imprimer »",
  },
];

const EXCEPTIONS_PAR_CHEMIN = new Map(
  EXCEPTIONS.map((exception) => [exception.chemin, exception]),
);

/** `components/terrain/**` — un autre lot le traite en parallèle, hors du périmètre même de ce gardien. */
function horsPerimetreDuGardien(chemin: string): boolean {
  return (
    chemin.startsWith("components/terrain/") ||
    chemin === "components/ui/carte.tsx"
  );
}

describe("Carte n'est pas recopiée à la main (audit du 21/10/2026, 9G9A ; contraignant depuis 9G9D, 25/10/2026)", () => {
  it("a réellement une liste à éprouver — le témoin de non-vacuité", () => {
    expect(EXCEPTIONS.length).toBeGreaterThan(0);
  });

  it("aucun fichier hors de la liste ne recopie bg-app-surface + border-app-bord + un rayon + border", () => {
    const fautifs = fichiersSource(
      ["app/(back-office)", "components"],
      [".tsx"],
    )
      .filter((fichier) => !horsPerimetreDuGardien(fichier.chemin))
      .filter((fichier) => !EXCEPTIONS_PAR_CHEMIN.has(fichier.chemin))
      .filter((fichier) => porteLeMotif(fichier.contenu))
      .map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "un encadré recopié à la main au lieu d'utiliser components/ui/carte.tsx " +
        "— ou bien utiliser Carte (au besoin une variante ajoutée), ou bien " +
        "ajouter la ligne à EXCEPTIONS avec sa raison",
    ).toEqual([]);
  });

  it("chaque exception protège encore quelque chose — aucune ligne morte", () => {
    const mortes = EXCEPTIONS.filter((exception) => {
      const chemin = join(RACINE, exception.chemin);
      const contenu = readFileSync(chemin, "utf8");
      return !porteLeMotif(contenu);
    }).map((exception) => exception.chemin);

    expect(
      mortes,
      "un fichier converti vers Carte doit sortir de EXCEPTIONS, pas y dormir",
    ).toEqual([]);
  });

  it("chaque catégorie d'exception est une des catégories nommées et commentées ci-dessus", () => {
    const CATEGORIES_CONNUES = new Set<Categorie>([
      "champ",
      "bouton",
      "pastille",
      "menu-deroulant",
      "infobulle",
      "bandeau",
      "dialogue",
      "zone-impression",
      "cadre-technique",
      "details-natif",
      "composant-maquette-distinct",
      "hors-territoire",
    ]);
    for (const exception of EXCEPTIONS) {
      expect(exception.categories.length, exception.chemin).toBeGreaterThan(0);
      for (const categorie of exception.categories) {
        expect(CATEGORIES_CONNUES.has(categorie), exception.chemin).toBe(true);
      }
    }
  });

  it("une recopie neuve dans un fichier de components/ ferait rougir ce gardien — sans écrire sur disque", () => {
    // La preuve porte sur la fonction de détection elle-même : un fichier
    // neuf qui recopierait la carte, classes dans un ordre quelconque et
    // rayon `md` plutôt que `lg`, doit être détecté.
    const recopieNeuve = `
      export function CarteRecopiee() {
        return (
          <div className="rounded-md border border-app-bord bg-app-surface p-4">
            contenu
          </div>
        );
      }
    `;
    expect(porteLeMotif(recopieNeuve)).toBe(true);

    // TÉMOIN NÉGATIF — un champ ordinaire (une seule des quatre conditions)
    // ne doit pas être pris pour un encadré.
    const champOrdinaire = `
      export function Champ() {
        return <input className="rounded-md border border-app-bord px-2 py-1" />;
      }
    `;
    expect(porteLeMotif(champOrdinaire)).toBe(false);
  });
});
