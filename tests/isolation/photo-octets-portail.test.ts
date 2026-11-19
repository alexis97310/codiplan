import { afterAll, describe, expect, it } from "vitest";

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import {
  deposerPhotoIntervention,
  octetsDocumentDuParc,
} from "@/lib/documents/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_A2,
  INTERVENTION_A1,
  PORTAIL_A2_CLIENT,
  PORTAIL_A_CLIENT,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9L28-PORTAIL-PHOTOS-BORNES-D236, point 1 — LES PHOTOS DU BON, VISIBLES AU
 * PORTAIL (décision d'Alexis du 10/11/2026).
 *
 * `octetsDocumentDuParc` ne compare rien lui-même (voir son docblock,
 * `lib/documents/depot.ts`) : la politique « héritage » de `document` et la
 * forme « parc » de `intervention` (D84, D93) tranchent déjà la société, le
 * client et la classe. Seule la borne de clôture est écrite ici, en code, et
 * c'est elle que ce fichier éprouve en plus du cloisonnement.
 *
 * Une intervention JETABLE, jamais `INTERVENTION_A1` directement — même
 * discipline que `9j22-portail-bon-technicien-temps.test.ts` : muter le
 * fixture partagé romprait d'autres fichiers qui le lisent.
 */

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

afterAll(fermerClients);

function contextePortail(
  utilisateurId: string,
  clientId: string,
): ContexteSession {
  return {
    utilisateurId,
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

/**
 * Une intervention jetable du client A1, sur le site de son périmètre.
 * `cloturee` quand `close` est vrai, `en_cours` sinon — même geste que
 * `surUneInterventionAvecSegment` du fichier voisin, sans le segment, que ce
 * point n'éprouve pas.
 */
async function surUneIntervention(
  close: boolean,
  travail: (id: string) => Promise<void>,
): Promise<void> {
  const id = uuidv7();
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "technicien_id", "duree_estimee_min",
       "modifie_le", "cloturee_le")
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif'::"TypeIntervention", ${close ? "'cloturee'" : "'en_cours'"},
            "technicien_id", 60, now(), ${close ? "now()" : "NULL"}
       FROM "intervention" WHERE "id" = '${INTERVENTION_A1}'`,
  );
  try {
    await travail(id);
  } finally {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "document" WHERE "intervention_id" = '${id}'`,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
}

describe("les photos du bon, au portail (9L28, D236)", () => {
  it("le client DE l'intervention close voit SA photo", async () => {
    await surUneIntervention(true, async (id) => {
      const depot = await deposerPhotoIntervention(
        contexteInterne(),
        id,
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

      const octets = await octetsDocumentDuParc(
        contextePortail(PORTAIL_A_CLIENT, CLIENT_A1),
        depot?.id as string,
        clientApp(),
      );
      expect(octets).not.toBeNull();
      expect(octets?.nom_fichier).toBe("avant-apres.jpg");
    });
  });

  it("un AUTRE client ne voit pas cette photo (404)", async () => {
    await surUneIntervention(true, async (id) => {
      const depot = await deposerPhotoIntervention(
        contexteInterne(),
        id,
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

      const octets = await octetsDocumentDuParc(
        contextePortail(PORTAIL_A2_CLIENT, CLIENT_A2),
        depot?.id as string,
        clientApp(),
      );
      expect(octets).toBeNull();
    });
  });

  it("une photo de classe `interne` reste fermée au portail (404)", async () => {
    await surUneIntervention(true, async (id) => {
      const depot = await deposerPhotoIntervention(
        contexteInterne(),
        id,
        {
          classe: "interne",
          libelle: "Note pour le bureau",
          nom_fichier: "note-bureau.jpg",
          type_mime: "image/jpeg",
          octets: Buffer.from([4, 5, 6]),
        },
        clientApp(),
      );
      expect(depot).not.toBeNull();

      const octets = await octetsDocumentDuParc(
        contextePortail(PORTAIL_A_CLIENT, CLIENT_A1),
        depot?.id as string,
        clientApp(),
      );
      expect(octets).toBeNull();
    });
  });

  it("TÉMOIN — la même photo, sous le contexte interne, reste visible", async () => {
    await surUneIntervention(true, async (id) => {
      const depot = await deposerPhotoIntervention(
        contexteInterne(),
        id,
        {
          classe: "interne",
          libelle: "Note pour le bureau",
          nom_fichier: "note-bureau.jpg",
          type_mime: "image/jpeg",
          octets: Buffer.from([4, 5, 6]),
        },
        clientApp(),
      );
      expect(depot).not.toBeNull();

      const lue = await clientApp().document.findFirst({
        where: { id: depot?.id as string },
        select: { id: true },
      });
      // Sans contexte RLS posé : la lecture nue, sous le rôle applicatif,
      // ne rend rien — témoin que la table mord bien, pas seulement que
      // notre fonction filtre (§9, 07/09).
      expect(lue).toBeNull();
    });
  });

  it("une intervention PAS ENCORE close : la photo du client reste fermée", async () => {
    await surUneIntervention(false, async (id) => {
      const depot = await deposerPhotoIntervention(
        contexteInterne(),
        id,
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

      const octets = await octetsDocumentDuParc(
        contextePortail(PORTAIL_A_CLIENT, CLIENT_A1),
        depot?.id as string,
        clientApp(),
      );
      expect(octets).toBeNull();
    });
  });
});
