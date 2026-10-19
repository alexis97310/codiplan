import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "../setup/base";
import { reperesDeLaScene } from "../setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../setup/scene";

/**
 * L'OUVERTURE À FROID, DE BOUT EN BOUT (9F4H4B-OUVERTURE-A-FROID, point 4 ;
 * décision D120 d'Alexis).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9F4H4B-` — même discipline que 9F4H3
 *
 * Un client, un site, une intervention « affectée » et une prestation active
 * — créés en `beforeAll`, supprimés en `afterAll`, aucune ligne ajoutée au
 * semis partagé.
 *
 * ## LA LIMITE MESURÉE DU POINT 2, ÉPROUVÉE ICI PLUTÔT QUE CONTOURNÉE
 *
 * `/api/terrain/instantane` (hors territoire de ce lot) n'emporte pas le
 * CATALOGUE des prestations — seulement les libellés de celles déjà faites,
 * sans `id` : rien à cocher sans `id` réel. Ce scénario n'essaie donc PAS de
 * cocher une prestation hors réseau (le ticket l'envisageait ; mesuré
 * impossible honnêtement sans toucher une route `app/api/**`, hors
 * territoire) — il vérifie à la place que le message « catalogue
 * indisponible » s'affiche, et qu'aucune prestation n'est écrite en base.
 *
 * ## AUCUN COMPTEUR ARRÊTÉ AVANT « TERMINER » — MAIS ANTIDATÉ, MESURÉ NÉCESSAIRE
 *
 * `minutesConnues=0` (la fiche froide ne connaît pas le temps déjà mesuré
 * côté serveur — même limite) : un segment encore OUVERT compte pour « au
 * moins une minute » dans le verdict LOCAL de `peutTerminer`
 * (`rapport-automatique.tsx`), ce qui laisse le bouton « Terminer » mettre le
 * geste en file sans le refuser à l'écran. **Mesuré (et non une hypothèse)**
 * : ce verdict local ne change rien à ce que le SERVEUR mesure une fois la
 * file réellement envoyée — démarrer puis terminer en quelques secondes,
 * sans antidater, donne une durée réelle quasi nulle et `peutTerminer`
 * refuse alors `temps_manquant` à l'envoi. Même antidatation que
 * `9f4h3-mode-avion.spec.ts` ci-dessous, pour la même raison.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9F4H4B = uuidv7();
const SITE_9F4H4B = uuidv7();
const INTERVENTION_9F4H4B = uuidv7();
const PRESTATION_9F4H4B = uuidv7();

let societeId: string;
let technicienId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9F4H4B,
        societe_id: societeId,
        raison_sociale: "9F4H4B client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9F4H4B,
        societe_id: societeId,
        client_id: CLIENT_9F4H4B,
        agence_id: agence.id,
        libelle: "9F4H4B site",
      },
    });
    await client.prestation.create({
      data: {
        id: PRESTATION_9F4H4B,
        societe_id: societeId,
        code: "9F4H4B-PREST",
        libelle: fr["terrain.e2e.prestation_libelle"],
        actif: true,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9F4H4B,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: CLIENT_9F4H4B,
        site_id: SITE_9F4H4B,
        technicien_id: technicienId,
        type: "curatif",
        priorite: "p3",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F4H4B — intervention forgée par l'épreuve",
        statut: "affectee",
        // SANS DATE (9F2B) — évite toute dépendance à la fenêtre
        // [aujourd'hui, J+8[ de « Ma journée ».
        date_planifiee: null,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9F4H4B,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_9F4H4B,
    );
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_9F4H4B },
    });
    await client.prestation.deleteMany({ where: { id: PRESTATION_9F4H4B } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9F4H4B } });
    await client.client.deleteMany({ where: { id: CLIENT_9F4H4B } });
  } finally {
    await client.$disconnect();
  }
});

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

/** La copie IndexedDB existe-t-elle déjà sur cette page ? (même idiome que
 * `9f4h1-consultation.spec.ts`.) */
async function copiePosee(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const requete = indexedDB.open("codiplan-terrain");
        requete.onerror = () => resolve(false);
        requete.onsuccess = () => {
          const base = requete.result;
          if (!base.objectStoreNames.contains("instantane")) {
            base.close();
            resolve(false);
            return;
          }
          const lecture = base
            .transaction("instantane", "readonly")
            .objectStore("instantane")
            .get("actuel");
          lecture.onsuccess = () => {
            base.close();
            resolve(lecture.result !== undefined);
          };
          lecture.onerror = () => {
            base.close();
            resolve(false);
          };
        };
      }),
  );
}

async function attendreLaCopie(page: Page): Promise<void> {
  await expect.poll(() => copiePosee(page), { timeout: 10_000 }).toBe(true);
}

const COMMENTAIRE_EPREUVE = fr["terrain.e2e.commentaire"];
const SUITE_EPREUVE = fr["terrain.e2e.suite_a_donner"];
const SIGNATAIRE_EPREUVE = fr["terrain.e2e.signataire_nom"];

/** Un PNG minimal (1×1, transparent), écrit dans un fichier temporaire. */
function fichierPhotoDEpreuve(): string {
  const dossier = mkdtempSync(join(tmpdir(), "codiplan-9f4h4b-"));
  const chemin = join(dossier, "photo-9f4h4b.png");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  writeFileSync(chemin, png);
  return chemin;
}

async function tracerLaSignature(page: Page): Promise<void> {
  await page.locator("canvas").evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    const envoyer = (type: string, x: number, y: number): void => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: rectangle.left + x,
          clientY: rectangle.top + y,
          pointerId: 1,
        }),
      );
    };
    envoyer("pointerdown", 20, 20);
    envoyer("pointermove", 100, 80);
    envoyer("pointermove", 200, 30);
    envoyer("pointerup", 200, 30);
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F4H4B-OUVERTURE-A-FROID/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

test("ouverture à froid : compteur, rapport, photo, signature et Terminer, tous saisis sur la coquille jamais ouverte en ligne, puis envoyés sans perte", async ({
  page,
  context,
}) => {
  // ── 1. EN LIGNE : UN PASSAGE SUR /terrain POSE L'INSTANTANÉ ET LA COQUILLE ─
  await connecterLeTechnicien(page);
  await attendreLaCopie(page);

  // ── 2. UNE NOUVELLE PAGE, HORS RÉSEAU, NAVIGATION DIRECTE VERS LA COQUILLE ─
  const pageFroide = await context.newPage();
  await context.setOffline(true);
  await pageFroide.goto("/terrain-hors-reseau");
  await expect(
    pageFroide.getByRole("heading", { name: fr["terrain.hors_reseau.titre"] }),
  ).toBeVisible();

  // ── 3. OUVRE LA FICHE ───────────────────────────────────────────────────
  await pageFroide.locator(`a[href*="${INTERVENTION_9F4H4B}"]`).click();
  await expect(
    pageFroide.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  await capturer(pageFroide, "fiche-de-travail-a-froid", 375);
  await capturer(pageFroide, "fiche-de-travail-a-froid", 1280);

  // ── 4. DÉMARRE LE COMPTEUR ──────────────────────────────────────────────
  await pageFroide
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();
  await expect(
    pageFroide.getByRole("button", { name: fr["terrain.compteur.pause"] }),
  ).toBeVisible();

  // ANTIDATE L'ENTRÉE « DÉMARRER » DE 90 MINUTES (même nécessité que
  // `9f4h3-mode-avion.spec.ts`) — le verdict LOCAL de « Terminer » traite un
  // segment encore ouvert comme « au moins une minute » (voir le docblock de
  // ce fichier), mais ce n'est qu'un repli d'AFFICHAGE : une fois la saisie
  // réellement envoyée, le SERVEUR mesure la vraie durée entre les deux
  // instants d'appareil. Démarrer puis terminer en quelques secondes, sans
  // antidater, donne une durée réelle quasi nulle et `peutTerminer` refuse
  // alors `temps_manquant` — MESURÉ, pas une hypothèse.
  await pageFroide.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const requete = indexedDB.open("codiplan-terrain");
      requete.onerror = () => reject(requete.error);
      requete.onsuccess = () => {
        const base = requete.result;
        const transaction = base.transaction("file", "readwrite");
        const magasin = transaction.objectStore("file");
        const lecture = magasin.getAll();
        lecture.onsuccess = () => {
          type Entree = {
            readonly id: string;
            readonly geste: { readonly type: string; readonly action?: string };
            readonly instantAppareil: string;
          };
          const demarrer = (lecture.result as Entree[]).find(
            (e) => e.geste.type === "compteur" && e.geste.action === "demarrer",
          );
          if (demarrer !== undefined) {
            magasin.put({
              ...demarrer,
              instantAppareil: new Date(Date.now() - 90 * 60_000).toISOString(),
            });
          }
        };
        transaction.oncomplete = () => {
          base.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });

  // ── 5. RAPPORT ──────────────────────────────────────────────────────────
  await pageFroide
    .getByLabel(fr["terrain.rapport.commentaire_libelle"])
    .fill(COMMENTAIRE_EPREUVE);
  await pageFroide
    .getByLabel(fr["terrain.rapport.suite_libelle"])
    .fill(SUITE_EPREUVE);
  await pageFroide.getByLabel(fr["terrain.rapport.suite_libelle"]).blur();
  await expect(
    pageFroide.getByText(fr["terrain.auto.hors_ligne"]).first(),
  ).toBeVisible();

  // ── 6. LA LIMITE MESURÉE : AUCUN CATALOGUE DE PRESTATIONS HORS RÉSEAU ──
  await expect(
    pageFroide.getByText(
      fr["terrain.prestations.catalogue_indisponible_hors_reseau"],
    ),
  ).toBeVisible();

  // ── 7. UNE PHOTO AJOUTÉE ────────────────────────────────────────────────
  await pageFroide
    .locator('input[type="file"]')
    .setInputFiles(fichierPhotoDEpreuve());
  await pageFroide
    .getByRole("button", { name: fr["terrain.photos.ajouter"] })
    .click();
  await expect(
    pageFroide.getByText(fr["terrain.auto.hors_ligne"]).last(),
  ).toBeVisible();

  // ── 8. SIGNATURE DU CLIENT ──────────────────────────────────────────────
  await pageFroide
    .getByRole("button", { name: fr["terrain.signature.option_signee"] })
    .click();
  await pageFroide
    .getByLabel(fr["terrain.signature.nom_libelle"])
    .fill(SIGNATAIRE_EPREUVE);
  await tracerLaSignature(pageFroide);

  // ── 9. TERMINER — ACCEPTÉ LOCALEMENT, SANS AVOIR ARRÊTÉ LE COMPTEUR ─────
  await pageFroide
    .getByRole("button", { name: fr["terrain.terminer.bouton"] })
    .click();
  await expect(
    pageFroide.getByText(fr["terrain.terminer.en_attente_envoi"]),
  ).toBeVisible();

  await capturer(pageFroide, "fiche-de-travail-a-froid-en-attente", 375);
  await capturer(pageFroide, "fiche-de-travail-a-froid-en-attente", 1280);

  // ── 10. LA COQUILLE RECHARGÉE, TOUJOURS HORS RÉSEAU : RIEN NE S'EST PERDU ─
  await pageFroide.reload();
  await expect(
    pageFroide.getByRole("button", { name: fr["terrain.compteur.pause"] }),
  ).toBeVisible();
  await expect(
    pageFroide.getByText(fr["terrain.terminer.en_attente_envoi"]),
  ).toBeVisible();

  const entreesEnFile = await pageFroide.evaluate(
    () =>
      new Promise<readonly { readonly geste: { readonly type: string } }[]>(
        (resolve, reject) => {
          const requete = indexedDB.open("codiplan-terrain");
          requete.onerror = () => reject(requete.error);
          requete.onsuccess = () => {
            const base = requete.result;
            const lecture = base
              .transaction("file", "readonly")
              .objectStore("file")
              .getAll();
            lecture.onsuccess = () => {
              base.close();
              resolve(lecture.result);
            };
            lecture.onerror = () => reject(lecture.error);
          };
        },
      ),
  );
  // démarrer, rapport, photo, signature, terminer — AUCUNE prestation (limite
  // mesurée du point 2).
  expect(entreesEnFile).toHaveLength(5);
  expect(entreesEnFile.some((e) => e.geste.type === "prestations")).toBe(false);

  // ── 11. LE RÉSEAU REVIENT : « /terrain », PUIS « ENVOYER » ──────────────
  await context.setOffline(false);
  await pageFroide.goto("/terrain");
  await pageFroide.getByRole("button", { name: /^Envoyer \(\d+\)$/ }).click();
  await expect(
    pageFroide.getByText(fr["terrain.file.tout_envoye"]),
  ).toBeVisible();

  // ── 12. EN BASE : UN SEUL SEGMENT SAISI HORS RÉSEAU, LA SUITE AU COMPLET ─
  const verif = admin();
  try {
    const segments = await verif.segmentTravail.findMany({
      where: { intervention_id: INTERVENTION_9F4H4B },
      select: { saisi_hors_reseau: true, debut: true, fin: true },
    });
    expect(segments).toHaveLength(1);
    expect(segments[0].saisi_hors_reseau).toBe(true);
    expect(segments[0].fin).not.toBeNull();

    const intervention = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_9F4H4B },
      select: {
        statut: true,
        commentaire_technicien: true,
        suite_a_donner: true,
        temps_mesure_min: true,
        prestations_realisees: { select: { prestation_id: true } },
        signatures: { select: { issue: true } },
        documents: { select: { id: true } },
      },
    });
    expect(intervention.statut).toBe("terminee");
    expect(intervention.commentaire_technicien).toBe(COMMENTAIRE_EPREUVE);
    expect(intervention.suite_a_donner).toBe(SUITE_EPREUVE);
    expect(intervention.temps_mesure_min).not.toBeNull();
    // LA LIMITE MESURÉE : aucune prestation n'a pu être cochée hors réseau.
    expect(intervention.prestations_realisees).toHaveLength(0);
    expect(intervention.signatures).toHaveLength(1);
    expect(intervention.signatures[0].issue).toBe("signee");
    expect(intervention.documents).toHaveLength(1);
  } finally {
    await verif.$disconnect();
  }

  // ── 13. SANS INSTANTANÉ : LE MESSAGE EXISTANT DE 9F4H1, AUCUN GESTE ─────
  // Même technique que `9f4h1-consultation.spec.ts` (sa cinquième étape) :
  // la DÉCONNEXION, EN LIGNE, efface la copie locale
  // (`EffacementCopieADeconnexion`) — un contexte NEUF, lui, n'aurait pas
  // encore de service worker installé, et ne servirait rien du tout hors
  // réseau. Le SW de CETTE page, posé depuis l'étape 1, reste actif.
  await pageFroide.goto("/terrain/profil");
  await pageFroide
    .locator("main")
    .getByRole("button", { name: fr["nav.deconnexion"] })
    .click();
  await expect(pageFroide).toHaveURL(/\/connexion/);

  await context.setOffline(true);
  await pageFroide.goto("/terrain-hors-reseau");
  await expect(
    pageFroide.getByText(fr["terrain.hors_reseau.aucune_copie"]),
  ).toBeVisible();
  await expect(pageFroide.getByRole("button")).toHaveCount(0);
  await capturer(pageFroide, "sans-instantane", 375);
  await capturer(pageFroide, "sans-instantane", 1280);
  await context.setOffline(false);
});
