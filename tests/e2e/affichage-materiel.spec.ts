import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { instantAMinutes } from "@/lib/calendar/fuseau";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour, jourDeLaScene, MARDI, SCENE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * AFFICHAGE-MATERIEL-1 — LE MATÉRIEL SE VOIT, ET LA VUE DU JOUR MONTRE TOUT.
 *
 * ## Ce qui a été mesuré en production le 23/09/2026
 *
 * Les interventions du jour SANS HEURE étaient reléguées SOUS toute la grille
 * de la vue jour, comme si elles n'existaient pas. Une carte de planning ne
 * disait jamais QUEL matériel. La fiche intervention ne portait ni famille ni
 * numéro de série. Le bon d'intervention se générait sur une intervention
 * encore `planifiee`, un travail que le terrain n'avait pas fini.
 *
 * Ce fichier pose SA PROPRE intervention, à un identifiant fixe, sur le
 * technicien et le jour de la scène — jamais une ligne du semis, pour la
 * même raison que `scene.ts` : une épreuve dont la cible se déplace au
 * prochain ticket de démonstration n'est pas une épreuve.
 */

// SÉRIE, ET C'EST DÉLIBÉRÉ : `beforeAll` DÉTRUIT puis RECRÉE ses fixtures (le
// même geste que `scene.ts`, ici tenu par le fichier et non par un montage
// global) — sous `fullyParallel`, deux tests de CE fichier peuvent tomber sur
// deux WORKERS distincts, et `beforeAll` tourne alors UNE FOIS PAR WORKER :
// deux écritures concurrentes sur le MÊME identifiant fixe se sont mesurées
// en `23505` (clé déjà existante). La série ramène ce fichier à un seul
// worker, comme `planning-largeur-et-carte.spec.ts` qui, lui, ne fait que LIRE
// dans son `beforeAll` et n'a jamais eu besoin de cette garde.
test.describe.configure({ mode: "serial" });

/** Ducos, technicien de Ducos, MARDI 10:30–11:00 — libre entre l'obstacle
 * (08:00–10:00) et la chevauchante (13:00–14:00), une machine affectée. */
const AVEC_MACHINE = "01a0f100-0000-7000-8000-000000000001";
/** La même intervention, mais encore `planifiee` — pour l'épreuve du bon. */
const PLANIFIEE_SEULE = "01a0f100-0000-7000-8000-000000000002";

let societeId: string;
let familleAttendue: string;
let marqueAttendue: string;
let referenceAttendue: string;
let serieAttendue: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: societeId, agence_id: ducos.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    // UNE MACHINE EXISTANTE DU SEMIS, JAMAIS FABRIQUÉE — cette épreuve ne
    // porte pas sur le catalogue de matériel, seulement sur son AFFICHAGE.
    const machine = await client.machine.findFirstOrThrow({
      where: { societe_id: societeId },
      select: {
        id: true,
        numero_serie: true,
        modele: {
          select: {
            marque: true,
            reference: true,
            famille: { select: { libelle: true } },
          },
        },
      },
    });
    familleAttendue = machine.modele.famille.libelle;
    marqueAttendue = machine.modele.marque;
    referenceAttendue = machine.modele.reference;
    serieAttendue = machine.numero_serie;

    const jour = jourDeLaScene(reperes, MARDI);
    const jourDate = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));
    const debut = instantAMinutes(jour, 10 * 60 + 30, reperes.fuseau);
    const fin = instantAMinutes(jour, 11 * 60, reperes.fuseau);

    for (const [id, statut] of [
      [AVEC_MACHINE, "terminee"],
      [PLANIFIEE_SEULE, "planifiee"],
    ] as const) {
      await client.$executeRawUnsafe(
        `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
        id,
      );
      await client.intervention.deleteMany({ where: { id } });
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
           "technicien_id", "type", "priorite", "statut", "date_planifiee",
           "creneau_debut", "creneau_fin", "duree_estimee_min",
           "mode_valorisation", "devise_code", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
                 'curatif', 'p3', $7::"StatutIntervention", $8::date,
                 $9::timestamptz, $10::timestamptz,
                 30, 'temps_passe', 'XPF', now())`,
        id,
        societeId,
        ducos.id,
        site.client_id,
        site.id,
        reperes.technicienDucos,
        statut,
        jourDate,
        debut,
        fin,
      );
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now())`,
        societeId,
        id,
        machine.id,
      );
    }
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/* ── LE MATÉRIEL, PARTOUT (AFFICHAGE-MATERIEL-1) ─────────────────────────── */

test("la fiche intervention affiche la famille, la marque, la référence et le numéro de série", async ({
  page,
}) => {
  await page.goto(`/interventions/${AVEC_MACHINE}`);
  const ligneMachine = page.locator("dd", {
    hasText: referenceAttendue,
  });
  await expect(ligneMachine).toContainText(familleAttendue);
  await expect(ligneMachine).toContainText(marqueAttendue);
  await expect(ligneMachine).toContainText(serieAttendue);
  // Et elle mène toujours à la fiche machine (LIENS-1) — inchangé par ce lot.
  await expect(
    page.locator(`a[href^="/parc/"]`, { hasText: referenceAttendue }),
  ).toBeVisible();
});

test("la carte de planning (vue semaine) dit le matériel, famille et n° de série compris", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  await page.goto(`/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`);
  const carte = page.locator(`[data-bloc="${AVEC_MACHINE}"]`);
  await expect(carte).toBeVisible();
  await expect(carte).toContainText(familleAttendue);
  await expect(carte).toContainText(serieAttendue);
});

test("la vue jour place l'intervention SANS HEURE dans la colonne de son technicien, en tête de grille", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  await page.goto(
    `/planning?vue=jour&jour=${cleDeJour(jourDeLaScene(reperes, MARDI))}`,
  );
  // `SCENE.deplacable` (Koné, MARDI, sans créneau) — jamais reléguée SEULEMENT
  // sous la grille : la ligne « Journée — heure non fixée » la porte en tête.
  const ligneSansHeure = page.locator(
    '[data-maquette-bloc="ligne-jour-sans-heure"]',
  );
  await expect(ligneSansHeure).toBeVisible();
  await expect(ligneSansHeure).toContainText(fr["planning.jour_sans_heure"]);
  await expect(
    ligneSansHeure.locator(`a[href="/interventions/${SCENE.deplacable}"]`),
  ).toBeVisible();
});

/* ── LE BON N'EXISTE QUE POUR UN TRAVAIL FAIT (AFFICHAGE-MATERIEL-1) ─────── */

test("le lien « Bon d'intervention » n'est pas proposé sur une intervention PLANIFIÉE", async ({
  page,
}) => {
  await page.goto(`/interventions/${PLANIFIEE_SEULE}`);
  await expect(
    page.getByRole("link", { name: fr["intervention.bon.titre"] }),
  ).toHaveCount(0);
});

test("l'URL du bon d'une intervention PLANIFIÉE renvoie à la fiche avec un motif clair, jamais un bon à moitié vide", async ({
  page,
}) => {
  await page.goto(`/interventions/${PLANIFIEE_SEULE}/bon`);
  await expect(page).toHaveURL(
    new RegExp(`/interventions/${PLANIFIEE_SEULE}\\?motif=`),
  );
  await expect(
    page.getByText(fr["intervention.bon.refus.non_terminee"]),
  ).toBeVisible();
});

test("le bon se génère sur une intervention TERMINÉE, avec le lien proposé depuis la fiche", async ({
  page,
}) => {
  await page.goto(`/interventions/${AVEC_MACHINE}`);
  const lienBon = page.getByRole("link", {
    name: fr["intervention.bon.titre"],
  });
  await expect(lienBon).toBeVisible();
  await lienBon.click();
  await expect(page).toHaveURL(`/interventions/${AVEC_MACHINE}/bon`);
  await expect(
    page.getByText(fr["intervention.bon.titre"]).first(),
  ).toBeVisible();
});
