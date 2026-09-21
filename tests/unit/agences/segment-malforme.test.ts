import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * UN SEGMENT D'URL MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE (AGENCE-1,
 * DÉFAUT 2 — revue Codex de #275).
 *
 * ## Le défaut mesuré
 *
 * `/parametres/agences/pas-un-uuid/modifier` transmettait `id` tel quel à
 * `lireAgence`, qui l'envoie dans un `WHERE "id" = $1::uuid` : PostgreSQL
 * refuse de caster « pas-un-uuid » et lève, et rien ne rattrapait ce refus —
 * 500 au lieu d'un `notFound()`. **La même faute exacte** a déjà coûté un 500
 * mesuré le 11/09/2026 sur `/api/sites/nouveau/modifier`, et la route POST de
 * ce module (`app/api/parametres/agences/[id]/modifier/route.ts`) s'en
 * protège déjà avec `z.uuid().safeParse(id)`. La PAGE ne le faisait pas.
 *
 * ## Pourquoi ce gardien lit le SOURCE plutôt que de RENDRE la page
 *
 * Reproduire le 500 pour de vrai demande une base PostgreSQL réelle — ce
 * qu'aucun outil de ce bac à sable ne joint (`pg_isready`, `docker info` : ni
 * l'un ni l'autre ne répond ; voir la proposition #275). `PageModifierAgence`
 * est un composant serveur asynchrone : l'éprouver en le RENDANT exigerait une
 * session, un contexte cloisonné et une base — exactement ce que ce bac à
 * sable refuse. Ce gardien éprouve donc la PROPRIÉTÉ statique qui empêche le
 * défaut : le contrôle de forme doit exister, et il doit précéder l'appel à
 * `lireAgence`, textuellement — la même discipline que
 * `tests/unit/gardiens/frontiere-serveur-client.test.ts` applique à une autre
 * frontière.
 *
 * `tests/e2e/tous-les-ecrans-rendent.spec.ts` ne peut PAS remplacer ce
 * gardien : il ouvre chaque écran avec un identifiant RÉEL, tiré du semis
 * (voir son en-tête) — jamais un identifiant malformé. Il ne peut donc pas
 * voir ce défaut, dans un sens comme dans l'autre.
 */

const CHEMIN_PAGE = join(
  process.cwd(),
  "app",
  "(back-office)",
  "parametres",
  "agences",
  "[id]",
  "modifier",
  "page.tsx",
);

function source(): string {
  return readFileSync(CHEMIN_PAGE, "utf8");
}

describe("la fiche de modification refuse un identifiant mal formé AVANT de lire l'agence", () => {
  it("TÉMOIN — le fichier existe et appelle bien `lireAgence`", () => {
    const contenu = source();
    expect(contenu).toContain("lireAgence(");
  });

  it("un contrôle de forme UUID précède l'appel à `lireAgence`", () => {
    const contenu = source();
    const indexControle = contenu.search(/z\.uuid\(\)\.safeParse\(\s*id\s*\)/);
    const indexLecture = contenu.indexOf("lireAgence(");

    expect(
      indexControle,
      "aucun contrôle `z.uuid().safeParse(id)` trouvé dans " +
        "app/(back-office)/parametres/agences/[id]/modifier/page.tsx : un " +
        "identifiant mal formé (« /parametres/agences/pas-un-uuid/modifier ») " +
        "atteindrait `lireAgence` tel quel et PostgreSQL lèverait au lieu de " +
        "rendre un `notFound()`.",
    ).toBeGreaterThan(-1);
    expect(
      indexControle < indexLecture,
      "le contrôle de forme existe mais suit `lireAgence` au lieu de le " +
        "précéder : un identifiant mal formé atteindrait la lecture avant " +
        "d'être refusé.",
    ).toBe(true);
  });

  it("le contrôle refusé mène à `notFound()`, jamais à une autre issue", () => {
    const contenu = source();
    const indexControle = contenu.search(/z\.uuid\(\)\.safeParse\(\s*id\s*\)/);
    if (indexControle === -1) {
      // Le test précédent porte déjà ce refus — inutile de le répéter en double.
      return;
    }
    const apresControle = contenu.slice(indexControle, indexControle + 200);
    expect(apresControle).toContain("notFound()");
  });
});
