import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import {
  cleJour,
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { jourSemaineIso } from "@/lib/calendar/semaine";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 75-PLANNING-5 — LA VUE JOUR NE DIT PLUS « LIBRE » À QUI A UNE VISITE SANS
 * HEURE À CALER (SAV-06).
 *
 * *Mesuré sur `main` 87d49b1 le 25/09/2026 : une visite sans heure de 3 h ne
 * retirait aucun créneau du compte de trous — « 16 créneaux libres » disait
 * la même chose qu'une journée vide.* `journee.aCaler` (`lib/interventions/
 * journee.ts`) mesure désormais ce poids SÉPARÉMENT, et la vue jour le montre
 * dans son résumé et dans une pastille de colonne.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `PLA5-` — jamais `tests/e2e/setup/scene.ts`
 *
 * Un technicien, un client et un site forgés (identifiants `uuidv7()`, I10),
 * une seule intervention DATÉE SANS HEURE de 180 minutes, à un jour ouvré
 * choisi à 140 jours d'aujourd'hui — loin des décalages déjà pris par les
 * autres fichiers (5, 10, 11, 21, 35, 49, 63, 91) — et ajusté au besoin pour
 * tomber un jour où Ducos ouvre (jamais un dimanche).
 */

test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";

let utilisateurPla5 = "";
let utilisateurSocietePla5 = "";
let technicienPla5 = "";
let clientPla5 = "";
let sitePla5 = "";
let interventionPla5 = "";

let jourVise: JourLocal;

async function nouveauClientAdministration(): Promise<PrismaClient> {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function effacerLaScene(): Promise<void> {
  if (utilisateurPla5 === "") {
    return;
  }
  const client = await nouveauClientAdministration();
  try {
    await client.intervention.deleteMany({ where: { id: interventionPla5 } });
    await client.site.deleteMany({ where: { id: sitePla5 } });
    await client.client.deleteMany({ where: { id: clientPla5 } });
    await client.technicien.deleteMany({ where: { id: technicienPla5 } });
    await client.utilisateurSociete.deleteMany({
      where: { id: utilisateurSocietePla5 },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurPla5 } });
  } finally {
    await client.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  utilisateurPla5 = uuidv7();
  utilisateurSocietePla5 = uuidv7();
  technicienPla5 = uuidv7();
  clientPla5 = uuidv7();
  sitePla5 = uuidv7();
  interventionPla5 = uuidv7();

  const client = await nouveauClientAdministration();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { id: true, fuseau_horaire: true },
    });
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });

    const aujourdhui = jourDe(maintenant(societe.fuseau_horaire).local);
    // 140 JOURS — loin de tout autre décalage pris par les fichiers e2e du
    // dépôt, et ajusté sur un jour où Ducos ouvre (jamais un dimanche, I7 :
    // aucun calendrier codé en dur ici, seule sa FERMETURE dominicale connue
    // du semis est évitée).
    let candidat = jourSuivant(aujourdhui, 140);
    if (jourSemaineIso(candidat) === 7) {
      candidat = jourSuivant(candidat, 1);
    }
    jourVise = candidat;

    await client.utilisateur.create({
      data: {
        id: utilisateurPla5,
        nom: "Technicien PLA5- (épreuve PLANNING-5)",
        email: "pla5-technicien@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocietePla5,
        utilisateur_id: utilisateurPla5,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienPla5,
        societe_id: societe.id,
        utilisateur_id: utilisateurPla5,
        agence_id: ducos.id,
        actif: true,
      },
    });

    await client.client.create({
      data: {
        id: clientPla5,
        societe_id: societe.id,
        raison_sociale: "Client PLA5- (épreuve PLANNING-5)",
      },
    });
    await client.site.create({
      data: {
        id: sitePla5,
        societe_id: societe.id,
        client_id: clientPla5,
        agence_id: ducos.id,
        libelle: "Lieu PLA5- (épreuve PLANNING-5)",
        temps_trajet_min: 10,
      },
    });

    // DATÉE, SANS HEURE (`creneau_debut`/`creneau_fin` nuls), 180 minutes :
    // exactement le cas que le constat mesure — une journée qui attend déjà
    // 3 h de travail et que l'écran, sur `main` 87d49b1, disait « libre ».
    await client.intervention.create({
      data: {
        id: interventionPla5,
        societe_id: societe.id,
        agence_id: ducos.id,
        client_id: clientPla5,
        site_id: sitePla5,
        technicien_id: utilisateurPla5,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: instantDuJour(jourVise),
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: 180,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });

    const enBase = await client.intervention.count({
      where: { id: interventionPla5 },
    });
    expect(enBase).toBe(1);
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/75-PLANNING-5/captures",
);

test("une visite sans heure se lit « à caler », jamais « libre »", async ({
  page,
}) => {
  await page.goto(`/planning?vue=jour&jour=${cleJour(jourVise)}`);
  await expect(page.locator("main")).toBeVisible();

  const resume = page
    .locator("section[data-maquette-bloc='vue-jour'] p")
    .first();
  await expect(resume).toBeVisible();
  // « 1 visite à caler (3 h 00) » — jamais à la place du compte de trous,
  // toujours à côté (le « · » qui les sépare).
  await expect(resume).toContainText(
    `1 ${fr["planning.a_caler_visite_une"]} (3 h 00)`,
  );

  // LA PASTILLE, SUR LA COLONNE DE CE TECHNICIEN — et nulle part ailleurs :
  // le nom forgé de la scène ne désigne que cette colonne-là.
  const enTete = page
    .locator("th", { hasText: "Technicien PLA5- (épreuve PLANNING-5)" })
    .first();
  await expect(enTete).toBeVisible();
  const pastille = enTete.locator("[data-a-caler]");
  await expect(pastille).toBeVisible();
  await expect(pastille).toHaveText(`1 ${fr["planning.a_caler_pastille"]}`);

  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "vue-jour-a-caler-1280.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, "vue-jour-a-caler-375.png"),
    fullPage: true,
  });
});
