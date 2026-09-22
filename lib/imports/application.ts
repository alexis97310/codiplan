import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { creerClientsEnLot, modifierClientDans } from "@/lib/clients/depot";
import {
  schemaCreationClient,
  schemaModificationClient,
  type CreationClient,
} from "@/lib/clients/saisie";
import { lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";

import { creerSitesEnLot, modifierSiteDans } from "@/lib/sites/depot";
import { schemaCreationSite, schemaModificationSite } from "@/lib/sites/saisie";
import {
  creerFamillesEnLot,
  creerModelesEnLot,
  modifierFamilleDans,
  modifierModeleDans,
} from "@/lib/materiel/depot";
import {
  schemaFamilleMateriel,
  schemaModeleMateriel,
  type SaisieFamilleMateriel,
  type SaisieModeleMateriel,
} from "@/lib/materiel/saisie";
import { creerMachinesEnLot, modifierMachineDans } from "@/lib/machines/depot";
import { schemaMachine, type SaisieMachine } from "@/lib/machines/saisie";
import { creerInterventionsRepriseEnLot } from "@/lib/interventions/depot-reprise";
import {
  creerObservationsVgpEnLot,
  creerVerificationsVgpEnLot,
} from "@/lib/vgp/depot-import";
import {
  creerPrestationsEnLot,
  modifierPrestationDans,
} from "@/lib/prestations/depot";
import {
  schemaPrestation,
  type SaisiePrestation,
} from "@/lib/prestations/saisie";
import { uuidv7 } from "@/lib/db/uuid";
import type { SaisieAssujettissementFamille } from "@/lib/vgp/assujettissement";

import { CHAMPS_ECRITS_CLIENTS, CHAMPS_SITES_MODIFIES } from "./annulation";
import { porteEncore } from "./comparaison";
import { DELAIS_APPLICATION } from "./delais";
import {
  CHAMPS_CLIENTS,
  preparerUnEquipement,
  preparerUnModele,
  preparerUnePrestation,
  preparerUneFamille,
  preparerUneObservationVgp,
  preparerUneReprise,
  preparerUnPv,
  preparerUnSite,
  saisieDepuisLaLigne,
} from "./modeles";
import { indexerLesParcs } from "./parcs";
import { type LigneHistorique } from "./reprise";
import { type LigneObservationVgp, type LignePv } from "./vgp";
import { indexerLesAgences } from "./parc-agences";
import { indexerLesFamilles } from "./parc-familles";
import { indexerLeParcClients } from "./parc-clients";
import {
  indexerLeParcEquipements,
  indexerLeParcFamilles,
  indexerLeParcModeles,
  indexerLeParcPrestations,
  indexerLeParcSites,
} from "./parc-cibles";

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
 * l'annulation ne saurait pas défaire.* Un invariant que la réduction des
 * allers-retours (plus bas) ne touche pas : elle réduit le nombre de
 * requêtes DANS cette transaction, elle n'en ouvre jamais une seconde.
 *
 * ## Le CLIQUET : un lot ne s'applique qu'une fois
 *
 * Il est tenu par une lecture ET par la base : `applique_le` est lié au statut
 * par une équivalence (L1-08e), si bien qu'un second passage ne peut pas
 * réécrire un lot déjà appliqué sans que la contrainte le dise.
 */

/** Ce que l'application refuse, et pourquoi. */
export type RefusApplication =
  | "lot_introuvable"
  | "lot_deja_applique"
  | "lot_annule"
  // AJOUTÉ le 16/09/2026 (point 4 de la session : une violation de contrainte
  // d'unicité ressortait en page d'erreur 500). Voir le `catch` d'
  // `appliquerLesLignes` plus bas : c'est le FILET, jamais la première ligne
  // de défense — celle-ci est le contrôle, qui rejette désormais un doublon
  // AVANT l'application (`MOTIF_DOUBLON_FICHIER`, `lib/excel/controle.ts`).
  // Ce motif couvre ce que le contrôle ne pouvait pas voir : le parc a bougé
  // ENTRE le contrôle et la validation — un autre lot, appliqué entre-temps,
  // a écrit la même clé.
  | "contrainte_violee"
  // AJOUTÉ le 16/09/2026 (session dépassement de délai) : un lot de 615
  // MODIFICATIONS a mesuré `POST /api/imports/{id}/appliquer` sans réponse
  // après quatre minutes, le lot restant `controle`. **Même geste que
  // `contrainte_violee` pour la même raison** : la transaction s'est défaite
  // — voir `DELAIS_APPLICATION` dans `lib/imports/delais.ts` —, rien n'est
  // écrit, et ce n'est pas une panne que le produit ignore : c'est un
  // dépassement NOMMÉ, exactement comme #206 l'a fait pour P2002.
  | "delai_depasse";

export type ResultatApplication =
  | { readonly applique: false; readonly motif: RefusApplication }
  | {
      readonly applique: true;
      readonly creations: number;
      readonly modifications: number;
      /**
       * AJOUTÉ le 16/09/2026 (point 1 de la session) : les lignes classées
       * MODIFICATION dont la comparaison a montré qu'elles ne changeaient
       * rien — voir `porteEncore` et son appel juste avant chaque écriture.
       * *Une modification qui ne modifie rien n'est pas une modification*,
       * et ce décompte est ce qui empêche `modifications` de mentir.
       */
      readonly inchangees: number;
    };

/** Le motif de refus, lu dans l'état du lot. */
function refusDuStatut(statut: string): RefusApplication | null {
  if (statut === "applique") return "lot_deja_applique";
  if (statut === "annule") return "lot_annule";
  return null;
}

/**
 * UNE LIGNE QUE L'APPLICATION VA ÉCRIRE — telle que le rapport l'a posée.
 */
type LigneAAppliquer = {
  readonly id: string;
  readonly rang: number;
  readonly action: "creation" | "modification";
  readonly cle: string | null;
  readonly valeurs: Record<string, string | undefined>;
};

/**
 * CE QU'UNE LIGNE CLASSÉE CRÉATION PORTERA, RÉSOLU SANS AUCUN ALLER-RETOUR
 * (suite du 16/09/2026, point 1 — dépassement de délai).
 *
 * Résoudre un parent et juger un schéma ne touchent jamais la base : les
 * parcs sont des index EN MÉMOIRE, chargés une fois avant l'application
 * (`indexerLeParcClients` et consorts). `prete: false` couvre exactement ce
 * que couvrait `return null` dans l'ancienne enveloppe à une seule passe : un
 * parent introuvable, une saisie que le schéma refuse.
 */
type CreationPreparee<Donnees> =
  | { readonly prete: false }
  | { readonly prete: true; readonly id: string; readonly donnees: Donnees };

/**
 * CE QU'UNE LIGNE CLASSÉE MODIFICATION DÉSIGNE ET ÉCRIRA — RÉSOLU SANS AUCUN
 * ALLER-RETOUR, LA COMPARAISON MISE À PART (suite du 16/09/2026, point 1).
 *
 * **`comparaison` et `ecrit` sont deux champs séparés, et ce n'est pas une
 * redondance.** Pour la plupart des types, ce sont le MÊME objet : ce qui
 * s'écrit est ce qui se compare. Pour les FAMILLES, non : `ecrit` porte le
 * couple `{ saisie, vgp }` qu'exige `modifierFamilleDans` (deux paramètres
 * distincts), quand `porteEncore` a besoin d'un objet PLAT — les trois
 * colonnes de VGP posées à côté des autres (voir `appliquerLeLotDeFamilles`).
 */
type ModificationPreparee<Ecrit> =
  | { readonly prete: false }
  | {
      readonly prete: true;
      readonly cible: string;
      readonly ecrit: Ecrit;
      readonly comparaison: Readonly<Record<string, unknown>>;
    };

/**
 * L'ENVELOPPE QUE LES SIX APPLICATIONS PARTAGENT (R6-01 ; réécrite en DEUX
 * PASSES le 16/09/2026, suite — dépassement de délai, point 1).
 *
 * ## Ce qu'elle porte, et ce qu'elle NE porte PAS
 *
 * Elle porte le **cliquet** (un lot ne s'applique qu'une fois), la **lecture du
 * lot**, la **transaction unique** et la **clôture**. *Elle ne porte aucune
 * décision : elle ne sait ni quelle entité est visée, ni quel schéma juge, ni
 * quel dépôt écrit.* Chaque ligne est confiée aux fonctions que l'appelant
 * fournit, et c'est l'appelant qui nomme son type.
 *
 * ## Pourquoi ce n'est PAS la fonction que L1-08i refusait
 *
 * L1-08i écrivait : *« une fonction “applique n'importe quel lot” devrait tenir
 * une table de correspondance entre un type d'import et une écriture,
 * c'est-à-dire une liste close de plus, tenue à la main, que le prochain type
 * oublierait. »* **L'objection portait sur la TABLE, pas sur la boucle**, et la
 * distinction se vérifie : cette enveloppe ne lit jamais `lot.type_import` et
 * ne choisit jamais d'écriture. *Elle reçoit celle qu'on lui donne.* La table,
 * elle, existe bel et bien — voir `lib/imports/types-dimport.ts`.
 *
 * ## DEUX PASSES, ET POURQUOI DEUX PLUTÔT QU'UNE
 *
 * **Mesuré en production** (session du 16/09/2026, puis sa suite) : la
 * première rédaction faisait, PAR LIGNE, jusqu'à trois allers-retours — une
 * lecture d'AVANT, une écriture, une trace — et un lot de 615 lignes a rendu
 * `POST /api/imports/{id}/appliquer` sans réponse après quatre minutes. **La
 * PREMIÈRE passe ne touche pas la base** : elle résout les parents et juge
 * les schémas pour CHAQUE ligne (`config.preparerCreation` /
 * `config.preparerModification`), et sépare ce qui est prêt en deux listes.
 * La **SECONDE** exécute les écritures avec le MINIMUM d'allers-retours que
 * Prisma permette sans SQL brut (CLAUDE.md §2, interdit hors migrations et
 * politiques RLS) :
 *
 *   1. Les créations s'écrivent en UN `createMany` (`config.creerEnLot`),
 *      quel que soit leur nombre — l'identifiant de chaque fiche est déjà
 *      connu (I10), `createMany` n'a besoin de rien de plus.
 *   2. Les cibles de TOUTES les modifications se lisent en UN `findMany …
 *      id IN […]` (`config.lireAvant`) — la lecture qui comparait
 *      auparavant une ligne à la fois.
 *   3. Chaque ligne trouve alors son verdict SANS ALLER-RETOUR : identique
 *      (`porteEncore`) → « inchangée » ; sinon → `config.modifierUn`, unique
 *      aller-retour restant PAR VRAIE modification, parce que Prisma ne sait
 *      écrire des valeurs DIFFÉRENTES par ligne qu'une requête à la fois.
 *   4. La TRACE posée sur `import_lot_ligne` (D15, ce que l'annulation lira)
 *      reste, elle aussi, PAR LIGNE, pour la même raison — et parce que
 *      `import_lot_ligne` est une table AUDITÉE (I8) : la reconstituer par un
 *      `DELETE` suivi d'un `createMany` ferait porter au journal une
 *      suppression et une création là où une seule ligne a été enrichie, ce
 *      qui MENTIRAIT sur ce qui s'est passé — exactement ce que le point 1 de
 *      la session précédente a fermé pour les écritures elles-mêmes.
 *
 * `lib/imports/delais.ts` compte ce qui reste (`allersRetoursApplication`) et
 * dit, sans le cacher, ce que cette réduction NE couvre PAS.
 *
 * ## Le parc peut AVOIR BOUGÉ, et ce n'est pas une erreur du fichier
 *
 * Une ligne dont le parent a disparu, ou dont la cible n'existe plus, est
 * simplement absente des deux listes que la première passe construit. *La
 * ligne est laissée en l'état et le lot continue* : l'annulation partielle de
 * I6 est faite du même bois.
 *
 * ## LA TRANSACTIONNALITÉ, VÉRIFIÉE PLUTÔT QU'AFFIRMÉE (point 4 du 16/09/2026)
 *
 * *Question posée en production après une page d'erreur 500 sur une violation
 * de contrainte : rien n'avait-il été écrit ?* La réponse est OUI, et elle
 * tient à une seule ligne, déjà vraie avant cet incident : `avecContexteRls`
 * (`lib/db/rls.ts`) ouvre `travail` dans `prisma.$transaction(async (tx) =>
 * …)` — une transaction INTERACTIVE, que Prisma annule intégralement dès
 * qu'une requête à l'intérieur lève. Une violation de contrainte survenue au
 * milieu de la seconde passe défait donc TOUT ce que la transaction avait
 * déjà écrit — le lot reste `controle`, comme si l'application n'avait jamais
 * commencé. `tests/isolation/application-import-types.test.ts` le mesure
 * contre la vraie base, colonne par colonne, plutôt que de le supposer du
 * code.
 *
 * **Ce que cette garantie NE fait PAS, et c'est pour cela qu'un filet suit** :
 * une transaction qui se défait bien laisse quand même l'ERREUR remonter telle
 * quelle à l'appelant. C'est cette remontée non rattrapée, et elle seule, qui
 * faisait le 500 — la donnée n'a jamais été le problème.
 */
async function appliquerLesLignes<
  Donnees,
  Ecrit extends Record<string, unknown>,
>(
  contexte: ContexteSession,
  lotId: string,
  client: PrismaClient | undefined,
  config: {
    readonly entite: string;
    readonly champsComparaison: readonly string[];
    readonly preparerCreation: (
      ligne: LigneAAppliquer,
    ) => CreationPreparee<Donnees>;
    readonly preparerModification: (
      ligne: LigneAAppliquer,
    ) => ModificationPreparee<Ecrit>;
    readonly creerEnLot: (
      tx: Prisma.TransactionClient,
      societeId: string,
      lignes: readonly { readonly id: string; readonly donnees: Donnees }[],
    ) => Promise<void>;
    readonly lireAvant: (
      tx: Prisma.TransactionClient,
      ids: readonly string[],
    ) => Promise<ReadonlyMap<string, Record<string, unknown>>>;
    readonly modifierUn: (
      tx: Prisma.TransactionClient,
      cible: string,
      ecrit: Ecrit,
    ) => Promise<number>;
  },
): Promise<ResultatApplication> {
  const societeId = exigerSocieteActive(contexte);

  try {
    return await avecContexteApplicatif(
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
          return {
            applique: false as const,
            motif: "lot_introuvable" as const,
          };
        }
        const refus = refusDuStatut(lot.statut);
        if (refus !== null) {
          return { applique: false as const, motif: refus };
        }

        const lignes: readonly LigneAAppliquer[] = lot.lignes.map((brute) => ({
          id: brute.id,
          rang: brute.rang,
          action: brute.action as "creation" | "modification",
          cle: brute.cle,
          valeurs: brute.valeurs as Record<string, string | undefined>,
        }));

        // ── PREMIÈRE PASSE : PRÉPARATION, AUCUN ALLER-RETOUR ────────────────
        const creationsPretes: {
          readonly ligne: LigneAAppliquer;
          readonly id: string;
          readonly donnees: Donnees;
        }[] = [];
        const modificationsPretes: {
          readonly ligne: LigneAAppliquer;
          readonly cible: string;
          readonly ecrit: Ecrit;
          readonly comparaison: Readonly<Record<string, unknown>>;
        }[] = [];

        for (const ligne of lignes) {
          if (ligne.action === "creation") {
            const prepare = config.preparerCreation(ligne);
            if (prepare.prete) {
              creationsPretes.push({
                ligne,
                id: prepare.id,
                donnees: prepare.donnees,
              });
            }
          } else {
            const prepare = config.preparerModification(ligne);
            if (prepare.prete) {
              modificationsPretes.push({
                ligne,
                cible: prepare.cible,
                ecrit: prepare.ecrit,
                comparaison: prepare.comparaison,
              });
            }
          }
        }

        // ── SECONDE PASSE : LES CRÉATIONS, UN SEUL ALLER-RETOUR ─────────────
        if (creationsPretes.length > 0) {
          await config.creerEnLot(
            tx,
            societeId,
            creationsPretes.map((c) => ({ id: c.id, donnees: c.donnees })),
          );
        }
        // La TRACE reste par ligne — voir le docblock ci-dessus.
        for (const c of creationsPretes) {
          await tracer(tx, c.ligne.id, config.entite, c.id, null);
        }

        // ── TROISIÈME PASSE : LES MODIFICATIONS — UNE LECTURE GROUPÉE, PUIS
        // LE VERDICT PAR LIGNE, SANS ALLER-RETOUR SUPPLÉMENTAIRE ────────────
        const avantParId =
          modificationsPretes.length > 0
            ? await config.lireAvant(
                tx,
                modificationsPretes.map((m) => m.cible),
              )
            : new Map<string, Record<string, unknown>>();

        let modifications = 0;
        let inchangees = 0;

        for (const m of modificationsPretes) {
          const avant = avantParId.get(m.cible);
          // La fiche n'apparaît pas dans la lecture groupée : dans la MÊME
          // transaction, cela ne peut arriver que si elle a déjà disparu au
          // moment de la lecture — même sens de défaillance qu'une cible
          // introuvable ailleurs dans ce fichier.
          if (avant === undefined) continue;

          // **UNE MODIFICATION QUI NE MODIFIE RIEN N'EST PAS UNE MODIFICATION**
          // (point 1, 16/09/2026) : mesuré en production, un même fichier
          // redéposé sans changement a fait réécrire 615 fiches à
          // l'identique — à la fois inutile et FAUX pour le journal d'audit
          // (I8), qui inscrit une trace par écriture.
          if (porteEncore(avant, m.comparaison, config.champsComparaison)) {
            inchangees += 1;
            continue;
          }

          // **Zéro ligne touchée n'est pas une erreur, c'est la politique qui a
          // refusé**, et elle refuse en silence. La ligne est alors laissée en
          // l'état, comme une fiche disparue : le lot continue.
          const touchees = await config.modifierUn(tx, m.cible, m.ecrit);
          if (touchees === 0) continue;
          await tracer(tx, m.ligne.id, config.entite, m.cible, avant);
          modifications += 1;
        }

        await tx.importLot.update({
          where: { id: lotId },
          data: {
            statut: "applique",
            applique_le: await instantDate(tx),
            // **SEUL `lignes_inchangees` EST ÉCRIT ICI**, jamais
            // `lignes_modifications` ni `lignes_creations` : ceux-là restent
            // « tels que le rapport les a rendus » (le commentaire du schéma,
            // mot pour mot), la PROPOSITION du contrôle. `lignes_inchangees`
            // n'a pas de proposition à trahir : il vaut zéro tant que rien ne
            // l'a mesuré, et c'est l'application, seule, qui le mesure.
            lignes_inchangees: inchangees,
          },
        });

        // **Aucun décompte des lignes IGNORÉES n'est rendu**, et c'est délibéré :
        // la requête ne les rapporte pas, ce chiffre vaudrait donc zéro en toute
        // circonstance. *Une ligne qui ne peut pas bouger sous une faute n'est
        // jamais présentée à côté de celles qui le peuvent* (§9, 06/09) — le lot
        // porte déjà ses décomptes, et c'est là qu'on les lit.
        return {
          applique: true as const,
          creations: creationsPretes.length,
          modifications,
          inchangees,
        };
      },
      client,
      DELAIS_APPLICATION,
    );
  } catch (erreur) {
    // **LE FILET, jamais la première ligne de défense** (point 4, 16/09/2026 ;
    // étendu le même jour, point 3 de la session suivante). La transaction
    // s'est déjà défaite — voir le docblock ci-dessus — et rien n'a été
    // écrit ; ce bloc ne répare rien, il choisit seulement de ne pas laisser
    // une erreur technique remonter jusqu'à une page d'erreur 500. *Une
    // erreur que le produit sait nommer n'est pas une panne.*
    const motif = motifDeLErreurTransaction(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { applique: false as const, motif };
  }
}

/**
 * LE MOTIF D'UNE ERREUR DE TRANSACTION, LU SUR SON CODE PRISMA — jamais
 * levée, jamais devinée. Même forme que `motifDeLErreur` de
 * `lib/clients/depot.ts`, et pour la même raison : une fonction pure, séparée
 * de la transaction qu'elle interprète, s'éprouve sans base (`P2002`/`P2028`
 * fabriqués) plutôt que par un incident qu'il faudrait reproduire — un
 * dépassement RÉEL de `DELAIS_APPLICATION.timeout` prendrait quatre minutes à
 * mesurer.
 *
 * **Seuls P2002 et P2028 sont reconnus.** Une autre erreur Prisma dirait
 * autre chose qu'un doublon ou un dépassement de délai — une colonne trop
 * longue, une connexion perdue — et les nommer mentirait sur leur cause :
 * `null` la laisse remonter telle quelle, comme avant ce ticket.
 */
export function motifDeLErreurTransaction(
  erreur: unknown,
): RefusApplication | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  if (erreur.code === "P2002") {
    return "contrainte_violee";
  }
  // P2028 : « Transaction API error […] Transaction already closed » — le
  // moteur a fermé la transaction au bout de `DELAIS_APPLICATION.timeout`
  // (`lib/imports/delais.ts`) et la requête suivante ne la retrouve plus.
  // *Même code que `prisma/seed-delais.ts` a rencontré pour le même incident
  // de latence — ce n'est pas la première fois que ce dépôt le mesure.* La
  // transaction s'étant défaite, rien n'est écrit : le lot reste `controle`,
  // exactement comme sur `contrainte_violee`.
  if (erreur.code === "P2028") {
    return "delai_depasse";
  }
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
  const parc = await indexerLeParcClients(contexte, client);

  return appliquerLesLignes<CreationClient, Record<string, unknown>>(
    contexte,
    lotId,
    client,
    {
      entite: "client",
      champsComparaison: CHAMPS_ECRITS_CLIENTS,
      preparerCreation: (ligne) => {
        const saisie = saisieDepuisLaLigne(ligne.valeurs, CHAMPS_CLIENTS);
        // Le schéma REJOUE ici, et il n'y a pas de seconde lecture : c'est le
        // MÊME schéma que le rapport a consulté (L1-08h). Ce qu'il apporte à
        // ce point est la CONVERSION — les défauts, les types —, pas le
        // verdict, que le rapport a déjà rendu.
        return {
          prete: true,
          id: uuidv7(),
          donnees: schemaCreationClient.parse(saisie),
        };
      },
      preparerModification: (ligne) => {
        // La fiche visée est celle que la CLÉ désigne — jamais une recherche
        // par ressemblance, et jamais une clé ambiguë : le rapport les a déjà
        // rejetées (L1-08g).
        const cible =
          ligne.cle === null ? undefined : parc.fiches.get(ligne.cle);
        if (cible === undefined) return { prete: false };
        const saisie = saisieDepuisLaLigne(ligne.valeurs, CHAMPS_CLIENTS);
        const ecrit = schemaModificationClient.parse(saisie);
        return { prete: true, cible, ecrit, comparaison: ecrit };
      },
      creerEnLot: (tx, societeId, lignes) =>
        creerClientsEnLot(
          tx,
          societeId,
          lignes.map((l) => ({ id: l.id, saisie: l.donnees })),
        ),
      lireAvant: async (tx, ids) => {
        // **C'EST ELLE QUE `porteEncore` COMPARE** (point 1, 16/09/2026), et
        // ELLE QUE D15 EXIGE POUR RESTAURER : les deux questions — « que
        // faut-il pouvoir restaurer ? » et « la fiche porte-t-elle déjà
        // cela ? » — portent sur les mêmes colonnes, une seconde lecture
        // divergerait en silence (§9, 01/09). **Groupée depuis le 16/09/2026,
        // suite** : un seul aller-retour pour TOUTES les cibles du lot, là où
        // une lecture par ligne a fait dépasser le délai de la transaction.
        const fiches = await tx.client.findMany({
          where: { id: { in: [...ids] } },
          select: {
            id: true,
            code_externe: true,
            raison_sociale: true,
            ridet: true,
            categorie: true,
            conditions_reglement: true,
            commercial_referent: true,
          },
        });
        return new Map(fiches.map(({ id, ...reste }) => [id, reste]));
      },
      modifierUn: async (tx, cible, ecrit) => {
        await modifierClientDans(tx, cible, ecrit);
        return 1;
      },
    },
  );
}

/**
 * Applique un lot d'import de SITES (R6-01).
 *
 * **Le type est dans le nom**, comme pour les clients, et les DEUX PARCS qu'il
 * lit ne répondent pas à la même question : `clients` et `agences` disent ce
 * qu'une CELLULE désigne — les deux parents d'un site —, `sites` dit si la
 * FICHE existe déjà. *Les confondre ferait de chaque ligne une création, et
 * d'un second import autant de doublons* (voir `parc-cibles.ts`).
 *
 * **Les parents sont résolus par `preparerUnSite`, la fonction MÊME que le
 * contrôle a appelée.** Ce n'est pas une commodité : une seconde résolution
 * écrite ici diverge en silence (§9, 01/09), et elle divergerait au pire
 * endroit — entre ce qu'un humain a validé et ce qui sera écrit.
 */
export async function appliquerLeLotDeSites(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const clients = await indexerLeParcClients(contexte, client);
  const agences = await indexerLesAgences(contexte, client);
  const sites = await indexerLeParcSites(contexte, client);

  return appliquerLesLignes<
    ReturnType<typeof schemaCreationSite.parse>,
    Record<string, unknown>
  >(contexte, lotId, client, {
    entite: "site",
    champsComparaison: CHAMPS_SITES_MODIFIES,
    preparerCreation: (ligne) => {
      const prepare = preparerUnSite(clients, agences, ligne.valeurs);
      // Le parc a bougé depuis le contrôle : le client ou l'agence que la
      // ligne nommait n'existe plus. *Ce n'est pas une erreur du fichier*, et
      // écrire quand même se heurterait de toute façon à la clé étrangère
      // composite — en emportant la transaction entière, donc le lot.
      if (!prepare.prete) return { prete: false };
      return {
        prete: true,
        id: uuidv7(),
        donnees: schemaCreationSite.parse(prepare.saisie),
      };
    },
    preparerModification: (ligne) => {
      const cible =
        ligne.cle === null ? undefined : sites.fiches.get(ligne.cle);
      if (cible === undefined) return { prete: false };
      const prepare = preparerUnSite(clients, agences, ligne.valeurs);
      if (!prepare.prete) return { prete: false };

      // **LES DEUX PARENTS SONT RETIRÉS AVANT LA MODIFICATION, et chacun
      // pour sa raison** — mesuré le 16/09/2026, `schemaModificationSite`
      // étant `.strict()` : les lui passer LÈVE, et la levée emporte le lot
      // entier.
      //
      // *`client_id`* n'est pas modifiable, et il n'a pas à l'être : la clé
      // d'un site EST le couple (client, libellé), si bien qu'une ligne
      // appariée désigne déjà le même client. **Le lui passer permettrait de
      // déplacer un site chez un autre client par un fichier**, ce qu'aucun
      // gabarit ne promet.
      //
      // *`agence_id`* est modifiable — mais **jamais seul** (D56) :
      // `superRefine` exige `temps_trajet_min` dans la même saisie, parce
      // qu'*un nombre dont la signification dépend d'une autre colonne ne
      // voyage jamais seul*. Or le gabarit n'expose PAS cette colonne
      // (`CHAMPS_SITES_ECARTES` : « sa lecture reste à écrire (L1-09) »).
      // **Un import ne déplace donc pas un site d'une agence à l'autre**, et
      // c'est la bonne lecture de D56 : *on n'exige pas qu'on mesure, on
      // exige qu'on DÉCIDE* — et un fichier ne décide pas.
      const modifiables = { ...prepare.saisie };
      delete modifiables.client_id;
      delete modifiables.agence_id;
      const ecrit = schemaModificationSite.parse(modifiables);
      return { prete: true, cible, ecrit, comparaison: ecrit };
    },
    creerEnLot: (tx, societeId, lignes) =>
      creerSitesEnLot(
        tx,
        societeId,
        lignes.map((l) => ({ id: l.id, saisie: l.donnees })),
      ),
    lireAvant: async (tx, ids) => {
      // **NE PORTE QUE CE QUE CETTE ÉCRITURE VA TOUCHER**, et les deux
      // parents en sont donc absents — ils ne sont pas écrits sur une
      // modification (voir ci-dessus). *Y ranger une colonne qu'on ne
      // modifie pas ferait RESTAURER à l'annulation une colonne que l'import
      // n'a jamais touchée* (L1-08j).
      const fiches = await tx.site.findMany({
        where: { id: { in: [...ids] } },
        select: {
          id: true,
          libelle: true,
          commune: true,
          zone_geo: true,
          consignes_acces: true,
        },
      });
      return new Map(fiches.map(({ id, ...reste }) => [id, reste]));
    },
    modifierUn: async (tx, cible, ecrit) => {
      await modifierSiteDans(tx, cible, ecrit);
      return 1;
    },
  });
}

/**
 * Applique un lot d'import de MODÈLES DE MATÉRIEL (R6-01).
 *
 * **AUCUNE COLONNE DE VGP n'est écrite ici**, et c'est la décision de L1-05b
 * reprise telle quelle : l'assujettissement se déclare à la FAMILLE avec ses
 * trois valeurs (L9-03), « soumis » exige la périodicité ET son texte (L9-04),
 * le modèle PRÉCISE sans faire exception (L9-06). *Une seconde entrée sur la
 * même règle ne connaîtrait pas la première* — et un import est précisément le
 * chemin où personne ne relit ce qui entre.
 *
 * La périodicité que ce gabarit porte est celle de l'ENTRETIEN du constructeur,
 * jamais la périodicité réglementaire : *les mêler ferait facturer un entretien
 * pour une vérification légale, ou l'inverse.*
 */

/**
 * LES COLONNES QUE `modifierModeleDans` ÉCRIT — et elle les écrit TOUTES,
 * `actif` compris : `schemaModeleMateriel` lui pose `.default(true)`, et le
 * gabarit ne l'expose pas (`CHAMPS_MODELES_ECARTES`), si bien qu'une ligne de
 * fichier vaut toujours « actif = vrai ». *Une comparaison qui l'omettrait
 * jugerait « inchangée » une fiche désactivée depuis, et ne la réactiverait
 * jamais* — ce que l'import fait aujourd'hui à chaque passage, et que ce
 * ticket n'a pas pour objet de changer.
 *
 * **Ce n'est PAS la liste que compare `annulerLeLotDeModeles`** —
 * `CHAMPS_ECRITS_MODELES`, deux colonnes seulement : celle-ci protège une
 * décision (la famille reclassée reste reclassée), celle-ci mesure une
 * ÉCRITURE. Les deux répondent à des questions différentes, et les confondre
 * ferait sauter une reclassification légitime au premier ticket, ou manquer
 * une écriture réelle à celui-ci.
 */
const CHAMPS_MODELES_ECRITS = [
  "famille_id",
  "marque",
  "reference",
  "periodicite_jours",
  "periodicite_compteur",
  "actif",
] as const;

export async function appliquerLeLotDeModeles(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const familles = await indexerLesFamilles(contexte, client);
  const modeles = await indexerLeParcModeles(contexte, client);

  return appliquerLesLignes<SaisieModeleMateriel, SaisieModeleMateriel>(
    contexte,
    lotId,
    client,
    {
      entite: "modele_materiel",
      champsComparaison: CHAMPS_MODELES_ECRITS,
      preparerCreation: (ligne) => {
        const prepare = preparerUnModele(familles, ligne.valeurs);
        if (!prepare.prete) return { prete: false };
        return {
          prete: true,
          // L'identifiant est tiré ICI et non par la base (I10) — et il est
          // rendu à `tracer`, sans quoi l'annulation n'aurait rien à
          // défaire.
          id: uuidv7(),
          donnees: schemaModeleMateriel.parse(prepare.saisie),
        };
      },
      preparerModification: (ligne) => {
        const cible =
          ligne.cle === null ? undefined : modeles.fiches.get(ligne.cle);
        if (cible === undefined) return { prete: false };
        const prepare = preparerUnModele(familles, ligne.valeurs);
        if (!prepare.prete) return { prete: false };
        const saisie = schemaModeleMateriel.parse(prepare.saisie);
        return { prete: true, cible, ecrit: saisie, comparaison: saisie };
      },
      creerEnLot: (tx, societeId, lignes) =>
        creerModelesEnLot(
          tx,
          societeId,
          lignes.map((l) => ({ id: l.id, saisie: l.donnees })),
        ),
      lireAvant: async (tx, ids) => {
        const fiches = await tx.modeleMateriel.findMany({
          where: { id: { in: [...ids] } },
          select: {
            id: true,
            famille_id: true,
            marque: true,
            reference: true,
            periodicite_jours: true,
            periodicite_compteur: true,
            actif: true,
          },
        });
        return new Map(fiches.map(({ id, ...reste }) => [id, reste]));
      },
      modifierUn: modifierModeleDans,
    },
  );
}

/**
 * Applique un lot d'import de PRESTATIONS (R6-01).
 *
 * **La famille est FACULTATIVE ici, et c'est la seule des trois à l'être** :
 * un déplacement, un diagnostic ou une formation ne visent aucune famille de
 * matériel. `preparerUnePrestation` porte la distinction — cellule VIDE contre
 * cellule RENSEIGNÉE QUI NE DÉSIGNE RIEN —, et elle n'est pas relue ici.
 *
 * **AUCUN MONTANT** : `schemaPrestation` n'en porte aucun (D109), et un import
 * est le chemin où personne ne relit ce qui entre.
 */
/**
 * LES COLONNES QUE `modifierPrestationDans` ÉCRIT — les cinq, `actif`
 * compris pour la même raison qu'aux modèles : le gabarit ne l'expose pas
 * (`CHAMPS_PRESTATIONS_ECARTES`), `schemaPrestation` lui pose `.default(true)`,
 * et l'omettre de la comparaison manquerait la réactivation qu'une écriture
 * produit réellement aujourd'hui.
 */
const CHAMPS_PRESTATIONS_ECRITES = [
  "code",
  "libelle",
  "famille_id",
  "duree_standard_min",
  "actif",
] as const;

export async function appliquerLeLotDePrestations(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const familles = await indexerLesFamilles(contexte, client);
  const prestations = await indexerLeParcPrestations(contexte, client);

  return appliquerLesLignes<SaisiePrestation, SaisiePrestation>(
    contexte,
    lotId,
    client,
    {
      entite: "prestation",
      champsComparaison: CHAMPS_PRESTATIONS_ECRITES,
      preparerCreation: (ligne) => {
        const prepare = preparerUnePrestation(familles, ligne.valeurs);
        if (!prepare.prete) return { prete: false };
        return {
          prete: true,
          id: uuidv7(),
          donnees: schemaPrestation.parse(prepare.saisie),
        };
      },
      preparerModification: (ligne) => {
        const cible =
          ligne.cle === null ? undefined : prestations.fiches.get(ligne.cle);
        if (cible === undefined) return { prete: false };
        const prepare = preparerUnePrestation(familles, ligne.valeurs);
        if (!prepare.prete) return { prete: false };
        const saisie = schemaPrestation.parse(prepare.saisie);
        return { prete: true, cible, ecrit: saisie, comparaison: saisie };
      },
      creerEnLot: (tx, societeId, lignes) =>
        creerPrestationsEnLot(
          tx,
          societeId,
          lignes.map((l) => ({ id: l.id, saisie: l.donnees })),
        ),
      lireAvant: async (tx, ids) => {
        const fiches = await tx.prestation.findMany({
          where: { id: { in: [...ids] } },
          select: {
            id: true,
            code: true,
            libelle: true,
            famille_id: true,
            duree_standard_min: true,
            actif: true,
          },
        });
        return new Map(fiches.map(({ id, ...reste }) => [id, reste]));
      },
      modifierUn: modifierPrestationDans,
    },
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

/**
 * Écrit sur la ligne ce qu'elle a produit, et ce qu'elle a écrasé.
 *
 * **L'entité est un PARAMÈTRE depuis R6-01**, où elle était « client » en dur.
 * *C'est l'annulation qui la lit* — elle doit savoir quelle table restaurer —,
 * et une valeur figée aurait fait annuler un lot de sites contre la table des
 * clients, en silence.
 */
async function tracer(
  tx: Prisma.TransactionClient,
  ligneId: string,
  entite: string,
  entiteId: string,
  avant: Record<string, unknown> | null,
): Promise<void> {
  await tx.importLotLigne.update({
    where: { id: ligneId },
    data: {
      entite,
      entite_id: entiteId,
      valeurs_avant:
        avant === null ? undefined : (avant as Prisma.InputJsonValue),
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────
 * LE MATÉRIEL — la famille, puis l'équipement (R6-03)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Applique un lot d'import de FAMILLES DE MATÉRIEL (R6-03).
 *
 * **C'est la RACINE de l'enchaînement** que R6-03 décrit : une machine exige un
 * modèle, un modèle exige une famille, et la famille n'exige rien. *Elle est le
 * seul gabarit du matériel sans parent*, si bien que cette fonction ne lit qu'un
 * parc — celui de la cible.
 *
 * ## LES COLONNES DE VGP SONT ÉCRITES ICI, et L1-05b ne les écrivait pas
 *
 * La différence se vérifie : ce chemin n'énonce aucune règle de L9-04, il passe
 * `prepare.vgp` — que `schemaAssujettissementFamille` a jugé, et que la base
 * jugera une seconde fois par sa contrainte. *Une famille dont le fichier ne dit
 * rien naît `a_determiner`*, l'état honnête, et apparaît le jour même dans
 * `/vgp/a-determiner`.
 *
 * ## `ecrit` ET `comparaison` DIVERGENT ICI (suite du 16/09/2026, point 1)
 *
 * `modifierFamilleDans` prend `saisie` et `vgp` comme DEUX paramètres —
 * `ecrit` les porte donc groupés, `{ saisie, vgp }`. `porteEncore`, lui,
 * compare un objet PLAT : `comparaison` recompose `saisie` et les trois
 * colonnes de VGP au même niveau, exactement comme le fait
 * `annulerLeLotDeFamilles` pour reconstituer ce qu'un lot a écrit.
 */
const CHAMPS_FAMILLES_ECRITES = [
  "code",
  "libelle",
  "actif",
  "assujettissement_vgp",
  "vgp_periodicite_mois",
  "vgp_reference_texte",
] as const;

/** Ce que `creerFamilleDans` et `modifierFamilleDans` exigent : la saisie ET la VGP, groupées. */
type EcritFamille = {
  readonly saisie: SaisieFamilleMateriel;
  readonly vgp: SaisieAssujettissementFamille;
};

export async function appliquerLeLotDeFamilles(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const familles = await indexerLeParcFamilles(contexte, client);

  return appliquerLesLignes<EcritFamille, EcritFamille>(
    contexte,
    lotId,
    client,
    {
      entite: "famille_materiel",
      champsComparaison: CHAMPS_FAMILLES_ECRITES,
      preparerCreation: (ligne) => {
        const prepare = preparerUneFamille(ligne.valeurs);
        if (!prepare.prete) return { prete: false };
        return {
          prete: true,
          id: uuidv7(),
          donnees: {
            saisie: schemaFamilleMateriel.parse(prepare.saisie),
            vgp: prepare.vgp,
          },
        };
      },
      preparerModification: (ligne) => {
        const cible =
          ligne.cle === null ? undefined : familles.fiches.get(ligne.cle);
        if (cible === undefined) return { prete: false };
        const prepare = preparerUneFamille(ligne.valeurs);
        if (!prepare.prete) return { prete: false };
        const saisie = schemaFamilleMateriel.parse(prepare.saisie);
        const comparaison = {
          ...saisie,
          assujettissement_vgp: prepare.vgp.assujettissement,
          vgp_periodicite_mois: prepare.vgp.periodiciteMois,
          vgp_reference_texte: prepare.vgp.referenceTexte,
        };
        return {
          prete: true,
          cible,
          ecrit: { saisie, vgp: prepare.vgp },
          comparaison,
        };
      },
      creerEnLot: (tx, societeId, lignes) =>
        creerFamillesEnLot(
          tx,
          societeId,
          lignes.map((l) => ({
            id: l.id,
            saisie: l.donnees.saisie,
            vgp: l.donnees.vgp,
          })),
        ),
      lireAvant: async (tx, ids) => {
        const fiches = await tx.familleMateriel.findMany({
          where: { id: { in: [...ids] } },
          select: {
            id: true,
            code: true,
            libelle: true,
            actif: true,
            assujettissement_vgp: true,
            vgp_periodicite_mois: true,
            vgp_reference_texte: true,
          },
        });
        return new Map(fiches.map(({ id, ...reste }) => [id, reste]));
      },
      modifierUn: (tx, cible, ecrit) =>
        modifierFamilleDans(tx, cible, ecrit.saisie, ecrit.vgp),
    },
  );
}

/**
 * Applique un lot d'import d'ÉQUIPEMENTS (R6-03 ; D6, D7, I10).
 *
 * **QUATRE parcs sont lus, et ils ne répondent pas à la même question.**
 * `clients`, `sites` et `modeles` disent ce qu'une CELLULE désigne — les trois
 * parents de D6 —, `equipements` dit si la FICHE existe déjà. *C'est le premier
 * gabarit du dépôt à désigner trois parents*, et le rejet nomme lequel manque.
 *
 * **Les parents sont résolus par `preparerUnEquipement`, la fonction MÊME que le
 * contrôle a appelée** — et le RANG lui est passé, parce que c'est lui qui
 * décide de la forme de la clé, donc du numéro de série. *Une seconde résolution
 * écrite ici divergerait au pire endroit : entre ce qu'un humain a validé et ce
 * qui sera écrit.*
 *
 * **`complet` n'est pas décidé ici** : `schemaMachine` le déduit du numéro de
 * série (§6), et une plaque illisible donne `SN-INCONNU-<référence>` — la fiche
 * entre incomplète et rejoint la file de complétion de L2-01. *Elle n'est pas
 * rejetée : c'est tout le point de D6.*
 */

/**
 * LES COLONNES QUE `modifierMachineDans` ÉCRIT — les neuf, et TOUJOURS : à la
 * différence des clients et des sites, l'équipement n'a pas de schéma de
 * MODIFICATION distinct — `schemaMachine` sert aux deux actions, et ses
 * `.default(null)` sur les trois dates et `facture_origine` s'appliquent
 * qu'une cellule soit vide ou que le gabarit ne l'expose simplement pas
 * (`CHAMPS_EQUIPEMENTS_ECARTES`). *Omettre une seule de ces colonnes de la
 * comparaison ferait juger « inchangée » une ligne dont l'écriture aurait en
 * réalité effacé une date — le défaut inverse de celui que ce ticket ferme.*
 *
 * **Ce n'est pas la liste que compare `annulerLeLotDeEquipements`** — elle
 * varie selon l'action (`CHAMPS_EQUIPEMENTS_MODIFIES` contre
 * `CHAMPS_ECRITS_EQUIPEMENTS`, qui ajoute les trois parents À LA CRÉATION
 * seulement) : cette liste-ci n'a besoin que de la MODIFICATION, la seule
 * action que ce module compare avant d'écrire.
 */
const CHAMPS_EQUIPEMENTS_ECRITS = [
  "numero_serie",
  "reference_interne",
  "localisation",
  "facture_origine",
  "date_mise_en_service",
  "date_vente",
  "garantie_fin",
  "criticite",
  "complet",
] as const;

export async function appliquerLeLotDeEquipements(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const clients = await indexerLeParcClients(contexte, client);
  const sites = await indexerLeParcSites(contexte, client);
  const modeles = await indexerLeParcModeles(contexte, client);
  const equipements = await indexerLeParcEquipements(contexte, client);

  return appliquerLesLignes<SaisieMachine, SaisieMachine>(
    contexte,
    lotId,
    client,
    {
      entite: "machine",
      champsComparaison: CHAMPS_EQUIPEMENTS_ECRITS,
      preparerCreation: (ligne) => {
        const prepare = preparerUnEquipement(
          clients,
          sites,
          modeles,
          ligne.valeurs,
          ligne.rang,
        );
        // Le parc a bougé depuis le contrôle : l'un des trois parents a
        // disparu. *Ce n'est pas une erreur du fichier*, et écrire quand même
        // se heurterait de toute façon à la clé étrangère composite — en
        // emportant la transaction entière, donc le lot.
        if (!prepare.prete) return { prete: false };
        return {
          prete: true,
          // L'identifiant est tiré ICI et non par la base (D7, I10) — et il
          // est rendu à `tracer`, sans quoi l'annulation n'aurait rien à
          // défaire.
          id: uuidv7(),
          donnees: schemaMachine.parse(prepare.saisie),
        };
      },
      preparerModification: (ligne) => {
        const cible =
          ligne.cle === null ? undefined : equipements.fiches.get(ligne.cle);
        if (cible === undefined) return { prete: false };
        const prepare = preparerUnEquipement(
          clients,
          sites,
          modeles,
          ligne.valeurs,
          ligne.rang,
        );
        if (!prepare.prete) return { prete: false };
        const saisie = schemaMachine.parse(prepare.saisie);
        return { prete: true, cible, ecrit: saisie, comparaison: saisie };
      },
      creerEnLot: (tx, societeId, lignes) =>
        creerMachinesEnLot(
          tx,
          societeId,
          lignes.map((l) => ({ id: l.id, saisie: l.donnees })),
        ),
      lireAvant: async (tx, ids) => {
        const fiches = await tx.machine.findMany({
          where: { id: { in: [...ids] } },
          select: {
            id: true,
            numero_serie: true,
            reference_interne: true,
            localisation: true,
            facture_origine: true,
            date_mise_en_service: true,
            date_vente: true,
            garantie_fin: true,
            criticite: true,
            complet: true,
          },
        });
        return new Map(fiches.map(({ id, ...reste }) => [id, reste]));
      },
      modifierUn: modifierMachineDans,
    },
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * L'HISTORIQUE — l'archive SAV, reprise close (REPRISE-HISTORIQUE ; D127)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Applique un lot d'HISTORIQUE — des interventions CLOSES, jamais modifiées.
 *
 * **Il n'y a pas de MODIFICATION possible, et c'est la base qui le dit** :
 * `intervention_cycle_de_vie` refuse tout `UPDATE` d'une intervention
 * `cloturee` qui ne l'annule pas. Le contrôle le sait déjà — un document
 * déjà repris est REJETÉ `document_deja_repris` (`preparerUneReprise`, en
 * premier) —, si bien qu'aucune ligne « modification » n'atteint cette
 * fonction. Si le parc en portait une quand même (deux lots contrôlés avant
 * que l'un s'applique), `preparerModification` la laisse en l'état : *une
 * fiche qu'on ne peut pas modifier n'est pas une fiche qu'on modifie un peu.*
 *
 * **Les parcs sont ceux de `indexerLesParcs`, la fonction même que la route
 * a lue** — et `preparerUneReprise` la fonction même que le contrôle a
 * appelée : le site résolu, la machine rattachée, le montant lu sont ceux que
 * l'humain a validés, sauf si le parc a bougé depuis, auquel cas la ligne est
 * laissée en l'état comme partout ailleurs dans ce fichier.
 *
 * `champsComparaison` est vide : rien n'est comparé puisque rien n'est
 * modifié — une liste vide est une affirmation lisible, pas un oubli.
 */
export async function appliquerLeLotDeHistorique(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const parcs = await indexerLesParcs(contexte, client);

  return appliquerLesLignes<LigneHistorique, Record<string, unknown>>(
    contexte,
    lotId,
    client,
    {
      entite: "intervention",
      champsComparaison: [],
      preparerCreation: (ligne) => {
        const prepare = preparerUneReprise(parcs, ligne.valeurs);
        // Le parc a bougé : le client ou le site n'existe plus, ou — cas
        // propre à ce type — le document a été repris par un AUTRE lot
        // appliqué entre le contrôle et cette validation. *Ce n'est pas une
        // erreur du fichier*, et la ligne reste en l'état.
        if (!prepare.prete) return { prete: false };
        return { prete: true, id: uuidv7(), donnees: prepare.saisie };
      },
      preparerModification: () => ({ prete: false }),
      creerEnLot: (tx, societeId, lignes) =>
        creerInterventionsRepriseEnLot(
          tx,
          societeId,
          lignes.map((l) => ({ id: l.id, saisie: l.donnees })),
        ),
      lireAvant: async () => new Map(),
      // Inatteignable — aucune modification n'est préparée. Zéro ligne touchée
      // est le sens de défaillance que l'enveloppe traite déjà : la ligne est
      // laissée en l'état.
      modifierUn: async () => 0,
    },
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * LES VÉRIFICATIONS RÉGLEMENTAIRES ET LEURS OBSERVATIONS (VGP-IMPORT)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * L'APPLICATION D'UN LOT DE VGP — des créations seulement, sous leur machine.
 *
 * **Aucune modification n'est jamais préparée** : la clé est le rang, aucune
 * ligne ne peut désigner une vérification existante (voir `indexerLeParcVgp`).
 * Une ligne classée EN ATTENTE au contrôle est un `rejet` : elle n'est pas
 * lue ici — l'enveloppe ne charge que les créations et les modifications —,
 * et c'est ce qui la garde telle que le rapport l'a montrée (I6).
 *
 * `preparerUnPv` est rejouée contre le parc DU MOMENT : une machine que le
 * contrôle avait trouvée et qu'un lot d'équipements a annulée depuis rend
 * `prete: false`, et la ligne reste en l'état — *le parc a bougé, ce n'est
 * pas une erreur du fichier.*
 */
export async function appliquerLeLotDeVgp(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const parcs = await indexerLesParcs(contexte, client);

  return appliquerLesLignes<LignePv, Record<string, unknown>>(
    contexte,
    lotId,
    client,
    {
      entite: "vgp_verification",
      champsComparaison: [],
      preparerCreation: (ligne) => {
        const prepare = preparerUnPv(parcs, ligne.valeurs);
        if (!prepare.prete) return { prete: false };
        return { prete: true, id: uuidv7(), donnees: prepare.saisie };
      },
      preparerModification: () => ({ prete: false }),
      creerEnLot: (tx, societeId, lignes) =>
        creerVerificationsVgpEnLot(
          tx,
          societeId,
          lignes.map((l) => ({ id: l.id, saisie: l.donnees })),
        ),
      lireAvant: async () => new Map(),
      modifierUn: async () => 0,
    },
  );
}

/**
 * L'APPLICATION D'UN LOT D'OBSERVATIONS — chacune sous son PV, et aucune
 * demande SAV (arbitrage 1 du 22/09/2026).
 *
 * **Le nom porte un tiret bas, et ce n'est pas une faute** : le gardien de
 * `types-dimport.test.ts` DÉRIVE le type du nom de la fonction, par le motif
 * `appliquerLeLotDe(\w+)` rabattu en minuscules — `Vgp_observations` rend
 * `vgp_observations`, le type que la grammaire du marqueur admet. *C'est la
 * même famille que l'élision non faite d'`Equipements`.*
 */
export async function appliquerLeLotDeVgp_observations(
  contexte: ContexteSession,
  lotId: string,
  client?: PrismaClient,
): Promise<ResultatApplication> {
  const parcs = await indexerLesParcs(contexte, client);

  return appliquerLesLignes<LigneObservationVgp, Record<string, unknown>>(
    contexte,
    lotId,
    client,
    {
      entite: "vgp_observation",
      champsComparaison: [],
      preparerCreation: (ligne) => {
        const prepare = preparerUneObservationVgp(parcs, ligne.valeurs);
        // Le PV parent a disparu — un lot de VGP annulé entre le contrôle et
        // cette validation —, ou l'observation a été reprise par un AUTRE lot
        // appliqué entre-temps. La ligne reste en l'état.
        if (!prepare.prete) return { prete: false };
        return { prete: true, id: uuidv7(), donnees: prepare.saisie };
      },
      preparerModification: () => ({ prete: false }),
      creerEnLot: (tx, societeId, lignes) =>
        creerObservationsVgpEnLot(
          tx,
          societeId,
          lignes.map((l) => ({ id: l.id, saisie: l.donnees })),
        ),
      lireAvant: async () => new Map(),
      modifierUn: async () => 0,
    },
  );
}
