import { PrismaClient } from "@prisma/client";

import { avecSociete } from "../lib/db/rls";
import { uuidv7 } from "../lib/db/uuid";
import {
  COMPTES_PORTAIL,
  DEVISES,
  PARITES,
  SOCIETES,
  UTILISATEURS_INTERNES,
  societeParCode,
} from "./seed-data";

/**
 * Amorçage du socle multi-société (ticket L0-03).
 *
 * Écrit le jeu de démonstration décrit dans `seed-data.ts` : deux sociétés —
 * l'une en XPF avec trois agences (Ducos, Koné, Dolbeau), l'autre en EUR — et
 * un compte portail rattaché à un client. Idempotent : les `upsert` portent sur
 * les clés naturelles (code, email, identifiant fixe de société), les UUID v7
 * (I10) ne sont attribués qu'à la création.
 *
 * Le seed CONSERVE le rôle propriétaire — il instancie son propre client, sans
 * passer par `lib/db/client`, dont le contrôle de démarrage refuserait ce rôle.
 * Depuis `FORCE ROW LEVEL SECURITY`, ce rôle est néanmoins soumis aux politiques
 * de cloisonnement : chaque écriture sur une table cloisonnée est donc encadrée
 * par `avecSociete`, qui pose `app.societe_id`. Les référentiels de plateforme
 * (`devise`, `parite`) et l'identité globale (`utilisateur`) ne sont pas
 * cloisonnés et s'écrivent hors contexte.
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

  for (const parite of PARITES) {
    const date_effet = new Date(parite.date_effet);

    await prisma.parite.upsert({
      where: {
        devise_code_date_effet: {
          devise_code: parite.devise_code,
          date_effet,
        },
      },
      update: { taux: parite.taux, source: parite.source },
      create: {
        id: uuidv7(),
        devise_code: parite.devise_code,
        date_effet,
        taux: parite.taux,
        source: parite.source,
      },
    });
  }

  for (const societe of SOCIETES) {
    const { id, agences, ...champsSociete } = societe;

    // La politique de `societe` est `id = app.societe_id` : une société ne peut
    // s'écrire que sous son propre contexte, y compris depuis le seed.
    await avecSociete(prisma, id, async (tx) => {
      await tx.societe.upsert({
        where: { id },
        update: champsSociete,
        create: { id, ...champsSociete },
      });

      for (const agence of agences) {
        await tx.agence.upsert({
          where: { societe_id_code: { societe_id: id, code: agence.code } },
          update: { libelle: agence.libelle, adresse: agence.adresse },
          create: {
            id: uuidv7(),
            societe_id: id,
            code: agence.code,
            libelle: agence.libelle,
            adresse: agence.adresse,
          },
        });
      }
    });
  }

  for (const utilisateur of UTILISATEURS_INTERNES) {
    // `utilisateur` porte l'identité globale : pas de `societe_id`, pas de
    // cloisonnement (sa visibilité relève de l'authentification, L0-06).
    const enregistrement = await prisma.utilisateur.upsert({
      where: { email: utilisateur.email },
      update: {},
      create: { id: uuidv7(), email: utilisateur.email },
    });

    for (const habilitation of utilisateur.habilitations) {
      const societeId = societeParCode(habilitation.societe_code).id;

      await avecSociete(prisma, societeId, (tx) =>
        tx.utilisateurSociete.upsert({
          where: {
            utilisateur_id_societe_id: {
              utilisateur_id: enregistrement.id,
              societe_id: societeId,
            },
          },
          update: { role: habilitation.role },
          create: {
            id: uuidv7(),
            utilisateur_id: enregistrement.id,
            societe_id: societeId,
            role: habilitation.role,
          },
        }),
      );
    }
  }

  for (const compte of COMPTES_PORTAIL) {
    const utilisateur = await prisma.utilisateur.upsert({
      where: { email: compte.email },
      update: {},
      create: { id: uuidv7(), email: compte.email },
    });

    const societeId = societeParCode(compte.societe_code).id;

    await avecSociete(prisma, societeId, (tx) =>
      tx.utilisateurClient.upsert({
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
          societe_id: societeId,
          perimetre_sites: compte.perimetre_sites,
        },
      }),
    );
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
