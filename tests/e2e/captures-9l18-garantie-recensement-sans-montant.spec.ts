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

import { urlAdministration, urlApplicative } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9L18-GARANTIE-RECENSEMENT-SANS-MONTANT — même recette que
 * `captures-9j08a-portail-bon.spec.ts` pour la scène portail (invitation,
 * premier mot de passe) et `captures-9l17-bon-valorisation-figee.spec.ts`
 * pour la scène back-office.
 *
 * **AVANT NON REPRODUCTIBLE SUR CET ARBRE** : le correctif écarte ces deux
 * types PAR LE TYPE, avant même de regarder ce que la base porte — aucune
 * donnée insérée sous le code CORRIGÉ ne peut donc reproduire l'état
 * d'avant (un total affiché). Seul l'APRÈS est versé ici.
 *
 * **SA PROPRE INTERVENTION JETABLE**, de type `garantie`, CLÔTURÉE, posée
 * dans `beforeAll` et effacée dans `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L18 ?? "";
const EMAIL_PORTAIL = "9l18-portail-garantie@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9l18-portail-garantie";

let interventionId = "";

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

async function preparerLaScene(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await admin.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    const utilisateurSociete = await admin.utilisateurSociete.findFirstOrThrow({
      where: { utilisateur_id: utilisateur.id },
      select: { societe_id: true },
    });
    const societeId = utilisateurSociete.societe_id;
    const client = await admin.client.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });
    const site = await admin.site.findFirstOrThrow({
      where: { societe_id: societeId, client_id: client.id },
      select: { id: true, agence_id: true },
    });

    interventionId = uuidv7();
    // RG-INT-09 (décision d'Alexis du 10/11/2026) : UNE GARANTIE, CLÔTURÉE,
    // `mode_valorisation` au temps passé — exactement le décor qui, AVANT ce
    // ticket, aurait écrit et affiché un total.
    await admin.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id",
          "type", "statut", "mode_valorisation", "temps_valide_min", "modifie_le", "cloturee_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
               'garantie', 'cloturee', 'temps_passe'::"ModeValorisation", 90, now(), now())`,
      interventionId,
      societeId,
      client.id,
      site.id,
      site.agence_id,
    );

    const contexteAdmin: ContexteSession = {
      utilisateurId: utilisateur.id,
      societeId,
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
        client.id,
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
    await admin.$disconnect();
  }
}

async function effacerLaScene(): Promise<void> {
  if (interventionId === "") return;
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await admin.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      interventionId,
    );
  } finally {
    await admin.$disconnect();
  }
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

test.beforeAll(async () => {
  await preparerLaScene();
});

test.afterAll(async () => {
  await effacerLaScene();
});

for (const largeur of [1280, 375] as const) {
  test(`capture APRÈS — la fiche, onglet Valorisation, d'une garantie close, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${interventionId}?onglet=valorisation`);
    await expect(
      page.getByText(fr["tarification.conditions.non_facturable.garantie"]),
    ).toBeVisible();
    await capturer(page, "fiche-valorisation-garantie", largeur);
  });

  test(`capture APRÈS — le bon interne d'une garantie close, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirUneSession(page);
    await page.goto(`/interventions/${interventionId}/bon?version=interne`);
    await expect(
      page.getByText(fr["tarification.conditions.non_facturable.garantie"]),
    ).toHaveCount(2);
    await capturer(page, "bon-interne-garantie", largeur);
  });

  test(`capture APRÈS — le bon du portail d'une garantie close, à ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionPortail(page);
    await page.goto(`/portail/interventions/${interventionId}/bon`);
    await expect(page).toHaveURL(/\/bon$/);
    await expect(
      page.getByText(fr["tarification.conditions.non_facturable.garantie"]),
    ).toBeVisible();
    await capturer(page, "bon-portail-garantie", largeur);
  });
}
