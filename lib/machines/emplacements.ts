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

/** Une ligne telle que la fonction SQL la rend — avant filtrage TypeScript. */
type LigneBrute = {
  readonly id: string;
  readonly horodatage: Date;
  readonly utilisateur_id: string | null;
  readonly valeurs_avant: unknown;
  readonly valeurs_apres: unknown;
};

/**
 * **Lue par `app_historique_emplacements_machine`, une fonction `SECURITY
 * DEFINER` arbitrée (D283, 23/11/2026, 9L38 ; liste close de
 * `tests/unit/db/security-definer-sous-arbitrage.test.ts`), jamais par une
 * requête Prisma directe sur `journal_audit`.**
 *
 * **Ce que D280 avait décrit n'est PAS ce qui est posé.** D280 envisageait
 * une SECONDE politique RLS, scopée aux lignes de déménagement, à côté de
 * `journal_audit_lecture`. Mesuré avant d'écrire la migration : une telle
 * politique fait rougir `scripts/lib/politiques-rls.ts` (`ecartsJournal`),
 * qui exige que TOUTE politique de SELECT sur `journal_audit` porte
 * `app_peut_consulter_journal_audit()` — précisément pour qu'aucune politique
 * plus étroite ne puisse, par un ticket, se substituer à un arbitrage. La
 * fonction `SECURITY DEFINER`, elle, ne pose AUCUNE politique sur la table :
 * `journal_audit_lecture` reste l'unique politique de SELECT, et le journal
 * entier reste réservé à `consulter_journal_audit` (ADMS, DIR).
 *
 * La fonction ne reçoit QUE la société et la machine visées — jamais un
 * rôle — et ne rend que les lignes `entite = 'machine'` dont le `site_id`
 * diffère entre `valeurs_avant` et `valeurs_apres` ; une correction qui ne
 * touche pas le site (numéro de série, localisation…) n'en est pas une, et le
 * filtre est posé CÔTÉ SQL (migration
 * `20261124100000_historique_emplacements_tous_roles_9l38`), pas en
 * TypeScript : `societe_id`/`entite_id` bornent déjà le volume à UNE machine.
 *
 * Le filtrage par RÔLE (ADMS, DIR, RM, RS, ADV, TEC) reste la responsabilité
 * de l'application (`consulter_historique_emplacements`,
 * `lib/auth/habilitations.ts`), jamais de la base — même répartition que
 * partout ailleurs (§12.2, deuxième barrière). L'appelant
 * (`app/(back-office)/parc/[id]/page.tsx`) ne montre ce bloc qu'à qui a cette
 * capacité : un décompte vide pour la mauvaise raison dirait « jamais
 * déplacée » quand c'est seulement « vous ne pouvez pas le savoir » (D50 ne
 * couvre que les refus qui ne mentent pas) — même si, depuis D283, cette
 * raison ne se présente plus pour aucun rôle qui atteint réellement la
 * fiche (D221 ferme déjà tout le back-office au technicien).
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
      tx.$queryRaw<LigneBrute[]>`
        SELECT * FROM "app_historique_emplacements_machine"(${societeId}::uuid, ${machineId}::uuid)
      `,
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
