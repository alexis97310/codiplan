import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { avecDesignationAuth } from "@/lib/auth/lecture-identite";
import { Role } from "@/lib/auth/roles";
import {
  cleJour,
  instantDuJour,
  jourDe,
  maintenant,
} from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { avecSociete, avecSocieteEtRole } from "@/lib/db/rls";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { MOT_DE_PASSE_EPREUVE, ouvrirLeCompteDeLEpreuve } from "./setup/scene";

/**
 * 9L41-MA-JOURNEE-TRI-A-FAIRE, M8 — « MA JOURNÉE » TRIE PAR PRIORITÉ PUIS PAR
 * CRÉNEAU, UNE SUSPENDUE PASSE EN TÊTE, ET LA CARTE « À FAIRE MAINTENANT »
 * MONTRE LA PREMIÈRE DE CE TRI.
 *
 * ## UN TECHNICIEN DÉDIÉ, SANS LA MOINDRE LIGNE PARTAGÉE
 *
 * `prochaineAFaire` (`lib/terrain/tri-journee.ts`) choisit un gagnant parmi
 * TOUT ce que « Ma journée » affiche pour un technicien — en retard,
 * aujourd'hui, sans date. Sur `COMPTE_TECHNICIEN_EPREUVE`, partagé par des
 * dizaines de scénarios, ce gagnant dépendrait de ce que d'autres fichiers
 * posent EN MÊME TEMPS (9F2-TERRAIN-JOURS-MAQUETTE a déjà mesuré cette
 * pollution pour les décomptes). Un technicien NÉ pour cette seule épreuve
 * (même recette que la scène « vide » de 9F2) rend le gagnant CERTAIN.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const PREFIXE = "zz9l41-";
const EMAIL_TECHNICIEN = `${PREFIXE}technicien@codima.test`;
const NOM_TECHNICIEN = "zz9L41 — Technicien de l'épreuve";

const CLIENT_LIBELLE = fr["terrain9l41.e2e.client"];
const SITE_LIBELLE_HAUTE = fr["terrain9l41.e2e.site_priorite_haute"];
const SITE_LIBELLE_BASSE = fr["terrain9l41.e2e.site_priorite_basse"];
const SITE_LIBELLE_SUSPENDUE = fr["terrain9l41.e2e.site_suspendue"];

const CLIENT_ID = uuidv7();
const SITE_HAUTE_ID = uuidv7();
const SITE_BASSE_ID = uuidv7();
const SITE_SUSPENDUE_ID = uuidv7();
const INTERVENTION_HAUTE_ID = uuidv7();
const INTERVENTION_BASSE_ID = uuidv7();
const INTERVENTION_SUSPENDUE_ID = uuidv7();

let societeId = "";
let utilisateurId = "";

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(EMAIL_TECHNICIEN);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  const aujourdHui = jourDe(maintenant(reperes.fuseau).local);

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    // ── LE TECHNICIEN DÉDIÉ (même recette que la scène « vide » de 9F2) ────
    const utilisateur = await avecSocieteEtRole(
      client,
      societeId,
      Role.admin_societe,
      (tx) =>
        tx.utilisateur.create({
          data: { id: uuidv7(), nom: NOM_TECHNICIEN, email: EMAIL_TECHNICIEN },
          select: { id: true },
        }),
    );
    utilisateurId = utilisateur.id;

    const designe = avecDesignationAuth(client);
    await designe.compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: null,
      },
    });

    await avecSociete(client, societeId, (tx) =>
      tx.utilisateurSociete.create({
        data: {
          id: uuidv7(),
          utilisateur_id: utilisateurId,
          societe_id: societeId,
          role: Role.technicien,
        },
      }),
    );

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societeId,
        raison_sociale: CLIENT_LIBELLE,
        actif: true,
      },
    });
    await client.site.createMany({
      data: [
        {
          id: SITE_HAUTE_ID,
          societe_id: societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: SITE_LIBELLE_HAUTE,
        },
        {
          id: SITE_BASSE_ID,
          societe_id: societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: SITE_LIBELLE_BASSE,
        },
        {
          id: SITE_SUSPENDUE_ID,
          societe_id: societeId,
          client_id: CLIENT_ID,
          agence_id: agence.id,
          libelle: SITE_LIBELLE_SUSPENDUE,
        },
      ],
    });

    const commun = {
      societe_id: societeId,
      agence_id: agence.id,
      client_id: CLIENT_ID,
      technicien_id: utilisateurId,
      type: "curatif" as const,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "9L41 — intervention forgée par l'épreuve",
      date_planifiee: instantDuJour(aujourdHui),
    };

    // BASSE PRIORITÉ (p4), CRÉNEAU LE PLUS TÔT — la date seule la mettrait
    // en tête ; la priorité doit l'emporter sur le créneau (M8).
    await client.intervention.create({
      data: {
        id: INTERVENTION_BASSE_ID,
        site_id: SITE_BASSE_ID,
        statut: "affectee",
        priorite: "p4",
        creneau_debut: new Date(`${cleJour(aujourdHui)}T08:00:00.000Z`),
        creneau_fin: new Date(`${cleJour(aujourdHui)}T08:30:00.000Z`),
        ...commun,
      },
    });
    // HAUTE PRIORITÉ (p1), CRÉNEAU PLUS TARD — doit malgré tout passer AVANT
    // la basse priorité.
    await client.intervention.create({
      data: {
        id: INTERVENTION_HAUTE_ID,
        site_id: SITE_HAUTE_ID,
        statut: "affectee",
        priorite: "p1",
        creneau_debut: new Date(`${cleJour(aujourdHui)}T09:00:00.000Z`),
        creneau_fin: new Date(`${cleJour(aujourdHui)}T09:30:00.000Z`),
        ...commun,
      },
    });
    // SUSPENDUE, PRIORITÉ BASSE (p4), CRÉNEAU LE PLUS TARD — doit malgré
    // tout passer EN TÊTE de tout le reste (M8 : en cours/suspendue d'abord).
    await client.intervention.create({
      data: {
        id: INTERVENTION_SUSPENDUE_ID,
        site_id: SITE_SUSPENDUE_ID,
        statut: "suspendue",
        priorite: "p4",
        motif_suspension: "9L41 — suspension forgée par l'épreuve",
        suspendue_le: new Date(),
        creneau_debut: new Date(`${cleJour(aujourdHui)}T11:00:00.000Z`),
        creneau_fin: new Date(`${cleJour(aujourdHui)}T11:30:00.000Z`),
        ...commun,
      },
    });
  } finally {
    await client.$disconnect();
  }

  await ouvrirLeCompteDeLEpreuve(societeId, EMAIL_TECHNICIEN);
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: {
        id: {
          in: [
            INTERVENTION_BASSE_ID,
            INTERVENTION_HAUTE_ID,
            INTERVENTION_SUSPENDUE_ID,
          ],
        },
      },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_HAUTE_ID, SITE_BASSE_ID, SITE_SUSPENDUE_ID] } },
    });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });

    if (utilisateurId !== "") {
      await client.$executeRawUnsafe(
        `DELETE FROM "journal_acces" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await client.$executeRawUnsafe(
        `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
        utilisateurId,
      );
      await avecSociete(client, societeId, (tx) =>
        tx.utilisateurSociete.deleteMany({
          where: { utilisateur_id: utilisateurId, societe_id: societeId },
        }),
      );
      await avecSocieteEtRole(client, societeId, Role.admin_societe, (tx) =>
        tx.utilisateur.delete({ where: { id: utilisateurId } }),
      );
    }
  } finally {
    await client.$disconnect();
  }
});

test("la priorité l'emporte sur le créneau, une suspendue passe en tête, et « à faire maintenant » montre la gagnante", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await ouvrirLaSessionDuTerrain(page);

  await expect(page.getByText(SITE_LIBELLE_HAUTE)).toBeVisible();
  await expect(page.getByText(SITE_LIBELLE_BASSE)).toBeVisible();
  await expect(page.getByText(SITE_LIBELLE_SUSPENDUE)).toBeVisible();

  const yDe = async (texte: string): Promise<number> => {
    const box = await page.getByText(texte).boundingBox();
    if (box === null) {
      throw new Error(`Carte introuvable : « ${texte} »`);
    }
    return box.y;
  };

  const ySuspendue = await yDe(SITE_LIBELLE_SUSPENDUE);
  const yHaute = await yDe(SITE_LIBELLE_HAUTE);
  const yBasse = await yDe(SITE_LIBELLE_BASSE);

  // SUSPENDUE EN TÊTE, malgré sa priorité basse et son créneau le plus tard.
  expect(ySuspendue).toBeLessThan(yHaute);
  expect(ySuspendue).toBeLessThan(yBasse);
  // PRIORITÉ HAUTE AVANT PRIORITÉ BASSE, malgré un créneau plus tardif.
  expect(yHaute).toBeLessThan(yBasse);

  // ── LA CARTE « À FAIRE MAINTENANT » MONTRE LA SUSPENDUE, PAS LE SITE ────
  // (l'aperçu exclut le site — voir `CarteApercu`,
  // `components/terrain/liste-journee.tsx`).
  const titreAFaire = page.getByRole("heading", {
    name: fr["terrain.a_faire_maintenant.titre"],
    exact: true,
  });
  await expect(titreAFaire).toBeVisible();
  const yTitreAFaire = (await titreAFaire.boundingBox())?.y ?? 0;
  const yClientAFaire = (
    await page.getByText(CLIENT_LIBELLE).first().boundingBox()
  )?.y;
  expect(yClientAFaire).toBeDefined();
  expect(yClientAFaire as number).toBeGreaterThan(yTitreAFaire);
  expect(yClientAFaire as number).toBeLessThan(ySuspendue);
  await expect(
    page.getByText(fr["statut.suspendue"], { exact: true }).first(),
  ).toBeVisible();
});
