import { describe, expect, it } from "vitest";

import type { JourLocal } from "@/lib/calendar/fuseau";
import {
  construireGrille,
  type AgenceDeGrille,
} from "@/lib/interventions/grille";
import {
  construireJournee,
  type AgenceDeJournee,
} from "@/lib/interventions/journee";

/**
 * LES DEUX VUES DISENT LE MÊME JEU — le gardien qui manquait (12/09/2026).
 *
 * ## Ce qu'il répare, et pourquoi rien n'a rougi pendant ce temps
 *
 * **Aucun fichier du dépôt n'importait `construireGrille` ET
 * `construireJournee`.** Chacune avait ses scénarios, chacune était juste sur
 * sa propre lecture, et la contradiction vivait dans l'espace entre les deux —
 * *celui que personne n'habite* (§9, 01/09 : deux lectures d'un même critère
 * divergent en silence, parce qu'aucune ne prétend être l'autre).
 *
 * Le symptôme, mesuré à l'écran : **« 3 en vue semaine, 1 en vue jour »**. Les
 * deux vues lisent le MÊME jeu de lignes, le MÊME jour, et n'en montrent pas
 * le même nombre. *Une intervention qui ne peut pas être dessinée doit être
 * DITE, jamais effacée* — un planning qui perd une ligne en silence fait poser
 * une seconde personne sur un créneau déjà pris.
 *
 * ## Ce que ce fichier exige, et ce qu'il n'exige pas
 *
 * Il n'exige pas que les deux vues DESSINENT tout de la même façon : une vue
 * jour a des heures, une vue semaine n'en a pas. Il exige qu'**aucune
 * intervention présente dans l'une ne manque à l'autre** — dessinée, ou
 * nommément écartée. C'est la seule propriété qui traverse la frontière, et
 * c'est exactement celle qu'aucun des deux fichiers ne pouvait énoncer seul.
 *
 * ## LES TROIS DISPARITIONS QU'IL VISE
 *
 * 1. **Le `.find()`** — deux interventions qui se chevauchent chez la même
 *    personne, et la vue jour ne retient que la première.
 * 2. **La ligne sans `creneau_debut`** — elle appartient au jour et à aucune
 *    heure : elle ne peut pas être dessinée, et elle était effacée.
 * 3. **La ligne hors de l'axe** — un créneau posé avant l'ouverture ou après
 *    la fermeture de l'agence : l'axe ne va pas jusque-là, et elle sortait.
 *
 * Les horaires sont ceux que le semis écrit réellement (mesurés le
 * 11/09/2026) : Nouméa 07:30–11:30 et 13:00–17:00, pas de 30 minutes.
 */

/** Lundi 17 août 2026 — la semaine de la maquette. */
const LUNDI: JourLocal = { annee: 2026, mois: 8, jour: 17 };

const DUCOS_JOUR: AgenceDeJournee = {
  id: "ag-ducos",
  libelle: "Ducos",
  plages: [1, 2, 3, 4, 5, 6].flatMap((jourSemaine) => [
    { jourSemaine, debutMinutes: 450, finMinutes: 690 },
    { jourSemaine, debutMinutes: 780, finMinutes: 1020 },
  ]),
  pasCreneauMinutes: 30,
  calendrierConnu: true,
};

const DUCOS_GRILLE: AgenceDeGrille = {
  id: "ag-ducos",
  libelle: "Ducos",
  joursOuverts: [1, 2, 3, 4, 5, 6],
  calendrierConnu: true,
};

/** `date_planifiee` est un `@db.Date` : Prisma la rend à MINUIT UTC. */
function jourUtc(jour: JourLocal): Date {
  return new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));
}

/** Un instant du jour, à `minutes` minutes locales — en UTC pour le test. */
function instant(jour: JourLocal, minutes: number): Date {
  return new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour, 0, minutes));
}

const minutesDe = (d: Date): number => d.getUTCHours() * 60 + d.getUTCMinutes();

type Ligne = {
  readonly id: string;
  readonly technicien_id: string | null;
  readonly agence_id: string;
  readonly date_planifiee: Date | null;
  readonly creneau_debut: Date | null;
  readonly creneau_fin: Date | null;
  readonly duree_estimee_min: number | null;
};

function ligne(
  id: string,
  debutMinutes: number | null,
  finMinutes: number | null,
): Ligne {
  return {
    id,
    technicien_id: "tech-1",
    agence_id: "ag-ducos",
    date_planifiee: jourUtc(LUNDI),
    creneau_debut: debutMinutes === null ? null : instant(LUNDI, debutMinutes),
    creneau_fin: finMinutes === null ? null : instant(LUNDI, finMinutes),
    duree_estimee_min: 60,
  };
}

/** Les identifiants que la vue SEMAINE montre pour ce jour. */
function vuesEnSemaine(lignes: readonly Ligne[]): Set<string> {
  const vues = new Set<string>();
  for (const l of construireGrille(lignes, [LUNDI], [DUCOS_GRILLE])) {
    for (const c of l.cases) for (const i of c.lignes) vues.add(i.id);
  }
  return vues;
}

/**
 * Les identifiants que la vue JOUR REND COMPTE DE — dessinés dans une cellule,
 * dans la ligne « sans heure » de la colonne, ou nommément écartés.
 *
 * *C'est la définition qui porte la règle* : « dessiné » seul ferait exiger
 * d'une vue horaire qu'elle place une ligne sans heure, ce qui lui ferait
 * inventer un créneau. Ce qu'on exige est qu'elle ne les PERDE pas. Depuis
 * AFFICHAGE-MATERIEL-1, une ligne sans heure est comptée par `sansHeure`, pas
 * par `horsGrille` — elle se dessine désormais DANS la colonne.
 */
function vuesEnJour(lignes: readonly Ligne[]): Set<string> {
  const journee = construireJournee(lignes, LUNDI, [DUCOS_JOUR], minutesDe);
  const vues = new Set<string>();
  for (const colonne of journee.colonnes) {
    for (const cellule of colonne.cellules) {
      for (const { ligne } of cellule.occupations) vues.add(ligne.id);
    }
    for (const sansHeure of colonne.sansHeure) vues.add(sansHeure.id);
    for (const ecartee of colonne.horsGrille) vues.add(ecartee.ligne.id);
  }
  return vues;
}

describe("aucune intervention ne disparaît d'une vue à l'autre", () => {
  it("DEUX INTERVENTIONS QUI SE CHEVAUCHENT chez la même personne", () => {
    // 09:00–10:00 et 09:30–10:30 : la seconde était masquée par la première.
    const lignes = [ligne("a", 540, 600), ligne("b", 570, 630)];

    // TÉMOIN : la vue semaine les porte bien toutes les deux. Deux ensembles
    // vides seraient égaux, et la mesure serait creuse.
    expect(vuesEnSemaine(lignes)).toEqual(new Set(["a", "b"]));
    expect(vuesEnJour(lignes)).toEqual(new Set(["a", "b"]));
  });

  it("UNE INTERVENTION DATÉE SANS HEURE — elle appartient au jour", () => {
    const lignes = [ligne("a", 540, 600), ligne("sans-heure", null, null)];
    expect(vuesEnSemaine(lignes)).toEqual(new Set(["a", "sans-heure"]));
    expect(vuesEnJour(lignes)).toEqual(new Set(["a", "sans-heure"]));
  });

  it("UN CRÉNEAU POSÉ HORS DE L'AXE — avant l'ouverture, après la fermeture", () => {
    // 06:00 précède l'ouverture (07:30) ; 18:00 suit la fermeture (17:00).
    const lignes = [
      ligne("matinale", 360, 420),
      ligne("dans-l-axe", 540, 600),
      ligne("tardive", 1080, 1140),
    ];
    expect(vuesEnSemaine(lignes)).toEqual(
      new Set(["matinale", "dans-l-axe", "tardive"]),
    );
    expect(vuesEnJour(lignes)).toEqual(
      new Set(["matinale", "dans-l-axe", "tardive"]),
    );
  });

  it("LES TROIS À LA FOIS — c'est ainsi qu'elles se présentent à l'écran", () => {
    const lignes = [
      ligne("a", 540, 600),
      ligne("b", 570, 630),
      ligne("sans-heure", null, null),
      ligne("tardive", 1080, 1140),
    ];
    const attendu = new Set(["a", "b", "sans-heure", "tardive"]);
    expect(vuesEnSemaine(lignes)).toEqual(attendu);
    expect(vuesEnJour(lignes)).toEqual(attendu);
  });

  it("LE SENS QUI DOIT RESTER VERT POUR SA PROPRE RAISON — rien n'est inventé", () => {
    // Une vue qui rendrait « tout ce qu'on lui a donné » passerait les quatre
    // épreuves ci-dessus sans rien dessiner. Ce cas exige l'inverse : une
    // intervention d'un AUTRE jour n'apparaît dans ni l'une ni l'autre.
    const autre: Ligne = {
      ...ligne("autre-jour", 540, 600),
      date_planifiee: jourUtc({ annee: 2026, mois: 8, jour: 18 }),
      creneau_debut: new Date(Date.UTC(2026, 7, 18, 9)),
      creneau_fin: new Date(Date.UTC(2026, 7, 18, 10)),
    };
    const lignes = [ligne("a", 540, 600), autre];
    expect(vuesEnSemaine(lignes)).toEqual(new Set(["a"]));
    // La vue jour ne filtre pas par date — l'appelant lui donne le jour. Elle
    // reçoit donc ici la seule ligne du lundi, et le témoin porte sur la
    // grille : la case du 18 n'existe pas dans la semaine demandée.
    expect(vuesEnJour([ligne("a", 540, 600)])).toEqual(new Set(["a"]));
  });
});
