import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * D-12 — LA PORTE, ÉPROUVÉE PAR LE CAS QUI A MOTIVÉ LE TICKET.
 *
 * ## Ce que ce fichier mesure, et que rien d'autre ne mesure
 *
 * `tests/unit/auth/porte.test.ts` éprouve `exigerCapacite` en isolation, avec
 * une session fabriquée. Il ne peut pas prouver qu'un `technicien` RÉEL,
 * connecté par l'écran, qui forge un `POST` vers une route de la matrice, est
 * bien refusé PAR LA ROUTE — c'est-à-dire par la chaîne entière : session,
 * porte, dépôt.
 *
 * ## Le cas exact du ticket
 *
 * Un `technicien` poste sur `/api/habilitations/attributions/creer` en se
 * désignant LUI-MÊME (`utilisateur_id` = son propre identifiant) pour une
 * habilitation qui existe réellement. Sans D-12, RG-PLA-04 le tiendrait
 * ensuite pour qualifié — le verrou d'affectation resterait techniquement
 * clos et deviendrait socialement vide.
 *
 * **La vérification porte sur la BASE, pas seulement sur la réponse** : un
 * refus qui écrirait quand même serait pire qu'un refus absent.
 */
test("un technicien ne peut pas se désigner lui-même une habilitation", async ({
  page,
}) => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const technicien = await client.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_TECHNICIEN_EPREUVE },
      select: { id: true },
    });
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    // Une habilitation RÉELLE de la société — l'amorçage de L1-04 en pose
    // plusieurs à l'ouverture de chaque société, jamais de la démonstration.
    const habilitation = await client.habilitation.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });

    const compte = () =>
      client.technicienHabilitation.count({
        where: {
          utilisateur_id: technicien.id,
          habilitation_id: habilitation.id,
        },
      });
    const avant = await compte();

    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

    const reponse = await page.request.post(
      "/api/habilitations/attributions/creer",
      {
        form: {
          utilisateur_id: technicien.id,
          habilitation_id: habilitation.id,
          date_obtention: "2024-01-15",
        },
        maxRedirects: 0,
      },
    );

    // Le même refus qu'une session absente — la porte ne dit pas pourquoi.
    expect(reponse.status()).toBe(303);
    expect(reponse.headers()["location"] ?? "").toContain("auth.refus");

    // ET RIEN N'A ÉTÉ ÉCRIT — la vérification qui compte le plus.
    expect(await compte()).toBe(avant);
  } finally {
    await client.$disconnect();
  }
});
