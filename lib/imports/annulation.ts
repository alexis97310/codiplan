import { type Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { modifierClientDans } from "@/lib/clients/depot";
import { schemaModificationClient } from "@/lib/clients/saisie";
import { avecContexteApplicatif } from "@/lib/db/client";

import { modifierSiteDans } from "@/lib/sites/depot";
import { schemaModificationSite } from "@/lib/sites/saisie";
import { modifierModeleDans } from "@/lib/materiel/depot";
import { schemaModeleMateriel } from "@/lib/materiel/saisie";
import { modifierPrestationDans } from "@/lib/prestations/depot";
import { schemaPrestation } from "@/lib/prestations/saisie";

import {
  CHAMPS_CLIENTS,
  CHAMPS_MODELES,
  CHAMPS_PRESTATIONS,
  preparerUnSite,
  saisieDepuisLaLigne,
} from "./modeles";
import { indexerLesAgences } from "./parc-agences";
import { indexerLeParcClients } from "./parc-clients";

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

type FicheComparable = Readonly<Record<string, unknown>>;

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
  champs: readonly string[] = CHAMPS_ECRITS,
): boolean {
  return champs.every((champ) => {
    const voulu = attendu[champ];
    // Un champ que l'import n'a pas rempli n'est pas une promesse : il a laissé
    // le défaut du schéma, et le comparer à `null` ferait dépendre le verdict
    // d'un défaut plutôt que d'une écriture.
    if (voulu === undefined) return true;
    // **Une colonne NON TEXTUELLE ne peut pas porter ce qu'une cellule dit**, et
    // la comparaison est donc FAUSSE plutôt que vraie : *un verdict « inchangé »
    // rendu sur une colonne qu'on ne sait pas comparer autoriserait une
    // suppression qu'on n'a pas vérifiée.* Aucune des quatre listes de champs
    // écrits n'en nomme, et c'est le sens de défaillance qui le garantit si
    // l'une venait à le faire.
    const present = fiche[champ];
    return typeof present === "string" && present === voulu;
  });
}

/**
 * UNE LIGNE À DÉFAIRE — telle que l'application l'a laissée.
 */
type LigneADefaire = {
  readonly rang: number;
  readonly action: string;
  readonly entiteId: string;
  readonly valeurs: Record<string, string | undefined>;
  readonly valeursAvant: unknown;
};

/**
 * L'ENVELOPPE QUE LES QUATRE ANNULATIONS PARTAGENT (R6-01).
 *
 * Même partage et même borne que `appliquerLesLignes` : elle porte la lecture
 * du lot, le refus sur un lot non appliqué, l'ORDRE INVERSE, la transaction
 * unique et la clôture. **Elle ne sait ni quelle table restaurer, ni ce qui
 * retient une fiche, ni quels champs l'import avait écrits** — tout cela est
 * dans le `defaire` que l'appelant fournit, et c'est l'appelant qui nomme son
 * type.
 *
 * **Le lot passe à `annule` même si des lignes ont été refusées** : c'est ce
 * que « partielle » veut dire. *Un lot qui resterait « appliqué » parce qu'une
 * ligne sur trois cents n'a pas pu être défaite obligerait à tout refaire pour
 * rien, et personne ne saurait ce qui a déjà été rendu.*
 */
async function annulerLesLignes(
  contexte: ContexteSession,
  lotId: string,
  client: PrismaClient | undefined,
  defaire: (
    tx: Prisma.TransactionClient,
    ligne: LigneADefaire,
  ) => Promise<LigneAnnulee>,
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
      for (const brute of [...lot.lignes].reverse()) {
        if (brute.entite_id === null) continue;
        lignes.push(
          await defaire(tx, {
            rang: brute.rang,
            action: brute.action,
            entiteId: brute.entite_id,
            valeurs: brute.valeurs as Record<string, string | undefined>,
            valeursAvant: brute.valeurs_avant,
          }),
        );
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

/** Annule un lot d'import de CLIENTS. */
export async function annulerLeLotDeClients(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatAnnulation> {
  return annulerLesLignes(contexte, lotId, client, async (tx, ligne) => {
    const fiche = await tx.client.findUnique({
      where: { id: ligne.entiteId },
      select: {
        code_externe: true,
        raison_sociale: true,
        ridet: true,
        categorie: true,
        conditions_reglement: true,
        commercial_referent: true,
      },
    });
    // Effacée entre-temps. *Il n'y a rien à défaire, et le dire est plus utile
    // que de le taire* — le rapport doit expliquer chaque ligne.
    if (fiche === null) {
      return { rang: ligne.rang, defaite: false, motif: "fiche_absente" };
    }

    const ecrit = saisieDepuisLaLigne(ligne.valeurs, CHAMPS_CLIENTS);
    if (!porteEncore(fiche, ecrit)) {
      return { rang: ligne.rang, defaite: false, motif: "modifiee_depuis" };
    }

    if (ligne.action === "creation") {
      // **JAMAIS DE SUPPRESSION EN CASCADE** (I6) : ce qui référence la fiche
      // la retient, et c'est la ligne qui est refusée — pas ses enfants qui
      // sont emportés.
      if (await estReferencee(tx, ligne.entiteId)) {
        return { rang: ligne.rang, defaite: false, motif: "referencee_depuis" };
      }
      await tx.client.delete({ where: { id: ligne.entiteId } });
      return { rang: ligne.rang, defaite: true };
    }

    // MODIFICATION : on rend la fiche à ce qu'elle était. `valeurs_avant` porte
    // les champs écrits, `null` compris — et `null` veut bien dire « efface »,
    // ce que `schemaModificationClient` distingue de « ne touche pas »
    // (`undefined`).
    await modifierClientDans(
      tx,
      ligne.entiteId,
      schemaModificationClient.parse(ligne.valeursAvant ?? {}),
    );
    return { rang: ligne.rang, defaite: true };
  });
}

/* ────────────────────────────────────────────────────────────────────────
 * LES TROIS AUTRES TYPES (R6-01)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * CE QUI RETIENT UN SITE — les six relations inverses que le SCHÉMA déclare.
 *
 * Même limite que pour les clients, et elle se répète plutôt que de se déduire :
 * *Prisma n'expose pas ses relations inverses à l'exécution*, si bien que cette
 * liste est tenue à la main et devient fausse en silence le jour où une
 * septième apparaît. **Ce que le silence coûte est borné** : `ON DELETE
 * RESTRICT` reste la garantie finale, et une relation oubliée fait échouer
 * l'annulation ENTIÈRE plutôt que de supprimer en cascade. *C'est le bon sens
 * de défaillance, et c'est ce qui rend la limite acceptable.*
 */
async function siteEstReference(
  tx: Prisma.TransactionClient,
  siteId: string,
): Promise<boolean> {
  const comptes = await Promise.all([
    tx.machine.count({ where: { site_id: siteId } }),
    tx.intervention.count({ where: { site_id: siteId } }),
    tx.demande.count({ where: { site_id: siteId } }),
    tx.contact.count({ where: { site_id: siteId } }),
    tx.utilisateurClientSite.count({ where: { site_id: siteId } }),
    tx.siteHabilitationRequise.count({ where: { site_id: siteId } }),
  ]);
  return comptes.reduce((a, b) => a + b, 0) > 0;
}

/**
 * LES CHAMPS QUE L'IMPORT ÉCRIT SUR UN SITE — **et ils ne sont PAS les mêmes
 * selon l'action**, ce qui n'a rien d'une subtilité de forme.
 *
 * À la **CRÉATION**, l'import écrit les deux parents : ils viennent d'une
 * RÉSOLUTION et non d'une cellule, et il les écrit tout de même. *Les omettre
 * ferait rendre « inchangé » un site déménagé depuis l'import, et l'annulation
 * supprimerait une fiche que quelqu'un venait de rattacher ailleurs.*
 *
 * À la **MODIFICATION**, l'import n'en écrit AUCUN — voir
 * `appliquerLeLotDeSites` : `client_id` n'est pas modifiable, et `agence_id` ne
 * voyage jamais sans `temps_trajet_min` (D56), que le gabarit n'expose pas.
 * **Les comparer ici refuserait donc l'annulation d'un lot parfaitement
 * défaisable**, sur la foi d'une colonne que l'import n'a jamais touchée — et
 * le motif rendu, « modifiée depuis », désignerait un coupable qui n'existe
 * pas. *L'import n'a pas écrit le reste, il n'a rien à en dire* : la règle de
 * `porteEncore` est la même depuis L1-08j, c'est sa population qui devait
 * suivre.
 */
const CHAMPS_SITES_MODIFIES = [
  "libelle",
  "commune",
  "zone_geo",
  "consignes_acces",
] as const;

const CHAMPS_ECRITS_SITES = [
  "client_id",
  "agence_id",
  ...CHAMPS_SITES_MODIFIES,
] as const;

/** Annule un lot d'import de SITES. */
export async function annulerLeLotDeSites(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatAnnulation> {
  // **Les deux parcs sont indexés pour RECONSTITUER ce que l'import a écrit**,
  // et non pour décider quoi que ce soit. *Les deux parents d'un site ne sont
  // dans aucune cellule : ils ont été RÉSOLUS*, si bien que `saisieDepuisLaLigne`
  // seule ne les rend pas — et une comparaison qui les omet rend « inchangé »
  // sur un site déménagé depuis l'import.
  const clients = await indexerLeParcClients(contexte, client);
  const agences = await indexerLesAgences(contexte, client);

  return annulerLesLignes(contexte, lotId, client, async (tx, ligne) => {
    const fiche = await tx.site.findUnique({
      where: { id: ligne.entiteId },
      select: {
        client_id: true,
        agence_id: true,
        libelle: true,
        commune: true,
        zone_geo: true,
        consignes_acces: true,
      },
    });
    if (fiche === null) {
      return { rang: ligne.rang, defaite: false, motif: "fiche_absente" };
    }

    // **Ce que l'import a écrit se RECONSTITUE par la fonction même qui l'a
    // produit** — `preparerUnSite` —, jamais par une seconde lecture. Elle rend
    // les quatre colonnes du fichier ET les deux parents résolus, ce qui est
    // exactement l'ensemble que `CHAMPS_ECRITS_SITES` compare.
    const reconstitue = preparerUnSite(clients, agences, ligne.valeurs);
    if (!reconstitue.prete) {
      // Le parc a bougé au point qu'on ne sait plus ce que l'import avait
      // écrit. *Refuser est la seule lecture qui ne détruit rien* : défaire
      // sans pouvoir comparer, c'est supprimer une fiche dont on ignore si
      // quelqu'un l'a reprise depuis.
      return { rang: ligne.rang, defaite: false, motif: "modifiee_depuis" };
    }
    const ecrit = reconstitue.saisie as Record<string, string>;
    const compares =
      ligne.action === "creation" ? CHAMPS_ECRITS_SITES : CHAMPS_SITES_MODIFIES;
    if (!porteEncore(fiche, ecrit, compares)) {
      return { rang: ligne.rang, defaite: false, motif: "modifiee_depuis" };
    }

    if (ligne.action === "creation") {
      if (await siteEstReference(tx, ligne.entiteId)) {
        return { rang: ligne.rang, defaite: false, motif: "referencee_depuis" };
      }
      await tx.site.delete({ where: { id: ligne.entiteId } });
      return { rang: ligne.rang, defaite: true };
    }

    await modifierSiteDans(
      tx,
      ligne.entiteId,
      schemaModificationSite.parse(ligne.valeursAvant ?? {}),
    );
    return { rang: ligne.rang, defaite: true };
  });
}

/**
 * CE QUI RETIENT UN MODÈLE — `machine` et `document`, les deux que le schéma
 * déclare. Même limite qu'aux sites, et même sens de défaillance.
 */
async function modeleEstReference(
  tx: Prisma.TransactionClient,
  modeleId: string,
): Promise<boolean> {
  const comptes = await Promise.all([
    tx.machine.count({ where: { modele_id: modeleId } }),
    tx.document.count({ where: { modele_id: modeleId } }),
  ]);
  return comptes.reduce((a, b) => a + b, 0) > 0;
}

const CHAMPS_ECRITS_MODELES = ["marque", "reference"] as const;

/**
 * Annule un lot d'import de MODÈLES.
 *
 * **La famille n'est PAS comparée**, et c'est une décision : elle est résolue
 * depuis une cellule, mais la reclasser est un geste ordinaire du référentiel
 * (L1-05b l'offre à l'écran). *Refuser l'annulation parce qu'on a rangé un
 * modèle dans la bonne famille punirait exactement le travail qu'on attend.*
 * Le rattachement d'un SITE, lui, est comparé — un site déménagé n'est pas le
 * même lieu, et le ramener en arrière déplacerait des interventions.
 */
export async function annulerLeLotDeModeles(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatAnnulation> {
  return annulerLesLignes(contexte, lotId, client, async (tx, ligne) => {
    const fiche = await tx.modeleMateriel.findUnique({
      where: { id: ligne.entiteId },
      select: {
        famille_id: true,
        marque: true,
        reference: true,
        periodicite_jours: true,
        periodicite_compteur: true,
      },
    });
    if (fiche === null) {
      return { rang: ligne.rang, defaite: false, motif: "fiche_absente" };
    }

    const ecrit = saisieDepuisLaLigne(ligne.valeurs, CHAMPS_MODELES);
    if (!porteEncore(fiche, ecrit, CHAMPS_ECRITS_MODELES)) {
      return { rang: ligne.rang, defaite: false, motif: "modifiee_depuis" };
    }

    if (ligne.action === "creation") {
      if (await modeleEstReference(tx, ligne.entiteId)) {
        return { rang: ligne.rang, defaite: false, motif: "referencee_depuis" };
      }
      await tx.modeleMateriel.delete({ where: { id: ligne.entiteId } });
      return { rang: ligne.rang, defaite: true };
    }

    // **Le schéma du matériel est UNIQUE — il n'a pas de jumeau « modification
    // », et tous ses champs ne sont pas facultatifs.** `valeurs_avant` porte
    // les cinq colonnes lues avant l'écriture, ce qui suffit à le satisfaire :
    // la restauration est donc une réécriture complète, jamais un `patch`.
    await modifierModeleDans(
      tx,
      ligne.entiteId,
      schemaModeleMateriel.parse(ligne.valeursAvant ?? {}),
    );
    return { rang: ligne.rang, defaite: true };
  });
}

/**
 * CE QUI RETIENT UNE PRESTATION — **rien, aujourd'hui**, et c'est mesuré plutôt
 * que supposé : `grep "prestation" prisma/schema.prisma` ne rend aucune clé
 * étrangère entrante, le catalogue n'ayant encore aucun lecteur en base.
 *
 * *Une fonction qui compte zéro table est vacuité pure* (§9, 30/08), et c'est
 * pourquoi elle n'existe pas : la ligne ci-dessous dit qu'il n'y a rien à
 * compter, plutôt qu'un `Promise.all([])` qui aurait l'air de mesurer.
 *
 * **Ce que le jour venu coûtera est borné et écrit** : quand `intervention`
 * désignera sa prestation, `ON DELETE RESTRICT` fera échouer le `DELETE`, donc
 * l'annulation ENTIÈRE — bruyamment, jamais en silence. *Le sens de défaillance
 * est le bon, et c'est ce qui rend l'absence de comptage acceptable ici.*
 */
const CHAMPS_ECRITS_PRESTATIONS = ["code", "libelle"] as const;

/** Annule un lot d'import de PRESTATIONS. */
export async function annulerLeLotDePrestations(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatAnnulation> {
  return annulerLesLignes(contexte, lotId, client, async (tx, ligne) => {
    const fiche = await tx.prestation.findUnique({
      where: { id: ligne.entiteId },
      select: {
        code: true,
        libelle: true,
        famille_id: true,
        duree_standard_min: true,
      },
    });
    if (fiche === null) {
      return { rang: ligne.rang, defaite: false, motif: "fiche_absente" };
    }

    const ecrit = saisieDepuisLaLigne(ligne.valeurs, CHAMPS_PRESTATIONS);
    if (!porteEncore(fiche, ecrit, CHAMPS_ECRITS_PRESTATIONS)) {
      return { rang: ligne.rang, defaite: false, motif: "modifiee_depuis" };
    }

    if (ligne.action === "creation") {
      await tx.prestation.delete({ where: { id: ligne.entiteId } });
      return { rang: ligne.rang, defaite: true };
    }

    await modifierPrestationDans(
      tx,
      ligne.entiteId,
      schemaPrestation.parse(ligne.valeursAvant ?? {}),
    );
    return { rang: ligne.rang, defaite: true };
  });
}
