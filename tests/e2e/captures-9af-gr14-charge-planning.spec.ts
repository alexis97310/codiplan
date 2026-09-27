import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { instantDuJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { lundiDeLaSemaine } from "@/lib/calendar/semaine";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AF-GR14-CHARGE-PLANNING (27/09/2026) — même recette que
 * `captures-gr14-duree-unique.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, préfixée `GR14PLA-`/`GR14PLB-` — jamais `SCENE.*` : deux
 * techniciens forgés, chacun sa ligne dans le bloc « Charge par technicien ».
 * Le premier porte une durée engagée franche et un trajet non nul ; le second
 * porte une intervention SANS DURÉE, pour rendre « au moins … engagées ».
 * Aucun des deux ne touche aux techniciens de démonstration (`guerin@`,
 * `poigoune@`) : une autre épreuve, en parallèle, pourrait compter leur
 * semaine (piège connu du lot).
 */
test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";
const DOSSIER = process.env.CAPTURES_9AF ?? "";

let utilisateurA = "";
let utilisateurSocieteA = "";
let technicienA = "";
let clientA = "";
let siteA = "";
let interventionA = "";

let utilisateurB = "";
let utilisateurSocieteB = "";
let technicienB = "";
let clientB = "";
let siteB = "";
let interventionB1 = "";
let interventionB2 = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function effacerLaScene(): Promise<void> {
  if (utilisateurA === "") {
    return;
  }
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { id: { in: [interventionA, interventionB1, interventionB2] } },
    });
    await client.site.deleteMany({ where: { id: { in: [siteA, siteB] } } });
    await client.client.deleteMany({
      where: { id: { in: [clientA, clientB] } },
    });
    await client.technicien.deleteMany({
      where: { id: { in: [technicienA, technicienB] } },
    });
    await client.utilisateurSociete.deleteMany({
      where: { id: { in: [utilisateurSocieteA, utilisateurSocieteB] } },
    });
    await client.utilisateur.deleteMany({
      where: { id: { in: [utilisateurA, utilisateurB] } },
    });
  } finally {
    await client.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  utilisateurA = uuidv7();
  utilisateurSocieteA = uuidv7();
  technicienA = uuidv7();
  clientA = uuidv7();
  siteA = uuidv7();
  interventionA = uuidv7();

  utilisateurB = uuidv7();
  utilisateurSocieteB = uuidv7();
  technicienB = uuidv7();
  clientB = uuidv7();
  siteB = uuidv7();
  interventionB1 = uuidv7();
  interventionB2 = uuidv7();

  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { id: true, fuseau_horaire: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    const aujourdhui = jourDe(maintenant(societe.fuseau_horaire).local);
    // LE LUNDI DE LA SEMAINE COURANTE, jamais « aujourd'hui » : un jour
    // d'épreuve tombé un dimanche tomberait hors de la semaine affichée par
    // défaut (LUN-SAM) et la ligne du technicien disparaîtrait du tout.
    const dateDuJour = instantDuJour(lundiDeLaSemaine(aujourdhui));

    await client.utilisateur.create({
      data: {
        id: utilisateurA,
        nom: "Technicien GR14PLA- (épreuve GR14-CHARGE-PLANNING)",
        email: "gr14pla-technicien@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteA,
        utilisateur_id: utilisateurA,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienA,
        societe_id: societe.id,
        utilisateur_id: utilisateurA,
        agence_id: agence.id,
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: clientA,
        societe_id: societe.id,
        raison_sociale: "GR14PLA- Client de l'épreuve",
      },
    });
    await client.site.create({
      data: {
        id: siteA,
        societe_id: societe.id,
        client_id: clientA,
        agence_id: agence.id,
        libelle: "GR14PLA- Lieu de l'épreuve",
        // TRAJET NON NUL, volontairement : c'est la ligne qui doit rendre
        // « … de trajet » avec un chiffre visible plutôt que « 0 min ».
        temps_trajet_min: 45,
      },
    });
    await client.intervention.create({
      data: {
        id: interventionA,
        societe_id: societe.id,
        agence_id: agence.id,
        client_id: clientA,
        site_id: siteA,
        technicien_id: technicienA,
        type: "curatif",
        priorite: "p3",
        statut: "terminee",
        date_planifiee: dateDuJour,
        // 11 h 30 — un chiffre qui n'existe QU'en heures et minutes, jamais en
        // heure du jour (le constat même du ticket : « 11:30 » → « 11 h 30 »).
        temps_valide_min: 690,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });

    await client.utilisateur.create({
      data: {
        id: utilisateurB,
        nom: "Technicien GR14PLB- (épreuve GR14-CHARGE-PLANNING)",
        email: "gr14plb-technicien@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteB,
        utilisateur_id: utilisateurB,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.technicien.create({
      data: {
        id: technicienB,
        societe_id: societe.id,
        utilisateur_id: utilisateurB,
        agence_id: agence.id,
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: clientB,
        societe_id: societe.id,
        raison_sociale: "GR14PLB- Client de l'épreuve",
      },
    });
    await client.site.create({
      data: {
        id: siteB,
        societe_id: societe.id,
        client_id: clientB,
        agence_id: agence.id,
        libelle: "GR14PLB- Lieu de l'épreuve",
      },
    });
    // UNE intervention avec une durée connue — 1 h 35, un seul chiffre après
    // l'heure pour distinguer la conversion d'un simple hasard d'arrondi.
    await client.intervention.create({
      data: {
        id: interventionB1,
        societe_id: societe.id,
        agence_id: agence.id,
        client_id: clientB,
        site_id: siteB,
        technicien_id: technicienB,
        type: "curatif",
        priorite: "p3",
        statut: "terminee",
        date_planifiee: dateDuJour,
        temps_valide_min: 95,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });
    // UNE intervention SANS DURÉE (ni temps validé, ni estimation) : c'est ce
    // couple qui fait passer la ligne en « au moins … engagées ».
    await client.intervention.create({
      data: {
        id: interventionB2,
        societe_id: societe.id,
        agence_id: agence.id,
        client_id: clientB,
        site_id: siteB,
        technicien_id: technicienB,
        type: "curatif",
        priorite: "p3",
        statut: "terminee",
        date_planifiee: dateDuJour,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
      },
    });

    const enBase = await client.intervention.count({
      where: {
        id: { in: [interventionA, interventionB1, interventionB2] },
      },
    });
    expect(enBase).toBe(3);
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`capture — charge par technicien à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1400 });
    await ouvrirUneSession(page);
    await page.goto("/planning");
    await expect(
      page.getByRole("heading", { name: fr["statistiques.titre"] }),
    ).toBeVisible();
    await capturer(page, "charge-technicien", largeur);
  });
}
