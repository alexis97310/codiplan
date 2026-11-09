import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9K11-LIBELLES-SUITES-ITINERAIRE, point 3 — LE BOUTON « ITINÉRAIRE » DE LA
 * FICHE TERRAIN.
 *
 * Sa propre fiche jetable (client, site à ADRESSE connue, intervention),
 * jamais une lecture de `SCENE.*` qu'un autre fichier écrit (§9) — seule
 * l'adresse compte ici, aucun autre champ de la fiche.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const ADRESSE_RUE = "12 rue des Palétuviers";
const ADRESSE_COMMUNE = "Nouméa";

test("375 px — le bouton « Itinéraire » porte un lien `geo:` avec l'adresse du site encodée", async ({
  page,
}) => {
  const client = admin();
  let clientId = "";
  let siteId = "";
  let interventionId = "";
  try {
    const reperes = await reperesDeLaScene();
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    clientId = uuidv7();
    await client.client.create({
      data: {
        id: clientId,
        societe_id: reperes.societeId,
        raison_sociale: "zz9K11 client itinéraire",
        actif: true,
      },
    });

    siteId = uuidv7();
    await client.site.create({
      data: {
        id: siteId,
        societe_id: reperes.societeId,
        client_id: clientId,
        agence_id: agence.id,
        libelle: "zz9K11 site itinéraire",
        adresse: { rue: ADRESSE_RUE },
        commune: ADRESSE_COMMUNE,
      },
    });

    interventionId = uuidv7();
    const jour = `${String(reperes.lundi.annee).padStart(4, "0")}-${String(
      reperes.lundi.mois,
    ).padStart(2, "0")}-${String(reperes.lundi.jour).padStart(2, "0")}`;
    await client.intervention.create({
      data: {
        id: interventionId,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: clientId,
        site_id: siteId,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "affectee",
        date_planifiee: new Date(`${jour}T00:00:00.000Z`),
        creneau_debut: new Date(`${jour}T08:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9K11-itineraire-terrain",
      },
    });

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${interventionId}`);

    const lien = page.getByRole("link", { name: fr["terrain.itineraire"] });
    await expect(lien).toBeVisible();
    expect(await lien.getAttribute("href")).toBe(
      `geo:0,0?q=${encodeURIComponent(`${ADRESSE_RUE}, ${ADRESSE_COMMUNE}`)}`,
    );
  } finally {
    if (interventionId !== "") {
      await client.intervention.deleteMany({ where: { id: interventionId } });
    }
    if (siteId !== "") {
      await client.site.deleteMany({ where: { id: siteId } });
    }
    if (clientId !== "") {
      await client.client.deleteMany({ where: { id: clientId } });
    }
    await client.$disconnect();
  }
});
