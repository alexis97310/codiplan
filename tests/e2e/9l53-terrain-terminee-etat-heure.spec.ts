import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fuseauDeLAgence } from "@/lib/calendar/agence";
import { versLocal } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L53-TERRAIN-TERMINEE-ETAT-HEURE — m3 (partie sans conflit) : au terrain,
 * une intervention TERMINÉE affiche clairement son état (déjà vrai avant ce
 * lot, voir la passation) ET l'heure de fin du dernier segment de travail
 * fermé, au fuseau de l'agence (D5) — sur la carte de « Ma journée » et en
 * tête de la fiche.
 *
 * `date_planifiee: null` range la scène dans le panier « sans date » de
 * « Ma journée » (même choix que `9k27-terrain-terminer-ce-qui-manque`) :
 * la section utilise `Carte`, jamais `CarteApercu`, qui ne porte pas cette
 * ligne — et `prochaineAFaire` (`lib/terrain/tri-journee.ts`) exclut
 * explicitement `terminee`/`cloturee` de la tuile « À faire maintenant »,
 * donc aucun doublon de « Terminée à » n'est possible sur l'écran.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L53-TERRAIN-TERMINEE-ETAT-HEURE/captures",
);

async function capturer(
  page: import("@playwright/test").Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

type Scene = {
  readonly clientId: string;
  readonly siteId: string;
  readonly interventionId: string;
  readonly heureFinAttendue: string;
};

async function creerScene(
  client: PrismaClient,
  prefixe: string,
  statut: "terminee" | "cloturee",
): Promise<Scene> {
  const reperes = await reperesDeLaScene();
  const agence = await client.agence.findFirstOrThrow({
    where: { societe_id: reperes.societeId, code: "DUCOS" },
    select: {
      id: true,
      fuseau_horaire: true,
      societe: { select: { fuseau_horaire: true } },
    },
  });

  const clientId = uuidv7();
  await client.client.create({
    data: {
      id: clientId,
      societe_id: reperes.societeId,
      raison_sociale: `zz${prefixe} client terminee etat heure`,
      actif: true,
    },
  });

  const siteId = uuidv7();
  await client.site.create({
    data: {
      id: siteId,
      societe_id: reperes.societeId,
      client_id: clientId,
      agence_id: agence.id,
      libelle: `zz${prefixe} site terminee etat heure`,
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });

  const interventionId = uuidv7();
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
      statut,
      date_planifiee: null,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: `zz${prefixe}-terminee-etat-heure`,
      commentaire_technicien: "Intervention achevée.",
      // `temps_mesure_min` N'EST PAS POSÉ : ce que cette scène éprouve est la
      // FIN DU SEGMENT, jamais le total — et une CLÔTURÉE est TERMINALE
      // (D160), aucune mise à jour après coup ne passerait.
      cloturee_le: statut === "cloturee" ? new Date() : null,
      rapport_valide_par:
        statut === "cloturee" ? reperes.technicienDucos : null,
      rapport_valide_le: statut === "cloturee" ? new Date() : null,
    },
  });

  // UN SEGMENT FERMÉ — c'est sa fin que l'écran doit afficher.
  const debut = new Date(Date.UTC(2026, 10, 20, 19, 0, 0));
  const fin = new Date(Date.UTC(2026, 10, 20, 20, 30, 0));
  await client.segmentTravail.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      utilisateur_id: reperes.technicienDucos,
      nom_technicien_affiche: "Technicien de l'épreuve",
      debut,
      fin,
    },
  });

  const fuseau = fuseauDeLAgence(agence);
  const local = versLocal(fin, fuseau);
  const heureFinAttendue = `${String(local.heures).padStart(2, "0")}:${String(
    local.minutes,
  ).padStart(2, "0")}`;

  return { clientId, siteId, interventionId, heureFinAttendue };
}

async function nettoyer(client: PrismaClient, scene: Scene | null) {
  if (scene !== null) {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "notification" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.intervention.deleteMany({
      where: { id: scene.interventionId },
    });
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  }
  await client.$disconnect();
}

test("375 px, fiche terrain — une TERMINÉE affiche l'état en clair et l'heure de fin du dernier segment", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client, "9L53A", "terminee");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    await expect(
      page.getByText(fr["statut.terminee"], { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        `${fr["terrain.carte.termine_a"]} ${scene.heureFinAttendue}`,
      ),
    ).toBeVisible();

    await capturer(page, "fiche-terminee-apres", 375);
  } finally {
    await nettoyer(client, scene);
  }
});

test("375 px, Ma journée — la carte d'une TERMINÉE porte le même état et la même heure de fin", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client, "9L53B", "terminee");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto("/terrain");

    const carte = page.locator("li", {
      has: page.getByText(`zz9L53B client terminee etat heure`),
    });
    await expect(carte).toBeVisible();
    await expect(
      carte.getByText(fr["statut.terminee"], { exact: true }),
    ).toBeVisible();
    await expect(
      carte.getByText(
        `${fr["terrain.carte.termine_a"]} ${scene.heureFinAttendue}`,
      ),
    ).toBeVisible();

    await capturer(page, "ma-journee-terminee-apres", 375);
  } finally {
    await nettoyer(client, scene);
  }
});

test("375 px, fiche terrain — une CLÔTURÉE affiche aussi l'état et l'heure de fin", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client, "9L53C", "cloturee");

    await page.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto(`/terrain/${scene.interventionId}`);

    await expect(
      page.getByText(fr["statut.cloturee"], { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        `${fr["terrain.carte.termine_a"]} ${scene.heureFinAttendue}`,
      ),
    ).toBeVisible();
  } finally {
    await nettoyer(client, scene);
  }
});
