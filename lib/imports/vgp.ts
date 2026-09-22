import { z } from "zod";

import { normaliserRaisonSociale } from "@/lib/excel/rapprochement";
import { ORIGINES_VGP } from "@/lib/vgp/verification";

import {
  type MotifNonRattachee,
  type ParcMachines,
  rattacherLaMachine,
} from "./reprise";

/**
 * CE QU'UNE VÉRIFICATION RÉGLEMENTAIRE IMPORTÉE EST — et n'est pas (VGP-IMPORT ; D88, D114).
 *
 * Ce module ne lit aucune base et ne connaît aucun classeur : il porte les
 * LISTES CLOSES que l'archive impose, les SCHÉMAS des deux lignes (Zod,
 * CLAUDE.md §2), et le RATTACHEMENT d'un PV à sa machine. `lib/imports/modeles.ts`
 * le traduit en deux gabarits, `lib/imports/application.ts` l'écrit, et tous
 * lisent la même règle.
 *
 * ## CE QUE LES TABLES PORTENT — mesuré au schéma le 22/09/2026, avant d'écrire
 *
 * `vgp_verification` : `machine_id` **NOT NULL**, `date_verification`,
 * `organisme`, `reference_rapport` (nullable), `origine` (énumération close,
 * sans défaut — D114), `document_id` (nullable). **Ni inspecteur, ni
 * conformité, ni avis, ni client.**
 *
 * `vgp_observation` : `verification_id` NOT NULL, `libelle`, `intervention_id`
 * (nullable — « planifiée » ou pas). **Ni code, ni date de signalement, ni
 * statut, ni document de réponse.**
 *
 * Aucun état « en attente de rattachement » n'existe dans le produit — ni
 * colonne, ni table, ni statut. **Sans migration, un PV sans machine ne peut
 * pas entrer dans `vgp_verification`.** Ce qu'on fait alors est écrit plus bas
 * (`MOTIFS_ATTENTE`), et ce que cela affirme de trop aussi.
 *
 * ## LES TROIS ARBITRAGES DU 22/09/2026, et où chacun mord
 *
 * 1. **Une observation non levée ne crée AUCUNE demande SAV.** Ce module ne
 *    connaît ni `demande` ni `intervention` : `intervention_id` reste NUL à
 *    l'import, et rien ici n'appelle `planifierLObservation`. 608 des 670
 *    réserves sont « non rattachées à un document CODIMA », et le fichier
 *    lui-même avertit que cela ne prouve pas qu'elles sont restées ouvertes.
 * 2. **Un PV importé ne recalcule PAS l'échéance.** Ce n'est pas une règle de
 *    ce module : `etatDeLInformation` (`lib/vgp/information.ts`) rend
 *    `hors_registre` tant que la famille n'est pas `soumis`, et l'échéance
 *    est DÉDUITE de la périodicité déclarée, jamais stockée. L'épreuve
 *    d'isolation le mesure après l'import plutôt que de le supposer.
 * 3. **Un PV sans machine identifiée n'est pas perdu.** Voir `MOTIFS_ATTENTE`.
 */

/* ────────────────────────────────────────────────────────────────────────
 * LES NON-VALEURS DU N° DE SÉRIE — écrites en mots, jamais vides
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LES MOTS QUI VEULENT DIRE « PAS DE N° DE SÉRIE » — liste close, insensible
 * à la casse, MESURÉE sur le classeur réel le 22/09/2026 : `SANS` (6), `sans`
 * (4), `Sans` (2), `?` (2), et `Illisible`. **Aucune cellule vide** : une
 * première version du ticket les supposait vides, et c'était faux.
 *
 * Sans cette liste, l'import chercherait une machine dont le numéro de série
 * est littéralement « SANS », ne la trouverait pas, et rendrait « série
 * inconnue » — un motif qui n'explique rien à qui a écrit « sans » exprès.
 *
 * *Ce que `cleDeRapprochement` sait déjà* : sa propre liste des riens
 * (`RIEN`, `lib/excel/rapprochement.ts`) tient `?`, `sans`, `n/a`, `nc`,
 * `-` — mais pas `illisible`. Les deux ne sont pas une seconde lecture : la
 * sienne dit ce qui N'IDENTIFIE PAS une fiche du parc (D6), celle-ci dit ce
 * que l'ARCHIVE écrit quand elle n'a rien à dire, et `rattacherLaMachineDuPv`
 * lit celle-ci d'abord, puis lui confie le reste. Une valeur que l'une ou
 * l'autre tient pour rien aboutit au même état : « sans n° de série ».
 */
export const NON_VALEURS_SERIE_VGP = ["sans", "?", "illisible"] as const;

export function serieNonRenseignee(brut: string | undefined): boolean {
  const texte = brut?.trim().toLowerCase();
  return (
    texte === undefined ||
    texte === "" ||
    (NON_VALEURS_SERIE_VGP as readonly string[]).includes(texte)
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * LA CONFORMITÉ — trois valeurs, et « ? » en est une
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * CE QUE LA COLONNE « Conforme » PORTE — mesuré : **245 NON, 66 OUI, 22 « ? »**.
 * Le « ? » existe dans les données réelles, et il n'est forcé ni à oui ni à
 * non : l'organisme n'a pas conclu, ou l'archive ne l'a pas retenu, et
 * CODIPLAN n'affirme jamais une conformité (D88). Insensible à la casse.
 *
 * **Aucune colonne de `vgp_verification` ne la reçoit** (mesuré) : elle est
 * validée ici et conservée dans `import_lot_ligne.valeurs`, telle que lue.
 * Une quatrième valeur est REFUSÉE (`saisie_refusee`) plutôt qu'avalée : *une
 * valeur que la mesure n'a pas vue est un fait à montrer, pas à ranger.*
 */
export const VALEURS_CONFORME = ["oui", "non", "?"] as const;

export function conformiteDeclaree(
  brut: string | undefined,
): string | undefined {
  const texte = brut?.trim().toLowerCase();
  return texte === undefined || texte === "" ? undefined : texte;
}

/* ────────────────────────────────────────────────────────────────────────
 * LE STATUT D'UNE OBSERVATION — trois valeurs réelles, pas deux
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LES TROIS STATUTS MESURÉS SUR LES 670 RÉSERVES : « Non rattachée à un
 * document CODIMA » (608), « Levée - facturée » (40), « Chiffrée - devis
 * émis » (22). **« Chiffrée » n'est PAS rabattue sur « non levée »** : c'est
 * un état intermédiaire qui dit qu'un devis existe.
 *
 * **Le modèle du produit ne sait pas les accueillir, et c'est dit plutôt
 * qu'écrasé** : `vgp_observation` ne porte qu'un `intervention_id` nullable —
 * « planifiée » ou pas —, aucune colonne ne dit « levée » ni « chiffrée ». Le
 * statut est validé ici contre cette liste et conservé dans
 * `import_lot_ligne.valeurs`. Le jour où le produit portera un cycle de vie
 * d'observation, c'est une migration — et un arbitrage (§8), parce que
 * « levée » est ce qu'un client voit.
 *
 * La comparaison passe par `normaliserRaisonSociale` : accents, casse et
 * ponctuation ne font pas un quatrième statut. Ce qui ne s'y ramène pas est
 * refusé (`saisie_refusee`), pour la même raison que la conformité.
 */
export const STATUTS_OBSERVATION_VGP = [
  "Non rattachée à un document CODIMA",
  "Levée - facturée",
  "Chiffrée - devis émis",
] as const;

export type StatutObservationVgp = (typeof STATUTS_OBSERVATION_VGP)[number];

/** Le statut canonique qu'une cellule désigne, ou `undefined` si aucun. */
export function statutDeclare(
  brut: string | undefined,
): StatutObservationVgp | undefined {
  const texte = brut?.trim();
  if (texte === undefined || texte === "") return undefined;
  const forme = normaliserRaisonSociale(texte);
  return STATUTS_OBSERVATION_VGP.find(
    (statut) => normaliserRaisonSociale(statut) === forme,
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * L'ATTENTE DE RATTACHEMENT — représentée sans migration, et ce que ça coûte
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LES QUATRE MOTIFS D'UN PV QUI N'A PAS TROUVÉ SA MACHINE (arbitrage 3).
 *
 * ## Ce qui est REPRÉSENTÉ, et comment
 *
 * `vgp_verification.machine_id` est NOT NULL : aucune ligne de cette table ne
 * peut porter un PV sans machine, et aucune autre table ne porte de PV. **Le
 * seul domicile qui existe sans migration est `import_lot_ligne`** — la
 * ligne du fichier, colonne par colonne, telle qu'elle a été lue, qui SURVIT
 * à l'application et à l'annulation du lot. C'est déjà là que
 * REPRISE-HISTORIQUE range cinq colonnes sans arrivée, et pour la même
 * raison : *une migration est un arbitrage, pas un détail.*
 *
 * Une ligne sans machine est donc CLASSÉE au contrôle sous l'un de ces quatre
 * motifs, dans la colonne que la base tient pour cela (`rejet_motif`, liée à
 * `action = rejet` par une équivalence en base) ; le rapport la compte À PART
 * (`decompterLesRattachementsVgp`) sous le titre « en attente de
 * rattachement », avec le n° de série lu et le motif ; et le fichier des
 * rejets (RG-IMP-03) la rend RECHARGEABLE : quand la machine est identifiée,
 * on corrige la cellule et on redépose — le PV entre alors par le chemin
 * ordinaire.
 *
 * ## Ce que cette représentation AFFIRME DE TROP, écrit plutôt que tu
 *
 * Dans le vocabulaire de la base, cette ligne est un `rejet`, et le décompte
 * `lignes_rejets` du lot la compte avec les vraies erreurs. L'arbitrage dit
 * « n'est pas refusé » : le libellé, le compte séparé et le fichier
 * rechargeable disent la même chose qu'un état, mais ce n'en est pas un — le
 * PV n'est pas dans le registre, et `dernieresInformations` ne le voit pas.
 * **Condition de réouverture, vérifiable :** une migration qui rend
 * `machine_id` nullable, ou une table des PV en attente — l'une et l'autre
 * sont un arbitrage (§8, changement de schéma), pas une ligne ici.
 *
 * ## Pourquoi PAS une création jamais écrite
 *
 * L'autre représentation possible — classer la ligne `creation` et ne rien
 * écrire à l'application — ferait mentir le rapport : « 333 créations »
 * validées, 319 écrites, et les 14 manquantes indiscernables d'un parc qui a
 * bougé. C'est exactement ce que L1-08h a fermé. *Un rapport qui dit ce qu'il
 * ne fera pas vaut mieux qu'un rapport qui promet ce qu'il ne fera pas.*
 */
export const MOTIFS_ATTENTE = {
  sans_serie: "a_rattacher_sans_serie",
  serie_inconnue: "a_rattacher_serie_inconnue",
  serie_ambigue: "a_rattacher_serie_ambigue",
  serie_autre_client: "a_rattacher_serie_autre_client",
} as const;

export type MotifAttente = (typeof MOTIFS_ATTENTE)[keyof typeof MOTIFS_ATTENTE];

const MOTIFS_ATTENTE_CONNUS: ReadonlySet<string> = new Set(
  Object.values(MOTIFS_ATTENTE),
);

/** Ce motif de rejet est-il une attente de rattachement, et non une erreur ? */
export function estEnAttenteDeRattachement(
  motif: string | null | undefined,
): motif is MotifAttente {
  return (
    motif !== null && motif !== undefined && MOTIFS_ATTENTE_CONNUS.has(motif)
  );
}

export type RattachementDuPv =
  | {
      readonly rattache: true;
      readonly rang: 1 | 2;
      readonly machineId: string;
    }
  | {
      readonly rattache: false;
      readonly motif: MotifAttente;
      /** Ce que la cellule portait — `null` quand c'était une non-valeur. */
      readonly serie: string | null;
    };

/**
 * RATTACHE UN PV À SA MACHINE, OU DIT POURQUOI PAS.
 *
 * **La règle est celle de D127, lue par la MÊME fonction que l'historique**
 * (`rattacherLaMachine`) : rang 1 quand la série désigne une seule machine,
 * rang 2 quand elle en désigne plusieurs et qu'une seule est chez le client
 * nommé, rang 3 pour tout le reste. Une seconde lecture du critère
 * divergerait en silence (§9, 01/09) — et ici la divergence se verrait sur
 * une fiche machine, sous un PV qui n'est pas le sien.
 *
 * Le client est FACULTATIF : « Client / Site » n'est qu'un contrôle de
 * cohérence. Nommé et reconnu, il départage (rang 2) ou contredit (« série
 * chez un autre client ») ; absent, la série seule décide.
 */
export function rattacherLaMachineDuPv(
  serie: string | undefined,
  clientId: string | null,
  machines: ParcMachines,
): RattachementDuPv {
  if (serieNonRenseignee(serie)) {
    return { rattache: false, motif: MOTIFS_ATTENTE.sans_serie, serie: null };
  }
  const rattachement = rattacherLaMachine(serie, clientId, machines);
  switch (rattachement.rang) {
    case "sans_serie":
      return { rattache: false, motif: MOTIFS_ATTENTE.sans_serie, serie: null };
    case 3:
      return {
        rattache: false,
        motif: motifDAttente(rattachement.motif),
        serie: rattachement.serie,
      };
    default:
      return {
        rattache: true,
        rang: rattachement.rang,
        machineId: rattachement.machineId,
      };
  }
}

function motifDAttente(motif: MotifNonRattachee): MotifAttente {
  switch (motif) {
    case "serie_inconnue":
      return MOTIFS_ATTENTE.serie_inconnue;
    case "serie_ambigue":
      return MOTIFS_ATTENTE.serie_ambigue;
    case "serie_autre_client":
      return MOTIFS_ATTENTE.serie_autre_client;
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * LES DEUX LIGNES, TELLES QU'ELLES S'ÉCRIVENT
 * ──────────────────────────────────────────────────────────────────────── */

const uuid = z.string().uuid();
const texte = (max: number) => z.string().trim().min(1).max(max);
const texteFacultatif = (max: number) =>
  z.string().trim().min(1).max(max).nullable().default(null);

/**
 * LA VÉRIFICATION, TELLE QU'ELLE S'ÉCRIT.
 *
 * **Trois de ces champs n'ont AUCUNE colonne d'arrivée sur
 * `vgp_verification`** — mesuré au schéma le 22/09/2026 : `inspecteur`,
 * `conforme`, `avis_general` ; et `client_id` n'y est qu'un contrôle. Ils sont
 * validés ici et conservés dans `import_lot_ligne.valeurs`, retrouvables par
 * `entite_id` ; ils n'apparaissent pas sur la fiche. *Les porter sur la fiche
 * est une migration — un arbitrage, pas un détail.* Le schéma les exige quand
 * même : un fichier qui ne les porte pas n'est pas l'archive.
 *
 * **L'ORIGINE vient du FICHIER, jamais d'une constante** — c'est tout D114 :
 * *une origine par défaut serait une valeur probante inventée*, et elle
 * serait inventée 333 fois. Le gabarit expose une colonne « Origine »,
 * obligatoire, aux quatre codes que le formulaire de saisie accepte déjà.
 */
export const schemaLignePv = z
  .object({
    date_verification: z.date(),
    organisme: texte(200),
    reference_rapport: texte(120),
    inspecteur: texteFacultatif(120),
    /** La machine RATTACHÉE — une ligne sans machine n'atteint jamais ce schéma. */
    machine_id: uuid,
    /** Le client de la colonne « Client / Site », quand elle en désigne un. */
    client_id: uuid.nullable(),
    origine: z.enum(ORIGINES_VGP),
    conforme: z.enum(VALEURS_CONFORME),
    avis_general: texteFacultatif(2000),
  })
  .strict();

export type LignePv = z.output<typeof schemaLignePv>;

/**
 * L'OBSERVATION, TELLE QU'ELLE S'ÉCRIT.
 *
 * Seul `libelle` arrive sur `vgp_observation` — mot pour mot, comme le
 * formulaire l'écrit. **Cinq champs restent dans la ligne du lot** : le code,
 * la référence du rapport, la date de signalement, le statut, le document et
 * la date de réponse. Le parent est résolu depuis « Réf. rapport » — et, quand
 * ce rapport couvre plusieurs machines, depuis « Machine (n° de série) ».
 */
export const schemaLigneObservationVgp = z
  .object({
    code: texte(80),
    reference_rapport: texte(120),
    verification_id: uuid,
    date_signalement: z.date(),
    libelle: texte(4000),
    statut: z.enum(STATUTS_OBSERVATION_VGP),
    document_reponse: texteFacultatif(200),
    date_reponse: z.date().nullable(),
  })
  .strict();

export type LigneObservationVgp = z.output<typeof schemaLigneObservationVgp>;

/* ────────────────────────────────────────────────────────────────────────
 * LES CLÉS — et pourquoi celle des vérifications n'en est pas une
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * LA CLÉ D'UN RAPPORT — pour retrouver le PARENT d'une observation, jamais
 * pour identifier une vérification.
 *
 * *Mesuré le 22/09/2026 sur les 333 lignes : 56 références distinctes.* Un PV
 * Bureau Veritas couvre tout un parc en une visite — `315503594.1.R` porte
 * 44 lignes. **La référence désigne donc un ENSEMBLE de vérifications**, et
 * c'est ce que l'index des parents rend : la liste, jamais « la première ».
 * La graphie seule est normalisée, jamais le numéro.
 */
export function cleDuRapport(reference: string): string {
  return `RAPPORT-${normaliserRaisonSociale(reference)}`;
}

/**
 * LA CLÉ D'UNE OBSERVATION : le couple (rapport, code).
 *
 * Le ticket tient le code pour LA clé, et rien ici ne le contredit : si les
 * codes sont uniques sur toute l'archive, le rapport dans la clé ne change
 * rien. S'ils ne le sont que PAR RAPPORT — « 1 », « 2 », « 3 » sous chaque
 * référence, ce que la mesure n'a pas exclu —, une clé au code seul ferait
 * rejeter en `doublon_fichier` tout ce qui suit la première ligne. *La clé la
 * plus sûre est celle qui ne dépend pas d'une hypothèse non mesurée.*
 */
export function cleDeLObservation(reference: string, code: string): string {
  return `OBSERVATION-${normaliserRaisonSociale(reference)}-${normaliserRaisonSociale(code)}`;
}

/* ────────────────────────────────────────────────────────────────────────
 * LES VÉRIFICATIONS DÉJÀ ENREGISTRÉES — les PARENTS d'une observation
 * ──────────────────────────────────────────────────────────────────────── */

/** Une vérification du registre, vue par le gabarit des observations. */
export type VerificationConnue = {
  readonly id: string;
  readonly machineId: string;
  /** La clé de rapprochement de la machine — la même que `parSerie` (D6). */
  readonly serie: string;
};

/**
 * LE REGISTRE PAR RÉFÉRENCE DE RAPPORT — TOUS les PV d'une référence, jamais
 * un seul. Voir `cleDuRapport` : une référence couvre un parc entier, et
 * c'est le n° de série qui départage.
 */
export type ParcVerificationsVgp = {
  readonly parRapport: ReadonlyMap<string, readonly VerificationConnue[]>;
};
