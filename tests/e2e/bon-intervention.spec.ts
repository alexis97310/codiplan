import { expect, test } from "@playwright/test";

import {
  aucuneMachineSurLeSite,
  segmentsSurSiteTitre,
} from "@/app/(back-office)/interventions/presentation";
import { fr } from "@/lib/i18n";

import { SCENE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE BON D'INTERVENTION IMPRIMABLE (lot 16, BON-1) — LA ROUTE EXISTE ET
 * RENDU PORTE SES BLOCS.
 *
 * ## Ce que ce fichier prouve, et que l'isolation ne peut pas prouver
 *
 * `tests/isolation/bon-intervention.test.ts` éprouve que `lireBonIntervention`
 * assemble les bonnes données. Il ne peut pas prouver qu'un ÉCRAN les affiche
 * — c'était exactement le défaut nommé par le constat du ticket : *aucun
 * document d'intervention n'existe, ni impression, ni vue dédiée.* Cette
 * page était introuvable avant ce lot ; ce fichier mesure qu'elle existe et
 * qu'elle porte ses blocs, sur `SCENE.obstacle` — une intervention qui porte
 * déjà un compteur fermé et un taux en vigueur (voir `tests/e2e/setup/scene.ts`).
 */
test("la page du bon s'affiche et porte ses blocs", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${SCENE.obstacle}/bon`);

  await expect(
    page.getByRole("heading", { name: segmentsSurSiteTitre() }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: fr["intervention.bon.valorisation_titre"],
    }),
  ).toBeVisible();

  // LA MACHINE — `obstacle` n'en porte aucune : l'absence est NOMMÉE, jamais
  // un bloc muet (RG-INT-01).
  await expect(page.getByText(aucuneMachineSurLeSite())).toBeVisible();

  // LE COMPTEUR A TOURNÉ (scène : un segment fermé de 120 minutes) : la
  // section ne dit donc PAS « aucun segment ».
  await expect(
    page.getByText(fr["intervention.bon.aucun_segment"]),
  ).toHaveCount(0);

  // LE TAUX EST EN VIGUEUR (scène : un taux depuis 2020) et le rôle du
  // semis (`ouvrirUneSession`) voit les montants de vente : ni le motif de
  // rôle, ni celui du taux absent ne s'affichent.
  await expect(page.getByText(fr["intervention.bon.taux_absent"])).toHaveCount(
    0,
  );
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.cloture.taux"], { exact: true }),
  ).toBeVisible();

  // LE GESTE D'IMPRESSION.
  await expect(page.locator('[data-bloc="bon-imprimer"]')).toBeVisible();

  // LES BLOCS DU LOT 17 SONT NOMMÉS, JAMAIS AFFICHÉS VIDES.
  await expect(page.getByText(fr["intervention.bon.a_venir"])).toBeVisible();
});
