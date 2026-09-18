import { type AssujettissementVgp, type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

import { resoudreAssujettissement } from "./assujettissement";
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

  return machines.map((machine) => {
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
  });
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
