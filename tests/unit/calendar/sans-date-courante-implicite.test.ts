import { describe, expect, it } from "vitest";

import { fichiersSource, sansCommentaires } from "../outils/fichiers-source";

/**
 * Gardien n°3 du ticket L0-08 : **aucun appel à la date courante sans fuseau
 * explicite dans le code métier**, et aucun accesseur local de `Date`.
 *
 * C'est le point 2 du ticket rendu exécutable, et notamment sa phrase la plus
 * concrète : « Point critique pour l'application technicien : l'affichage suit
 * le fuseau de l'AGENCE, jamais celui de l'appareil. Un technicien en
 * déplacement ne doit pas voir son planning se décaler parce que son téléphone
 * a changé de fuseau. »
 *
 * **Ce que ce gardien attrape, et que le scénario d'appareil ne peut pas
 * attraper.** `tests/unit/calendar/appareil-en-deplacement.test.ts` prouve que
 * le module calendrier est insensible au fuseau de l'appareil. Mais il ne dit
 * rien du code qui sera écrit aux lots suivants : un `creneau.getHours()` posé
 * dans un composant de planning au lot 3 passerait toutes les suites de tests
 * et ne se manifesterait que chez un technicien à Sydney. Le scénario prouve
 * le module ; le gardien tient le dépôt.
 *
 * **Les quatre familles interdites.**
 *   1. `new Date()` et `Date.now()` — lire l'instant présent sans dire « où ».
 *      Le chemin est `maintenant(fuseau)`, dont la signature exige un fuseau.
 *   2. Les accesseurs et modificateurs LOCAUX de `Date` (`getHours`, `getDay`,
 *      `setMonth`…). Ils lisent le fuseau du système. Leurs équivalents UTC
 *      (`getUTCHours`…) restent permis : un instant en UTC n'est ambigu pour
 *      personne.
 *   3. Le formatage par la locale — `toLocaleString`, `Intl.DateTimeFormat` —
 *      qui retombe sur le fuseau de l'appareil dès qu'on omet `timeZone`.
 *   4. Une chaîne date-heure SANS décalage — `new Date("2026-08-21T08:00")` —
 *      que JavaScript interprète dans le fuseau local. C'est le point 2 du
 *      ticket : « une heure locale sans fuseau n'est pas une donnée, c'est une
 *      ambiguïté ».
 */
const REPERTOIRES = ["app", "components", "lib", "prisma", "scripts"];

/**
 * Les deux exemptions, et ce qui les justifie.
 *
 * `lib/calendar/fuseau.ts` est le point de passage unique institué par le
 * ticket : c'est là, et là seulement, que `Intl.DateTimeFormat` est construit
 * avec un `timeZone` explicite et que l'instant présent est lu — par
 * `maintenant(fuseau)`, qui ne peut pas être appelé sans fuseau.
 *
 * `lib/db/uuid.ts` lit l'horloge pour l'horodatage de 48 bits d'un UUID v7
 * (I10). C'est un INSTANT, et un instant n'a pas de fuseau : la faute que ce
 * gardien traque n'est pas de lire l'horloge, c'est de l'INTERPRÉTER sans dire
 * où. L'exemption est donc nommée plutôt que la règle élargie — un « sauf quand
 * c'est un instant » se serait étendu tout seul.
 *
 * `lib/terrain/uuid-appareil.ts` est le MÊME cas que `lib/db/uuid.ts`, côté
 * appareil plutôt que côté serveur (`node:crypto` y est absent) — un second
 * UUID v7, un second horodatage de 48 bits, la même exemption.
 *
 * `lib/terrain/file-saisies.ts` pose `instantAppareil`
 * (9F4H3-HORS-RESEAU-ENVOYER, décisions n° 107/108 d'Alexis) — « l'heure du
 * téléphone », le FAIT que ce lot capture, PAS une lecture implicite
 * substituée au fuseau de l'agence : c'est la donnée même que
 * `verifierInstantAppareil` (serveur) borne contre l'horloge serveur, et
 * elle part en ISO 8601 (`toISOString()`), un instant absolu, jamais
 * interprété localement — aucun `getHours`/`toLocaleString` ne l'accompagne.
 * `nouvelleOperation`, dans ce même fichier, est le point de passage unique
 * pour tout appelant qui a besoin de cette heure AVANT un premier envoi en
 * ligne (9F4H3A-FILE-SANS-PERTE, point 3) — `components/terrain/
 * compteur-terrain.tsx` y est passé à sa création et n'a plus besoin de sa
 * propre exemption.
 *
 * `lib/terrain/compteur-vivant.ts` (9F4H5-TERRAIN-VIVANT, point 1) — MÊME
 * raisonnement que `lib/db/uuid.ts` : `instantAppareil()` y lit l'horloge
 * pour une DURÉE (minutes fermées + écoulé du segment en cours), jamais
 * pour une lecture calendaire — aucun `getHours`, aucun formatage, rien
 * d'interprété localement. C'est le point de passage unique pour
 * `components/terrain/compteur-vivant.tsx`, qui n'a donc besoin d'aucune
 * exemption à lui.
 */
const EXEMPTS_FICHIERS = [
  "lib/calendar/fuseau.ts",
  "lib/db/uuid.ts",
  "lib/terrain/uuid-appareil.ts",
  "lib/terrain/file-saisies.ts",
  "lib/terrain/compteur-vivant.ts",
];

const MARQUEURS: readonly RegExp[] = [
  // 1. L'instant présent, sans fuseau.
  /\bnew\s+Date\s*\(\s*\)/,
  /\bDate\s*\.\s*now\s*\(/,
  // 2. Les accesseurs LOCAUX. Le `UTC` est exclu par la classe négative.
  /\.\s*(get|set)(?!UTC)(FullYear|Month|Date|Day|Hours|Minutes|Seconds|Milliseconds)\s*\(/,
  // 3. Le formatage par la locale.
  /\.\s*toLocale(Date|Time)?String\s*\(/,
  /\bIntl\s*\.\s*DateTimeFormat\b/,
  // 4. Une chaîne date-heure sans décalage : ni « Z », ni « +hh:mm ».
  /["'`]\d{4}-\d{2}-\d{2}T[\d:.]+["'`]/,
];

describe("aucune date courante sans fuseau (point 2 du ticket L0-08)", () => {
  const fichiers = fichiersSource(REPERTOIRES)
    .filter((fichier) => !EXEMPTS_FICHIERS.includes(fichier.chemin))
    .map((fichier) => ({
      chemin: fichier.chemin,
      contenu: sansCommentaires(fichier.contenu),
    }));

  it("parcourt bien des fichiers — sinon le gardien serait vide", () => {
    expect(fichiers.length).toBeGreaterThan(10);
  });

  it("aucun fichier applicatif ne lit l'heure du système", () => {
    const fautifs = fichiers
      .filter((fichier) =>
        MARQUEURS.some((marqueur) => marqueur.test(fichier.contenu)),
      )
      .map((fichier) => fichier.chemin);

    expect(
      fautifs,
      "l'heure est lue sans nommer de fuseau : elle serait celle de " +
        "l'APPAREIL, et le planning d'un technicien en déplacement se " +
        "décalerait. Passer par `maintenant(fuseau)` et `versLocal` " +
        "(lib/calendar).",
    ).toEqual([]);
  });

  it("le gardien détecte réellement les quatre familles — éprouvé sur des cas fabriqués", () => {
    const fautif = [
      "const aujourdhui = new Date();",
      "const t = Date.now();",
      "if (creneau.getHours() >= 8) { return true; }",
      "const jour = instant.getDay();",
      "debut.setHours(8, 0, 0, 0);",
      "const libelle = instant.toLocaleDateString();",
      'const f = new Intl.DateTimeFormat("fr-FR");',
      'const debut = new Date("2026-08-21T08:00:00");',
    ];
    for (const ligne of fautif) {
      expect(
        MARQUEURS.some((marqueur) => marqueur.test(ligne)),
        `non détecté : ${ligne}`,
      ).toBe(true);
    }
  });

  it("le gardien laisse passer ce qui nomme son fuseau — éprouvé sur des cas fabriqués", () => {
    const licite = [
      "const { local } = maintenant(calendrier.fuseau);",
      "const local = versLocal(instant, agence.fuseau);",
      "const annee = date.getUTCFullYear();",
      "date.setUTCHours(0, 0, 0, 0);",
      'const instant = new Date("2026-08-21T08:00:00.000Z");',
      'const instant = new Date("2026-08-21T08:00:00+11:00");',
      "const instant = new Date(horodatageEnMillisecondes);",
    ];
    for (const ligne of licite) {
      expect(
        MARQUEURS.some((marqueur) => marqueur.test(ligne)),
        `faux positif : ${ligne}`,
      ).toBe(false);
    }
  });

  /**
   * Chaque exemption est nommée, et il faut prouver qu'elle n'est pas un
   * décor : elle contient réellement un motif interdit, et c'est pourquoi
   * elle est écrite. Une exemption qui ne servirait à rien serait une porte
   * ouverte pour la suivante.
   */
  it("chaque exemption porte réellement un motif interdit", () => {
    const exemptes = fichiersSource(REPERTOIRES).filter((fichier) =>
      EXEMPTS_FICHIERS.includes(fichier.chemin),
    );
    expect(exemptes).toHaveLength(EXEMPTS_FICHIERS.length);

    for (const fichier of exemptes) {
      expect(
        MARQUEURS.some((marqueur) =>
          marqueur.test(sansCommentaires(fichier.contenu)),
        ),
        `${fichier.chemin} n'a plus besoin de son exemption : la retirer`,
      ).toBe(true);
    }
  });
});
