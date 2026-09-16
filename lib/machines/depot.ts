import { type Prisma } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

import { engendrerJetonQr } from "./qr";
import { type SaisieMachine } from "./saisie";

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
 * colonnes sont donc ABSENTES, et l'écart est écrit ici plutôt que tu — c'est la
 * leçon de R2-13, qui reste bloqué pour exactement cette raison.
 */

/** Ce qu'une ligne de parc porte à l'écran. */
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
  modele: {
    select: { reference: true, famille: { select: { libelle: true } } },
  },
  // `client_id` VOYAGE AVEC LE LIBELLÉ depuis le 14/09/2026 : la colonne
  // « Client » du parc est devenue un LIEN vers la fiche, et un libellé sans
  // son identifiant ne mène nulle part. *Le lire par une seconde requête aurait
  // fait autant d'allers-retours que de lignes* (§9, 23/08).
  client_id: true,
  client: { select: { raison_sociale: true } },
  site: { select: { libelle: true, commune: true } },
} as const;

export type LigneDeParc = Prisma.MachineGetPayload<{
  select: typeof CHAMPS_PARC;
}>;

/**
 * LE COMPTE DE CE QUE L'ÉCRAN MONTRE, par statut et par complétude.
 *
 * **Il est calculé sur les lignes RENDUES, jamais par une seconde requête.**
 * Deux lectures d'un même critère divergent en silence, et un bandeau qui
 * compterait autrement que le tableau qu'il coiffe est la pire forme de cette
 * divergence : *le lecteur voit les deux chiffres côte à côte et ne sait pas
 * lequel croire.*
 */
export type ResumeDuParc = {
  readonly total: number;
  readonly parStatut: Readonly<Record<string, number>>;
  /** Les fiches à compléter — numéro de série illisible ou absent (D6). */
  readonly incompletes: number;
};

export function resumerLeParc(lignes: readonly LigneDeParc[]): ResumeDuParc {
  const parStatut: Record<string, number> = {};
  let incompletes = 0;
  for (const ligne of lignes) {
    parStatut[ligne.statut] = (parStatut[ligne.statut] ?? 0) + 1;
    if (!ligne.complet) {
      incompletes += 1;
    }
  }
  return { total: lignes.length, parStatut, incompletes };
}

/**
 * Le parc lisible sous le contexte courant.
 *
 * `limite` borne ce qui est RENDU, jamais ce qui est cloisonné : le
 * cloisonnement est prononcé par la politique, et une borne d'affichage ne s'y
 * substitue pas. Elle existe parce qu'un parc réel compte des milliers de
 * lignes — *le fichier de l'exploitation en porte 292 pour un seul client* — et
 * qu'un écran qui les rendrait toutes serait un écran qu'on n'ouvre plus.
 */
export async function listerLeParc(
  contexte: ContexteSession,
  limite: number,
): Promise<readonly LigneDeParc[]> {
  return avecContexteApplicatif(contexte, (tx) =>
    tx.machine.findMany({
      select: CHAMPS_PARC,
      // Les fiches INCOMPLÈTES d'abord : ce sont celles qui demandent un geste,
      // et un parc trié par date les enterrerait sous les fiches saines.
      orderBy: [
        { complet: "asc" },
        { numero: "desc" },
        { numero_serie: "asc" },
      ],
      take: limite,
    }),
  );
}

/** Ce qu'une FICHE de machine porte, en plus de ce qu'une ligne de parc montre. */
export const CHAMPS_FICHE = {
  ...CHAMPS_PARC,
  modele: {
    select: {
      reference: true,
      marque: true,
      famille: { select: { libelle: true } },
    },
  },
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
