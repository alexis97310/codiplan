import { describe, expect, it } from "vitest";

import type { AbsenceDeclaree } from "@/lib/absences/periode";
import type { Annuaire } from "@/lib/auth/annuaire";
import type { Calendrier } from "@/lib/calendar/calendrier";
import { dateCivile, type JourLocal } from "@/lib/calendar/fuseau";
import { t } from "@/lib/i18n/fr";
import { joursDeLaSemaine, lundiDeLaSemaine } from "@/lib/calendar/semaine";
import {
  construireGrille,
  type AgenceDeGrille,
  type Posable,
} from "@/lib/interventions/grille";
import {
  construireJournee,
  type AgenceDeJournee,
  type Occupante,
} from "@/lib/interventions/journee";
import { optionsDAffectation } from "@/lib/interventions/personnes";

/**
 * LE BLOCAGE D'AGENDA SE VOIT SUR LE PLANNING AVANT TOUTE TENTATIVE
 * D'AFFECTATION (PLANNING-1, RG-PLA-06, 22/09/2026).
 *
 * ## Le défaut mesuré
 *
 * RG-PLA-06 — *« Une absence validée bloque le créneau »* — était tenue par
 * le dépôt (`verdictALaPose`, `lib/interventions/depot.ts`) et par le
 * déclencheur `intervention_pas_sur_blocage_agenda` : le refus arrivait donc
 * APRÈS la tentative. Or ni `construireGrille` ni `construireJournee` ne
 * recevaient les blocages : la case d'un technicien absent se dessinait comme
 * une case LIBRE, et la vue jour COMPTAIT ses créneaux parmi les trous — sur
 * un écran dont l'objet déclaré est de montrer les trous. Le planificateur
 * choisissait, se faisait refuser, recommençait.
 *
 * ## Ce que ce fichier mesure
 *
 * Que les deux rangements DISENT le blocage, avec le MÊME critère que le
 * refus — `absenceCouvrant` (`lib/absences/periode.ts`), jamais une seconde
 * lecture de « ce jour est-il bloqué » qui divergerait en silence (§9,
 * 01/09). La règle ne change pas : le dépôt refuse toujours. Ce qui change est
 * que l'information arrive AVANT le geste.
 *
 * Chaque cas qui doit rougir a son voisin qui doit rester vert POUR SA
 * PROPRE RAISON (§9, 11/09) : la personne bloquée à côté de celle qui ne
 * l'est pas, le jour bloqué à côté du jour libre, la borne comprise à côté
 * du lendemain.
 */

const SEMAINE = joursDeLaSemaine(
  lundiDeLaSemaine({ annee: 2026, mois: 8, jour: 19 }),
).slice(0, 6);
const LUNDI = SEMAINE[0];
const MARDI = SEMAINE[1];
const MERCREDI = SEMAINE[2];
const JEUDI = SEMAINE[3];

const CALENDRIER_DUCOS: Calendrier = {
  code: "test",
  fuseau: "Pacific/Noumea",
  territoire: "NC",
  plages: [1, 2, 3, 4, 5, 6].map((jour_semaine) => ({
    jour_semaine,
    debut_minutes: 450,
    fin_minutes: 1020,
  })),
  jours_particuliers: [],
};

const DUCOS: AgenceDeGrille = {
  id: "ag-ducos",
  libelle: "Ducos",
  calendrier: CALENDRIER_DUCOS,
};

function jour(j: JourLocal): Date {
  return new Date(Date.UTC(j.annee, j.mois - 1, j.jour));
}

/** Garnier est bloqué du MARDI au MERCREDI, bornes COMPRISES. */
const BLOCAGE_GARNIER: AbsenceDeclaree = {
  id: "abs-1",
  utilisateur_id: "garnier",
  du: jour(MARDI),
  au: jour(MERCREDI),
};

function intervention(p: Partial<Posable> & { id: string }): Posable {
  return {
    technicien_id: null,
    agence_id: DUCOS.id,
    date_planifiee: jour(LUNDI),
    ...p,
  };
}

describe("la VUE SEMAINE — chaque case sait si l'agenda est bloqué", () => {
  const grille = construireGrille(
    [],
    SEMAINE,
    [DUCOS],
    () => null,
    [
      { id: "garnier", agenceIds: [DUCOS.id] },
      { id: "perrin", agenceIds: [DUCOS.id] },
    ],
    [BLOCAGE_GARNIER],
  );
  const ligneDe = (id: string) => {
    const ligne = grille.find((l) => l.technicienId === id);
    if (ligne === undefined) throw new Error(`pas de ligne pour ${id}`);
    return ligne;
  };

  it("marque BLOQUÉES les cases du mardi et du mercredi de Garnier — bornes comprises", () => {
    const cases = ligneDe("garnier").cases;
    expect(cases[1].bloquee).toBe(true);
    expect(cases[2].bloquee).toBe(true);
  });

  it("et laisse LIBRES le lundi (veille) et le jeudi (lendemain) de Garnier", () => {
    // Le voisin qui doit rester vert : sans lui, un rangement qui marquerait
    // la semaine entière passerait pour juste.
    const cases = ligneDe("garnier").cases;
    expect(cases[0].bloquee).toBe(false);
    expect(cases[3].bloquee).toBe(false);
  });

  it("ne bloque RIEN chez Perrin, qui n'a pas de blocage", () => {
    expect(ligneDe("perrin").cases.every((c) => c.bloquee === false)).toBe(
      true,
    );
  });

  it("la file d'attente (sans technicien) n'est jamais bloquée", () => {
    const avecFile = construireGrille(
      [intervention({ id: "a", technicien_id: null })],
      SEMAINE,
      [DUCOS],
      () => null,
      [],
      [BLOCAGE_GARNIER],
    );
    const file = avecFile.find((l) => l.technicienId === null);
    expect(file).toBeDefined();
    expect(file?.cases.every((c) => c.bloquee === false)).toBe(true);
  });

  it("une case bloquée garde ce qu'elle porte déjà — une clôturée a eu lieu (I5)", () => {
    const avecLigne = construireGrille(
      [
        intervention({
          id: "cloturee",
          technicien_id: "garnier",
          date_planifiee: jour(MARDI),
        }),
      ],
      SEMAINE,
      [DUCOS],
      () => null,
      [{ id: "garnier", agenceIds: [DUCOS.id] }],
      [BLOCAGE_GARNIER],
    );
    const mardi = avecLigne[0].cases[1];
    expect(mardi.bloquee).toBe(true);
    expect(mardi.lignes.map((l) => l.id)).toEqual(["cloturee"]);
  });

  it("sans blocage fourni, aucune case n'est bloquée — le défaut affirme le moins", () => {
    const sans = construireGrille([], SEMAINE, [DUCOS], () => null, [
      { id: "garnier", agenceIds: [DUCOS.id] },
    ]);
    expect(sans[0].cases.every((c) => c.bloquee === false)).toBe(true);
  });
});

/* ────────────────────────────── LA VUE JOUR ────────────────────────────── */

const CALENDRIER_NOUMEA: Calendrier = {
  code: "test",
  fuseau: "Pacific/Noumea",
  territoire: "NC",
  plages: [1, 2, 3, 4, 5, 6].flatMap((jour_semaine) => [
    { jour_semaine, debut_minutes: 450, fin_minutes: 690 },
    { jour_semaine, debut_minutes: 780, fin_minutes: 1020 },
  ]),
  jours_particuliers: [],
};

const NOUMEA: AgenceDeJournee = {
  id: "ag-ducos",
  libelle: "Ducos",
  calendrier: CALENDRIER_NOUMEA,
  pasCreneauMinutes: 30,
};

function instant(j: JourLocal, minutes: number): Date {
  return new Date(Date.UTC(j.annee, j.mois - 1, j.jour, 0, minutes, 0));
}
const minutesDe = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
/**
 * Les trous d'une journée LIBRE chez Nouméa : deux plages de 240 minutes au
 * pas de 30 — dérivé des plages ci-dessus, jamais lu sur le module qu'on
 * éprouve. L'axe porte AUSSI le creux de midi (11:30–13:00, hors ouverture),
 * si bien que `cellules.length` vaut 19 et non 16 : compter les cellules
 * mesurerait l'axe, pas les trous.
 */
const TROUS_D_UNE_JOURNEE_LIBRE = (240 / 30) * 2;

function pose(p: Partial<Occupante> & { id: string }): Occupante {
  return {
    technicien_id: "garnier",
    agence_id: NOUMEA.id,
    creneau_debut: null,
    creneau_fin: null,
    duree_estimee_min: null,
    ...p,
  };
}

describe("la VUE JOUR — une colonne bloquée n'a AUCUN trou", () => {
  const journee = construireJournee(
    [],
    MARDI,
    [NOUMEA],
    minutesDe,
    [
      { id: "garnier", agenceIds: [NOUMEA.id] },
      { id: "perrin", agenceIds: [NOUMEA.id] },
    ],
    [BLOCAGE_GARNIER],
  );
  const colonneDe = (id: string) => {
    const colonne = journee.colonnes.find((c) => c.technicienId === id);
    if (colonne === undefined) throw new Error(`pas de colonne pour ${id}`);
    return colonne;
  };

  it("la colonne de Garnier est bloquée, et ses cellules le disent toutes", () => {
    const garnier = colonneDe("garnier");
    expect(garnier.bloquee).toBe(true);
    expect(garnier.cellules.every((c) => c.etat === "bloque")).toBe(true);
  });

  it("et elle ne compte AUCUN créneau libre — un trou qu'on ne peut pas remplir n'est pas un trou", () => {
    expect(colonneDe("garnier").creneauxLibres).toBe(0);
  });

  it("la colonne de Perrin, elle, garde tous ses trous", () => {
    const perrin = colonneDe("perrin");
    expect(perrin.bloquee).toBe(false);
    expect(perrin.creneauxLibres).toBe(TROUS_D_UNE_JOURNEE_LIBRE);
    expect(perrin.cellules.some((c) => c.etat === "bloque")).toBe(false);
  });

  it("le total des trous de la journée exclut la colonne bloquée", () => {
    expect(journee.creneauxLibres).toBe(TROUS_D_UNE_JOURNEE_LIBRE);
  });

  it("le LENDEMAIN du blocage, Garnier retrouve ses trous", () => {
    const jeudi = construireJournee(
      [],
      JEUDI,
      [NOUMEA],
      minutesDe,
      [{ id: "garnier", agenceIds: [NOUMEA.id] }],
      [BLOCAGE_GARNIER],
    );
    expect(jeudi.colonnes[0].bloquee).toBe(false);
    expect(jeudi.colonnes[0].creneauxLibres).toBe(TROUS_D_UNE_JOURNEE_LIBRE);
  });

  it("une occupation posée sur une colonne bloquée reste OCCUPÉE — elle n'est pas effacée", () => {
    const avecLigne = construireJournee(
      [
        pose({
          id: "cloturee",
          creneau_debut: instant(MARDI, 480),
          creneau_fin: instant(MARDI, 540),
        }),
      ],
      MARDI,
      [NOUMEA],
      minutesDe,
      [{ id: "garnier", agenceIds: [NOUMEA.id] }],
      [BLOCAGE_GARNIER],
    );
    const garnier = avecLigne.colonnes[0];
    expect(garnier.bloquee).toBe(true);
    const occupees = garnier.cellules.filter((c) => c.etat === "occupe");
    expect(occupees).toHaveLength(2);
    expect(occupees[0].occupations[0]?.ligne.id).toBe("cloturee");
    expect(
      garnier.cellules
        .filter((c) => c.etat !== "occupe")
        .every((c) => c.etat === "bloque"),
    ).toBe(true);
  });

  it("sans blocage fourni, aucune colonne n'est bloquée — le défaut affirme le moins", () => {
    const sans = construireJournee([], MARDI, [NOUMEA], minutesDe, [
      { id: "garnier", agenceIds: [NOUMEA.id] },
    ]);
    expect(sans.colonnes[0].bloquee).toBe(false);
    expect(sans.colonnes[0].cellules.some((c) => c.etat === "bloque")).toBe(
      false,
    );
  });
});

/* ─────────────────── LE SÉLECTEUR DE LA FICHE « AFFECTER » ─────────────────── */

const ANNUAIRE: Annuaire = (id) =>
  id === "garnier"
    ? { etat: "nom", nom: "D. Garnier" }
    : id === "perrin"
      ? { etat: "nom", nom: "P. Perrin" }
      : { etat: "non_demandee" };

describe("le sélecteur « Affecter » DIT le blocage avant le choix", () => {
  const techniciens = [
    { utilisateur_id: "perrin" },
    { utilisateur_id: "garnier" },
  ];

  it("suffixe la personne bloquée à la date de l'intervention, et elle seule", () => {
    const options = optionsDAffectation(
      techniciens,
      ANNUAIRE,
      [BLOCAGE_GARNIER],
      jour(MARDI),
    );
    expect(options).toEqual([
      {
        valeur: "garnier",
        libelle: `D. Garnier — ${t("intervention.technicien_agenda_bloque_le")} ${dateCivile(jour(MARDI))}`,
        bloque: true,
      },
      { valeur: "perrin", libelle: "P. Perrin", bloque: false },
    ]);
  });

  it("ne suffixe personne le lendemain du blocage — le voisin qui doit rester vert", () => {
    const options = optionsDAffectation(
      techniciens,
      ANNUAIRE,
      [BLOCAGE_GARNIER],
      jour(JEUDI),
    );
    expect(options.every((o) => o.bloque === false)).toBe(true);
    expect(options.map((o) => o.libelle)).toEqual(["D. Garnier", "P. Perrin"]);
  });

  it("une intervention SANS date ne peut rien dire — aucun suffixe, jamais une affirmation", () => {
    const options = optionsDAffectation(
      techniciens,
      ANNUAIRE,
      [BLOCAGE_GARNIER],
      null,
    );
    expect(options.every((o) => o.bloque === false)).toBe(true);
  });

  it("le tri reste par nom, le suffixe n'y entre pas", () => {
    // « D. Garnier — agenda bloqué… » trie toujours comme « D. Garnier ».
    const options = optionsDAffectation(
      techniciens,
      ANNUAIRE,
      [BLOCAGE_GARNIER],
      jour(MARDI),
    );
    expect(options.map((o) => o.valeur)).toEqual(["garnier", "perrin"]);
  });
});
