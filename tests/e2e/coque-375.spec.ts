import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { ouvrirUneSession } from "./setup/session";

/**
 * COQUE-375 — LE BACK-OFFICE ET LE PORTAIL TIENNENT SUR UN TÉLÉPHONE.
 *
 * ## Le défaut que ce gardien aurait dû empêcher, et ne l'a pas fait
 *
 * *Mesuré au navigateur sur le site en ligne, à 375 px de large* : la barre
 * latérale (`<aside>`, `components/navigation/barre.tsx`, ligne 143 avant ce
 * correctif) posait `sticky top-0 flex h-dvh w-[272px] shrink-0 flex-col` —
 * une largeur FIXE, AUCUNE classe responsive (`grep -E 'sm:|md:|lg:'` sur ce
 * fichier et sur les deux `layout.tsx` ne rendait rien). Panneau de contenu
 * restant : 375 − 272 = 103 px ; une fois les 40 px de gouttière de
 * `LargeurUtile` (`px-5`) déduits, **63 px de contenu utile** — titres et
 * boutons tronqués, phrases cassées en colonnes d'un mot. **Aucun menu
 * hamburger n'existait dans le DOM** : rien ne permettait de refermer la
 * colonne pour lire l'écran.
 *
 * Le back-office et le portail appellent la MÊME `BarreDeNavigation` — les
 * deux coques portaient le même défaut, et ce fichier les éprouve toutes les
 * deux plutôt qu'une seule.
 *
 * ## Pourquoi le portail se mesure avec le compte de l'épreuve
 *
 * **Aucun compte de portail ne peut ouvrir de session aujourd'hui (D96)** —
 * voir `tests/unit/navigation/barre-du-portail.test.tsx`, qui documente le
 * même contournement pour la même raison. La mise en page du segment
 * (`app/(portail)/layout.tsx`) rend la même colonne et le même bandeau
 * mobile quel que soit le rôle de la session : `/portail` avec le compte
 * interne de l'épreuve affiche l'écran RÉSERVÉ
 * (`app/(portail)/portail/page.tsx`), mais la COQUE — celle que ce ticket
 * corrige — y est identique à celle d'un vrai client. C'est elle qui est
 * mesurée ici, jamais une donnée de client.
 *
 * ## NE CASSE PAS LE TERRAIN
 *
 * `tests/e2e/terrain-largeur.spec.ts` reste le gardien de `/terrain` : sa
 * liste d'entrées est vide (R5-01), `BarreDeNavigation` y rend
 * `BarreHorizontaleVide` — jamais l'aside que ce fichier éprouve — et ce
 * fichier ne touche à aucune de ses assertions.
 */

const FENETRE_TELEPHONE = { width: 375, height: 812 };
const FENETRE_BUREAU = { width: 1280, height: 900 };

/** La gouttière de `LargeurUtile` (`px-5`) — voir `ecrans-largeur-utile.spec.ts`. */
const GOUTTIERE_PX = 20;
const LARGEUR_COLONNE_PX = 272;

const COQUES = [
  { nom: "back-office", chemin: "/planning" },
  { nom: "portail", chemin: "/portail" },
] as const;

for (const { nom, chemin } of COQUES) {
  test.describe(`la coque ${nom}, à 375 px`, () => {
    test.beforeEach(async ({ page }) => {
      await ouvrirUneSession(page);
    });

    test("le contenu occupe la largeur utile, la colonne est hors écran, et un déclencheur existe", async ({
      page,
    }) => {
      await page.setViewportSize(FENETRE_TELEPHONE);
      await page.goto(chemin);

      // Voir `ecrans-largeur-utile.spec.ts` : attendre la révélation du flux
      // avant de mesurer un rectangle, sous peine de mesurer un conteneur
      // caché de largeur nulle.
      await expect(page.locator("main")).toBeVisible();

      const largeur = await page
        .locator("main")
        .evaluate((element) =>
          Math.round(element.getBoundingClientRect().width),
        );
      expect(largeur).toBe(FENETRE_TELEPHONE.width - 2 * GOUTTIERE_PX);

      // LE TÉMOIN QUI AURAIT DÛ ROUGIR : 103 px de panneau restant (63 px de
      // contenu utile une fois la gouttière déduite) était la mesure AVANT ce
      // correctif, avec une colonne de 272 px sur cette même fenêtre.
      expect(largeur).toBeGreaterThan(300);

      // La colonne ne réserve plus rien : hors du flux par défaut.
      await expect(page.locator("#colonne-navigation")).toBeHidden();

      // LE DÉCLENCHEUR — c'est lui que le constat de COQUE-375 relevait
      // absent : « aucun menu hamburger dans le DOM ».
      await expect(
        page.getByRole("button", { name: fr["nav.ouvrir_le_menu"] }),
      ).toBeVisible();
    });

    test("le déclencheur ouvre la colonne par-dessus un voile, et le voile la referme", async ({
      page,
    }) => {
      await page.setViewportSize(FENETRE_TELEPHONE);
      await page.goto(chemin);

      const declencheur = page.getByRole("button", {
        name: fr["nav.ouvrir_le_menu"],
      });
      await declencheur.click();

      const colonne = page.locator("#colonne-navigation");
      await expect(colonne).toBeVisible();
      const boite = await colonne.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { x: Math.round(rect.x), largeur: Math.round(rect.width) };
      });
      expect(boite).toEqual({ x: 0, largeur: LARGEUR_COLONNE_PX });

      // Le voile — arbitrage du directeur d'exploitation : « l'aside sort de
      // l'écran, un état ouvert le fait revenir par-dessus un voile ». Le
      // clic vise un point HORS de la colonne (272 px de large) pour ne pas
      // heurter un lien qu'elle porte.
      const voile = page.locator('[data-bloc="voile-navigation"]');
      await expect(voile).toBeVisible();
      await voile.click({ position: { x: 350, y: 400 } });
      await expect(colonne).toBeHidden();
    });

    test("à 1280 px, le bureau n'a pas bougé : la colonne reste en place, sans déclencheur", async ({
      page,
    }) => {
      await page.setViewportSize(FENETRE_BUREAU);
      await page.goto(chemin);

      await expect(page.locator("main")).toBeVisible();

      const colonne = page.locator("#colonne-navigation");
      await expect(colonne).toBeVisible();
      const largeurColonne = await colonne.evaluate((element) =>
        Math.round(element.getBoundingClientRect().width),
      );
      expect(largeurColonne).toBe(LARGEUR_COLONNE_PX);

      // Le contenu occupe ce que la colonne lui laisse, moins la gouttière —
      // la même formule qu'avant ce ticket : rien n'a bougé au bureau.
      const largeurContenu = await page
        .locator("main")
        .evaluate((element) =>
          Math.round(element.getBoundingClientRect().width),
        );
      expect(largeurContenu).toBe(
        FENETRE_BUREAU.width - LARGEUR_COLONNE_PX - 2 * GOUTTIERE_PX,
      );

      await expect(
        page.getByRole("button", { name: fr["nav.ouvrir_le_menu"] }),
      ).toBeHidden();
    });
  });
}
