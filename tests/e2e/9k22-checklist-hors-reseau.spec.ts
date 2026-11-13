import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9K22-CHECKLIST-HORS-RESEAU — CK6, mode avion : DEUX APPAREILS de la MÊME
 * identité technicien, sur la MÊME intervention, chacun répond hors réseau
 * à un point d'une version DIFFÉRENTE de la checklist.
 *
 * ## POURQUOI DEUX APPAREILS DE LA MÊME IDENTITÉ, ET NON DEUX COMPTES
 *
 * L'écriture d'une réponse checklist juge `accesSurCetteIntervention(...,
 * "saisir_rapport", intervention.technicien_id)` (`lib/checklists/depot.ts`,
 * `enregistrerReponses`) — restreint au SEUL technicien affecté (D151,
 * `tests/isolation/9dc-renfort-saisir-rapport.test.ts` : « le renfort
 * pointe, il n'écrit pas le rapport d'autrui »). Deux COMPTES différents
 * donneraient donc au second un refus D'ACCÈS, jamais `checklist.refus.
 * point_hors_version` — le motif que CE ticket demande d'éprouver. La seule
 * façon d'obtenir ce refus précis EN GARDANT l'accès valide est que les deux
 * appareils portent la MÊME identité (deux sessions indépendantes du même
 * compte, exactement ce qu'un technicien avec un téléphone ET une tablette
 * ferait).
 *
 * SÉRIEL, même raison que `9k21-checklist-terrain-saisie.spec.ts` : un modèle
 * GÉNÉRIQUE (sans rattachement) s'applique à toute intervention de la
 * société.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9K22-CHECKLIST-HORS-RESEAU/captures",
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
  readonly modeleId: string | null;
};

async function creerInterventionEnCours(
  client: PrismaClient,
  prefixe: string,
): Promise<Scene> {
  const reperes = await reperesDeLaScene();
  const agence = await client.agence.findFirstOrThrow({
    where: { societe_id: reperes.societeId, code: "DUCOS" },
    select: { id: true },
  });

  const clientId = uuidv7();
  await client.client.create({
    data: {
      id: clientId,
      societe_id: reperes.societeId,
      raison_sociale: `zz${prefixe} client checklist hors réseau`,
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
      libelle: `zz${prefixe} site checklist hors réseau`,
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
      statut: "en_cours",
      // SANS DATE (« file d'attente ») — `/api/terrain/instantane` ne lit
      // les lignes DATÉES que dans une fenêtre [aujourd'hui, +8 jours[
      // (`listerPlanning`) ; `reperes.lundi` (utilisé par
      // `9k21-checklist-terrain-saisie.spec.ts`, qui lit la fiche
      // DIRECTEMENT et ignore cette fenêtre) tomberait hors champ un jour
      // sur sept. Sans date, la ligne rejoint `sansDate`, TOUJOURS incluse.
      date_planifiee: null,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: `zz${prefixe}-checklist-hors-reseau`,
    },
  });

  return { clientId, siteId, interventionId, modeleId: null };
}

/** UN MODÈLE GÉNÉRIQUE, UNE PREMIÈRE VERSION — un seul point. */
async function creerModeleEtV1(
  client: PrismaClient,
  societeId: string,
  prefixe: string,
  libellePoint: string,
): Promise<{
  readonly modeleId: string;
  readonly libelleModele: string;
  readonly versionId: string;
  readonly pointId: string;
}> {
  const modeleId = uuidv7();
  const libelleModele = `zz${prefixe} checklist générique`;
  await client.checklistModele.create({
    data: {
      id: modeleId,
      societe_id: societeId,
      code: `ZZ${prefixe}-GENERIQUE`,
      libelle: libelleModele,
      actif: true,
    },
  });
  const versionId = uuidv7();
  await client.checklistVersion.create({
    data: {
      id: versionId,
      societe_id: societeId,
      checklist_modele_id: modeleId,
      numero: 1,
    },
  });
  const pointId = uuidv7();
  await client.checklistPoint.create({
    data: {
      id: pointId,
      societe_id: societeId,
      checklist_version_id: versionId,
      section: "Sécurité",
      ordre: 1,
      libelle: libellePoint,
      obligatoire: false,
      type_reponse: "conforme_non_conforme_sans_objet",
    },
  });
  return { modeleId, libelleModele, versionId, pointId };
}

/**
 * UNE SECONDE VERSION DU MÊME MODÈLE — simule l'atelier qui republie un
 * gabarit (9K19) pendant qu'un appareil est déjà hors réseau avec la
 * version PRÉCÉDENTE. `numero` strictement supérieur : `dernierVersionPubliee`
 * (`lib/checklists/depot.ts`) ne connaît que l'ordre des numéros, jamais
 * l'instant de création.
 */
async function creerV2(
  client: PrismaClient,
  societeId: string,
  modeleId: string,
  libellePoint: string,
): Promise<{ readonly versionId: string; readonly pointId: string }> {
  const versionId = uuidv7();
  await client.checklistVersion.create({
    data: {
      id: versionId,
      societe_id: societeId,
      checklist_modele_id: modeleId,
      numero: 2,
    },
  });
  const pointId = uuidv7();
  await client.checklistPoint.create({
    data: {
      id: pointId,
      societe_id: societeId,
      checklist_version_id: versionId,
      section: "Sécurité",
      ordre: 1,
      libelle: libellePoint,
      obligatoire: false,
      type_reponse: "conforme_non_conforme_sans_objet",
    },
  });
  return { versionId, pointId };
}

async function nettoyer(client: PrismaClient, scene: Scene | null) {
  if (scene !== null) {
    await client.intervention.deleteMany({
      where: { id: scene.interventionId },
    });
    if (scene.modeleId !== null) {
      await client.checklistVersion.deleteMany({
        where: { checklist_modele_id: scene.modeleId },
      });
      await client.checklistModele.deleteMany({
        where: { id: scene.modeleId },
      });
    }
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  }
  await client.$disconnect();
}

async function repondreAuPremierPointHorsReseau(
  page: Page,
  interventionId: string,
): Promise<void> {
  await page.goto(`/terrain-hors-reseau?id=${interventionId}`);
  // PLUS DE BOUTON « AFFICHER LE DÉTAIL » (9L04D, point 1) — la checklist
  // est toujours ouverte.
  await page
    .getByRole("button", {
      name: fr["checklist.terrain.option_conforme"],
      exact: true,
    })
    .click();
}

test("mode avion : deux appareils de la même identité, aucune réponse perdue, un point hors version refusé en clair", async ({
  browser,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  let contexteA: Awaited<ReturnType<typeof browser.newContext>> | null = null;
  let contexteB: Awaited<ReturnType<typeof browser.newContext>> | null = null;
  try {
    const base = await creerInterventionEnCours(client, "9K22A");
    const societeId = (await reperesDeLaScene()).societeId;
    const v1 = await creerModeleEtV1(
      client,
      societeId,
      "9K22A",
      "Pression des pneus",
    );
    scene = { ...base, modeleId: v1.modeleId };

    // ── APPAREIL A : SYNCHRONISE EN LIGNE PENDANT QUE V1 EST LA SEULE VERSION ──
    contexteA = await browser.newContext();
    const pageA = await contexteA.newPage();
    await pageA.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(pageA, COMPTE_TECHNICIEN_EPREUVE);
    await pageA.goto(`/terrain/${scene.interventionId}`);
    await pageA.waitForResponse(
      (r) => r.url().includes("/api/terrain/instantane") && r.ok(),
    );
    // L'ÉCRITURE INDEXEDDB SUIT LA RÉPONSE HTTP (`ecrireCopieEnRemplacantLidentite`,
    // asynchrone) — une marge courte lui laisse le temps de se poser avant
    // que le contexte ne passe hors réseau.
    await pageA.waitForTimeout(300);

    // ── L'ATELIER REPUBLIE UNE V2 — APPAREIL A NE L'A JAMAIS VUE ──────────
    const v2 = await creerV2(client, societeId, v1.modeleId, "Niveau d'huile");

    // ── APPAREIL B : SYNCHRONISE EN LIGNE APRÈS LA REPUBLICATION (V2) ─────
    contexteB = await browser.newContext();
    const pageB = await contexteB.newPage();
    await pageB.setViewportSize({ width: 375, height: 900 });
    await ouvrirLaSessionSensible(pageB, COMPTE_TECHNICIEN_EPREUVE);
    await pageB.goto(`/terrain/${scene.interventionId}`);
    await pageB.waitForResponse(
      (r) => r.url().includes("/api/terrain/instantane") && r.ok(),
    );
    await pageB.waitForTimeout(300);

    // ── MODE AVION, LES DEUX APPAREILS, CHACUN SON POINT ──────────────────
    await contexteA.setOffline(true);
    await repondreAuPremierPointHorsReseau(pageA, scene.interventionId);
    await capturer(pageA, "hors-reseau-checklist-depliee", 375);
    await capturer(pageA, "hors-reseau-checklist-depliee", 1280);

    await contexteB.setOffline(true);
    await repondreAuPremierPointHorsReseau(pageB, scene.interventionId);

    // ── LE RÉSEAU REVIENT POUR LES DEUX APPAREILS ─────────────────────────
    await contexteA.setOffline(false);
    await contexteB.setOffline(false);

    // B (la version COURANTE) envoie sans accroc.
    await pageB.goto("/terrain");
    await pageB
      .getByRole("button", { name: fr["terrain.file.envoyer"] })
      .click();
    await expect(pageB.getByText(fr["terrain.file.tout_envoye"])).toBeVisible();

    // A (la version PÉRIMÉE) est refusé EN CLAIR, jamais effacé en silence.
    await pageA.goto("/terrain");
    await pageA
      .getByRole("button", { name: fr["terrain.file.envoyer"] })
      .click();
    const refus = pageA.getByText(fr["checklist.refus.point_hors_version"]);
    await expect(refus).toBeVisible();
    await expect(pageA.getByText(fr["terrain.file.tout_envoye"])).toHaveCount(
      0,
    );
    await capturer(pageA, "hors-reseau-refus-point-hors-version", 375);
    await capturer(pageA, "hors-reseau-refus-point-hors-version", 1280);

    // LA SAISIE DE A RESTE EN FILE (I5) — un second passage par « Ma
    // journée » la montre encore, elle n'a pas disparu au premier rendu.
    await pageA.reload();
    await expect(refus).toBeVisible();

    // ── LA VÉRITÉ EN BASE : UNE SEULE RÉPONSE, CELLE DE LA VERSION FIGÉE ──
    const reponses = await client.checklistReponse.findMany({
      where: { intervention_id: scene.interventionId },
    });
    expect(reponses).toHaveLength(1);
    expect(reponses[0].checklist_point_id).toBe(v2.pointId);
    expect(reponses[0].valeur_conforme).toBe("conforme");

    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: scene.interventionId },
      select: { checklist_version_id: true },
    });
    expect(ligne.checklist_version_id).toBe(v2.versionId);
  } finally {
    await contexteA?.close();
    await contexteB?.close();
    await nettoyer(client, scene);
  }
});
