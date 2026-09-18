import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

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

export function resumerLeParc(
  lignes: readonly LigneDeParc[],
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

  return { ...filtreTexte, ...filtreStatut };
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
 */
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
        select: CHAMPS_PARC,
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

/* ────────────────────────────────────────────────────────────────────────
 * L'ÉCRITURE DU PARC (R6-03) — dans une transaction que l'appelant tient
 * ──────────────────────────────────────────────────────────────────────── */

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
 * `reference_invalide` couvre TROIS clés étrangères à la fois — modèle,
 * client, site — sans les distinguer : chacune désigne soit une ligne
 * absente, soit une ligne d'une autre société, et séparer les deux cas
 * apprendrait à qui saisit qu'un identifiant existe ailleurs (le
 * raisonnement de `lib/sites/depot.ts` sur `client_hors_perimetre`, repris
 * tel quel ici).
 */
export type MotifRefusMachine =
  /** `(societe_id, modele_id, numero_serie)` — la clé naturelle d'une fiche. */
  | "numero_serie_pris"
  | "reference_invalide"
  /** `modifierMachineDans` a touché zéro ligne : la politique a refusé. */
  | "introuvable";

export type ResultatMachine =
  | { readonly accepte: true; readonly id: string }
  | { readonly accepte: false; readonly motif: MotifRefusMachine };

function motifMachine(erreur: unknown): MotifRefusMachine | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (erreur.code === VIOLATION_UNICITE) return "numero_serie_pris";
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
