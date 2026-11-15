import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { cliquerTerminer } from "./setup/terrain-gestes";

/**
 * 9L06-COMPTEUR-MINUTE-COMMENCEE — constat d'Alexis du 10/11/2026 : « Terminer »
 * affiche un temps final de 0, qu'un compteur ait tourné moins d'une minute OU
 * plus d'une minute. Voir `docs/arbitrages.md` D256 et
 * `docs/propositions/9L06-COMPTEUR-MINUTE-COMMENCEE/passation.md` pour ce que
 * ce lot corrige, et ce qu'il NE corrige PAS faute de mandat pour migrer.
 *
 * ## CE QUE CE FICHIER ÉPROUVE
 *
 * Trois scénarios, ATTENTE RÉELLE (pas une horloge de navigateur avancée : le
 * premier essai EN LIGNE d'un geste compteur/terminer ignore `instant_appareil`
 * — `depuis_file` absent, voir `app/api/terrain/[id]/compteur/route.ts` — et
 * s'écrit à l'heure DU SERVEUR, que `page.clock` ne touche jamais).
 *
 * **EN LIGNE, un compteur continu de plus de 2 minutes** ne mesure PAS zéro
 * (ni en base, ni à l'écran) : ce premier scénario établit que la troncature
 * de `mesurer` ne peut PAS, seule, produire un « 0 » pour plus d'une minute —
 * `Math.floor` d'un nombre de secondes ≥ 60 ne rend jamais 0. Cette
 * troncature RESTE (D256 : la corriger exigerait de migrer le déclencheur SQL
 * qui garde `temps_mesure_min`, hors mandat de ce lot) — mais elle n'explique
 * donc pas, seule, le constat d'Alexis pour un compteur de plus d'une minute.
 *
 * **HORS RÉSEAU, le MÊME compteur continu** révèle le second défaut, RÉEL ET
 * CORRIGÉ PAR CE LOT : la feuille de confirmation de « Terminer » affichait
 * « Temps mesuré : 0 min » — jamais le compteur qui défile — dès qu'une
 * coupure survenait APRÈS un geste compteur réussi EN LIGNE et AVANT toute
 * écriture dans la file. `RapportTerrainAutomatique` ne relisait
 * `segmentOuvertConnu`/`minutesConnues` qu'au montage et sur
 * `EVENEMENT_FILE_MODIFIEE` — jamais quand ces PROPS changent par un simple
 * `router.refresh()` (ce qu'un « Démarrer » EN LIGNE déclenche). Corrigé en
 * ajoutant ces deux props aux dépendances de l'effet qui relit la file.
 * **Ce défaut ne touchait que l'AFFICHAGE** : le temps réellement persisté
 * restait correct (le serveur referme le segment ouvert et mesure sur les
 * VRAIS segments, indépendamment de ce que l'écran montrait) — ce scénario le
 * vérifie aussi, en base, après l'envoi.
 *
 * **HORS RÉSEAU, trois pauses/reprises courtes** rejouent la RÉGRESSION
 * corrigée dans `mesureCompteurDeLaFile` : avant ce lot, chaque cycle
 * démarrer/arrêter était arrondi À PART, et la feuille de confirmation
 * affichait « 0 min » pour un total pourtant supérieur à une minute pleine.
 * Capturé AVANT/APRÈS la correction.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L06-COMPTEUR-MINUTE-COMMENCEE/captures",
);

async function capturer(
  page: Page,
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
};

async function creerScene(
  client: PrismaClient,
  prefixe: string,
  societeId: string,
  agenceId: string,
  technicienId: string,
): Promise<Scene> {
  const clientId = uuidv7();
  await client.client.create({
    data: {
      id: clientId,
      societe_id: societeId,
      raison_sociale: `zz${prefixe} client minute commencée`,
      actif: true,
    },
  });
  const siteId = uuidv7();
  await client.site.create({
    data: {
      id: siteId,
      societe_id: societeId,
      client_id: clientId,
      agence_id: agenceId,
      libelle: `zz${prefixe} site minute commencée`,
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });
  const interventionId = uuidv7();
  await client.intervention.create({
    data: {
      id: interventionId,
      societe_id: societeId,
      agence_id: agenceId,
      client_id: clientId,
      site_id: siteId,
      technicien_id: technicienId,
      type: "curatif",
      priorite: "p3",
      statut: "affectee",
      date_planifiee: null,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: `zz${prefixe}-compteur-minute-commencee`,
    },
  });
  return { clientId, siteId, interventionId };
}

async function nettoyer(client: PrismaClient, scene: Scene): Promise<void> {
  await client.$executeRawUnsafe(
    `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
    scene.interventionId,
  );
  await client.$executeRawUnsafe(
    `DELETE FROM "intervention_signature" WHERE "intervention_id" = $1::uuid`,
    scene.interventionId,
  );
  await client.$executeRawUnsafe(
    `DELETE FROM "notification" WHERE "intervention_id" = $1::uuid`,
    scene.interventionId,
  );
  await client.intervention.deleteMany({ where: { id: scene.interventionId } });
  await client.site.deleteMany({ where: { id: scene.siteId } });
  await client.client.deleteMany({ where: { id: scene.clientId } });
}

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

/** Rapport minimal (commentaire + signature), sans checklist — seul le temps est éprouvé ici. */
async function remplirCeQuiEstExigeHorsTemps(page: Page): Promise<void> {
  await page
    .getByLabel(fr["terrain.rapport.commentaire_libelle"])
    .fill("zz9L06 Intervention réalisée.");
  await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).blur();
  await page
    .getByRole("button", { name: fr["terrain.signature.option_absent"] })
    .click();
  await page
    .getByLabel(fr["terrain.signature.motif_libelle"])
    .fill("zz9L06 client injoignable");
  await page.getByLabel(fr["terrain.signature.motif_libelle"]).blur();
}

const DEUX_MINUTES_DIX = 130_000;

test("EN LIGNE — compteur de plus de 2 minutes (attente réelle) : le temps final n'est pas 0", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const client = admin();
  let scene: Scene | null = null;
  try {
    const reperes = await reperesDeLaScene();
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    scene = await creerScene(
      client,
      "9L06A",
      reperes.societeId,
      agence.id,
      reperes.technicienDucos,
    );

    await page.setViewportSize({ width: 375, height: 900 });
    await connecterLeTechnicien(page);
    await page.goto(`/terrain/${scene.interventionId}`);

    await page
      .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
      .click();
    await expect(
      page.getByRole("button", { name: fr["terrain.compteur.pause"] }),
    ).toBeVisible();

    await page.waitForTimeout(DEUX_MINUTES_DIX);

    await remplirCeQuiEstExigeHorsTemps(page);
    await cliquerTerminer(page);
    await expect(page).toHaveURL(
      new RegExp(`/terrain/${scene.interventionId}$`),
    );
    await expect(
      page.getByText(fr["statut.terminee"], { exact: true }),
    ).toBeVisible();

    const rubriqueCompteur = page.locator("section").filter({
      has: page.getByRole("heading", { name: fr["terrain.compteur"] }),
    });
    await expect(rubriqueCompteur.getByText(/^0 min$/)).toHaveCount(0);

    const verif = admin();
    try {
      const ligne = await verif.intervention.findUniqueOrThrow({
        where: { id: scene.interventionId },
        select: { temps_mesure_min: true },
      });
      expect(ligne.temps_mesure_min).not.toBe(0);
      expect(ligne.temps_mesure_min).toBeGreaterThanOrEqual(2);
    } finally {
      await verif.$disconnect();
    }

    await capturer(page, "en-ligne-plus-de-2min-termine", 375);
    await capturer(page, "en-ligne-plus-de-2min-termine", 1280);
  } finally {
    if (scene !== null) {
      await nettoyer(client, scene);
    }
    await client.$disconnect();
  }
});

test("HORS RÉSEAU — compteur de plus de 2 minutes (attente réelle), mis en file puis envoyé : le temps final n'est pas 0", async ({
  page,
  context,
}) => {
  test.setTimeout(300_000);
  const client = admin();
  let scene: Scene | null = null;
  try {
    const reperes = await reperesDeLaScene();
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    scene = await creerScene(
      client,
      "9L06B",
      reperes.societeId,
      agence.id,
      reperes.technicienDucos,
    );

    await page.setViewportSize({ width: 375, height: 900 });
    await connecterLeTechnicien(page);
    await page.goto(`/terrain/${scene.interventionId}`);

    // DÉMARRÉ EN LIGNE (segment réel, heure du serveur) — la coupure survient
    // PENDANT que le compteur tourne, cas ordinaire du terrain.
    await page
      .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
      .click();
    await expect(
      page.getByRole("button", { name: fr["terrain.compteur.pause"] }),
    ).toBeVisible();

    await context.setOffline(true);

    await page.waitForTimeout(DEUX_MINUTES_DIX);

    await page
      .getByRole("button", { name: fr["terrain.terminer.bouton"] })
      .click();
    // M3 — le temps défile encore (segment ouvert), jamais une valeur figée.
    await expect(
      page.getByText(
        new RegExp(
          `${fr["terrain.terminer.confirmation.temps"]} \\d{2}:\\d{2}:\\d{2}`,
        ),
      ),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: fr["terrain.terminer.confirmation.non"],
        exact: true,
      })
      .click();

    await remplirCeQuiEstExigeHorsTemps(page);
    await cliquerTerminer(page);
    await expect(
      page.getByText(fr["terrain.terminer.en_attente_envoi"]),
    ).toBeVisible();

    await capturer(page, "hors-reseau-plus-de-2min-en-attente", 375);

    await context.setOffline(false);
    await page.goto("/terrain");
    await page
      .getByRole("button", { name: fr["terrain.file.envoyer"] })
      .click();
    await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

    const verif = admin();
    try {
      const ligne = await verif.intervention.findUniqueOrThrow({
        where: { id: scene.interventionId },
        select: { temps_mesure_min: true, statut: true },
      });
      expect(ligne.statut).toBe("terminee");
      expect(ligne.temps_mesure_min).not.toBe(0);
      expect(ligne.temps_mesure_min).toBeGreaterThanOrEqual(2);
    } finally {
      await verif.$disconnect();
    }

    await page.goto(`/terrain/${scene.interventionId}`);
    const rubriqueCompteur = page.locator("section").filter({
      has: page.getByRole("heading", { name: fr["terrain.compteur"] }),
    });
    await expect(rubriqueCompteur.getByText(/^0 min$/)).toHaveCount(0);

    await capturer(page, "hors-reseau-plus-de-2min-termine", 375);
    await capturer(page, "hors-reseau-plus-de-2min-termine", 1280);
  } finally {
    if (scene !== null) {
      await nettoyer(client, scene);
    }
    await client.$disconnect();
  }
});

test("HORS RÉSEAU — trois pauses/reprises courtes (75 s au total) : la feuille de confirmation n'affiche plus 0 min (capture AVANT/APRÈS la correction)", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const client = admin();
  let scene: Scene | null = null;
  try {
    const reperes = await reperesDeLaScene();
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    scene = await creerScene(
      client,
      "9L06C",
      reperes.societeId,
      agence.id,
      reperes.technicienDucos,
    );

    await page.setViewportSize({ width: 375, height: 900 });
    await connecterLeTechnicien(page);
    await page.goto(`/terrain/${scene.interventionId}`);

    await context.setOffline(true);

    // TROIS CYCLES DÉMARRER/ARRÊTER DE 25 S CHACUN (75 S AU TOTAL) — AVANT ce
    // lot, `mesureCompteurDeLaFile` arrondissait chaque cycle À PART
    // (`Math.floor(25 s / 60 s) === 0`) : la feuille de confirmation
    // affichait « 0 min » pour un total pourtant supérieur à une minute
    // pleine. Trois cycles, pas un seul : un unique cycle de 75 s mesurerait
    // 1 minute même AVANT la correction (bug (a) initial, hors de ce
    // scénario — voir l'en-tête du fichier).
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page
        .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
        .click();
      await expect(
        page.getByRole("button", { name: fr["terrain.compteur.pause"] }),
      ).toBeVisible();
      await page.waitForTimeout(25_000);
      await page
        .getByRole("button", { name: fr["terrain.compteur.pause"] })
        .click();
      // HORS RÉSEAU, LA SAISIE SE GARDE EN FILE (pas de « Reprendre » — ce
      // libellé ne vient QUE de la vérité SERVEUR, jamais rejoué après une
      // saisie locale ; voir `libelleDuBouton`, `compteur-terrain.tsx`) : le
      // bouton redevient « Démarrer » pour le cycle suivant.
      await expect(
        page.getByRole("button", { name: fr["terrain.compteur.demarrer"] }),
      ).toBeVisible();
    }

    await page
      .getByRole("button", { name: fr["terrain.terminer.bouton"] })
      .click();
    const ligneTemps = page.getByText(/^Temps mesuré : /);
    await expect(ligneTemps).toBeVisible();
    await capturer(page, "trois-pauses-courtes-feuille-confirmation", 375);
    await capturer(page, "trois-pauses-courtes-feuille-confirmation", 1280);
    // AVANT la correction : « Temps mesuré : 0 min ». APRÈS : « Temps mesuré
    // : 1 min » (75 s tronquées sur le TOTAL, jamais segment par segment).
    await expect(page.getByText(/^Temps mesuré : 0 min$/)).toHaveCount(0);
    await expect(page.getByText(/^Temps mesuré : 1 min$/)).toBeVisible();

    await page
      .getByRole("button", {
        name: fr["terrain.terminer.confirmation.non"],
        exact: true,
      })
      .click();
    await remplirCeQuiEstExigeHorsTemps(page);
    await cliquerTerminer(page);
    await expect(
      page.getByText(fr["terrain.terminer.en_attente_envoi"]),
    ).toBeVisible();

    await context.setOffline(false);
    await page.goto("/terrain");
    await page
      .getByRole("button", { name: fr["terrain.file.envoyer"] })
      .click();
    await expect(page.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

    const verif = admin();
    try {
      const ligne = await verif.intervention.findUniqueOrThrow({
        where: { id: scene.interventionId },
        select: { temps_mesure_min: true },
      });
      expect(ligne.temps_mesure_min).toBe(1);
    } finally {
      await verif.$disconnect();
    }
  } finally {
    if (scene !== null) {
      await nettoyer(client, scene);
    }
    await client.$disconnect();
  }
});
