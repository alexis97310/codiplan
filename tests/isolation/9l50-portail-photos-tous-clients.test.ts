import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ficheInterventionDuParc,
  interventionsDuParc,
} from "@/app/(portail)/portail/interventions/depot";
import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  deposerPhotoIntervention,
  octetsDocumentDuParc,
} from "@/lib/documents/depot";
import { premierSucces, rattachementsDuCompte } from "@/lib/portail/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  INTERVENTION_A1,
  PORTAIL_A_CLIENT,
  PORTAIL_B_CLIENT,
  SITE_A2_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9L50-PORTAIL-PHOTOS-TOUS-CLIENTS — LA CAUSE MESURÉE, ET SA RÉPARATION.
 *
 * ## Ce que la revue de 9L28 avait relevé, et ce que la mesure de CE ticket ajoute
 *
 * La revue disait : « un compte portail rattaché à deux clients d'une même
 * société ne voit les photos que du premier ». La mesure va plus loin :
 * `ContexteSession.clientId` (D70) DÉSIGNE un seul client par lecture, et
 * TOUTES les pages du portail — pas seulement les photos — ne désignaient
 * que le PREMIER rattachement (`rattachements[0]`, voir chaque page.tsx avant
 * ce ticket). *La liste des interventions avait le MÊME défaut que les
 * photos* : un compte à deux clients n'y voyait que celles du premier.
 *
 * ## Ce que ce fichier éprouve
 *
 * Aucune politique RLS n'a changé — `app.client_id` reste une désignation
 * UNIQUE par lecture (D70 n'est pas touchée). La réparation est côté
 * application : `premierSucces` (`lib/portail/depot.ts`) essaie chaque
 * rattachement, dans l'ordre, pour une lecture PAR IDENTIFIANT (une photo,
 * une fiche) ; une LISTE (les interventions) interroge chaque rattachement et
 * CONCATÈNE. Ce fichier éprouve les deux formes, sous la VRAIE politique.
 */

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

function contextePortail(clientId: string | null): ContexteSession {
  return {
    utilisateurId: PORTAIL_A_CLIENT,
    societeId: SOCIETE_A,
    role: Role.client,
    secondFacteurValide: true,
    adresseIp: null,
    clientId,
  };
}

function contexteInterne(): ContexteSession {
  return {
    utilisateurId: TECHNICIEN,
    societeId: SOCIETE_A,
    role: Role.technicien,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

afterAll(fermerClients);

/**
 * `PORTAIL_A_CLIENT` GAGNE UN SECOND RATTACHEMENT, JETABLE — ajouté ici,
 * retiré en fin de fichier, jamais une mutation du fixture partagé (même
 * discipline que les interventions jetables ci-dessous) : d'autres fichiers
 * lisent `PORTAIL_A_CLIENT` comme un compte à UN SEUL client
 * (`portail-rattachement.test.ts` notamment), et ils continuent de le voir
 * ainsi puisque la ligne disparaît avec ce fichier.
 */
beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "utilisateur_client"
       ("id", "utilisateur_id", "client_id", "societe_id", "actif", "accepte_le")
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, true, now())`,
    PORTAIL_A_CLIENT,
    CLIENT_A2,
    SOCIETE_A,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_client"
      WHERE "utilisateur_id" = $1::uuid AND "client_id" = $2::uuid`,
    PORTAIL_A_CLIENT,
    CLIENT_A2,
  );
});

/**
 * Une intervention jetable CLÔTURÉE, avec sa photo `client`, sur le CLIENT
 * donné — même geste que `surUneIntervention` de `photo-octets-portail.test.ts`,
 * généralisé au client (celui-là ne construisait que pour A1).
 */
async function surUneInterventionDuClient(
  clientId: string,
  siteId: string,
  close: boolean,
  travail: (interventionId: string, documentId: string) => Promise<void>,
): Promise<void> {
  const interventionId = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "technicien_id", "duree_estimee_min",
       "modifie_le")
     SELECT '${interventionId}', "societe_id", '${clientId}'::uuid,
            '${siteId}'::uuid, "agence_id", 'curatif'::"TypeIntervention",
            'en_cours', "technicien_id", 60, now()
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  try {
    const depot = await deposerPhotoIntervention(
      contexteInterne(),
      interventionId,
      {
        classe: "client",
        libelle: "Avant/après",
        nom_fichier: "avant-apres.jpg",
        type_mime: "image/jpeg",
        octets: Buffer.from([1, 2, 3]),
      },
      clientApp(),
    );
    expect(depot).not.toBeNull();
    const documentId = (depot as { readonly id: string }).id;
    if (close) {
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention"
            SET "statut" = 'terminee', "temps_valide_min" = 60,
                "rapport_valide_par" = "technicien_id", "rapport_valide_le" = now()
          WHERE "id" = '${interventionId}'`,
      );
      await clientOwner().$executeRawUnsafe(
        `UPDATE "intervention" SET "statut" = 'cloturee', "cloturee_le" = now()
           WHERE "id" = '${interventionId}'`,
      );
    }
    await travail(interventionId, documentId);
  } finally {
    await clientOwner().$executeRawUnsafe(
      `ALTER TABLE "document" DISABLE TRIGGER "document_figee_a_la_cloture"`,
    );
    try {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "document" WHERE "intervention_id" = '${interventionId}'`,
      );
    } finally {
      await clientOwner().$executeRawUnsafe(
        `ALTER TABLE "document" ENABLE TRIGGER "document_figee_a_la_cloture"`,
      );
    }
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${interventionId}'`,
    );
  }
}

describe("une photo, par identifiant — premierSucces essaie chaque client", () => {
  it("compte à DEUX clients : la photo du second est vue, pas seulement celle du premier", async () => {
    await surUneInterventionDuClient(
      CLIENT_A2,
      SITE_A2_S1,
      true,
      async (_interventionId, documentId) => {
        const rattachements = await rattachementsDuCompte(
          PORTAIL_A_CLIENT,
          clientApp(),
        );
        const surCetteSociete = rattachements.filter(
          (r) => r.societeId === SOCIETE_A,
        );
        // TÉMOIN — le compte tient bien les DEUX rattachements, dans cet ordre
        // (le même tri que `rattachementsDuCompte`, par client_id croissant) :
        // sans lui, l'essai ci-dessous pourrait réussir du premier coup pour
        // une tout autre raison.
        expect(surCetteSociete.map((r) => r.clientId).sort()).toEqual(
          [CLIENT_A1, CLIENT_A2].sort(),
        );

        const octets = await premierSucces(
          surCetteSociete,
          contextePortail(null),
          (contexte) => octetsDocumentDuParc(contexte, documentId, clientApp()),
          (resultat) => resultat === null,
        );
        expect(octets).not.toBeNull();
        expect(octets?.nom_fichier).toBe("avant-apres.jpg");

        // ET LE PREMIER RATTACHEMENT SEUL NE LA VOIT PAS — sans cette borne,
        // le test ci-dessus prouverait seulement que CLIENT_A2 voit sa propre
        // photo, jamais que la boucle était nécessaire.
        const directementSousA1 = await octetsDocumentDuParc(
          contextePortail(CLIENT_A1),
          documentId,
          clientApp(),
        );
        expect(directementSousA1).toBeNull();
      },
    );
  });

  it("compte à UN SEUL client (filtré) : inchangé — il ne voit QUE le sien", async () => {
    await surUneInterventionDuClient(
      CLIENT_A2,
      SITE_A2_S1,
      true,
      async (_interventionId, documentId) => {
        // Même compte, mais la liste de rattachements essayés est bornée au
        // SEUL client A1 — exactement l'état d'un compte qui n'en tient qu'un.
        const octets = await premierSucces(
          [{ societeId: SOCIETE_A, clientId: CLIENT_A1 }],
          contextePortail(null),
          (contexte) => octetsDocumentDuParc(contexte, documentId, clientApp()),
          (resultat) => resultat === null,
        );
        expect(octets).toBeNull();
      },
    );
  });

  it("une AUTRE société reste refusée — le filtre par société borne la liste essayée AVANT la boucle", async () => {
    await surUneInterventionDuClient(
      CLIENT_A2,
      SITE_A2_S1,
      true,
      async (_interventionId, documentId) => {
        const rattachements = await rattachementsDuCompte(
          PORTAIL_B_CLIENT,
          clientApp(),
        );
        // `PORTAIL_B_CLIENT` n'a aucun rattachement sur la société A : le
        // filtre par société le réduit à une liste VIDE, et `premierSucces`
        // sur une liste vide ne tente rien, ne lève rien, rend `undefined`.
        const surSocieteA = rattachements.filter(
          (r) => r.societeId === SOCIETE_A,
        );
        expect(surSocieteA).toEqual([]);
        const resultat = await premierSucces(
          surSocieteA,
          { ...contextePortail(null), societeId: SOCIETE_B },
          (contexte) => octetsDocumentDuParc(contexte, documentId, clientApp()),
          (r) => r === null,
        );
        expect(resultat).toBeUndefined();
      },
    );
  });

  it("une intervention PAS ENCORE close reste refusée, même essayée sous chaque client", async () => {
    await surUneInterventionDuClient(
      CLIENT_A2,
      SITE_A2_S1,
      false,
      async (_interventionId, documentId) => {
        const rattachements = await rattachementsDuCompte(
          PORTAIL_A_CLIENT,
          clientApp(),
        );
        const surCetteSociete = rattachements.filter(
          (r) => r.societeId === SOCIETE_A,
        );
        const octets = await premierSucces(
          surCetteSociete,
          contextePortail(null),
          (contexte) => octetsDocumentDuParc(contexte, documentId, clientApp()),
          (resultat) => resultat === null,
        );
        expect(octets).toBeNull();
      },
    );
  });
});

describe("la liste des interventions — une lecture par client, puis l'UNION", () => {
  it("compte à DEUX clients : les interventions des DEUX apparaissent, jamais un agrégat qui en perdrait une", async () => {
    await surUneInterventionDuClient(
      CLIENT_A2,
      SITE_A2_S1,
      true,
      async (interventionId) => {
        const rattachements = await rattachementsDuCompte(
          PORTAIL_A_CLIENT,
          clientApp(),
        );
        const surCetteSociete = rattachements.filter(
          (r) => r.societeId === SOCIETE_A,
        );
        const listes = await Promise.all(
          surCetteSociete.map((r) =>
            interventionsDuParc(
              { ...contextePortail(null), clientId: r.clientId },
              clientApp(),
            ),
          ),
        );
        const identifiants = listes.flat().map((i) => i.id);
        expect(identifiants).toContain(INTERVENTION_A1);
        expect(identifiants).toContain(interventionId);

        // TÉMOIN — sous le SEUL premier rattachement, l'intervention du
        // second client reste invisible : c'est exactement le défaut mesuré.
        const premier = surCetteSociete[0];
        if (premier === undefined) {
          throw new Error("aucun rattachement");
        }
        const uneSeule = await interventionsDuParc(
          { ...contextePortail(null), clientId: premier.clientId },
          clientApp(),
        );
        if (premier.clientId === CLIENT_A1) {
          expect(uneSeule.map((i) => i.id)).not.toContain(interventionId);
        }
      },
    );
  });

  it("la fiche d'une intervention du second client se résout, en essayant chaque rattachement", async () => {
    await surUneInterventionDuClient(
      CLIENT_A2,
      SITE_A2_S1,
      true,
      async (interventionId) => {
        const rattachements = await rattachementsDuCompte(
          PORTAIL_A_CLIENT,
          clientApp(),
        );
        const surCetteSociete = rattachements.filter(
          (r) => r.societeId === SOCIETE_A,
        );
        const fiche = await premierSucces(
          surCetteSociete,
          contextePortail(null),
          (contexte) =>
            ficheInterventionDuParc(contexte, interventionId, clientApp()),
          (resultat) => resultat === null,
        );
        expect(fiche).not.toBeNull();
        expect(fiche?.id).toBe(interventionId);
      },
    );
  });
});
