import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * D226 (01/11/2026, 9I8D1-REPRISE-9I8D), appliquée à la réinitialisation du
 * second facteur par 9IA1-REPRISE-9IA — REFUS DE BOUT EN BOUT POUR UNE
 * IDENTITÉ AUSSI RATTACHÉE À UNE AUTRE SOCIÉTÉ.
 *
 * Modèle : `tests/e2e/9i8d1-copie-nouveau-lien-autre-societe.spec.ts`. Ce
 * fichier prouve que la ROUTE rend le refus nommé
 * `equipe.bureau.refus.autre_societe_second_facteur` à une requête POST
 * forgée, et que l'ÉCRAN retire le bouton « Réinitialiser le second
 * facteur » pour ce compte — `tests/isolation/
 * reinitialisation-second-facteur.test.ts` prouve déjà le refus au niveau
 * fonction et base.
 */
test.describe.configure({ mode: "serial" });

const NOM_PARTAGE = "9IA1 — Compte partagé entre deux sociétés";
const COURRIEL_PARTAGE = "partage@9ia1.e2e.test";

let idPartage = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.afterAll(async () => {
  if (idPartage === "") return;
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "journal_acces" WHERE utilisateur_id = $1::uuid`,
      idPartage,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "second_facteur" WHERE utilisateur_id = $1::uuid`,
      idPartage,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "session" WHERE utilisateur_id = $1::uuid`,
      idPartage,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "compte" WHERE utilisateur_id = $1::uuid`,
      idPartage,
    );
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: idPartage },
    });
    await client.utilisateur.deleteMany({ where: { id: idPartage } });
  } finally {
    await client.$disconnect();
  }
});

test("la réinitialisation du second facteur refuse pour une identité partagée entre deux sociétés — le bouton disparaît", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);

  // ── CRÉATION DU COMPTE, PAR REQUÊTE DIRECTE ──────────────────────────────
  const creation = await page.request.post("/api/equipe/bureau/creer", {
    form: { nom: NOM_PARTAGE, courriel: COURRIEL_PARTAGE, role: Role.adv },
    maxRedirects: 0,
  });
  expect(creation.status()).toBe(303);

  const client = admin();
  let autreSocieteId = "";
  try {
    idPartage = (
      await client.utilisateur.findFirstOrThrow({
        where: { email: COURRIEL_PARTAGE },
        select: { id: true },
      })
    ).id;
    // L'AUTRE SOCIÉTÉ DU SEMIS (`pnpm db:seed` en pose toujours deux,
    // CLAUDE.md §4) — jamais un identifiant écrit en dur.
    autreSocieteId = (
      await client.societe.findFirstOrThrow({
        where: { code: { not: "CODIMA-NC" } },
        select: { id: true },
      })
    ).id;
  } finally {
    await client.$disconnect();
  }

  // ── LE RATTACHEMENT À L'AUTRE SOCIÉTÉ, QUI REND L'IDENTITÉ NON EXCLUSIVE ─
  const clientRattachement = admin();
  try {
    await clientRattachement.utilisateurSociete.create({
      data: {
        id: crypto.randomUUID(),
        utilisateur_id: idPartage,
        societe_id: autreSocieteId,
        role: Role.adv,
      },
    });
  } finally {
    await clientRattachement.$disconnect();
  }

  // ── SECOND FACTEUR ACTIF (SCÈNE ACCÉLÉRÉE, hors sujet de ce fichier) —
  //    nécessaire pour que l'écran propose le bouton à un compte EXCLUSIF,
  //    et donne donc un témoin réel à l'absence mesurée plus bas. ──────────
  const clientActivation = admin();
  try {
    await clientActivation.$executeRawUnsafe(
      `INSERT INTO "second_facteur" (id, utilisateur_id, secret, codes_secours, verifie)
       VALUES ($1::uuid, $2::uuid, 'secret-de-test', 'codes-de-test', true)`,
      crypto.randomUUID(),
      idPartage,
    );
    await clientActivation.$executeRawUnsafe(
      `UPDATE "utilisateur" SET mfa_actif = true WHERE id = $1::uuid`,
      idPartage,
    );
  } finally {
    await clientActivation.$disconnect();
  }

  // ── 1. LA RÉINITIALISATION REFUSE, NOMMÉMENT (REQUÊTE FORGÉE) ────────────
  const reponse = await page.request.post(
    `/api/equipe/bureau/${idPartage}/reinitialiser-second-facteur`,
    { maxRedirects: 0 },
  );
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"] ?? "").toContain(
    "motif=equipe.bureau.refus.autre_societe_second_facteur",
  );

  // ── 2. L'ÉCRAN : LE BOUTON « RÉINITIALISER » NE SE PROPOSE PAS ───────────
  await page.goto("/parametres/equipe?onglet=bureau");

  const ligne = page.getByRole("row", { name: new RegExp(NOM_PARTAGE) });
  await expect(
    ligne.getByRole("button", {
      name: fr["equipe.bureau.second_facteur.reinitialiser"],
    }),
  ).toHaveCount(0);
  // LE BADGE RESTE : ce n'est que le GESTE qui disparaît, pas l'état.
  await expect(
    ligne.getByText(fr["equipe.bureau.second_facteur.actif"]),
  ).toBeVisible();
});
