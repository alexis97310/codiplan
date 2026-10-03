import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { creneauDeLaFiche } from "@/components/terrain/presentation";
import { cleJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";
import { libelleMaterielComplet } from "@/lib/machines/presentation";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 9DI-TP-TER1-JOURNEE-FICHE (QE-11) — LA JOURNÉE ET LA FICHE DU TECHNICIEN,
 * DE BOUT EN BOUT.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9DI` — AUCUNE LIGNE AU SEMIS NI À `SCENE.*`
 *
 * Un client, un site, une machine et un contact forgés en `beforeAll`,
 * supprimés en `afterAll` (I9). Le technicien est une identité DU SEMIS
 * (`garnier@codima.test`, Ducos), en lecture seule — ce scénario l'emprunte
 * pour se connecter, il ne touche à rien qui lui appartenait déjà.
 *
 * ## POURQUOI UNE SECONDE INTERVENTION
 *
 * `INTERVENTION_AILLEURS` sert UNIQUEMENT à faire tourner le compteur
 * dessus, pour éprouver le bandeau sur Ma journée et sur la fiche de
 * `INTERVENTION_PRINCIPALE`. `INTERVENTION_REPRISE`, elle, naît `en_cours`
 * avec un segment déjà FERMÉ : aucun compteur n'y tourne ni ailleurs,
 * exactement l'état que « Reprendre le compteur » doit distinguer de
 * « Démarrer l'intervention ».
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const CONTACT_ID = uuidv7();
const MACHINE_ID = uuidv7();
const INTERVENTION_PRINCIPALE = uuidv7();
const INTERVENTION_AILLEURS = uuidv7();
const INTERVENTION_REPRISE = uuidv7();
const SEGMENT_REPRISE = uuidv7();
const INTERVENTION_MACHINE_ID = uuidv7();

const TELEPHONE = "26.00.11";
const MOBILE = "78.22.33";

let fuseau = "";
let creneauAttendu = "";
let machineAttendue = "";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  fuseau = reperes.fuseau;
  const technicienId = reperes.technicienDucos;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId },
      select: {
        id: true,
        marque: true,
        reference: true,
        famille: { select: { libelle: true } },
      },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: fr["terrain9di.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: fr["terrain9di.e2e.site"],
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        nom: fr["terrain9di.e2e.contact_nom"],
        telephone: TELEPHONE,
        mobile: MOBILE,
        // `email` est le SEUL canal connu aujourd'hui (lib/contacts/saisie.ts) ;
        // la base refuse un ensemble de canaux vide (`contact_canaux_non_vides`).
        email: "contact-9di@epreuve.test",
        canaux: ["email"],
        roles: ["contact_technique"],
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_ID,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        numero_serie: fr["terrain9di.e2e.numero_serie"],
        qr_token: engendrerJetonQr(),
      },
    });

    machineAttendue = libelleMaterielComplet({
      familleLibelle: modele.famille.libelle,
      marque: modele.marque,
      reference: modele.reference,
      numeroSerie: fr["terrain9di.e2e.numero_serie"],
    });

    // LE JOUR CIVIL DE LA SOCIÉTÉ, JAMAIS CELUI DE L'APPAREIL (L0-08) — à
    // l'heure où ce fichier joue, UTC et Nouméa (UTC+11) peuvent être sur
    // deux dates civiles différentes ; `/terrain` filtre sur LA SIENNE.
    const cle = cleJour(jourDe(maintenant(fuseau).local));
    const datePlanifiee = new Date(`${cle}T00:00:00.000Z`);
    // 09:00–10:30 locales à Nouméa (UTC+11, sans heure d'été) — choisies
    // pour rester sur LA MÊME date UTC que `datePlanifiee`.
    const creneauDebut = new Date(`${cle}T09:00:00.000Z`);
    const creneauFin = new Date(`${cle}T10:30:00.000Z`);
    creneauAttendu = creneauDeLaFiche(
      {
        date_planifiee: datePlanifiee,
        creneau_debut: creneauDebut,
        creneau_fin: creneauFin,
      },
      fuseau,
    );

    const commun = {
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: CLIENT_ID,
      site_id: SITE_ID,
      technicien_id: technicienId,
      type: "curatif" as const,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      date_planifiee: datePlanifiee,
    };

    await client.intervention.create({
      data: {
        id: INTERVENTION_PRINCIPALE,
        statut: "affectee",
        priorite: "p1",
        description: fr["terrain9di.e2e.panne"],
        contact_id: CONTACT_ID,
        creneau_debut: creneauDebut,
        creneau_fin: creneauFin,
        duree_estimee_min: 90,
        ...commun,
      },
    });
    await client.interventionMachine.create({
      data: {
        id: INTERVENTION_MACHINE_ID,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_PRINCIPALE,
        machine_id: MACHINE_ID,
      },
    });

    await client.intervention.create({
      data: {
        id: INTERVENTION_AILLEURS,
        statut: "affectee",
        priorite: "p3",
        duree_estimee_min: 60,
        ...commun,
      },
    });

    // ── REPRISE : EN COURS, SEGMENT DÉJÀ FERMÉ ───────────────────────────
    // `temps_mesure_min` reste NULL à la création — un déclencheur
    // (`intervention_temps_mesure_du_compteur`, D120) refuse toute valeur
    // posée à la main qui ne corresponde pas à la somme des segments, et
    // aucun segment n'existe encore à cette ligne. `mesureDeLIntervention`
    // lit de toute façon `segment_travail` directement, jamais cette
    // colonne : ce test n'en a besoin pour rien.
    await client.intervention.create({
      data: {
        id: INTERVENTION_REPRISE,
        statut: "en_cours",
        priorite: "p3",
        duree_estimee_min: 60,
        ...commun,
      },
    });
    const ilYA20Minutes = new Date(Date.now() - 20 * 60 * 1000);
    const ilYA5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    await client.segmentTravail.create({
      data: {
        id: SEGMENT_REPRISE,
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_REPRISE,
        utilisateur_id: technicienId,
        debut: ilYA20Minutes,
        fin: ilYA5Minutes,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // L'APP ENGENDRE SON PROPRE IDENTIFIANT pour le segment de
    // `INTERVENTION_AILLEURS` (démarré/arrêté par le test lui-même) — le
    // filtre porte donc sur `intervention_id`, jamais sur un `id` connu
    // d'avance, pour que les DEUX segments soient effacés AVANT
    // l'intervention qui les porte (FK `Restrict`).
    await client.segmentTravail.deleteMany({
      where: {
        intervention_id: { in: [INTERVENTION_AILLEURS, INTERVENTION_REPRISE] },
      },
    });
    await client.interventionMachine.deleteMany({
      where: { id: INTERVENTION_MACHINE_ID },
    });
    await client.intervention.deleteMany({
      where: {
        id: {
          in: [
            INTERVENTION_PRINCIPALE,
            INTERVENTION_AILLEURS,
            INTERVENTION_REPRISE,
          ],
        },
      },
    });
    await client.machine.deleteMany({ where: { id: MACHINE_ID } });
    await client.contact.deleteMany({ where: { id: CONTACT_ID } });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("la fiche d'une intervention transmise montre priorité, créneau, panne, machine et contact tel:", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${INTERVENTION_PRINCIPALE}`);

  await expect(page.getByText(fr["priorite.p1"])).toBeVisible();
  await expect(page.getByText(creneauAttendu)).toBeVisible();
  await expect(page.getByText(fr["terrain9di.e2e.panne"])).toBeVisible();
  await expect(page.getByText(machineAttendue)).toBeVisible();
  await expect(page.getByText(fr["terrain9di.e2e.contact_nom"])).toBeVisible();

  const lienTelephone = page.locator(`a[href="tel:${TELEPHONE}"]`);
  const lienMobile = page.locator(`a[href="tel:${MOBILE}"]`);
  await expect(lienTelephone).toBeVisible();
  await expect(lienMobile).toBeVisible();
});

test("le bandeau « compteur en cours » mène, depuis Ma journée et depuis l'autre fiche, vers l'intervention où il tourne", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);

  // ── DÉMARRER SUR `INTERVENTION_AILLEURS` ─────────────────────────────────
  await page.goto(`/terrain/${INTERVENTION_AILLEURS}`);
  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/terrain/${INTERVENTION_AILLEURS}$`),
  );

  // ── LE BANDEAU SUR MA JOURNÉE ────────────────────────────────────────────
  await page.goto("/terrain");
  const bandeauJournee = page.getByRole("link", {
    name: new RegExp(fr["terrain.compteur.bandeau_prefixe"]),
  });
  await expect(bandeauJournee).toBeVisible();
  await bandeauJournee.click();
  await expect(page).toHaveURL(
    new RegExp(`/terrain/${INTERVENTION_AILLEURS}$`),
  );

  // ── LE BANDEAU SUR LA FICHE D'UNE AUTRE INTERVENTION ─────────────────────
  await page.goto(`/terrain/${INTERVENTION_PRINCIPALE}`);
  const bandeauFiche = page.getByRole("link", {
    name: new RegExp(fr["terrain.compteur.bandeau_prefixe"]),
  });
  await expect(bandeauFiche).toBeVisible();
  await bandeauFiche.click();
  await expect(page).toHaveURL(
    new RegExp(`/terrain/${INTERVENTION_AILLEURS}$`),
  );

  // ── ARRÊTER, pour ne pas laisser un compteur ouvert aux tests suivants ──
  await page
    .getByRole("button", { name: fr["terrain.compteur.pause"] })
    .click();
  await expect(
    page.getByText(fr["terrain.compteur.tourne_depuis"]),
  ).toHaveCount(0);
});

test("« Reprendre le compteur » s'affiche sur une intervention en cours sans segment ouvert", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${INTERVENTION_REPRISE}`);

  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.reprendre"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
  ).toHaveCount(0);
});
