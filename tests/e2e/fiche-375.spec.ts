import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 95-FICHE-375 (audit d'ergonomie du 25/09/2026, constat 24) — la fiche
 * d'intervention (`/interventions/[id]`) tient sur un téléphone (375 px)
 * sans défilement horizontal.
 *
 * ## La CAUSE mesurée, et ce n'est pas celle que la lecture de code visait
 *
 * *Mesuré à 375 × 812 sur une fiche forgée par ce fichier, avec des valeurs
 * longues (désignation machine + n° de série, lieu, panne signalée) :
 * `document.documentElement.scrollWidth` restait à 375 tant que
 * l'intervention portait déjà une machine.* Le débordement (`scrollWidth`
 * jusqu'à 1706 dans la même scène, machine détachée) venait d'un seul
 * élément : le `<select>` du mini-formulaire « Ajouter une machine »
 * (rendu SEULEMENT quand `ligne.machines.length === 0`) — sans largeur
 * posée, un `<select>` natif se dimensionne sur son option la plus large et
 * ne s'enroule jamais, et pousse tout son ancêtre hors de l'écran. Les
 * quatre `dl` de la fiche (`grid-cols-[132px_1fr]`/`[160px_1fr]`)
 * n'ajoutaient AUCUN débordement propre dans cette même scène : leurs `dd`
 * portent déjà `break-all` (une classe posée avant ce ticket), et leur
 * `scrollWidth` restait égal à leur `clientWidth`.
 *
 * La correction porte donc sur DEUX choses, la mesurée et celle que l'audit
 * décrivait par avance :
 * - `w-full min-w-0` sur le `<select>` d'« Ajouter une machine » et sur les
 *   deux éléments de `Saisie` (même défaut de principe, même composant
 *   partagé par les formulaires d'action) — la CAUSE mesurée ;
 * - les quatre `dl` passent en une colonne sous `sm` (étiquette au-dessus de
 *   la valeur), en défense — aucune largeur fixe ne doit dépendre de ce que
 *   `break-all` seul absorbe.
 *
 * Aucune des deux n'est touchée dans le panneau « Actions » ni dans la
 * fonction `Action` : le `<select>` corrigé ici est celui d'« Ajouter une
 * machine », dans la colonne de gauche, hors de ce panneau.
 *
 * ## Scène propre, préfixée `FICHE375`, créée et supprimée par l'épreuve
 *
 * Un client, un site, une famille, un modèle, une machine et une
 * intervention à elle — jamais une ligne du semis. Les valeurs longues sont
 * des mots SANS espace (répétition d'une lettre) : c'est le cas qui met
 * `break-all` et la largeur du `<select>` sous tension, pas une phrase
 * normale qui s'enroulerait de toute façon aux espaces.
 */

// SÉRIE, PAS `fullyParallel` (même piège que `92-CREATION-2`) — sous
// `fullyParallel: true`, `beforeAll` s'exécute UNE FOIS PAR OUVRIER, et deux
// ouvriers créant la MÊME machine (`(societe_id, marque, reference)`
// unique) au même instant se heurtent. Un seul ouvrier joue ce fichier.
test.describe.configure({ mode: "serial" });

const FENETRE_TELEPHONE = { width: 375, height: 812 };
const FENETRE_BUREAU = { width: 1280, height: 900 };

const PREFIXE = "FICHE375";
const CLIENT_LONG = `${PREFIXE}-Client-${"A".repeat(80)}`;
const SITE_LONG = `${PREFIXE}-Site-${"B".repeat(80)}`;
const FAMILLE_LONGUE = `${PREFIXE}-Famille-${"C".repeat(60)}`;
const MARQUE_LONGUE = `${PREFIXE}Marque${"D".repeat(50)}`;
const REFERENCE_LONGUE = `${PREFIXE}Ref${"E".repeat(50)}`;
const NUMERO_SERIE_LONG = `${PREFIXE}-SN-${"F".repeat(50)}`;
const DESCRIPTION_LONGUE = `${"panne moteur hydraulique constatée sur site ".repeat(6)}${"G".repeat(80)}`;
const REFERENCE_CLIENT_LONGUE = `BC-${"H".repeat(60)}`;

let admin: PrismaClient;
let clientId: string;
let siteId: string;
let familleId: string;
let modeleId: string;
let machineId: string;
let interventionId: string;

test.beforeAll(async () => {
  admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });

  const societe = await admin.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });
  const agence = await admin.agence.findFirstOrThrow({
    where: { societe_id: societe.id },
    select: { id: true },
  });

  const client = await admin.client.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      raison_sociale: CLIENT_LONG,
      actif: true,
    },
  });
  clientId = client.id;

  const site = await admin.site.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientId,
      agence_id: agence.id,
      libelle: SITE_LONG,
    },
  });
  siteId = site.id;

  const famille = await admin.familleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      code: `F375FAM${randomUUID().slice(0, 6)}`,
      libelle: FAMILLE_LONGUE,
    },
  });
  familleId = famille.id;

  const modele = await admin.modeleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      famille_id: familleId,
      marque: MARQUE_LONGUE,
      reference: REFERENCE_LONGUE,
    },
  });
  modeleId = modele.id;

  // AUCUNE MACHINE RATTACHÉE À L'INTERVENTION (`intervention_machine` reste
  // vide) — c'est la condition qui révèle la cause mesurée : le mini-
  // formulaire « Ajouter une machine » ne se rend QUE dans ce cas
  // (`figee || ligne.machines.length > 0 ? null : …`), et c'est SON
  // `<select>`, peuplé par `machinesDuSite`, qui portait le débordement.
  const machine = await admin.machine.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      modele_id: modeleId,
      client_id: clientId,
      site_id: siteId,
      qr_token: `F375QR${randomUUID().slice(0, 20)}`,
      numero_serie: NUMERO_SERIE_LONG,
    },
  });
  machineId = machine.id;

  const intervention = await admin.intervention.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientId,
      site_id: siteId,
      agence_id: agence.id,
      type: "curatif",
      priorite: "p3",
      statut: "a_planifier",
      description: DESCRIPTION_LONGUE,
      reference_client: REFERENCE_CLIENT_LONGUE,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
    },
  });
  interventionId = intervention.id;
});

test.afterAll(async () => {
  try {
    await admin.intervention.deleteMany({ where: { id: interventionId } });
    await admin.machine.deleteMany({ where: { id: machineId } });
    await admin.modeleMateriel.delete({ where: { id: modeleId } });
    await admin.familleMateriel.delete({ where: { id: familleId } });
    await admin.site.deleteMany({ where: { id: siteId } });
    await admin.client.deleteMany({ where: { id: clientId } });
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("à 375 px, aucun défilement horizontal et le panneau « Actions » reste atteignable", async ({
  page,
}) => {
  await page.setViewportSize(FENETRE_TELEPHONE);
  await page.goto(`/interventions/${interventionId}`);
  await expect(page.locator("main")).toBeVisible();

  // LE TÉMOIN QUI AURAIT DÛ ROUGIR : 1706 était la mesure AVANT ce
  // correctif, sur cette même scène (`<select>` d'« Ajouter une machine »
  // sans largeur posée).
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(FENETRE_TELEPHONE.width);

  const machineAAjouter = page.locator('select[name="machine_id"]');
  await expect(machineAAjouter).toBeVisible();

  const actions = page.getByRole("heading", {
    name: fr["intervention.actions.titre"],
  });
  await actions.scrollIntoViewIfNeeded();
  await expect(actions).toBeVisible();
});

test("à 1280 px, la mise en page en deux colonnes reste — l'aside est à côté de l'identification, pas en dessous", async ({
  page,
}) => {
  await page.setViewportSize(FENETRE_BUREAU);
  await page.goto(`/interventions/${interventionId}`);
  await expect(page.locator("main")).toBeVisible();

  const rectIdentification = await page
    .locator("dt", { hasText: fr["intervention.date"] })
    .evaluate((element) => element.getBoundingClientRect().toJSON());
  // DEUX `<aside>` COEXISTENT (la colonne de navigation, masquée à 1280 px
  // par `#colonne-navigation`, et le panneau « Actions » de cette fiche) —
  // celui qui nous intéresse est celui qui porte le titre « Actions ».
  const rectAside = await page
    .locator("aside", { hasText: fr["intervention.actions.titre"] })
    .evaluate((element) => element.getBoundingClientRect().toJSON());

  // CÔTE À CÔTE : l'aside commence sur la même ligne que l'identification,
  // largement à sa droite — jamais en dessous, ce que donnerait une seule
  // colonne.
  expect(rectAside.top).toBeLessThan(rectIdentification.top + 50);
  expect(rectAside.left).toBeGreaterThan(rectIdentification.left + 400);
});
