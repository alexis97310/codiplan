import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import {
  aucuneMachineSurLeSite,
  segmentsSurSiteTitre,
} from "@/app/(back-office)/interventions/presentation";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
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
 * qu'elle porte ses blocs.
 *
 * ## SA PROPRE FIXTURE, ET POURQUOI (AFFICHAGE-MATERIEL-1, 23/09/2026)
 *
 * Elle visait `SCENE.obstacle` — une intervention `planifiee` (`scene.ts`).
 * Depuis que le bon n'existe plus que pour `terminee`/`cloturee`
 * (`peutGenererLeBon`, `lib/interventions/cycle-de-vie.ts`), la partager
 * aurait exigé de faire avancer le statut d'une fixture que DIX AUTRES
 * fichiers lisent ou déplacent concurremment (`glisser-deposer.spec.ts`,
 * `terrain.spec.ts`, `montants-par-role.spec.ts`…) — le risque exact que
 * `tests/e2e/setup/scene.ts` existe pour éviter. Ce fichier pose donc SA
 * PROPRE ligne, à un identifiant fixe, avec le même compteur fermé de 120
 * minutes et le même taux en vigueur que `scene.ts` donne à `obstacle`.
 *
 * ## SÉRIE — `beforeAll` détruit puis recrée sa fixture (STABILITE-2, 25/09/2026)
 *
 * Le même geste que `scene.ts` sur un identifiant fixe : sous
 * `fullyParallel` sans `test.describe.configure`, `beforeAll` tourne une
 * fois PAR WORKER, et deux `deleteMany`/insertions concurrentes sur la même
 * ligne se font la course (`Unique constraint failed on the fields: (id)`
 * — même défaut que `porte-capacites.spec.ts`, mesuré le même jour).
 */
test.describe.configure({ mode: "serial" });

const FICHE_BON_TERMINEE = "01a0f200-0000-7000-8000-000000000001";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence_id: ducos.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      FICHE_BON_TERMINEE,
    );
    await client.intervention.deleteMany({ where: { id: FICHE_BON_TERMINEE } });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "technicien_id", "type", "priorite", "statut", "date_planifiee",
         "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p3', 'terminee'::"StatutIntervention", now()::date,
               'temps_passe', 'XPF', now())`,
      FICHE_BON_TERMINEE,
      reperes.societeId,
      ducos.id,
      site.client_id,
      site.id,
      reperes.technicienDucos,
    );
    // LE SEGMENT D'ABORD, LA SOMME ENSUITE — le déclencheur
    // `intervention_temps_mesure_est_celui_du_compteur` vérifie que
    // `temps_mesure_min` est la somme des segments FERMÉS déjà présents ;
    // l'écrire avant qu'aucun segment n'existe le refuserait (même ordre que
    // `scene.ts`).
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now() - interval '120 minutes', now(), now())`,
      reperes.societeId,
      FICHE_BON_TERMINEE,
      reperes.technicienDucos,
    );
    await client.intervention.update({
      where: { id: FICHE_BON_TERMINEE },
      data: { temps_mesure_min: 120, temps_valide_min: 120 },
    });
    // UN TAUX EN VIGUEUR — `scene.ts` en pose déjà un depuis 2020, pour la
    // société de la scène : cette fixture le réutilise, jamais un second.
  } finally {
    await client.$disconnect();
  }
});

test("la page du bon s'affiche et porte ses blocs", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${FICHE_BON_TERMINEE}/bon`);

  await expect(
    page.getByRole("heading", { name: segmentsSurSiteTitre() }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: fr["intervention.bon.valorisation_titre"],
    }),
  ).toBeVisible();

  // LA MACHINE — cette fixture n'en porte aucune : l'absence est NOMMÉE,
  // jamais un bloc muet (RG-INT-01).
  await expect(page.getByText(aucuneMachineSurLeSite())).toBeVisible();

  // LE COMPTEUR A TOURNÉ (fixture : un segment fermé de 120 minutes) : la
  // section ne dit donc PAS « aucun segment ».
  await expect(
    page.getByText(fr["intervention.bon.aucun_segment"]),
  ).toHaveCount(0);

  // LE TAUX EST EN VIGUEUR (`scene.ts` : un taux depuis 2020) et le rôle du
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

  // LES CINQ BLOCS DE BON-2 SONT NOMMÉS, JAMAIS AFFICHÉS VIDES — cette
  // fixture ne porte ni prestation, ni commentaire, ni suite à donner, ni
  // photo, ni signature.
  await expect(
    page.getByText(fr["intervention.bon.aucune_prestation"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucun_commentaire"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucune_suite"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucune_photo"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucune_signature"]),
  ).toBeVisible();
});
