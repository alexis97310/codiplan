import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { inviterClientAuPortail } from "@/lib/auth/lien-d-acces";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration, urlApplicative } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9L45-EPREUVES-CAPTURES-9I8C-9I8F1 — les captures nommées « NON FAIT » dans
 * la passation de 9I8C-INFOS-MACHINE-FICHE-ET-BON (point 6) : la fiche
 * machine (bureau), la tuile Machine de la fiche intervention, le bon —
 * INTERNE et CLIENT (portail) — et la fiche terrain, toutes avec une année de
 * fabrication renseignée et un état de garantie.
 *
 * **Aucun AVANT** : le code de 9I8C n'a pas changé depuis sa livraison
 * (31/10/2026) — ce lot ne fait que prendre les captures qui manquaient,
 * jamais une comparaison avant/après.
 *
 * SA PROPRE SCÈNE, préfixée `9I8C-`, jamais celle d'un autre fichier — même
 * doctrine que `captures-9j08a-portail-bon.spec.ts` (invitation portail) et
 * `captures-9i8f-statut-machine-modifiable.spec.ts` (machine jetable). DEUX
 * machines, pour les deux états de garantie (décision d'Alexis du 31/10,
 * reprise dans la passation 9I8C « Pour les prendre à la main ») : l'une
 * SOUS garantie (date future), l'autre HORS garantie (date passée) — seule
 * cette dernière porte l'intervention, le bon et la fiche terrain.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9I8C ?? "";
const EMAIL_PORTAIL = "9i8c-portail-bon@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9i8c-portail-bon";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}--${largeur}.png`),
    fullPage: true,
  });
}

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

/** Même lecture que `captures-9j08a-portail-bon.spec.ts`. */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

const CLIENT_ID = "918cfeed-0000-7000-8000-000000000001";
const SITE_ID = "918cfeed-0000-7000-8000-000000000002";
const MACHINE_HORS_GARANTIE_ID = "918cfeed-0000-7000-8000-000000000003";
const MACHINE_SOUS_GARANTIE_ID = "918cfeed-0000-7000-8000-000000000004";
const RAISON_SOCIALE = "Client 9I8C — infos machine";
const LIBELLE_SITE = "Lieu 9I8C — infos machine";
const NUMERO_SERIE_HORS_GARANTIE = fr["9i8c.e2e.numero_serie_hors_garantie"];
const NUMERO_SERIE_SOUS_GARANTIE = fr["9i8c.e2e.numero_serie_sous_garantie"];

let interventionId = "";

async function nettoyer(client: PrismaClient): Promise<void> {
  // L'INTERVENTION SEULE, JAMAIS `intervention_machine` À PART
  // (9L14-FIGE-A-LA-CLOTURE) — `intervention_machine` CASCADE depuis
  // `intervention`, jamais l'inverse ; même patron que
  // `tests/e2e/9l04j-prestations-par-materiel.spec.ts` (afterAll).
  if (interventionId !== "") {
    await client.intervention.deleteMany({ where: { id: interventionId } });
  }
  await client.machine.deleteMany({
    where: { id: { in: [MACHINE_HORS_GARANTIE_ID, MACHINE_SOUS_GARANTIE_ID] } },
  });
  // LE RATTACHEMENT PORTAIL AVANT LE CLIENT — `utilisateur_client` porte une
  // clé étrangère vers lui (même raison que `captures-9j08a-portail-bon.
  // spec.ts`, qui n'a jamais ce problème : il invite un client DU SEMIS,
  // jamais effacé par la scène).
  await client.utilisateurClient.deleteMany({
    where: { client_id: CLIENT_ID },
  });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
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
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: RAISON_SOCIALE,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_HORS_GARANTIE_ID,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        numero_serie: NUMERO_SERIE_HORS_GARANTIE,
        qr_token: engendrerJetonQr(),
        annee_fabrication: 1998,
        date_vente: new Date("2010-01-15"),
        date_mise_en_service: new Date("2010-02-01"),
        garantie_fin: new Date("2015-01-15"),
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_SOUS_GARANTIE_ID,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        numero_serie: NUMERO_SERIE_SOUS_GARANTIE,
        qr_token: engendrerJetonQr(),
        annee_fabrication: 2024,
        date_vente: new Date("2024-06-01"),
        date_mise_en_service: new Date("2024-06-15"),
        garantie_fin: new Date("2099-01-01"),
      },
    });

    const utilisateurAdmin = await client.utilisateur.findFirstOrThrow({
      where: { email: "admin.societe@codima.test" },
      select: { id: true },
    });

    // LA MACHINE EST RATTACHÉE AVANT LA CLÔTURE (9L14-FIGE-A-LA-CLOTURE) —
    // une intervention CLÔTURÉE refuse tout INSERT sur `intervention_machine`
    // (« figée à la clôture »). L'intervention naît donc `planifiee`, reçoit
    // sa machine, puis traverse la chaîne que D8 impose jusqu'à `cloturee`
    // (même chaîne que `tests/isolation/intervention-machines.test.ts`).
    interventionId = uuidv7();
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "technicien_id", "type", "statut", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 'curatif', 'planifiee', 60, now())`,
      interventionId,
      reperes.societeId,
      CLIENT_ID,
      SITE_ID,
      agence.id,
      reperes.technicienDucos,
    );
    await client.interventionMachine.create({
      data: {
        id: uuidv7(),
        societe_id: reperes.societeId,
        intervention_id: interventionId,
        machine_id: MACHINE_HORS_GARANTIE_ID,
      },
    });
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'affectee' WHERE "id" = $1::uuid`,
      interventionId,
    );
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'en_cours' WHERE "id" = $1::uuid`,
      interventionId,
    );
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'terminee', "rapport_valide_par" = $2::uuid, "rapport_valide_le" = now() WHERE "id" = $1::uuid`,
      interventionId,
      utilisateurAdmin.id,
    );
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'cloturee', "temps_valide_min" = 60, "cloturee_le" = now() WHERE "id" = $1::uuid`,
      interventionId,
    );

    // LE COMPTE PORTAIL (bon version client) — même recette que
    // `captures-9j08a-portail-bon.spec.ts`.
    const contexteAdmin: ContexteSession = {
      utilisateurId: utilisateurAdmin.id,
      societeId: reperes.societeId,
      role: Role.admin_societe,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };
    const applicatif = new PrismaClient({
      datasources: { db: { url: urlApplicative() } },
    });
    try {
      const invitation = await inviterClientAuPortail(
        contexteAdmin,
        CLIENT_ID,
        EMAIL_PORTAIL,
        applicatif,
      );
      if (!invitation.accepte) {
        throw new Error(
          `L'invitation du compte de l'épreuve a été refusée : ${invitation.motif}.`,
        );
      }
      if (!invitation.enAttente) {
        if (invitation.url === null) {
          throw new Error(
            "L'invitation n'a rendu aucun jeton : la scène ne peut pas ouvrir " +
              "le compte portail de l'épreuve.",
          );
        }
        const jeton = jetonDeLUrl(invitation.url);
        if (jeton === null) {
          throw new Error(
            "Le jeton n'a pas pu être extrait de l'URL d'invitation.",
          );
        }
        const issue = await choisirLePremierMotDePasse({
          jeton,
          motDePasse: MOT_DE_PASSE_PORTAIL,
          confirmation: MOT_DE_PASSE_PORTAIL,
        });
        if (issue.issue !== "abouti") {
          throw new Error(
            `Le premier accès du compte portail de l'épreuve a été refusé : ${issue.issue}.`,
          );
        }
      }
    } finally {
      await applicatif.$disconnect();
    }
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

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

async function ouvrirLaSessionPortail(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL_PORTAIL);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_PORTAIL);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForURL(/\/(arrivee|portail)/);
}

for (const largeur of [1280, 375] as const) {
  test(`fiche machine (bureau) — hors garantie, année de fabrication (${largeur}px)`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto(`/parc/${MACHINE_HORS_GARANTIE_ID}`);
    await expect(
      page.getByText(NUMERO_SERIE_HORS_GARANTIE).first(),
    ).toBeVisible();
    await capturer(page, "fiche-machine-hors-garantie", largeur);
  });

  test(`fiche machine (bureau) — sous garantie (${largeur}px)`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto(`/parc/${MACHINE_SOUS_GARANTIE_ID}`);
    await expect(
      page.getByText(NUMERO_SERIE_SOUS_GARANTIE).first(),
    ).toBeVisible();
    await capturer(page, "fiche-machine-sous-garantie", largeur);
  });

  test(`fiche intervention (bureau) — tuile Machine détaillée (${largeur}px)`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${interventionId}`);
    await expect(
      page.getByText(fr["machine.garantie.hors_garantie_depuis"]),
    ).toBeVisible();
    await capturer(page, "fiche-intervention-tuile-machine", largeur);
  });

  test(`bon d'intervention (interne, bureau) — détail machine (${largeur}px)`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${interventionId}/bon`);
    await expect(
      page.getByText(fr["machine.garantie.hors_garantie_depuis"]),
    ).toBeVisible();
    await capturer(page, "bon-interne", largeur);
  });

  test(`bon d'intervention (version client, portail) — détail machine (${largeur}px)`, async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto(`/portail/interventions/${interventionId}/bon`);
    await expect(page).toHaveURL(/\/bon$/);
    await expect(
      page.getByText(fr["machine.garantie.hors_garantie_depuis"]),
    ).toBeVisible();
    await capturer(page, "bon-client-portail", largeur);
  });
}

test("fiche terrain — année de fabrication et état de garantie, lecture seule (375px)", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${interventionId}`);
  await expect(
    page.getByText(fr["machine.garantie.hors_garantie_depuis"]),
  ).toBeVisible();
  await capturer(page, "fiche-terrain-infos-machine", 375);
});
