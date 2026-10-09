import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import {
  aucuneMachineSurLeSite,
  segmentsSurSiteTitre,
} from "@/app/(back-office)/interventions/presentation";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE, FORFAITS_SCENE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

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
 *
 * ## VERSION CLIENT / VERSION INTERNE (9EN, D186, QT-8 (a))
 *
 * Trois scénarios, sur la MÊME fixture : (A) la version CLIENT, par défaut,
 * pour un rôle qui voit les montants (ADV) — zéro titre, zéro montant, zéro
 * motif, à l'écran ET à l'impression ; (B) `?version=interne`, même rôle —
 * le bloc de valorisation d'avant ce lot, inchangé, plus le badge et la
 * mention de pied ; (C) `?version=interne` demandé par un rôle SANS droit
 * (`admin_societe`) — retombe sur la version client, sans bascule ni mention.
 * La fixture porte désormais un FORFAIT (`FORFAITS_SCENE[0]`) : sans lui,
 * « aucune ligne forfait » ne distinguerait pas une version qui l'omet d'une
 * version qui n'a simplement rien à montrer.
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
         "mode_valorisation", "devise_code", "forfait_deplacement_id", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'curatif', 'p3', 'terminee'::"StatutIntervention", now()::date,
               'temps_passe', 'XPF', $7::uuid, now())`,
      FICHE_BON_TERMINEE,
      reperes.societeId,
      ducos.id,
      site.client_id,
      site.id,
      reperes.technicienDucos,
      // UN FORFAIT (U10 de 9EN) : SANS lui, la version interne et la version
      // client affichaient la MÊME absence de ligne forfait — « aucune
      // valorisation » ne prouverait rien de plus qu'« aucun total ». Le
      // premier forfait de la scène, jamais un second (`scene.ts`).
      FORFAITS_SCENE[0].id,
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

/** Zéro trace de valorisation, à l'écran — commun à (A) et (C). */
async function attendreAucunMontant(page: import("@playwright/test").Page) {
  await expect(
    page.getByRole("heading", {
      name: fr["intervention.bon.valorisation_titre"],
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.cloture.taux"], { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.cloture.total"], { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.forfait_deplacement"], { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.cloture.total_inconnu"], {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.locator('[data-bloc="bon-badge-interne"]')).toHaveCount(0);
  await expect(page.locator('[data-bloc="bon-mention-interne"]')).toHaveCount(
    0,
  );
}

test("(A) version CLIENT par défaut, rôle ADV : la page s'affiche, porte ses blocs, et aucun montant", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${FICHE_BON_TERMINEE}/bon`);

  await expect(
    page.getByRole("heading", { name: segmentsSurSiteTitre() }),
  ).toBeVisible();

  // LA MACHINE — cette fixture n'en porte aucune : l'absence est NOMMÉE,
  // jamais un bloc muet (RG-INT-01).
  await expect(page.getByText(aucuneMachineSurLeSite())).toBeVisible();

  // LE COMPTEUR A TOURNÉ (fixture : un segment fermé de 120 minutes) : la
  // section ne dit donc PAS « aucun segment ».
  await expect(
    page.getByText(fr["intervention.bon.aucun_segment"]),
  ).toHaveCount(0);

  // LE GESTE D'IMPRESSION.
  await expect(page.locator('[data-bloc="bon-imprimer"]')).toBeVisible();

  // LA BASCULE DE VERSION EST PROPOSÉE (le rôle voit les montants), LA
  // VERSION CLIENT EST L'ACTIVE.
  const lienClient = page.locator('[data-bloc="bon-version-client"]');
  const lienInterne = page.locator('[data-bloc="bon-version-interne"]');
  await expect(lienClient).toHaveAttribute("aria-current", "page");
  await expect(lienInterne).not.toHaveAttribute("aria-current", "page");

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

  // QT-8 (a), D186 — AUCUN montant sur le bon CLIENT, ni motif, ni taux
  // absent : la section n'existe pas du tout.
  await attendreAucunMontant(page);
  await expect(page.getByText(fr["intervention.bon.taux_absent"])).toHaveCount(
    0,
  );
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toHaveCount(0);

  // MÊMES ZÉROS À L'IMPRESSION — c'est le document qui part chez le client.
  await page.emulateMedia({ media: "print" });
  await attendreAucunMontant(page);
});

test("(B) ?version=interne, rôle ADV : la valorisation complète, le badge et la mention", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${FICHE_BON_TERMINEE}/bon?version=interne`);

  const lienInterne = page.locator('[data-bloc="bon-version-interne"]');
  await expect(lienInterne).toHaveAttribute("aria-current", "page");

  // LE TAUX EST EN VIGUEUR (`scene.ts` : un taux depuis 2020) et le rôle voit
  // les montants de vente : ni le motif de rôle, ni celui du taux absent ne
  // s'affichent.
  await expect(
    page.getByRole("heading", {
      name: fr["intervention.bon.valorisation_titre"],
    }),
  ).toBeVisible();
  await expect(page.getByText(fr["intervention.bon.taux_absent"])).toHaveCount(
    0,
  );
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.cloture.taux"], { exact: true }),
  ).toBeVisible();

  // LE FORFAIT DE LA FIXTURE (U10 de 9EN) — sans lui, cette ligne ne se
  // distinguerait pas d'une absence.
  await expect(
    page.getByText(fr["intervention.forfait_deplacement"], { exact: true }),
  ).toBeVisible();

  await expect(page.locator('[data-bloc="bon-badge-interne"]')).toBeVisible();
  await expect(page.locator('[data-bloc="bon-mention-interne"]')).toBeVisible();

  // MÊME CONTENU À L'IMPRESSION — c'est la version qui reste interne.
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("heading", {
      name: fr["intervention.bon.valorisation_titre"],
    }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.cloture.taux"], { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-bloc="bon-badge-interne"]')).toBeVisible();
  await expect(page.locator('[data-bloc="bon-mention-interne"]')).toBeVisible();
});

test("(C) ?version=interne demandé par admin_societe : retombe sur la version client", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto(`/interventions/${FICHE_BON_TERMINEE}/bon?version=interne`);

  // AUCUNE BASCULE N'EST PROPOSÉE — ce rôle n'a pas le droit (D37).
  await expect(page.locator('[data-bloc="bon-version-client"]')).toHaveCount(0);
  await expect(page.locator('[data-bloc="bon-version-interne"]')).toHaveCount(
    0,
  );

  await attendreAucunMontant(page);
});
