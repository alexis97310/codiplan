import { existsSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fichiersSource } from "../outils/fichiers-source";

/**
 * TOUTE EXEMPTION D'UN GARDIEN S'ADOSSE À QUELQUE CHOSE QUI EXISTE.
 *
 * ## La règle existait ; c'est son APPLICATION qui s'est arrêtée le jour où on
 * l'a écrite
 *
 * Le §9 du CLAUDE.md (31/08) la pose en toutes lettres : *« Une exemption nomme
 * un chemin ; le jour où ce fichier est renommé, déplacé ou scindé, l'entrée
 * survit et ne protège plus rien — silencieusement, une exemption qui ne
 * s'applique à personne ne faisant échouer personne — et le premier fichier qui
 * reprendra ce nom héritera d'une exemption que personne ne lui a accordée.
 * Toute liste d'exemption porte donc le témoin de son adossement. »* La phrase
 * se termine par « Quatre gardiens sur cinq ne le portaient pas ; ils le
 * portent. »
 *
 * **Mesuré le 08/09/2026 : NEUF listes d'exemption existent, et QUATRE ne
 * portent aucun témoin** — `EXEMPTS_PREFIXES` de `sans-decimales-en-dur`,
 * `EXEMPTS` de `sans-litteral-de-parite`, `EXEMPT_MECANISME` de
 * `sans-couleur-en-dur`, `EXEMPTS` de `roles-sans-chaine-libre`. Aucune n'est
 * orpheline aujourd'hui ; ce qui manque est le témoin qui le dira quand elles le
 * deviendront.
 *
 * C'est exactement la première entrée du §9, celle du 20/08, une catégorie plus
 * haut : *une liste close se re-vérifie à chaque table créée, sinon elle devient
 * fausse.* Ici l'objet n'est pas une table mais un GARDIEN — et le remède est le
 * même, le renversement de D41 : **ne pas tenir la liste des gardiens qui
 * doivent porter un témoin, mais partir du dépôt et la déduire.** Un gardien
 * écrit dans six mois entre de lui-même dans la population, et celui-ci réclame
 * son adossement le jour où il apparaît.
 *
 * ## Les DEUX formes d'exemption, et la seconde est celle qu'on oubliait
 *
 * Un **fichier** — le chemin doit désigner un fichier existant. Un **préfixe de
 * répertoire** — le répertoire doit exister ET contenir au moins un fichier
 * source : un répertoire vidé exempte encore, et n'exempte plus rien. Les deux
 * seules exemptions par préfixe du dépôt sont celles qui n'avaient pas de
 * témoin, ce qui n'est pas un hasard : leur forme ressemble moins à une liste.
 *
 * ## Ce que ce gardien NE prétend pas, et qui est écrit plutôt que tu
 *
 * Il lit le TEXTE des scénarios et reconnaît une exemption à son nom
 * (`EXEMPT…`, `EXCEPTION…`, `HORS_…`, `IGNOR…`, `DISPENS…`). Une liste baptisée
 * autrement lui échappe, et une exemption calculée à l'exécution aussi — c'est
 * la forme 6 du §9 (26/08), l'assemblage délibéré, qu'aucun motif statique
 * n'arrête. Il arrête la distraction, pas le contournement.
 */

/** Ce qui, dans un nom de constante, désigne une soustraction au périmètre. */
const NOMS_D_EXEMPTION = /EXEMPT|EXCEPTION|HORS_|IGNOR|DISPENS/;

/** `const NOM = [ … ]` ou `const NOM = "…"`, avec ou sans annotation de type. */
const DECLARATION =
  /const\s+([A-Z][A-Z0-9_]*)\s*(?::[^=]*?)?=\s*(\[[^\]]*\]|"[^"]*")/g;

/** Ce qui ressemble à un chemin du dépôt, et rien d'autre. */
const CHEMIN = /^(app|components|lib|prisma|scripts|tests)\//;

type Exemption = {
  readonly scenario: string;
  readonly liste: string;
  readonly chemin: string;
};

function exemptions(): Exemption[] {
  const trouvees: Exemption[] = [];
  for (const fichier of fichiersSource(["tests"])) {
    if (!fichier.chemin.endsWith(".test.ts")) {
      continue;
    }
    for (const declaration of fichier.contenu.matchAll(DECLARATION)) {
      const [, liste, valeur] = declaration;
      if (liste === undefined || valeur === undefined) {
        continue;
      }
      if (!NOMS_D_EXEMPTION.test(liste)) {
        continue;
      }
      for (const litteral of valeur.matchAll(/"([^"]*)"/g)) {
        const chemin = litteral[1]!;
        if (CHEMIN.test(chemin)) {
          trouvees.push({ scenario: fichier.chemin, liste, chemin });
        }
      }
    }
  }
  return trouvees;
}

const TROUVEES = exemptions();

describe("toute exemption d'un gardien s'adosse à quelque chose qui existe", () => {
  /**
   * LE TÉMOIN DE NON-VACUITÉ, et il est double à dessein.
   *
   * Un décompte nul ressemble toujours à un sans-faute (§9, 30/08) : si le motif
   * cessait de reconnaître une déclaration — une graphie qui change, un
   * `readonly` de plus —, ce gardien passerait au vert **sans avoir rien
   * regardé**, et ce serait la seule chose qu'il rapporterait. Les planchers
   * sont posés sous l'état mesuré du 08/09/2026 — neuf listes, treize chemins —
   * assez bas pour qu'un retrait légitime n'y touche pas.
   */
  it("le gardien a réellement trouvé des exemptions", () => {
    const listes = new Set(TROUVEES.map((e) => `${e.scenario}#${e.liste}`));
    expect(
      listes.size,
      "aucune liste d'exemption reconnue : le motif ne lit plus les " +
        "déclarations, et ce gardien est devenu creux.",
    ).toBeGreaterThanOrEqual(6);
    expect(TROUVEES.length).toBeGreaterThanOrEqual(9);
  });

  it("les deux FORMES d'exemption sont représentées", () => {
    // La forme « préfixe » est celle qu'on oubliait : sans elle dans la
    // population, ce gardien ne garderait que ce qui était déjà gardé.
    const prefixes = TROUVEES.filter((e) => e.chemin.endsWith("/"));
    expect(
      prefixes.length,
      "aucune exemption par préfixe dans la population : or c'est la forme " +
        "qui n'avait pas de témoin, et celle que ce gardien vient couvrir.",
    ).toBeGreaterThanOrEqual(1);
  });

  it.each(TROUVEES.map((e) => [`${e.liste} → ${e.chemin}`, e] as const))(
    "%s",
    (_libelle, exemption) => {
      const { scenario, liste, chemin } = exemption;
      const message =
        `${scenario} : l'exemption « ${liste} » nomme « ${chemin} », qui ` +
        "n'existe plus. Elle ne protège plus rien aujourd'hui, et protégera " +
        "le premier fichier qui reprendra ce nom — silencieusement, une " +
        "exemption qui ne s'applique à personne ne faisant échouer personne.";

      if (chemin.endsWith("/")) {
        const repertoire = chemin.slice(0, -1);
        expect(
          existsSync(repertoire) && statSync(repertoire).isDirectory(),
          message,
        ).toBe(true);
        // Un répertoire VIDÉ exempte encore, et n'exempte plus rien.
        expect(
          fichiersSource([repertoire]).length,
          `${scenario} : « ${chemin} » existe mais ne contient aucun fichier ` +
            "source — l'exemption est vide de sens.",
        ).toBeGreaterThan(0);
      } else {
        expect(existsSync(chemin) && statSync(chemin).isFile(), message).toBe(
          true,
        );
      }
    },
  );
});
