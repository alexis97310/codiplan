import {
  type AssujettissementVgp,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

import { ASSUJETTISSEMENT, resoudreAssujettissement } from "./assujettissement";
import { etatDeLInformation, type EtatInformation } from "./information";
import { dernieresInformations } from "./verification";

/**
 * CE QUE LE REGISTRE DES VGP DONNE À LIRE (L9-02, L9-03 ; D88).
 *
 * ## LA PHRASE QUI GOUVERNE CE FICHIER, ET ELLE EST D'EXPLOITATION
 *
 * *Les VGP sont commandées par les CLIENTS, pas par CODIMA.* CODIPLAN
 * n'apprend leur résultat que si on le lui dit. **Ce module ne rend donc aucun
 * verdict** : il rapporte ce qu'on nous a dit, et la date à laquelle on nous
 * l'a dit. Le seul calcul est une date, et il vient de `information.ts`.
 *
 * ## `derniereInformation` EST REMPLIE DEPUIS LE 12/09/2026 AU SOIR (D114)
 *
 * ~~Aucune table ne porte une information reçue d'un organisme.~~ **`vgp_verification`
 * la porte** — machine, date, organisme, référence du rapport, document
 * facultatif, et **d'où vient l'information**. La phrase d'origine est barrée
 * et non effacée : *elle a gouverné ce module, et ce qui a été écrit un jour se
 * relit.*
 *
 * **Ce qui n'a pas changé, et c'est le plus important** : le registre affiche
 * toujours *« sans information depuis X »* pour une machine dont personne n'a
 * rien dit, et **jamais « à jour »**. *Le danger que D88 nomme est qu'un
 * registre à moitié rempli ressemble à un registre complet* — remplir la
 * colonne ne change rien à cette règle, elle lui donne seulement de quoi être
 * vraie dans les deux sens.
 *
 * **La date qui compte est celle de la VÉRIFICATION, jamais celle de la
 * saisie.** Une vignette relevée aujourd'hui peut porter une vérification d'il
 * y a onze mois, et c'est elle qui décide de la prochaine échéance.
 *
 * ## AUCUNE COMPARAISON DE SOCIÉTÉ N'EST ÉCRITE ICI
 *
 * Tout passe par `avecContexteApplicatif` : `machine` est de forme « parc »,
 * `modele_materiel` et `famille_materiel` de forme « ascendance » (D93). Une
 * comparaison écrite au-dessus serait une seconde lecture d'un même critère
 * (§9, 01/09).
 */

/** Une ligne du registre : la machine, ce qu'elle doit, et ce qu'on en sait. */
export type LigneDeRegistre = {
  readonly id: string;
  readonly numero: number | null;
  readonly numero_serie: string;
  readonly client: string;
  readonly site: string;
  readonly modele: string;
  readonly famille: string;
  /** D'où vient l'assujettissement, et d'où vient sa périodicité (D56). */
  readonly assujettissement: AssujettissementVgp;
  readonly origine: "machine" | "famille";
  readonly periodiciteMois: number | null;
  readonly referenceTexte: string | null;
  readonly originePeriodicite: "modele" | "famille" | null;
  /** Ce qu'on nous a dit, et quand. JAMAIS un verdict de conformité. */
  readonly information: EtatInformation;
};

const CHAMPS_REGISTRE = {
  id: true,
  numero: true,
  numero_serie: true,
  date_mise_en_service: true,
  vgp_exception: true,
  client: { select: { raison_sociale: true } },
  site: { select: { libelle: true } },
  modele: {
    select: {
      reference: true,
      vgp_periodicite_mois: true,
      vgp_reference_texte: true,
      famille: {
        select: {
          libelle: true,
          assujettissement_vgp: true,
          vgp_periodicite_mois: true,
          vgp_reference_texte: true,
        },
      },
    },
  },
} as const;

/**
 * LE REGISTRE, sous le contexte courant.
 *
 * `aujourdHui` est **reçu**, jamais lu ici — c'est la règle de `information.ts`
 * et de D85 : *une fonction qui lit l'horloge rend un test vert parce que
 * l'heure a bougé, non parce que la règle tient.* L'appelant le tient de
 * `lib/calendar`, avec le fuseau de la société.
 *
 * `limite` borne ce qui est RENDU, jamais ce qui est cloisonné — la même borne
 * d'affichage que `listerLeParc`, et pour la même raison.
 *
 * **CETTE BORNE NE DOIT JAMAIS SERVIR AUSSI AU RÉSUMÉ (KPI)** — même faute
 * que corrigée pour `/parc` (AT-07, `LIMITE_RECHERCHE_MAXIMALE` de
 * `lib/machines/saisie.ts`). Mesuré le 23/09/2026 en production (TABLEAU-1) :
 * `/vgp` composait `resumerLeRegistre` à partir des lignes déjà bornées pour
 * L'AFFICHAGE de la table, et une société dont le parc dépassait cette borne
 * voyait son KPI « en retard » sous-compté par rapport à la tuile du tableau
 * de bord (`compterAPrevoir`, qui lit tout le parc cloisonné, sans aucun
 * plafond). L'appelant doit donc lire cette fonction avec un plafond
 * généreux pour son RÉSUMÉ, et ne prendre que les premières lignes du
 * résultat pour son AFFICHAGE — jamais l'inverse. Aucune constante n'est
 * posée ICI : ce plafond n'est pas une règle de ce module, c'est un choix de
 * lecture de son appelant (voir `LIGNES_RESUME_MAXIMALES`,
 * `app/(back-office)/vgp/page.tsx`).
 */
export async function listerLeRegistre(
  contexte: ContexteSession,
  aujourdHui: Date,
  limite: number,
): Promise<readonly LigneDeRegistre[]> {
  // CE QU'ON NOUS A DIT, par machine (D114). Une SEULE lecture groupée plutôt
  // qu'une par ligne : *sous 190 ms de latence vers Sydney, un aller-retour par
  // machine se mesure* (§9, 23/08).
  const recues = await dernieresInformations(contexte);
  const machines = await avecContexteApplicatif(contexte, (tx) =>
    tx.machine.findMany({
      select: CHAMPS_REGISTRE,
      // LES SOUMISES D'ABORD n'est PAS triable en base : l'assujettissement se
      // RÉSOUT en cascade (famille, puis exception de machine), et trier sur la
      // seule colonne `vgp_exception` mettrait en tête les exceptions plutôt
      // que les soumises. L'ordre rendu est donc stable et neutre ; c'est
      // l'écran qui groupe.
      orderBy: [{ numero: "desc" }, { numero_serie: "asc" }],
      take: limite,
    }),
  );

  return machines.map((machine) =>
    ligneDuRegistre(machine, recues, aujourdHui),
  );
}

type MachineDuRegistre = Prisma.MachineGetPayload<{
  select: typeof CHAMPS_REGISTRE;
}>;

/**
 * LA CASCADE D'UNE MACHINE, FACTORISÉE — `listerLeRegistre` et
 * `compterAPrevoir` en sont les deux seuls appelants, et c'est délibéré :
 * `resoudreAssujettissement` puis `etatDeLInformation` ne s'écrivent qu'ici,
 * jamais recopiés (§9, 01/09) — le même principe qui gouverne déjà
 * `informationDeLaMachine` plus bas.
 */
function ligneDuRegistre(
  machine: MachineDuRegistre,
  recues: ReadonlyMap<string, Date>,
  aujourdHui: Date,
): LigneDeRegistre {
  const famille = machine.modele.famille;
  const resolu = resoudreAssujettissement({
    famille: {
      assujettissement: famille.assujettissement_vgp,
      periodiciteMois: famille.vgp_periodicite_mois,
      referenceTexte: famille.vgp_reference_texte,
    },
    modele: {
      periodiciteMois: machine.modele.vgp_periodicite_mois,
      referenceTexte: machine.modele.vgp_reference_texte,
    },
    machine: { exception: machine.vgp_exception },
  });
  return {
    id: machine.id,
    numero: machine.numero,
    numero_serie: machine.numero_serie,
    client: machine.client.raison_sociale,
    site: machine.site.libelle,
    modele: machine.modele.reference,
    famille: famille.libelle,
    assujettissement: resolu.valeur,
    origine: resolu.origine,
    periodiciteMois: resolu.periodiciteMois,
    referenceTexte: resolu.referenceTexte,
    originePeriodicite: resolu.originePeriodicite,
    information: etatDeLInformation({
      assujettissement: resolu.valeur,
      periodiciteMois: resolu.periodiciteMois,
      // CE QU'ON NOUS A DIT, ou `null` si personne n'a rien dit. *Le second
      // cas reste le cas ordinaire d'un registre qu'on commence à remplir*,
      // et c'est lui que « sans information depuis X » décrit.
      derniereInformation: recues.get(machine.id) ?? null,
      depuis: machine.date_mise_en_service,
      aujourdHui,
    }),
  };
}

/**
 * ── LES DEUX VOIES DATÉES, ÉCRITES UNE FOIS (VGP-2) ────────────────────────
 *
 * `joursAvantEcheance` est une SOUSTRACTION déjà faite par
 * `etatDeLInformation`, sur une échéance DÉDUITE d'une périodicité saisie ;
 * son signe dit si la date est passée. Ces deux prédicats ne font que LIRE ce
 * signe — et ils sont écrits ici UNE fois, parce que `compterAPrevoir` (le
 * tableau de bord), `resumerLeRegistre` (les KPI de `/vgp`) et le badge de
 * chaque ligne du registre lisent tous le MÊME critère : trois écritures
 * divergeraient en silence (§9, 01/09). Mesuré le 22/09/2026 : le compteur
 * d'accueil écartait `< 0` quand le résumé du registre le comptait — le même
 * retard, compté à un écran et tu à l'autre.
 *
 * **Aucun des deux n'est un verdict (D88).** « Dépassée » dit qu'une date
 * déclarée est passée ; il ne dit ni « non conforme », ni « en retard » — la
 * même distinction que `vgp.echeance.depassee` porte au dictionnaire.
 *
 * **Aucune tolérance** : une échéance est passée ou elle ne l'est pas. La
 * seule borne est l'HORIZON de « à venir », et il est REÇU de l'appelant —
 * jamais écrit ici (L9-05, gardé par `aucune-duree-en-dur.test.ts`).
 *
 * **La civile, jamais l'instant (DATES-1)** : `aujourdHui` est la civile du
 * jour de la société (`instantDuJour(jourDe(local))`), posée à minuit UTC
 * comme la colonne `@db.Date` dont l'échéance dérive. Une échéance du JOUR
 * MÊME vaut donc 0 jour — À VENIR, jamais dépassée, y compris à 23 h 59 heure
 * de Nouméa. C'est l'appelant qui le garantit ; ce fichier n'a pas d'horloge.
 */
export function echeanceDepassee(etat: EtatInformation): boolean {
  return (
    etat.etat === "information_recue" &&
    etat.joursAvantEcheance !== null &&
    etat.joursAvantEcheance < 0
  );
}

/** L'échéance déduite tombe entre aujourd'hui (compris) et l'horizon (compris). */
export function echeanceAVenirSous(
  etat: EtatInformation,
  horizonJours: number,
): boolean {
  return (
    etat.etat === "information_recue" &&
    etat.joursAvantEcheance !== null &&
    etat.joursAvantEcheance >= 0 &&
    etat.joursAvantEcheance <= horizonJours
  );
}

/**
 * LES TROIS VOIES DU COMPTE D'ACCUEIL (VGP-2) — et ce sont trois VALEURS
 * NOMMÉES, jamais un seul chiffre.
 *
 * `depassees` et `aVenir` sont datées ; `sansInformation` ne l'est pas — on ne
 * sait pas quand ces machines sont dues, et l'inventer serait une durée
 * (L9-05). Ce qui n'y figure PAS, délibérément : les machines informées dont
 * l'échéance est au-delà de l'horizon (rien à prévoir), et celles informées
 * SANS rythme déclaré (rien à déduire — `vgp.echeance.sans_rythme`). Ni
 * l'une ni l'autre n'est une quatrième voie : ce sont des machines dont le
 * registre a quelque chose à dire, et pas l'accueil.
 */
export type CompteAPrevoir = {
  /** Échéance déduite déjà passée — une date, jamais un verdict. */
  readonly depassees: number;
  /** Échéance déduite entre aujourd'hui et l'horizon, compris. */
  readonly aVenir: number;
  /** Soumises, et personne ne nous a jamais rien dit. */
  readonly sansInformation: number;
};

/**
 * La fonction PURE des deux voies datées — testée sans base, sur des lignes
 * déjà lues (`tests/unit/vgp/voies-a-prevoir.test.ts`). Elle ne prend que
 * `information` : ce qu'elle lit, jamais la ligne entière.
 */
export function compterLesEcheances(
  lignes: readonly { readonly information: EtatInformation }[],
  horizonJours: number,
): Pick<CompteAPrevoir, "depassees" | "aVenir"> {
  let depassees = 0;
  let aVenir = 0;
  for (const ligne of lignes) {
    if (echeanceDepassee(ligne.information)) {
      depassees += 1;
    } else if (echeanceAVenirSous(ligne.information, horizonJours)) {
      aVenir += 1;
    }
  }
  return { depassees, aVenir };
}

/**
 * LE PRÉDICAT « SOUMISE » DU `where` — la cascade de `resoudreAssujettissement`
 * RETROUVÉE en SQL, jamais réécrite (lot PERF, point 2) : l'exception de la
 * machine prime si elle est posée, sinon la famille décide. Écrit UNE fois
 * pour les deux lectures de `compterAPrevoir` ; sa fidélité à la cascade est
 * prouvée par énumération dans `tests/unit/perf/vgp-compter-a-prevoir.test.ts`
 * et `tests/unit/vgp/voies-a-prevoir.test.ts`.
 */
const WHERE_SOUMISE: Prisma.MachineWhereInput = {
  OR: [
    { vgp_exception: ASSUJETTISSEMENT.soumis },
    {
      vgp_exception: null,
      modele: {
        famille: { assujettissement_vgp: ASSUJETTISSEMENT.soumis },
      },
    },
  ],
};

/**
 * CE QUE L'ACCUEIL COMPTE DU REGISTRE (AV-10, tableau de bord, D125 ; VGP-2)
 * — le KPI « VGP à prévoir » de `dashboard()`, en TROIS voies.
 *
 * ## CE QUI A CHANGÉ LE 22/09/2026 (VGP-2), ET POURQUOI
 *
 * ~~Elle ne compte QUE l'état `information_recue`~~ et, jusqu'à ce lot,
 * seulement les échéances `>= 0` : **une machine dont l'échéance était
 * passée depuis six mois comptait ZÉRO** — le même zéro qu'un parc sans rien
 * à prévoir. La doctrine du dépôt était pourtant écrite deux fois (AV-14 :
 * *un texte nommé, jamais un zéro qui se lit comme une mesure* ;
 * `information.ts` : `sans_information` est une valeur, jamais une absence).
 * Le retard est le même défaut ; il devient une VOIE NOMMÉE, `depassees`.
 *
 * `sansInformation` est la troisième voie : les machines soumises dont
 * personne n'a rien dit. Elle n'a pas de date, et elle n'en invente pas
 * (L9-05) — mais l'accueil la NOMME, parce qu'un compte qui la tairait
 * laisserait lire « rien à prévoir » d'un parc jamais vérifié (D88 : *un
 * registre à moitié rempli ressemble à un registre complet*).
 *
 * **Aucune pagination** : contrairement à `listerLeRegistre`, ce compte porte
 * sur tout le parc cloisonné — un KPI qui ne compterait qu'une page tronquée
 * mentirait par omission (même raison que `compterLeParc` face à
 * `rechercherLeParc`).
 *
 * ## LA LECTURE EST ÉTROITE, ET C'EST RETROUVER EN SQL CE QUE LE FILTRE
 *    REJETTE DÉJÀ EN MÉMOIRE (lot PERF, mesuré sur 4fead41 ; tenu par VGP-2)
 *
 * Les deux voies DATÉES ne concernent que l'état `information_recue` — deux
 * conditions NÉCESSAIRES en découlent, et ni l'une ni l'autre n'invente de
 * règle : elles REDISENT en `where` ce que `ligneDuRegistre` rejetterait de
 * toute façon en mémoire.
 *
 *   1. **Une machine sans aucune vérification reçue est `sans_information`,
 *      jamais `information_recue`** (`etatDeLInformation`) : le `where` se
 *      borne donc aux identifiants que `recues` porte déjà — la MÊME lecture
 *      groupée que `listerLeRegistre` fait, jamais une seconde écriture du
 *      critère « a-t-on reçu quelque chose ? ».
 *   2. **Une machine dont l'assujettissement résolu n'est pas `soumis` est
 *      `hors_registre`**, jamais comptée — `WHERE_SOUMISE`, ci-dessus.
 *
 * **La voie SANS INFORMATION est un `count`, sans lecture des lignes** — et
 * c'est le point 1 lu dans l'autre sens : une machine soumise qui n'est PAS
 * dans `recues` est `sans_information` par la seule cascade, sans qu'aucune
 * date n'entre dans le verdict. Il n'y a donc AUCUN calcul par ligne à
 * préserver ici, seulement la cascade que `WHERE_SOUMISE` retrouve — prouvé
 * pour chaque combinaison possible (`voies-a-prevoir.test.ts`).
 *
 * **Ce que ce filtre NE fait PAS** : il ne touche pas à la périodicité ni à
 * l'échéance — `ajouterMois` (le report de mois, avec son ajustement de fin
 * de mois) reste un calcul TypeScript, jamais traduit en SQL, précisément
 * parce qu'une traduction divergente mentirait en silence. Le filtre
 * resserre la POPULATION lue, jamais le calcul appliqué à chaque ligne
 * restante — `compterLesEcheances` lit chaque ligne restante, l'une après
 * l'autre, par les mêmes deux fonctions que le registre.
 */
export async function compterAPrevoir(
  contexte: ContexteSession,
  aujourdHui: Date,
  horizonJours: number,
): Promise<CompteAPrevoir> {
  const recues = await dernieresInformations(contexte);
  const machineIds = [...recues.keys()];
  const [informees, sansInformation] = await avecContexteApplicatif(
    contexte,
    (tx) =>
      Promise.all([
        // AUCUNE MACHINE N'A JAMAIS ÉTÉ INFORMÉE : la liste est vide sans lire
        // `machine` — voir le point 1 ci-dessus.
        machineIds.length === 0
          ? Promise.resolve([] as MachineDuRegistre[])
          : tx.machine.findMany({
              select: CHAMPS_REGISTRE,
              where: { id: { in: machineIds }, ...WHERE_SOUMISE },
            }),
        tx.machine.count({
          where: { id: { notIn: machineIds }, ...WHERE_SOUMISE },
        }),
      ]),
  );
  const lignes = informees.map((machine) =>
    ligneDuRegistre(machine, recues, aujourdHui),
  );
  return { ...compterLesEcheances(lignes, horizonJours), sansInformation };
}

const CHAMPS_INFORMATION_MACHINE = {
  date_mise_en_service: true,
  vgp_exception: true,
  modele: {
    select: {
      vgp_periodicite_mois: true,
      vgp_reference_texte: true,
      famille: {
        select: {
          assujettissement_vgp: true,
          vgp_periodicite_mois: true,
          vgp_reference_texte: true,
        },
      },
    },
  },
} as const;

/**
 * CE QUE LE REGISTRE SAIT D'UNE SEULE MACHINE — la lecture qu'une FICHE
 * demande (N-11), à côté de `listerLeRegistre` qui lit tout le parc.
 *
 * **Elle ne réécrit AUCUNE règle réglementaire** : `resoudreAssujettissement`
 * (la cascade famille → modèle → machine) et `etatDeLInformation` (la date
 * déduite) sont les MÊMES fonctions que `listerLeRegistre` appelle — une
 * seconde écriture de la même cascade sur une seule ligne diverge en silence
 * dès que l'une des deux change (§9, 01/09). Seule la lecture SQL diffère :
 * une machine, jamais tout le parc.
 *
 * `null` dit « cette machine n'existe pas sous ce contexte » — la même
 * absence que `lireMachine` rend déjà, et pour la même raison : une fiche
 * hors périmètre et une fiche inexistante ne se distinguent pas (D22, D35).
 */
export async function informationDeLaMachine(
  contexte: ContexteSession,
  machineId: string,
  aujourdHui: Date,
  client?: PrismaClient,
): Promise<EtatInformation | null> {
  const machine = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.machine.findUnique({
        where: { id: machineId },
        select: CHAMPS_INFORMATION_MACHINE,
      }),
    client,
  );
  if (machine === null) {
    return null;
  }
  // LA DERNIÈRE VÉRIFICATION DE CETTE MACHINE, ET D'ELLE SEULE — même
  // critère que `dernieresInformations` (la date de VÉRIFICATION, jamais
  // celle de la saisie), borné à une ligne plutôt qu'au groupement de tout
  // le parc que la fiche n'a pas besoin de lire.
  const derniere = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.vgpVerification.findFirst({
        where: { machine_id: machineId },
        orderBy: [{ date_verification: "desc" }, { id: "desc" }],
        select: { date_verification: true },
      }),
    client,
  );

  const famille = machine.modele.famille;
  const resolu = resoudreAssujettissement({
    famille: {
      assujettissement: famille.assujettissement_vgp,
      periodiciteMois: famille.vgp_periodicite_mois,
      referenceTexte: famille.vgp_reference_texte,
    },
    modele: {
      periodiciteMois: machine.modele.vgp_periodicite_mois,
      referenceTexte: machine.modele.vgp_reference_texte,
    },
    machine: { exception: machine.vgp_exception },
  });

  return etatDeLInformation({
    assujettissement: resolu.valeur,
    periodiciteMois: resolu.periodiciteMois,
    derniereInformation: derniere?.date_verification ?? null,
    depuis: machine.date_mise_en_service,
    aujourdHui,
  });
}

/**
 * LE RÉSUMÉ (KPI) DU REGISTRE — trois comptes tirés de `joursAvantEcheance`
 * et `etat`, et AUCUN n'est un verdict (D125, L9-02, D88).
 *
 * ## POURQUOI CE FICHIER LE PORTE, ET PAS L'ÉCRAN
 *
 * *Les VGP sont commandées par les clients, CODIPLAN ne rend jamais de
 * verdict de conformité.* `codiplan-maquette-complete.html` dessine un
 * bandeau de quatre KPI pour `/vgp` — dont un « Conformes » — et D125 fait foi
 * sur cette DISPOSITION (quatre cases en bandeau), jamais sur les règles de
 * gestion du chapitre 10 (D125, « Ce que D125 ne touche pas »). Le compte
 * correspondant ici est celui des machines dont on a REÇU une information —
 * ni plus, ni moins que ce que le registre sait dire (`information.ts`).
 *
 * ## AUCUNE FENÊTRE DE JOURS N'EST INVENTÉE ICI (L9-05, §8 du CLAUDE.md)
 *
 * La maquette écrit « à faire sous 30 jours » — un délai que rien, ni le
 * chapitre 10, ni `docs/arbitrages.md`, n'a fixé : *l'inventer serait
 * exactement la faute que §8 interdit, « ne jamais inventer un délai par
 * défaut »,* et le gardien `tests/unit/vgp/aucune-duree-en-dur.test.ts`
 * refuse tout littéral numérique dans ce dossier pour cette même raison. Le
 * premier compte ne fixe donc AUCUNE fenêtre : il dit « une échéance
 * DÉCLARÉE existe et n'est pas encore passée » — un fait, jamais un seuil.
 *
 * ## « À VENIR » ET « DÉPASSÉE » NE SONT PAS DES VERDICTS
 *
 * Les deux comptes lisent `joursAvantEcheance`, une SOUSTRACTION déjà faite
 * par `etatDeLInformation` sur une date DÉCLARÉE (périodicité saisie). Dire
 * qu'une échéance est dépassée n'est pas dire qu'une machine est en faute —
 * exactement la même distinction que `vgp.echeance.depassee` porte déjà dans
 * le dictionnaire.
 */
export type ResumeDuRegistre = {
  /** Échéance déclarée, connue et pas encore passée — aucune fenêtre de jours. */
  readonly echeanceAVenir: number;
  /** Échéance déclarée déjà passée — une date, jamais un jugement. */
  readonly echeanceDepassee: number;
  /** Machines pour lesquelles une information a été reçue, quelle que soit son échéance. */
  readonly informationRecue: number;
  readonly total: number;
};

/**
 * La fonction PURE — testée pour elle-même, sans base (`resumerLeParc` de
 * `lib/machines/depot.ts` dans sa forme).
 *
 * **Elle prend les lignes déjà lues par `listerLeRegistre`**, jamais une
 * seconde requête plafonnée séparément : ce registre n'est pas paginé
 * (contrairement au parc, AT-07), et une deuxième lecture du même critère
 * sous une borne différente divergerait en silence de ce que le tableau
 * montre (§9, 01/09).
 */
export function resumerLeRegistre(
  lignes: readonly LigneDeRegistre[],
): ResumeDuRegistre {
  let echeanceAVenir = 0;
  let depassees = 0;
  let informationRecue = 0;
  for (const ligne of lignes) {
    if (ligne.information.etat !== "information_recue") {
      continue;
    }
    informationRecue += 1;
    // LE MÊME PRÉDICAT QUE L'ACCUEIL (VGP-2) — `echeanceDepassee`, écrit une
    // fois. Sans rythme déclaré, l'échéance est nulle : ni l'une ni l'autre.
    if (echeanceDepassee(ligne.information)) {
      depassees += 1;
    } else if (ligne.information.joursAvantEcheance !== null) {
      echeanceAVenir += 1;
    }
  }
  return {
    echeanceAVenir,
    echeanceDepassee: depassees,
    informationRecue,
    total: lignes.length,
  };
}

/** Une famille que personne n'a encore examinée — la moitié détective de L9-03. */
export type FamilleADeterminer = {
  readonly id: string;
  readonly libelle: string;
  /** Combien de machines attendent cette décision. Jamais un verdict : un compte. */
  readonly machines: number;
};

/**
 * LES FAMILLES « À DÉTERMINER », ET C'EST LA MOITIÉ QUI FAIT TENIR L'AUTRE.
 *
 * *Les « à déterminer » apparaissent dans une liste visible : c'est la moitié
 * détective du couple, et sans elle la troisième valeur ne sert à rien* (D88
 * §3). Une famille qui naît `a_determiner` et que personne ne voit jamais est
 * exactement la case décochée qu'on a refusée — *une garantie qu'on ne peut pas
 * constater après coup est une intention* (§9, 30/08).
 *
 * **Le compte des machines accompagne chaque famille**, parce qu'une décision
 * se priorise : *« ponts élévateurs, 47 machines »* se traite avant *« outillage
 * pneumatique, 1 machine »*. Ce n'est pas un verdict, c'est un dénombrement.
 */
export async function famillesADeterminer(
  contexte: ContexteSession,
): Promise<readonly FamilleADeterminer[]> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const familles = await tx.familleMateriel.findMany({
      where: { assujettissement_vgp: "a_determiner" },
      select: {
        id: true,
        libelle: true,
        modeles: { select: { _count: { select: { machines: true } } } },
      },
      orderBy: [{ libelle: "asc" }, { id: "asc" }],
    });
    return familles.map((famille) => ({
      id: famille.id,
      libelle: famille.libelle,
      machines: famille.modeles.reduce(
        (total, modele) => total + modele._count.machines,
        0,
      ),
    }));
  });
}
