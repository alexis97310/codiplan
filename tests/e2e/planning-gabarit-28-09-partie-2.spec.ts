import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";
import { jourSuivant } from "@/lib/calendar/fuseau";
import { dureeCarteAffichee } from "@/app/(back-office)/planning/carte";
import { heureDuCreneau } from "@/app/(back-office)/interventions/presentation";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour, type ReperesDeScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EH-TP-UX-PL-PLANNING-2 — FILE « À TRAITER », CARTES, COLONNE TECHNICIEN
 * ET LÉGENDE AU GABARIT DE LA MAQUETTE DU 28/09.
 *
 * **SA PROPRE SCÈNE, préfixée `zz9EH2-`** (trie après les sites de
 * démonstration et après `zz9EHC-GABARIT`) — un client, un site, quatre
 * interventions créées en `beforeAll`, supprimées en `afterAll`. Le
 * TECHNICIEN est LU depuis la scène partagée (`reperes.technicienDucos`),
 * jamais modifié : les nouvelles interventions le RÉFÉRENCENT seulement.
 *
 * **Décalage de dix semaines** (`jourSuivant(reperes.lundi, 70)`, 70 = 10 × 7
 * — le lundi d'une semaine future, jamais celui d'aujourd'hui) — différent du
 * décalage de `planning-telephone-en-tete.spec.ts` (9EHB, fenêtre
 * [+1, +16]) et de celui de `planning-fenetre-pose.spec.ts` (+77) : aucun
 * jour fixe, aucune collision avec une autre scène.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const P1_ID = uuidv7();
const P2_ID = uuidv7();
const PLANIFIEE_ID = uuidv7();
const AFFECTEE_ID = uuidv7();

let reperes: ReperesDeScene;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

/** Le mardi de la semaine +10 — même jour, calculé une seule fois. */
function jourCibleCle(): string {
  return cleDeJour(jourSuivant(reperes.lundi, 71));
}

test.beforeAll(async () => {
  reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const jourCibleCleValeur = jourCibleCle();

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "zz9EH2-client forgé",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: ducos.id,
        libelle: "zz9EH2-site forgé",
      },
    });

    // P1, À PLANIFIER, DURÉE CONNUE (90 min).
    await client.intervention.create({
      data: {
        id: P1_ID,
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: null,
        type: "curatif",
        priorite: "p1",
        statut: "a_planifier",
        duree_estimee_min: 90,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9EH2-panne P1",
      },
    });
    // P2, À PLANIFIER, SANS DURÉE.
    await client.intervention.create({
      data: {
        id: P2_ID,
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: null,
        type: "curatif",
        priorite: "p2",
        statut: "a_planifier",
        duree_estimee_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9EH2-panne P2",
      },
    });
    // PLANIFIÉE, sur le technicien lu, créneau 08:00–09:30.
    await client.intervention.create({
      data: {
        id: PLANIFIEE_ID,
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "preventif_hors_contrat",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: new Date(`${jourCibleCleValeur}T00:00:00.000Z`),
        creneau_debut: new Date(`${jourCibleCleValeur}T08:00:00.000Z`),
        creneau_fin: new Date(`${jourCibleCleValeur}T09:30:00.000Z`),
        duree_estimee_min: 90,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9EH2-planifiee",
      },
    });
    // AFFECTÉE, sur le même technicien, créneau 10:00–11:00.
    await client.intervention.create({
      data: {
        id: AFFECTEE_ID,
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "preventif_hors_contrat",
        priorite: "p3",
        statut: "affectee",
        date_planifiee: new Date(`${jourCibleCleValeur}T00:00:00.000Z`),
        creneau_debut: new Date(`${jourCibleCleValeur}T10:00:00.000Z`),
        creneau_fin: new Date(`${jourCibleCleValeur}T11:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9EH2-affectee",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { id: { in: [P1_ID, P2_ID, PLANIFIEE_ID, AFFECTEE_ID] } },
    });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

function hrefSemaine(): string {
  const lundiCible = jourSuivant(reperes.lundi, 70);
  return `/planning?vue=semaine&semaine=${cleDeJour(lundiCible)}`;
}

test("à 1280 px, le compteur « À planifier » est rouge quand une P1 attend", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(hrefSemaine());

  const onglet = page.locator('[data-onglet-file="a_planifier"]');
  await expect(onglet).toBeVisible();
  const badge = onglet.locator('[data-maquette-bloc="badge-a-affecter"] span');
  await expect(badge).toHaveClass(/bg-app-rouge-fond/);
});

test("à 1280 px, la carte P1 porte sa puce, sa durée et « Poser… » dans son cadre", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(hrefSemaine());

  const carte = page.locator(`[data-tiroir-declencheur="${P1_ID}"]`);
  await expect(carte).toBeVisible();
  await expect(carte.getByLabel(fr["priorite.p1"])).toBeVisible();
  await expect(carte).toContainText(dureeCarteAffichee(90)!);

  // « Poser… » est DANS le même cadre que la carte, pas ailleurs sur la page.
  const cadre = carte.locator("..");
  const bouton = cadre.getByRole("button", {
    name: fr["planning.pose.bouton_poser"],
  });
  await expect(bouton).toBeVisible();

  await bouton.click();
  const fenetre = page.locator(`[data-fenetre-pose="${P1_ID}"]`);
  await expect(fenetre).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(fenetre).toHaveCount(0);
});

test("à 1280 px, la carte P2 (sans durée) porte le badge « durée ? »", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(hrefSemaine());

  const carte = page.locator(`[data-tiroir-declencheur="${P2_ID}"]`);
  await expect(carte).toBeVisible();
  await expect(carte).toContainText(fr["planning.duree_inconnue"]);
});

test("à 1280 px, sur la grille, l'horaire se lit et seule l'affectée porte « ✓ transmise »", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(hrefSemaine());

  const blocPlanifiee = page.locator(`[data-bloc="${PLANIFIEE_ID}"]`);
  const blocAffectee = page.locator(`[data-bloc="${AFFECTEE_ID}"]`);
  await expect(blocPlanifiee).toBeVisible();
  await expect(blocAffectee).toBeVisible();
  const heureDebut = heureDuCreneau(
    { creneau_debut: new Date(`${jourCibleCle()}T08:00:00.000Z`) },
    reperes.fuseau,
  )!;
  await expect(blocPlanifiee).toContainText(heureDebut);
  await expect(blocAffectee).toContainText(fr["planning.transmise"]);
  await expect(blocPlanifiee).not.toContainText(fr["planning.transmise"]);
});

test("à 1280 px, la colonne technicien porte des initiales et le lien « Absence » garde son adresse", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(hrefSemaine());

  const ligne = page
    .locator(`[data-maquette-bloc="nom-technicien-agence"]`)
    .locator("..")
    .locator("..");
  // L'avatar à initiales précède le nom — `aria-hidden`, lu par son texte.
  await expect(ligne.locator(".rounded-full").first()).toBeVisible();

  const lienAbsence = page.getByRole("link", {
    name: fr["planning.declarer_absence_lien"],
  });
  await expect(lienAbsence.first()).toBeVisible();
  await expect(lienAbsence.first()).toHaveAttribute(
    "href",
    new RegExp(`utilisateur_id=${reperes.technicienDucos}`),
  );
});

test("à 1280 px, la légende est sous la grille, hors de sa carte", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(hrefSemaine());

  const legende = page.locator("ul", {
    hasText: fr["planning.legende.planifiee"],
  });
  await expect(legende).toBeVisible();
  await expect(legende).toContainText(fr["planning.legende.affectee"]);
  await expect(legende).toContainText(fr["planning.legende.en_cours"]);
  await expect(legende).toContainText(fr["planning.legende.priorite"]);
});

test("à 375 px, l'onglet « À traiter » montre le compteur rouge et la carte P1", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto(`${hrefSemaine()}&volet=a_traiter`);

  const onglet = page.locator('[data-onglet-file="a_planifier"]');
  await expect(onglet).toBeVisible();
  const badge = onglet.locator('[data-maquette-bloc="badge-a-affecter"] span');
  await expect(badge).toHaveClass(/bg-app-rouge-fond/);

  const carte = page.locator(`[data-tiroir-declencheur="${P1_ID}"]`);
  await expect(carte).toBeVisible();
});
