import { type Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { creerClientDans, modifierClientDans } from "@/lib/clients/depot";
import {
  schemaCreationClient,
  schemaModificationClient,
} from "@/lib/clients/saisie";
import { lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";

import { CHAMPS_CLIENTS, saisieDepuisLaLigne } from "./modeles";
import { indexerLeParcClients } from "./parc-clients";

/**
 * L'APPLICATION D'UN LOT D'IMPORT (L1-08i ; I6, RG-IMP-01, RG-IMP-04, D15).
 *
 * ## Elle n'applique QUE ce que le rapport a montré
 *
 * C'est la seconde moitié de I6, et la première est en base depuis L1-08e : le
 * lot existe dès le contrôle, avec ses lignes et leur action. **L'application
 * ne redécide rien** — elle lit `import_lot_ligne.action` et l'exécute. *Si
 * elle recalculait, la validation humaine aurait porté sur un écran et
 * l'écriture sur autre chose*, ce qui est exactement ce que I6 interdit.
 *
 * ## Une seule transaction, et ce n'est pas un détail
 *
 * Tout le lot s'écrit dans la transaction que `avecContexteApplicatif` ouvre.
 * *Une écriture par ligne laisserait, au premier incident, un lot « contrôlé »
 * dont la moitié des fiches existe — un état que rien ne décrit et que
 * l'annulation ne saurait pas défaire.*
 *
 * ## Le CLIQUET : un lot ne s'applique qu'une fois
 *
 * Il est tenu par une lecture ET par la base : `applique_le` est lié au statut
 * par une équivalence (L1-08e), si bien qu'un second passage ne peut pas
 * réécrire un lot déjà appliqué sans que la contrainte le dise.
 */

/** Ce que l'application refuse, et pourquoi. */
export type RefusApplication =
  "lot_introuvable" | "lot_deja_applique" | "lot_annule";

export type ResultatApplication =
  | { readonly applique: false; readonly motif: RefusApplication }
  | {
      readonly applique: true;
      readonly creations: number;
      readonly modifications: number;
    };

/** Le motif de refus, lu dans l'état du lot. */
function refusDuStatut(statut: string): RefusApplication | null {
  if (statut === "applique") return "lot_deja_applique";
  if (statut === "annule") return "lot_annule";
  return null;
}

/**
 * Applique un lot d'import de CLIENTS.
 *
 * **Le type est dans le nom**, et ce n'est pas une facilité : chaque entité a
 * ses schémas, ses défauts et son dépôt. *Une fonction « applique n'importe
 * quel lot » devrait tenir une table de correspondance entre un type d'import
 * et une écriture, c'est-à-dire une liste close de plus, tenue à la main, que
 * le prochain type oublierait.* Le jour où un second type existe, la question
 * se posera avec deux exemplaires sous les yeux plutôt qu'avec aucun.
 */
export async function appliquerLeLotDeClients(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const societeId = exigerSocieteActive(contexte);
  const parc = await indexerLeParcClients(contexte, client);

  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const lot = await tx.importLot.findUnique({
        where: { id: lotId },
        select: {
          statut: true,
          lignes: {
            where: { action: { in: ["creation", "modification"] } },
            select: {
              id: true,
              rang: true,
              action: true,
              cle: true,
              valeurs: true,
            },
            orderBy: { rang: "asc" },
          },
        },
      });

      // `null` couvre deux cas que rien ne distingue ici, et c'est voulu : le
      // lot n'existe pas, ou il appartient à une autre société et la politique
      // le cache. *Les distinguer ferait un oracle* (D35, D50).
      if (lot === null) {
        return { applique: false as const, motif: "lot_introuvable" as const };
      }
      const refus = refusDuStatut(lot.statut);
      if (refus !== null) {
        return { applique: false as const, motif: refus };
      }

      let creations = 0;
      let modifications = 0;

      for (const ligne of lot.lignes) {
        const valeurs = ligne.valeurs as Record<string, string | undefined>;
        const saisie = saisieDepuisLaLigne(valeurs, CHAMPS_CLIENTS);

        if (ligne.action === "creation") {
          // Le schéma REJOUE ici, et il n'y a pas de seconde lecture : c'est le
          // MÊME schéma que le rapport a consulté (L1-08h). Ce qu'il apporte à
          // ce point est la CONVERSION — les défauts, les types —, pas le
          // verdict, que le rapport a déjà rendu.
          const fiche = await creerClientDans(
            tx,
            societeId,
            schemaCreationClient.parse(saisie),
          );
          await tracer(tx, ligne.id, fiche.id, null);
          creations += 1;
          continue;
        }

        // MODIFICATION. La fiche visée est celle que la CLÉ désigne — jamais
        // une recherche par ressemblance, et jamais une clé ambiguë : le
        // rapport les a déjà rejetées (L1-08g).
        const cible =
          ligne.cle === null ? undefined : parc.fiches.get(ligne.cle);
        if (cible === undefined) {
          // Le parc a bougé entre le contrôle et l'application. *Ce n'est pas
          // une erreur du fichier* : la ligne est laissée en l'état et le lot
          // continue — l'annulation partielle de I6 est faite du même bois.
          continue;
        }

        // `valeurs_avant` est CE QUE D15 EXIGE POUR RESTAURER, et elle se lit
        // AVANT d'écrire : après, il est trop tard, et le journal d'audit
        // porterait la seule trace — sur une table qu'aucune annulation ne lit.
        const avant = await tx.client.findUnique({
          where: { id: cible },
          select: {
            code_externe: true,
            raison_sociale: true,
            ridet: true,
            categorie: true,
            conditions_reglement: true,
            commercial_referent: true,
          },
        });

        await modifierClientDans(
          tx,
          cible,
          schemaModificationClient.parse(saisie),
        );
        await tracer(tx, ligne.id, cible, avant);
        modifications += 1;
      }

      await tx.importLot.update({
        where: { id: lotId },
        data: { statut: "applique", applique_le: await instantDate(tx) },
      });

      // **Aucun décompte des lignes IGNORÉES n'est rendu**, et c'est délibéré :
      // la requête ne les rapporte pas, ce chiffre vaudrait donc zéro en toute
      // circonstance. *Une ligne qui ne peut pas bouger sous une faute n'est
      // jamais présentée à côté de celles qui le peuvent* (§9, 06/09) — le lot
      // porte déjà ses décomptes, et c'est là qu'on les lit.
      return { applique: true as const, creations, modifications };
    },
    client,
  );
}

/**
 * L'INSTANT, DATÉ DANS LE FUSEAU DE LA SOCIÉTÉ (L0-08).
 *
 * *L'instant rendu est le même quel que soit le fuseau* — `maintenant` fait
 * `new Date(Date.now())`. Ce que le détour apporte n'est donc pas une valeur
 * différente : **c'est l'impossibilité d'écrire une heure sans avoir dit
 * laquelle.** Le gardien de L0-08 l'a réclamé ici en nommant le fichier, et il
 * a raison de ne pas faire d'exception pour les cas où « c'est juste un
 * horodatage » : *c'est ainsi qu'une heure d'appareil finit par entrer.*
 */
async function instantDate(tx: Prisma.TransactionClient): Promise<Date> {
  const societe = await tx.societe.findFirstOrThrow({
    select: { fuseau_horaire: true },
  });
  return maintenant(lireFuseau(societe.fuseau_horaire)).instant;
}

/** Écrit sur la ligne ce qu'elle a produit, et ce qu'elle a écrasé. */
async function tracer(
  tx: Prisma.TransactionClient,
  ligneId: string,
  entiteId: string,
  avant: Record<string, unknown> | null,
): Promise<void> {
  await tx.importLotLigne.update({
    where: { id: ligneId },
    data: {
      entite: "client",
      entite_id: entiteId,
      valeurs_avant:
        avant === null ? undefined : (avant as Prisma.InputJsonValue),
    },
  });
}
