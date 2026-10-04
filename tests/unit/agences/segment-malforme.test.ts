import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * UN SEGMENT D'URL MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE (AGENCE-1,
 * DÉFAUT 2 — revue Codex de #275).
 *
 * ## Le défaut mesuré
 *
 * `/parametres/agences/pas-un-uuid` transmettait `id` tel quel à
 * `lireAgence`, qui l'envoie dans un `WHERE "id" = $1::uuid` : PostgreSQL
 * refuse de caster « pas-un-uuid » et lève, et rien ne rattrapait ce refus —
 * 500 au lieu d'un `notFound()`. **La même faute exacte** a déjà coûté un 500
 * mesuré le 11/09/2026 sur `/api/sites/nouveau/modifier`, et la route POST de
 * ce module (`app/api/parametres/agences/[id]/modifier/route.ts`) s'en
 * protège déjà avec `z.uuid().safeParse(id)`. La PAGE ne le faisait pas.
 *
 * **Déplacée de `[id]/modifier/page.tsx` vers `[agenceId]/page.tsx`** par
 * PA-29 (QT-21, D167, 05/10/2026, TP-NAV1) — l'agence a désormais sa propre
 * adresse, et le paramètre se nomme `agenceId` plutôt que `id` : ce gardien
 * suit la nouvelle forme, exactement comme le défaut qu'il tient.
 *
 * ## Pourquoi ce gardien lit le SOURCE plutôt que de RENDRE la page
 *
 * Reproduire le 500 pour de vrai demande une base PostgreSQL réelle — ce
 * qu'aucun outil de ce bac à sable ne joint (`pg_isready`, `docker info` : ni
 * l'un ni l'autre ne répond ; voir la proposition #275). `PageAgence`
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
  "[agenceId]",
  "page.tsx",
);

function source(): string {
  return readFileSync(CHEMIN_PAGE, "utf8");
}

/**
 * LE CORPS DU RENDU, SEUL — depuis que `generateMetadata` (TP-NAV1, QT-21,
 * D167) porte SON PROPRE contrôle de forme, borné à SON propre usage de
 * `lireAgence` (il retombe sur un titre générique, jamais sur `notFound()` —
 * la même convention que `app/(back-office)/parametres/agences/calendrier/
 * [id]/page.tsx`). Le défaut que ce gardien tient — un 500 au lieu d'un
 * `notFound()` — se joue au RENDU, pas à la métadonnée d'onglet ; chercher
 * sur le fichier entier apparierait le contrôle de la métadonnée au
 * `notFound()` du rendu, deux paires qui n'ont rien à voir l'une avec
 * l'autre.
 */
function corpsDuRendu(contenu: string): string {
  const depart = contenu.indexOf("export default async function");
  expect(depart, "aucune fonction exportée par défaut").toBeGreaterThan(-1);
  return contenu.slice(depart);
}

describe("la fiche d'une agence refuse un identifiant mal formé AVANT de lire l'agence", () => {
  it("TÉMOIN — le fichier existe et appelle bien `lireAgence`", () => {
    const contenu = source();
    expect(contenu).toContain("lireAgence(");
  });

  it("un contrôle de forme UUID précède l'appel à `lireAgence`, dans le rendu", () => {
    const corps = corpsDuRendu(source());
    const indexControle = corps.search(
      /z\.uuid\(\)\.safeParse\(\s*agenceId\s*\)/,
    );
    const indexLecture = corps.indexOf("lireAgence(");

    expect(
      indexControle,
      "aucun contrôle `z.uuid().safeParse(agenceId)` trouvé dans le rendu de " +
        "app/(back-office)/parametres/agences/[agenceId]/page.tsx : un " +
        "identifiant mal formé (« /parametres/agences/pas-un-uuid ») " +
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
    const corps = corpsDuRendu(source());
    const indexControle = corps.search(
      /z\.uuid\(\)\.safeParse\(\s*agenceId\s*\)/,
    );
    if (indexControle === -1) {
      // Le test précédent porte déjà ce refus — inutile de le répéter en double.
      return;
    }
    const apresControle = corps.slice(indexControle, indexControle + 200);
    expect(apresControle).toContain("notFound()");
  });
});
