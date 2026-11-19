import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * 9L25-TESTS-FRAGILES — DÉCISION D'ALEXIS DU 10/11/2026.
 *
 * `tests/isolation/transmission-groupee.test.ts` comparait une date écrite en
 * dur au jour réel via la même porte que `confirmer_date_passee`
 * (`lib/interventions/depot.ts`) : la date, future à l'écriture, est devenue
 * passée, et l'épreuve a rougi pour une raison qui n'a rien à voir avec ce
 * qu'elle éprouve. Cinq fichiers ont été corrigés le 10/11/2026 par l'oracle
 * déjà en usage ailleurs dans ce dépôt (`chargerCalendrierAgence` +
 * `prochainJourOuvert`) : un jour ouvré CALCULÉ à partir d'aujourd'hui,
 * jamais une date qui vieillit en silence.
 *
 * ## CE QUE CE GARDIEN SURVEILLE, ET POURQUOI PAS TOUT LE RESTE
 *
 * Une date littérale de l'année courante ou suivante est partout dans
 * `tests/isolation/**` et `tests/e2e/**` — en fixture SQL brute, en
 * `new Date(...)` d'une écriture Prisma directe, en argument d'une fonction
 * de domaine sans rapport (absences, file d'attente, taux horaire...). AUCUNE
 * de ces formes ne traverse la validation qui compare une date au jour réel :
 * elles écrivent la colonne directement, ou appellent une fonction qui ne lit
 * jamais l'horloge. Les lister une par une ferait un gardien immense et
 * toujours faux, puisque chaque fixture future en ajouterait une sans rien
 * garder.
 *
 * Ce qui a réellement cassé en 2026 est une date qui atteint un écran ou une
 * route EN SE FAISANT PASSER POUR UNE SAISIE — un `.fill(...)` Playwright, un
 * `FormData.set(...)`, une navigation `page.goto`/`toHaveURL` avec la date en
 * paramètre d'URL. C'est le seul chemin par lequel une date littérale
 * rencontre une validation sensible au jour réel, et c'est le seul que ce
 * gardien regarde.
 *
 * ## LES DEUX DIRECTIONS
 *
 * Une occurrence trouvée hors de `EXCEPTIONS` fait échouer le gardien — c'est
 * la direction qui protège. Et une entrée d'`EXCEPTIONS` dont le texte ne se
 * retrouve plus dans son fichier fait échouer aussi — l'exemption qui ne
 * protège plus rien survit sinon à ce qu'elle exemptait (§9, 14/09).
 */

interface Exception {
  readonly fichier: string;
  readonly contient: string;
  readonly motif: string;
}

const MOTIF_DATE_DISPO =
  "`date_dispo_prevue` (suspension d'une intervention, en attente d'une " +
  "pièce) : ne compare jamais sa valeur à l'horloge réelle, seulement " +
  "affichée (9K12A, 10/11/2026).";

const MOTIF_CAPTURE_SEMAINE_FIXE =
  "Navigation vers une semaine ou un jour FIXE du jeu de démonstration, " +
  "pour une capture documentaire : la fiche est posée directement par SQL " +
  "ou préexiste dans le semis, aucune assertion ne dépend du jour réel.";

const MOTIF_PERIODE_INVERSEE =
  "Éprouve seulement qu'une fin de période avant son début affiche le " +
  "refus attendu (IN-07) — les deux valeurs ne sont jamais comparées à " +
  "aujourd'hui, l'une est simplement postérieure à l'autre.";

const EXCEPTIONS: readonly Exception[] = [
  {
    fichier: "tests/e2e/9ey-equipe-alerte-tout-envoyer.spec.ts",
    contient: 'input[name="date_obtention"]\').fill("2026-01-01")',
    motif:
      "`date_obtention` d'une habilitation renouvelée : une date d'acquisition passée, jamais comparée à l'horloge pour déterminer un refus.",
  },
  {
    fichier: "tests/e2e/9k13-terrain-attente-piece.spec.ts",
    contient: '.fill("2026-12-15")',
    motif: MOTIF_DATE_DISPO,
  },
  {
    fichier: "tests/e2e/9k13-terrain-attente-piece.spec.ts",
    contient: '.fill("2026-12-20")',
    motif: MOTIF_DATE_DISPO,
  },
  {
    fichier: "tests/e2e/9l04g-terrain-barre-fixe-terminer.spec.ts",
    contient: '.fill("2026-12-20")',
    motif: MOTIF_DATE_DISPO,
  },
  {
    fichier: "tests/e2e/9l13-suspendre-arrete-compteur.spec.ts",
    contient: '.fill("2026-12-10")',
    motif: MOTIF_DATE_DISPO,
  },
  {
    fichier: "tests/e2e/captures-9br-tpa4b-messages.spec.ts",
    contient: 'input[name="date_verification"]\').fill("2026-09-29")',
    motif:
      "`date_verification` d'un VGP : une date de contrôle passée, jamais une échéance future — elle reste valide tant que le temps avance.",
  },
  {
    fichier: "tests/e2e/captures-9bv-dates-reprise.spec.ts",
    contient: "/planning?semaine=2026-09-28",
    motif: MOTIF_CAPTURE_SEMAINE_FIXE,
  },
  {
    fichier: "tests/e2e/captures-9bv-dates-reprise.spec.ts",
    contient: "/absences?semaine=2026-09-28",
    motif: MOTIF_CAPTURE_SEMAINE_FIXE,
  },
  {
    fichier: "tests/e2e/captures-9k05-suites-a-donner-debloquees.spec.ts",
    contient: '.fill("2026-12-15")',
    motif: MOTIF_DATE_DISPO,
  },
  {
    fichier: "tests/e2e/captures-pg-a1-feries-grille.spec.ts",
    contient: "/planning?semaine=2026-09-21",
    motif:
      "Semaine portant un jour férié du semis (24/09, `prisma/seed-data.ts`) : " +
      MOTIF_CAPTURE_SEMAINE_FIXE,
  },
  {
    fichier: "tests/e2e/captures-pg-a1-feries-grille.spec.ts",
    contient: "/planning?vue=jour&jour=2026-09-24",
    motif: MOTIF_CAPTURE_SEMAINE_FIXE,
  },
  {
    fichier: "tests/e2e/captures-pg-a2-ordre-techniciens.spec.ts",
    contient: "/planning?vue=jour&jour=2026-09-21",
    motif: MOTIF_CAPTURE_SEMAINE_FIXE,
  },
  {
    fichier: "tests/e2e/captures-tpa4a-messages.spec.ts",
    contient: "/interventions?du=2026-10-10&au=2026-10-01",
    motif: MOTIF_PERIODE_INVERSEE,
  },
  {
    fichier: "tests/e2e/captures-tpi9-noms-fictifs.spec.ts",
    contient: "/planning?vue=jour&jour=2026-09-21",
    motif: MOTIF_CAPTURE_SEMAINE_FIXE,
  },
  {
    fichier: "tests/e2e/interventions-2.spec.ts",
    contient: '.fill("2026-10-15")',
    motif: MOTIF_DATE_DISPO,
  },
  {
    fichier: "tests/e2e/interventions-2.spec.ts",
    contient: '.fill("2026-10-20")',
    motif: MOTIF_DATE_DISPO,
  },
  {
    fichier: "tests/e2e/messages-tpa4a.spec.ts",
    contient: "/interventions?du=2026-10-10&au=2026-10-01",
    motif: MOTIF_PERIODE_INVERSEE,
  },
  {
    fichier: "tests/isolation/droits-ecrans-tp-s3.test.ts",
    contient: 'corps.set("date_effet", "2026-10-04")',
    motif:
      "`date_effet` d'un taux horaire : la lecture compare à une date DONNÉE au calcul (`lte: aLaDate`), jamais figée à la création — un taux du passé reste un taux valide.",
  },
];

const ANNEES_SURVEILLEES = [
  new Date().getFullYear(),
  new Date().getFullYear() + 1,
];
const DATE_LITTERALE = /\b(20\d{2})-[0-1]\d-[0-3]\d\b/g;

/** Les trois seules formes par lesquelles une date littérale se fait passer pour une saisie. */
function estUneSaisieVivante(ligne: string): boolean {
  return (
    /\.fill\(/.test(ligne) ||
    /\.set\(\s*["'`][a-zA-Z_]*date[a-zA-Z_]*["'`]/i.test(ligne) ||
    /\.goto\(|toHaveURL\(/.test(ligne)
  );
}

interface Occurrence {
  readonly fichier: string;
  readonly ligne: string;
}

function occurrencesVivantes(): readonly Occurrence[] {
  const fichiers = fichiersSource(
    ["tests/isolation", "tests/e2e"],
    [".ts", ".tsx"],
  );
  const resultat: Occurrence[] = [];
  for (const fichier of fichiers) {
    const lignes = sansCommentaires(fichier.contenu).split("\n");
    for (const ligne of lignes) {
      const annees = [...ligne.matchAll(DATE_LITTERALE)].map((m) =>
        Number(m[1]),
      );
      if (annees.length === 0) continue;
      if (!annees.some((an) => ANNEES_SURVEILLEES.includes(an))) continue;
      if (!estUneSaisieVivante(ligne)) continue;
      resultat.push({ fichier: fichier.chemin, ligne });
    }
  }
  return resultat;
}

describe("aucune date littérale de l'année courante ou suivante n'atteint un écran comme une saisie", () => {
  it("TÉMOIN — le balayage trouve bien des dates littérales dans ces dossiers", () => {
    // Sans ce témoin, un motif cassé dans `estUneSaisieVivante` ou dans
    // `DATE_LITTERALE` rendrait ce gardien vert sur une population vide.
    const fichiers = fichiersSource(
      ["tests/isolation", "tests/e2e"],
      [".ts", ".tsx"],
    );
    expect(fichiers.length).toBeGreaterThan(100);
    const avecDate = fichiers.filter((f) =>
      DATE_LITTERALE.test(sansCommentaires(f.contenu)),
    );
    expect(avecDate.length).toBeGreaterThan(50);
  });

  it("toute occurrence vivante est une EXCEPTION nommée et motivée", () => {
    const occurrences = occurrencesVivantes();
    const sansException = occurrences.filter(
      (occ) =>
        !EXCEPTIONS.some(
          (exception) =>
            exception.fichier === occ.fichier &&
            occ.ligne.includes(exception.contient) &&
            exception.motif.trim() !== "",
        ),
    );
    expect(sansException).toEqual([]);
  });

  it("aucune EXCEPTION n'est devenue un trou — chacune retrouve sa ligne", () => {
    const occurrences = occurrencesVivantes();
    const perimees = EXCEPTIONS.filter(
      (exception) =>
        !occurrences.some(
          (occ) =>
            occ.fichier === exception.fichier &&
            occ.ligne.includes(exception.contient),
        ),
    );
    expect(perimees).toEqual([]);
  });
});
