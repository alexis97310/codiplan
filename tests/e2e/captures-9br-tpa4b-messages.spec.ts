import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9BR-TP-A4b-MESSAGES — même recette que
 * `captures-tpa4a-messages.spec.ts` : rien n'est écrit sans la variable
 * d'environnement qui nomme le dossier, pour que `pnpm test:e2e` ordinaire
 * n'écrive jamais de fichier.
 *
 * **AVANT/APRÈS se prend en rejouant ce même fichier deux fois** — une fois
 * dans un `git worktree` posé sur le commit qui précède ce lot, une fois sur
 * le code livré — jamais en changeant ce fichier entre les deux. Aucune clé
 * `fr[...]` n'est lue ici, aucun import d'un module que ce lot a créé
 * (`BandeauMotif`, `motifDuRefus`, `CLASSES_TON`) : sur le code AVANT, ils
 * n'existent pas encore, et `next build` type-vérifie ce fichier contre le
 * code qu'il capture (piège connu, mémoire « captures-avant-apres-e2e »).
 * Chaque scène de lecture est une NAVIGATION, jamais une écriture — le motif
 * voyage par le paramètre d'URL que la route poserait elle-même. Les scènes
 * de saisie soumettent un REFUS DE VALIDATION (schéma), qui n'écrit rien sur
 * AUCUN des deux codes : aucun nettoyage n'est dû.
 *
 * `CAPTURES_TPA4B_PHASE` (« avant » ou « apres ») n'influence QUE le nom du
 * fichier produit — jamais le code exécuté, qui est toujours celui du commit
 * sur lequel ce fichier tourne.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_TPA4B ?? "";
const PHASE = process.env.CAPTURES_TPA4B_PHASE ?? "apres";

const PREFIXE = "TPA4CAP-";
const CODE_EXTERNE_DOUBLON = `${PREFIXE}CODE-DOUBLON`;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${PHASE}-${largeur}.png`),
    fullPage: true,
  });
}

type Scene = {
  clientId: string;
  siteId: string;
  machineId: string;
  demandeId: string;
  agenceDucosId: string;
  calendrierDucosId: string;
};

let scene: Scene;

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agenceDucos = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true, calendrier_id: true },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });

    const cliente = await client.client.create({
      data: {
        id: uuidv7(),
        societe_id: societe.id,
        raison_sociale: `${PREFIXE}Client`,
        code_externe: CODE_EXTERNE_DOUBLON,
        actif: true,
      },
    });
    const site = await client.site.create({
      data: {
        id: uuidv7(),
        societe_id: societe.id,
        client_id: cliente.id,
        agence_id: agenceDucos.id,
        libelle: `${PREFIXE}Site`,
      },
    });
    const machine = await client.machine.create({
      data: {
        id: uuidv7(),
        societe_id: societe.id,
        modele_id: modele.id,
        client_id: cliente.id,
        site_id: site.id,
        numero_serie: `${PREFIXE}SERIE`,
        qr_token: `${PREFIXE}${Date.now()}`,
      },
    });
    const maintenant = new Date();
    const demande = await client.demande.create({
      data: {
        id: uuidv7(),
        societe_id: societe.id,
        source: "portail",
        client_id: cliente.id,
        site_id: site.id,
        agence_id: agenceDucos.id,
        description: `${PREFIXE}Demande — capture 9BR`,
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
      },
    });

    scene = {
      clientId: cliente.id,
      siteId: site.id,
      machineId: machine.id,
      demandeId: demande.id,
      agenceDucosId: agenceDucos.id,
      calendrierDucosId: agenceDucos.calendrier_id as string,
    };
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.demande.deleteMany({ where: { client_id: scene.clientId } });
    await client.machine.deleteMany({ where: { id: scene.machineId } });
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  /* ── (5) RÉUSSITES EN VERT, LE REFUS RESTE EN ROUGE (CS17, PA-05) ────── */
  test(`captures — le ton du bandeau sur les six fiches, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    await page.goto(`/clients/${scene.clientId}?motif=clients.modifie`);
    await capturer(page, "fiche-client-succes", largeur);
    await page.goto(`/clients/${scene.clientId}?motif=client.refus.saisie`);
    await capturer(page, "fiche-client-refus", largeur);

    await page.goto(`/sites/${scene.siteId}?motif=sites.modifie`);
    await capturer(page, "fiche-site-succes", largeur);

    await page.goto("/parametres/agences?motif=agence.creee");
    await capturer(page, "agences-liste-succes", largeur);

    await page.goto(
      `/parametres/agences/${scene.calendrierDucosId}?motif=agence.creee`,
    );
    await capturer(page, "agences-calendrier-succes", largeur);

    await page.goto(
      `/parametres/agences/${scene.agenceDucosId}/modifier?motif=agence.modifiee`,
    );
    await capturer(page, "agence-modifier-succes", largeur);

    await page.goto("/parametres/equipe?motif=equipe.info.rattache");
    await capturer(page, "equipe-succes", largeur);
  });

  /* ── (6) LE MOTIF APRÈS L'ENREGISTREMENT D'UNE MACHINE (PV-18) ───────── */
  test(`captures — la fiche machine après une création, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(`/parc/${scene.machineId}?motif=machine.creee`);
    await capturer(page, "fiche-machine-succes", largeur);
  });

  /* ── (7) LA SAISIE GARDÉE APRÈS UN REFUS (CS23, CS42, CS46, IN-03) — le
     compte ADV, qui porte les capacités de ces cinq gestes. Chaque geste
     soumet un refus de VALIDATION, qui n'écrit rien. */
  test(`captures — la saisie gardée après un refus, cinq formulaires (ADV), à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);

    // CLIENT — code externe déjà porté par la scène.
    await page.goto("/clients/nouveau");
    await page
      .locator('input[name="raison_sociale"]')
      .fill("TPA4CAP-Refus-Client");
    await page.locator('input[name="code_externe"]').fill(CODE_EXTERNE_DOUBLON);
    await page.locator('input[name="ridet"]').fill("TPA4CAP-RIDET");
    await page
      .locator('form[action="/api/clients/creer"]')
      .locator('button[type="submit"]')
      .click();
    await page.waitForLoadState("networkidle");
    await capturer(page, "clients-nouveau-refus-saisie-gardee", largeur);

    // SITE — sans rattachement (D56).
    await page.goto("/sites/nouveau");
    await choisirResultatParTexte(
      page,
      "client_id",
      `${PREFIXE}Client`,
      `${PREFIXE}Client`,
    );
    await page.locator('input[name="libelle"]').fill("TPA4CAP-Refus-Site");
    const formeSite = page.locator('form[action="/api/sites/creer"]');
    await formeSite.evaluate((formulaire) => {
      formulaire
        .querySelector('[name="agence_id"]')
        ?.removeAttribute("required");
    });
    await formeSite.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");
    await capturer(page, "sites-nouveau-refus-saisie-gardee", largeur);

    // INTERLOCUTEUR — depuis la fiche client, sans nom.
    await page.goto(`/clients/${scene.clientId}`);
    const formeContact = page.locator('form[action="/api/contacts/creer"]');
    await formeContact.locator('select[name="site_id"]').selectOption("");
    await formeContact
      .locator('input[name="fonction"]')
      .fill("TPA4CAP-Fonction");
    await formeContact
      .locator('input[type="checkbox"][value="donneur_ordre"]')
      .check();
    await formeContact.evaluate((formulaire) => {
      formulaire.querySelector('[name="nom"]')?.removeAttribute("required");
    });
    await formeContact.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");
    await capturer(page, "contact-refus-saisie-gardee", largeur);

    // VÉRIFICATION VGP — organisme vide.
    await page.goto(`/vgp/enregistrer/${scene.machineId}`);
    await page.locator('input[name="date_verification"]').fill("2026-09-29");
    await page.locator('select[name="origine"]').selectOption({ index: 1 });
    await page
      .locator('input[name="reference_rapport"]')
      .fill("TPA4CAP-RAPPORT");
    const formeVgp = page
      .locator("form")
      .filter({ has: page.locator('[name="organisme"]') });
    await formeVgp.evaluate((formulaire) => {
      formulaire
        .querySelector('[name="organisme"]')
        ?.removeAttribute("required");
    });
    await formeVgp.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");
    await capturer(page, "vgp-refus-saisie-gardee", largeur);

    // INTERVENTION — ouverte depuis une demande, mode « Forfait » choisi ; la
    // nature est laissée VIDE, exprès (`required` retiré, sinon le
    // navigateur bloque AVANT la route) — c'est le refus qu'on éprouve. La
    // panne, préremplie depuis la description de la demande, n'est jamais
    // touchée ici : ce champ RETOMBE sur cette même description après le
    // refus (comportement déjà établi par 68-DEMANDES-2, hors territoire de
    // ce lot), et ce n'est donc pas lui qui prouve la saisie gardée — ce sont
    // le mode de valorisation et le contexte « depuis une demande ».
    await page.goto(`/interventions/nouvelle?demande=${scene.demandeId}`);
    await page
      .locator('select[name="mode_valorisation"]')
      .selectOption("forfait");
    const formeIntervention = page.locator(
      'form[action="/api/interventions/creer"]',
    );
    await formeIntervention.evaluate((formulaire) => {
      formulaire.querySelector('[name="type"]')?.removeAttribute("required");
    });
    await formeIntervention.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");
    await capturer(page, "intervention-refus-saisie-gardee", largeur);
  });

  /* ── (7 bis) LA SAISIE GARDÉE APRÈS UN REFUS (PA-06, PV-45) — agence et
     forfait exigent `parametrer_societe`, qu'ADV ne porte pas (D131) : le
     compte `admin_societe` de l'épreuve, sinon la porte elle-même refuse
     avant d'atteindre le refus de VALIDATION qu'on veut montrer. */
  test(`captures — la saisie gardée après un refus, agence et forfait (admin société), à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

    // AGENCE — libellé vide.
    await page.goto("/parametres/agences/nouvelle");
    await page.locator('input[name="code"]').fill("TPA4CAP");
    await page.locator('input[name="territoire"]').fill("NC");
    const formeAgence = page.locator(
      'form[action="/api/parametres/agences/creer"]',
    );
    await formeAgence.evaluate((formulaire) => {
      formulaire.querySelector('[name="libelle"]')?.removeAttribute("required");
    });
    await formeAgence.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");
    await capturer(page, "agence-nouvelle-refus-saisie-gardee", largeur);

    // FORFAIT — montant vide.
    await page.goto("/parametres/forfaits");
    const formeForfait = page.locator(
      'form[action="/api/parametres/forfaits/creer"]',
    );
    await formeForfait.locator('input[name="code"]').fill("TPA4CAP-FRF");
    await formeForfait.locator('input[name="libelle"]').fill("TPA4CAP-Forfait");
    await formeForfait
      .locator('select[name="type"]')
      .selectOption({ index: 1 });
    await formeForfait.locator('input[name="rang"]').fill("1");
    await formeForfait.evaluate((formulaire) => {
      formulaire
        .querySelector('[name="montant_mineur"]')
        ?.removeAttribute("required");
    });
    await formeForfait.locator('button[type="submit"]').click();
    await page.waitForLoadState("networkidle");
    await capturer(page, "forfaits-refus-saisie-gardee", largeur);
  });
}
