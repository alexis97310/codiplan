import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import {
  enregistrerAccord,
  marquerDevisEnvoye,
  qualifierSuite,
} from "@/lib/suite-a-donner/depot";

import { urlAdministration, urlApplicative } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9K10-REPRISE-COMPLETE — I6 de l'étude du 08/11/2026
 * (`etude-0811/interventions-integration-ergonomie.md`).
 *
 * Le parcours REJOUE celui de `captures-9j18-suite-a-donner.spec.ts`
 * (qualifier → devis → accord → replanifier), jamais une duplication :
 * SA PROPRE SCÈNE — client, site, famille, modèle, machine et contact
 * jetables, posés en `beforeAll`, effacés en `afterAll` (mémoire
 * « e2e-semis-partage-parallele »). Seule l'origine porte ici une machine,
 * un contact et une référence client, pour éprouver que la reprise les
 * recopie (`lib/suite-a-donner/reprise.ts`).
 */

const CLIENT_9K10 = uuidv7();
const SITE_9K10 = uuidv7();
const FAMILLE_9K10 = uuidv7();
const MODELE_9K10 = uuidv7();
const MACHINE_9K10 = uuidv7();
const CONTACT_9K10 = uuidv7();
const NUMERO_SERIE_9K10 = "SN-9K10-MACHINE";
const REFERENCE_CLIENT_9K10 = "BON-9K10";
const NOM_CONTACT_9K10 = "9K10 contact origine";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let interventionOrigineId = "";
let suiteADonnerId = "";
let nouvelleInterventionId = "";

test.beforeAll(async () => {
  const client = admin();
  try {
    const utilisateur = await client.utilisateur.findFirstOrThrow({
      where: { email: "adv@codima.test" },
      select: { id: true },
    });
    const utilisateurSociete = await client.utilisateurSociete.findFirstOrThrow(
      {
        where: { utilisateur_id: utilisateur.id },
        select: { societe_id: true },
      },
    );
    const societeId = utilisateurSociete.societe_id;
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    const technicien = await client.utilisateur.findFirstOrThrow({
      where: { email: "garnier@codima.test" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9K10,
        societe_id: societeId,
        raison_sociale: "9K10 client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9K10,
        societe_id: societeId,
        client_id: CLIENT_9K10,
        agence_id: agence.id,
        libelle: "9K10 site",
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_9K10,
        societe_id: societeId,
        code: "K10FAM",
        libelle: "9K10 famille",
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_9K10,
        societe_id: societeId,
        famille_id: FAMILLE_9K10,
        marque: "9K10",
        reference: "MOD-1",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_9K10,
        societe_id: societeId,
        modele_id: MODELE_9K10,
        client_id: CLIENT_9K10,
        site_id: SITE_9K10,
        numero_serie: NUMERO_SERIE_9K10,
        qr_token: uuidv7(),
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_9K10,
        societe_id: societeId,
        client_id: CLIENT_9K10,
        nom: NOM_CONTACT_9K10,
        telephone: "687000010",
        email: null,
        roles: ["donneur_ordre"],
        // LE SEUL CANAL IMPLÉMENTÉ — « email » — EXIGE UN COURRIEL
        // (`contact_courriel_si_canal_email`) ; ce contact n'en a pas.
        canaux: ["telephone"],
      },
    });

    interventionOrigineId = uuidv7();
    await client.intervention.create({
      data: {
        id: interventionOrigineId,
        societe_id: societeId,
        client_id: CLIENT_9K10,
        site_id: SITE_9K10,
        agence_id: agence.id,
        type: "curatif",
        statut: "cloturee",
        duree_estimee_min: 60,
        technicien_id: technicien.id,
        suite_a_donner: "9K10 — pièce à commander",
        contact_id: CONTACT_9K10,
        reference_client: REFERENCE_CLIENT_9K10,
        cloturee_le: new Date(),
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention_machine" ("id","societe_id","intervention_id","machine_id","modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now())`,
      uuidv7(),
      societeId,
      interventionOrigineId,
      MACHINE_9K10,
    );

    const contexte: ContexteSession = {
      utilisateurId: utilisateur.id,
      societeId,
      role: Role.adv,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };
    const applicatif = new PrismaClient({
      datasources: { db: { url: urlApplicative() } },
    });
    try {
      suiteADonnerId = await qualifierSuite(
        contexte,
        interventionOrigineId,
        applicatif,
      );
      await marquerDevisEnvoye(contexte, suiteADonnerId, applicatif);
      await enregistrerAccord(
        contexte,
        suiteADonnerId,
        { reponse: "accord_recu" },
        applicatif,
      );
    } finally {
      await applicatif.$disconnect();
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    if (suiteADonnerId !== "") {
      await client.$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = $1::uuid`,
        suiteADonnerId,
      );
    }
    if (nouvelleInterventionId !== "") {
      await client.$executeRawUnsafe(
        `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
        nouvelleInterventionId,
      );
    }
    if (interventionOrigineId !== "") {
      await client.$executeRawUnsafe(
        `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
        interventionOrigineId,
      );
    }
    await client.contact.deleteMany({ where: { id: CONTACT_9K10 } });
    await client.machine.deleteMany({ where: { id: MACHINE_9K10 } });
    await client.modeleMateriel.deleteMany({ where: { id: MODELE_9K10 } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE_9K10 } });
    await client.site.deleteMany({ where: { id: SITE_9K10 } });
    await client.client.deleteMany({ where: { id: CLIENT_9K10 } });
  } finally {
    await client.$disconnect();
  }
});

test("la fiche de la reprise affiche la machine, le contact et la référence client de l'origine (I6)", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(
    `/interventions/suites-a-donner/${suiteADonnerId}/replanifier`,
  );
  await expect(page).toHaveURL(/\/replanifier$/);

  await page
    .getByLabel(fr["suites_a_donner.replanifier.date"])
    .fill("2026-12-01");
  await page.getByLabel(fr["suites_a_donner.replanifier.duree"]).fill("60");
  await page
    .getByRole("button", {
      name: fr["suites_a_donner.replanifier.voir_creneaux"],
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: fr["suites_a_donner.replanifier.creneaux_titre"],
    }),
  ).toBeVisible();

  await page.locator('input[name="debut_minutes"]').first().check();
  await page
    .getByRole("button", { name: fr["suites_a_donner.replanifier.confirmer"] })
    .click();
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+\?motif=/);
  const match = /\/interventions\/([0-9a-f-]+)\?/.exec(page.url());
  nouvelleInterventionId = match?.[1] ?? "";
  expect(nouvelleInterventionId).not.toBe("");

  // I6 — LA MACHINE DE L'ORIGINE, RECOPIÉE (jamais « aucune choisie »).
  const tuileMachine = page.locator("section", {
    has: page.getByRole("heading", { name: fr["intervention.machine"] }),
  });
  await expect(
    tuileMachine.getByText(fr["intervention.machine.aucune_choisie"]),
  ).toHaveCount(0);
  await expect(tuileMachine.getByText(NUMERO_SERIE_9K10)).toBeVisible();

  // I6 — LE CONTACT ET LA RÉFÉRENCE CLIENT DE L'ORIGINE, RECOPIÉS.
  await expect(page.getByText(NOM_CONTACT_9K10)).toBeVisible();
  await expect(page.getByText(REFERENCE_CLIENT_9K10)).toBeVisible();
});
