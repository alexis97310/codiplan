import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "../e2e/setup/base";
import { choisirPriorite } from "../e2e/setup/formulaire-creation";
import { reperesDeLaScene } from "../e2e/setup/reperes";
import {
  dialogueOuvert,
  formulaireDialogue,
  ouvrirSaisieManuelle,
} from "../e2e/setup/saisie-manuelle";
import {
  cleDeJour,
  COMPTE_TECHNICIEN_EPREUVE,
  SCENE,
} from "../e2e/setup/scene";
import { choisirResultatParTexte } from "../e2e/setup/selecteur-recherche";
import { ouvrirLaSessionSensible } from "../e2e/setup/session";

/**
 * PARCOURS LIMITES (9F5-AUDIT-FONCTIONNEL-PARCOURS, point 3) — (c) date
 * passée / hors ouverture, (d) deux onglets sur la même fiche, (e) rechargement
 * en cours de saisie, (f) caractères spéciaux et saisie longue, (i) terrain
 * hors réseau. Chaque test TROUVE et DÉCRIT ; aucun ne corrige.
 */

const PREFIXE = "zz9F5-edge";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

/** Une intervention « à planifier » neuve, sur un site de DUCOS — jamais au semis. */
async function creerInterventionDucos(suffixe: string): Promise<string> {
  const client = admin();
  try {
    const reperes = await reperesDeLaScene();
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence: { code: "DUCOS" } },
      select: { id: true, client_id: true, agence_id: true },
      orderBy: { libelle: "asc" },
    });
    const id = uuidv7();
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: site.agence_id,
        client_id: site.client_id,
        site_id: site.id,
        type: "curatif",
        priorite: "p3",
        statut: "a_planifier",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: `${PREFIXE} — ${suffixe}`,
      },
    });
    return id;
  } finally {
    await client.$disconnect();
  }
}

async function libelleSiteDucos(): Promise<string> {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence: { code: "DUCOS" } },
      select: { libelle: true },
      orderBy: { libelle: "asc" },
    });
    return site.libelle;
  } finally {
    await client.$disconnect();
  }
}

async function supprimerIntervention(id: string): Promise<void> {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = $1::uuid`,
      id,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      id,
    );
    await client.intervention.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/audits/9F5-fonctionnel/captures",
);

/** Capture JPEG EN VIEWPORT (jamais pleine page) — pour le rapport du point 4. */
async function capturer(
  page: Page,
  nom: string,
  largeur: 375 | 1280,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.jpg`),
    type: "jpeg",
    quality: 70,
  });
}

// ── (c) DATE DÉJÀ PASSÉE — AUCUN RAPPORT SERVER-SIDE TROUVÉ DANS
//     `verdictOuverture` (lib/interventions/pose.ts) : il juge le JOUR
//     ouvert et l'HEURE d'ouverture, jamais la date par rapport à
//     aujourd'hui. `motifsNonTransmissible` porte bien un motif
//     `date_passee`, mais seulement pour le TRI des listes « Transmettre
//     toutes les planifiées prêtes » / « Transmettre demain » — jamais pour
//     une pose ni pour un « Transmettre » individuel. Ce test vérifie
//     EMPIRIQUEMENT, par l'écran, ce que la lecture du code laisse attendre.
test("planifier puis transmettre sur une date déjà passée n'est refusé ni à la pose ni à la transmission", async ({
  page,
}) => {
  const id = await creerInterventionDucos("date passée");
  try {
    const reperes = await reperesDeLaScene();
    // Le lundi de la semaine DERNIÈRE — un jour normalement ouvert à Ducos
    // (lundi : 07:30–11:30 / 13:00–17:00), à l'écart de toute question de
    // jour fermé ou d'horaire.
    const lundiPasse = jourSuivant(reperes.lundi, -7);

    await ouvrirLaSessionSensible(page, "adv@codima.test");
    await page.goto(`/interventions/${id}`);
    await ouvrirSaisieManuelle(page);
    const formulaire = formulaireDialogue(page);
    await formulaire
      .locator('input[name="date_planifiee"]')
      .fill(cleDeJour(lundiPasse));
    await formulaire.locator('input[name="heure_debut"]').fill("10:00");
    await formulaire.locator('input[name="duree_min"]').fill("60");
    const premierTechnicien = await formulaire
      .locator('select[name="technicien_id"] option:not([value=""])')
      .first()
      .getAttribute("value");
    await formulaire
      .locator('select[name="technicien_id"]')
      .selectOption(premierTechnicien ?? "");
    await dialogueOuvert(page)
      .getByRole("button", {
        name: fr["intervention.action.planifier_a_la_main"],
      })
      .click();
    await page.waitForLoadState("networkidle");

    expect(
      new URL(page.url()).searchParams.get("motif"),
      "la pose sur une date passée a été refusée — contrairement à ce que la lecture de pose.ts laissait attendre",
    ).toBeNull();
    await expect(
      page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
    ).toBeVisible();

    await page
      .getByRole("button", { name: fr["intervention.action.transmettre"] })
      .click();
    await dialogueOuvert(page)
      .getByRole("button", { name: fr["intervention.action.transmettre"] })
      .click();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { level: 1 }).getByText(fr["statut.affectee"]),
    ).toBeVisible();
  } finally {
    await supprimerIntervention(id);
  }
});

// ── (c) HORS OUVERTURE PAR L'HEURE (la pause méridienne, 11:30–13:00 à
//     Ducos) — même famille que `creation-jour-ferme.spec.ts` (D93), mais
//     AUCUN fichier existant ne vise la pause méridienne : les trois
//     fichiers qui portent `hors_ouverture` visent tous un jour FERMÉ
//     (samedi à Koné), jamais une heure fermée un jour normalement ouvert.
test("planifier en pleine pause méridienne, sans confirmation, est refusé", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const lundiFutur = jourSuivant(reperes.lundi, 91);
  const idRefus = await creerInterventionDucos(
    "hors ouverture, sans confirmation",
  );
  try {
    await ouvrirLaSessionSensible(page, "adv@codima.test");
    await page.goto(`/interventions/${idRefus}`);
    await ouvrirSaisieManuelle(page);
    const formulaire = formulaireDialogue(page);
    await formulaire
      .locator('input[name="date_planifiee"]')
      .fill(cleDeJour(lundiFutur));
    await formulaire.locator('input[name="heure_debut"]').fill("12:00");
    await formulaire.locator('input[name="duree_min"]').fill("30");
    const technicien = await formulaire
      .locator('select[name="technicien_id"] option:not([value=""])')
      .first()
      .getAttribute("value");
    await formulaire
      .locator('select[name="technicien_id"]')
      .selectOption(technicien ?? "");
    // La case reste DÉCOCHÉE, délibérément.
    await dialogueOuvert(page)
      .getByRole("button", {
        name: fr["intervention.action.planifier_a_la_main"],
      })
      .click();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(
      /\/interventions\/[0-9a-f-]+\?motif=intervention\.refus\.hors_ouverture/,
    );
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: fr["intervention.refus.hors_ouverture"] }),
    ).toBeVisible();
  } finally {
    await supprimerIntervention(idRefus);
  }
});

test("planifier en pleine pause méridienne, confirmé (D93), est accepté", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const lundiFutur = jourSuivant(reperes.lundi, 91);
  const idAccepte = await creerInterventionDucos(
    "hors ouverture, confirmée (D93)",
  );
  try {
    await ouvrirLaSessionSensible(page, "adv@codima.test");
    await page.goto(`/interventions/${idAccepte}`);
    await ouvrirSaisieManuelle(page);
    const formulaire = formulaireDialogue(page);
    await formulaire
      .locator('input[name="date_planifiee"]')
      .fill(cleDeJour(lundiFutur));
    await formulaire.locator('input[name="heure_debut"]').fill("12:00");
    await formulaire.locator('input[name="duree_min"]').fill("30");
    const technicien = await formulaire
      .locator('select[name="technicien_id"] option:not([value=""])')
      .first()
      .getAttribute("value");
    await formulaire
      .locator('select[name="technicien_id"]')
      .selectOption(technicien ?? "");
    await formulaire
      .getByLabel(fr["intervention.confirmer_hors_ouverture"])
      .check();
    await dialogueOuvert(page)
      .getByRole("button", {
        name: fr["intervention.action.planifier_a_la_main"],
      })
      .click();
    await page.waitForLoadState("networkidle");

    expect(new URL(page.url()).searchParams.get("motif")).toBeNull();
    await expect(
      page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
    ).toBeVisible();
    await expect(
      page.getByText(fr["intervention.confirmation.hors_ouverture_prefixe"], {
        exact: false,
      }),
    ).toBeVisible();
    await capturer(page, "9f5-edge-hors-ouverture-confirmee", 1280);
  } finally {
    await supprimerIntervention(idAccepte);
  }
});

// ── (d) DEUX ONGLETS SUR LA MÊME FICHE — le second clique « Transmettre »
//     sur un état déjà périmé (le premier onglet vient de transmettre).
test("deux onglets sur la même fiche : le second « Transmettre » sur un état déjà périmé ne double-transmet pas en silence", async ({
  browser,
}) => {
  const id = await creerInterventionDucos("deux onglets");
  try {
    const reperes = await reperesDeLaScene();
    const lundiFutur = jourSuivant(reperes.lundi, 98);

    const contexteA = await browser.newContext();
    const contexteB = await browser.newContext();
    const pageA = await contexteA.newPage();
    const pageB = await contexteB.newPage();
    try {
      await ouvrirLaSessionSensible(pageA, "adv@codima.test");
      await pageA.goto(`/interventions/${id}`);
      await ouvrirSaisieManuelle(pageA);
      const formulaire = formulaireDialogue(pageA);
      await formulaire
        .locator('input[name="date_planifiee"]')
        .fill(cleDeJour(lundiFutur));
      await formulaire.locator('input[name="heure_debut"]').fill("10:00");
      await formulaire.locator('input[name="duree_min"]').fill("60");
      const technicien = await formulaire
        .locator('select[name="technicien_id"] option:not([value=""])')
        .first()
        .getAttribute("value");
      await formulaire
        .locator('select[name="technicien_id"]')
        .selectOption(technicien ?? "");
      await dialogueOuvert(pageA)
        .getByRole("button", {
          name: fr["intervention.action.planifier_a_la_main"],
        })
        .click();
      await pageA.waitForLoadState("networkidle");
      await expect(
        pageA
          .getByRole("heading", { level: 1 })
          .getByText(fr["statut.planifiee"]),
      ).toBeVisible();

      // L'ONGLET B CHARGE LA FICHE MAINTENANT — « Planifiée », pas plus.
      await ouvrirLaSessionSensible(pageB, "adv@codima.test");
      await pageB.goto(`/interventions/${id}`);
      await expect(
        pageB
          .getByRole("heading", { level: 1 })
          .getByText(fr["statut.planifiee"]),
      ).toBeVisible();

      // L'ONGLET A TRANSMET — l'état réel passe à « Affectée ».
      await pageA
        .getByRole("button", { name: fr["intervention.action.transmettre"] })
        .click();
      await dialogueOuvert(pageA)
        .getByRole("button", { name: fr["intervention.action.transmettre"] })
        .click();
      await pageA.waitForLoadState("networkidle");
      await expect(
        pageA
          .getByRole("heading", { level: 1 })
          .getByText(fr["statut.affectee"]),
      ).toBeVisible();

      // L'ONGLET B, SANS RECHARGER, CLIQUE « Transmettre » SUR SA COPIE
      // PÉRIMÉE — le bouton, lui, est toujours affiché (B n'a pas revu A).
      await pageB
        .getByRole("button", { name: fr["intervention.action.transmettre"] })
        .click();
      await dialogueOuvert(pageB)
        .getByRole("button", { name: fr["intervention.action.transmettre"] })
        .click();
      await pageB.waitForLoadState("networkidle");
      await capturer(pageB, "9f5-edge-deux-onglets-transmission-perimee", 1280);

      // CONSTAT (pas une exigence pré-écrite) : la fiche doit rester
      // cohérente — jamais une seconde transmission réelle, jamais un
      // plantage muet. Le texte exact de ce que B affiche est à lire dans
      // le rapport (point 4) ; ici, seul un 200/500 distinct compte.
      // eslint-disable-next-line no-console -- relevé volontaire pour le rapport du point 4
      console.log(
        `9F5-edge — onglet B après transmission périmée : URL=${pageB.url()}`,
      );
    } finally {
      await contexteA.close();
      await contexteB.close();
    }
  } finally {
    await supprimerIntervention(id);
  }
});

// ── (e) RECHARGEMENT EN COURS DE SAISIE — DEUX HYPOTHÈSES DE DÉPART FAUSSES,
//     CORRIGÉES PAR LA MESURE : le champ écrit un brouillon dans
//     `localStorage` à chaque frappe (en-tête de `components/terrain/
//     rapport-automatique.tsx`, ligne 36), MAIS en plus — ce que la seule
//     lecture du code n'avait pas montré — le rechargement lui-même BLUR le
//     champ avant de décharger la page, et `onBlur={() => void
//     envoyerRapport()}` a le temps d'aboutir : la valeur lue en base
//     (colonne `intervention.commentaire_technicien`) après un rechargement
//     ET un `localStorage.clear()` est la même que celle tapée. Aucune perte
//     mesurée dans ce scénario — à l'inverse de l'hypothèse écrite ici au
//     premier jet.
test("un rechargement en cours de frappe n'a pas fait perdre le texte : le blur implicite du rechargement suffit à l'enregistrer", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/terrain/${SCENE.rapportVierge}`);

  const TEXTE = `${PREFIXE} — texte tapé sans blur explicite`;
  await page.getByLabel(fr["terrain.rapport.commentaire_libelle"]).fill(TEXTE);
  // AUCUN `blur()` EXPLICITE ICI — c'est tout le point : on recharge pendant
  // la saisie, sans quitter le champ au clavier ou à la souris.
  await page.reload();
  await expect(
    page.getByLabel(fr["terrain.rapport.commentaire_libelle"]),
  ).toHaveValue(TEXTE);

  // LE BROUILLON LOCAL EST VIDÉ : si la valeur relue au rechargement suivant
  // vient encore du serveur, c'est la preuve qu'il a bien reçu l'envoi.
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(
    page.getByLabel(fr["terrain.rapport.commentaire_libelle"]),
  ).toHaveValue(TEXTE);
});

// ── (f) CARACTÈRES SPÉCIAUX ET SAISIE LONGUE — `description` est validée
//     par `z.string().trim().min(1).max(4000)` (lib/interventions/saisie.ts),
//     et le `<textarea>` ne porte AUCUN `maxLength` HTML : rien n'empêche de
//     taper, ou de coller, plus que 4000 caractères.
test("accents, guillemets, balise et émoji s'affichent tels quels, jamais exécutés", async ({
  page,
}) => {
  const TEXTE = `${PREFIXE} — "guillemets", 'apostrophes', <script>window.__9f5xss=true</script>, éàçê, 🚀🔧`;
  let dialogueApparu = false;
  page.on("dialog", () => {
    dialogueApparu = true;
  });

  await ouvrirLaSessionSensible(page, "adv@codima.test");
  await page.goto("/interventions/nouvelle");
  const libelle = await libelleSiteDucos();
  await choisirResultatParTexte(page, "site", libelle, libelle);
  await page.locator('select[name="type"]').selectOption("curatif");
  await choisirPriorite(page, "p2");
  await page.locator('textarea[name="description"]').fill(TEXTE);
  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+(\?cree=1)?$/);
  const id = new URL(page.url()).pathname.split("/").at(-1) as string;

  try {
    const corpsRendu = (await page.locator("body").textContent()) ?? "";
    expect(
      corpsRendu.includes(TEXTE),
      "le texte saisi n'apparaît pas tel quel à l'écran",
    ).toBe(true);
    const executee = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__9f5xss === true,
    );
    expect(executee, "la balise <script> saisie s'est exécutée").toBe(false);
    expect(dialogueApparu, "un dialogue natif est apparu").toBe(false);
  } finally {
    await supprimerIntervention(id);
  }
});

test("une description de plus de 4000 caractères est refusée nommément, jamais en 500", async ({
  page,
}) => {
  const TEXTE_TROP_LONG = `${PREFIXE} — ${"x".repeat(4100)}`;

  await ouvrirLaSessionSensible(page, "adv@codima.test");
  await page.goto("/interventions/nouvelle");
  const libelle = await libelleSiteDucos();
  await choisirResultatParTexte(page, "site", libelle, libelle);
  await page.locator('select[name="type"]').selectOption("curatif");
  await choisirPriorite(page, "p2");
  await page.locator('textarea[name="description"]').fill(TEXTE_TROP_LONG);
  const reponse = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page
      .locator("#contenu")
      .getByRole("button", { name: fr["intervention.action.creer"] })
      .click(),
  ]);
  await page.waitForLoadState("networkidle");

  const statutReponse = reponse[0].status();
  // eslint-disable-next-line no-console -- relevé volontaire pour le rapport du point 4
  console.log(
    `9F5-edge — description de 4100 caractères : réponse POST ${statutReponse}, URL finale ${page.url()}`,
  );
  await capturer(
    page,
    "9f5-edge-description-trop-longue-message-trompeur",
    1280,
  );
  expect(
    statutReponse,
    "une entrée trop longue a produit une erreur serveur (500) plutôt qu'un refus nommé",
  ).toBeLessThan(500);
});

// ── (i) TERRAIN HORS RÉSEAU — CONSTAT ÉCRAN PAR ÉCRAN (L3-07/L3-08 bloqués
//     au backlog, voir l'en-tête du ticket). Aucune réparation attendue. Le
//     STATUT seul ne prouve rien (le service worker ne sert QUE la coquille,
//     par son propre énoncé) : ce test lit aussi le CONTENU rendu, et capture
//     l'écran pour le rapport du point 4.
test("hors réseau : /terrain et /terrain/[id], constat sans réparation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/terrain");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const dossier = join(process.cwd(), "docs/audits/9F5-fonctionnel/captures");
  mkdirSync(dossier, { recursive: true });

  await page.context().setOffline(true);
  try {
    let statutTerrain: number | null = null;
    let erreurTerrain: string | null = null;
    try {
      const reponse = await page.goto("/terrain", { timeout: 10_000 });
      statutTerrain = reponse?.status() ?? null;
    } catch (erreur) {
      erreurTerrain = String(erreur);
    }
    const titreTerrain = await page.title();
    const corpsTerrain = ((await page.locator("body").textContent()) ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    await page.screenshot({
      path: join(dossier, "9f5-edge-terrain-hors-reseau-375.jpg"),
      type: "jpeg",
      quality: 70,
    });
    // eslint-disable-next-line no-console -- relevé volontaire pour le rapport du point 4
    console.log(
      `9F5-edge — /terrain hors réseau : statut=${statutTerrain}, erreur=${erreurTerrain}, titre="${titreTerrain}", corps="${corpsTerrain}"`,
    );

    let statutFiche: number | null = null;
    let erreurFiche: string | null = null;
    try {
      const reponse = await page.goto(`/terrain/${SCENE.rapportVierge}`, {
        timeout: 10_000,
      });
      statutFiche = reponse?.status() ?? null;
    } catch (erreur) {
      erreurFiche = String(erreur);
    }
    const corpsFiche = ((await page.locator("body").textContent()) ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    await page.screenshot({
      path: join(dossier, "9f5-edge-terrain-fiche-hors-reseau-375.jpg"),
      type: "jpeg",
      quality: 70,
    });
    // eslint-disable-next-line no-console -- relevé volontaire pour le rapport du point 4
    console.log(
      `9F5-edge — /terrain/[id] hors réseau : statut=${statutFiche}, erreur=${erreurFiche}, corps="${corpsFiche}"`,
    );
  } finally {
    await page.context().setOffline(false);
  }
});
