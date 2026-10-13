import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * LA ROUTE DES OCTETS NE FRANCHIT PAS LA SOCIÉTÉ (9EWB-PHOTOS-EN-BASE).
 *
 * `lib/documents/depot.ts:lireDocument` passe par `avecContexteApplicatif`,
 * donc par la politique « héritage » de `document` — mais les photos sont
 * désormais gardées EN BASE (D96), et c'est la route ELLE-MÊME, pas
 * seulement le dépôt, qu'il faut éprouver : une société voisine ne doit
 * jamais recevoir les octets, et la route doit rendre 404, pas une erreur.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/photo-octets-societe.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import { type ContexteActif } from "@/lib/auth/contexte";
import { exigerCapacite } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { deposerPhotoIntervention } from "@/lib/documents/depot";

import { GET as getOctets } from "@/app/api/documents/[id]/octets/route";

import { clientOwner, fermerClients } from "./setup/db";
import {
  INTERVENTION_A1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

afterAll(fermerClients);

function contexteSocieteA(): ContexteActif {
  return {
    utilisateurId: UTILISATEUR_PAR_ROLE[Role.technicien],
    societeId: SOCIETE_A,
    role: Role.technicien,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

function contexteSocieteB(): ContexteActif {
  return {
    utilisateurId: UTILISATEUR_INTERNE_B,
    societeId: SOCIETE_B,
    role: Role.adv,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

function requeteOctets(id: string): Request {
  return new Request(`http://localhost/api/documents/${id}/octets`);
}

describe("la route des octets d'un document ne franchit pas la société", () => {
  it("une photo déposée sous A rend 404 sous le contexte de B", async () => {
    // `deposerPhotoIntervention` reçoit DÉJÀ son contexte résolu — elle
    // n'appelle jamais `exigerCapacite` elle-même. Un mock posé ici resterait
    // en file et serait consommé par le PROCHAIN appel route, décalant tout
    // ce qui suit (mesuré : la lecture sous B recevait le contexte de A).
    const depot = await deposerPhotoIntervention(
      contexteSocieteA(),
      INTERVENTION_A1,
      {
        classe: "client",
        libelle: "Photo du cloisonnement",
        nom_fichier: "cloisonnement.jpg",
        type_mime: "image/jpeg",
        octets: Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]),
      },
    );
    expect(depot).not.toBeNull();
    const id = depot?.id as string;

    try {
      vi.mocked(exigerCapacite).mockResolvedValueOnce(contexteSocieteA());
      const sousA = await getOctets(requeteOctets(id), {
        params: Promise.resolve({ id }),
      });
      expect(sousA.status).toBe(200);

      vi.mocked(exigerCapacite).mockResolvedValueOnce(contexteSocieteB());
      const sousB = await getOctets(requeteOctets(id), {
        params: Promise.resolve({ id }),
      });
      expect(sousB.status).toBe(404);
    } finally {
      await clientOwner().document.delete({ where: { id } });
    }
  });
});
