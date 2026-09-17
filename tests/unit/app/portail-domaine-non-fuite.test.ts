import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * LE PORTAIL NE FUIT JAMAIS UN DOMAINE DU BACK-OFFICE (N-08, 17/09/2026).
 *
 * ## Ce qui a été mesuré, À L'ÉCRAN plutôt qu'en test — et c'est le défaut
 *
 * Capturé pendant les copies d'écran exigées par le ticket : `/portail`
 * affichait le surtitre **« CLIENTS & PARC »** — un domaine du BACK-OFFICE —
 * au-dessus de l'écran d'un CLIENT. La cause : `<Page chemin="/portail">`
 * sans `entrees` retombe sur `ENTREES` (la barre interne), qui porte bien une
 * entrée `/portail` (« Portail client », le LIEN interne vers cet écran, sous
 * « Clients & parc ») — `groupeDe` la trouve et répond, à tort.
 *
 * *Un client qui lit un domaine du back-office apprend l'existence d'un
 * découpage qui n'est pas le sien* — la même faute que D97 nomme pour un
 * libellé de menu, ici sur un surtitre plutôt qu'une entrée de barre.
 *
 * ## Pourquoi un gardien de SOURCE, et non seulement de `groupeDe`
 *
 * `tests/unit/navigation/entrees.test.ts` prouve déjà que `groupeDe` retombe
 * sur le mauvais domaine SANS `entrees` explicite. Ce que ce test-ci garde en
 * plus : que l'ÉCRAN LUI-MÊME passe bien `entrees={ENTREES_PORTAIL}` — la
 * fonction peut être juste et l'appel l'oublier quand même, exactement ce qui
 * s'est produit.
 */

const PORTAIL = readFileSync(
  join(process.cwd(), "app/(portail)/portail/page.tsx"),
  "utf8",
);

describe("app/(portail)/portail/page.tsx passe ENTREES_PORTAIL à chaque <Page>", () => {
  it("a réellement lu le fichier — le témoin de non-vacuité", () => {
    expect(PORTAIL.length).toBeGreaterThan(0);
  });

  it("importe ENTREES_PORTAIL", () => {
    expect(PORTAIL).toContain(
      'import { ENTREES_PORTAIL } from "@/lib/navigation/entrees"',
    );
  });

  it("CHAQUE `<Page` de ce fichier porte `entrees={ENTREES_PORTAIL}` — les deux branches (réservé et parc)", () => {
    const appelsDePage = PORTAIL.split("<Page").length - 1;
    const appelsAvecEntreesPortail =
      PORTAIL.split("entrees={ENTREES_PORTAIL}").length - 1;
    expect(appelsDePage).toBeGreaterThan(0);
    expect(appelsAvecEntreesPortail).toBe(appelsDePage);
  });
});
