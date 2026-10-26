import { afterEach, describe, expect, it } from "vitest";

import {
  lundiDeLaSceneMemorise,
  VARIABLE_LUNDI_SCENE,
} from "../e2e/setup/scene";

/**
 * GARDIEN DE LA COURSE DE MINUIT (9G4D-EPREUVE-TRANSMETTRE-ET-MINUIT).
 *
 * Mesuré par 9G4A1-REPRISE-9G4C : `ecrireLaScene` (préparation globale) et
 * `reperesDeLaScene` (`beforeAll` de chaque fichier) recalculaient chacun
 * « aujourd'hui » à l'instant où ILS tournaient — deux instants distincts
 * d'une suite qui dépasse l'heure. Si minuit s'intercale entre les deux et
 * fait franchir MARDI, les deux processus divergent d'une semaine entière.
 *
 * `reperesDeLaScene` ne recalcule plus : il relit `lundi` posé UNE FOIS par
 * `ecrireLaScene` dans `process.env` (même mécanisme que `VARIABLE_CLES_ACTIVEES`,
 * `session.ts` — un `process.env` posé par le processus parent AVANT que
 * Playwright ne distribue un fichier à un worker est hérité par CHAQUE
 * worker). Ce gardien éprouve ce roundtrip, sans base ni horloge à simuler :
 * poser une valeur DANS `process.env` et la relire DOIT rendre exactement la
 * même valeur, quel que soit l'instant de la relecture.
 */
describe("lundiDeLaSceneMemorise", () => {
  afterEach(() => {
    delete process.env[VARIABLE_LUNDI_SCENE];
  });

  it("rend `undefined` quand aucune scène n'a encore tourné", () => {
    delete process.env[VARIABLE_LUNDI_SCENE];
    expect(lundiDeLaSceneMemorise()).toBeUndefined();
  });

  it("relit EXACTEMENT le lundi posé, quel que soit l'instant de la relecture", () => {
    const lundi = { annee: 2027, mois: 3, jour: 22 };
    process.env[VARIABLE_LUNDI_SCENE] = JSON.stringify(lundi);

    // Deux relectures, comme deux fichiers de scénario qui démarrent à des
    // instants différents : la course de minuit venait d'un RECALCUL entre
    // ces deux instants, jamais d'une simple relecture.
    expect(lundiDeLaSceneMemorise()).toEqual(lundi);
    expect(lundiDeLaSceneMemorise()).toEqual(lundi);
  });

  it("relit le lundi posé même après minuit (franchissement de MARDI simulé)", () => {
    // `ecrireLaScene` a tourné à 23:58, un jour où MARDI (lundi+1) restait
    // strictement futur : elle pose CE lundi-ci. Un fichier de scénario dont
    // le `beforeAll` démarre à 00:02, une fois MARDI devenu aujourd'hui, ne
    // doit PLUS recalculer un lundi avancé d'une semaine : il relit celui-ci,
    // tel quel.
    const lundiAvantMinuit = { annee: 2026, mois: 11, jour: 2 };
    process.env[VARIABLE_LUNDI_SCENE] = JSON.stringify(lundiAvantMinuit);

    expect(lundiDeLaSceneMemorise()).toEqual(lundiAvantMinuit);
  });
});
