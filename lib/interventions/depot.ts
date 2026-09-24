import { Prisma, type PrismaClient } from "@prisma/client";

import {
  exigerContexteActif,
  exigerSocieteActive,
  type ContexteSession,
} from "@/lib/auth/contexte";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import {
  chargerCalendrierAgence,
  fuseauDeLAgence,
} from "@/lib/calendar/agence";
import {
  MINUTES_PAR_JOUR,
  instantAMinutes,
  instantDuJour,
  jourDe,
  jourSuivant,
  maintenant,
  schemaFuseau,
  versLocal,
  type Fuseau,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { absenceCouvrant } from "@/lib/absences/periode";
import {
  verdictAffectation,
  type VerdictAffectation,
} from "@/lib/habilitations/affectation";
import { montant, type Montant } from "@/lib/money";
import { forfaitRetenu } from "@/lib/tarification/forfaits";
import {
  majorationHorsOuverture,
  type VerdictMajoration,
} from "@/lib/tarification/majoration";
import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";
import {
  valoriserIntervention,
  valoriserTempsPasse,
  type ModeDeValorisation,
} from "@/lib/tarification/valorisation";

import {
  accesSurCetteIntervention,
  filtreDuPerimetre,
  motifRefusPlanning,
  perimetreDuPlanning,
} from "./perimetre-technicien";
import {
  peutAffecter,
  peutAnnuler,
  peutCloturer,
  peutDeplacer,
  peutPlanifier,
  peutReprendre,
  peutSuspendre,
  statutALaCreation,
  type Verdict,
} from "./cycle-de-vie";
import {
  verdictChevauchement,
  verdictOuverture,
  type PoseDemandee,
} from "./pose";
import {
  LIMITE_RECHERCHE_PAR_DEFAUT,
  type Annulation,
  type Cloture,
  type Creation,
  type Deplacement,
  type EtatAvantPlanification,
  type NoteInterne,
  type RechercheInterventions,
  type Reprise,
  type StatutIntervention,
  type Suspension,
  type VueRegistre,
} from "./saisie";

/**
 * LE DÉPÔT DES INTERVENTIONS (lot 2, D84).
 *
 * Toute lecture et toute écriture passent par `avecContexteApplicatif`, donc
 * sous le contexte cloisonné : la politique de forme « parc » décide, et rien
 * n'est recomparé au-dessus d'elle. *Une comparaison de société écrite ici
 * serait une seconde lecture d'un même critère, qui diverge en silence.*
 *
 * Ce module ne DÉCIDE pas des règles — il les applique. Le cycle de vie est
 * dans `cycle-de-vie.ts`, l'habilitation dans `lib/habilitations`, l'arrondi et
 * le plancher dans `lib/tarification/valorisation.ts`.
 */

/** Ce qu'une ligne de planning porte, une fois lue. */
export const CHAMPS_LIGNE = {
  id: true,
  numero: true,
  statut: true,
  type: true,
  priorite: true,
  date_planifiee: true,
  creneau_debut: true,
  creneau_fin: true,
  duree_estimee_min: true,
  technicien_id: true,
  client_id: true,
  site_id: true,
  agence_id: true,
  /// LA PANNE SIGNALÉE / LE TRAVAIL DEMANDÉ, LE CONTACT SUR PLACE ET LA
  /// RÉFÉRENCE CLIENT (PARCOURS-1, 23/09/2026) — saisis une seule fois, à la
  /// création, jamais reécrits ensuite : ce lot n'ouvre aucun geste de
  /// modification pour ces trois champs.
  description: true,
  contact_id: true,
  reference_client: true,
  mode_valorisation: true,
  forfait_deplacement_id: true,
  /**
   * LES DEUX TEMPS (D120), et ils voyagent ENSEMBLE — *un temps validé sans le
   * mesuré ne dit pas s'il a été corrigé, et l'écart entre les deux est
   * exactement ce que ce couple existe pour montrer.*
   */
  temps_mesure_min: true,
  temps_valide_min: true,
  montant_ht: true,
  devise_code: true,
  motif_annulation: true,
  /**
   * LA SUSPENSION (L2-10, RG-INT-06). Les quatre colonnes voyagent ENSEMBLE :
   * *un motif sans sa date d'entrée ne dit pas depuis quand on attend, et une
   * référence sans horizon fait une file qu'on ne sait pas trier.*
   */
  motif_suspension: true,
  piece_attendue_ref: true,
  date_dispo_prevue: true,
  suspendue_le: true,
  /**
   * LES MACHINES, au pluriel depuis L2-08a. Lues avec la ligne plutôt que
   * comptées à côté : *un bandeau qui compterait autrement que le tableau qu'il
   * coiffe met les deux chiffres côte à côte sans dire lequel croire* (R2-21).
   *
   * La lecture est soumise à la politique de `intervention_machine`, de forme
   * « filiation » — elle ne rend donc que ce que la ligne elle-même est
   * autorisée à rendre, sans qu'aucun filtre soit réécrit ici.
   */
  machines: { select: { machine_id: true } },
  /**
   * LE BADGE « NOUVEAU » CÔTÉ TECHNICIEN (AVERTISSEMENTS-1). `null` tant que
   * le technicien affecté n'a pas ouvert sa fiche terrain — voir
   * `marquerVuParTechnicien`, plus bas, et le commentaire de la colonne.
   */
  vue_technicien_le: true,
} as const;

export type LigneIntervention = Prisma.InterventionGetPayload<{
  select: typeof CHAMPS_LIGNE;
}>;

/** Un refus rendu à l'appelant, avec la clé qui l'explique à l'écran. */
export type Resultat<T> =
  | {
      readonly accepte: true;
      readonly fiche: T;
      /**
       * CE QUI EST PASSÉ MAIS MÉRITE D'ÊTRE DIT — des clés de dictionnaire, et
       * jamais du texte (L3-02, RG-PLA-04).
       *
       * *La moitié « avertissement » de RG-PLA-04 était CALCULÉE puis JETÉE* :
       * `verdictAffectation` rendait ses deux listes depuis L1-04, et seule
       * celle qui bloque était lue. **Une règle dont une moitié n'a pas
       * d'appelant n'est pas appliquée à moitié : elle n'est pas appliquée.**
       *
       * Elle est absente — et non `[]` — quand il n'y a rien à dire : *un
       * tableau vide et « rien à signaler » se ressemblent trop pour qu'on
       * laisse un écran décider lequel des deux il affiche.*
       */
      readonly avertissements?: readonly string[];
      /**
       * L'ÉTAT D'AVANT, POUR QUI DOIT SAVOIR CE QUI A CHANGÉ
       * (AVERTISSEMENTS-1). Seuls `deplacerIntervention` et
       * `affecterTechnicien` le posent : les autres écritures de ce dépôt
       * n'ont personne à en prévenir. La route l'utilise APRÈS que cette
       * transaction a validé, pour appeler `avertirApresPlanification` — un
       * courriel ne doit ni retarder ni annuler l'écriture qu'il annonce.
       */
      readonly etatAvant?: EtatAvantPlanification;
    }
  | {
      readonly accepte: false;
      readonly cle: string;
    };

function refus<T>(verdict: Verdict): Resultat<T> | null {
  return verdict.refuse ? { accepte: false, cle: verdict.cle } : null;
}

/**
 * L'INSTANT COURANT, LU DANS LE FUSEAU DE L'AGENCE — jamais celui de la machine
 * qui exécute (L0-08).
 *
 * L'appel direct au constructeur de date lirait l'heure de l'APPAREIL. Le
 * serveur est à Sydney, l'agence est à Nouméa, et un technicien en déplacement
 * est ailleurs encore : « la date du jour » n'a de sens qu'accompagnée du
 * fuseau où on la lit. C'est le fuseau de l'agence de l'intervention, parce que
 * c'est lui qui décide de son calendrier de référence (I7).
 */
export async function instantDeLAgence(
  tx: Prisma.TransactionClient,
  agenceId: string,
): Promise<Date> {
  const agence = await tx.agence.findFirst({
    where: { id: agenceId },
    select: {
      fuseau_horaire: true,
      societe: { select: { fuseau_horaire: true } },
    },
  });
  if (agence === null) {
    // La politique a refusé l'agence : impossible en pratique, la clé étrangère
    // la garantit dans la même société. On ne fabrique pas d'heure pour autant.
    throw new Error(
      `Agence ${agenceId} illisible sous le contexte courant : l'instant ne ` +
        "peut pas être daté sans son fuseau.",
    );
  }
  return maintenant(fuseauDeLAgence(agence)).instant;
}

/**
 * CRÉER une intervention — UNE DEMANDE, au sens du parcours (PARCOURS-1,
 * 23/09/2026, arbitrage Alexis) : client, site, au plus une machine, nature,
 * priorité, panne signalée. **Ni date, ni créneau, ni technicien** — ce
 * geste-ci ne les saisit plus, `schemaCreation` ne les porte plus, et
 * `PLANIFIER` (`deplacerIntervention`, sous `peutPlanifier`) est le seul geste
 * qui les pose, tous ensemble.
 *
 * Deux choses restent DÉDUITES et jamais saisies : l'agence (du site) et le
 * forfait de déplacement (de la zone du site). Le statut, lui, n'est plus
 * DÉDUIT — il n'y a plus rien à déduire : une création est TOUJOURS
 * `a_planifier`.
 *
 * **Le contrôle d'ouverture du calendrier a quitté ce geste avec la date**
 * qu'il jugeait (R2-19 le posait ici justement parce qu'une création pouvait
 * porter un jour) : une création sans date n'a plus rien à confronter à un
 * calendrier. `verdictOuverture` reste le contrôle de la POSE, dans
 * `deplacerIntervention`, où la date arrive désormais pour de bon.
 */
export async function creerIntervention(
  contexte: ContexteSession,
  saisie: Creation,
  client?: PrismaClient,
): Promise<Resultat<LigneIntervention>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      // Le site est lu SOUS le contexte : s'il n'appartient pas au périmètre, la
      // politique rend zéro et l'on refuse ici plutôt que de buter plus bas.
      const site = await tx.site.findFirst({
        where: { id: saisie.site_id, client_id: saisie.client_id },
        select: {
          id: true,
          agence_id: true,
          zone_geo: true,
          client: { select: { actif: true } },
        },
      });
      if (site === null) {
        return { accepte: false, cle: "intervention.refus.lieu_inconnu" };
      }
      // ── RG-PLA-08 À LA CRÉATION (PLANNING-1, 22/09/2026) ─────────────────
      //
      // **Le client inactif est REFUSÉ ici, et non seulement caché de la
      // liste.** SEMIS-2 (#269) a retiré son site de `/interventions/nouvelle`
      // ; mais une liste d'écran n'est pas une règle, et un `site_id` posté
      // directement faisait naître une intervention que RG-PLA-08 (D129)
      // masque ensuite du planning ET du registre par défaut — sans qu'aucun
      // message ne le dise. *Deux chemins qui écrivent la même colonne et ne
      // se soumettent pas au même contrôle ne tiennent pas la même règle*
      // (§9, 01/09) — la faute déjà réparée pour l'ouverture (R2-19).
      //
      // Le motif est NOMMÉ, jamais « lieu inconnu » : le lieu existe, il se
      // voit sur la fiche du client (D129), et un refus qui accuserait le
      // périmètre enverrait chercher la cause au mauvais endroit. Même colonne
      // que `filtreClientActif` (plus bas), jamais une autre lecture de ce
      // qu'« inactif » veut dire.
      //
      // **Le SITE n'est pas jugé** : RG-PLA-08 ne porte que sur `client.actif`,
      // et la question du site reste ouverte (D129, §8).
      if (!site.client.actif) {
        return { accepte: false, cle: "intervention.refus.client_inactif" };
      }
      if (site.agence_id === null) {
        return {
          accepte: false,
          cle: "intervention.refus.lieu_sans_rattachement",
        };
      }

      // LES MACHINES DOIVENT APPARTENIR AU SITE CHOISI (revue Codex de la PR
      // #267, 20/09/2026). *Seule la forme UUID était validée par
      // `schemaCreation` — rien ne garantissait qu'une machine appartienne au
      // SITE de l'intervention, seule la SOCIÉTÉ l'étant par la clé
      // étrangère.* Un formulaire forgé pouvait donc rattacher une machine
      // d'un autre site du même client, voire d'un autre client de la même
      // société. `ajouterMachineAIntervention` (le rattachement après coup,
      // plus bas) tient déjà cette règle côté serveur ; elle manquait ici, à
      // la création.
      if (saisie.machine_ids.length > 0) {
        const machinesDuSite = await tx.machine.count({
          where: { id: { in: saisie.machine_ids }, site_id: site.id },
        });
        if (machinesDuSite !== saisie.machine_ids.length) {
          return { accepte: false, cle: "intervention.refus.machine_invalide" };
        }
      }

      const forfaitId = await forfaitDeDeplacement(
        tx,
        site.zone_geo,
        saisie.type,
      );

      const ligne = await tx.intervention.create({
        data: {
          id: saisie.id.length > 0 ? saisie.id : uuidv7(),
          societe_id: contexte.societeId ?? "",
          client_id: saisie.client_id,
          site_id: saisie.site_id,
          agence_id: site.agence_id,
          type: saisie.type,
          priorite: saisie.priorite,
          // TOUJOURS `a_planifier` (PARCOURS-1) : plus rien n'est DÉDUIT ici,
          // parce qu'il n'y a plus de créneau dont le déduire.
          statut: "a_planifier",
          description: saisie.description,
          contact_id: saisie.contact_id,
          reference_client: saisie.reference_client,
          mode_valorisation: saisie.mode_valorisation,
          forfait_deplacement_id: forfaitId,
        },
        select: CHAMPS_LIGNE,
      });

      // LES MACHINES SONT ÉCRITES DANS LA MÊME TRANSACTION que l'intervention
      // qui les porte. *Une intervention créée puis « complétée » en deux temps
      // existerait, entre les deux, dans un état que RG-INT-01 refuse — et rien
      // ne garantirait le second temps.*
      //
      // `createMany` plutôt qu'une écriture IMBRIQUÉE dans le `create`
      // ci-dessus : la clé étrangère composite `(societe_id, intervention_id)`
      // fait tenir `societe_id` pour déjà donné par la relation, et Prisma
      // refuse qu'on le nomme. *Le typage l'acceptait pourtant — c'est
      // l'exécution qui l'a dit* (`Unknown argument societe_id`).
      if (saisie.machine_ids.length > 0) {
        await tx.interventionMachine.createMany({
          data: saisie.machine_ids.map((machineId) => ({
            id: uuidv7(),
            societe_id: contexte.societeId ?? "",
            intervention_id: ligne.id,
            machine_id: machineId,
          })),
        });
      }

      return {
        accepte: true,
        fiche: {
          ...ligne,
          machines: saisie.machine_ids.map((machine_id) => ({ machine_id })),
        },
      };
    },
    client,
  );
}

/**
 * Le forfait de déplacement applicable, DÉDUIT de la ZONE DU SITE.
 *
 * **De la zone, et jamais de l'agence** *(ratifié le 09/09/2026)* : une agence
 * dessert plusieurs zones à des distances différentes, et faire porter le
 * forfait par l'agence facturerait le même déplacement pour Nouméa et pour la
 * brousse. Les conditions d'un forfait portent sur la zone, la famille et le
 * type — jamais sur l'agence (RG-TAR-06, D23).
 *
 * **Le forfait retenu est celui de plus petit RANG** (D86). La lecture ordonne
 * par rang, et la règle retrie : la garantie est ainsi portée par la RÈGLE et
 * non par la lecture — un appelant qui oublierait le `orderBy` obtiendrait le
 * même forfait. *« Le premier applicable » se lisait auparavant dans l'ordre de
 * l'alphabet des codes, ce qui n'est pas une décision de tarification.*
 */
async function forfaitDeDeplacement(
  tx: Prisma.TransactionClient,
  zone: string | null,
  typeIntervention: string,
): Promise<string | null> {
  const candidats = await tx.forfait.findMany({
    where: { type: "deplacement", actif: true },
    select: {
      id: true,
      rang: true,
      zone_geo: true,
      famille_id: true,
      type_intervention: true,
    },
    orderBy: { rang: "asc" },
  });
  const retenu = forfaitRetenu(candidats, {
    zone,
    familleId: null,
    typeIntervention,
  });
  return retenu?.id ?? null;
}

/**
 * RG-PLA-04 LU SOUS LE CONTEXTE CLOISONNÉ — **le seul endroit du dépôt qui lit
 * ces deux tables** (L3-02).
 *
 * *Il y avait une seule lecture, et elle était dans `affecterTechnicien`.* Le
 * glisser-déposer écrit pourtant `technicien_id` par un tout autre chemin —
 * `deplacerIntervention` —, et **ce chemin ne consultait RIEN** : mesuré avant
 * de le refermer, un technicien sans l'habilitation bloquante de son site
 * s'affectait en le faisant glisser sur sa colonne, alors que le même geste par
 * le formulaire de la fiche était refusé. *Une règle tenue par un chemin sur
 * deux n'est pas tenue.*
 *
 * D'où une fonction et non une recopie : les trois appelants — l'affectation,
 * le déplacement, et l'écran qui affiche les avertissements — posent la même
 * question au même endroit. *Une seconde lecture d'un même critère diverge en
 * silence* (§9, 01/09), et ici elle aurait divergé dans le sens permissif.
 *
 * **Aucune comparaison de société n'est écrite ici** : on lit SOUS les
 * politiques, et la forme « société » de ces deux tables décide.
 */
async function verdictHabilitationSous(
  tx: Prisma.TransactionClient,
  siteId: string,
  technicienId: string,
  dateIntervention: Date,
): Promise<VerdictAffectation> {
  const exigences = await tx.siteHabilitationRequise.findMany({
    where: { site_id: siteId },
    // Le CODE est lu ici parce que c'est ici qu'il se trouve (D73) : le refus
    // doit dire « habilitation BR absente » et jamais un UUID.
    select: {
      habilitation_id: true,
      bloquant: true,
      habilitation: { select: { code: true } },
    },
  });
  const detenues = await tx.technicienHabilitation.findMany({
    where: { utilisateur_id: technicienId },
    select: { habilitation_id: true, date_expiration: true },
  });
  return verdictAffectation(
    exigences.map((exigence) => ({
      habilitation_id: exigence.habilitation_id,
      code: exigence.habilitation.code,
      bloquant: exigence.bloquant,
    })),
    detenues,
    dateIntervention,
  );
}

/**
 * CE QU'UN AVERTISSEMENT A LE DROIT DE TRAVERSER — **des clés, jamais du
 * texte** (L3-02).
 *
 * Le refus voyage déjà ainsi (`actions.ts`) : *sans ce filtre, une réponse
 * forgée ferait écrire n'importe quoi à la page* (L1-02f). **Un avertissement
 * n'y échappe pas**, et cela coûte quelque chose qu'on écrit plutôt que de le
 * taire : *le code de l'habilitation ne peut PAS voyager par ce canal* — il est
 * une donnée de société, et un paramètre d'URL recopié à l'écran est un canal
 * d'écriture ouvert à qui forge un lien (D50).
 *
 * **Le détail est donc LU par l'écran**, sous le contexte cloisonné, à côté du
 * technicien qu'il affiche. Ce que le canal porte est la seule chose qu'il
 * puisse porter sans mentir : *il y a des exigences non satisfaites, va voir la
 * fiche.* C'est moins riche qu'un message composé ici, et c'est la seule forme
 * qui ne s'ouvre pas.
 */
function clesDAvertissement(
  verdict: VerdictAffectation,
): readonly string[] | undefined {
  return verdict.avertissements.length === 0
    ? undefined
    : ["intervention.avertissement.habilitation"];
}

/**
 * AFFECTER un technicien, sous RG-PLA-04 : l'affectation est **bloquée**, pas
 * signalée.
 *
 * Le refus porte la liste des habilitations manquantes, pour que l'écran
 * l'affiche À LA PLACE de l'action, avec sa raison — jamais dans une bannière
 * qu'on ferme.
 */
export async function affecterTechnicien(
  contexte: ContexteSession,
  interventionId: string,
  technicienId: string,
  client?: PrismaClient,
): Promise<Resultat<LigneIntervention>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: {
          id: true,
          statut: true,
          site_id: true,
          agence_id: true,
          date_planifiee: true,
          creneau_debut: true,
          duree_estimee_min: true,
          technicien_id: true,
        },
      });
      if (ligne === null) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      const barriere = refus<LigneIntervention>(
        peutAffecter(ligne.statut as StatutIntervention),
      );
      if (barriere !== null) {
        return barriere;
      }
      // ── PLANIFIER SE FAIT EN UNE FOIS, PAS EN MORCEAUX (PARCOURS-1) ──────
      //
      // Affecter un technicien SEUL à une intervention encore `a_planifier`
      // laisserait le technicien engagé sur un créneau qui n'existe pas —
      // exactement le contournement que `peutPlanifier` existe pour fermer,
      // et ce dépôt écrit `technicien_id` comme `deplacerIntervention` : la
      // même règle doit y tenir (§9, 01/09).
      const barrierePlanification = refus<LigneIntervention>(
        peutPlanifier(ligne.statut as StatutIntervention, {
          datePlanifiee: ligne.date_planifiee,
          debutMinutes: ligne.creneau_debut,
          dureeMin: ligne.duree_estimee_min,
          technicienId: technicienId,
        }),
      );
      if (barrierePlanification !== null) {
        return barrierePlanification;
      }

      const verdict = await verdictHabilitationSous(
        tx,
        ligne.site_id,
        technicienId,
        ligne.date_planifiee ?? (await instantDeLAgence(tx, ligne.agence_id)),
      );
      if (verdict.bloquee) {
        return { accepte: false, cle: "intervention.refus.habilitation" };
      }

      // ── RG-PLA-06 SUR LA TROISIÈME VOIE (PLANNING-1, 22/09/2026) ────────
      //
      // *Une règle tenue par un chemin sur deux n'est pas tenue* — c'est ce
      // que `verdictALaPose` écrit de la pose et du déplacement, et il y
      // avait un TROISIÈME chemin qui écrit `technicien_id` sur une ligne
      // datée : celui-ci. Le déclencheur `intervention_pas_sur_blocage_agenda`
      // refusait bien — la règle tenait en base —, mais par une exception
      // `23514`, et l'écran n'avait rien à afficher d'autre qu'une erreur.
      // *Ce contrôle-ci EXPLIQUE ; le déclencheur GARDE.* Même critère que
      // `verdictALaPose` : `absenceCouvrant`, et lui seul (§9, 01/09). Une
      // intervention SANS date n'a rien à juger — elle est dans la file.
      const blocage =
        ligne.date_planifiee === null
          ? null
          : absenceCouvrant(
              await tx.absence.findMany({
                where: {
                  utilisateur_id: technicienId,
                  du: { lte: ligne.date_planifiee },
                  au: { gte: ligne.date_planifiee },
                },
                select: { id: true, utilisateur_id: true, du: true, au: true },
              }),
              technicienId,
              ligne.date_planifiee,
            );
      if (blocage !== null) {
        return { accepte: false, cle: "intervention.refus.absence" };
      }

      const misAJour = await tx.intervention.update({
        where: { id: interventionId },
        data: {
          technicien_id: technicienId,
          // LE BADGE REPART À ZÉRO À CHAQUE (RÉ)AFFECTATION (AVERTISSEMENTS-1)
          // — sauf s'il s'agit du MÊME technicien qu'avant : un rappel de
          // l'action sur la même personne ne doit pas effacer une lecture
          // déjà faite.
          vue_technicien_le:
            ligne.technicien_id === technicienId ? undefined : null,
        },
        select: CHAMPS_LIGNE,
      });
      return {
        accepte: true,
        fiche: misAJour,
        avertissements: clesDAvertissement(verdict),
        etatAvant: {
          statut: ligne.statut as StatutIntervention,
          technicienId: ligne.technicien_id,
          datePlanifiee: ligne.date_planifiee,
          creneauDebut: ligne.creneau_debut,
        },
      };
    },
    client,
  );
}

/**
 * Le statut après un déplacement — il ne change que sur les DEUX bords de la
 * file d'attente, et jamais ailleurs.
 *
 * Retirer la date remet dans la file ; en donner une l'en sort. Un statut plus
 * avancé — envoyée, en cours, suspendue — n'est pas touché : *déplacer une
 * intervention en cours ne la replanifie pas, elle est en cours.*
 */
function statutApresDeplacement(
  actuel: StatutIntervention,
  datePlanifiee: Date | null,
  creneauDebut: Date | null,
): StatutIntervention {
  const sansPose = datePlanifiee === null && creneauDebut === null;
  if (sansPose) {
    return actuel === "planifiee" ? "a_planifier" : actuel;
  }
  return actuel === "a_planifier" ? "planifiee" : actuel;
}

/**
 * L'INSTANT SE CALCULE ICI, ET NULLE PART AILLEURS (R2-19).
 *
 * La saisie porte un JOUR et des MINUTES LOCALES ; le créneau stocké est un
 * INSTANT. La conversion demande le fuseau de l'agence de l'intervention — que
 * ni un formulaire ni un navigateur ne connaissent —, et elle est faite une
 * seule fois, pour le glissé comme pour le formulaire.
 *
 * `date_planifiee` est un JOUR stocké en `@db.Date`, donc à minuit UTC : le
 * lire dans le fuseau de l'agence le reculerait d'un cran sous UTC+11.
 */
/**
 * LE JOUR STOCKÉ (`@db.Date`, donc minuit UTC) LU EN `JourLocal` — partagée
 * par le déplacement et par la création (ce ticket) : lire ce jour dans le
 * fuseau de l'agence le reculerait d'un cran sous UTC+11, et une seconde
 * écriture de cette lecture divergerait en silence (§9, 01/09).
 */
function jourStocke(date: Date | null): JourLocal | null {
  return date === null
    ? null
    : {
        annee: date.getUTCFullYear(),
        mois: date.getUTCMonth() + 1,
        jour: date.getUTCDate(),
      };
}

function demandeDeDeplacement(
  saisie: Deplacement,
  fuseau: string,
): PoseDemandee {
  const jour = jourStocke(saisie.date_planifiee);
  const debut =
    jour === null || saisie.debut_minutes === null
      ? null
      : instantAMinutes(jour, saisie.debut_minutes, fuseau);
  return {
    datePlanifiee: jour,
    creneauDebut: debut,
    creneauFin:
      debut === null || saisie.duree_min === null
        ? null
        : new Date(debut.getTime() + saisie.duree_min * 60_000),
    technicienId: saisie.technicien_id,
  };
}

/**
 * LE VERDICT DES DEUX CONTRÔLES À LA POSE, lu sous le contexte cloisonné.
 *
 * **L'agence est celle de l'INTERVENTION**, jamais celle de la ligne du
 * planning : elle est déduite du site et ne change pas quand on déplace. La vue
 * semaine affiche l'union des agences d'une personne — *un repère, jamais un
 * droit de poser* (`grille.ts`).
 *
 * **Les voisines sont lues sous les politiques**, comme tout le reste : aucune
 * comparaison de société n'est écrite au-dessus, ce serait une seconde lecture
 * d'un critère que la forme « parc » porte déjà.
 */
async function verdictALaPose(
  tx: Prisma.TransactionClient,
  societeId: string,
  interventionId: string,
  agenceId: string,
  siteId: string,
  saisie: Deplacement,
): Promise<{
  readonly verdict: Verdict;
  readonly demande: PoseDemandee | null;
  readonly avertissements?: readonly string[];
}> {
  const agence = await tx.agence.findFirst({
    where: { id: agenceId },
    select: {
      fuseau_horaire: true,
      societe: { select: { fuseau_horaire: true } },
    },
  });
  if (agence === null) {
    return {
      verdict: { refuse: true, cle: "intervention.refus.inconnue" },
      demande: null,
    };
  }
  const fuseau = fuseauDeLAgence(agence);
  // RÉSOLUE UNE SEULE FOIS, et rendue à l'appelant : ce que les contrôles ont
  // jugé est exactement ce qui sera écrit. Recalculer l'instant au moment de
  // l'écriture ferait deux lectures d'un même critère (§9, 01/09).
  const demande = demandeDeDeplacement(saisie, fuseau);

  // `chargerCalendrierAgence`, ET NON `lireParametrage` (revue Codex de la PR
  // #267, 20/09/2026) — voir l'entête de `verdictOuverture` (`pose.ts`) : ce
  // contrôle ne voyait pas les fériés chômés ni les ponts d'agence, ici comme
  // à la création.
  const jourVise =
    demande.datePlanifiee ??
    (demande.creneauDebut === null
      ? null
      : versLocal(demande.creneauDebut, fuseau));
  const calendrier =
    jourVise === null
      ? null
      : await chargerCalendrierAgence(tx, {
          societeId,
          agenceId,
          fenetre: {
            du: jourSuivant(jourVise, -1),
            au: jourSuivant(jourVise, 1),
          },
        });
  const ouverture = verdictOuverture(calendrier, demande);
  if (ouverture.refuse) {
    return { verdict: ouverture, demande };
  }

  // ── LE TROISIÈME CONTRÔLE : RG-PLA-04 (L3-02) ───────────────────────────
  //
  // **Il manquait, et ce chemin écrit pourtant `technicien_id`.** Le
  // glisser-déposer affecte quelqu'un en le déposant sur sa colonne ; il
  // passait par ici, et rien ne lisait les habilitations. *Mesuré avant de le
  // refermer : le même technicien était refusé par le formulaire de la fiche et
  // accepté par un glissé.*
  //
  // **Et la DATE compte** : RG-PLA-04 compare l'expiration à la date
  // d'intervention, donc à la date VISÉE et jamais à celle d'avant. *Déplacer
  // une intervention d'une semaine peut la faire tomber après l'expiration d'un
  // CACES ; c'est précisément le cas que ce contrôle attrape et que la seule
  // lecture à l'affectation ne pouvait pas voir.*
  const habilitation =
    demande.technicienId === null
      ? null
      : await verdictHabilitationSous(
          tx,
          siteId,
          demande.technicienId,
          dateVisee(demande, fuseau) ?? (await instantDeLAgence(tx, agenceId)),
        );
  if (habilitation !== null && habilitation.bloquee) {
    return {
      verdict: { refuse: true, cle: "intervention.refus.habilitation" },
      demande,
    };
  }
  const avertissements =
    habilitation === null ? undefined : clesDAvertissement(habilitation);

  // ── LE QUATRIÈME CONTRÔLE : RG-PLA-06 (L3-04) ───────────────────────────
  //
  // *« Une absence validée bloque le créneau. »* Elle bloque à la POSE comme au
  // DÉPLACEMENT, pour la raison qui a fait écrire le troisième : **ces deux
  // chemins écrivent tous deux `technicien_id` et une date**, et une règle
  // tenue par un chemin sur deux n'est pas tenue. **Et depuis PLANNING-1
  // (22/09/2026), à l'AFFECTATION aussi** — `affecterTechnicien` écrit
  // `technicien_id` sur une ligne déjà datée, et ne portait que le refus du
  // déclencheur, muet pour l'écran.
  //
  // **TOUTE ligne bloque depuis R3-14** : le circuit d'approbation a été retiré
  // avec le statut — *CODIPLAN n'est pas un outil de gestion des ressources
  // humaines* —, et il n'y a plus de blocage qui ne bloque pas encore. Le jour
  // exact reste tranché par `absenceCouvrant`, et par elle seule.
  //
  // **Ce contrôle-ci EXPLIQUE ; le déclencheur
  // `intervention_pas_sur_blocage_agenda` GARDE.** Les deux ne se doublent pas :
  // celui-ci rend un motif nommé que l'écran affiche, celui-là rend un refus à
  // tout chemin d'écriture, y compris ceux qui ne passent pas par ici.
  const visee = dateVisee(demande, fuseau);
  if (demande.technicienId !== null && visee !== null) {
    const absences = await tx.absence.findMany({
      where: {
        utilisateur_id: demande.technicienId,
        // La borne SQL est large — elle sert l'index, pas la règle. *Le jour
        // exact est tranché par `absenceCouvrant`, et par elle seule* : deux
        // lectures d'un même critère divergent en silence (§9, 01/09).
        du: { lte: visee },
        au: { gte: visee },
      },
      select: {
        id: true,
        utilisateur_id: true,
        du: true,
        au: true,
      },
    });
    if (absenceCouvrant(absences, demande.technicienId, visee) !== null) {
      return {
        verdict: { refuse: true, cle: "intervention.refus.absence" },
        demande,
      };
    }
  }

  if (demande.creneauDebut === null || demande.technicienId === null) {
    // Rien à chevaucher : sans heure, il n'y a pas de recouvrement.
    return { verdict: { refuse: false }, demande, avertissements };
  }
  const jour = jourDe(versLocal(demande.creneauDebut, fuseau));
  const bornes = {
    du: new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour)),
    au: new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour + 1)),
  };
  const voisines = await tx.intervention.findMany({
    where: {
      technicien_id: demande.technicienId,
      date_planifiee: { gte: bornes.du, lt: bornes.au },
    },
    select: {
      id: true,
      technicien_id: true,
      creneau_debut: true,
      creneau_fin: true,
      statut: true,
    },
  });
  return {
    verdict: verdictChevauchement(voisines, interventionId, demande),
    demande,
    avertissements,
  };
}

/**
 * LA DATE À LAQUELLE L'INTERVENTION EST VISÉE, telle que RG-PLA-04 la compare.
 *
 * Le jour d'abord s'il est donné, sinon celui du créneau lu **dans le fuseau de
 * l'agence** (L0-08) — UTC+11 décale le jour d'un cran, et un créneau du 14 au
 * petit matin se rangerait au 13. Rend `null` quand le déplacement rend
 * l'intervention à la file d'attente : l'appelant retombe alors sur le jour
 * courant de l'agence, *parce qu'une habilitation expirée aujourd'hui l'est
 * aussi pour une intervention qu'on ne date pas encore.*
 */
function dateVisee(demande: PoseDemandee, fuseau: Fuseau): Date | null {
  const jour =
    demande.datePlanifiee ??
    (demande.creneauDebut === null
      ? null
      : versLocal(demande.creneauDebut, fuseau));
  return jour === null
    ? null
    : new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));
}

/**
 * DÉPLACER — changer de créneau, changer de technicien, ou les deux.
 *
 * Le journal du déplacement — qui, quand, d'où vers où — n'est pas écrit ici :
 * c'est `journal_audit` qui le porte, par déclencheur, avec les valeurs avant
 * et après (I8, D55). *Un journal écrit par la couche applicative se contourne
 * par une requête ; celui-là non.*
 */
export async function deplacerIntervention(
  contexte: ContexteSession,
  saisie: Deplacement,
  client?: PrismaClient,
): Promise<Resultat<LigneIntervention>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id: saisie.intervention_id },
        select: {
          id: true,
          statut: true,
          agence_id: true,
          site_id: true,
          technicien_id: true,
          date_planifiee: true,
          creneau_debut: true,
        },
      });
      if (ligne === null) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      const barriere = refus<LigneIntervention>(
        peutDeplacer(ligne.statut as StatutIntervention),
      );
      if (barriere !== null) {
        return barriere;
      }

      // ── PLANIFIER EXIGE LES QUATRE VALEURS ENSEMBLE (PARCOURS-1) ────────
      //
      // *C'est ICI, sous le contexte cloisonné, et PAS seulement à l'écran* —
      // même raison que les trois contrôles juste en dessous : le glisser-
      // déposer du planning passe par CETTE fonction, exactement comme le
      // formulaire « Planifier » de la fiche (R2-19, même route, même
      // décision). Une intervention encore `a_planifier` qu'on dépose sur un
      // jour de la vue semaine — sans heure, sans durée, parfois sans
      // technicien — ne doit PAS silencieusement devenir `planifiee` à
      // moitié : c'est exactement le contournement que `peutPlanifier` ferme.
      const barrierePlanification = refus<LigneIntervention>(
        peutPlanifier(ligne.statut as StatutIntervention, {
          datePlanifiee: saisie.date_planifiee,
          debutMinutes: saisie.debut_minutes,
          dureeMin: saisie.duree_min,
          technicienId: saisie.technicien_id,
        }),
      );
      if (barrierePlanification !== null) {
        return barrierePlanification;
      }

      // ── LES TROIS CONTRÔLES À LA POSE (R2-19 ; RG-PLA-04 depuis L3-02) ──────
      //
      // Ils sont ICI, sous le contexte cloisonné, et PAS seulement à l'écran :
      // *une action refusée à l'écran mais acceptée par la base est un trou.*
      // Les règles elles-mêmes vivent dans `pose.ts` et dans
      // `lib/habilitations/affectation.ts`, qui ne lisent rien.
      const pose = await verdictALaPose(
        tx,
        contexte.societeId ?? "",
        ligne.id,
        ligne.agence_id,
        ligne.site_id,
        saisie,
      );
      const posee = refus<LigneIntervention>(pose.verdict);
      if (posee !== null || pose.demande === null) {
        return posee ?? { accepte: false, cle: "intervention.refus.inconnue" };
      }
      const demande = pose.demande;

      const misAJour = await tx.intervention.update({
        where: { id: saisie.intervention_id },
        data: {
          date_planifiee: saisie.date_planifiee,
          creneau_debut: demande.creneauDebut,
          creneau_fin: demande.creneauFin,
          // `duree_estimee_min` SUIT LE CRÉNEAU (PARCOURS-1, 23/09/2026) —
          // *mesuré* : ce dépôt calculait déjà `creneau_fin` depuis
          // `saisie.duree_min` sans jamais l'écrire dans cette colonne, que
          // `intervention_planifiee_a_sa_duree` exige désormais dès que le
          // statut devient `planifiee`/`affectee`. Les deux portent la MÊME
          // durée ; ne pas l'écrire ici la laisserait `NULL` malgré un
          // créneau complet, et la contrainte refuserait une planification
          // pourtant valide.
          //
          // **`undefined`, jamais `null`, quand AUCUNE durée n'est soumise**
          // — un déplacement qui ne touche QUE le technicien (le formulaire
          // « Déplacer » d'une intervention déjà planifiée, date/heure/durée
          // laissées vides) ne doit pas EFFACER la durée déjà posée : Prisma
          // ignore une colonne dont la valeur est `undefined`, il écrirait
          // `NULL` pour `null`.
          duree_estimee_min: saisie.duree_min ?? undefined,
          technicien_id: saisie.technicien_id,
          // Le déplacement REND une intervention à la file d'attente quand on
          // lui retire sa date, et l'en sort quand on lui en donne une. Il ne
          // touche à aucun autre statut : déplacer une intervention `en_cours`
          // ne la replanifie pas, elle est en cours.
          statut: statutApresDeplacement(
            ligne.statut as StatutIntervention,
            saisie.date_planifiee,
            demande.creneauDebut,
          ),
          // LE BADGE REPART À ZÉRO À CHAQUE (RÉ)AFFECTATION (AVERTISSEMENTS-1)
          // — jamais sur un déplacement qui laisse le même technicien : un
          // glissé qui ne fait que redater ne doit pas effacer une lecture
          // déjà faite par la même personne.
          vue_technicien_le:
            ligne.technicien_id === saisie.technicien_id ? undefined : null,
        },
        select: CHAMPS_LIGNE,
      });
      return {
        accepte: true,
        fiche: misAJour,
        avertissements: pose.avertissements,
        etatAvant: {
          statut: ligne.statut as StatutIntervention,
          technicienId: ligne.technicien_id,
          datePlanifiee: ligne.date_planifiee,
          creneauDebut: ligne.creneau_debut,
        },
      };
    },
    client,
  );
}

/**
 * LE MONTANT D'UN FORFAIT, lu sous le contexte cloisonné.
 *
 * Rend `null` quand la ligne ne porte aucun forfait — *« en l'absence de
 * forfait applicable, non facturé »* (D11) —, et `null` aussi quand le forfait
 * désigné n'est pas lisible : **les deux se traitent pareil parce qu'ils
 * signifient la même chose pour le total**, et les distinguer ici ferait un
 * oracle sur ce que le contexte a le droit de lire (D50).
 */
export async function montantDuForfait(
  tx: Prisma.TransactionClient,
  forfaitId: string | null,
): Promise<Montant | null> {
  if (forfaitId === null) {
    return null;
  }
  const forfait = await tx.forfait.findFirst({
    where: { id: forfaitId },
    select: { montant_mineur: true, devise_code: true },
  });
  return forfait === null
    ? null
    : montant(forfait.montant_mineur, forfait.devise_code);
}

/**
 * LE VERDICT DE MAJORATION D'UNE INTERVENTION (L2-09b, D12, D13, D108).
 *
 * ## Le calendrier lu est celui de l'agence du TECHNICIEN, et c'est mesurable
 *
 * I7 range les usages, et ils ne se ressemblent pas : *SLA → agence de
 * l'INTERVENTION ; **majoration → agence du TECHNICIEN** ; conflit à la pose →
 * calendrier de TRAVAIL du technicien.* Les deux premiers diffèrent dès qu'un
 * technicien de Koné intervient sur un site rattaché à Ducos — **et la ligne
 * porte déjà `agence_id`, celle de l'intervention**, à portée de main. C'est
 * exactement la faute qu'on commettrait sans y penser.
 *
 * Elle ne peut donc plus se commettre en silence : le calendrier voyage **avec
 * l'agence dont il provient**, et `majorationHorsOuverture` LÈVE sur une
 * discordance. *L'appelant désigne, le module dispose* (D70).
 *
 * **Et ce n'est pas le calendrier de TRAVAIL du technicien** — celui que
 * `chargerCalendrierDuTechnicien` compose avec ses plages propres (D72). Un
 * technicien qui travaille le samedi par exception ne fait pas du samedi une
 * journée d'ouverture de son agence : *ce que la majoration paie est
 * l'indisponibilité de l'ÉTABLISSEMENT, pas la disponibilité de la personne.*
 *
 * ## La fenêtre de lecture déborde le créneau d'un jour de chaque côté
 *
 * Les jours particuliers sont lus sur une fenêtre (D46), et un créneau de 23 h
 * sous UTC+11 tombe sur le jour UTC précédent. *Une fenêtre calée exactement
 * sur le créneau raterait le férié du jour local qu'il occupe*, et le décompte
 * hors ouverture serait faux sans rien dire.
 */
async function majorationDeLIntervention(
  tx: Prisma.TransactionClient,
  societeId: string,
  ligne: {
    readonly technicien_id: string | null;
    readonly creneau_debut: Date | null;
    readonly creneau_fin: Date | null;
  },
  mainDoeuvre: Montant | null,
): Promise<VerdictMajoration> {
  // CE DÉPÔT NE PRONONCE AUCUN MOTIF : il rapporte ce qu'il a observé, et
  // `majorationHorsOuverture` décide. *Deux lectures d'un même critère
  // divergent en silence* (§9, 01/09), et l'ordre des motifs est un critère.
  const technicien =
    ligne.technicien_id === null
      ? null
      : // Le filtre société est explicite en plus de la politique RLS (§5.6) :
        // une requête qui ne le porterait que dans la base serait juste
        // aujourd'hui et fausse le jour où elle s'exécuterait sous un rôle
        // exempté.
        await tx.technicien.findFirst({
          where: { societe_id: societeId, utilisateur_id: ligne.technicien_id },
          select: { agence_id: true },
        });

  const creneau =
    ligne.creneau_debut === null || ligne.creneau_fin === null
      ? null
      : { debut: ligne.creneau_debut, fin: ligne.creneau_fin };

  // Le calendrier n'est chargé que s'il y a de quoi le lire : sans technicien
  // rattaché ou sans créneau, la requête n'apprendrait rien.
  const calendrier =
    technicien === null || creneau === null
      ? null
      : await chargerCalendrierAgence(tx, {
          societeId,
          agenceId: technicien.agence_id,
          fenetre: {
            du: versLocal(
              new Date(creneau.debut.getTime() - MINUTES_PAR_JOUR * 60_000),
              "UTC",
            ),
            au: versLocal(
              new Date(creneau.fin.getTime() + MINUTES_PAR_JOUR * 60_000),
              "UTC",
            ),
          },
        });

  return majorationHorsOuverture({
    creneau,
    mainDoeuvre,
    calendrierDeLAgence:
      technicien === null || calendrier === null
        ? null
        : { agenceId: technicien.agence_id, calendrier },
    agenceDuTechnicien: technicien?.agence_id ?? null,
  });
}

/**
 * Ce que la clôture calcule et rend à l'écran, décomposé.
 *
 * **`totalHT` est NULLABLE depuis L2-09a, et c'est le ticket** : une
 * intervention au forfait se clôturait à `montant(0)`, ce qui se lit
 * « gratuit » là où il faut lire « je ne sais pas encore » — *rien ne
 * sélectionne de forfait de prestation.* Le motif l'accompagne, sans quoi un
 * `null` serait aussi muet que le zéro qu'il remplace.
 */
export type ResultatCloture = {
  readonly ligne: LigneIntervention;
  readonly minutesReelles: number;
  readonly minutesArrondies: number;
  readonly minutesFacturees: number;
  readonly plancherApplique: boolean;
  readonly tauxHoraire: Montant;
  /** Le forfait de déplacement retenu, s'il y en a un (RG-INT-07). */
  readonly forfaitDeplacement: Montant | null;
  /** La main-d'œuvre, quand le mode en facture. */
  readonly mainDoeuvre: Montant | null;
  /**
   * La MAJORATION hors ouverture (L2-09b, D12, D108), ou `null`.
   *
   * *Un total doit s'expliquer par ce qui le compose* : un client qui ne peut
   * pas recalculer un montant ne peut pas le contester, et c'est pire que de
   * le contester.
   */
  readonly majoration: Montant | null;
  /** `null` quand le total ne se calcule pas — jamais zéro. */
  readonly totalHT: Montant | null;
  /** Clé de dictionnaire expliquant un total inconnu, ou `null`. */
  readonly motifTotalInconnu: string | null;
};

/**
 * CLÔTURER — VALIDER le temps mesuré, appliquer D83, figer le total (D120).
 *
 * **Ce n'est plus une saisie, c'est une validation.** Le compteur du technicien
 * est la seule source du temps ; ce que la clôture écrit est le temps VALIDÉ —
 * par défaut celui qu'il a mesuré, corrigé seulement si quelqu'un l'a voulu, et
 * alors **avec son nom et sa date**. *Un compteur oublié fausse les
 * indicateurs, et sans les deux colonnes on ne voit pas l'écart.*
 *
 * Le taux retenu est celui **en vigueur à la date de l'intervention**, jamais
 * le taux du jour (RG-TAR-04) : une facture qui change quand le tarif change
 * est une facture fausse.
 *
 * Le mode `forfait` n'est pas valorisé ici : son prix ne dépend pas de la
 * durée, et la composition d'un forfait et d'un taux n'est pas tranchée
 * (registre). La clôture reste possible, le total n'est simplement pas calculé.
 */
export async function cloturerIntervention(
  contexte: ContexteSession,
  saisie: Cloture,
  client?: PrismaClient,
): Promise<Resultat<ResultatCloture>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id: saisie.intervention_id },
        select: {
          id: true,
          statut: true,
          agence_id: true,
          date_planifiee: true,
          mode_valorisation: true,
          forfait_deplacement_id: true,
          // LES TROIS COLONNES DE LA MAJORATION (L2-09b) : le créneau porte le
          // prorata (D108), le technicien porte l'agence dont on lit le
          // calendrier (D13). *`agence_id` est celle de l'INTERVENTION, et ce
          // n'est pas elle qui décide* — I7 les distingue par usage.
          technicien_id: true,
          creneau_debut: true,
          creneau_fin: true,
          // LE TEMPS MESURÉ — ce que la garde juge. *Juger le temps validé
          // rendrait la garde circulaire : l'écran le pré-remplit depuis
          // celui-ci.*
          temps_mesure_min: true,
        },
      });
      if (ligne === null) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      // D131 (23/09/2026, DROITS-1) : un technicien restreint (○) ne clôture
      // que SA PROPRE intervention affectée. Même clé que « introuvable » —
      // *hors périmètre et inexistante rendent la même chose* (D35, D50) :
      // distinguer les deux dirait à un technicien qu'une intervention d'un
      // collègue existe.
      if (
        !accesSurCetteIntervention(
          exigerContexteActif(contexte),
          "cloturer_intervention",
          ligne.technicien_id,
        )
      ) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      const barriere = refus<ResultatCloture>(
        peutCloturer(
          ligne.statut as StatutIntervention,
          ligne.temps_mesure_min,
        ),
      );
      if (barriere !== null) {
        return barriere;
      }

      const instant = await instantDeLAgence(tx, ligne.agence_id);
      const taux = await tauxEnVigueur(tx, ligne.date_planifiee ?? instant);
      if (taux === null) {
        return { accepte: false, cle: "intervention.refus.taux_absent" };
      }

      const valorisation = valoriserTempsPasse(
        saisie.temps_valide_min,
        taux.taux,
      );

      // LE FORFAIT DE DÉPLACEMENT ENTRE DANS LE TOTAL (L2-09a, RG-INT-07, D77).
      // *Il était désigné par la ligne depuis D84 et n'entrait dans aucun total :
      // l'écran affichait « Total hors taxes » sur la main-d'œuvre seule.*
      const forfaitDeplacement = await montantDuForfait(
        tx,
        ligne.forfait_deplacement_id,
      );

      // LA MAJORATION ENTRE DANS LE TOTAL (L2-09b, D12, D108). *Elle n'y
      // entrait pas : son taux et son assiette étaient écrits, la BASE de son
      // prorata ne l'était pas — et une facture amputée d'un supplément dû est
      // fausse.* Le prorata se lit sur le CRÉNEAU, jamais sur `temps_valide_min`.
      const majoration = await majorationDeLIntervention(
        tx,
        contexte.societeId ?? "",
        ligne,
        valorisation.mainDoeuvre,
      );

      const composition = valoriserIntervention({
        mode: ligne.mode_valorisation as ModeDeValorisation,
        forfaitDeplacement,
        mainDoeuvre: valorisation.mainDoeuvre,
        majoration,
      });

      const misAJour = await tx.intervention.update({
        where: { id: saisie.intervention_id },
        data: {
          statut: "cloturee",
          temps_valide_min: saisie.temps_valide_min,
          // QUI a validé, et QUAND — les deux ensemble, la base l'exige
          // (`intervention_validation_tracee`). L'auteur est celui de la
          // session : *une validation dont l'auteur viendrait du formulaire
          // serait une validation qu'on peut signer du nom d'un autre.*
          temps_valide_par: contexte.utilisateurId,
          temps_valide_le: instant,
          cloturee_le: instant,
          // **Le total INCONNU s'écrit `null`, jamais zéro.** La colonne était
          // déjà nullable ; ce qui change est qu'on n'y écrit plus un montant nul
          // à la place d'une absence.
          montant_ht: composition.totalHT?.valeur ?? null,
          devise_code: composition.totalHT?.devise ?? null,
        },
        select: CHAMPS_LIGNE,
      });

      return {
        accepte: true,
        fiche: {
          ligne: misAJour,
          minutesReelles: valorisation.minutesReelles,
          minutesArrondies: valorisation.minutesArrondies,
          minutesFacturees: valorisation.minutesFacturees,
          plancherApplique: valorisation.plancherApplique,
          tauxHoraire: taux.taux,
          forfaitDeplacement: composition.forfaitDeplacement,
          mainDoeuvre: composition.mainDoeuvre,
          majoration: composition.majoration,
          totalHT: composition.totalHT,
          motifTotalInconnu: composition.motifTotalInconnu,
        },
      };
    },
    client,
  );
}

/**
 * ANNULER — avec un motif obligatoire. **Une annulation n'efface rien** : la
 * ligne reste, son statut change, le motif est écrit, et le journal d'audit
 * garde la valeur d'avant.
 */
export async function annulerIntervention(
  contexte: ContexteSession,
  saisie: Annulation,
): Promise<Resultat<LigneIntervention>> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const ligne = await tx.intervention.findFirst({
      where: { id: saisie.intervention_id },
      select: { id: true, statut: true, agence_id: true },
    });
    if (ligne === null) {
      return { accepte: false, cle: "intervention.refus.inconnue" };
    }
    const barriere = refus<LigneIntervention>(
      peutAnnuler(ligne.statut as StatutIntervention),
    );
    if (barriere !== null) {
      return barriere;
    }

    const misAJour = await tx.intervention.update({
      where: { id: saisie.intervention_id },
      data: {
        statut: "annulee",
        motif_annulation: saisie.motif,
        annulee_le: await instantDeLAgence(tx, ligne.agence_id),
      },
      select: CHAMPS_LIGNE,
    });
    return { accepte: true, fiche: misAJour };
  });
}

/**
 * RATTACHER UNE MACHINE APRÈS COUP (chantier INT-MACHINE 2, 20/09/2026).
 *
 * `creerIntervention` sait déjà écrire `intervention_machine` (le dépannage à
 * l'aveugle démarre sans savoir laquelle est en cause), mais rien ne
 * permettait d'en désigner une PLUS TARD, une fois le diagnostic posé. C'est
 * le trou que cette fonction comble — le formulaire de création écrivait déjà,
 * la fiche ne pouvait pas.
 *
 * **La machine doit appartenir au SITE de l'intervention, et à lui seul**
 * (arbitrage par défaut de ce lot, ouvert à discussion — voir la description
 * de la PR) : la liste proposée par la fiche est déjà filtrée sur ce site, et
 * ce contrôle tient la même règle CÔTÉ SERVEUR, contre un formulaire forgé qui
 * soumettrait l'identifiant d'une machine d'un autre site.
 *
 * **UNE SEULE MACHINE AU PLUS, DEPUIS PARCOURS-1 (23/09/2026, arbitrage
 * Alexis).** ~~Plusieurs machines restaient possibles~~ — `intervention_machine`
 * porte désormais `@@unique([intervention_id])` en plus de son doublon. Un
 * second appel sur la MÊME machine déjà liée reste un NO-OP accepté :
 * reposer deux fois la même question ne change rien à la réponse. Un appel
 * sur une AUTRE machine, lui, est REFUSÉ — nommé, avant même d'atteindre la
 * contrainte, dont le message serait technique.
 *
 * **L'ÉCRITURE EST ATOMIQUE** (revue Codex de la PR #267, 20/09/2026) :
 * `createMany` avec `skipDuplicates` — un `INSERT ... ON CONFLICT DO NOTHING`
 * — plutôt qu'un « vérifier l'absence, puis créer ». *Une séquence
 * vérifier-puis-écrire laisse une fenêtre entre les deux requêtes : deux
 * appels concurrents sur la même machine peuvent tous deux passer le
 * contrôle avant qu'aucun n'ait écrit, et le second se ferait alors refuser
 * par la contrainte unique au lieu du NO-OP annoncé ci-dessus.* Une seule
 * instruction ferme cette fenêtre.
 *
 * **Aucun contrôle de cycle de vie n'est ajouté ici** — ni `peutAffecter` ni
 * aucun autre : ce n'est pas demandé par ce lot, et RG-INT-01 (une machine
 * exigée avant de DÉMARRER) reste tenue où elle l'est déjà, par le
 * déclencheur PostgreSQL, jamais réimplémentée ici (§9, 01/09).
 */
export async function ajouterMachineAIntervention(
  contexte: ContexteSession,
  interventionId: string,
  machineId: string,
  client?: PrismaClient,
): Promise<Resultat<LigneIntervention>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true, site_id: true },
      });
      if (ligne === null) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      // LE SITE TIENT LA RÈGLE : une machine d'un AUTRE site — même du même
      // client — n'est jamais rattachable par cette voie (voir l'entête).
      const machine = await tx.machine.findFirst({
        where: { id: machineId, site_id: ligne.site_id },
        select: { id: true },
      });
      if (machine === null) {
        return { accepte: false, cle: "intervention.refus.machine_invalide" };
      }
      // UNE MACHINE AU PLUS (PARCOURS-1) — voir l'entête. Une AUTRE machine
      // déjà liée refuse ; la MÊME redescend au NO-OP du `skipDuplicates`
      // ci-dessous.
      const dejaLiee = await tx.interventionMachine.findFirst({
        where: { intervention_id: interventionId },
        select: { machine_id: true },
      });
      if (dejaLiee !== null && dejaLiee.machine_id !== machineId) {
        return {
          accepte: false,
          cle: "intervention.refus.machine_deja_presente",
        };
      }
      await tx.interventionMachine.createMany({
        data: [
          {
            id: uuidv7(),
            societe_id: contexte.societeId ?? "",
            intervention_id: interventionId,
            machine_id: machineId,
          },
        ],
        skipDuplicates: true,
      });
      const misAJour = await tx.intervention.findFirstOrThrow({
        where: { id: interventionId },
        select: CHAMPS_LIGNE,
      });
      return { accepte: true, fiche: misAJour };
    },
    client,
  );
}

/**
 * LA RESTRICTION PAR PERSONNE, LUE UNE SEULE FOIS POUR LES TROIS LECTURES
 * (R5-01).
 *
 * Elle est ici et non recopiée dans chaque requête : *le planning, la fiche et
 * la ligne brute répondent à la même question — « ces interventions sont-elles
 * les miennes ? » — et trois écritures d'un même critère divergent en silence*
 * (§9, 01/09).
 *
 * Elle LÈVE sur un rôle sans accès plutôt que de rendre zéro ligne : un
 * planning vide et un planning interdit se corrigent à des endroits
 * différents. Le message est technique, et l'écran décide de ce qu'un humain
 * en lit.
 */
export function restrictionParPersonne(
  contexte: ContexteSession,
): { readonly technicien_id: string } | undefined {
  const perimetre = perimetreDuPlanning(exigerContexteActif(contexte));
  const motif = motifRefusPlanning(perimetre);
  if (motif !== null) {
    throw new Error(motif);
  }
  return filtreDuPerimetre(perimetre);
}

/**
 * LE CLIENT INACTIF SORT DU PLANNING ET DU REGISTRE, PAR DÉFAUT (RG-PLA-08,
 * D129 — arbitrage du 19/09/2026, direction d'exploitation).
 *
 * **Le SITE n'est pas concerné** : RG-PLA-08 ne porte que sur `client.actif`,
 * et la question du site reste ouverte (§8) — un site inactif d'un client
 * actif continue de s'afficher.
 *
 * **Ce n'est pas une politique RLS** : `intervention` ne porte aucune
 * politique sur `actif`, et ça n'en devient pas une ici — c'est une décision
 * d'AFFICHAGE, filtrée côté application comme les autres critères de
 * `filtreDesInterventions`. `listerPlanning` l'applique SANS EXCEPTION ;
 * `/interventions` (`filtreDesInterventions`) offre la case « inclure les
 * clients inactifs » qui la lève — c'est la seule façon prévue de retrouver
 * l'historique d'un client devenu inactif depuis ces deux écrans. La fiche
 * du CLIENT, elle, ne passe jamais par ici : `dernieresInterventionsDuClient`
 * filtre sur `client_id` seul, et continue de tout montrer.
 */
function filtreClientActif(
  inclureClientsInactifs: boolean,
): Prisma.InterventionWhereInput {
  return inclureClientsInactifs ? {} : { client: { actif: true } };
}

/** Une ligne de planning, avec ce qu'il faut pour la lire sans l'ouvrir. */
export type LignePlanning = LigneIntervention & {
  readonly client: { raison_sociale: string };
  readonly site: { libelle: string };
};

/**
 * Le planning d'une période — tout ce qui est visible dans le périmètre.
 *
 * Les libellés voyagent avec les lignes : une liste d'UUID n'est pas un
 * planning, et les faire chercher un par un par l'écran ferait autant de
 * requêtes que de lignes.
 */
export async function listerPlanning(
  contexte: ContexteSession,
  du: Date,
  au: Date,
  client?: PrismaClient,
): Promise<readonly LignePlanning[]> {
  const restriction = restrictionParPersonne(contexte);
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.intervention.findMany({
        where: {
          ...restriction,
          // LE CLIENT INACTIF SORT DU PLANNING, SANS EXCEPTION (RG-PLA-08,
          // D129) : à la différence du registre `/interventions`, cet écran
          // n'offre aucune case pour le revoir — voir `filtreClientActif`,
          // qui documente la règle et sa borne (le SITE n'est pas concerné).
          ...filtreClientActif(false),
          OR: [
            // `lt` ET NON `lte` — la borne haute est EXCLUSIVE (12/09/2026).
            // L'appelant passe le lendemain à minuit ; avec `lte`, la journée
            // du lendemain revenait tout entière, et le panneau de charge
            // comptait un jour de trop. *Une borne exclusive comparée par
            // `lte` ramène toujours exactement une unité de trop, et le
            // symptôme est un chiffre légèrement faux — celui qu'on ne
            // recompte pas.*
            { date_planifiee: { gte: du, lt: au } },
            // La file d'attente n'a pas de date : elle est du planning quand
            // même, et c'est la ligne « À planifier / File d'attente » de
            // l'annexe D.
            { date_planifiee: null },
          ],
        },
        // ── L'ORDRE EST TOTAL, ET C'EST TOUT LE TICKET L3-03 ─────────────────
        //
        // **Il ne l'était pas, et la file d'attente était rangée par la PLACE
        // PHYSIQUE des lignes.** Toutes ses lignes ont `date_planifiee` et
        // `creneau_debut` nuls : les deux seuls critères étaient donc ex æquo
        // sur toute la file, et PostgreSQL rend les ex æquo dans l'ordre qu'il
        // veut — celui du parcours. *Mesuré le 11/09/2026 : la file s'affichait
        // p1, p1, p3, p2, p2 — pas par urgence du tout —, et un simple `UPDATE`
        // sur une ligne l'a envoyée en FIN de file, parce qu'un `UPDATE` réécrit
        // le tuple à la fin du tas.* **Le planificateur voyait donc sa file se
        // réordonner à chaque modification, sans qu'aucune règle le décide.**
        //
        // **L'URGENCE D'ABORD** : `p1` est « critique » et `p4` « basse » — le
        // dictionnaire le dit, et l'énumération PostgreSQL trie dans son ordre de
        // déclaration. Un scénario l'assère plutôt que de s'y fier : *un ordre
        // qui dépend de l'ordre de déclaration d'une énumération est une décision
        // que personne n'a écrite.*
        //
        // **PUIS L'ANCIENNETÉ, QUI N'EST PAS L'ÉCHÉANCE** — et l'écart est écrit
        // plutôt que tu. Le ticket dit « urgence et échéance » ; **aucune échéance
        // n'existe** : elle naît d'un contrat (RG-CON-01), et `contrat` est au lot
        // 4. Ranger `cree_le` sous le nom d'« échéance » serait inventer une règle
        // métier (§8). Ce qu'il fait est plus modeste et vrai : *à urgence égale,
        // la plus ancienne passe devant.*
        //
        // **ET `id` FERME L'ORDRE.** Deux interventions créées dans la même
        // milliseconde restent possibles ; sans ce dernier rang, elles
        // retomberaient dans le cas qu'on vient de fermer. L'`id` est un UUID v7,
        // donc ordonné dans le temps : il prolonge `cree_le` au lieu de le
        // contredire.
        orderBy: [
          { date_planifiee: "asc" },
          { creneau_debut: "asc" },
          { priorite: "asc" },
          { cree_le: "asc" },
          { id: "asc" },
        ],
        select: {
          ...CHAMPS_LIGNE,
          client: { select: { raison_sociale: true } },
          site: { select: { libelle: true } },
        },
      }),
    client,
  );
}

/**
 * COMBIEN D'INTERVENTIONS À VENIR N'ONT AUCUNE DURÉE PRÉVUE (TABLEAU-1,
 * 23/09/2026 ; corrigé le même jour, AFFICHAGE-MATERIEL-1) — un compte, pas
 * une alerte de conformité.
 *
 * Alexis a décidé le 23/09/2026 que la durée deviendra obligatoire ; ce
 * chiffre mesure combien de fiches en manquent aujourd'hui, avant que la
 * règle n'existe. **Aucune migration, aucune contrainte posée ici** : la
 * colonne `duree_estimee_min` existe déjà, nullable — ce compte ne fait que
 * la lire.
 *
 * **MESURÉ EN PRODUCTION LE 23/09/2026 À 13H05, APRÈS 34-TABLEAU-1 : la tuile
 * affichait 1755** — presque tout l'historique repris, des interventions
 * CLÔTURÉES de 2021 à 2026, sans durée saisie parce que le terrain ne l'a
 * jamais exigée avant cette décision. *Le premier critère — « une date est
 * posée » — comptait le PASSÉ figé avec l'À VENIR à compléter*, deux choses
 * que rien ne distinguait.
 *
 * **Le critère retenu est désormais double** :
 *   - **NON TERMINALE** — ni `terminee`, ni `cloturee`, ni `annulee` : un
 *     travail déjà fait ou abandonné n'a plus de durée à faire compléter ;
 *   - **datée d'AUJOURD'HUI OU PLUS TARD, OU SANS DATE** — `debutDuJour` est
 *     la borne CIVILE que l'appelant lit dans le fuseau de la société (L0-08,
 *     comme `compterAPrevoir` juste au-dessus) ; une fiche encore « à
 *     planifier » (`date_planifiee` nulle) reste comptée, puisqu'elle
 *     manquera de durée le jour où elle sera posée.
 */
export async function compterInterventionsSansDuree(
  contexte: ContexteSession,
  debutDuJour: Date,
  client?: PrismaClient,
): Promise<number> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.intervention.count({
        where: {
          ...filtreClientActif(false),
          ...criteresSansDureeAVenir(debutDuJour),
        },
      }),
    client,
  );
}

/**
 * LE CRITÈRE PARTAGÉ — la tuile du tableau de bord ET le lien qu'elle pose
 * vers le registre lisent la MÊME chose (§9, 01/09 : deux lectures d'un même
 * critère divergent en silence). Non terminale, sans durée, et à venir ou
 * sans date — voir la note de tête de `compterInterventionsSansDuree`.
 */
function criteresSansDureeAVenir(
  debutDuJour: Date,
): Prisma.InterventionWhereInput {
  return {
    statut: { notIn: ["terminee", "cloturee", "annulee"] },
    duree_estimee_min: null,
    OR: [{ date_planifiee: null }, { date_planifiee: { gte: debutDuJour } }],
  };
}

/**
 * LA CIVILE D'AUJOURD'HUI DANS LE FUSEAU DE LA SOCIÉTÉ (L0-08) — lue depuis
 * la même transaction que le filtre qu'elle borne, jamais depuis l'horloge de
 * l'appareil.
 */
async function debutDuJourSociete(
  tx: Prisma.TransactionClient,
  contexte: ContexteSession,
): Promise<Date> {
  const societe = await tx.societe.findFirst({
    where: { id: exigerContexteActif(contexte).societeId },
    select: { fuseau_horaire: true },
  });
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  return instantDuJour(jourDe(maintenant(fuseau).local));
}

/**
 * LA BORNE HAUTE, EXCLUSIVE, DU MÊME JOUR CIVIL — le lendemain à minuit UTC
 * (52-REGISTRE-1). `debutDuJour` est déjà l'instant UTC d'un jour civil posé
 * par `instantDuJour` ; lui ajouter exactement 24 h en millisecondes retombe
 * sur le minuit UTC suivant, sans repasser par un fuseau — cette arithmétique
 * ne porte que sur une représentation UTC, jamais sur une heure locale.
 */
function finDuJour(debutDuJour: Date): Date {
  return new Date(debutDuJour.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * LA FICHE COMPLÈTE — libellés lus, et décomposition de D83 sous les yeux.
 *
 * Deux choses que la ligne brute ne porte pas, et que l'écran ne doit pas
 * fabriquer :
 *
 * **Les LIBELLÉS.** Une fiche qui affiche des UUID n'est pas une fiche. Ils
 * sont lus par jointure SOUS le contexte : un identifiant hors périmètre ne
 * rend pas de libellé, et l'écran affiche alors le tiret plutôt qu'un nom
 * qu'il n'a pas le droit de connaître.
 *
 * **La DÉCOMPOSITION de RG-TAR-05 amendée par D83** — temps réel, arrondi au
 * quart d'heure supérieur, plancher d'une heure, temps facturé, taux, total.
 * *C'est la demande explicite de l'exploitation : voir l'arrondi et le plancher
 * s'appliquer sous les yeux.* Elle est calculée par la MÊME fonction que la
 * clôture, jamais recalculée à l'écran — deux lectures d'un même critère
 * divergent en silence (§9, 01/09).
 */
export async function lireFicheIntervention(
  contexte: ContexteSession,
  id: string,
  /**
   * La connexion, pour les scénarios qui lisent la base jetable — le reste du
   * dépôt appelle ce paramètre `client`, et ici ce nom est déjà celui du
   * CLIENT de l'intervention, deux lignes plus bas. *Deux choses sous un même
   * nom dans un même fichier est la faute du 09/09.*
   */
  connexion?: PrismaClient,
): Promise<{
  readonly ligne: LigneIntervention;
  readonly client: string | null;
  readonly lieu: string | null;
  readonly rattachement: string | null;
  readonly forfait: string | null;
  /** LE CONTACT SUR PLACE (PARCOURS-1) — `null` quand aucun n'est désigné. */
  readonly contact: string | null;
  readonly devise: {
    code: string;
    decimales: number;
    symbole: string | null;
  } | null;
  /**
   * LE FUSEAU DE L'AGENCE (FICHE-INTERVENTION-1) — pour lire l'HEURE du
   * créneau comme le planning la lit déjà (`heureDuCreneau`,
   * `../presentation.ts`) : jamais celui de l'appareil (L0-08).
   */
  readonly fuseau: Fuseau;
  readonly valorisation: ValorisationAffichee | null;
  /**
   * RG-PLA-04 SUR LE TECHNICIEN ACTUELLEMENT AFFECTÉ (L3-02, D73).
   *
   * `null` quand personne n'est affecté : *il n'y a alors rien à dire, et un
   * verdict vide se lirait comme « tout va bien ».*
   *
   * **C'est ICI que les codes et les dates sont lus**, sous le contexte
   * cloisonné, et jamais reçus d'un paramètre d'URL : un texte qui traverse
   * l'URL est un canal d'écriture ouvert à qui forge un lien (L1-02f, D50). Le
   * canal de refus porte une clé ; le DÉTAIL se lit en base, à côté du
   * technicien qu'on affiche.
   */
  readonly habilitations: VerdictAffectation | null;
  /** LA NOTE INTERNE (50-INTERVENTIONS-2) — back-office seulement, voir la colonne. */
  readonly noteInterne: string | null;
  readonly clotureeLe: Date | null;
  readonly annuleeLe: Date | null;
  readonly creeLe: Date;
  /** QUI a validé le temps, et QUAND (D120) — voir la colonne. */
  readonly tempsValidePar: string | null;
  readonly tempsValideLe: Date | null;
  readonly commentaireTechnicien: string | null;
  readonly suiteADonner: string | null;
} | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id, ...restrictionParPersonne(contexte) },
        select: {
          ...CHAMPS_LIGNE,
          note_interne: true,
          cloturee_le: true,
          annulee_le: true,
          cree_le: true,
          temps_valide_par: true,
          temps_valide_le: true,
          commentaire_technicien: true,
          suite_a_donner: true,
          client: { select: { raison_sociale: true } },
          site: { select: { libelle: true } },
          agence: {
            select: {
              libelle: true,
              fuseau_horaire: true,
              societe: { select: { fuseau_horaire: true } },
            },
          },
          forfait: { select: { libelle: true } },
          devise: { select: { code: true, decimales: true, symbole: true } },
          contact: { select: { nom: true } },
        },
      });
      if (ligne === null) {
        return null;
      }
      const {
        client,
        site,
        agence,
        forfait,
        devise,
        contact,
        note_interne,
        cloturee_le,
        annulee_le,
        cree_le,
        temps_valide_par,
        temps_valide_le,
        commentaire_technicien,
        suite_a_donner,
        ...brute
      } = ligne;

      // Le verdict porte sur la date VISÉE — celle de l'intervention —, jamais
      // sur aujourd'hui : une habilitation qui expire la semaine prochaine est
      // valable pour une intervention posée demain, et expirée pour une posée
      // dans un mois.
      const habilitations =
        brute.technicien_id === null
          ? null
          : await verdictHabilitationSous(
              tx,
              brute.site_id,
              brute.technicien_id,
              brute.date_planifiee ??
                (await instantDeLAgence(tx, brute.agence_id)),
            );

      let valorisation: ValorisationAffichee | null = null;
      if (brute.temps_valide_min !== null && brute.temps_valide_min > 0) {
        const instant = await instantDeLAgence(tx, brute.agence_id);
        const taux = await tauxEnVigueur(tx, brute.date_planifiee ?? instant);
        if (taux !== null) {
          const v = valoriserTempsPasse(brute.temps_valide_min, taux.taux);
          // LA MÊME COMPOSITION QUE LA CLÔTURE, et c'est délibéré : l'écran ne
          // recalcule pas un total avec sa propre règle. *Deux lectures d'un même
          // critère divergent en silence* (§9, 01/09) — ici l'une figerait le
          // montant en base et l'autre l'afficherait, et le jour où elles
          // s'écarteraient c'est l'écran qui aurait l'air d'avoir raison.
          const composition = valoriserIntervention({
            mode: brute.mode_valorisation as ModeDeValorisation,
            forfaitDeplacement: await montantDuForfait(
              tx,
              brute.forfait_deplacement_id,
            ),
            mainDoeuvre: v.mainDoeuvre,
            // LA MÊME MAJORATION QUE LA CLÔTURE, par le même chemin : l'écran ne
            // recalcule pas un supplément avec sa propre règle.
            majoration: await majorationDeLIntervention(
              tx,
              contexte.societeId ?? "",
              brute,
              v.mainDoeuvre,
            ),
          });
          valorisation = {
            minutesReelles: v.minutesReelles,
            minutesArrondies: v.minutesArrondies,
            minutesFacturees: v.minutesFacturees,
            plancherApplique: v.plancherApplique,
            tauxHoraire: v.tauxHoraire,
            mainDoeuvre: composition.mainDoeuvre,
            forfaitDeplacement: composition.forfaitDeplacement,
            majoration: composition.majoration,
            totalHT: composition.totalHT,
            motifTotalInconnu: composition.motifTotalInconnu,
          };
        }
      }

      return {
        ligne: brute,
        client: client.raison_sociale,
        lieu: site.libelle,
        rattachement: agence.libelle,
        forfait: forfait?.libelle ?? null,
        contact: contact?.nom ?? null,
        devise,
        fuseau: fuseauDeLAgence(agence),
        valorisation,
        habilitations,
        noteInterne: note_interne,
        clotureeLe: cloturee_le,
        annuleeLe: annulee_le,
        creeLe: cree_le,
        tempsValidePar: temps_valide_par,
        tempsValideLe: temps_valide_le,
        commentaireTechnicien: commentaire_technicien,
        suiteADonner: suite_a_donner,
      };
    },
    connexion,
  );
}

/**
 * Ce que l'écran affiche du calcul de D83 **et de la composition de L2-09a**,
 * sans refaire ni l'un ni l'autre.
 *
 * *L'écran affichait « Total hors taxes » sur la main-d'œuvre seule, le forfait
 * de déplacement n'entrant dans aucun total.* Il porte désormais les deux
 * lignes et un total qui peut être **inconnu** — jamais nul.
 */
export type ValorisationAffichee = {
  readonly minutesReelles: number;
  readonly minutesArrondies: number;
  readonly minutesFacturees: number;
  readonly plancherApplique: boolean;
  readonly tauxHoraire: Montant;
  readonly mainDoeuvre: Montant | null;
  readonly forfaitDeplacement: Montant | null;
  /** La MAJORATION hors ouverture (L2-09b), ou `null` — voir `ResultatCloture`. */
  readonly majoration: Montant | null;
  readonly totalHT: Montant | null;
  readonly motifTotalInconnu: string | null;
};

/**
 * LE BADGE « NOUVEAU » S'EFFACE ICI, ET NULLE PART AILLEURS
 * (AVERTISSEMENTS-1, 24/09/2026) — appelée par `/terrain/[id]` quand la fiche
 * terrain s'ouvre, JAMAIS par la fiche back-office (`/interventions/[id]`) :
 * *le badge dit ce que LE TECHNICIEN a vu, pas ce que l'ADV a regardé.*
 *
 * Le `where` porte `technicien_id: contexte.utilisateurId` en plus de
 * l'identifiant : une défense en profondeur, redondante avec
 * `restrictionParPersonne` qui a déjà filtré la fiche que l'appelant a pu
 * lire — mais une fonction qui ÉCRIT ne doit pas dépendre d'un filtre posé
 * ailleurs pour rester correcte si un jour elle est appelée d'un autre écran.
 * `updateMany` plutôt que `update` : zéro ligne touchée n'est pas une erreur,
 * ni pour une fiche déjà vue, ni pour un rôle qui n'est pas le technicien
 * affecté.
 */
export async function marquerVuParTechnicien(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<void> {
  await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: {
          id: interventionId,
          technicien_id: contexte.utilisateurId,
          vue_technicien_le: null,
        },
        select: { id: true, agence_id: true },
      });
      if (ligne === null) {
        return;
      }
      // L'INSTANT VIENT DU FUSEAU DE L'AGENCE (L0-08), jamais de l'appareil :
      // un `new Date()` ici daterait le badge de l'heure du TÉLÉPHONE du
      // technicien, qui peut porter n'importe quel fuseau en déplacement.
      await tx.intervention.update({
        where: { id: ligne.id },
        data: {
          vue_technicien_le: await instantDeLAgence(tx, ligne.agence_id),
        },
      });
    },
    client,
  );
}

/** Le nom d'une personne citée sur la fiche — jamais l'identifiant (I10). */
function nomDeLaPersonne(
  utilisateurId: string | null,
  annuaire: Annuaire,
): string | null {
  if (utilisateurId === null) {
    return null;
  }
  const designation = annuaire(utilisateurId);
  return designation.etat === "nom" ? designation.nom : "—";
}

/** Un segment de travail, prêt pour l'affichage — même forme que `SegmentBonAffiche`. */
export type SegmentAffiche = {
  readonly debut: Date;
  readonly fin: Date | null;
  /** `null` quand le segment tourne encore. */
  readonly minutes: number | null;
  readonly technicien: string;
};

/**
 * LES SEGMENTS DE TRAVAIL D'UNE INTERVENTION (50-INTERVENTIONS-2) — la
 * RÉALISATION, sous les yeux. `null` si l'intervention n'est pas visible.
 */
export async function segmentsDeLIntervention(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<readonly SegmentAffiche[] | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true },
      });
      if (intervention === null) {
        return null;
      }
      const segments = await tx.segmentTravail.findMany({
        where: { intervention_id: interventionId },
        select: { utilisateur_id: true, debut: true, fin: true },
        orderBy: [{ debut: "asc" }, { id: "asc" }],
      });
      const annuaire = await annuaireDesPersonnes(
        tx,
        segments.map((s) => s.utilisateur_id),
      );
      return segments.map((s) => ({
        debut: s.debut,
        fin: s.fin,
        minutes:
          s.fin === null
            ? null
            : Math.floor((s.fin.getTime() - s.debut.getTime()) / 60_000),
        technicien: nomDeLaPersonne(s.utilisateur_id, annuaire) ?? "—",
      }));
    },
    client,
  );
}

/** Une pause, prête pour l'affichage — la plus récente en tête (appelant). */
export type PauseAffichee = {
  readonly id: string;
  readonly debut: Date;
  /** `null` : la pause est en cours. */
  readonly fin: Date | null;
  readonly motif: string;
  readonly pieceAttendueRef: string | null;
  readonly dateDispoPrevue: Date | null;
  /** `null` : née avant ce lot, l'auteur n'est pas connu (voir le modèle). */
  readonly ouvertPar: string | null;
  readonly fermeePar: string | null;
};

/**
 * L'HISTORIQUE DES PAUSES D'UNE INTERVENTION (50-INTERVENTIONS-2), la plus
 * récente en tête. `null` si l'intervention n'est pas visible.
 */
export async function pausesDeLIntervention(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<readonly PauseAffichee[] | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true },
      });
      if (intervention === null) {
        return null;
      }
      const pauses = await tx.interventionPause.findMany({
        where: { intervention_id: interventionId },
        select: {
          id: true,
          debut: true,
          fin: true,
          motif: true,
          piece_attendue_ref: true,
          date_dispo_prevue: true,
          ouvert_par: true,
          fermee_par: true,
        },
        orderBy: [{ debut: "desc" }, { id: "desc" }],
      });
      const identites = [
        ...new Set(
          pauses.flatMap((p) =>
            [p.ouvert_par, p.fermee_par].filter((v): v is string => v !== null),
          ),
        ),
      ];
      const annuaire = await annuaireDesPersonnes(tx, identites);
      return pauses.map((p) => ({
        id: p.id,
        debut: p.debut,
        fin: p.fin,
        motif: p.motif,
        pieceAttendueRef: p.piece_attendue_ref,
        dateDispoPrevue: p.date_dispo_prevue,
        ouvertPar: nomDeLaPersonne(p.ouvert_par, annuaire),
        fermeePar: nomDeLaPersonne(p.fermee_par, annuaire),
      }));
    },
    client,
  );
}

/**
 * ENREGISTRE LA NOTE INTERNE (50-INTERVENTIONS-2) — visible et modifiable par
 * les rôles back-office seulement : cette fonction vit dans le dépôt
 * BACK-OFFICE, jamais dans `depot-rapport-terrain.ts`. `null` si
 * l'intervention n'est pas visible (D35, D50).
 *
 * Aucun statut ne se vérifie ici au-delà de ce que le déclencheur
 * `intervention_cycle_de_vie` refuse déjà : une intervention clôturée ou
 * annulée ne se modifie plus, note interne comprise — même régime que le
 * reste de la fiche.
 */
export async function enregistrerNoteInterne(
  contexte: ContexteSession,
  saisie: NoteInterne,
  client?: PrismaClient,
): Promise<{ readonly id: string } | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: saisie.intervention_id },
        select: { id: true },
      });
      if (intervention === null) {
        return null;
      }
      const ecrite = await tx.intervention.update({
        where: { id: saisie.intervention_id },
        data: { note_interne: saisie.note_interne },
        select: { id: true },
      });
      return ecrite;
    },
    client,
  );
}

/**
 * Une intervention, par son identifiant, AVEC SA DEVISE. `null` si hors
 * périmètre.
 *
 * La devise voyage avec le montant, toujours (I2) — et c'est elle qui porte le
 * nombre de décimales (I3). *L'écran ne doit jamais avoir à savoir que le XPF
 * n'en a pas* : le lui faire décider serait un `toFixed(2)` déguisé, écrit une
 * fois ici et faux ailleurs.
 */
export async function lireIntervention(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<
  | (LigneIntervention & {
      readonly devise: {
        code: string;
        decimales: number;
        symbole: string | null;
      } | null;
    })
  | null
> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.intervention.findFirst({
        where: { id, ...restrictionParPersonne(contexte) },
        select: {
          ...CHAMPS_LIGNE,
          devise: { select: { code: true, decimales: true, symbole: true } },
        },
      }),
    client,
  );
}

/**
 * SUSPENDRE — avec un motif obligatoire, et l'attente de pièce si c'en est une
 * (L2-10, RG-INT-06).
 *
 * L'instant est daté dans le fuseau de l'agence (L0-08) : *le laisser saisir
 * permettrait de rajeunir une attente, et l'ancienneté est précisément ce que
 * la file mesure.*
 *
 * **OUVRE AUSSI UNE LIGNE `intervention_pause`** (50-INTERVENTIONS-2), dans
 * la MÊME transaction que le changement de statut : les deux couples décrivent
 * le même événement, jamais l'un sans l'autre. Les quatre colonnes de
 * `intervention` restent écrites — d'autres écrans les lisent —, la table
 * neuve porte l'HISTORIQUE que ces colonnes, réécrites à chaque suspension, ne
 * peuvent pas garder.
 */
export async function suspendreIntervention(
  contexte: ContexteSession,
  saisie: Suspension,
  client?: PrismaClient,
): Promise<Resultat<LigneIntervention>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id: saisie.intervention_id },
        select: {
          id: true,
          statut: true,
          agence_id: true,
          technicien_id: true,
        },
      });
      if (ligne === null) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      // D131 — même périmètre scopé que « clôturer » (voir cette fonction).
      if (
        !accesSurCetteIntervention(
          exigerContexteActif(contexte),
          "suspendre_reprendre_intervention",
          ligne.technicien_id,
        )
      ) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      const barriere = refus<LigneIntervention>(
        peutSuspendre(ligne.statut as StatutIntervention, saisie.motif),
      );
      if (barriere !== null) {
        return barriere;
      }

      const instant = await instantDeLAgence(tx, ligne.agence_id);
      const misAJour = await tx.intervention.update({
        where: { id: saisie.intervention_id },
        data: {
          statut: "suspendue",
          motif_suspension: saisie.motif,
          piece_attendue_ref: saisie.piece_attendue_ref,
          date_dispo_prevue: saisie.date_dispo_prevue,
          suspendue_le: instant,
        },
        select: CHAMPS_LIGNE,
      });
      await tx.interventionPause.create({
        data: {
          id: uuidv7(),
          societe_id: exigerSocieteActive(contexte),
          intervention_id: saisie.intervention_id,
          debut: instant,
          motif: saisie.motif,
          piece_attendue_ref: saisie.piece_attendue_ref,
          date_dispo_prevue: saisie.date_dispo_prevue,
          ouvert_par: contexte.utilisateurId,
        },
      });
      return { accepte: true, fiche: misAJour };
    },
    client,
  );
}

/**
 * REPRENDRE — l'intervention retrouve l'état que son CRÉNEAU dicte (L2-10).
 *
 * **Pas celui qu'elle avait avant la suspension** : entre-temps, le
 * planificateur a pu la déplacer ou lui retirer sa date. `statutALaCreation`
 * décide, et il décide comme à la naissance — *une seule règle pour « quel
 * statut dit ce créneau »*.
 *
 * **Ce module n'efface NI le motif NI la référence** : le déclencheur
 * `intervention_sortie_de_suspension` s'en charge, parce que les contraintes de
 * la base l'exigent et que les remettre à `null` ici serait une seconde lecture
 * du même critère.
 *
 * **FERME LA PAUSE OUVERTE** (50-INTERVENTIONS-2), dans la même transaction —
 * voir `suspendreIntervention`. Il ne peut en exister qu'une (l'index partiel
 * de la migration le garantit) ; sa présence est un invariant de ce module,
 * pas un cas à traiter en silence.
 */
export async function reprendreIntervention(
  contexte: ContexteSession,
  saisie: Reprise,
  client?: PrismaClient,
): Promise<Resultat<LigneIntervention>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id: saisie.intervention_id },
        select: {
          id: true,
          statut: true,
          date_planifiee: true,
          creneau_debut: true,
          technicien_id: true,
          agence_id: true,
        },
      });
      if (ligne === null) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      // D131 — même périmètre scopé que « clôturer » (voir cette fonction).
      if (
        !accesSurCetteIntervention(
          exigerContexteActif(contexte),
          "suspendre_reprendre_intervention",
          ligne.technicien_id,
        )
      ) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      const barriere = refus<LigneIntervention>(
        peutReprendre(ligne.statut as StatutIntervention),
      );
      if (barriere !== null) {
        return barriere;
      }

      const misAJour = await tx.intervention.update({
        where: { id: saisie.intervention_id },
        data: {
          statut: statutALaCreation(ligne.date_planifiee, ligne.creneau_debut),
        },
        select: CHAMPS_LIGNE,
      });
      const ouverte = await tx.interventionPause.findFirst({
        where: { intervention_id: saisie.intervention_id, fin: null },
        select: { id: true },
      });
      if (ouverte === null) {
        // Impossible en pratique : `peutReprendre` n'accepte que depuis
        // `suspendue`, et toute entrée dans cet état — la reprise de données
        // de la migration l'a garanti pour les lignes anciennes — ouvre une
        // pause. Une absence ici dirait que l'invariant a déjà été rompu.
        throw new Error(
          `Intervention ${saisie.intervention_id} suspendue sans pause ` +
            "ouverte : l'invariant « une suspension ouvre une pause » est rompu.",
        );
      }
      await tx.interventionPause.update({
        where: { id: ouverte.id },
        data: {
          fin: await instantDeLAgence(tx, ligne.agence_id),
          fermee_par: contexte.utilisateurId,
        },
      });
      return { accepte: true, fiche: misAJour };
    },
    client,
  );
}

/** Une ligne de la file « en attente de pièce », avec son ancienneté. */
export type LigneEnAttenteDePiece = {
  readonly ligne: LigneIntervention;
  readonly pieceAttendueRef: string;
  readonly dateDispoPrevue: Date;
  /** Jours ENTIERS écoulés depuis la suspension, dans le fuseau de l'agence. */
  readonly ancienneteJours: number;
  /** La date de disponibilité est-elle DÉPASSÉE au jour civil fourni ? */
  readonly horizonDepasse: boolean;
};

/**
 * LA FILE « EN ATTENTE DE PIÈCE » (L2-10).
 *
 * **L'instant courant est un PARAMÈTRE, jamais une lecture** — même règle que
 * `lib/vgp/information.ts` et `lib/demandes/accuse.ts`, et pour la même raison :
 * lu ici, il rendrait un scénario vert parce que l'horloge a bougé. L'appelant,
 * qui connaît le fuseau de l'agence, le fournit.
 *
 * **DEUX PARAMÈTRES DATÉS, ET ILS NE SE CONFONDENT PAS (DATES-1).**
 * `maintenant` est un INSTANT : `ancienneteJours` mesure des jours ENTIERS
 * réellement écoulés depuis `suspendue_le` (un `timestamptz`), et le tronquer
 * à minuit sous-compterait jusqu'à un jour entier. `aujourdHui` est une date
 * CIVILE (l'instant courant, ramené à minuit UTC dans le fuseau de
 * l'appelant) : `date_dispo_prevue` est une `@db.Date`, et la comparer à
 * l'instant brut faisait tomber `horizonDepasse` à `true` dès que l'horloge
 * dépassait minuit UTC — une pièce due AUJOURD'HUI se voyait déjà en retard.
 *
 * **L'ORDRE est celui de l'ANCIENNETÉ**, de la plus vieille à la plus récente :
 * *c'est la question que la file pose* — qui attend depuis le plus longtemps.
 *
 * Aucun filtre de société n'est écrit ici : on lit sous le contexte cloisonné,
 * la forme « parc » décide, et une comparaison au-dessus serait une seconde
 * lecture du même critère.
 */
export async function enAttenteDePiece(
  contexte: ContexteSession,
  maintenant: Date,
  aujourdHui: Date,
  client?: PrismaClient,
): Promise<readonly LigneEnAttenteDePiece[]> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const lignes = await tx.intervention.findMany({
        where: { piece_attendue_ref: { not: null } },
        orderBy: [{ suspendue_le: "asc" }],
        select: CHAMPS_LIGNE,
      });
      return lignes.flatMap((ligne) => {
        // Les contraintes de la base garantissent le trio ; le typage, lui, ne
        // le sait pas. On ÉCARTE plutôt que d'affirmer — *une ligne qui aurait
        // échappé aux contraintes ne doit pas devenir une ancienneté fausse.*
        if (
          ligne.piece_attendue_ref === null ||
          ligne.date_dispo_prevue === null ||
          ligne.suspendue_le === null
        ) {
          return [];
        }
        return [
          {
            ligne,
            pieceAttendueRef: ligne.piece_attendue_ref,
            dateDispoPrevue: ligne.date_dispo_prevue,
            ancienneteJours: joursEcoules(ligne.suspendue_le, maintenant),
            horizonDepasse:
              ligne.date_dispo_prevue.getTime() < aujourdHui.getTime(),
          },
        ];
      });
    },
    client,
  );
}

/**
 * Jours ENTIERS écoulés entre deux instants.
 *
 * **Des jours d'horloge, et non des jours ouvrés** : l'attente d'une pièce ne
 * s'interrompt pas le week-end — *le fournisseur ne livre pas le samedi, mais
 * la pièce n'arrive pas non plus.* C'est l'inverse du compteur d'accusé de
 * réception (D13), et la différence est délibérée : là, on mesure une réactivité
 * humaine ; ici, un délai subi.
 */
function joursEcoules(depuis: Date, jusqua: Date): number {
  const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.floor((jusqua.getTime() - depuis.getTime()) / MS_PAR_JOUR),
  );
}

/**
 * LES INTERVENTIONS D'UN CLIENT, PAGE PAR PAGE (écran client, 14/09/2026 —
 * paginée depuis HISTORIQUE-CLIENT-1, 23/09/2026).
 *
 * *« C'est très exactement ce pour quoi un directeur d'exploitation ouvre une
 * fiche client. »* — l'arbitrage du 14/09/2026. La fiche montrait douze lignes
 * et aucun moyen d'atteindre la treizième : la base porte 1751 interventions
 * d'archive, et un client comme SPEEDY ou CALEBAM en porte plus qu'une page
 * n'en montre — la pagination remplace la troncature muette.
 *
 * **Elle vit ICI et non dans `lib/clients/`**, et c'est la parade du §9
 * (01/09) : `CHAMPS_LIGNE` dit ce qu'est une ligne d'intervention, et une
 * seconde sélection écrite dans le module client aurait divergé de celle-ci au
 * premier champ ajouté — sans que rien ne les confronte.
 *
 * **L'ordre est celui de la RÉCENCE, et son critère est écrit plutôt que
 * supposé.** `date_planifiee` est nulle sur toute la file d'attente : trier par
 * elle seule rangerait ces lignes-là dans un ordre que PostgreSQL choisit, ce
 * qui est exactement la faute de L3-03. L'`id` ferme donc l'ordre — un UUID v7
 * porte l'horodatage de création sur ses bits de poids fort (I10), et il est
 * total. **`nulls: "last"` referme le même point que sur `listerInterventions`
 * (`lib/interventions/depot.ts`) : un `ORDER BY date_planifiee DESC` nu place
 * les `NULL` en TÊTE sous PostgreSQL, ce qui aurait rempli chaque page de file
 * d'attente et repoussé les vraies dernières interventions hors d'atteinte.**
 *
 * **`limite` borne la PAGE, `page` la déplace — toutes deux refusées avant
 * toute requête si elles ne sont pas des entiers strictement positifs**,
 * comme `dernieresInterventionsDuSite` : Prisma lit un `skip` négatif comme
 * un décalage vers l'arrière, ce qui rendrait une page antérieure sous un
 * numéro de page qui prétend avancer.
 *
 * **Le `client_id` n'est PAS un cloisonnement, c'est un SUJET.** Le
 * cloisonnement est prononcé par la politique de forme « parc » (D84) ; ce
 * `where` dit de quel client on parle. *Les confondre ferait croire qu'on peut
 * se passer de l'un ou de l'autre* — un client d'une autre société rend zéro
 * ligne parce que la politique l'a décidé, pas parce que cette clause l'a filtré.
 */
export async function dernieresInterventionsDuClient(
  contexte: ContexteSession,
  clientId: string,
  limite: number,
  page = 1,
  client?: PrismaClient,
): Promise<readonly LignePlanning[]> {
  if (!Number.isInteger(limite) || limite <= 0) {
    throw new Error(
      `dernieresInterventionsDuClient : la limite doit être un entier strictement positif, reçu ${String(limite)}`,
    );
  }
  if (!Number.isInteger(page) || page <= 0) {
    throw new Error(
      `dernieresInterventionsDuClient : la page doit être un entier strictement positif, reçu ${String(page)}`,
    );
  }
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.intervention.findMany({
        where: { client_id: clientId },
        select: {
          ...CHAMPS_LIGNE,
          client: { select: { raison_sociale: true } },
          site: { select: { libelle: true } },
        },
        orderBy: [
          { date_planifiee: { sort: "desc", nulls: "last" } },
          { id: "desc" },
        ],
        skip: (page - 1) * limite,
        take: limite,
      }),
    client,
  );
}

/**
 * LE TOTAL DES INTERVENTIONS D'UN CLIENT — le compte que pagine
 * `dernieresInterventionsDuClient`, et rien d'autre (HISTORIQUE-CLIENT-1).
 *
 * **Même `where`, jamais un second critère** : un total qui compterait
 * autrement que ce qu'il pagine est la faute nommée par le directeur
 * d'exploitation le 16/09 sur `/clients` (AT-07) — « 50 clients » sous une
 * liste qui en comptait 619. Ici comme là, `client_id` est un SUJET, pas un
 * cloisonnement ; la politique de forme « parc » (D84) décide seule.
 */
export async function compterInterventionsDuClient(
  contexte: ContexteSession,
  clientId: string,
  client?: PrismaClient,
): Promise<number> {
  return avecContexteApplicatif(
    contexte,
    (tx) => tx.intervention.count({ where: { client_id: clientId } }),
    client,
  );
}

/**
 * LES STATUTS « FERMÉS », ÉCRITS UNE FOIS (FICHE-360-1).
 *
 * Aucune règle de gestion ne nomme « ouverte »/« fermée » — ce n'est qu'un
 * compteur d'affichage, sur la synthèse en tête des fiches client et site,
 * jamais une décision qui change ce qu'un client paie ou une préséance de
 * synchronisation (I5, `docs/cahier-des-charges.md` chapitre 10). Le
 * regroupement retenu suit celui déjà écrit dans `prisma/schema.prisma` pour
 * I5 : `annulee`, `cloturee`, `terminee` sont les trois états qui ferment le
 * cycle de vie d'une intervention ; les cinq autres (`a_planifier`,
 * `planifiee`, `affectee`, `en_cours`, `suspendue`) restent « ouvertes ».
 * **Condition de réouverture** : si le chapitre 10 ou `docs/arbitrages.md`
 * nomme un jour ce regroupement autrement, cette constante s'aligne dessus.
 */
const STATUTS_INTERVENTION_FERMES: readonly StatutIntervention[] = [
  "terminee",
  "cloturee",
  "annulee",
];

/**
 * COMBIEN D'INTERVENTIONS OUVERTES POUR CE CLIENT (FICHE-360-1) — la synthèse
 * en tête de la fiche, jamais une seconde écriture du critère de pagination
 * (`compterInterventionsDuClient`, qui compte TOUT, ouvert ou non).
 *
 * `clientId` est un SUJET, pas un cloisonnement : la politique de forme
 * « parc » décide seule (D84), comme partout ailleurs dans ce fichier.
 */
export async function interventionsOuvertesDuClient(
  contexte: ContexteSession,
  clientId: string,
  client?: PrismaClient,
): Promise<number> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.intervention.count({
        where: {
          client_id: clientId,
          statut: { notIn: [...STATUTS_INTERVENTION_FERMES] },
        },
      }),
    client,
  );
}

/** LE MÊME COMPTE, POUR UN SITE (FICHE-360-1) — même raison, même forme. */
export async function interventionsOuvertesDuSite(
  contexte: ContexteSession,
  siteId: string,
  client?: PrismaClient,
): Promise<number> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.intervention.count({
        where: {
          site_id: siteId,
          statut: { notIn: [...STATUTS_INTERVENTION_FERMES] },
        },
      }),
    client,
  );
}

/**
 * LES DERNIÈRES INTERVENTIONS D'UN SITE (fiche site, HISTORIQUE-SITE-1).
 *
 * *« Qu'est-ce qu'on a déjà fait chez ce client, à cet endroit ? »* — c'est la
 * question qu'on se pose AVANT de planifier une intervention, et la fiche du
 * site était muette : la base porte 1751 interventions d'archive reprises le
 * 22/09/2026, rattachées à des sites, et l'écran où on les cherche n'en lisait
 * aucune. C'est le lot qui transforme l'import en outil.
 *
 * **Même maison, même sélection que `dernieresInterventionsDuClient`**, et pour
 * la même raison (§9, 01/09) : `CHAMPS_LIGNE` dit ce qu'est une ligne. Ni le
 * client ni le site ne sont joints — la fiche les connaît déjà, ils sont son
 * titre et son sous-titre.
 *
 * **Bornée CÔTÉ BASE, jamais par un `slice` après coup.** C'est la forme de
 * `teteDeLHistorique` (PARC-1) : un `take` dans la requête, et une borne
 * refusée avant toute requête si elle n'est pas un entier strictement positif
 * — Prisma lit un `take` négatif comme « depuis la fin », ce qui rendrait les
 * plus ANCIENNES sous le titre « dernières interventions » sans qu'aucune
 * ligne ne manque ni ne rougisse.
 *
 * **Le même ordre que `listerInterventions`, `nulls: "last"` compris.** La
 * récence par `date_planifiee`, puis l'`id` parce qu'un UUID v7 porte
 * l'horodatage de création (I10) et que la file d'attente n'a pas de date ; et
 * la file d'attente EN BAS, parce qu'un `ORDER BY date_planifiee DESC` nu la
 * placerait en TÊTE sous PostgreSQL — la faute est mesurée et documentée
 * ci-dessous, sur `listerInterventions`. Sur une lecture BORNÉE elle serait
 * pire : douze lignes sans date rempliraient la borne et les vraies dernières
 * ne seraient jamais rendues.
 *
 * **`limite` est une BORNE D'AFFICHAGE, jamais un cloisonnement**, et
 * **`site_id` est un SUJET** : le cloisonnement est prononcé par la politique
 * de forme « parc » (D84). Un site d'une autre société rend zéro ligne parce
 * que la politique l'a décidé, pas parce que cette clause l'a filtré. L'écran
 * ÉCRIT sa borne à côté du tableau plutôt que de laisser croire qu'il montre
 * tout.
 */
export async function dernieresInterventionsDuSite(
  contexte: ContexteSession,
  siteId: string,
  limite: number,
  client?: PrismaClient,
): Promise<readonly LigneIntervention[]> {
  if (!Number.isInteger(limite) || limite <= 0) {
    throw new Error(
      `dernieresInterventionsDuSite : la limite doit être un entier strictement positif, reçu ${String(limite)}`,
    );
  }
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.intervention.findMany({
        where: { site_id: siteId },
        select: CHAMPS_LIGNE,
        orderBy: [
          { date_planifiee: { sort: "desc", nulls: "last" } },
          { id: "desc" },
        ],
        take: limite,
      }),
    client,
  );
}

/**
 * LA LISTE DES INTERVENTIONS DE LA SOCIÉTÉ (écran `/interventions`, N-01).
 *
 * **Même sélection que `dernieresInterventionsDuClient`, mais PAS le même
 * ordre — et l'écart est mesuré, pas supposé.** Un `ORDER BY date_planifiee
 * DESC` nu place les `NULL` en TÊTE sous PostgreSQL : *mesuré sur la première
 * capture d'écran de ce ticket*, la file d'attente entière — chaque ligne
 * sans date — flottait au-dessus de toute intervention réellement datée, sur
 * un écran dont le sous-titre affirme « la plus récente en tête ». C'est
 * l'espèce du §9 (09/09) : un défaut invisible à toute assertion et évident
 * sur une image, parce que « en tête » est une propriété de ce que l'œil
 * rencontre, pas d'une valeur qu'on interroge.
 *
 * `nulls: "last"` referme ce point précis : les lignes datées restent triées
 * par récence, la file d'attente redescend en bloc, triée par `id` comme dans
 * `dernieresInterventionsDuClient` — même second critère, pour la même
 * raison, sur une file dont aucune ligne n'a de date à départager autrement.
 *
 * **`limite` est une BORNE D'AFFICHAGE, jamais un cloisonnement** — comme dans
 * `dernieresInterventionsDuClient`. L'écran l'écrit à côté du tableau plutôt
 * que de laisser croire qu'il montre tout : le parc de démonstration porte
 * assez de lignes pour que « tout » n'ait pas de sens à l'écran.
 *
 * **Aucune comparaison de société n'est écrite ici** : la politique de forme
 * « parc » décide, et une clause écrite au-dessus serait la seconde lecture
 * qui vieillit sans rougir pendant que la vraie continue de mordre.
 *
 * ## LA RECHERCHE ET LA PAGINATION (AT-07, 17/09/2026)
 *
 * `limite` a disparu du paramètre : c'est désormais `LIMITE_RECHERCHE_PAR_DEFAUT`
 * qui borne CHAQUE PAGE, et `skip` avance dans le registre FILTRÉ. **Une seule
 * écriture du critère** — `filtreDesInterventions` — sert `listerInterventions`
 * (la page) et `compterInterventions` (le total de la pagination), comme
 * `filtreDeRecherche` le fait déjà pour les clients et les sites (§9, 01/09).
 */
/**
 * LA RÉFÉRENCE AFFICHÉE, ANALYSÉE POUR LA RECHERCHE (AT-07 bis, 18/09/2026).
 *
 * `referenceAffichee` (`app/(back-office)/interventions/presentation.ts`)
 * compose « INT-00312 » depuis `numero`, ou « Local-XXXXXX » depuis les six
 * derniers caractères de l'`id` — et ni l'une ni l'autre n'est une colonne
 * que Prisma peut comparer telle quelle.
 *
 * **CETTE FONCTION NE RÉSOUT QUE LA MOITIÉ « `numero` », ET C'EST ÉCRIT
 * PLUTÔT QUE TU.** `id` est `@db.Uuid` : le filtre que Prisma génère pour ce
 * type (`UuidFilter`) ne porte NI `contains` NI `startsWith` — seulement
 * l'égalité, l'appartenance et l'ordre —, *mesuré en tentant l'inverse : TS
 * refuse `id: { contains: … }` à la compilation.* Une correspondance sur les
 * six caractères de `Local-XXXXXX` demanderait soit du SQL brut, que le
 * stack imposé interdit hors migrations et politiques RLS (CLAUDE.md §2),
 * soit un filtrage côté application qui romprait `compterLeParc` — pagination
 * et total devraient alors lire des populations différentes. Aucune des deux
 * voies n'est le geste de ce ticket : la moitié « `Local-XXXXXX` » reste un
 * écart nommé, pas silencieux.
 *
 * **`Local-XXXXXX` N'EST PAS RECONNU COMME UN NUMÉRO SERVEUR (D-08, revue
 * Codex de #236).** Le paragraphe précédent documente la moitié non couverte
 * — chercher SUR les six caractères de l'`id` ; celui-ci referme un trou
 * voisin, plus étroit : avant ce correctif, un texte de la forme
 * « Local-123456 » voyait son préfixe retiré comme celui d'« INT-123456 » et
 * devenait une recherche `numero = 123456`, qui pouvait ramener une fiche
 * SANS AUCUN RAPPORT — exactement ce que le paragraphe ci-dessus dit non
 * supporté. Seul le préfixe `INT-` (insensible à la casse) est donc reconnu
 * comme un numéro serveur ; un texte qui commence par `Local-` rend `null`
 * sans être analysé plus loin, quel que soit ce qui suit.
 *
 * **BORNÉ À L'`Int` SIGNÉ 32 BITS QUE PRISMA IMPOSE À `numero` (D-08).** Un
 * texte numérique hors bornes (`9999999999`) partait tel quel en filtre
 * d'égalité vers Prisma, qui le refuse à l'exécution — `/interventions`
 * rendait alors une ERREUR SERVEUR sur une recherche qui aurait dû rendre une
 * liste vide, comme n'importe quel numéro absent.
 *
 * `nettoye` retire le préfixe (« INT- », insensible à la casse) et toute
 * ponctuation. `Number("00312")` vaut `312`, si bien que les zéros de tête de
 * la forme affichée n'ont rien à retirer en plus.
 */
/**
 * La borne haute de l'`Int` signé 32 bits (2^31 − 1) que PostgreSQL et Prisma
 * imposent à la colonne `numero` — au-delà, la base refuse le filtre plutôt
 * que de rendre une liste vide (D-08).
 */
const NUMERO_MAXIMUM = 2147483647;

function numeroDeReference(texte: string): number | null {
  if (/^local-/i.test(texte)) {
    return null;
  }
  const nettoye = texte.replace(/^int-/i, "").replace(/[^a-z0-9]/gi, "");
  if (!/^\d+$/.test(nettoye)) {
    return null;
  }
  const valeur = Number(nettoye);
  return valeur <= NUMERO_MAXIMUM ? valeur : null;
}

/**
 * L'ONGLET, EN CRITÈRE PRISMA (52-REGISTRE-1) — `null` hors de la liste
 * fermée signifie « aucun onglet », jamais « aucune ligne ».
 *
 * `aujourdhui` rend `{}` quand `aujourdhui` (la borne du jour) n'est pas
 * fournie : `listerInterventions`/`compterInterventions` ne la calculent que
 * lorsque cette vue est active — même économie que `sans_duree_a_venir`.
 *
 * **PRIVÉE, comme `filtreDesInterventions` qui la compose** : ni l'une ni
 * l'autre n'a d'appelant hors de ce fichier, et R3-12
 * (`tests/unit/gardiens/chemins-de-depot.test.ts`) refuse qu'une fonction de
 * dépôt EXPORTÉE reste sans chemin depuis `app/` — l'exporter pour sa seule
 * épreuve serait exactement l'exception que ce gardien existe pour refuser.
 * Son critère est donc éprouvé là où il est ATTEINT : sous la vraie table,
 * par `tests/isolation/ecran-intervention.test.ts`, à travers
 * `listerInterventions`/`compterInterventions`/`compterParVue` — les trois
 * réellement exportées et réellement appelées depuis `/interventions`.
 */
function criteresVue(
  vue: VueRegistre | null,
  aujourdhui: { readonly debut: Date; readonly fin: Date } | null,
): Prisma.InterventionWhereInput {
  switch (vue) {
    case null:
      return {};
    case "a_planifier":
      return { statut: "a_planifier" };
    case "aujourdhui":
      return aujourdhui === null
        ? {}
        : { date_planifiee: { gte: aujourdhui.debut, lt: aujourdhui.fin } };
    case "en_cours":
      return { statut: "en_cours" };
    case "bloquees":
      return { statut: "suspendue" };
    case "a_controler":
      return { statut: "terminee" };
    case "historique":
      return { statut: { in: ["cloturee", "annulee"] } };
  }
}

/**
 * LE CRITÈRE DU REGISTRE — un `AND` de fragments INDÉPENDANTS, jamais un
 * objet à plat (52-REGISTRE-1).
 *
 * **Pourquoi ce changement de forme** : `vue` et le filtre `statut` du
 * formulaire portent tous deux, potentiellement, une clé `statut` — et
 * `vue`/`sans_duree_a_venir` peuvent tous deux porter `date_planifiee`. Un
 * objet à plat où chaque fragment s'étale par `...` ferait du DERNIER
 * fragment écrit le seul qui compte : le filtre du formulaire disparaîtrait
 * SANS AVERTISSEMENT dès qu'un onglet serait actif — exactement le défaut que
 * le §9 (01/09) nomme, « deux lectures d'un même critère divergent en
 * silence ». Un `AND` compose les fragments plutôt que de les superposer :
 * deux conditions contradictoires sur `statut` rendent alors zéro ligne, au
 * lieu que l'une masque l'autre.
 */
function filtreDesInterventions(
  criteres: RechercheInterventions,
  debutDuJour: Date | null = null,
): Prisma.InterventionWhereInput {
  const fragments: Prisma.InterventionWhereInput[] = [];

  if (criteres.texte !== null) {
    fragments.push({
      OR: [
        {
          client: {
            raison_sociale: {
              contains: criteres.texte,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        {
          site: {
            libelle: {
              contains: criteres.texte,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        ...(() => {
          const numero = numeroDeReference(criteres.texte);
          return numero === null ? [] : [{ numero }];
        })(),
      ],
    });
  }
  fragments.push(filtreClientActif(criteres.inclure_clients_inactifs));
  if (criteres.agence_id !== null) {
    fragments.push({ agence_id: criteres.agence_id });
  }
  if (criteres.type !== null) {
    fragments.push({ type: criteres.type });
  }
  if (criteres.statut !== null) {
    fragments.push({ statut: criteres.statut });
  }
  if (criteres.du !== null || criteres.au !== null) {
    fragments.push({
      date_planifiee: {
        ...(criteres.du === null ? {} : { gte: criteres.du }),
        ...(criteres.au === null ? {} : { lte: criteres.au }),
      },
    });
  }
  // LE LIEN DE LA TUILE « INTERVENTIONS SANS DURÉE » (AFFICHAGE-MATERIEL-1)
  // — le MÊME critère que `compterInterventionsSansDuree`, jamais une
  // seconde forme (§9, 01/09).
  if (criteres.sans_duree_a_venir && debutDuJour !== null) {
    fragments.push(criteresSansDureeAVenir(debutDuJour));
  }
  const vueFragment = criteresVue(
    criteres.vue,
    debutDuJour === null
      ? null
      : { debut: debutDuJour, fin: finDuJour(debutDuJour) },
  );
  if (Object.keys(vueFragment).length > 0) {
    fragments.push(vueFragment);
  }

  return fragments.length === 0 ? {} : { AND: fragments };
}

export async function listerInterventions(
  contexte: ContexteSession,
  criteres: RechercheInterventions,
  client?: PrismaClient,
): Promise<readonly LignePlanning[]> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const debutDuJour =
        criteres.sans_duree_a_venir || criteres.vue === "aujourdhui"
          ? await debutDuJourSociete(tx, contexte)
          : null;
      return tx.intervention.findMany({
        where: filtreDesInterventions(criteres, debutDuJour),
        select: {
          ...CHAMPS_LIGNE,
          client: { select: { raison_sociale: true } },
          site: { select: { libelle: true } },
        },
        orderBy: [
          { date_planifiee: { sort: "desc", nulls: "last" } },
          { id: "desc" },
        ],
        skip: (criteres.page - 1) * LIMITE_RECHERCHE_PAR_DEFAUT,
        take: LIMITE_RECHERCHE_PAR_DEFAUT,
      });
    },
    client,
  );
}

/**
 * COMBIEN D'INTERVENTIONS CORRESPONDENT À LA RECHERCHE — jamais le compte de
 * la page (AT-07). La MÊME `filtreDesInterventions` que `listerInterventions`.
 */
export async function compterInterventions(
  contexte: ContexteSession,
  criteres: RechercheInterventions,
  client?: PrismaClient,
): Promise<number> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const debutDuJour =
        criteres.sans_duree_a_venir || criteres.vue === "aujourdhui"
          ? await debutDuJourSociete(tx, contexte)
          : null;
      return tx.intervention.count({
        where: filtreDesInterventions(criteres, debutDuJour),
      });
    },
    client,
  );
}

/**
 * LE COMPTEUR DE CHAQUE ONGLET — LES MÊMES AUTRES FILTRES QUE LA LISTE,
 * L'ONGLET LUI-MÊME EXCLU (52-REGISTRE-1).
 *
 * Le registre pose SIX onglets et un septième, « Toutes » — `vue === null` —
 * qui rend le comportement d'avant ce ticket. Chacun doit porter un compte
 * qui dit EXACTEMENT ce qu'il liste, calculé avec le même `filtreDesInterventions`
 * que `listerInterventions`/`compterInterventions`, moins l'onglet actif : un
 * compte qui appliquerait l'onglet SÉLECTIONNÉ à tous les onglets montrerait
 * le même chiffre partout.
 *
 * **AU PLUS DEUX REQUÊTES AGRÉGÉES**, jamais une par onglet : un `groupBy`
 * sur `statut` couvre `a_planifier`, `en_cours`, `bloquees`, `a_controler` et
 * `historique` d'un coup — et « Toutes » s'en déduit, par la SOMME des
 * groupes, sans troisième requête — un `count` séparé couvre `aujourdhui`,
 * qui ne porte sur aucun statut.
 */
export type ComptesRegistre = {
  readonly toutes: number;
  readonly a_planifier: number;
  readonly aujourdhui: number;
  readonly en_cours: number;
  readonly bloquees: number;
  readonly a_controler: number;
  readonly historique: number;
};

export async function compterParVue(
  contexte: ContexteSession,
  criteres: RechercheInterventions,
  client?: PrismaClient,
): Promise<ComptesRegistre> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const debutDuJour = await debutDuJourSociete(tx, contexte);
      const baseFiltre = filtreDesInterventions(
        { ...criteres, vue: null },
        debutDuJour,
      );

      const [parStatut, aujourdhui] = await Promise.all([
        tx.intervention.groupBy({
          by: ["statut"],
          where: baseFiltre,
          _count: { _all: true },
        }),
        tx.intervention.count({
          where: {
            ...baseFiltre,
            date_planifiee: { gte: debutDuJour, lt: finDuJour(debutDuJour) },
          },
        }),
      ]);

      const compteStatut = (statut: StatutIntervention): number =>
        parStatut.find((ligne) => ligne.statut === statut)?._count._all ?? 0;

      return {
        toutes: parStatut.reduce((somme, ligne) => somme + ligne._count._all, 0),
        a_planifier: compteStatut("a_planifier"),
        aujourdhui,
        en_cours: compteStatut("en_cours"),
        bloquees: compteStatut("suspendue"),
        a_controler: compteStatut("terminee"),
        historique: compteStatut("cloturee") + compteStatut("annulee"),
      };
    },
    client,
  );
}
