import { type PrismaClient } from "@prisma/client";

import { exigerSocieteActive, type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * L'HISTORIQUE DES EMPLACEMENTS D'UNE MACHINE (9L20-DEPLACER-MACHINE,
 * décision d'Alexis du 10/11/2026) — lu dans le journal d'audit (I8),
 * JAMAIS dans une table dédiée : aucune colonne ni contrainte ne manque pour
 * cela, et `lib/machines/historique.ts` (`sitesTraverses`) l'annonçait déjà —
 * *« le journal d'audit la porte […] et c'est là qu'il faudra la lire le
 * jour où quelqu'un la demandera »*. `machine` porte le déclencheur générique
 * depuis L2-01 (`20260909150000_machine_l2_01`) : `deplacerMachine`
 * (`./depot.ts`) n'écrit donc rien de plus qu'un `UPDATE` ordinaire.
 *
 * **Module SÉPARÉ de `./historique.ts`**, qui lit `intervention` par une
 * SEULE requête partagée par ses deux fonctions
 * (`tests/unit/machines/apercu-parc-borne.test.ts` l'éprouve) : celui-ci lit
 * `journal_audit`, un registre sans rapport, et l'ajouter là-bas aurait fait
 * rougir ce gardien sur un fait qu'il ne garde pas.
 */

/** Un déménagement de la machine, lu depuis le journal (I8). */
export type EmplacementMachine = {
  readonly id: string;
  readonly ancienSiteId: string;
  readonly nouveauSiteId: string;
  readonly utilisateurId: string | null;
  readonly horodatage: Date;
};

/**
 * **Filtré en TypeScript, jamais en SQL** : `valeurs_avant`/`valeurs_apres`
 * sont des colonnes `jsonb` sans index sur leur contenu, et ce module ne lit
 * que les écritures d'UNE machine (bornées par `entite_id`) — un volume que
 * `deplacerMachine` ne fait grossir que d'une ligne par déplacement. Chaque
 * écriture du déclencheur porte la ligne ENTIÈRE avant/après
 * (`to_jsonb(OLD)`/`to_jsonb(NEW)`) ; seules les lignes où `site_id` diffère
 * entre les deux sont un déménagement — une correction qui ne touche pas le
 * site (numéro de série, localisation…) n'en est pas un.
 *
 * `societe_id` est filtré EXPLICITEMENT, même discipline que `lib/audit/
 * journal.ts` : une politique qui protège déjà ne dispense pas la requête de
 * porter son propre critère.
 *
 * **Deux politiques de lecture, par disjonction (D283, 23/11/2026, 9L38)** :
 * `journal_audit_lecture` (admin_societe/direction, le journal ENTIER) et,
 * depuis la migration `20261124100000_historique_emplacements_tous_roles_
 * 9l38`, `journal_audit_lecture_emplacements_machine` — qui n'ouvre, à TOUT
 * rôle de la société, que les lignes `entite = 'machine'` dont le `site_id`
 * diffère entre avant et après. Cette seconde politique rend la requête
 * ci-dessous lisible par RM, RS et ADV (D280/D283) sans jamais élargir le
 * journal entier : un champ de machine modifié sans toucher le site, ou une
 * ligne sur une autre table, reste invisible à qui n'a pas
 * `consulter_journal_audit`.
 *
 * L'appelant (`app/(back-office)/parc/[id]/page.tsx`) ne montre ce bloc qu'à
 * qui a la capacité `consulter_historique_emplacements` (ADMS, DIR, RM, RS,
 * ADV, TEC — D221 ferme déjà tout le back-office au technicien) : un décompte
 * vide pour la mauvaise raison dirait « jamais déplacée » quand c'est
 * seulement « vous ne pouvez pas le savoir » (D50 ne couvre que les refus qui
 * ne mentent pas) — même si, depuis D283, cette raison ne se présente plus
 * pour aucun rôle qui atteint réellement la fiche.
 */
export async function historiqueDesEmplacements(
  contexte: ContexteSession,
  machineId: string,
  client?: PrismaClient,
): Promise<readonly EmplacementMachine[]> {
  const societeId = exigerSocieteActive(contexte);
  const lignes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.journalAudit.findMany({
        where: {
          societe_id: societeId,
          entite: "machine",
          entite_id: machineId,
          action: "modification",
        },
        select: {
          id: true,
          horodatage: true,
          utilisateur_id: true,
          valeurs_avant: true,
          valeurs_apres: true,
        },
        orderBy: { horodatage: "desc" },
      }),
    client,
  );
  const emplacements: EmplacementMachine[] = [];
  for (const ligne of lignes) {
    const avant = ligne.valeurs_avant as Record<string, unknown> | null;
    const apres = ligne.valeurs_apres as Record<string, unknown> | null;
    const ancienSiteId = avant?.["site_id"];
    const nouveauSiteId = apres?.["site_id"];
    if (
      typeof ancienSiteId === "string" &&
      typeof nouveauSiteId === "string" &&
      ancienSiteId !== nouveauSiteId
    ) {
      emplacements.push({
        id: ligne.id,
        ancienSiteId,
        nouveauSiteId,
        utilisateurId: ligne.utilisateur_id,
        horodatage: ligne.horodatage,
      });
    }
  }
  return emplacements;
}
