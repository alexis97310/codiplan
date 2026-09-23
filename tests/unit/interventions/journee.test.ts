import { describe, expect, it } from "vitest";

import type { JourLocal } from "@/lib/calendar/fuseau";
import {
  construireJournee,
  type AgenceDeJournee,
  type Occupante,
} from "@/lib/interventions/journee";

/**
 * LA VUE JOUR — l'axe, les trois états, et le compte des trous (11/09/2026).
 *
 * *« Un créneau libre doit se distinguer au premier coup d'œil d'un créneau
 * occupé, sinon l'écran ne sert à rien. »* C'est la définition de l'écran, donc
 * le sujet de ce fichier : **combien de trous, et où.**
 *
 * Les horaires employés ici sont ceux que le semis écrit réellement, mesurés en
 * base le 11/09/2026 — Nouméa 07:30–11:30 et 13:00–17:00, le siège 09:00–12:30
 * et 14:00–18:00, pas de 30 minutes partout. *Des horaires fabriqués auraient
 * démontré une arithmétique, pas l'écran.*
 */

/** Lundi 17 août 2026 — la semaine de la maquette. */
const LUNDI: JourLocal = { annee: 2026, mois: 8, jour: 17 };
/** Samedi 22 — Ducos ouvre, Koné non. */
const SAMEDI: JourLocal = { annee: 2026, mois: 8, jour: 22 };

const NOUMEA: AgenceDeJournee = {
  id: "ag-ducos",
  libelle: "Ducos",
  plages: [1, 2, 3, 4, 5, 6].flatMap((jourSemaine) => [
    { jourSemaine, debutMinutes: 450, finMinutes: 690 },
    { jourSemaine, debutMinutes: 780, finMinutes: 1020 },
  ]),
  pasCreneauMinutes: 30,
  calendrierConnu: true,
};
const SIEGE: AgenceDeJournee = {
  id: "ag-siege",
  libelle: "Siège",
  plages: [1, 2, 3, 4, 5].flatMap((jourSemaine) => [
    { jourSemaine, debutMinutes: 540, finMinutes: 750 },
    { jourSemaine, debutMinutes: 840, finMinutes: 1080 },
  ]),
  pasCreneauMinutes: 30,
  calendrierConnu: true,
};
const SANS_CALENDRIER: AgenceDeJournee = {
  id: "ag-muette",
  libelle: "Agence muette",
  plages: [],
  pasCreneauMinutes: 0,
  calendrierConnu: false,
};

/** Un instant d'un jour donné, à `minutes` minutes locales — en UTC pour le test. */
function instant(jour: JourLocal, minutes: number): Date {
  return new Date(
    Date.UTC(jour.annee, jour.mois - 1, jour.jour, 0, minutes, 0),
  );
}
const minutesDe = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

function pose(p: Partial<Occupante> & { id: string }): Occupante {
  return {
    technicien_id: "t1",
    agence_id: NOUMEA.id,
    creneau_debut: null,
    creneau_fin: null,
    duree_estimee_min: null,
    ...p,
  };
}

describe("l'axe des heures", () => {
  it("couvre les plages d'UNE agence, au pas qu'elle règle", () => {
    const j = construireJournee(
      [pose({ id: "a" })],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    // 07:30 → 17:00, pas 30 : les créneaux vont de 450 à 990 inclus.
    expect(j.pasMinutes).toBe(30);
    expect(j.axe[0]).toBe(450);
    expect(j.axe[j.axe.length - 1]).toBe(990);
    expect(j.axe).toHaveLength(19);
  });

  it("porte l'UNION quand deux agences aux horaires différents se côtoient", () => {
    // C'est le cas que l'exploitation nomme : Nouméa 07:30–17:00, le siège
    // 09:00–18:00. L'axe va de la première ouverture à la dernière fermeture.
    const j = construireJournee(
      [
        pose({ id: "a", agence_id: NOUMEA.id, technicien_id: "t1" }),
        pose({ id: "b", agence_id: SIEGE.id, technicien_id: "t2" }),
      ],
      LUNDI,
      [NOUMEA, SIEGE],
      minutesDe,
    );
    expect(j.axe[0]).toBe(450);
    expect(j.axe[j.axe.length - 1]).toBe(1050);
  });

  it("n'étire PAS l'axe sur une agence dont personne ne travaille ce jour-là", () => {
    // Sinon la mesure des trous devient fausse dans le sens flatteur : des
    // heures vides apparaîtraient dans toutes les colonnes.
    const j = construireJournee(
      [pose({ id: "a" })],
      LUNDI,
      [NOUMEA, SIEGE],
      minutesDe,
    );
    expect(j.axe[j.axe.length - 1]).toBe(990);
  });

  it("sans calendrier connu, il n'y a pas d'axe — et pas de faux créneaux", () => {
    const j = construireJournee(
      [pose({ id: "a", agence_id: SANS_CALENDRIER.id })],
      LUNDI,
      [SANS_CALENDRIER],
      minutesDe,
    );
    expect(j.axe).toEqual([]);
    expect(j.creneauxLibres).toBe(0);
  });
});

describe("les trois états d'une cellule", () => {
  it("OCCUPÉ sur toute la durée, et le libellé ne paraît qu'une fois", () => {
    const j = construireJournee(
      [
        pose({
          id: "a",
          creneau_debut: instant(LUNDI, 450),
          creneau_fin: instant(LUNDI, 570),
        }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    const occupees = j.colonnes[0].cellules.filter((c) => c.etat === "occupe");
    // 450 → 570, pas 30 : quatre créneaux.
    expect(occupees).toHaveLength(4);
    expect(
      occupees.filter((c) => c.occupations.some((o) => o.debutDeBloc)),
    ).toHaveLength(1);
    expect(occupees[0].debutMinutes).toBe(450);
  });

  it("LIBRE partout ailleurs, et le compte le dit", () => {
    const j = construireJournee(
      [
        pose({
          id: "a",
          creneau_debut: instant(LUNDI, 450),
          creneau_fin: instant(LUNDI, 570),
        }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    // 19 créneaux d'axe, 4 occupés, 1 hors ouverture (la pause 11:30–13:00
    // tombe sur le créneau 690–720 … et sur 720–750 et 750–780).
    expect(j.colonnes[0].creneauxLibres).toBe(
      j.axe.length -
        4 -
        j.colonnes[0].cellules.filter((c) => c.etat === "hors_ouverture")
          .length,
    );
    expect(j.creneauxLibres).toBeGreaterThan(0);
  });

  it("HORS OUVERTURE sur la pause de midi — un trou de déjeuner n'est pas un trou à vendre", () => {
    const j = construireJournee(
      [pose({ id: "a" })],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    const midi = j.colonnes[0].cellules.filter(
      (c) => c.debutMinutes >= 690 && c.debutMinutes < 780,
    );
    expect(midi).toHaveLength(3);
    expect(midi.every((c) => c.etat === "hors_ouverture")).toBe(true);
  });

  it("CHAQUE COLONNE grise ses PROPRES heures — c'est la demande exacte", () => {
    // Deux colonnes, deux agences. À 07:30 Nouméa ouvre et le siège non ;
    // à 17:30 c'est l'inverse. Le témoin est la paire croisée : une seule
    // moitié se satisferait d'une colonne toujours grise.
    const j = construireJournee(
      [
        pose({ id: "a", agence_id: NOUMEA.id, technicien_id: "t1" }),
        pose({ id: "b", agence_id: SIEGE.id, technicien_id: "t2" }),
      ],
      LUNDI,
      [NOUMEA, SIEGE],
      minutesDe,
    );
    const noumea = j.colonnes.find((c) => c.technicienId === "t1")!;
    const siege = j.colonnes.find((c) => c.technicienId === "t2")!;
    const a = (colonne: typeof noumea, minutes: number) =>
      colonne.cellules.find((c) => c.debutMinutes === minutes)!.etat;

    expect(a(noumea, 450)).toBe("libre");
    expect(a(siege, 450)).toBe("hors_ouverture");
    expect(a(noumea, 1020)).toBe("hors_ouverture");
    expect(a(siege, 1020)).toBe("libre");
  });

  it("le SAMEDI, la colonne de Koné n'existe pas et celle de Ducos ouvre", () => {
    // RG-PLA-01, vue par la journée : le siège ne porte aucune plage le samedi.
    const j = construireJournee(
      [
        pose({ id: "a", agence_id: NOUMEA.id, technicien_id: "t1" }),
        pose({ id: "b", agence_id: SIEGE.id, technicien_id: "t2" }),
      ],
      SAMEDI,
      [NOUMEA, SIEGE],
      minutesDe,
    );
    const siege = j.colonnes.find((c) => c.technicienId === "t2")!;
    expect(siege.creneauxLibres).toBe(0);
    expect(siege.cellules.every((c) => c.etat === "hors_ouverture")).toBe(true);
    const ducos = j.colonnes.find((c) => c.technicienId === "t1")!;
    expect(ducos.creneauxLibres).toBeGreaterThan(0);
  });
});

describe("ce que la journée refuse de deviner", () => {
  it("une intervention SANS créneau n'occupe rien", () => {
    // Elle appartient au jour, pas à une heure. La poser à l'ouverture lui
    // donnerait un créneau que personne n'a saisi.
    const j = construireJournee(
      [pose({ id: "a", creneau_debut: null })],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(j.colonnes[0].cellules.every((c) => c.etat !== "occupe")).toBe(true);
  });

  it("sans `creneau_fin`, la durée estimée sert de longueur", () => {
    const j = construireJournee(
      [
        pose({
          id: "a",
          creneau_debut: instant(LUNDI, 450),
          creneau_fin: null,
          duree_estimee_min: 90,
        }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(
      j.colonnes[0].cellules.filter((c) => c.etat === "occupe"),
    ).toHaveLength(3);
  });

  it("les non affectées viennent en PREMIÈRE colonne", () => {
    const j = construireJournee(
      [
        pose({ id: "a", technicien_id: "t9" }),
        pose({ id: "b", technicien_id: null }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(j.colonnes.map((c) => c.technicienId)).toEqual([null, "t9"]);
  });
});

/**
 * LES COLONNES VIENNENT DU RÉFÉRENTIEL, PAS DES INTERVENTIONS (12/09/2026).
 *
 * *L'objet déclaré de cet écran est de MONTRER LES TROUS* — et une personne
 * dont la journée est entièrement libre n'avait **aucune colonne**, parce que
 * les colonnes se déduisaient des interventions du jour. C'est-à-dire :
 * l'écran cachait exactement la personne qu'il devait montrer en premier, et
 * son compte de créneaux libres ne comptait que les trous des gens déjà
 * occupés — *faux dans le sens flatteur*.
 */
describe("une journée entièrement libre a quand même sa colonne", () => {
  const REFERENTIEL = [
    { id: "t-libre", agenceIds: ["ag-ducos"] },
    { id: "t-occupe", agenceIds: ["ag-ducos"] },
  ];

  it("le technicien SANS aucune intervention a sa colonne, et elle est pleine de trous", () => {
    const j = construireJournee(
      [pose({ id: "a", technicien_id: "t-occupe" })],
      LUNDI,
      [NOUMEA],
      minutesDe,
      REFERENTIEL,
    );
    const libre = j.colonnes.find((c) => c.technicienId === "t-libre");
    expect(libre, "la personne libre n'a pas de colonne").toBeDefined();
    // Aucune cellule occupée, et tout ce qui n'est pas la coupure de midi est
    // un trou : c'est exactement ce que l'écran doit montrer d'elle.
    expect(libre?.cellules.some((c) => c.etat === "occupe")).toBe(false);
    const horsOuverture =
      libre?.cellules.filter((c) => c.etat === "hors_ouverture").length ?? 0;
    expect((libre?.creneauxLibres ?? 0) + horsOuverture).toBe(j.axe.length);
    expect(libre?.creneauxLibres ?? 0).toBeGreaterThan(0);
  });

  it("LA FAUTE D'AVANT, telle qu'elle se commettait — sans référentiel, elle disparaît", () => {
    // Le référentiel par défaut est vide : c'est exactement le comportement
    // d'avant la réparation, et il est mesuré ici plutôt que raconté.
    const j = construireJournee(
      [pose({ id: "a", technicien_id: "t-occupe" })],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(j.colonnes.map((c) => c.technicienId)).toEqual(["t-occupe"]);
  });

  it("une personne du référentiel n'EFFACE pas celle qui n'y est pas", () => {
    // Le référentiel ajoute des colonnes, il n'en retire aucune : une personne
    // posée sur une intervention sans être au référentiel garde la sienne.
    // *Perdre une ligne pour la faire rentrer dans un référentiel serait
    // remplacer une disparition par une autre.*
    const j = construireJournee(
      [pose({ id: "a", technicien_id: "t-inconnu" })],
      LUNDI,
      [NOUMEA],
      minutesDe,
      REFERENTIEL,
    );
    expect(j.colonnes.map((c) => c.technicienId).sort()).toEqual([
      "t-inconnu",
      "t-libre",
      "t-occupe",
    ]);
  });

  it("L'AXE existe même quand PERSONNE n'a d'intervention", () => {
    // Le témoin de la réparation : l'axe se lisait sur les agences des
    // INTERVENTIONS. Sans intervention, il était vide — et la colonne rendue à
    // la personne libre n'aurait eu aucune heure où montrer ses trous.
    const j = construireJournee([], LUNDI, [NOUMEA], minutesDe, REFERENTIEL);
    expect(j.axe.length).toBeGreaterThan(0);
    expect(j.colonnes).toHaveLength(2);
    // Les deux colonnes comptent le même nombre de trous — la coupure de midi
    // est hors ouverture pour l'une comme pour l'autre —, et le total est leur
    // somme. Un total nul serait le symptôme d'un axe vide.
    const parPersonne = j.colonnes[0].creneauxLibres;
    expect(parPersonne).toBeGreaterThan(0);
    expect(j.creneauxLibres).toBe(parPersonne * 2);
  });
});

/**
 * CE QUI NE PEUT PAS ÊTRE DESSINÉ EST DIT, JAMAIS EFFACÉ (12/09/2026).
 *
 * Deux disparitions silencieuses vivaient ici : la ligne datée SANS HEURE, et
 * celle dont le créneau tombe hors de l'axe. *Un planning qui perd une ligne
 * fait poser quelqu'un sur un créneau déjà pris.*
 */
describe("les interventions non dessinables dans l'axe sont nommées", () => {
  it("SANS CRÉNEAU — elle appartient au jour, à aucune heure, et se dessine DANS la colonne (AFFICHAGE-MATERIEL-1)", () => {
    // *Mesuré le 23/09/2026 en production : reléguée SOUS toute la grille,
    // elle se lisait comme absente.* Elle n'entre plus dans `horsGrille` — la
    // colonne la porte elle-même, par `sansHeure`.
    const j = construireJournee(
      [pose({ id: "muette", creneau_debut: null, creneau_fin: null })],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(j.horsGrille).toBe(0);
    expect(j.colonnes[0].horsGrille).toEqual([]);
    expect(j.colonnes[0].sansHeure).toEqual([
      expect.objectContaining({ id: "muette" }),
    ]);
  });

  it("HORS DE L'AXE — 06:00 précède l'ouverture de 07:30", () => {
    const j = construireJournee(
      [
        pose({
          id: "matinale",
          creneau_debut: instant(LUNDI, 360),
          creneau_fin: instant(LUNDI, 420),
        }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(j.colonnes[0].horsGrille.map((h) => h.motif)).toEqual(["hors_axe"]);
  });

  it("LE SENS QUI DOIT RESTER VERT POUR SA PROPRE RAISON — une ligne dessinable n'y entre pas", () => {
    // Sans ce cas, une fonction qui rendrait TOUTES les lignes passerait les
    // deux épreuves ci-dessus. Ici la ligne est bien dessinée, et la liste des
    // non dessinables est vide POUR CETTE RAISON-LÀ.
    const j = construireJournee(
      [pose({ id: "posee", creneau_debut: instant(LUNDI, 540) })],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    expect(j.horsGrille).toBe(0);
    expect(
      j.colonnes[0].cellules.some((c) =>
        c.occupations.some((o) => o.ligne.id === "posee"),
      ),
      "la ligne n'est ni dessinée ni écartée : elle a disparu",
    ).toBe(true);
  });
});

/**
 * DEUX INTERVENTIONS QUI SE CHEVAUCHENT — la seconde ne disparaît plus.
 */
describe("une cellule porte TOUTES ses occupations", () => {
  it("un chevauchement complet reste visible", () => {
    const j = construireJournee(
      [
        pose({
          id: "large",
          creneau_debut: instant(LUNDI, 540),
          creneau_fin: instant(LUNDI, 660),
        }),
        pose({
          id: "dedans",
          creneau_debut: instant(LUNDI, 570),
          creneau_fin: instant(LUNDI, 630),
        }),
      ],
      LUNDI,
      [NOUMEA],
      minutesDe,
    );
    const vues = new Set(
      j.colonnes.flatMap((c) =>
        c.cellules.flatMap((cel) => cel.occupations.map((o) => o.ligne.id)),
      ),
    );
    // Avec `.find()`, « dedans » ne paraissait dans AUCUNE cellule : « large »
    // la couvrait de bout en bout.
    expect(vues).toEqual(new Set(["large", "dedans"]));
    // Et chacune n'annonce son libellé qu'une fois.
    expect(
      j.colonnes[0].cellules.flatMap((c) =>
        c.occupations.filter((o) => o.debutDeBloc).map((o) => o.ligne.id),
      ),
    ).toEqual(["large", "dedans"]);
  });
});
