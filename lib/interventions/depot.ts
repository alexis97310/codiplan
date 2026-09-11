import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { fuseauDeLAgence } from "@/lib/calendar/agence";
import {
  instantAMinutes,
  jourDe,
  maintenant,
  versLocal,
  type Fuseau,
} from "@/lib/calendar/fuseau";
import { lireParametrage } from "@/lib/calendar/parametrage";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import {
  verdictAffectation,
  type VerdictAffectation,
} from "@/lib/habilitations/affectation";
import { montant, type Montant } from "@/lib/money";
import { forfaitRetenu } from "@/lib/tarification/forfaits";
import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";
import {
  valoriserIntervention,
  valoriserTempsPasse,
  type ModeDeValorisation,
} from "@/lib/tarification/valorisation";

import {
  peutAffecter,
  peutAnnuler,
  peutCloturer,
  peutDeplacer,
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
import type {
  Annulation,
  Cloture,
  Creation,
  Deplacement,
  Reprise,
  StatutIntervention,
  Suspension,
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
  mode_valorisation: true,
  forfait_deplacement_id: true,
  temps_reel_min: true,
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
async function instantDeLAgence(
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
 * CRÉER une intervention depuis le planning.
 *
 * Trois choses sont DÉDUITES et jamais saisies : l'agence (du site), le forfait
 * de déplacement (de la zone du site), et le statut (du créneau).
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
        select: { id: true, agence_id: true, zone_geo: true },
      });
      if (site === null) {
        return { accepte: false, cle: "intervention.refus.lieu_inconnu" };
      }
      if (site.agence_id === null) {
        return {
          accepte: false,
          cle: "intervention.refus.lieu_sans_rattachement",
        };
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
          statut: statutALaCreation(
            saisie.date_planifiee,
            saisie.creneau_debut,
          ),
          date_planifiee: saisie.date_planifiee,
          creneau_debut: saisie.creneau_debut,
          creneau_fin: saisie.creneau_fin,
          duree_estimee_min: saisie.duree_estimee_min,
          technicien_id: saisie.technicien_id,
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

      const verdict = await verdictHabilitationSous(
        tx,
        ligne.site_id,
        technicienId,
        ligne.date_planifiee ?? (await instantDeLAgence(tx, ligne.agence_id)),
      );
      if (verdict.bloquee) {
        return { accepte: false, cle: "intervention.refus.habilitation" };
      }

      const misAJour = await tx.intervention.update({
        where: { id: interventionId },
        data: { technicien_id: technicienId },
        select: CHAMPS_LIGNE,
      });
      return {
        accepte: true,
        fiche: misAJour,
        avertissements: clesDAvertissement(verdict),
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
function demandeDeDeplacement(
  saisie: Deplacement,
  fuseau: string,
): PoseDemandee {
  const jour =
    saisie.date_planifiee === null
      ? null
      : {
          annee: saisie.date_planifiee.getUTCFullYear(),
          mois: saisie.date_planifiee.getUTCMonth() + 1,
          jour: saisie.date_planifiee.getUTCDate(),
        };
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
      calendrier_id: true,
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

  const parametrage =
    agence.calendrier_id === null
      ? null
      : await lireParametrage(tx, agence.calendrier_id);
  const ouverture = verdictOuverture(parametrage, demande, fuseau);
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
        select: { id: true, statut: true, agence_id: true, site_id: true },
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

      // ── LES TROIS CONTRÔLES À LA POSE (R2-19 ; RG-PLA-04 depuis L3-02) ──────
      //
      // Ils sont ICI, sous le contexte cloisonné, et PAS seulement à l'écran :
      // *une action refusée à l'écran mais acceptée par la base est un trou.*
      // Les règles elles-mêmes vivent dans `pose.ts` et dans
      // `lib/habilitations/affectation.ts`, qui ne lisent rien.
      const pose = await verdictALaPose(
        tx,
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
        },
        select: CHAMPS_LIGNE,
      });
      return {
        accepte: true,
        fiche: misAJour,
        avertissements: pose.avertissements,
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
async function montantDuForfait(
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
  /** `null` quand le total ne se calcule pas — jamais zéro. */
  readonly totalHT: Montant | null;
  /** Clé de dictionnaire expliquant un total inconnu, ou `null`. */
  readonly motifTotalInconnu: string | null;
};

/**
 * CLÔTURER — saisir le temps réel, appliquer D83, figer le total hors taxes.
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
        },
      });
      if (ligne === null) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      const barriere = refus<ResultatCloture>(
        peutCloturer(ligne.statut as StatutIntervention, saisie.temps_reel_min),
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
        saisie.temps_reel_min,
        taux.taux,
      );

      // LE FORFAIT DE DÉPLACEMENT ENTRE DANS LE TOTAL (L2-09a, RG-INT-07, D77).
      // *Il était désigné par la ligne depuis D84 et n'entrait dans aucun total :
      // l'écran affichait « Total hors taxes » sur la main-d'œuvre seule.*
      const forfaitDeplacement = await montantDuForfait(
        tx,
        ligne.forfait_deplacement_id,
      );

      const composition = valoriserIntervention({
        mode: ligne.mode_valorisation as ModeDeValorisation,
        forfaitDeplacement,
        mainDoeuvre: valorisation.mainDoeuvre,
      });

      const misAJour = await tx.intervention.update({
        where: { id: saisie.intervention_id },
        data: {
          statut: "cloturee",
          temps_reel_min: saisie.temps_reel_min,
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
): Promise<readonly LignePlanning[]> {
  return avecContexteApplicatif(contexte, (tx) =>
    tx.intervention.findMany({
      where: {
        OR: [
          { date_planifiee: { gte: du, lte: au } },
          // La file d'attente n'a pas de date : elle est du planning quand
          // même, et c'est la ligne « À planifier / File d'attente » de
          // l'annexe D.
          { date_planifiee: null },
        ],
      },
      orderBy: [{ date_planifiee: "asc" }, { creneau_debut: "asc" }],
      select: {
        ...CHAMPS_LIGNE,
        client: { select: { raison_sociale: true } },
        site: { select: { libelle: true } },
      },
    }),
  );
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
): Promise<{
  readonly ligne: LigneIntervention;
  readonly client: string | null;
  readonly lieu: string | null;
  readonly rattachement: string | null;
  readonly forfait: string | null;
  readonly devise: {
    code: string;
    decimales: number;
    symbole: string | null;
  } | null;
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
} | null> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const ligne = await tx.intervention.findFirst({
      where: { id },
      select: {
        ...CHAMPS_LIGNE,
        client: { select: { raison_sociale: true } },
        site: { select: { libelle: true } },
        agence: { select: { libelle: true } },
        forfait: { select: { libelle: true } },
        devise: { select: { code: true, decimales: true, symbole: true } },
      },
    });
    if (ligne === null) {
      return null;
    }
    const { client, site, agence, forfait, devise, ...brute } = ligne;

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
    if (brute.temps_reel_min !== null && brute.temps_reel_min > 0) {
      const instant = await instantDeLAgence(tx, brute.agence_id);
      const taux = await tauxEnVigueur(tx, brute.date_planifiee ?? instant);
      if (taux !== null) {
        const v = valoriserTempsPasse(brute.temps_reel_min, taux.taux);
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
        });
        valorisation = {
          minutesReelles: v.minutesReelles,
          minutesArrondies: v.minutesArrondies,
          minutesFacturees: v.minutesFacturees,
          plancherApplique: v.plancherApplique,
          tauxHoraire: v.tauxHoraire,
          mainDoeuvre: composition.mainDoeuvre,
          forfaitDeplacement: composition.forfaitDeplacement,
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
      devise,
      valorisation,
      habilitations,
    };
  });
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
  readonly totalHT: Montant | null;
  readonly motifTotalInconnu: string | null;
};

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
  return avecContexteApplicatif(contexte, (tx) =>
    tx.intervention.findFirst({
      where: { id },
      select: {
        ...CHAMPS_LIGNE,
        devise: { select: { code: true, decimales: true, symbole: true } },
      },
    }),
  );
}

/**
 * SUSPENDRE — avec un motif obligatoire, et l'attente de pièce si c'en est une
 * (L2-10, RG-INT-06).
 *
 * L'instant est daté dans le fuseau de l'agence (L0-08) : *le laisser saisir
 * permettrait de rajeunir une attente, et l'ancienneté est précisément ce que
 * la file mesure.*
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
        select: { id: true, statut: true, agence_id: true },
      });
      if (ligne === null) {
        return { accepte: false, cle: "intervention.refus.inconnue" };
      }
      const barriere = refus<LigneIntervention>(
        peutSuspendre(ligne.statut as StatutIntervention, saisie.motif),
      );
      if (barriere !== null) {
        return barriere;
      }

      const misAJour = await tx.intervention.update({
        where: { id: saisie.intervention_id },
        data: {
          statut: "suspendue",
          motif_suspension: saisie.motif,
          piece_attendue_ref: saisie.piece_attendue_ref,
          date_dispo_prevue: saisie.date_dispo_prevue,
          suspendue_le: await instantDeLAgence(tx, ligne.agence_id),
        },
        select: CHAMPS_LIGNE,
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
        },
      });
      if (ligne === null) {
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
  /** La date de disponibilité est-elle DÉPASSÉE à l'instant fourni ? */
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
 * **L'ordre est celui de l'ANCIENNETÉ**, de la plus vieille à la plus récente :
 * *c'est la question que la file pose* — qui attend depuis le plus longtemps.
 *
 * Aucun filtre de société n'est écrit ici : on lit sous le contexte cloisonné,
 * la forme « parc » décide, et une comparaison au-dessus serait une seconde
 * lecture du même critère.
 */
export async function enAttenteDePiece(
  contexte: ContexteSession,
  maintenant: Date,
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
              ligne.date_dispo_prevue.getTime() < maintenant.getTime(),
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
