import { type Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { modifierClientDans } from "@/lib/clients/depot";
import { schemaModificationClient } from "@/lib/clients/saisie";
import { avecContexteApplicatif } from "@/lib/db/client";

import { CHAMPS_CLIENTS, saisieDepuisLaLigne } from "./modeles";

/**
 * L'ANNULATION D'UN LOT — PARTIELLE ET SÛRE (L1-08j ; I6, RG-IMP-02, D15, D54).
 *
 * ## Ce que « partielle et sûre » veut dire, exactement
 *
 * I6 : *« L'annulation est partielle et sûre : refus motivé sur les lignes
 * modifiées ou référencées depuis, jamais de suppression en cascade. »* Elle
 * **restaure ce qui peut l'être et refuse le reste avec son motif** — elle ne
 * s'arrête pas au premier refus, et elle ne force rien.
 *
 * **Ni délai ni rang de lot** (D54) : la fenêtre de 24 h et « seul le dernier
 * lot est annulable » ont été supprimées. *Le critère ligne à ligne mesure
 * directement ce que ces deux bornes approchaient, et il traite mieux le cas
 * des imports qui se recouvrent.*
 *
 * ## Les deux refus, et comment chacun se constate
 *
 * **« Modifiée depuis »** se constate en COMPARANT : la fiche porte-t-elle
 * encore ce que l'import y a écrit ? Si non, quelqu'un est passé après — et
 * *défaire son travail serait pire que ne rien défaire.* La comparaison porte
 * sur les seuls champs que l'import a touchés : il n'a pas écrit le reste, il
 * n'a donc rien à en dire.
 *
 * **« Référencée depuis »** est COMPTÉE avant de supprimer, et ce n'est pas le
 * choix qu'on ferait spontanément — *la déduplication du bac (L8-07) lit le
 * refus de la base plutôt que de le prévenir, et c'est plus sûr.* Ici, ce n'est
 * pas possible, et la raison est PostgreSQL lui-même : **une violation de
 * contrainte ABANDONNE la transaction entière** (`25P02`, mesuré). Rattraper le
 * `P2003` ne rend donc pas la main : tout ce qui suit est refusé, et
 * l'annulation cesse d'être partielle au premier refus.
 *
 * **Ce que le comptage ne garantit pas est écrit plutôt que tu** : si un site
 * naît, depuis une autre transaction, entre le comptage et la suppression, le
 * `DELETE` échoue et **l'annulation entière échoue avec lui**. *C'est le bon
 * sens de défaillance — rien n'est défait à moitié —, et il faut alors la
 * rejouer.* `ON DELETE RESTRICT` reste la garantie finale ; le comptage n'est
 * que ce qui permet de refuser UNE ligne sans emporter les autres.
 */

/** Pourquoi une ligne n'a pas pu être défaite. */
export type MotifRefusAnnulation =
  "modifiee_depuis" | "referencee_depuis" | "fiche_absente";

/** Ce qu'une ligne est devenue — et le rapport les rend toutes. */
export type LigneAnnulee = {
  readonly rang: number;
  readonly defaite: boolean;
  readonly motif?: MotifRefusAnnulation;
};

export type RefusAnnulation = "lot_introuvable" | "lot_non_applique";

export type ResultatAnnulation =
  | { readonly annule: false; readonly motif: RefusAnnulation }
  | {
      readonly annule: true;
      /** Les créations défaites, les modifications restaurées, et les refus. */
      readonly lignes: readonly LigneAnnulee[];
    };

/**
 * QUELQUE CHOSE RETIENT-IL CETTE FICHE ?
 *
 * **Les cinq tables sont celles que le SCHÉMA déclare**, et non une liste
 * d'intuition : `client` porte exactement cinq relations inverses. *Le jour où
 * une sixième apparaît, ce comptage devient faux en silence* — et c'est le
 * genre de liste que le §9 veut voir dériver du schéma. Elle ne le peut pas
 * ici : Prisma n'expose pas ses relations inverses à l'exécution. **La limite
 * est donc écrite, et le gardien de la migration ne la couvre pas.**
 */
async function estReferencee(
  tx: Prisma.TransactionClient,
  clientId: string,
): Promise<boolean> {
  const [sites, machines, interventions, contacts, comptes] = await Promise.all(
    [
      tx.site.count({ where: { client_id: clientId } }),
      tx.machine.count({ where: { client_id: clientId } }),
      tx.intervention.count({ where: { client_id: clientId } }),
      tx.contact.count({ where: { client_id: clientId } }),
      tx.utilisateurClient.count({ where: { client_id: clientId } }),
    ],
  );
  return sites + machines + interventions + contacts + comptes > 0;
}

/** Les champs que l'import écrit sur un client — et eux seuls. */
const CHAMPS_ECRITS = [
  "code_externe",
  "raison_sociale",
  "ridet",
  "categorie",
  "conditions_reglement",
  "commercial_referent",
] as const;

type FicheComparable = Readonly<Record<string, string | null>>;

/**
 * La fiche porte-t-elle encore ce que l'import y a écrit ?
 *
 * **Seuls les champs ÉCRITS sont comparés.** L'import n'a pas touché les
 * autres : *les comparer ferait refuser une annulation parce que quelqu'un a
 * renseigné une adresse, ce qui n'a rien à voir avec ce que l'import a fait.*
 */
function porteEncore(
  fiche: FicheComparable,
  attendu: Readonly<Record<string, string>>,
): boolean {
  return CHAMPS_ECRITS.every((champ) => {
    const voulu = attendu[champ];
    // Un champ que l'import n'a pas rempli n'est pas une promesse : il a laissé
    // le défaut du schéma, et le comparer à `null` ferait dépendre le verdict
    // d'un défaut plutôt que d'une écriture.
    return voulu === undefined ? true : (fiche[champ] ?? null) === voulu;
  });
}

/**
 * Annule un lot d'import de CLIENTS.
 *
 * Le lot passe à `annule` **même si des lignes ont été refusées** : c'est ce que
 * « partielle » veut dire. *Un lot qui resterait « appliqué » parce qu'une
 * ligne sur trois cents n'a pas pu être défaite obligerait à tout refaire pour
 * rien, et personne ne saurait ce qui a déjà été rendu.*
 */
export async function annulerLeLotDeClients(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatAnnulation> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const lot = await tx.importLot.findUnique({
        where: { id: lotId },
        select: {
          statut: true,
          lignes: {
            where: { entite_id: { not: null } },
            select: {
              rang: true,
              action: true,
              entite_id: true,
              valeurs: true,
              valeurs_avant: true,
            },
            orderBy: { rang: "asc" },
          },
        },
      });

      // Un lot d'une autre société est « introuvable » — les distinguer ferait
      // un oracle (D35, D50).
      if (lot === null) {
        return { annule: false as const, motif: "lot_introuvable" as const };
      }
      if (lot.statut !== "applique") {
        return { annule: false as const, motif: "lot_non_applique" as const };
      }

      const lignes: LigneAnnulee[] = [];

      // **DANS L'ORDRE INVERSE.** Un lot peut créer une fiche puis la modifier ;
      // défaire dans l'ordre d'écriture restaurerait un état intermédiaire avant
      // de supprimer, ce qui ne change rien ici mais cessera d'être vrai dès
      // qu'un lot touchera deux fois la même fiche.
      for (const ligne of [...lot.lignes].reverse()) {
        const cible = ligne.entite_id;
        if (cible === null) continue;

        const fiche = await tx.client.findUnique({
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
        if (fiche === null) {
          // Effacée entre-temps. *Il n'y a rien à défaire, et le dire est plus
          // utile que de le taire* — le rapport doit expliquer chaque ligne.
          lignes.push({
            rang: ligne.rang,
            defaite: false,
            motif: "fiche_absente",
          });
          continue;
        }

        const ecrit = saisieDepuisLaLigne(
          ligne.valeurs as Record<string, string | undefined>,
          CHAMPS_CLIENTS,
        );
        if (!porteEncore(fiche, ecrit)) {
          lignes.push({
            rang: ligne.rang,
            defaite: false,
            motif: "modifiee_depuis",
          });
          continue;
        }

        if (ligne.action === "creation") {
          // **JAMAIS DE SUPPRESSION EN CASCADE** (I6) : ce qui référence la
          // fiche la retient, et c'est la ligne qui est refusée — pas ses
          // enfants qui sont emportés.
          if (await estReferencee(tx, cible)) {
            lignes.push({
              rang: ligne.rang,
              defaite: false,
              motif: "referencee_depuis",
            });
            continue;
          }
          await tx.client.delete({ where: { id: cible } });
          lignes.push({ rang: ligne.rang, defaite: true });
          continue;
        }

        // MODIFICATION : on rend la fiche à ce qu'elle était. `valeurs_avant`
        // porte les champs écrits, `null` compris — et `null` veut bien dire
        // « efface », ce que `schemaModificationClient` distingue de
        // « ne touche pas » (`undefined`).
        await modifierClientDans(
          tx,
          cible,
          schemaModificationClient.parse(ligne.valeurs_avant ?? {}),
        );
        lignes.push({ rang: ligne.rang, defaite: true });
      }

      const societe = await tx.societe.findFirstOrThrow({
        select: { fuseau_horaire: true },
      });
      await tx.importLot.update({
        where: { id: lotId },
        data: {
          statut: "annule",
          annule_le: maintenant(lireFuseau(societe.fuseau_horaire)).instant,
        },
      });

      return { annule: true as const, lignes };
    },
    client,
  );
}
