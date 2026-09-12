import { type AssujettissementVgp } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

import { resoudreAssujettissement } from "./assujettissement";
import { etatDeLInformation, type EtatInformation } from "./information";

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
 * ## RIEN NE REMPLIT ENCORE `derniereInformation`, ET C'EST ÉCRIT
 *
 * Aucune table ne porte une information reçue d'un organisme : le rapport de
 * VGP est un **document de classe `client`** (D88 §9, au sens de D87), et
 * **rien ne le distingue encore d'un autre document** — `document` porte une
 * classe et une cible, pas une nature. Tant que L9-09 et L9-10 ne sont pas
 * écrits, `derniereInformation` vaut `null` pour **toutes** les machines, et le
 * registre affiche donc « sans information depuis X » partout.
 *
 * **Ce n'est pas un défaut du registre : c'est le registre qui dit vrai.** Le
 * danger que D88 nomme est l'inverse — *un registre à moitié rempli qui
 * ressemble à un registre complet.* Un écran qui afficherait « à jour » faute
 * de savoir serait exactement ce qu'on refuse. *Le jour où une nature de
 * document existe, seule la ligne qui compose `derniereInformation` change ici
 * ; ni le type rendu, ni l'écran.*
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
        // VOIR L'EN-TÊTE : rien ne remplit encore cette valeur, et l'écrire
        // `null` est la SEULE réponse honnête. Une date inventée ferait
        // afficher une échéance que personne n'a promise.
        derniereInformation: null,
        depuis: machine.date_mise_en_service,
        aujourdHui,
      }),
    };
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
