import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { lireFuseau, maintenant, jourSuivant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * CAPTURES APRÈS (consigne d'Alexis du 13/11, reprise par ce ticket au point
 * 5) — prises PENDANT ces mêmes scénarios, jamais une seconde navigation :
 * l'AVANT est repris des captures « après » de 9L61
 * (`docs/propositions/9L61-PRET-2-ECRANS-BUREAU/captures/fiche-intervention-
 * apres-*.png`, `fiche-client-apres-*.png`) — l'état de CES MÊMES écrans
 * juste avant que ce lot ne les touche.
 */
const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L62-PRET-3-BON-SIGNE/captures",
);

async function capturer(
  page: import("@playwright/test").Page,
  nom: string,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}.png`),
    fullPage: true,
  });
}

/**
 * 9L62-PRET-3-BON-SIGNE (D287) — LA REMISE AU CLIENT ET LE BON DE PRÊT FIGÉ.
 *
 * Trois faits, chacun son scénario (point 5 du ticket) : une remise SIGNÉE
 * (canevas, pas de JavaScript de validation côté client — le serveur ferme
 * l'alternative), son PDF téléchargé, et une remise SANS SIGNATURE, motif
 * obligatoire. Chaque intervention est propre à ce fichier — aucune ne vient
 * de 9L61 — pour qu'un cycle ne dépende jamais de l'état laissé par l'autre.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9L62 = uuidv7();
const SITE_9L62 = uuidv7();

/**
 * UNE INTERVENTION PAR LARGEUR, jamais partagée entre les deux (à la
 * différence de 9L61, dont le cycle sortie→retour revient à l'état
 * « aucun prêt en cours ») : ici, le prêt reste délibérément EN COURS après
 * chaque scénario (rien ne prouve le retour) — la réutiliser à la largeur
 * suivante retrouverait la carte « en cours », jamais le formulaire de
 * sortie.
 */
const INTERVENTION_SIGNEE: Record<number, string> = {
  1280: uuidv7(),
  375: uuidv7(),
};
const INTERVENTION_SANS_SIGNATURE: Record<number, string> = {
  1280: uuidv7(),
  375: uuidv7(),
};

/** Les désignations créées — retrouvées au nettoyage, jamais par un préfixe lisible (L0-11, voir le docblock de 9L61). */
const DESIGNATIONS_CREEES: string[] = [];

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9L62,
        societe_id: reperes.societeId,
        raison_sociale: "9L62 client bon de prêt",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L62,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L62,
        agence_id: agence.id,
        libelle: "9L62 site bon de prêt",
        adresse: { rue: "1 rue de l'épreuve" },
        commune: "Nouméa",
      },
    });

    for (const id of [
      ...Object.values(INTERVENTION_SIGNEE),
      ...Object.values(INTERVENTION_SANS_SIGNATURE),
    ]) {
      await client.intervention.create({
        data: {
          id,
          societe_id: reperes.societeId,
          agence_id: agence.id,
          client_id: CLIENT_9L62,
          site_id: SITE_9L62,
          technicien_id: reperes.technicienDucos,
          type: "curatif",
          priorite: "p3",
          statut: "planifiee",
          duree_estimee_min: 60,
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
          description: "9L62-capture-bon-de-pret",
        },
      });
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    const prets = await client.pretEquipement.findMany({
      where: { client_id: CLIENT_9L62 },
      select: { id: true, bon_document_id: true },
    });
    await client.pretEquipement.deleteMany({
      where: { id: { in: prets.map((p) => p.id) } },
    });
    const documentIds = prets
      .map((p) => p.bon_document_id)
      .filter((id): id is string => id !== null);
    if (documentIds.length > 0) {
      await client.document.deleteMany({ where: { id: { in: documentIds } } });
    }
    await client.appareilPret.deleteMany({
      where: { designation: { in: DESIGNATIONS_CREEES } },
    });
    await client.intervention.deleteMany({
      where: { client_id: CLIENT_9L62 },
    });
    await client.site.deleteMany({ where: { id: SITE_9L62 } });
    await client.client.deleteMany({ where: { id: CLIENT_9L62 } });
  } finally {
    await client.$disconnect();
  }
});

async function creerUnAppareilDuParc(
  page: import("@playwright/test").Page,
): Promise<string> {
  const designation = uuidv7();
  DESIGNATIONS_CREEES.push(designation);
  await page.goto("/parametres/prets");
  await page.getByRole("link", { name: fr["prets.creer_action"] }).click();
  await page.getByLabel(fr["prets.champ_designation"]).fill(designation);
  await page.getByRole("button", { name: fr["prets.enregistrer"] }).click();
  await expect(
    page.getByText(designation).and(page.locator(":visible")).first(),
  ).toBeVisible();
  return designation;
}

/**
 * Trace un trait sur le canevas de signature — des `PointerEvent` DISPATCHÉS
 * DIRECTEMENT dans la page, jamais `page.mouse` : mesuré, une souris simulée
 * par le pilote CDP ne déclenche pas de façon fiable les gestionnaires
 * `onPointerDown`/`onPointerMove`/`onPointerUp` de React sur un `<canvas>`
 * dans ce harnais. Trois événements, les mêmes que ceux que
 * `components/prets/zone-signature.tsx` écoute, suffisent à poser un
 * `data:image/png;base64,...` dans le champ caché.
 */
async function signerSurLeCanevas(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.evaluate(() => {
    const canevas = document.querySelector("canvas");
    if (canevas === null) {
      throw new Error("le canevas de signature n'est pas dans la page");
    }
    const rectangle = canevas.getBoundingClientRect();
    const envoyer = (type: string, x: number, y: number) => {
      canevas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          clientX: x,
          clientY: y,
        }),
      );
    };
    envoyer("pointerdown", rectangle.left + 10, rectangle.top + 10);
    envoyer(
      "pointermove",
      rectangle.left + rectangle.width - 10,
      rectangle.top + rectangle.height - 10,
    );
    envoyer(
      "pointerup",
      rectangle.left + rectangle.width - 10,
      rectangle.top + rectangle.height - 10,
    );
  });
}

for (const largeur of [1280, 375] as const) {
  test(`à ${largeur} px — une remise SIGNÉE porte un bon téléchargeable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirUneSession(page);

    const designation = await creerUnAppareilDuParc(page);

    const reperes = await reperesDeLaScene();
    const fuseau = lireFuseau(reperes.fuseau);
    const aujourdhui = maintenant(fuseau).local;
    const dansCinqJours = jourSuivant(aujourdhui, 5);

    await page.goto(`/interventions/${INTERVENTION_SIGNEE[largeur]}`);
    await page
      .getByLabel(fr["intervention.pret.champ_appareil"])
      .selectOption({ label: designation });
    await page
      .getByLabel(fr["intervention.pret.champ_date_sortie"])
      .fill(cleDeJour(aujourdhui));
    await page
      .getByLabel(fr["intervention.pret.champ_retour_prevu"])
      .fill(cleDeJour(dansCinqJours));
    await page
      .getByLabel(fr["intervention.pret.champ_etat_depart"])
      .fill("Bon état");
    await page
      .getByLabel(fr["intervention.pret.champ_signataire_nom"])
      .fill("Jean Essai");
    await page
      .getByLabel(fr["intervention.pret.champ_signataire_qualite"])
      .fill("Gérant");
    await signerSurLeCanevas(page);
    await page
      .getByRole("button", { name: fr["intervention.pret.preter_action"] })
      .click();

    await expect(
      page.getByRole("heading", { name: fr["intervention.pret.titre"] }),
    ).toBeVisible();
    await expect(
      page.getByText(fr["intervention.pret.signe"], { exact: true }).first(),
    ).toBeVisible();
    await capturer(page, `fiche-intervention-apres-${largeur}`);

    const telechargement = page.getByRole("link", {
      name: fr["intervention.pret.bon_telecharger_action"],
    });
    await expect(telechargement).toBeVisible();
    const href = await telechargement.getAttribute("href");
    expect(href).not.toBeNull();

    // LE PDF EST RÉELLEMENT TÉLÉCHARGEABLE — même session (cookies partagés),
    // la même garantie qu'un clic du bureau.
    const reponse = await page.request.get(href as string);
    expect(reponse.status()).toBe(200);
    expect(reponse.headers()["content-type"]).toBe("application/pdf");
    const octets = await reponse.body();
    expect(octets.subarray(0, 4).toString("latin1")).toBe("%PDF");

    await page.goto(`/clients/${CLIENT_9L62}`);
    await expect(
      page.getByRole("heading", { name: fr["client.prets.titre"] }),
    ).toBeVisible();
    await capturer(page, `fiche-client-apres-${largeur}`);
  });

  test(`à ${largeur} px — une remise SANS SIGNATURE exige un motif, et porte un bon quand même`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1000 });
    await ouvrirUneSession(page);

    const designation = await creerUnAppareilDuParc(page);

    const reperes = await reperesDeLaScene();
    const fuseau = lireFuseau(reperes.fuseau);
    const aujourdhui = maintenant(fuseau).local;
    const dansCinqJours = jourSuivant(aujourdhui, 5);

    await page.goto(`/interventions/${INTERVENTION_SANS_SIGNATURE[largeur]}`);
    await page
      .getByLabel(fr["intervention.pret.champ_appareil"])
      .selectOption({ label: designation });
    await page
      .getByLabel(fr["intervention.pret.champ_date_sortie"])
      .fill(cleDeJour(aujourdhui));
    await page
      .getByLabel(fr["intervention.pret.champ_retour_prevu"])
      .fill(cleDeJour(dansCinqJours));
    await page
      .getByLabel(fr["intervention.pret.champ_etat_depart"])
      .fill("Bon état");
    // AUCUN MOTIF, AUCUNE SIGNATURE — le serveur refuse, rien n'est créé.
    await page
      .getByRole("button", { name: fr["intervention.pret.preter_action"] })
      .click();
    await expect(
      page.getByText(fr["intervention.pret.refus.saisie"]),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: fr["intervention.pret.retour_action"],
      }),
    ).toHaveCount(0);

    // LE REFUS RECHARGE LA FICHE (redirection serveur) — le formulaire
    // repart vierge, TOUS les champs obligatoires se remplissent à nouveau,
    // le motif ÉTANT LE SEUL AJOUT par rapport à la tentative refusée.
    await page
      .getByLabel(fr["intervention.pret.champ_appareil"])
      .selectOption({ label: designation });
    await page
      .getByLabel(fr["intervention.pret.champ_date_sortie"])
      .fill(cleDeJour(aujourdhui));
    await page
      .getByLabel(fr["intervention.pret.champ_retour_prevu"])
      .fill(cleDeJour(dansCinqJours));
    await page
      .getByLabel(fr["intervention.pret.champ_etat_depart"])
      .fill("Bon état");
    await page
      .getByLabel(fr["intervention.pret.champ_motif_absence_signature"])
      .fill("Client absent au moment de la remise.");
    await page
      .getByRole("button", { name: fr["intervention.pret.preter_action"] })
      .click();

    await expect(
      page.getByRole("heading", { name: fr["intervention.pret.titre"] }),
    ).toBeVisible();
    // TEXTE EXACT (pas une sous-chaîne) : le libellé du champ motif contient
    // lui-même « remis sans signature », une correspondance en sous-chaîne
    // s'y tromperait sans qu'un prêt n'existe.
    await expect(
      page
        .getByText(fr["intervention.pret.non_signe"], { exact: true })
        .first(),
    ).toBeVisible();

    const telechargement = page.getByRole("link", {
      name: fr["intervention.pret.bon_telecharger_action"],
    });
    await expect(telechargement).toBeVisible();
  });
}
