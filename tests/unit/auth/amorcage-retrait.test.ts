import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fichiersSource, RACINE } from "../outils/fichiers-source";
import { join } from "node:path";

/**
 * LA CONDITION DE RETRAIT DU GESTE D'AMORÇAGE (Q1 / D65).
 *
 * ## Ce que ce gardien tient, et pourquoi il vaut mieux qu'une intention
 *
 * Le geste d'amorçage est une **exception**, admise parce qu'aucun chemin
 * n'ouvre de compte aujourd'hui. *Le jour où le chemin administratif d'ouverture
 * de compte existe, ce geste disparaît.* Écrit ainsi, ce serait une intention —
 * et une intention non vérifiée est ce que le §9 (30/08) appelle une garantie
 * qu'on ne peut pas constater.
 *
 * **Le critère est OBSERVABLE en une commande, et c'est ce qui le rend gardable :
 * un appel à `signUpEmail` hors du geste, hors du script et hors des tests.**
 * C'est exactement la signature du chemin administratif : il ouvrira des
 * identités, donc il appellera cette fonction. Le jour où il existe, ce gardien
 * réclame le retrait de l'amorçage — et personne n'a à s'en souvenir.
 *
 * ## Le piège de la population, regardé avant d'y tomber
 *
 * La façon naturelle d'écrire ce gardien — « pour chaque fichier d'amorçage,
 * vérifier qu'il n'y a pas d'autre appel » — **sélectionne sur ce qu'elle doit
 * faire respecter** (§9, 31/08). La population part donc de **tout le dépôt**,
 * et l'appartenance au geste est une ASSERTION, jamais un critère de sélection.
 *
 * ## La coupure documentation / exécution, et pourquoi elle est légitime ICI
 *
 * `lib/auth/inscription-fermee.ts` NOMME `auth.api.signUpEmail` en prose, pour
 * dire ce que la surface HTTP ne fait pas. Le §9 (26/08) admet une seule
 * coupure — « documentation contre exécution » — et c'est celle-ci : une phrase
 * dans un commentaire n'ouvre aucun compte. La différence avec le gardien de I3,
 * qui refuse d'élaguer les commentaires, est que là `decimales: 2` est la FORME
 * de la faute et devient du code par copier-coller ; ici, la faute est un
 * APPEL, et un appel ne se copie pas depuis une phrase.
 *
 * ## Sa limite, annoncée
 *
 * Un chemin administratif qui ouvrirait des identités **sans passer par
 * `signUpEmail`** — en écrivant `utilisateur` et `compte` à la main — lui
 * échapperait. C'est la forme 6 du §9 (26/08) : un gardien statique arrête la
 * distraction, pas le contournement décidé.
 */

/** Le geste, et le script qui l'appelle. Leur retrait est ce qui est exigé. */
const FICHIERS_DU_GESTE = [
  "lib/auth/amorcage.ts",
  "scripts/amorcage-premier-compte.mts",
] as const;

/**
 * Ce qui a le droit de NOMMER `signUpEmail`.
 *
 * Liste close, adossée : `tests/unit/gardiens/exemptions-adossees.test.ts`
 * refuse une entrée qui ne désignerait plus rien.
 */
const EXEMPTS_FICHIERS = [
  "lib/auth/amorcage.ts",
  "tests/unit/auth/amorcage-retrait.test.ts",
] as const;

/** Retire ce qu'un humain lit et qu'aucune machine n'exécute. */
function sansDocumentation(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

type Appel = { readonly chemin: string; readonly ligne: number };

function appels(): Appel[] {
  const trouves: Appel[] = [];
  // La population est TOUT le code exécutable du dépôt, `tests/` excepté —
  // un scénario qui appelle `signUpEmail` n'est pas un chemin d'ouverture de
  // compte. L'appartenance au geste est une ASSERTION plus bas, jamais un
  // critère de sélection ici.
  for (const fichier of fichiersSource([
    "app",
    "components",
    "lib",
    "prisma",
    "scripts",
  ])) {
    const lignes = sansDocumentation(fichier.contenu).split("\n");
    lignes.forEach((ligne, rang) => {
      if (/signUpEmail\s*\(/.test(ligne)) {
        trouves.push({ chemin: fichier.chemin, ligne: rang + 1 });
      }
    });
  }
  return trouves;
}

const APPELS = appels();

describe("le geste d'amorçage disparaît quand la porte principale s'ouvre", () => {
  it("TÉMOIN — le motif voit l'appel du geste lui-même", () => {
    // Sans ce témoin, un motif devenu aveugle rendrait une liste vide et ce
    // gardien passerait au vert sans avoir rien regardé (§9, 30/08).
    expect(
      APPELS.map((appel) => appel.chemin),
      "le motif ne reconnaît plus aucun appel à signUpEmail, pas même celui " +
        "du geste d'amorçage : il ne garde plus rien.",
    ).toContain("lib/auth/amorcage.ts");
  });

  it("aucun appel hors du geste — ou alors le geste doit être RETIRÉ", () => {
    const horsGeste = APPELS.filter(
      (appel) => !EXEMPTS_FICHIERS.includes(appel.chemin as never),
    );
    if (horsGeste.length === 0) {
      return;
    }
    const survivants = FICHIERS_DU_GESTE.filter((chemin) =>
      existsSync(join(RACINE, chemin)),
    );
    expect(
      survivants,
      "Un chemin d'ouverture de compte existe désormais :\n" +
        horsGeste.map((a) => `  ${a.chemin}:${a.ligne}`).join("\n") +
        "\nLe geste d'amorçage était une exception admise en son absence : il " +
        "doit être retiré, avec sa branche de politique (Q1 / D65) et ses " +
        "scénarios. Voir lib/auth/amorcage.ts.",
    ).toEqual([]);
  });

  it("tant que le geste existe, la branche de politique existe aussi", () => {
    // Les deux moitiés vont ensemble : un geste sans branche ne peut rien
    // ouvrir, une branche sans geste est une ouverture que plus personne
    // n'utilise. Le sens SILENCIEUX est le second.
    const gesteExiste = existsSync(join(RACINE, "lib/auth/amorcage.ts"));
    const migration = fichiersSource(["prisma"], [".sql"]).some((fichier) =>
      fichier.contenu.includes("app_societe_active_vierge"),
    );
    expect(migration).toBe(gesteExiste);
  });
});
