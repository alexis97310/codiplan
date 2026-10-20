import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { FORFAITS_SCENE, COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * CONSTATS 4 ET 5 DE L'AUDIT FONCTIONNEL 9F5 (`docs/audits/9F5-fonctionnel/
 * rapport.md`) — trois champs sans nom accessible : le sélecteur de zone
 * d'un forfait de déplacement, et les deux champs du formulaire d'ajout
 * d'une photo terrain (fichier, légende).
 *
 * **SA PROPRE FICHE, jamais `SCENE.rapportVierge`** — ce fixture-là est
 * ÉCRITE en SQL brut par `rapport-terrain.spec.ts` (son statut y passe à
 * `terminee`) ; la lire ici romprait exactement la garde que
 * `tests/unit/e2e-donnees-partagees.test.ts` tient (§9, pas de lecture d'une
 * fixture SCENE.x que d'autres fichiers écrivent). Une fiche jetable, créée
 * et effacée par ce fichier seul, suffit : seul le nom accessible du champ
 * compte ici, jamais l'état de l'intervention.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test("le sélecteur de zone de la fiche d'un forfait de déplacement a un nom accessible", async ({
  page,
}) => {
  const forfaitDeplacement = FORFAITS_SCENE.find(
    (forfait) => forfait.code === "EPR-DEP-B",
  );
  if (forfaitDeplacement === undefined) {
    throw new Error("la scène ne porte plus le forfait EPR-DEP-B attendu");
  }

  await ouvrirLaSessionSensible(page, "adv@codima.test");
  await page.goto(`/parametres/forfaits/${forfaitDeplacement.id}`);

  // `getByLabel` SEUL est ambigu sur cette page : une autre liste porte un
  // nom qui COMMENCE par le même texte (« Zone géographique — Toutes les… »,
  // le filtre de « Conditions tarifaires »). Le sélecteur visé ici est
  // identifié par son `id` (`zone-forfait`), et c'est SON nom accessible
  // EXACT qu'on vérifie — la preuve que `htmlFor`/`id` le lient bien.
  const selecteurDeZone = page.locator("#zone-forfait");
  await expect(selecteurDeZone).toBeVisible();
  await expect(selecteurDeZone).toHaveAccessibleName(fr["forfaits.zone"]);
});

test("les champs du formulaire « ajouter une photo » ont chacun un nom accessible", async ({
  page,
}) => {
  const client = admin();
  let id = "";
  try {
    const reperes = await reperesDeLaScene();
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence: { code: "DUCOS" } },
      select: { id: true, client_id: true, agence_id: true },
      orderBy: { libelle: "asc" },
    });
    id = uuidv7();
    const jour = `${String(reperes.lundi.annee).padStart(4, "0")}-${String(
      reperes.lundi.mois,
    ).padStart(2, "0")}-${String(reperes.lundi.jour).padStart(2, "0")}`;
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: site.agence_id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "affectee",
        date_planifiee: new Date(`${jour}T00:00:00.000Z`),
        creneau_debut: new Date(`${jour}T08:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "zz9F5B-noms-accessibles — photo",
      },
    });

    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${id}`);

    await expect(page.getByLabel(fr["terrain.photos.fichier"])).toBeVisible();
    await expect(page.getByLabel(fr["terrain.photos.libelle"])).toBeVisible();
  } finally {
    if (id !== "") {
      await client.intervention.deleteMany({ where: { id } });
    }
    await client.$disconnect();
  }
});
