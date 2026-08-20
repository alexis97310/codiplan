import { PrismaClient } from "@prisma/client";

import { uuidv7 } from "../lib/db/uuid";
import {
  COMPTES_PORTAIL,
  DEVISES,
  SOCIETES,
  UTILISATEURS_INTERNES,
} from "./seed-data";

/**
 * Amorçage du socle multi-société (ticket L0-03).
 *
 * Écrit le jeu de démonstration décrit dans `seed-data.ts` : deux sociétés —
 * l'une en XPF avec trois agences (Ducos, Koné, Dolbeau), l'autre en EUR — et
 * un compte portail rattaché à un client. Idempotent : les `upsert` portent sur
 * les clés naturelles (code, email), les UUID v7 (I10) ne sont attribués qu'à
 * la création.
 */
const prisma = new PrismaClient();

async function seed(): Promise<void> {
  for (const devise of DEVISES) {
    await prisma.devise.upsert({
      where: { code: devise.code },
      update: {
        libelle: devise.libelle,
        decimales: devise.decimales,
        symbole: devise.symbole,
      },
      create: devise,
    });
  }

  for (const societe of SOCIETES) {
    const { agences, ...champsSociete } = societe;

    const enregistrement = await prisma.societe.upsert({
      where: { code: societe.code },
      update: champsSociete,
      create: { id: uuidv7(), ...champsSociete },
    });

    for (const agence of agences) {
      await prisma.agence.upsert({
        where: {
          societe_id_code: {
            societe_id: enregistrement.id,
            code: agence.code,
          },
        },
        update: { libelle: agence.libelle, adresse: agence.adresse },
        create: {
          id: uuidv7(),
          societe_id: enregistrement.id,
          code: agence.code,
          libelle: agence.libelle,
          adresse: agence.adresse,
        },
      });
    }
  }

  for (const utilisateur of UTILISATEURS_INTERNES) {
    const enregistrement = await prisma.utilisateur.upsert({
      where: { email: utilisateur.email },
      update: {},
      create: { id: uuidv7(), email: utilisateur.email },
    });

    for (const habilitation of utilisateur.habilitations) {
      const societe = await prisma.societe.findUniqueOrThrow({
        where: { code: habilitation.societe_code },
      });

      await prisma.utilisateurSociete.upsert({
        where: {
          utilisateur_id_societe_id: {
            utilisateur_id: enregistrement.id,
            societe_id: societe.id,
          },
        },
        update: { role: habilitation.role },
        create: {
          id: uuidv7(),
          utilisateur_id: enregistrement.id,
          societe_id: societe.id,
          role: habilitation.role,
        },
      });
    }
  }

  for (const compte of COMPTES_PORTAIL) {
    const utilisateur = await prisma.utilisateur.upsert({
      where: { email: compte.email },
      update: {},
      create: { id: uuidv7(), email: compte.email },
    });

    const societe = await prisma.societe.findUniqueOrThrow({
      where: { code: compte.societe_code },
    });

    await prisma.utilisateurClient.upsert({
      where: {
        utilisateur_id_client_id: {
          utilisateur_id: utilisateur.id,
          client_id: compte.client_id,
        },
      },
      update: { perimetre_sites: compte.perimetre_sites },
      create: {
        id: uuidv7(),
        utilisateur_id: utilisateur.id,
        client_id: compte.client_id,
        societe_id: societe.id,
        perimetre_sites: compte.perimetre_sites,
      },
    });
  }
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (erreur: unknown) => {
    await prisma.$disconnect();
    throw erreur;
  });
