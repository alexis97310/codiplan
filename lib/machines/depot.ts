import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import { comparerAlphanumerique } from "@/lib/tri/collation";

import { engendrerJetonQr } from "./qr";
import {
  LIMITE_RECHERCHE_MAXIMALE,
  LIMITE_RECHERCHE_PAR_DEFAUT,
  type RechercheParc,
  type SaisieMachine,
} from "./saisie";

/**
 * LA LECTURE DU PARC MACHINES (R2-21 ; D6, D10, D22, I10).
 *
 * ## Ce module lit, il ne compare rien
 *
 * Toute lecture passe par `avecContexteApplicatif`, donc sous le contexte
 * cloisonné : la politique de `machine` est de forme « parc » — société **et**
 * `app.client_id` **et** `app.perimetre_sites` —, et rien n'est recomparé
 * au-dessus. *Une comparaison de société écrite ici serait une seconde lecture
 * d'un même critère, qui diverge en silence* (§9, 01/09).
 *
 * C'est ce qui fait que le même appel sert l'écran interne et le portail : un
 * compte de portail ne voit que le parc de son client et de son périmètre, sans
 * qu'aucune ligne de ce fichier ne le sache.
 *
 * ## CE QU'IL NE REND PAS, ET POURQUOI C'EST ÉCRIT
 *
 * La maquette montre un parc à huit colonnes, dont **« Compteur »** et
 * **« Contrat »**. Ni l'un ni l'autre n'existe : il n'y a pas de table de
 * relevés, et les contrats sont au lot 4. *Afficher une colonne vide dirait que
 * la donnée manque ; afficher un zéro dirait qu'elle vaut zéro.* Les deux
 * colonnes sont donc ABSENTES, et l'écart est écrit dans
 * `lib/machines/ecarts-maquette.ts` plutôt que tu — c'est la leçon de R2-13,
 * qui reste bloqué pour exactement cette raison. Le même fichier tient
 * l'écart symétrique du KPI « Sous contrat ».
 */

/**
 * Ce qu'une ligne de parc porte à l'écran.
 *
 * `modele.marque` et `date_vente` ENTRENT ICI depuis D126 appliqué à `/parc`
 * (N-12, 18/09/2026) — Alexis : *« Parc machine : il faut afficher
 * principalement la famille du matériel, la marque, la référence, le numéro
 * de série, l'année. »* `lib/machines/ecarts-maquette.ts` portait jusqu'ici la
 * note inverse (« `date_vente` ENTRE dans `CHAMPS_FICHE`, jamais dans
 * `CHAMPS_PARC` ») : elle datait de N-11, avant que D126 soit étendu à la
 * ligne du parc, et `CHAMPS_FICHE` ci-dessous en hérite désormais par le
 * simple spread plutôt que de les redemander.
 */
export const CHAMPS_PARC = {
  id: true,
  numero: true,
  numero_serie: true,
  reference_interne: true,
  statut: true,
  criticite: true,
  complet: true,
  localisation: true,
  date_mise_en_service: true,
  date_vente: true,
  // LE QUATRIÈME KPI EN A BESOIN (AT-04) : « Garantie expirant à moins de
  // 90 jours » se lit sur cette colonne, réelle et déjà en base — à la
  // différence du compteur d'usage ou du contrat, qu'aucune table ne porte.
  garantie_fin: true,
  modele: {
    select: {
      reference: true,
      marque: true,
      famille: { select: { libelle: true } },
    },
  },
  // `client_id` VOYAGE AVEC LE LIBELLÉ depuis le 14/09/2026 : la colonne
  // « Client » du parc est devenue un LIEN vers la fiche, et un libellé sans
  // son identifiant ne mène nulle part. *Le lire par une seconde requête aurait
  // fait autant d'allers-retours que de lignes* (§9, 23/08).
  client_id: true,
  client: { select: { raison_sociale: true } },
  // `agence` VOYAGE DEPUIS LE SITE (N-10, D125) — l'aperçu du maître-détail
  // montre « Agence CODIMA », et c'est un FAIT RÉEL : `site.agence_id`
  // existe depuis D56 (une machine n'a pas d'agence propre, elle hérite de
  // celle du site où elle se trouve). Ce n'est pas un écart, juste un champ
  // de plus dans un select qui en portait déjà six.
  site: {
    select: {
      libelle: true,
      commune: true,
      agence: { select: { libelle: true } },
    },
  },
} as const;

export type LigneDeParc = Prisma.MachineGetPayload<{
  select: typeof CHAMPS_PARC;
}>;

/**
 * Les statuts qui sortent une machine du parc ACTIF (chapitre 11.2) : elle a
 * été remplacée, mise au rebut, ou absorbée par une fusion de doublons (D28).
 * Les trois autres — `en_service`, `en_panne`, `arretee` — désignent une
 * machine toujours physiquement présente chez un client.
 */
const STATUTS_HORS_PARC_ACTIF = new Set([
  "remplacee",
  "ferraillee",
  "fusionnee",
]);

/** 90 jours (chapitre 11) — la fenêtre du KPI « garantie expirant ». */
const JOURS_GARANTIE = 90;
const MILLISECONDES_PAR_JOUR = 24 * 60 * 60 * 1000;

/**
 * LE COMPTE DE CE QUE L'ÉCRAN MONTRE, par statut et par complétude.
 *
 * **Il est calculé sur les lignes RENDUES, jamais par une seconde requête.**
 * Deux lectures d'un même critère divergent en silence, et un bandeau qui
 * compterait autrement que le tableau qu'il coiffe est la pire forme de cette
 * divergence : *le lecteur voit les deux chiffres côte à côte et ne sait pas
 * lequel croire.* Les trois KPI réels du bandeau (AT-04) suivent donc la même
 * règle que `incompletes` : ils dérivent des lignes rendues, jamais d'un
 * second aller-retour à la base.
 */
export type ResumeDuParc = {
  readonly total: number;
  readonly parStatut: Readonly<Record<string, number>>;
  /** Les fiches à compléter — numéro de série illisible ou absent (D6). */
  readonly incompletes: number;
  /** Hors des statuts terminaux — remplacée, ferraillée, fusionnée. */
  readonly actives: number;
  readonly enPanneOuArretees: number;
  /** `garantie_fin` dans les 90 jours à venir, bornes comprises. */
  readonly garantieExpirant90j: number;
};

/**
 * CE QUE `resumerLeParc` LIT, ET RIEN DE PLUS (mesuré, lot PERF) — `statut`,
 * `complet`, `garantie_fin`. Le type reste un `Pick` de `LigneDeParc`, jamais
 * un type recopié : toute fiche complète (`LigneDeParc`) le satisfait déjà,
 * et un champ ajouté un jour au calcul se réclamera de la même source.
 */
type LigneResumeParc = Pick<LigneDeParc, "statut" | "complet" | "garantie_fin">;

export function resumerLeParc(
  lignes: readonly LigneResumeParc[],
  // L'INSTANT COURANT EST UN PARAMÈTRE, jamais une lecture (D13, L0-08) —
  // sinon un test vert dirait que l'horloge a bougé.
  maintenant: Date,
): ResumeDuParc {
  const parStatut: Record<string, number> = {};
  let incompletes = 0;
  let actives = 0;
  let enPanneOuArretees = 0;
  let garantieExpirant90j = 0;
  const horizon = new Date(
    maintenant.getTime() + JOURS_GARANTIE * MILLISECONDES_PAR_JOUR,
  );
  for (const ligne of lignes) {
    parStatut[ligne.statut] = (parStatut[ligne.statut] ?? 0) + 1;
    if (!ligne.complet) {
      incompletes += 1;
    }
    if (!STATUTS_HORS_PARC_ACTIF.has(ligne.statut)) {
      actives += 1;
    }
    if (ligne.statut === "en_panne" || ligne.statut === "arretee") {
      enPanneOuArretees += 1;
    }
    if (
      ligne.garantie_fin !== null &&
      ligne.garantie_fin >= maintenant &&
      ligne.garantie_fin <= horizon
    ) {
      garantieExpirant90j += 1;
    }
  }
  return {
    total: lignes.length,
    parStatut,
    incompletes,
    actives,
    enPanneOuArretees,
    garantieExpirant90j,
  };
}

/**
 * LA RECHERCHE DU PARC (AT-07 ; étendue N-12, D126) — le texte porte sur les
 * colonnes VISIBLES à l'écran, et sur elles seules : le numéro de série, le
 * client, le lieu (site et commune), la référence du modèle — et désormais la
 * marque et la famille, que la ligne du parc affiche depuis que D126 lui est
 * appliqué (`app/(back-office)/parc/page.tsx`). Une colonne que la ligne
 * montre et sur laquelle on ne peut pas chercher est exactement le trou que ce
 * ticket referme. `qr_token` n'y entre PAS — il n'est affiché dans aucune
 * colonne du tableau, et chercher sur un champ invisible rendrait des
 * résultats que personne ne peut expliquer (voir l'écart écrit dans
 * `lib/machines/saisie.ts`, à côté de `schemaRechercheParc`).
 *
 * **Une seule écriture du critère** : `rechercherLeParc` (la page) et
 * `compterLeParc` (le total de la pagination) l'appellent tous deux, comme
 * `filtreDeRecherche` le fait déjà pour les clients (§9, 01/09).
 */
function filtreDuParc(criteres: RechercheParc): Prisma.MachineWhereInput {
  const filtreTexte: Prisma.MachineWhereInput =
    criteres.texte === null
      ? {}
      : {
          OR: [
            {
              numero_serie: {
                contains: criteres.texte,
                mode: Prisma.QueryMode.insensitive,
              },
            },
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
            {
              site: {
                commune: {
                  contains: criteres.texte,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
            {
              modele: {
                reference: {
                  contains: criteres.texte,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
            {
              modele: {
                marque: {
                  contains: criteres.texte,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
            {
              modele: {
                famille: {
                  libelle: {
                    contains: criteres.texte,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            },
          ],
        };

  // LE FILTRE DE STATUT (N-10, D125) — le `<select>` que la barre d'outils
  // câble désormais. Même forme que `filtreDeRecherche` de `lib/clients/
  // depot.ts` pour `etat` : une seule écriture du critère, partagée par la
  // liste, le compteur et le résumé.
  const filtreStatut: Prisma.MachineWhereInput =
    criteres.statut === "tous" ? {} : { statut: criteres.statut };

  // LES TROIS FILTRES COMBINABLES DE LISTES-1 (23/09/2026) — client, site,
  // famille. `client_id` et `site_id` sont des colonnes directes de
  // `machine` ; `famille_id` ne l'est pas (D6 : la famille se lit par le
  // modèle), d'où la clause imbriquée.
  const filtreClient: Prisma.MachineWhereInput =
    criteres.client_id === null ? {} : { client_id: criteres.client_id };
  const filtreSite: Prisma.MachineWhereInput =
    criteres.site_id === null ? {} : { site_id: criteres.site_id };
  const filtreFamille: Prisma.MachineWhereInput =
    criteres.famille_id === null
      ? {}
      : { modele: { famille_id: criteres.famille_id } };

  return {
    ...filtreTexte,
    ...filtreStatut,
    ...filtreClient,
    ...filtreSite,
    ...filtreFamille,
  };
}

/** Une option de filtre — un identifiant technique, un libellé lisible. */
export type OptionFiltreParc = {
  readonly id: string;
  readonly libelle: string;
};

/**
 * LES OPTIONS DES TROIS FILTRES COMBINABLES DE LISTES-1 — jamais le
 * référentiel entier : seuls les clients, sites et familles qui possèdent au
 * moins une machine dans le périmètre visible ont un sens à proposer ici,
 * exactement comme un filtre ne montre jamais une valeur qui rendrait zéro
 * résultat de façon certaine. `machines: { some: {} }` est une clause de
 * RELATION — elle ne recompare aucune société, elle porte sur des machines
 * déjà lues sous le contexte cloisonné.
 */
export async function optionsDeFiltreDuParc(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<{
  readonly clients: readonly OptionFiltreParc[];
  readonly sites: readonly OptionFiltreParc[];
  readonly familles: readonly OptionFiltreParc[];
}> {
  const [clients, sites, familles] = await avecContexteApplicatif(
    contexte,
    (tx) =>
      Promise.all([
        tx.client.findMany({
          where: { machines: { some: {} } },
          select: { id: true, raison_sociale: true },
        }),
        tx.site.findMany({
          where: { machines: { some: {} } },
          select: { id: true, libelle: true },
        }),
        tx.familleMateriel.findMany({
          where: { modeles: { some: { machines: { some: {} } } } },
          select: { id: true, libelle: true },
        }),
      ]),
    client,
  );
  return {
    clients: clients.map((c) => ({ id: c.id, libelle: c.raison_sociale })),
    sites: sites.map((s) => ({ id: s.id, libelle: s.libelle })),
    familles,
  };
}

/**
 * LE PARC LISIBLE SOUS LE CONTEXTE COURANT — une PAGE, désormais (AT-07).
 *
 * `skip`/`take` sont posés ICI, dans le dépôt : jamais un tableau entier
 * chargé puis découpé par le composant, sinon la base rend toujours tout le
 * parc filtré et la pagination n'a rien gagné.
 */
export async function rechercherLeParc(
  contexte: ContexteSession,
  criteres: RechercheParc,
  client?: PrismaClient,
): Promise<readonly LigneDeParc[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.machine.findMany({
        select: CHAMPS_PARC,
        where: filtreDuParc(criteres),
        // Les fiches INCOMPLÈTES d'abord : ce sont celles qui demandent un
        // geste, et un parc trié par date les enterrerait sous les fiches
        // saines.
        orderBy: [
          { complet: "asc" },
          { numero: "desc" },
          { numero_serie: "asc" },
        ],
        skip: (criteres.page - 1) * LIMITE_RECHERCHE_PAR_DEFAUT,
        take: LIMITE_RECHERCHE_PAR_DEFAUT,
      }),
    client,
  );
}

/**
 * COMBIEN DE FICHES CORRESPONDENT À LA RECHERCHE — jamais le compte de la
 * page (AT-07). La MÊME `filtreDuParc` que `rechercherLeParc` : un total qui
 * compterait autrement que ce qu'il pagine est la faute nommée par le
 * directeur d'exploitation le 16/09.
 */
export async function compterLeParc(
  contexte: ContexteSession,
  criteres: RechercheParc,
  client?: PrismaClient,
): Promise<number> {
  return avecContexteApplicatif(
    contexte,
    (tx) => tx.machine.count({ where: filtreDuParc(criteres) }),
    client,
  );
}

/**
 * LE RÉSUMÉ (KPI), SUR TOUTE LA RECHERCHE — PLAFONNÉE, JAMAIS SUR LA PAGE
 * (AT-07).
 *
 * **Ce que ce ticket ne pouvait pas laisser tel quel.** `resumerLeParc` compte
 * « sur les lignes rendues » (R2-21) — une règle sage tant que « rendu »
 * voulait dire « tout le parc filtré ». La pagination change ce que la page
 * rend : un bandeau qui résumerait la seule PAGE de 50 lignes dirait « 12
 * machines actives » sous un parc qui en compte 180, et personne ne pourrait
 * distinguer un vrai creux d'un artefact de pagination.
 *
 * **La fonction pure ne bouge pas** (`resumerLeParc`, testée par
 * `tests/unit/machines/parc.test.ts`) : celle-ci l'appelle avec une lecture
 * SÉPARÉE, bornée à `LIMITE_RECHERCHE_MAXIMALE` et non à la taille d'une page
 * — le même principe que `compterSansCodeExterne` assume déjà pour les
 * clients : une seconde lecture du même critère est admise, tant qu'elle
 * partage l'unique écriture du filtre (`filtreDuParc`).
 *
 * **LA SÉLECTION EST ÉTROITE, ET C'EST TOUT LE GAIN (lot PERF, mesuré sur
 * 4fead41)** : `resumerLeParc` ne lit que `statut`, `complet` et
 * `garantie_fin` (voir `LigneResumeParc`) — jamais `modele`, `client` ou
 * `site`, qui n'entrent dans AUCUN des cinq comptes du résumé. Charger
 * `CHAMPS_PARC` ici tirait donc deux jointures (modèle → famille, site →
 * agence) sur des centaines de lignes pour un résumé qui n'en use jamais un
 * seul champ. Même `where`, même `take` : le jeu de lignes compté est
 * RIGOUREUSEMENT le même, seules les colonnes lues changent — le résultat de
 * `resumerLeParc` est donc inchangé au chiffre près (gardien :
 * `tests/unit/perf/parc-resume-etroit.test.ts`).
 */
const CHAMPS_RESUME_PARC = {
  statut: true,
  complet: true,
  garantie_fin: true,
} as const;

export async function resumerLeParcFiltre(
  contexte: ContexteSession,
  criteres: RechercheParc,
  maintenant: Date,
  client?: PrismaClient,
): Promise<ResumeDuParc> {
  const lignes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.machine.findMany({
        select: CHAMPS_RESUME_PARC,
        where: filtreDuParc(criteres),
        take: LIMITE_RECHERCHE_MAXIMALE,
      }),
    client,
  );
  return resumerLeParc(lignes, maintenant);
}

/**
 * Ce qu'une FICHE de machine porte, en plus de ce qu'une ligne de parc montre.
 *
 * `date_vente` et `modele.marque` viennent désormais de `CHAMPS_PARC` par le
 * spread — D126 s'applique aux DEUX écrans depuis N-12, et redemander ici ce
 * que `CHAMPS_PARC` porte déjà serait une seconde écriture du même critère
 * (§9, 01/09). `qr_token` reste le seul ajout PROPRE à la fiche, et pour la
 * raison de PÉRIMÈTRE inverse (D71) : c'est un SECRET, et une page de liste
 * comme `/parc` en divulguerait cinquante d'un coup — il n'a donc rien à
 * faire dans `CHAMPS_PARC`, et tout à faire dans la fiche qui, seule, en a
 * besoin pour fabriquer le QR (N-11).
 */
export const CHAMPS_FICHE = {
  ...CHAMPS_PARC,
  qr_token: true,
  // **AJOUTÉ POUR LE FORMULAIRE DE CORRECTION** (AT-07 bis, 18/09/2026) :
  // `modifierMachineDans` écrit cette colonne, et sans elle
  // `FormulaireMachine` n'aurait aucun moyen de PRÉ-REMPLIR le champ — un
  // envoi la remettrait alors à `null` à chaque correction, même quand
  // personne n'y a touché. `/parc/[id]` ne l'affiche pas (D126 ne la
  // réclame pas) : elle voyage jusqu'ici sans gagner de ligne à l'écran.
  facture_origine: true,
  // `modele_id` ET `site_id` — `CHAMPS_PARC` ne porte que les OBJETS
  // (`modele`, `site`), jamais leur clé nue : la fiche en a besoin pour les
  // champs CACHÉS du formulaire de correction, qui doit soumettre les trois
  // clés que `schemaMachine` exige sans que `modifierMachineDans` les
  // écrive (voir sa note de tête). `client_id` n'a pas besoin de la même
  // addition : `CHAMPS_PARC` le porte déjà, nu, pour le lien de la colonne
  // « Client » du parc.
  modele_id: true,
  site_id: true,
} as const;

export type FicheMachine = Prisma.MachineGetPayload<{
  select: typeof CHAMPS_FICHE;
}>;

/**
 * LA FICHE D'UNE MACHINE, ou `null`.
 *
 * **Une fiche hors périmètre et une fiche inexistante rendent LA MÊME chose.**
 * Les distinguer ferait un oracle — celui-là même que D22 refuse sur le chemin
 * du QR et que D35 refuse à la connexion : *un refus a le droit d'être lisible,
 * jamais d'être informatif* (D50).
 *
 * Aucune comparaison de société n'est écrite ici : la politique de `machine`
 * est de forme « parc », et c'est elle qui prononce.
 */
export async function lireMachine(
  contexte: ContexteSession,
  id: string,
): Promise<FicheMachine | null> {
  return avecContexteApplicatif(contexte, (tx) =>
    tx.machine.findUnique({ where: { id }, select: CHAMPS_FICHE }),
  );
}

/**
 * LES LIBELLÉS D'UN ENSEMBLE DE MACHINES — pour un écran qui ne connaît que
 * leurs `id` (AT-07 bis, 18/09/2026 ; audit du domaine).
 *
 * Mesuré le 18/09/2026 : le registre des interventions (`/interventions`)
 * LIT déjà `machines` par ligne (`CHAMPS_LIGNE`, `lib/interventions/depot.ts`)
 * et ne l'affichait jamais — la colonne n'avait pas de libellé à montrer, et
 * en fabriquer un à l'écran aurait fait une seconde lecture du même critère
 * que celle-ci écrit une fois.
 *
 * **Même forme que `libellesDesSites`** (`lib/sites/depot.ts`) : une SECONDE
 * lecture, sur les identifiants qu'un premier appel a déjà rendus, jamais un
 * `include` élargi sur la première requête — celle-ci reste ce qu'elle est,
 * et ce module n'a pas à savoir qui l'appelle.
 *
 * Le libellé est `marque référence` — recopié de `titreDeLaLigne` (`/parc`),
 * jamais le numéro de série : plusieurs exemplaires du même modèle sur une
 * même intervention resteraient de toute façon indiscernables par un
 * `Set<string>` de libellés identiques, et le numéro de série d'une fiche
 * incomplète (`SN-INCONNU-…`) n'aiderait pas plus à les distinguer dans une
 * cellule de tableau dense.
 */
export async function libellesDesMachines(
  contexte: ContexteSession,
  machineIds: readonly string[],
  client?: PrismaClient,
): Promise<ReadonlyMap<string, string>> {
  const ids = [...new Set(machineIds)];
  if (ids.length === 0) {
    return new Map();
  }
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const machines = await tx.machine.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          modele: { select: { marque: true, reference: true } },
        },
      });
      return new Map(
        machines.map((machine) => [
          machine.id,
          `${machine.modele.marque} ${machine.modele.reference}`,
        ]),
      );
    },
    client,
  );
}

/**
 * LES DONNÉES BRUTES D'UN ENSEMBLE DE MACHINES — famille, marque, référence,
 * numéro de série (AFFICHAGE-MATERIEL-1, 23/09/2026).
 *
 * *Mesuré en production le 23/09/2026 : une carte de planning se lisait
 * « SIDAPS / Curatif », sans dire QUEL matériel — et la fiche d'intervention
 * ne portait ni famille ni numéro de série.* Alexis les nomme tous les deux :
 * « Pont 2 colonnes Cascos 13442 S/N 10044 ».
 *
 * **Cette fonction ne COMPOSE aucun libellé** — à la différence de
 * `libellesDesMachines` ci-dessus, dont la forme `marque référence` sert
 * déjà le registre et le bon imprimable, et que cette fonction ne remplace
 * pas. Composer « S/N » est un mot qu'un humain lit : il n'a rien à faire
 * dans ce module, qui ne lit ni dictionnaire ni écran (L0-11) — c'est
 * `lib/machines/presentation.ts` qui compose, sur les champs qu'ici on lit.
 */
export type DonneesMateriel = {
  readonly familleLibelle: string;
  readonly marque: string;
  readonly reference: string;
  readonly numeroSerie: string;
};

export async function donneesMaterielDesMachines(
  contexte: ContexteSession,
  machineIds: readonly string[],
  client?: PrismaClient,
): Promise<ReadonlyMap<string, DonneesMateriel>> {
  const ids = [...new Set(machineIds)];
  if (ids.length === 0) {
    return new Map();
  }
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const machines = await tx.machine.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          numero_serie: true,
          modele: {
            select: {
              marque: true,
              reference: true,
              famille: { select: { libelle: true } },
            },
          },
        },
      });
      return new Map(
        machines.map((machine) => [
          machine.id,
          {
            familleLibelle: machine.modele.famille.libelle,
            marque: machine.modele.marque,
            reference: machine.modele.reference,
            numeroSerie: machine.numero_serie,
          },
        ]),
      );
    },
    client,
  );
}

/** Combien de lignes le bloc « Équipements du site » de la fiche montre par page (FICHE-360-1). */
export const EQUIPEMENTS_PAR_PAGE_SITE = 50;

/** Une ligne du bloc « Équipements du site » de la fiche (FICHE-360-1). */
export type LigneEquipementSite = {
  readonly id: string;
  readonly familleLibelle: string;
  readonly marque: string;
  readonly reference: string;
  readonly numeroSerie: string;
  readonly statut: string;
};

/**
 * LES MACHINES ACTIVES D'UN SITE, PAGE PAR PAGE (FICHE-360-1).
 *
 * *« Depuis un site on ne voit pas ses machines »* — le constat qui ouvre le
 * ticket. « Actives » reprend `STATUTS_HORS_PARC_ACTIF` : une machine
 * remplacée, ferraillée ou fusionnée n'est plus physiquement sur ce site, la
 * montrer ferait croire à un parc qui n'existe plus (même critère que
 * `resumerLeParc.actives`, jamais une seconde écriture, §9 du 01/09).
 *
 * **Bornée à UN SITE**, jamais le parc entier : à cette échelle, charger les
 * lignes complètes pour les trier en JavaScript (`lib/tri/collation.ts`, la
 * collation de la base hébergée ne peut pas être mesurée à distance, voir
 * l'en-tête du fichier) reste raisonnable — à la différence de
 * `rechercherSites`, qui doit trier tout le référentiel et se limite pour
 * cela à une lecture étroite en deux passes.
 *
 * `site_id` est un SUJET, pas un cloisonnement : la politique de forme
 * « parc » décide seule (D84) — un site d'une autre société rend zéro ligne
 * parce que la politique l'a filtré, jamais parce que cette clause l'a fait.
 */
export async function equipementsActifsDuSite(
  contexte: ContexteSession,
  siteId: string,
  page: number,
  client?: PrismaClient,
): Promise<{
  readonly lignes: readonly LigneEquipementSite[];
  readonly total: number;
}> {
  const where: Prisma.MachineWhereInput = {
    site_id: siteId,
    statut: { notIn: [...STATUTS_HORS_PARC_ACTIF] },
  };
  const [total, machines] = await avecContexteApplicatif(
    contexte,
    (tx) =>
      Promise.all([
        tx.machine.count({ where }),
        tx.machine.findMany({
          where,
          select: {
            id: true,
            numero_serie: true,
            statut: true,
            modele: {
              select: {
                marque: true,
                reference: true,
                famille: { select: { libelle: true } },
              },
            },
          },
        }),
      ]),
    client,
  );
  const lignes: LigneEquipementSite[] = machines.map((machine) => ({
    id: machine.id,
    familleLibelle: machine.modele.famille.libelle,
    marque: machine.modele.marque,
    reference: machine.modele.reference,
    numeroSerie: machine.numero_serie,
    statut: machine.statut,
  }));
  // FAMILLE, MARQUE, RÉFÉRENCE, N° DE SÉRIE — l'ordre demandé (FICHE-360-1),
  // départagé de proche en proche plutôt que composé en une seule clé : une
  // clé composite mélangerait les niveaux dans la comparaison numérique de
  // `comparerAlphanumerique` (« numeric: true »), ce que ce fichier
  // n'accepte nulle part ailleurs.
  const ordonnees = [...lignes].sort(
    (a, b) =>
      comparerAlphanumerique(a.familleLibelle, b.familleLibelle) ||
      comparerAlphanumerique(a.marque, b.marque) ||
      comparerAlphanumerique(a.reference, b.reference) ||
      comparerAlphanumerique(a.numeroSerie, b.numeroSerie),
  );
  const debut = (page - 1) * EQUIPEMENTS_PAR_PAGE_SITE;
  return {
    lignes: ordonnees.slice(debut, debut + EQUIPEMENTS_PAR_PAGE_SITE),
    total,
  };
}

/**
 * COMBIEN D'ÉQUIPEMENTS ACTIFS POUR CE CLIENT, TOUS SITES CONFONDUS
 * (FICHE-360-1) — la synthèse en tête de la fiche client. Même critère
 * « actif » que `equipementsActifsDuSite` (`STATUTS_HORS_PARC_ACTIF`), un
 * SEUL `count` agrégé, jamais une boucle par site.
 */
export async function nombreEquipementsActifsDuClient(
  contexte: ContexteSession,
  clientId: string,
  client?: PrismaClient,
): Promise<number> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.machine.count({
        where: {
          client_id: clientId,
          statut: { notIn: [...STATUTS_HORS_PARC_ACTIF] },
        },
      }),
    client,
  );
}

/**
 * LES MACHINES D'UN ENSEMBLE DE SITES, PAR SITE — pour un formulaire qui
 * propose « les machines DE CE SITE », jamais le parc entier (chantier
 * INT-MACHINE 2, 20/09/2026).
 *
 * Ni `rechercherLeParc` (pagine, cherche par texte, rend `LigneDeParc`
 * complète) ni `libellesDesMachines` (résout des identifiants déjà connus) :
 * une troisième question, « quelles machines, pour quel site », posée UNE
 * fois pour que le formulaire de création (chantier 2.1, un composant client
 * qui filtre localement selon le site déjà choisi) n'ait jamais à requêter le
 * parc entier, ni à faire un aller-retour par site.
 *
 * **Bornée aux `siteIds` demandés** : la création ne propose que les sites
 * déjà lus sous le contexte (`site.findMany`), et cette fonction ne lit donc
 * jamais plus de machines que de sites déjà autorisés à s'afficher.
 */
export async function machinesDesSites(
  contexte: ContexteSession,
  siteIds: readonly string[],
  client?: PrismaClient,
): Promise<
  readonly {
    readonly id: string;
    readonly siteId: string;
    readonly libelle: string;
  }[]
> {
  const ids = [...new Set(siteIds)];
  if (ids.length === 0) {
    return [];
  }
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const machines = await tx.machine.findMany({
        where: { site_id: { in: ids } },
        select: {
          id: true,
          site_id: true,
          numero_serie: true,
          modele: { select: { marque: true, reference: true } },
        },
        orderBy: { numero_serie: "asc" },
      });
      // Le NUMÉRO DE SÉRIE entre dans le libellé, à la différence de
      // `libellesDesMachines` : celle-ci sert à AFFICHER des machines déjà
      // choisies, où des doublons de libellé ne gênent personne ; celle-ci
      // sert à en CHOISIR une parmi plusieurs exemplaires du même modèle, où
      // deux options identiques ne se distingueraient plus à l'écran.
      return machines.map((m) => ({
        id: m.id,
        siteId: m.site_id,
        libelle: `${m.modele.marque} ${m.modele.reference} — ${m.numero_serie}`,
      }));
    },
    client,
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * L'ÉCRITURE DU PARC (R6-03) — dans une transaction que l'appelant tient
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LE SITE N'APPARTIENT PAS AU CLIENT SOUMIS (D-07, revue Codex de #236).
 *
 * `schemaMachine` ne valide que la FORME des UUID, et `machine` porte deux
 * clés étrangères INDÉPENDANTES vers `client` et `site` — aucune contrainte
 * composite ne les lie, à la différence de `site_client_fkey` qui lie déjà
 * un site à SON client. Un POST forgé (un `client_id` valide, le `site_id`
 * d'un AUTRE client de la même société) traverse donc les deux clés sans
 * qu'aucune ne morde, et créerait durablement une fiche dont le client
 * affiché et le lieu affiché se contredisent.
 *
 * **Poser la contrainte composite en base serait un CHANGEMENT DE SCHÉMA**
 * (CLAUDE.md §8) — hors du périmètre de ce correctif. `creerMachineDans` la
 * tient donc lui-même, en résolvant le site sous `site_id` ET `client_id` À
 * L'INTÉRIEUR de la même transaction que l'écriture : pas de fenêtre entre
 * la vérification et le `create`.
 */
class SiteHorsClient extends Error {
  constructor() {
    super("site_hors_client");
  }
}

/**
 * CE MODULE LISAIT, ET NE SAVAIT RIEN ÉCRIRE — mesuré le 16/09/2026.
 *
 * `listerLeParc`, `resumerLeParc`, `lireMachine` : trois lectures, aucune
 * écriture. **Une machine ne pouvait donc naître que par le semis**, ce qui est
 * exactement l'enchaînement que R6-03 décrit — *une machine exige un modèle, un
 * modèle exige une famille, et aucun des trois n'avait de chemin.*
 *
 * ## Pourquoi l'écriture arrive par l'import, et ce que cela NE décide PAS
 *
 * `SANS_APPLICATION` écarte les contacts avec ce motif : *« l'écrire ici en
 * passant déciderait à sa place de ce qu'un contact peut porter, dans le seul
 * chemin où personne ne relit ce qui entre »*. **Il ne vaut pas ici, et la
 * différence se mesure** : `lib/contacts/` n'a que `saisie.ts` et L1-03b tient
 * encore la plume ; `lib/machines/saisie.ts` est écrit, arbitré (D6, D7) et
 * éprouvé depuis L2-01 — *ce qu'une machine peut porter est déjà décidé.* Ce
 * module ne décide donc rien : il exécute un schéma qui existe.
 *
 * ## Ni `id`, ni `qr_token`, ni `numero` ne sont inventés ici
 *
 * L'`id` est un **paramètre** — un UUID v7 tiré par l'appelant (D7, I10),
 * exactement comme `creerModeleDans` ; `qr_token` en est DÉRIVÉ par
 * `lib/machines/qr.ts`, jamais tiré une seconde fois ; `numero` reste NUL, le
 * compteur par société appartenant à la synchronisation (lot 3). *Tirer l'`id`
 * ici ferait deux lectures d'un même fait, et l'appelant rendrait un
 * identifiant qui n'est pas celui de la ligne.*
 */
export async function creerMachineDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  id: string,
  saisie: SaisieMachine,
): Promise<void> {
  // Voir `SiteHorsClient` : le site est résolu sous les DEUX clés à la fois,
  // et non sur `site_id` seul — c'est précisément ce que la seconde moitié
  // du couple ne garantit pas.
  const site = await tx.site.findFirst({
    where: { id: saisie.site_id, client_id: saisie.client_id },
    select: { id: true },
  });
  if (site === null) {
    throw new SiteHorsClient();
  }
  await tx.machine.create({
    data: {
      id,
      societe_id: societeId,
      // **TIRÉ AU SORT, jamais dérivé de l'`id`** (D71). *Le commentaire du
      // schéma dit encore « dérivé de l'id » — il date de D7 et D71 l'a
      // remplacé ; c'est `lib/machines/qr.ts` qui fait foi.* Un jeton dérivé
      // serait prévisible depuis un identifiant qui voyage dans les URL, et
      // photographier une étiquette rendrait alors plus que l'étiquette.
      qr_token: engendrerJetonQr(),
      modele_id: saisie.modele_id,
      client_id: saisie.client_id,
      site_id: saisie.site_id,
      numero_serie: saisie.numero_serie,
      reference_interne: saisie.reference_interne,
      localisation: saisie.localisation,
      facture_origine: saisie.facture_origine,
      date_mise_en_service: saisie.date_mise_en_service,
      date_vente: saisie.date_vente,
      garantie_fin: saisie.garantie_fin,
      statut: saisie.statut,
      criticite: saisie.criticite,
      source_creation: saisie.source_creation,
      machine_remplacee_id: saisie.machine_remplacee_id,
      // **DÉDUIT du numéro de série, jamais accepté depuis l'entrée** (§6) :
      // `schemaMachine` le calcule, et ce module le recopie sans le rejuger.
      // *Deux sources d'un même fait divergent en silence* (§9, 01/09).
      complet: saisie.complet,
      // `vgp_exception` et son motif restent ABSENTS : l'exception d'un
      // exemplaire est un geste motivé (L9-06), et un import est le chemin où
      // personne ne relit ce qui entre.
    },
    select: { id: true },
  });
}

/**
 * LA MÊME ÉCRITURE, EN LOT (session du 16/09/2026, point 1 de la suite —
 * dépassement de délai) : voir `creerClientsEnLot`, même raison, même forme.
 * `qr_token` est tiré une fois PAR LIGNE — chaque fiche garde le sien, comme
 * à la création unitaire (D71).
 */
export async function creerMachinesEnLot(
  tx: Prisma.TransactionClient,
  societeId: string,
  lignes: readonly { readonly id: string; readonly saisie: SaisieMachine }[],
): Promise<void> {
  if (lignes.length === 0) return;
  await tx.machine.createMany({
    data: lignes.map(({ id, saisie }) => ({
      id,
      societe_id: societeId,
      qr_token: engendrerJetonQr(),
      modele_id: saisie.modele_id,
      client_id: saisie.client_id,
      site_id: saisie.site_id,
      numero_serie: saisie.numero_serie,
      reference_interne: saisie.reference_interne,
      localisation: saisie.localisation,
      facture_origine: saisie.facture_origine,
      date_mise_en_service: saisie.date_mise_en_service,
      date_vente: saisie.date_vente,
      garantie_fin: saisie.garantie_fin,
      statut: saisie.statut,
      criticite: saisie.criticite,
      source_creation: saisie.source_creation,
      machine_remplacee_id: saisie.machine_remplacee_id,
      complet: saisie.complet,
    })),
  });
}

/**
 * La MODIFICATION, jumelle de la création — `updateMany` et non `update`.
 *
 * *Zéro ligne touchée n'est pas une erreur technique, c'est la politique qui a
 * refusé*, et elle refuse en silence. Le décompte est rendu, l'appelant décide.
 *
 * **Les trois parents ne sont PAS réécrits, et chacun pour sa raison.** Le
 * MODÈLE fait partie de l'unicité `(societe_id, modele_id, numero_serie)` : une
 * ligne appariée par sa série désigne déjà une fiche, et le déplacer changerait
 * ce que la clé désigne. Le CLIENT et le SITE sont un déménagement — *un geste
 * daté, qui met en jeu la garantie, le contrat et le périmètre d'un compte de
 * portail* —, et un fichier ne décide pas cela (le raisonnement de D56 sur
 * `agence_id`, repris tel quel). **Condition de levée, vérifiable :** le jour où
 * un gabarit portera la DATE du déménagement à côté du site.
 *
 * **D-07 (revue Codex de #236) ne s'applique donc pas à cette fonction, et
 * c'est écrit plutôt que tu** : `app/api/machines/[id]/modifier/route.ts`
 * reçoit bien `site_id` et `client_id` (`schemaMachine` les exige tous les
 * trois, voir la note de tête de la route), mais ni l'un ni l'autre n'entre
 * dans ce `data` — un couple forgé sur ce chemin est donc VALIDÉ puis
 * IGNORÉ, jamais écrit. La vérification de `SiteHorsClient` (voir
 * `creerMachineDans`) reste propre à la création.
 */
export async function modifierMachineDans(
  tx: Prisma.TransactionClient,
  id: string,
  saisie: SaisieMachine,
): Promise<number> {
  const touchees = await tx.machine.updateMany({
    where: { id },
    data: {
      numero_serie: saisie.numero_serie,
      reference_interne: saisie.reference_interne,
      localisation: saisie.localisation,
      facture_origine: saisie.facture_origine,
      date_mise_en_service: saisie.date_mise_en_service,
      date_vente: saisie.date_vente,
      garantie_fin: saisie.garantie_fin,
      criticite: saisie.criticite,
      complet: saisie.complet,
    },
  });
  return touchees.count;
}

/* ────────────────────────────────────────────────────────────────────────
 * LES DEUX ÉCRANS (AT-07 bis, 18/09/2026) — mêmes formes que
 * `lib/materiel/depot.ts` (`creerModele`/`modifierModele`)
 * ──────────────────────────────────────────────────────────────────────── */

/** Les codes Prisma que ce module sait traduire. */
const VIOLATION_UNICITE = "P2002";
const VIOLATION_CLE_ETRANGERE = "P2003";
const CONTRAINTE_BASE = "P2010";

/**
 * Ce qu'un refus dit d'une machine, et il n'en dit jamais plus (D50).
 *
 * `reference_invalide` couvre QUATRE cas à la fois — modèle, client, site,
 * et désormais un site qui désigne un AUTRE client (`SiteHorsClient`, D-07)
 * — sans les distinguer : chacun désigne soit une ligne absente, soit une
 * ligne d'une autre société ou d'un autre client, et séparer les cas
 * apprendrait à qui saisit qu'un identifiant existe ailleurs (le
 * raisonnement de `lib/sites/depot.ts` sur `client_hors_perimetre`, repris
 * tel quel ici).
 */
export type MotifRefusMachine =
  /** `(societe_id, modele_id, numero_serie)` — la clé naturelle d'une fiche. */
  | "numero_serie_pris"
  /**
   * `machine_societe_reference_interne_key` — l'index PARTIEL de D6, que
   * Prisma ne connaît pas comme `@@unique` (voir `lib/machines/saisie.ts`).
   * Distinguée du numéro de série depuis la revue Codex de #236 : les deux
   * violations lèvent le MÊME code `P2002`, et les confondre dirait à qui
   * corrige une fiche de changer un numéro de série qui n'est pas en cause.
   */
  | "reference_interne_prise"
  | "reference_invalide"
  /** `modifierMachineDans` a touché zéro ligne : la politique a refusé. */
  | "introuvable";

export type ResultatMachine =
  | { readonly accepte: true; readonly id: string }
  | { readonly accepte: false; readonly motif: MotifRefusMachine };

/**
 * LA CIBLE D'UNE VIOLATION D'UNICITÉ P2002, EN TEXTE (revue Codex de #236).
 *
 * `erreur.meta.target` porte les colonnes en tableau pour un `@@unique` connu
 * de Prisma (`[societe_id, modele_id, numero_serie]`), mais l'index partiel de
 * `reference_interne` n'est PAS déclaré comme `@@unique` — un `WHERE` ne se
 * décrit pas en Prisma (voir sa note de tête). Pour cet index-là, Prisma ne
 * peut donc rendre que le nom de la contrainte, jamais une colonne : les deux
 * FORMES sont donc concaténées ici, plutôt que de supposer laquelle sortirait.
 */
function cibleUnicite(erreur: Prisma.PrismaClientKnownRequestError): string {
  const cible = erreur.meta?.["target"];
  return Array.isArray(cible) ? cible.join(",") : String(cible ?? "");
}

function motifMachine(erreur: unknown): MotifRefusMachine | null {
  if (erreur instanceof SiteHorsClient) return "reference_invalide";
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (erreur.code === VIOLATION_UNICITE) {
    return cibleUnicite(erreur).includes("reference_interne")
      ? "reference_interne_prise"
      : "numero_serie_pris";
  }
  if (
    erreur.code === VIOLATION_CLE_ETRANGERE ||
    erreur.code === CONTRAINTE_BASE
  ) {
    return "reference_invalide";
  }
  return null;
}

/**
 * CRÉE UNE MACHINE DEPUIS UN ÉCRAN — le premier appelant de
 * `creerMachineDans` en dehors du semis et de l'import (R6-03, mesuré le
 * 18/09/2026 : le parc ne se remplissait que par eux).
 *
 * L'identifiant est tiré ICI, avant la transaction — même raison que
 * `creerModele` : `creerMachineDans` le veut en paramètre (D7, I10), et le
 * tirer à l'intérieur de la transaction rendrait un identifiant que
 * l'appelant ne connaîtrait qu'en cas de succès.
 */
export async function creerMachine(
  contexte: ContexteSession,
  saisie: SaisieMachine,
  client?: PrismaClient,
): Promise<ResultatMachine> {
  const id = uuidv7();
  try {
    await avecContexteApplicatif(
      contexte,
      (tx) => creerMachineDans(tx, exigerSocieteActive(contexte), id, saisie),
      client,
    );
    return { accepte: true, id };
  } catch (erreur: unknown) {
    const motif = motifMachine(erreur);
    if (motif === null) throw erreur;
    return { accepte: false, motif };
  }
}

/**
 * MODIFIE UNE FICHE EXISTANTE — le jumeau de `creerMachine`.
 *
 * `modifierMachineDans` n'écrit ni le modèle, ni le client, ni le site, ni
 * le statut (voir sa note de tête) : cette fonction ne le contourne pas —
 * elle rend le même refus « introuvable » qu'un identifiant inconnu quand
 * la politique a filtré la ligne, sans jamais réécrire ce que le dépôt a
 * délibérément laissé de côté.
 */
export async function modifierMachine(
  contexte: ContexteSession,
  id: string,
  saisie: SaisieMachine,
  client?: PrismaClient,
): Promise<ResultatMachine> {
  try {
    const touchees = await avecContexteApplicatif(
      contexte,
      (tx) => modifierMachineDans(tx, id, saisie),
      client,
    );
    return touchees === 0
      ? { accepte: false, motif: "introuvable" }
      : { accepte: true, id };
  } catch (erreur: unknown) {
    const motif = motifMachine(erreur);
    if (motif === null) throw erreur;
    return { accepte: false, motif };
  }
}
