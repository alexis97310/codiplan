import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirLaSessionSensible } from "./setup/session";
import { SCENE_9L20 } from "./setup/scene-9l20";

/**
 * 9L20-DEPLACER-MACHINE, DE BOUT EN BOUT — décision d'Alexis du 10/11/2026.
 *
 * ## Ce que les épreuves d'isolation ne peuvent pas prouver
 *
 * `tests/isolation/9l20-deplacer-machine.test.ts` prouve que le DÉPÔT
 * refuse ou accepte, et trace au journal. Il ne prouve pas que l'ÉCRAN
 * propose le bon geste au bon endroit — que le formulaire de correction ne
 * montre plus le site, que le bouton « Déplacer la machine » ouvre un
 * dialogue qui cherche un site sur TOUTE la société, et que le bloc
 * « Historique des emplacements » affiche réellement la trace après coup.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9L20-`
 *
 * Un client, deux sites (le même client — le chemin SANS confirmation) et
 * une machine, créés en `beforeAll` sur le MODÈLE du semis (I9, jamais une
 * famille forgée par l'épreuve), supprimés en `afterAll`. SÉRIEL : le second
 * test lit l'historique que le premier vient d'écrire.
 *
 * ## CAPTURES (consigne permanente d'Alexis)
 *
 * `CAPTURES_9L20` pose le dossier de sortie — absent, aucune capture n'est
 * prise (même recette que `captures-9l18-garantie-recensement-sans-montant.
 * spec.ts`). **AVANT NON REPRODUCTIBLE SUR CET ARBRE** : le formulaire de
 * correction ne porte plus le JSX qui affichait le site, et la fiche ne peut
 * pas être rendue sans le bouton « Déplacer » qui vient avec lui — aucune
 * donnée insérée sous le code CORRIGÉ ne peut donc reproduire l'état
 * d'avant. Seul l'APRÈS est versé ici, aux deux largeurs demandées.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L20 ?? "";

const CLIENT_9L20 = uuidv7();
const SITE_DEPART_9L20 = uuidv7();
const SITE_CIBLE_9L20 = uuidv7();
const MACHINE_9L20 = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.machine.deleteMany({ where: { id: MACHINE_9L20 } });
  await client.site.deleteMany({
    where: { id: { in: [SITE_DEPART_9L20, SITE_CIBLE_9L20] } },
  });
  await client.client.deleteMany({ where: { id: CLIENT_9L20 } });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-apres-${largeur}.png`),
    fullPage: true,
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await nettoyer(client);
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    // LE MODÈLE DU SEMIS (I9) — jamais une famille forgée par l'épreuve.
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId, famille: { code: "PONT-ELEV" } },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9L20,
        societe_id: reperes.societeId,
        raison_sociale: SCENE_9L20.raisonSociale,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_DEPART_9L20,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L20,
        agence_id: agence.id,
        libelle: SCENE_9L20.libelleDepart,
      },
    });
    await client.site.create({
      data: {
        id: SITE_CIBLE_9L20,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L20,
        agence_id: agence.id,
        libelle: SCENE_9L20.libelleCible,
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_9L20,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_9L20,
        site_id: SITE_DEPART_9L20,
        numero_serie: "9L20-SN-DEPLACER",
        qr_token: uuidv7(),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375]) {
  test(`le formulaire de correction ne propose plus le site, et « Déplacer la machine » le fait — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.setViewportSize({ width: largeur, height: 1200 });

    // 1. LE FORMULAIRE DE CORRECTION — le site n'y est plus proposé, même en
    //    lecture (9L20-DEPLACER-MACHINE, point 1).
    await page.goto(`/parc/${MACHINE_9L20}/modifier`);
    await expect(
      page.getByText(fr["machine.modifier.non_modifiable"]),
    ).toBeVisible();
    await expect(page.getByText(SCENE_9L20.libelleDepart)).toHaveCount(0);
    await capturer(page, "9l20-modifier-sans-site", largeur);

    // 2. LA FICHE — le bouton « Déplacer la machine » est posé à côté de
    //    « Changer l'état ».
    await page.goto(`/parc/${MACHINE_9L20}`);
    await expect(
      page.getByRole("button", { name: fr["machine.deplacer.bouton"] }),
    ).toBeVisible();
    await capturer(page, "9l20-fiche-avant-deplacement", largeur);

    // 3. LE DIALOGUE — recherche sur TOUTE la société (jamais restreinte au
    //    client courant), puis le site CIBLE, du MÊME client : aucune
    //    confirmation ne doit apparaître.
    await page
      .getByRole("button", { name: fr["machine.deplacer.bouton"] })
      .click();
    const dialogue = page.locator("dialog[open]");
    await expect(dialogue).toBeVisible();
    await choisirResultatParTexte(
      dialogue,
      "nouveau_site_id",
      SCENE_9L20.libelleCible,
      SCENE_9L20.libelleCible,
    );
    await expect(
      dialogue.getByText(fr["machine.deplacer.confirmation_autre_client"]),
    ).toHaveCount(0);
    await capturer(page, "9l20-dialogue-deplacer", largeur);
    await dialogue
      .getByRole("button", { name: fr["machine.deplacer.bouton"] })
      .click();

    // 4. LE RÉSULTAT — bandeau de succès, et la fiche montre désormais le
    //    NOUVEAU site ainsi que l'historique des emplacements.
    await expect(page).toHaveURL(new RegExp(`/parc/${MACHINE_9L20}(\\?|$)`));
    await expect(page.getByText(fr["machine.deplacer.reussi"])).toBeVisible();
    await expect(
      page.getByText(fr["machine.fiche.emplacements_titre"]),
    ).toBeVisible();
    // `:visible` CHOISIT LA FORME RENDUE À CETTE LARGEUR (tableau desktop OU
    // `ListeCartes` mobile) — les deux existent dans le DOM à la fois, une
    // seule est affichée (même idiome que `visuel-2.spec.ts`).
    await expect(
      page
        .getByText(SCENE_9L20.libelleDepart)
        .and(page.locator(":visible"))
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByText(SCENE_9L20.libelleCible)
        .and(page.locator(":visible"))
        .first(),
    ).toBeVisible();
    await capturer(page, "9l20-fiche-apres-deplacement", largeur);

    // Remise dans son état initial — la scène est SÉRIELLE et rejouée aux
    // deux largeurs.
    await page
      .getByRole("button", { name: fr["machine.deplacer.bouton"] })
      .click();
    const retourDialogue = page.locator("dialog[open]");
    await choisirResultatParTexte(
      retourDialogue,
      "nouveau_site_id",
      SCENE_9L20.libelleDepart,
      SCENE_9L20.libelleDepart,
    );
    await retourDialogue
      .getByRole("button", { name: fr["machine.deplacer.bouton"] })
      .click();
    await expect(page.getByText(fr["machine.deplacer.reussi"])).toBeVisible();
  });
}

test("refus nommé — poster un site différent par l'ancien formulaire ne déplace rien", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto(`/parc/${MACHINE_9L20}/modifier`);

  // LE CHAMP CACHÉ EXISTE TOUJOURS (schemaMachine l'exige) — FORGÉ ICI à une
  // valeur différente de la fiche pour éprouver le refus serveur, puisque
  // l'écran lui-même ne propose plus aucun moyen de le changer.
  await page.evaluate((siteCible) => {
    const champSite = document.querySelector<HTMLInputElement>(
      'input[name="site_id"]',
    );
    if (champSite !== null) champSite.value = siteCible;
  }, SITE_CIBLE_9L20);
  // LA ROUTE RÉPOND EN JSON (D-06) — pas de redirection, le formulaire
  // affiche le refus NOMMÉ dans sa propre bannière, sur la même page.
  await page
    .getByRole("button", { name: fr["machine.action.enregistrer"] })
    .click();
  await expect(
    page.getByText(fr["machine.refus.deplacement_requis"]),
  ).toBeVisible();

  const client = admin();
  try {
    const fiche = await client.machine.findUniqueOrThrow({
      where: { id: MACHINE_9L20 },
      select: { site_id: true },
    });
    expect(fiche.site_id).toBe(SITE_DEPART_9L20);
  } finally {
    await client.$disconnect();
  }
});
