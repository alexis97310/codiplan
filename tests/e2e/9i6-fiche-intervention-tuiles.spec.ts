import { createHash } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { enDuree } from "@/lib/calendar/duree";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9I6-FICHE-INTERVENTION-EN-TUILES — LES SIX TUILES DU RÉSUMÉ.
 *
 * Deux fixtures, à soi, préfixées `9I6-` : `FICHE_COMPLETE` (clôturée,
 * signée, commentaire, suite à donner, photo, machine) prouve que chaque
 * tuile montre la donnée réelle ; `FICHE_VIDE` (`a_planifier`, rien d'autre)
 * prouve l'état vide honnête — jamais une tuile absente (consigne du
 * ticket). Les deux s'éprouvent à 375 et 1280 px, sans débordement
 * horizontal, même mesure que `9eq-fiche-intervention.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9I6 = uuidv7();
const SITE_9I6 = uuidv7();
const CONTACT_9I6 = uuidv7();
const FICHE_COMPLETE = uuidv7();
const FICHE_VIDE = uuidv7();

/** Posée une fois, relue par l'assertion (`enDuree`) — jamais « 1 h 30 » recopié en dur. */
const DUREE_ESTIMEE_MIN = 90;

/** Un JPEG 1×1 minimal mais DÉCODABLE — pas six octets de remplissage : la
 * capture d'écran de ce lot montre une vraie vignette, jamais une icône
 * d'image cassée. */
const PHOTO_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMDAwMDAwQEBAQFBQUFBQcHBgYHBwsICQgJCAsRCwwMDAwLEQ8QDxAPEBoVFRUVGiAgHx8gICswKSkrMzs7Qz9DY2NrAgQFBQcHBwcJCQoKCgwMDA0NEBATEBQZGRwfIiUpKjFC/8QAPhAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRomJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmao6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z";

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
    // UNE MACHINE RÉELLE DE LA SOCIÉTÉ — jamais créée ici (il faudrait son
    // modèle, sa famille, sa marque) : même geste que
    // `fiche-intervention.spec.ts`, qui réutilise le parc déjà semé.
    const machine = await client.machine.findFirstOrThrow({
      where: { societe_id: reperes.societeId },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9I6,
        societe_id: reperes.societeId,
        raison_sociale: fr["9i6.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9I6,
        societe_id: reperes.societeId,
        client_id: CLIENT_9I6,
        agence_id: agence.id,
        libelle: fr["9i6.e2e.lieu"],
      },
    });
    await client.contact.create({
      data: {
        id: CONTACT_9I6,
        societe_id: reperes.societeId,
        client_id: CLIENT_9I6,
        site_id: SITE_9I6,
        nom: fr["9i6.e2e.contact_nom"],
        telephone: "687000010",
        roles: ["donneur_ordre"],
        canaux: ["telephone"],
        actif: true,
      },
    });

    // FICHE_COMPLETE — CLÔTURÉE, SIGNÉE, TOUTE DONNÉE PRÉSENTE (statut posé
    // directement : `intervention_cycle_de_vie` ne garde que les
    // TRANSITIONS, jamais la naissance — même remarque que
    // `bon-intervention.spec.ts`).
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "contact_id",
          "technicien_id", "type", "priorite", "statut", "date_planifiee",
          "duree_estimee_min", "description", "reference_client",
          "commentaire_technicien", "suite_a_donner", "mode_valorisation",
          "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               $7::uuid, 'curatif', 'p1', 'cloturee', '2026-01-15', $8,
               $9, $10, $11, $12, 'temps_passe', 'XPF', now())`,
      FICHE_COMPLETE,
      reperes.societeId,
      CLIENT_9I6,
      SITE_9I6,
      agence.id,
      CONTACT_9I6,
      reperes.technicienDucos,
      DUREE_ESTIMEE_MIN,
      fr["9i6.e2e.description"],
      fr["9i6.e2e.reference_client"],
      fr["9i6.e2e.commentaire"],
      fr["9i6.e2e.suite_a_donner"],
    );
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now())`,
      reperes.societeId,
      FICHE_COMPLETE,
      machine.id,
    );
    await client.interventionSignature.create({
      data: {
        id: uuidv7(),
        societe_id: reperes.societeId,
        intervention_id: FICHE_COMPLETE,
        issue: "signee",
        image_base64: `data:image/jpeg;base64,${PHOTO_BASE64}`,
        signataire_nom: fr["9i6.e2e.signataire_nom"],
        signataire_qualite: fr["9i6.e2e.signataire_qualite"],
      },
    });
    const octetsPhoto = Buffer.from(PHOTO_BASE64, "base64");
    const empreinte = createHash("sha256").update(octetsPhoto).digest("hex");
    await client.document.create({
      data: {
        id: uuidv7(),
        societe_id: reperes.societeId,
        intervention_id: FICHE_COMPLETE,
        classe: "client",
        libelle: fr["9i6.e2e.photo_libelle"],
        nom_fichier: "9i6-photo.jpg",
        type_mime: "image/jpeg",
        taille_octets: octetsPhoto.length,
        empreinte,
        objet_cle: `bd:${empreinte}`,
        octets: octetsPhoto,
      },
    });

    // FICHE_VIDE — `a_planifier`, rien d'autre que ce que `Intervention`
    // exige : ni machine, ni commentaire, ni suite à donner, ni photo, ni
    // signature.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "priorite", "statut", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'p3', 'a_planifier', 'temps_passe', 'XPF', now())`,
      FICHE_VIDE,
      reperes.societeId,
      CLIENT_9I6,
      SITE_9I6,
      agence.id,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // LE DOCUMENT D'ABORD — sa clé étrangère vers `intervention` est en
    // `Restrict` (BON-2), contrairement à `intervention_signature`, qui
    // suit en cascade.
    await client.$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = $1::uuid`,
      FICHE_COMPLETE,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9I6,
    );
    await client.contact.deleteMany({ where: { id: CONTACT_9I6 } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9I6 } });
    await client.client.deleteMany({ where: { id: CLIENT_9I6 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/** Aucune largeur fixe ne pousse la page au-delà du viewport — même mesure
 * que `9eq-fiche-intervention.spec.ts`. */
async function attendreAucunDebordement(
  page: import("@playwright/test").Page,
  largeur: number,
) {
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(largeur);
}

const TITRES_SIX_TUILES = [
  fr["intervention.client"],
  fr["intervention.machine"],
  fr["intervention.titre"],
  fr["intervention.commentaires_photos.titre"],
  fr["intervention.realisation.suite_a_donner"],
  fr["intervention.signataire.titre"],
] as const;

for (const largeur of [375, 1280] as const) {
  test(`à ${largeur} px, les six tuiles du résumé sont présentes, avec leur donnée, sans débordement — intervention clôturée et signée`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto(`/interventions/${FICHE_COMPLETE}`);

    for (const titre of TITRES_SIX_TUILES) {
      await expect(
        page.getByRole("heading", { name: titre, exact: true }),
      ).toBeVisible();
    }

    // CLIENT — raison sociale, site, adresse, contact : le contact ne
    // s'affiche plus qu'ICI, jamais une seconde fois dans « Sur place ».
    await expect(
      page.getByRole("link", { name: fr["9i6.e2e.client"] }),
    ).toBeVisible();
    await expect(page.getByText(fr["9i6.e2e.contact_nom"])).toHaveCount(1);

    // MACHINE — une machine est rattachée : jamais l'état vide.
    await expect(
      page.getByText(fr["intervention.machine.aucune_choisie"]),
    ).toHaveCount(0);

    // INTERVENTION — panne signalée, référence client, durée estimée
    // (`duree_estimee_min`, affichée nulle part avant ce lot).
    await expect(page.getByText(fr["9i6.e2e.description"])).toBeVisible();
    await expect(page.getByText(fr["9i6.e2e.reference_client"])).toBeVisible();
    const ligneDuree = page.locator("dt", {
      hasText: fr["intervention.duree_estimee"],
    });
    await expect(ligneDuree).toBeVisible();
    await expect(
      ligneDuree.locator("xpath=following-sibling::dd[1]"),
    ).toContainText(enDuree(DUREE_ESTIMEE_MIN));

    // COMMENTAIRES ET PHOTOS — le commentaire ET la photo, au même endroit.
    await expect(page.getByText(fr["9i6.e2e.commentaire"])).toBeVisible();
    await expect(page.getByText(fr["9i6.e2e.photo_libelle"])).toBeVisible();
    await expect(
      page.getByText(fr["intervention.bon.aucune_photo"]),
    ).toHaveCount(0);

    // SUITE À DONNER.
    await expect(page.getByText(fr["9i6.e2e.suite_a_donner"])).toBeVisible();

    // SIGNATAIRE — nom et date, jamais l'état vide.
    await expect(page.getByText(fr["9i6.e2e.signataire_nom"])).toBeVisible();
    await expect(
      page.getByText(fr["intervention.bon.aucune_signature"]),
    ).toHaveCount(0);

    await attendreAucunDebordement(page, largeur);
  });

  test(`à ${largeur} px, les six tuiles du résumé restent présentes à l'état VIDE, honnêtement — intervention non commencée`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await page.goto(`/interventions/${FICHE_VIDE}`);

    for (const titre of TITRES_SIX_TUILES) {
      await expect(
        page.getByRole("heading", { name: titre, exact: true }),
      ).toBeVisible();
    }

    await expect(
      page.getByText(fr["intervention.machine.aucune_choisie"]),
    ).toBeVisible();
    await expect(
      page.getByText(fr["intervention.bon.aucun_commentaire"]),
    ).toBeVisible();
    await expect(
      page.getByText(fr["intervention.bon.aucune_photo"]),
    ).toBeVisible();
    await expect(
      page.getByText(fr["intervention.bon.aucune_suite"]),
    ).toBeVisible();
    await expect(
      page.getByText(fr["intervention.bon.aucune_signature"]),
    ).toBeVisible();

    await attendreAucunDebordement(page, largeur);
  });
}
