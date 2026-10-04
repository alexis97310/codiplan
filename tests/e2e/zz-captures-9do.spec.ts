import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { t } from "@/lib/i18n/fr";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS DE 9DO-TP-CLI2-INTERLOCUTEURS-RECHERCHE
 * (05/10/2026) — demandées par le ticket : modification d'un interlocuteur
 * (courriel vidé, refus nommé, CS43) ; fiche client (sites et interlocuteurs
 * triés, CS19) ; `/clients` et `/sites` (recherche sans accents, par
 * commune, CS2) ; sélecteur de client (homonymes, CS40). 1280 et 375 px.
 *
 * **Recette** (mémoire de session « captures-avant-apres-e2e ») : ce fichier
 * tourne une fois dans un worktree sur 0acadfc5 (AVANT ce lot —
 * `CAPTURES_9DO_ETAPE=avant`), une fois ici, sur le code livré (APRÈS —
 * `CAPTURES_9DO_ETAPE=apres`). Rien n'est écrit sans `CAPTURES_9DO` (le
 * dossier).
 *
 * **Les assertions restent minimales** : ce fichier doit passer SANS
 * modification sur le code d'AVANT ce lot, qui ne connaît ni le refus
 * nommé de CS43 (l'ancien code y répondait par un 500, ou dans le pire cas
 * laissait passer l'effacement), ni le tri alphanumérique de CS19, ni la
 * recherche sans accent de CS2, ni le libellé enrichi du sélecteur CS40.
 * Seule la navigation et la capture comptent.
 *
 * **SA PROPRE SCÈNE, préfixée `9DO-CAPT-`** — créée en `beforeAll`,
 * supprimée en `afterAll`. Jamais `SCENE.*`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DO ?? "";
const ETAPE = process.env.CAPTURES_9DO_ETAPE ?? "avant";

const CLIENT_TRIE = randomUUID();
const SITE_ZINC = randomUUID();
const SITE_AVION = randomUUID();
const CONTACT_ZINC = randomUUID();
const CONTACT_AVION = randomUUID();
const CONTACT_COURRIEL = randomUUID();

const CLIENT_ACCENT = randomUUID();
const SITE_ACCENT = randomUUID();

const CLIENT_HOMO_1 = randomUUID();
const CLIENT_HOMO_2 = randomUUID();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.contact.deleteMany({
    where: { id: { in: [CONTACT_ZINC, CONTACT_AVION, CONTACT_COURRIEL] } },
  });
  await client.site.deleteMany({
    where: { id: { in: [SITE_ZINC, SITE_AVION, SITE_ACCENT] } },
  });
  await client.client.deleteMany({
    where: {
      id: { in: [CLIENT_TRIE, CLIENT_ACCENT, CLIENT_HOMO_1, CLIENT_HOMO_2] },
    },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });

    // ── CLIENT_TRIE : sites et interlocuteurs numérotés « 2 » et « 10 »
    // (CS19) — une collation naïve (`ORDER BY` SQL, ou la comparaison de
    // chaînes JS par défaut) classe « 10 » AVANT « 2» (le caractère '1' <
    // '2') ; le tri alphanumérique demandé (`numeric: true`,
    // `lib/tri/collation.ts`) classe « 2 » avant « 10 ». C'est le seul
    // contraste qui reste VISIBLE sur une collation locale `en_US.utf8`, qui
    // trie déjà correctement deux mots ASCII simples sans numéro.
    await client.client.create({
      data: {
        id: CLIENT_TRIE,
        societe_id: societe.id,
        raison_sociale: "9DO-CAPT-Client (tri et courriel)",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ZINC,
        societe_id: societe.id,
        client_id: CLIENT_TRIE,
        agence_id: agence.id,
        libelle: "9DO-CAPT-Site 10",
      },
    });
    await client.site.create({
      data: {
        id: SITE_AVION,
        societe_id: societe.id,
        client_id: CLIENT_TRIE,
        agence_id: agence.id,
        libelle: "9DO-CAPT-Site 2",
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_ZINC,
        societe_id: societe.id,
        client_id: CLIENT_TRIE,
        nom: "9DO-CAPT-Contact 10",
        roles: ["donneur_ordre"],
        canaux: ["email"],
        email: "zinc@9do-capt.test",
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_AVION,
        societe_id: societe.id,
        client_id: CLIENT_TRIE,
        nom: "9DO-CAPT-Contact 2",
        roles: ["donneur_ordre"],
        canaux: ["email"],
        email: "avion@9do-capt.test",
      },
    });
    // LE CONTACT NOTIFIÉ PAR COURRIEL (CS43) — vider son adresse sera refusé
    // sur le code APRÈS ; sur AVANT, le même geste réussissait (ou plantait
    // selon le chemin), sans refus nommé.
    await client.contact.create({
      data: {
        id: CONTACT_COURRIEL,
        societe_id: societe.id,
        client_id: CLIENT_TRIE,
        nom: "Notifié par courriel (9DO-CAPT)",
        roles: ["donneur_ordre"],
        canaux: ["email"],
        email: "notifie@9do-capt.test",
      },
    });

    // ── CLIENT_ACCENT : raison sociale ET commune accentuées (CS2).
    await client.client.create({
      data: {
        id: CLIENT_ACCENT,
        societe_id: societe.id,
        raison_sociale: "9DO-CAPT-Société Électricité",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ACCENT,
        societe_id: societe.id,
        client_id: CLIENT_ACCENT,
        agence_id: agence.id,
        libelle: "9DO-CAPT-Site électricité",
        commune: "Pouébo",
      },
    });

    // ── DEUX HOMONYMES (CS40).
    await client.client.create({
      data: {
        id: CLIENT_HOMO_1,
        societe_id: societe.id,
        raison_sociale: "9DO-CAPT-Homonyme",
        code_externe: "9DOA",
        actif: true,
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_HOMO_2,
        societe_id: societe.id,
        raison_sociale: "9DO-CAPT-Homonyme",
        code_externe: "9DOB",
        actif: true,
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

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${ETAPE}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`CS43 — vider le courriel d'un interlocuteur notifié par courriel, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto(`/clients/${CLIENT_TRIE}`);
    const ligne = page.locator(`li[data-contact="${CONTACT_COURRIEL}"]`);
    await ligne.locator("summary").click();
    const formulaire = ligne.locator(
      `form[action*="/api/contacts/${CONTACT_COURRIEL}/modifier"]`,
    );
    await formulaire.locator('input[name="email"]').fill("");
    await formulaire
      .getByRole("button", { name: t("contacts.action.modifier") })
      .click();
    // SUR LE CODE D'AVANT CE LOT (CS43), ce geste faisait 500 : la capture
    // documente alors la PANNE elle-même, jamais un refus nommé — donc
    // aucune assertion sur `main` ici, qui échouerait précisément sur le cas
    // que ce lot corrige.
    await page.waitForLoadState("networkidle");
    await capturer(page, "contact-refus-courriel", largeur);
  });

  test(`CS19 — la fiche client, sites et interlocuteurs triés, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto(`/clients/${CLIENT_TRIE}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "fiche-client-tries", largeur);
  });

  test(`CS2 — /clients, recherche sans accent, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto(
      `/clients?q=${encodeURIComponent("electricite")}&sans_equipement=1`,
    );
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "clients-recherche-accents", largeur);
  });

  test(`CS2 — /sites, recherche par commune sans accent, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto(
      `/sites?q=${encodeURIComponent("pouebo")}&sans_equipement=1`,
    );
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "sites-recherche-commune", largeur);
  });

  test(`CS40 — le sélecteur de client distingue deux homonymes, à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto("/sites/nouveau");
    const bloc = page.locator('[data-selecteur="client_id"]');
    const saisie = bloc.locator('input[type="text"]');
    await saisie.click();
    const motif = `q=${encodeURIComponent("9DO-CAPT-Homonyme")}`;
    await Promise.all([
      page.waitForResponse((reponse) => reponse.url().includes(motif)),
      saisie.fill("9DO-CAPT-Homonyme"),
    ]);
    await expect(
      bloc.locator('ul[role="listbox"] li[role="option"]').first(),
    ).toBeVisible();
    await capturer(page, "selecteur-homonymes", largeur);
  });
}
