import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { instantAMinutes, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 9L64-GARDIEN-AUCUN-MONTANT-TERRAIN — AUCUN SYMBOLE MONÉTAIRE NULLE PART SUR
 * LE TÉLÉPHONE DU TECHNICIEN, DE BOUT EN BOUT.
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * `tests/unit/gardiens/aucun-montant-terrain.test.ts` prouve qu'aucun champ
 * monétaire ne s'ÉCRIT en code sur ce que le terrain sert ;
 * `tests/isolation/terrain-instantane-route.test.ts` rejoue la VRAIE route
 * `/api/terrain/instantane` contre une ligne clôturée dont le montant réel
 * est non nul. Ni l'un ni l'autre ne prouve ce que l'ÉCRAN rend réellement
 * dans le NAVIGATEUR : un montant peut atteindre le DOM par un chemin
 * qu'aucun des deux gardiens ne lit (une classe CSS `content:`, un attribut
 * `title`, un composant tiers). Ce fichier joue le geste complet d'un
 * technicien — Ma journée, la fiche, la signature, Terminer, Profil — et
 * cherche un symbole monétaire dans le texte RENDU de chaque écran.
 *
 * ## LA SCÈNE PRODUIT UN MONTANT RÉEL, PAS UN ZÉRO QUI NE PROUVERAIT RIEN
 *
 * Un segment de travail déjà FERMÉ de deux heures, posé directement en SQL
 * (même doctrine que `tests/e2e/setup/scene.ts#FORFAITS_SCENE` : une fixture
 * ne passe pas par le chemin qu'elle sert à éprouver). `tests/e2e/setup/
 * scene.ts` sème, pour TOUTE l'exécution, un taux horaire de 7 000 XPF — dès
 * que `temps_valide_min > 0`, `lireFicheIntervention` compose une
 * valorisation RÉELLE et non nulle (14 000 XPF), que ce fichier éprouve être
 * absente de l'écran, jamais une valorisation qui se trouverait être nulle
 * par hasard.
 */

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

/** Aucun symbole monétaire, en toutes lettres ou abrégé (CLAUDE.md I3, D176). */
const SYMBOLE_MONETAIRE = /XPF|F\s?CFP|€/i;

async function verifierAucunMontant(page: Page, etape: string): Promise<void> {
  const texte = (await page.locator("body").textContent()) ?? "";
  expect(texte, `symbole monétaire trouvé à l'étape « ${etape} »`).not.toMatch(
    SYMBOLE_MONETAIRE,
  );
}

type Scene = {
  readonly clientId: string;
  readonly siteId: string;
  readonly contactId: string;
  readonly interventionId: string;
};

async function creerScene(client: PrismaClient): Promise<Scene> {
  const reperes = await reperesDeLaScene();
  const agence = await client.agence.findFirstOrThrow({
    where: { societe_id: reperes.societeId, code: "DUCOS" },
    select: { id: true },
  });

  const clientId = uuidv7();
  await client.client.create({
    data: {
      id: clientId,
      societe_id: reperes.societeId,
      raison_sociale: fr["9l64.e2e.client"],
      actif: true,
    },
  });

  const siteId = uuidv7();
  await client.site.create({
    data: {
      id: siteId,
      societe_id: reperes.societeId,
      client_id: clientId,
      agence_id: agence.id,
      libelle: fr["9l64.e2e.site"],
      adresse: { rue: "1 rue de l'épreuve" },
      commune: "Nouméa",
    },
  });

  const contactId = uuidv7();
  await client.contact.create({
    data: {
      id: contactId,
      societe_id: reperes.societeId,
      client_id: clientId,
      site_id: null,
      nom: fr["9l64.e2e.contact_nom"],
      email: "zz9l64-contact@epreuve.test",
      roles: ["signataire"],
    },
  });

  // AUJOURD'HUI, AU FUSEAU DE LA SOCIÉTÉ (L0-08) — sans quoi la ligne tombe
  // hors de la fenêtre que « Ma journée » affiche (9F2-TERRAIN-JOURS-MAQUETTE).
  const aujourdHui = jourDe(maintenant(reperes.fuseau).local);
  const debut = instantAMinutes(aujourdHui, 8 * 60, reperes.fuseau);

  const interventionId = uuidv7();
  await client.intervention.create({
    data: {
      id: interventionId,
      societe_id: reperes.societeId,
      agence_id: agence.id,
      client_id: clientId,
      site_id: siteId,
      contact_id: contactId,
      technicien_id: reperes.technicienDucos,
      type: "curatif",
      priorite: "p3",
      // `en_cours` D'EMBLÉE (D262, 9L08B-SAISIE-APRES-DEMARRER) — même raison
      // que `SCENE.rapportTravaillee` : la garde de démarrage refuserait la
      // signature et le « Terminer » si cette scène naissait `affectee`.
      statut: "en_cours",
      date_planifiee: new Date(
        Date.UTC(aujourdHui.annee, aujourdHui.mois - 1, aujourdHui.jour),
      ),
      creneau_debut: debut,
      creneau_fin: instantAMinutes(aujourdHui, 10 * 60, reperes.fuseau),
      duree_estimee_min: 120,
      mode_valorisation: "temps_passe",
      devise_code: "XPF",
      description: "zz9L64 — panne forgée par l'épreuve",
      commentaire_technicien: fr["terrain.e2e.commentaire"],
    },
  });

  // LE SEGMENT, DÉJÀ FERMÉ (D120) — sans lui, le temps mesuré est nul, et
  // c'est tout le bloc de valorisation qui ne se composerait jamais
  // (`lireFicheIntervention`, condition `temps_valide_min > 0`) : l'absence
  // de montant à l'écran ne prouverait alors rien.
  await client.segmentTravail.create({
    data: {
      id: uuidv7(),
      societe_id: reperes.societeId,
      intervention_id: interventionId,
      utilisateur_id: reperes.technicienDucos,
      nom_technicien_affiche: "Technicien de l'épreuve",
      debut: new Date(Date.now() - 2 * 60 * 60_000),
      fin: new Date(),
    },
  });
  await client.intervention.update({
    where: { id: interventionId },
    data: { temps_mesure_min: 120, temps_valide_min: 120 },
  });

  return { clientId, siteId, contactId, interventionId };
}

async function nettoyerScene(
  client: PrismaClient,
  scene: Scene | null,
): Promise<void> {
  if (scene !== null) {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention_signature" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "notification" WHERE "intervention_id" = $1::uuid`,
      scene.interventionId,
    );
    await client.intervention.deleteMany({
      where: { id: scene.interventionId },
    });
    await client.contact.deleteMany({ where: { id: scene.contactId } });
    await client.site.deleteMany({ where: { id: scene.siteId } });
    await client.client.deleteMany({ where: { id: scene.clientId } });
  }
  await client.$disconnect();
}

test("375 px — aucun symbole monétaire sur Ma journée, la fiche, la signature, après Terminer, ni sur Profil", async ({
  page,
}) => {
  const client = admin();
  let scene: Scene | null = null;
  try {
    scene = await creerScene(client);

    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/connexion");
    await page
      .getByLabel(fr["connexion.email"])
      .fill(COMPTE_TECHNICIEN_EPREUVE);
    await page
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await page.getByRole("button", { name: fr["connexion.valider"] }).click();
    await expect(page).toHaveURL(/\/terrain$/);

    // ── MA JOURNÉE ──────────────────────────────────────────────────────────
    await expect(page.getByText(fr["9l64.e2e.client"]).first()).toBeVisible();
    await verifierAucunMontant(page, "Ma journée");

    // ── LA FICHE ────────────────────────────────────────────────────────────
    await page.getByText(fr["9l64.e2e.client"]).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/terrain/${scene.interventionId}$`),
    );
    await expect(page.getByText(fr["9l64.e2e.site"])).toBeVisible();
    await verifierAucunMontant(page, "la fiche, avant signature");

    // ── LA SIGNATURE ────────────────────────────────────────────────────────
    await page
      .getByRole("button", { name: fr["terrain.signature.option_signee"] })
      .click();
    const nom = page.getByLabel(fr["terrain.signature.nom_libelle"]);
    await expect(nom).toHaveValue(fr["9l64.e2e.contact_nom"]);
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
      envoyer("pointermove", 60, 60);
      envoyer("pointerup", 60, 60);
    });
    await expect(
      page.getByText(fr["terrain.signature.enregistre"]),
    ).toBeVisible();
    await verifierAucunMontant(page, "la fiche, après signature");

    // ── TERMINER ────────────────────────────────────────────────────────────
    await page
      .getByRole("button", { name: fr["terrain.terminer.bouton"] })
      .click();
    await page
      .getByRole("button", { name: fr["terrain.terminer.confirmation.oui"] })
      .click();
    await expect(page.getByText(fr["terrain.terminer.reussite"])).toBeVisible();
    await verifierAucunMontant(page, "la fiche, après Terminer");

    // LE STATUT EST BIEN DEVENU « TERMINÉE », AVEC UNE VALORISATION RÉELLE —
    // TÉMOIN, sans quoi l'absence de montant ci-dessus ne prouverait rien.
    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: scene.interventionId },
      select: { statut: true, temps_valide_min: true },
    });
    expect(ligne.statut).toBe("terminee");
    expect(ligne.temps_valide_min).toBe(120);

    // ── PROFIL ──────────────────────────────────────────────────────────────
    await page.goto("/terrain/profil");
    await expect(
      page.getByRole("heading", { name: fr["terrain.profil.titre"] }),
    ).toBeVisible();
    await verifierAucunMontant(page, "Profil");
  } finally {
    await nettoyerScene(client, scene);
  }
});
