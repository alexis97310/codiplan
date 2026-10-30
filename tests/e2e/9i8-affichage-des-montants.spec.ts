import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE, COMPTE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9I8-AFFICHAGE-DES-MONTANTS — l'onglet Valorisation ne disparaît plus
 * (audit en équipe du 28/10/2026, constat M1).
 *
 * ## LE BOGUE MESURÉ
 *
 * `fiche.valorisation !== null && fiche.devise !== null` masquait TOUT le
 * composant `Valorisation` — titre et motif compris — tant qu'une
 * intervention n'était pas clôturée, et aussi sur une clôturée dont le taux
 * historique n'est plus lisible à sa date. *Un bloc absent se lirait « cette
 * intervention n'a pas de montant »*, exactement ce que le motif de D88
 * existe pour éviter — et il ne pouvait pas s'afficher, puisque le composant
 * qui le porte ne montait jamais.
 *
 * ## SA PROPRE SCÈNE
 *
 * Un client, un site (agence Ducos), deux interventions créées directement
 * en base (comme `9eq-fiche-intervention.spec.ts`) : l'une `en_cours`
 * (jamais clôturée, `temps_valide_min` reste `null`), l'autre `cloturee`
 * avec une date bien avant le seul `taux_horaire` du semis (`date_effet`
 * 2020-01-01, posé par `tests/e2e/setup/scene.ts`) — `tauxEnVigueur` n'y
 * trouve rien, et `depot.ts` laisse `valorisation` à `null` même après
 * clôture. Les deux déclencheurs de cycle de vie (`intervention_cycle_de_vie`,
 * `pas_sur_blocage_agenda`) sont `BEFORE/AFTER UPDATE` : une ligne insérée
 * DÉJÀ `cloturee` ne les traverse jamais.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9I8 = uuidv7();
const SITE_9I8 = uuidv7();
const INTERVENTION_EN_COURS = uuidv7();
const INTERVENTION_CLOTUREE_SANS_TAUX = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9I8,
        societe_id: reperes.societeId,
        raison_sociale: fr["9i8.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9I8,
        societe_id: reperes.societeId,
        client_id: CLIENT_9I8,
        agence_id: agence.id,
        libelle: fr["9i8.e2e.lieu"],
      },
    });

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
          "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'en_cours', '2026-11-24T00:00:00Z', 60, $6::uuid, 'XPF', now())`,
      INTERVENTION_EN_COURS,
      reperes.societeId,
      CLIENT_9I8,
      SITE_9I8,
      agence.id,
      reperes.technicienDucos,
    );

    // LA DATE PRÉCÈDE DE VINGT ANS LE SEUL TAUX DU SEMIS (2020-01-01) —
    // `tauxEnVigueur` n'y trouve rien, délibérément.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
          "temps_valide_min", "temps_valide_par", "temps_valide_le",
          "cloturee_le", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'cloturee', '2000-01-01T00:00:00Z', 60, $6::uuid,
               90, $6::uuid, now(), now(), 'XPF', now())`,
      INTERVENTION_CLOTUREE_SANS_TAUX,
      reperes.societeId,
      CLIENT_9I8,
      SITE_9I8,
      agence.id,
      reperes.technicienDucos,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9I8,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9I8 } });
    await client.client.deleteMany({ where: { id: CLIENT_9I8 } });
  } finally {
    await client.$disconnect();
  }
});

test("une intervention en_cours, en ADV : le bloc ne disparaît plus — « pas encore valorisée »", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
  await page.goto(
    `/interventions/${INTERVENTION_EN_COURS}?onglet=valorisation`,
  );
  await expect(
    page.getByRole("heading", { name: fr["intervention.cloture.facture"] }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.valorisation.pas_encore"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.cloture.total"], { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toHaveCount(0);
});

test("la même en_cours, en admin_societe : le motif D37 habituel, pas « pas encore »", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto(
    `/interventions/${INTERVENTION_EN_COURS}?onglet=valorisation`,
  );
  await expect(
    page.getByRole("heading", { name: fr["intervention.cloture.facture"] }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.valorisation.pas_encore"]),
  ).toHaveCount(0);
});

test("une clôturée sans taux en vigueur à sa date, en ADV : « total inconnu », jamais « pas encore »", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
  await page.goto(
    `/interventions/${INTERVENTION_CLOTUREE_SANS_TAUX}?onglet=valorisation`,
  );
  await expect(
    page.getByRole("heading", { name: fr["intervention.cloture.facture"] }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.valorisation.total_inconnu"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.valorisation.pas_encore"]),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toHaveCount(0);
});
