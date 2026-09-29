import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { FICHIER_COURRIELS_CAPTURES } from "./setup/courriel-captures";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MARDI,
  SAMEDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * « TROUVER UN CRÉNEAU » DEPUIS LA FICHE (PG-B3-TROUVER-CRENEAU-FICHE,
 * spécification §3.10).
 *
 * La fiche d'une intervention `a_planifier` ouvre LA MÊME `FenetrePose` que
 * le planning (`planning-fenetre-pose.spec.ts`), mais avec le jour
 * CHOISISSABLE — la fiche n'a ni case ni glissé pour le fixer. Ce fichier
 * n'éprouve donc PAS ce que PG-B2 éprouve déjà (les créneaux, les verdicts,
 * la sonde d'absence) : il éprouve que le bouton ouvre la fenêtre depuis la
 * fiche, que le jour s'y choisit, et que l'écriture aboutit — ou se refuse,
 * nommée — par la MÊME route que « Déplacer ».
 *
 * *Chaque scénario forge SA PROPRE intervention* (préfixe `PGB3-`) et la
 * retire en fin de test — jamais une fixture `SCENE.*` partagée.
 */

async function creerInterventionAPlanifier(
  reperes: ReperesDeScene,
  codeAgence: "KONE" | "DUCOS",
): Promise<string> {
  const id = uuidv7();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: codeAgence },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: null,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "a_planifier",
        date_planifiee: null,
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGB3 — intervention forgée par l'épreuve",
      },
    });
    return id;
  } finally {
    await client.$disconnect();
  }
}

async function retirerIntervention(id: string): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      id,
    );
    await client.intervention.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

test("« Trouver un créneau » ouvre la fenêtre depuis la fiche, laisse choisir le jour, et planifie", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  // DIX SEMAINES PLUS LOIN, UN MARDI — hors de portée des offsets déjà pris
  // par les autres scénarios qui visent le même technicien (0, 21, 35, 49,
  // 63, 91 : voir `intervention-technicien-select.spec.ts`,
  // `fiche-technicien-nomme.spec.ts`, `parcours-creer-puis-planifier.spec.ts`,
  // `avertissements-1.spec.ts`).
  const jour = jourSuivant(jourDeLaScene(reperes, MARDI), 70);
  const jourCle = cleDeJour(jour);
  const interventionId = await creerInterventionAPlanifier(reperes, "DUCOS");

  try {
    await ouvrirUneSession(page);

    let posteVersDeplacer = false;
    page.on("request", (requete) => {
      if (requete.method() === "POST" && requete.url().includes("/deplacer")) {
        posteVersDeplacer = true;
      }
    });

    await page.goto(`/interventions/${interventionId}`);

    const bouton = page.getByRole("button", {
      name: fr["intervention.action.trouver_creneau"],
    });
    await expect(bouton).toBeVisible();
    await bouton.click();

    const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
    await expect(fenetre).toBeVisible();
    // AUCUNE ÉCRITURE AVANT « PLANIFIER » — même garantie que PG-B2.
    expect(posteVersDeplacer).toBe(false);

    // LE JOUR SE CHOISIT ICI (PG-B3) — la fiche n'a ni case ni glissé pour le
    // fixer, contrairement au planning.
    await fenetre.getByLabel(fr["planning.pose.date"]).fill(jourCle);
    await expect(fenetre).toHaveAttribute("data-jour", jourCle);

    await fenetre.locator("select").selectOption(reperes.technicienDucos);
    await expect(fenetre).toHaveAttribute(
      "data-technicien",
      reperes.technicienDucos,
    );

    await fenetre
      .getByRole("button", { name: fr["planning.pose.duree_60"], exact: true })
      .click();

    const creneauxFieldset = fenetre
      .locator("fieldset")
      .filter({ hasText: fr["planning.pose.heure"] });
    const premierCreneau = creneauxFieldset.locator("button").first();
    await expect(premierCreneau).toBeVisible();
    await premierCreneau.click();

    const boutonPlanifier = fenetre.getByRole("button", {
      name: fr["planning.pose.confirmer"],
      exact: true,
    });
    await expect(boutonPlanifier).toBeEnabled();

    // La confirmation ÉCRIT PAR LA MÊME ROUTE que « Déplacer » —
    // `posterDeplacement`, partagée avec `components/planning/pose.tsx`.
    const reponseDeplacer = page.waitForResponse(
      (reponse) =>
        reponse.url().includes("/deplacer") &&
        reponse.request().method() === "POST",
    );
    await boutonPlanifier.click();
    const reponse = await reponseDeplacer;
    expect(reponse.ok()).toBe(true);
    await page.waitForLoadState("load");

    // LA FICHE S'EST RECHARGÉE — le statut affiché est à jour.
    await expect(
      page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
    ).toBeVisible();

    const client = new PrismaClient({
      datasources: { db: { url: urlAdministration() } },
    });
    try {
      const apres = await client.intervention.findUniqueOrThrow({
        where: { id: interventionId },
        select: {
          statut: true,
          technicien_id: true,
          date_planifiee: true,
          creneau_debut: true,
          creneau_fin: true,
        },
      });
      expect(apres.statut).toBe("planifiee");
      expect(apres.technicien_id).toBe(reperes.technicienDucos);
      expect(apres.date_planifiee?.toISOString().slice(0, 10)).toBe(jourCle);
      expect(apres.creneau_debut).not.toBeNull();
      expect(apres.creneau_fin).not.toBeNull();
    } finally {
      await client.$disconnect();
    }
  } finally {
    await retirerIntervention(interventionId);
  }
});

test("un jour fermé, choisi dans la fenêtre depuis la fiche : le refus est nommé, « Planifier » reste inactif", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const samedi = jourDeLaScene(reperes, SAMEDI);
  const samediCle = cleDeJour(samedi);
  const interventionId = await creerInterventionAPlanifier(reperes, "KONE");

  try {
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${interventionId}`);

    await page
      .getByRole("button", { name: fr["intervention.action.trouver_creneau"] })
      .click();

    const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
    await expect(fenetre).toBeVisible();

    // KONÉ EST FERMÉ LE SAMEDI — choisi ICI, dans la fenêtre, depuis la fiche.
    await fenetre.getByLabel(fr["planning.pose.date"]).fill(samediCle);
    await expect(fenetre).toHaveAttribute("data-jour", samediCle);

    await fenetre.locator("select").selectOption(reperes.technicienKone);

    await fenetre
      .getByRole("button", { name: fr["planning.pose.duree_60"], exact: true })
      .click();

    // AUCUN CRÉNEAU CE JOUR-LÀ (agence fermée) : le champ « Autre heure »
    // reste la seule voie pour soumettre un candidat complet au jugement du
    // serveur — même mécanique que `creation-jour-ferme.spec.ts`, mais vue
    // depuis les CONTRÔLES de la fenêtre plutôt qu'après un envoi.
    await fenetre.getByLabel(fr["planning.pose.heure_autre"]).fill("09:00");

    await expect(
      fenetre.getByText(fr["intervention.refus.jour_ferme"]),
    ).toBeVisible();

    const boutonPlanifier = fenetre.getByRole("button", {
      name: fr["planning.pose.confirmer"],
      exact: true,
    });
    await expect(boutonPlanifier).toBeDisabled();
  } finally {
    await retirerIntervention(interventionId);
  }
});

/**
 * 9BW-AVERT-POSE-FICHE — LES AVERTISSEMENTS DE COURRIELS ET LE VIEUX BANDEAU.
 *
 * `TrouverCreneau` (la fiche) rechargeait par `window.location.reload()` :
 * les avertissements de la réponse étaient jetés, et un vieux `?motif=`
 * restait dans l'URL rechargée. Depuis ce lot, elle recharge par
 * `urlDeRechargement(issue.avertissements)` — même fonction, EXPORTÉE de
 * `components/planning/pose.tsx`, que le planning utilise déjà pour son
 * propre dépôt. Chaque scénario forge SA PROPRE scène (client, site, contact
 * — préfixe `PGB3AV-`) et la retire en fin de test.
 */

async function creerSceneAvertissement(
  reperes: ReperesDeScene,
  avecDonneurOrdre: boolean,
): Promise<{
  readonly interventionId: string;
  readonly clientId: string;
  readonly siteId: string;
}> {
  const clientId = uuidv7();
  const siteId = uuidv7();
  const interventionId = uuidv7();
  const suffixe = avecDonneurOrdre ? "avec" : "sans";
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: clientId,
        societe_id: reperes.societeId,
        raison_sociale: `PGB3AV — client ${suffixe} donneur d'ordre`,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: siteId,
        societe_id: reperes.societeId,
        client_id: clientId,
        agence_id: agence.id,
        libelle: `PGB3AV — site ${suffixe} donneur d'ordre`,
      },
    });
    if (avecDonneurOrdre) {
      await client.contact.create({
        data: {
          id: uuidv7(),
          societe_id: reperes.societeId,
          client_id: clientId,
          site_id: siteId,
          nom: "PGB3AV — donneur d'ordre",
          roles: ["donneur_ordre"],
          canaux: ["email"],
          email: "donneur-ordre@pgb3av.e2e.test",
          actif: true,
        },
      });
    }
    await client.intervention.create({
      data: {
        id: interventionId,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: clientId,
        site_id: siteId,
        technicien_id: null,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "a_planifier",
        date_planifiee: null,
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGB3AV — intervention forgée par l'épreuve",
      },
    });
    return { interventionId, clientId, siteId };
  } finally {
    await client.$disconnect();
  }
}

async function retirerSceneAvertissement(
  interventionId: string,
  clientId: string,
  siteId: string,
): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      interventionId,
    );
    await client.intervention.deleteMany({ where: { id: interventionId } });
    await client.contact.deleteMany({ where: { client_id: clientId } });
    await client.site.deleteMany({ where: { id: siteId } });
    await client.client.deleteMany({ where: { id: clientId } });
  } finally {
    await client.$disconnect();
  }
}

/** Les lignes JSON du journal des envois interceptés (`avertissements-1.spec.ts`). */
function courrielsCaptures(): unknown[] {
  if (!existsSync(FICHIER_COURRIELS_CAPTURES)) {
    return [];
  }
  return readFileSync(FICHIER_COURRIELS_CAPTURES, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim().length > 0)
    .map((ligne) => JSON.parse(ligne) as unknown);
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/AVERT-POSE-FICHE/captures",
);

/**
 * Les deux largeurs demandées par le ticket. Appelée AVANT les assertions qui
 * ne valent que pour le code neuf, pour que l'exécution « avant » (le vieux
 * comportement, lancée à la main sur le code d'avant ce lot) produise quand
 * même sa capture.
 */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

/** `avant` sur le code d'avant ce lot (capture manuelle), `apres` par défaut. */
const ETAPE_CAPTURE = process.env.CAPTURE_ETAPE ?? "apres";

async function poserParTrouverCreneau(
  page: Page,
  interventionId: string,
  jourCle: string,
  technicienId: string,
): Promise<void> {
  await page
    .getByRole("button", { name: fr["intervention.action.trouver_creneau"] })
    .click();

  const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
  await expect(fenetre).toBeVisible();

  await fenetre.getByLabel(fr["planning.pose.date"]).fill(jourCle);
  await expect(fenetre).toHaveAttribute("data-jour", jourCle);

  await fenetre.locator("select").selectOption(technicienId);
  await fenetre
    .getByRole("button", { name: fr["planning.pose.duree_60"], exact: true })
    .click();

  const creneauxFieldset = fenetre
    .locator("fieldset")
    .filter({ hasText: fr["planning.pose.heure"] });
  const premierCreneau = creneauxFieldset.locator("button").first();
  await expect(premierCreneau).toBeVisible();
  await premierCreneau.click();

  const boutonPlanifier = fenetre.getByRole("button", {
    name: fr["planning.pose.confirmer"],
    exact: true,
  });
  await expect(boutonPlanifier).toBeEnabled();

  const reponseDeplacer = page.waitForResponse(
    (reponse) =>
      reponse.url().includes("/deplacer") &&
      reponse.request().method() === "POST",
  );
  await boutonPlanifier.click();
  const reponse = await reponseDeplacer;
  expect(reponse.ok()).toBe(true);
  await page.waitForLoadState("load");
}

test("avec un donneur d'ordre : « Trouver un créneau » depuis la fiche affiche les avertissements et efface le vieux bandeau", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const jour = jourSuivant(jourDeLaScene(reperes, MARDI), 98);
  const jourCle = cleDeJour(jour);
  const { interventionId, clientId, siteId } = await creerSceneAvertissement(
    reperes,
    true,
  );

  try {
    await ouvrirUneSession(page);

    // UN VIEUX BANDEAU DE REFUS, POSÉ DANS L'URL AVANT LA POSE — c'est LUI
    // que le constat dit ne plus disparaître avec un simple `reload()`.
    await page.goto(
      `/interventions/${interventionId}?motif=intervention.refus.jour_ferme`,
    );
    await expect(
      page.getByText(fr["intervention.refus.jour_ferme"]),
    ).toBeVisible();

    const avant = courrielsCaptures().length;
    await poserParTrouverCreneau(
      page,
      interventionId,
      jourCle,
      reperes.technicienDucos,
    );

    await capturer(page, `fiche-avert-pose-${ETAPE_CAPTURE}`);

    // LE VIEUX BANDEAU A DISPARU — l'URL ne porte plus `motif`.
    const url = new URL(page.url());
    expect(url.searchParams.has("motif")).toBe(false);
    expect(url.searchParams.getAll("avertissement").length).toBeGreaterThan(0);
    await expect(
      page.getByText(fr["intervention.refus.jour_ferme"]),
    ).toHaveCount(0);

    // LES AVERTISSEMENTS DE COURRIELS PARTIS SONT VISIBLES — client ET
    // technicien, mêmes clés qu'`avertissements-1.spec.ts`.
    await expect(
      page.locator(
        '[data-avertissement="intervention.avertissement.courriel_client_parti"]',
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        '[data-avertissement="intervention.avertissement.courriel_technicien_parti"]',
      ),
    ).toBeVisible();

    // TÉMOIN — deux courriels sont réellement partis, pas zéro.
    expect(courrielsCaptures().length).toBe(avant + 2);
  } finally {
    await retirerSceneAvertissement(interventionId, clientId, siteId);
  }
});

test("sans donneur d'ordre (jumeau) : « Trouver un créneau » depuis la fiche affiche le bandeau « sans destinataire »", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const jour = jourSuivant(jourDeLaScene(reperes, MARDI), 99);
  const jourCle = cleDeJour(jour);
  const { interventionId, clientId, siteId } = await creerSceneAvertissement(
    reperes,
    false,
  );

  try {
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${interventionId}`);

    await poserParTrouverCreneau(
      page,
      interventionId,
      jourCle,
      reperes.technicienDucos,
    );

    const url = new URL(page.url());
    expect(url.searchParams.getAll("avertissement").length).toBeGreaterThan(0);
    await expect(
      page.locator(
        '[data-avertissement="intervention.avertissement.courriel_client_sans_destinataire"]',
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        '[data-avertissement="intervention.avertissement.courriel_technicien_parti"]',
      ),
    ).toBeVisible();
  } finally {
    await retirerSceneAvertissement(interventionId, clientId, siteId);
  }
});
