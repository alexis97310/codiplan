import { describe, expect, it } from "vitest";

import { FERIES_FIXES, FETES_MOBILES } from "@/prisma/seed-data";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * Gardien n°2 du ticket L0-08 : **aucune date fériée écrite dans le code**, et
 * le calcul de Pâques cantonné au seed.
 *
 * C'est le point 4 du ticket rendu exécutable : « Jours fériés : ce sont des
 * données, pas du code. La Nouvelle-Calédonie a ses propres jours fériés, la
 * métropole les siens. Nous vendons la solution : un client sur un autre
 * territoire aura les siens. Table dédiée, par territoire et par date,
 * alimentée par seed. Aucune date fériée écrite dans le code. Les fêtes mobiles
 * adossées à Pâques peuvent être calculées, mais le calcul produit des données
 * de la table, il ne s'exécute pas à la volée dans le métier. »
 *
 * **Ce qu'une date fériée en dur coûte.** Un `if (mois === 7 && jour === 14)`
 * est juste en métropole et en Nouvelle-Calédonie, faux à Tahiti le 29 juin, et
 * incorrigible : le jour où un territoire déplace une fête, ou décide qu'un
 * lundi de Pentecôte est travaillé, la correction devient un correctif logiciel
 * déployé en urgence au lieu d'une ligne de table.
 *
 * **Les motifs sont DÉRIVÉS DU SEED, pas écrits à la main.** C'est la leçon de
 * D41 appliquée aux fériés, comme `sans-litteral-de-parite` l'applique aux
 * taux (CLAUDE.md §9) : un férié ajouté demain au jeu de démonstration est
 * protégé le jour même, sans que personne ait à revenir mettre ce test à jour.
 * Un gardien dont la liste vieillit ne garde rien.
 */
const REPERTOIRES = ["app", "components", "lib", "prisma", "scripts"];

/** Le seed des fériés — l'endroit désigné par le ticket pour ces données. */
const EXEMPTS_FICHIERS = ["prisma/seed-data.ts"];

/**
 * Libellés de fériés, tirés du seed — fixes ET mobiles. Un libellé dans le code
 * applicatif signale un traitement particulier réservé à un jour nommé —
 * exactement ce qui doit vivre en base.
 */
const LIBELLES = [
  ...new Set([
    ...Object.values(FERIES_FIXES).flatMap((feries) =>
      feries.map((ferie) => ferie.libelle),
    ),
    ...FETES_MOBILES.map((fete) => fete.libelle),
  ]),
].sort();

/**
 * Fragments de date à surveiller, tirés du seed :
 *   — `-MM-JJ` pour les fériés fixes, sous la forme ISO ;
 *   — `JJ/MM` pour la forme française des imports (D31).
 * Les fériés mobiles n'ont pas de date fixe : ce sont leurs libellés, plus
 * l'interdiction d'appeler le calcul, qui les protègent.
 *
 * **Ce que le gardien ne cherche PAS, et pourquoi.** La forme éclatée
 * `{ mois: 7, jour: 14 }` n'est pas surveillée : `{ mois: 1, jour: 1 }` est
 * l'ancre légitime du calcul des semaines ISO, et un gardien qui la refuserait
 * apprendrait surtout aux développeurs à contourner les gardiens. Les trois
 * détections retenues — fragment ISO, fragment français, libellé — couvrent les
 * façons dont un férié se code en dur pour de bon, et l'interdiction d'importer
 * le calcul de Pâques ferme la dernière.
 */
const FRAGMENTS_DE_DATE = [
  ...new Set(
    Object.values(FERIES_FIXES).flatMap((feries) =>
      feries.flatMap((ferie) => {
        const mois = String(ferie.mois).padStart(2, "0");
        const jour = String(ferie.jour).padStart(2, "0");
        return [`-${mois}-${jour}`, `${jour}/${mois}`];
      }),
    ),
  ),
].sort();

/**
 * Le calcul de Pâques : autorisé, mais réservé au seed.
 *
 * Le motif ne cherche PAS `calendar/paques` : à l'intérieur de `lib/calendar`,
 * l'import s'écrit `./paques`, et c'est justement de là qu'il serait tentant de
 * l'appeler. L'épreuve du gardien sur une violation réelle l'a montré — la
 * première rédaction laissait passer `import { dimanchePaques } from
 * "./paques"` dans `lib/calendar/ouverture.ts`. Un motif qui ne voit que la
 * forme lointaine d'une faute laisse passer la forme proche, qui est la plus
 * probable.
 */
const MODULE_PAQUES = /from\s+["'][^"']*paques["']/;

/** Seul `prisma/` a le droit d'appeler le calcul — il en écrit le résultat. */
const AUTORISES_A_CALCULER = ["prisma/"];

function contientUnFragment(contenu: string): string | null {
  return (
    FRAGMENTS_DE_DATE.find((fragment: string) => contenu.includes(fragment)) ??
    null
  );
}

function contientUnLibelle(contenu: string): string | null {
  return LIBELLES.find((libelle: string) => contenu.includes(libelle)) ?? null;
}

describe("aucune date fériée en dur (point 4 du ticket L0-08)", () => {
  const fichiers = fichiersSource(REPERTOIRES)
    .filter((fichier) => !EXEMPTS_FICHIERS.includes(fichier.chemin))
    .map((fichier) => ({
      chemin: fichier.chemin,
      contenu: sansCommentaires(fichier.contenu),
    }));

  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(fichiers.length).toBeGreaterThan(10);
  });

  it("le seed porte réellement des fériés — sinon les motifs seraient vides", () => {
    // Un gardien qui dérive ses motifs d'une source vide ne garde rien.
    expect(LIBELLES.length).toBeGreaterThan(5);
    expect(FRAGMENTS_DE_DATE.length).toBeGreaterThan(10);
    expect(LIBELLES).toContain("Fête de la citoyenneté");
  });

  it("aucun fichier applicatif ne porte une date de férié", () => {
    const fautifs = fichiers
      .map((fichier) => ({
        chemin: fichier.chemin,
        fragment: contientUnFragment(fichier.contenu),
      }))
      .filter((trouve) => trouve.fragment !== null)
      .map((trouve) => `${trouve.chemin} (${trouve.fragment})`);

    expect(
      fautifs,
      "une date de jour férié est écrite en dur : les fériés sont des " +
        "données de la table `jour_ferie`, par territoire (D46)",
    ).toEqual([]);
  });

  it("aucun fichier applicatif ne nomme un férié", () => {
    const fautifs = fichiers
      .map((fichier) => ({
        chemin: fichier.chemin,
        libelle: contientUnLibelle(fichier.contenu),
      }))
      .filter((trouve) => trouve.libelle !== null)
      .map((trouve) => `${trouve.chemin} (${trouve.libelle})`);

    expect(
      fautifs,
      "un jour férié est nommé dans le code : un traitement réservé à un jour " +
        "nommé est une règle de territoire, elle vit en base",
    ).toEqual([]);
  });

  /**
   * La frontière du point 4 : le calcul de Pâques produit des DONNÉES. Un
   * chemin métier qui l'importerait recalculerait des fériés au lieu de les
   * lire, et la surcharge « travaillé » de D13 lui serait invisible.
   */
  it("seul le seed importe le calcul de Pâques", () => {
    const fautifs = fichiersSource(REPERTOIRES)
      .filter((fichier) =>
        MODULE_PAQUES.test(sansCommentaires(fichier.contenu)),
      )
      .map((fichier) => fichier.chemin)
      .filter(
        (chemin) =>
          !AUTORISES_A_CALCULER.some((prefixe) => chemin.startsWith(prefixe)),
      );

    expect(
      fautifs,
      "`lib/calendar/paques` produit les lignes de `jour_ferie` ; il ne " +
        "s'exécute pas à la volée dans le métier (point 4 du ticket L0-08)",
    ).toEqual([]);
  });

  it("le module calendrier ne réexporte pas le calcul de Pâques", () => {
    const index = fichiersSource(["lib/calendar"]).find(
      (fichier) => fichier.chemin === "lib/calendar/index.ts",
    );
    expect(index).toBeDefined();
    expect(sansCommentaires(index?.contenu ?? "")).not.toContain("./paques");
  });

  it("le gardien détecte réellement un férié en dur — éprouvé sur des cas fabriqués", () => {
    const fautif = [
      'if (cle === "2026-07-14") { return false; }',
      'const nationale = "2027-07-14";',
      'const noel = "25/12";',
      'if (ferie.libelle === "Toussaint") { return true; }',
      'const solidarite = "Lundi de Pentecôte";',
    ];

    for (const ligne of fautif) {
      const vu =
        contientUnFragment(ligne) !== null || contientUnLibelle(ligne) !== null;
      expect(vu, `non détecté : ${ligne}`).toBe(true);
    }
  });

  it("le gardien laisse passer la lecture du référentiel — éprouvé sur des cas fabriqués", () => {
    const licite = [
      "const ferie = ferieDuJour(calendrier, jour);",
      "if (estChome(calendrier, jour)) { return []; }",
      "await tx.jourFerie.findMany({ where: { territoire } });",
      "return calendrier.feries.filter((ferie) => ferie.travaille);",
    ];

    for (const ligne of licite) {
      const vu =
        contientUnFragment(ligne) !== null || contientUnLibelle(ligne) !== null;
      expect(vu, `faux positif : ${ligne}`).toBe(false);
    }
  });
});
