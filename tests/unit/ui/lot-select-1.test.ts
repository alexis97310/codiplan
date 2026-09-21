import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  tousLesResultats,
  type OptionClient,
} from "@/components/parc/formulaire-machine";
import { LIMITE_RECHERCHE_MAXIMALE as LIMITE_CLIENTS } from "@/lib/clients/saisie";
import { LIMITE_RECHERCHE_MAXIMALE as LIMITE_SITES } from "@/lib/sites/saisie";

/**
 * LE GARDIEN DU LOT SELECT-1 (21/09/2026) — les sélecteurs de client et de
 * site de `/parc/nouvelle` ne montrent pas tout le référentiel.
 *
 * ## LE FAIT MESURÉ, AVANT TOUTE CORRECTION
 *
 * Contre une base PostgreSQL locale — le proxy de ce bac à sable bloque la
 * base hébergée, la mesure locale sur le même commit fait foi (§9) — une
 * société de démonstration portée à l'échelle réelle compte **576 clients**
 * et **246 sites actifs**. `rechercherClients`/`rechercherSites`
 * (`lib/clients/depot.ts`, `lib/sites/depot.ts`) étaient appelées UNE fois,
 * avec `limite: LIMITE_RECHERCHE_MAXIMALE` (200) et `page: 1` : le sélecteur
 * de `/parc/nouvelle` en montrait 200, les 376 clients et 46 sites suivants
 * disparaissaient sans le moindre message. Capturé en écran, avant et après,
 * dans `docs/propositions/lot-select-1/`.
 *
 * ## CE QUE CE FICHIER MESURE
 *
 * 1. `tousLesResultats` (`components/parc/formulaire-machine.tsx`) — la
 *    fonction RÉELLE, importée telle quelle, jamais une réimplémentation —
 *    enchaîne les pages d'une recherche bornée jusqu'à épuisement, sur le
 *    compte EXACT mesuré ci-dessus (576, 246) et sur des cas limites autour
 *    de la borne.
 * 2. Le paragraphe 3 REJOUE LA FAUTE : un appel unique borné à
 *    `LIMITE_RECHERCHE_MAXIMALE` — exactement ce que `/parc/nouvelle`
 *    faisait avant ce lot — masque une partie du référentiel mesuré ; ce même
 *    test, changé pour lire `tousLesResultats` à la place d'un appel unique,
 *    est celui qui a d'abord ROUGI avant la correction.
 * 3. Preuve STATIQUE, faute de pouvoir faire tourner `/parc/nouvelle`
 *    elle-même sous ce projet Vitest (elle exige une session, une base, un
 *    rendu React Server Component — voir `tests/unit/ui/lot-parc.test.ts`,
 *    même limite déjà mesurée) : le SOURCE réel de la page appelle
 *    `tousLesResultats` pour les DEUX listes, et son commentaire ne justifie
 *    plus le plafond par une volumétrie fausse.
 */

const RACINE = process.cwd();

function reel(chemin: string): string {
  return readFileSync(join(RACINE, chemin), "utf8");
}

/** Un « dépôt » simulé — même forme que `rechercherClients`/`rechercherSites` : une page bornée, 1-indexée. */
function depotSimule<T>(total: readonly T[], tailleDePage: number) {
  return async (page: number): Promise<readonly T[]> => {
    const debut = (page - 1) * tailleDePage;
    return total.slice(debut, debut + tailleDePage);
  };
}

function clientsSynthetiques(n: number): OptionClient[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `client-${i + 1}`,
    raisonSociale: `Client synthétique n°${i + 1}`,
  }));
}

describe("tousLesResultats — un sélecteur ne masque aucune fiche existante", () => {
  it("rend les 576 clients mesurés localement, au-delà de LIMITE_RECHERCHE_MAXIMALE (200)", async () => {
    const total = clientsSynthetiques(576);
    const rendu = await tousLesResultats(
      depotSimule(total, LIMITE_CLIENTS),
      LIMITE_CLIENTS,
    );
    expect(rendu).toHaveLength(576);
    expect(rendu.map((c) => c.id)).toEqual(total.map((c) => c.id));
  });

  it("rend les 246 sites mesurés localement, au-delà de LIMITE_RECHERCHE_MAXIMALE (200)", async () => {
    const total = Array.from({ length: 246 }, (_, i) => ({
      id: `site-${i + 1}`,
    }));
    const rendu = await tousLesResultats(
      depotSimule(total, LIMITE_SITES),
      LIMITE_SITES,
    );
    expect(rendu).toHaveLength(246);
  });

  it.each([
    ["un seul lot, plus court que la page", LIMITE_CLIENTS - 1],
    ["exactement une page pleine", LIMITE_CLIENTS],
    ["une page pleine plus une fiche", LIMITE_CLIENTS + 1],
    ["trois pages pleines", LIMITE_CLIENTS * 3],
    ["trois pages plus un reste", LIMITE_CLIENTS * 3 + 7],
  ])("n'en perd aucune — %s (n=%i)", async (_libelle, n) => {
    const total = clientsSynthetiques(n);
    const rendu = await tousLesResultats(
      depotSimule(total, LIMITE_CLIENTS),
      LIMITE_CLIENTS,
    );
    expect(rendu).toHaveLength(n);
  });

  it("rend un référentiel vide sans boucler (aucun client actif)", async () => {
    const rendu = await tousLesResultats(
      depotSimule([], LIMITE_CLIENTS),
      LIMITE_CLIENTS,
    );
    expect(rendu).toEqual([]);
  });

  it("interroge le NOMBRE MINIMAL de pages — jamais une page vide de plus après le dernier lot partiel", async () => {
    const total = clientsSynthetiques(LIMITE_CLIENTS * 2 + 3);
    let appels = 0;
    const page = async (numero: number) => {
      appels += 1;
      const debut = (numero - 1) * LIMITE_CLIENTS;
      return total.slice(debut, debut + LIMITE_CLIENTS);
    };
    await tousLesResultats(page, LIMITE_CLIENTS);
    // 2 pages pleines (400) + 1 page partielle (3) = 3 appels ; jamais un
    // quatrième pour confirmer qu'il n'y a plus rien : un lot plus court que
    // la page EST déjà la preuve d'épuisement.
    expect(appels).toBe(3);
  });
});

describe("LA FAUTE REJOUÉE — un appel unique borné masque le référentiel mesuré", () => {
  // Exactement ce que `/parc/nouvelle` appelait avant ce lot :
  // `rechercherClients(contexte, { ..., limite: LIMITE_CLIENTS, page: 1 })`,
  // une seule fois. Rejoué ici sur le compte RÉEL mesuré localement (576) pour
  // que ce test rougisse la première fois qu'on le regarde — avant d'ajouter
  // la ligne suivante, qui le fait passer.
  it("un appel unique ne rend que 200 clients sur 576 — la panne mesurée", async () => {
    const total = clientsSynthetiques(576);
    const uneSeulePage = await depotSimule(total, LIMITE_CLIENTS)(1);
    expect(uneSeulePage).toHaveLength(LIMITE_CLIENTS);
    expect(uneSeulePage.length).toBeLessThan(total.length);
  });

  it("`tousLesResultats`, sur la MÊME source, répare exactement cette perte", async () => {
    const total = clientsSynthetiques(576);
    const source = depotSimule(total, LIMITE_CLIENTS);
    const uneSeulePage = await source(1);
    const referentielComplet = await tousLesResultats(source, LIMITE_CLIENTS);
    expect(uneSeulePage.length).toBe(200);
    expect(referentielComplet.length).toBe(576);
    expect(referentielComplet.length).toBeGreaterThan(uneSeulePage.length);
  });
});

describe("la page réelle appelle `tousLesResultats` pour les DEUX listes, et son commentaire ne ment plus", () => {
  const PAGE = reel("app/(back-office)/parc/nouvelle/page.tsx");
  const FORMULAIRE = reel("components/parc/formulaire-machine.tsx");

  it("`tousLesResultats` est défini et exporté par le formulaire, pas par la page (contrat de route Next.js)", () => {
    expect(FORMULAIRE).toContain("export async function tousLesResultats");
    expect(PAGE).not.toContain("async function tousLesResultats");
  });

  it("le client ET le site passent par `tousLesResultats` — aucun appel direct résiduel à `limite`/`page: 1`", () => {
    const appelsBouclés = PAGE.match(/tousLesResultats\(\s*\(page\) =>/g);
    expect(appelsBouclés?.length ?? 0).toBe(2);
    // La forme fautive : un seul appel, borné, sans boucle.
    expect(PAGE).not.toMatch(/limite:\s*LIMITE_CLIENTS,\s*\n\s*page:\s*1,/);
    expect(PAGE).not.toMatch(/limite:\s*LIMITE_SITES,\s*\n\s*page:\s*1,/);
  });

  it("le commentaire ne justifie plus le plafond par la volumétrie du chapitre 11.3", () => {
    // La phrase fausse d'avant ce lot : citée une fois, entre guillemets, pour
    // dire qu'elle est fausse — jamais affirmée comme la raison du plafond.
    expect(PAGE).not.toMatch(
      /tient sous les plafonds existants|PLAFONNÉES, jamais paginées/,
    );
    expect(PAGE).toContain("576");
  });

  it("`LIMITE_RECHERCHE_MAXIMALE` reste le garde-fou PAR REQUÊTE — la borne n'est pas simplement relevée", () => {
    // La réparation n'est pas « augmenter 200 » : un plafond plus haut reste
    // un plafond. Les deux constantes restent à 200, c'est la BOUCLE qui
    // change, jamais le nombre.
    expect(reel("lib/clients/saisie.ts")).toContain(
      "export const LIMITE_RECHERCHE_MAXIMALE = 200;",
    );
    expect(reel("lib/sites/saisie.ts")).toContain(
      "export const LIMITE_RECHERCHE_MAXIMALE = 200;",
    );
  });
});
