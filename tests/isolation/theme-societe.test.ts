import { afterAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";

import { lireThemeCloisonne } from "@/lib/theme/session";
import { NOM_NEUTRE, THEME_DEFAUT } from "@/lib/theme/theme";
import { variablesCss } from "@/lib/theme/variables";

import {
  avecPortail,
  avecSociete,
  avecSocieteEtRole,
  clientOwner,
  fermerClients,
} from "./setup/db";
import {
  CHARTE_A,
  CHARTE_B,
  CLIENT_A1,
  SOCIETE_A,
  SOCIETE_B,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * **Le thème appliqué est celui de la société ACTIVE** (ticket L0-09, point 4).
 *
 * La thématisation n'échappe pas à I1 : une charte est une donnée de société,
 * et la lire est une requête comme une autre. Le cloisonnement est ici tenu par
 * les deux barrières, dans l'ordre — filtre applicatif, puis politique RLS
 * `id = app.societe_id` (D42) —, et les scénarios s'exécutent sous le rôle
 * applicatif restreint, celui sur lequel les politiques mordent réellement.
 *
 * Le point du portail est traité pour lui-même : un compte client porte pour
 * société active celle qui le SERT (D10). Le portail affiche donc la charte de
 * la société émettrice, jamais celle du client — c'est ce que dit le chapitre 7
 * (« portail à la charte de la société émettrice ») et c'est vérifié ici plutôt
 * que supposé.
 */

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

/**
 * Exécute `travail` sous le RÔLE APPLICATIF, dans une transaction ANNULÉE : la
 * fixture ressort intacte, et la lecture reste soumise aux politiques.
 */
async function dansUneTransactionAnnulee(
  societeId: string,
  travail: (tx: PrismaClient) => Promise<void>,
): Promise<void> {
  try {
    await avecSociete(societeId, async (tx) => {
      await travail(tx);
      throw new Annulation();
    });
  } catch (erreur) {
    if (!(erreur instanceof Annulation)) {
      throw erreur;
    }
  }
}

/**
 * Exécute `travail` sous le PROPRIÉTAIRE, après avoir réellement défait le
 * verrou nommé, puis ANNULE tout — l'épreuve par retrait du §9. Le DDL est
 * transactionnel en PostgreSQL : la contrainte revient au `ROLLBACK`.
 */
async function sansContrainte(
  retrait: readonly string[],
  societeId: string,
  travail: (tx: PrismaClient) => Promise<void>,
): Promise<void> {
  try {
    await clientOwner().$transaction(async (tx) => {
      for (const instruction of retrait) {
        await tx.$executeRawUnsafe(instruction);
      }
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        societeId,
      );
      await travail(tx as unknown as PrismaClient);
      throw new Annulation();
    });
  } catch (erreur) {
    if (!(erreur instanceof Annulation)) {
      throw erreur;
    }
  }
}

describe("le thème suit la société active, et rien d'autre (L0-09, I1)", () => {
  afterAll(fermerClients);

  it("chaque société reçoit SA charte", async () => {
    const themeA = await avecSociete(SOCIETE_A, (tx) =>
      lireThemeCloisonne(tx, SOCIETE_A),
    );
    const themeB = await avecSociete(SOCIETE_B, (tx) =>
      lireThemeCloisonne(tx, SOCIETE_B),
    );

    expect(themeA.primaire.fond).toBe(CHARTE_A.primaire);
    expect(themeA.accent.fond).toBe(CHARTE_A.accent);
    expect(themeB.primaire.fond).toBe(CHARTE_B.primaire);
    expect(themeB.accent.fond).toBe(CHARTE_B.accent);
    expect(themeA.origine).toBe("societe");
    expect(themeB.origine).toBe("societe");
  });

  it("la bascule change le rendu — jusqu'aux encres calculées", async () => {
    const [themeA, themeB] = await Promise.all([
      avecSociete(SOCIETE_A, (tx) => lireThemeCloisonne(tx, SOCIETE_A)),
      avecSociete(SOCIETE_B, (tx) => lireThemeCloisonne(tx, SOCIETE_B)),
    ]);

    expect(variablesCss(themeA)).not.toEqual(variablesCss(themeB));
    // L'accent de A est un orange soutenu, celui de B un vert très clair :
    // les deux appellent une encre sombre, mais leurs fonds diffèrent — et le
    // primaire, lui, fait basculer l'encre d'un camp à l'autre.
    expect(themeA.accent.fond).not.toBe(themeB.accent.fond);
    expect(themeA.primaire.encre).toBe("#ffffff");
    expect(themeB.primaire.encre).toBe("#ffffff");
    expect(themeA.accent.encre).toBe("#000000");
  });

  it("une session active sur A n'obtient PAS la charte de B, même en la demandant", async () => {
    // Le défaut visé : un identifiant de société qui viendrait d'ailleurs — un
    // paramètre d'URL, un en-tête, une reprise de code. La politique ne laisse
    // voir que la société du contexte : la lecture rend zéro ligne, donc le
    // thème neutre, et jamais les couleurs de B.
    const vol = await avecSociete(SOCIETE_A, (tx) =>
      lireThemeCloisonne(tx, SOCIETE_B),
    );

    expect(vol.origine).toBe("defaut");
    expect(vol.nom).toBe(NOM_NEUTRE);
    expect(vol.primaire.fond).toBe(THEME_DEFAUT.primaire.fond);
    expect(vol.primaire.fond).not.toBe(CHARTE_B.primaire);
    expect(vol.accent.fond).not.toBe(CHARTE_B.accent);
  });

  it("le portail affiche la charte de la société qui le SERT", async () => {
    // Un compte portail de la société A, rattaché au client A1. Sa société
    // active est celle qui l'héberge : c'est cette charte-là qu'il voit.
    const theme = await avecPortail(
      { societeId: SOCIETE_A, clientId: CLIENT_A1 },
      (tx) => lireThemeCloisonne(tx, SOCIETE_A),
    );

    expect(theme.origine).toBe("societe");
    expect(theme.primaire.fond).toBe(CHARTE_A.primaire);
    expect(theme.primaire.fond).not.toBe(CHARTE_B.primaire);
  });

  it("sans société active, aucune charte n'est lisible", async () => {
    // Le cas de la page de connexion, et celui d'un rôle éditeur : sans
    // `app.societe_id`, la politique ne rend rien, et le thème neutre
    // s'applique. Lu sous le rôle APPLICATIF — le propriétaire du schéma est
    // superutilisateur sur la base jetable et contournerait les politiques.
    const theme = await avecSocieteEtRole(null, null, (tx) =>
      lireThemeCloisonne(tx, SOCIETE_A),
    );

    expect(theme).toEqual(THEME_DEFAUT);
  });
});

describe("la forme d'une couleur est contrôlée EN BASE (L0-09)", () => {
  afterAll(fermerClients);

  it("refuse ce qui n'est pas une couleur sRGB", async () => {
    await expect(
      avecSociete(SOCIETE_A, (tx) =>
        tx.$executeRawUnsafe(
          `UPDATE "societe" SET "couleur_primaire" = 'bleu marine' WHERE "id" = $1::uuid`,
          SOCIETE_A,
        ),
      ),
    ).rejects.toThrow(/societe_couleur_primaire_forme/);
  });

  it("ÉPREUVE PAR RETRAIT : sans la contrainte, la valeur cassée passe", async () => {
    // Sans ce jumeau, le refus ci-dessus pourrait tenir à une contrainte
    // voisine — et le test serait vert le jour où quelqu'un retirerait
    // précisément celle qu'il croit éprouver.
    let lignes = -1;

    await sansContrainte(
      [
        'ALTER TABLE "societe" DROP CONSTRAINT "societe_couleur_primaire_forme"',
      ],
      SOCIETE_A,
      async (tx) => {
        lignes = await tx.$executeRawUnsafe(
          `UPDATE "societe" SET "couleur_primaire" = 'bleu marine' WHERE "id" = $1::uuid`,
          SOCIETE_A,
        );
      },
    );

    expect(lignes).toBe(1);

    // Et la transaction annulée n'a rien laissé derrière elle.
    const theme = await avecSociete(SOCIETE_A, (tx) =>
      lireThemeCloisonne(tx, SOCIETE_A),
    );
    expect(theme.primaire.fond).toBe(CHARTE_A.primaire);
  });

  it("accepte l'ABSENCE de charte : la société reçoit alors le thème neutre", async () => {
    // « Société sans thème » est un état représentable depuis L0-09 — c'est ce
    // qui évite qu'un provisionnement invente deux couleurs. Éprouvé dans une
    // transaction annulée : la fixture ressort intacte.
    let theme = THEME_DEFAUT;

    await dansUneTransactionAnnulee(SOCIETE_A, async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE "societe"
            SET "couleur_primaire" = NULL, "couleur_secondaire" = NULL
          WHERE "id" = $1::uuid`,
        SOCIETE_A,
      );
      theme = await lireThemeCloisonne(tx, SOCIETE_A);
    });

    expect(theme.origine).toBe("defaut");
    expect(theme.primaire.fond).toBe(THEME_DEFAUT.primaire.fond);
    // Le nom reste celui de la société : c'est SON identité, pas celle du
    // produit — seules les couleurs manquent.
    expect(theme.nom).toBe("Société A");

    const apres = await avecSociete(SOCIETE_A, (tx) =>
      lireThemeCloisonne(tx, SOCIETE_A),
    );
    expect(apres.primaire.fond).toBe(CHARTE_A.primaire);
  });
});
