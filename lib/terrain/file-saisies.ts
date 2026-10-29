/**
 * LA FILE DES SAISIES HORS RÉSEAU (9F4H3-HORS-RESEAU-ENVOYER, point 1 ;
 * décisions n° 105 et 108 d'Alexis, 14/10/2026) — IndexedDB, magasin `file`
 * de la même base `codiplan-terrain` que la copie de consultation de 9F4H1
 * (voir `base-locale.ts`), mais un magasin SÉPARÉ : cette file n'est JAMAIS
 * touchée par `effacerCopie` ni par `ecrireCopieEnRemplacantLidentite`
 * (addendum 3 du pilote, 18/10/2026) — une saisie en attente ne se perd ni à
 * la déconnexion sans confirmation (point 3) ni à l'arrivée d'une copie
 * d'une autre identité.
 *
 * ## L'ORDRE EST UNE CLÉ, PAS UN CHAMP CALCULÉ
 *
 * `id` est un UUID v7 (`uuidv7Appareil`) : ses 48 bits de poids fort portent
 * l'horodatage, donc le TRI LEXICOGRAPHIQUE de la clé EST l'ordre
 * chronologique. Trier la file revient à lister par clé croissante — aucun
 * compteur ni horloge supplémentaire à tenir à jour.
 *
 * ## COALESCENCE : RAPPORT, PRESTATIONS, SIGNATURE, TERMINER
 *
 * Ces quatre gestes se RÉÉCRIVENT (dernière valeur gagne, point 1 du
 * ticket) : une nouvelle saisie du même type sur la même intervention
 * REMPLACE l'ancienne plutôt que de s'empiler derrière elle — il n'y a
 * jamais qu'un rapport, qu'un jeu de prestations, qu'une signature ou qu'un
 * « terminer » en attente par intervention. `compteur` et `photo`
 * s'AJOUTENT : plusieurs démarrages/arrêts ou plusieurs photos peuvent être
 * pris pendant la même coupure, et aucun ne remplace l'autre.
 *
 * ## ELLE N'ÉCHOUE JAMAIS BRUYAMMENT
 *
 * Même contrat que `copie-locale.ts` : IndexedDB absent ou en panne ne doit
 * jamais faire lever une fonction de ce module.
 *
 * ## UN ÉVÉNEMENT, POUR LES COMPOSANTS QUI NE SE PARLENT PAS ENTRE EUX
 *
 * `BoutonCompteurTerrain` écrit dans la file ; `RapportTerrainAutomatique`
 * (section « Terminer ») et `BoutonEnvoyer` doivent le savoir pour ajuster
 * leur propre état LOCAL — sans qu'aucun des deux ne soit le parent de
 * l'autre. `EVENEMENT_FILE_MODIFIEE`, posé sur `window` après chaque
 * écriture, est le canal : chaque composant intéressé l'écoute et relit SON
 * état depuis la file, jamais depuis un props qu'un autre composant
 * pousserait.
 */

import { MAGASIN_FILE, ouvrirBaseTerrain } from "./base-locale";
import { uuidv7Appareil } from "./uuid-appareil";

export const EVENEMENT_FILE_MODIFIEE = "codiplan:file-saisies-modifiee";

/**
 * UNE ENTRÉE « PRESTATIONS » VIENT D'ÊTRE ENVOYÉE DEPUIS LA FILE ET ACCEPTÉE
 * (9F4H6C-FILE-ROBUSTESSE, point 1) — `envoyerFile` (`envoi-file.ts`) pose
 * cet événement plutôt que `EVENEMENT_FILE_MODIFIEE` seul : la fiche a
 * besoin de SAVOIR QUELLE DIFFÉRENCE a été appliquée (`ajouterIds`,
 * `retirerIds`) pour tenir sa « dernière base connue » à jour, pas
 * seulement qu'« une modification » a eu lieu — un envoi déclenché depuis
 * « Ma journée », donc hors du montage de la fiche, ne lui parviendrait
 * sinon jamais autrement qu'au prochain rafraîchissement des props serveur.
 */
export const EVENEMENT_PRESTATIONS_ENVOYEES =
  "codiplan:file-prestations-envoyees";

export type DetailPrestationsEnvoyees = {
  readonly interventionId: string;
  readonly ajouterIds: readonly string[];
  readonly retirerIds: readonly string[];
};

export function signalerPrestationsEnvoyees(
  detail: DetailPrestationsEnvoyees,
): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<DetailPrestationsEnvoyees>(
        EVENEMENT_PRESTATIONS_ENVOYEES,
        { detail },
      ),
    );
  }
}

/**
 * UN « DÉMARRER » VIENT DE RÉUSSIR EN LIGNE (défaut mesuré en ligne par
 * Alexis le 21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES, D220) — un
 * « démarrer » réussi EN LIGNE n'écrit jamais dans la file (voir
 * `BoutonCompteurTerrain`) : rien n'avertissait jusqu'ici
 * `RapportTerrainAutomatique` que le compteur tournait désormais, et la
 * section « Terminer » restait donc dépendante du seul `router.refresh()` —
 * mesuré insuffisant après la REPRISE d'une intervention déjà « terminée »,
 * où le bouton restait grisé jusqu'à un rechargement complet. Ce signal
 * couvre le même fait que `EVENEMENT_FILE_MODIFIEE` couvre pour la file : un
 * composant qui n'est le parent d'aucun autre prévient ceux qui doivent
 * ajuster leur état LOCAL, sans attendre un aller-retour serveur.
 */
export const EVENEMENT_COMPTEUR_DEMARRE_EN_LIGNE =
  "codiplan:compteur-demarre-en-ligne";

export type DetailCompteurDemarreEnLigne = {
  readonly interventionId: string;
};

export function signalerCompteurDemarreEnLigne(
  detail: DetailCompteurDemarreEnLigne,
): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<DetailCompteurDemarreEnLigne>(
        EVENEMENT_COMPTEUR_DEMARRE_EN_LIGNE,
        { detail },
      ),
    );
  }
}

/**
 * UN IDENTIFIANT D'OPÉRATION, ET L'HEURE DE L'APPAREIL (point 3, C7) — le
 * compteur, la signature et « terminer » appellent cette fonction AVANT leur
 * premier envoi en ligne, pour que le MÊME `operation_id` voyage jusqu'à un
 * éventuel renvoi par la file. Posée ici, jamais dans un composant : ce
 * module est déjà l'exemption nommée du gardien L0-08 pour « l'heure du
 * téléphone » (voir `tests/unit/calendar/sans-date-courante-implicite.
 * test.ts`) — un second `new Date()` ailleurs serait une exemption de plus à
 * justifier, pour exactement le même fait.
 */
export function nouvelleOperation(): {
  readonly id: string;
  readonly instantAppareil: string;
} {
  return { id: uuidv7Appareil(), instantAppareil: new Date().toISOString() };
}

/**
 * L'HEURE DE L'APPAREIL, RELEVÉE AVANT UNE TENTATIVE D'ENVOI (point 2,
 * 9F4H3AC) — même fait que `nouvelleOperation`, sans fabriquer d'identifiant
 * d'opération inutile : le rapport et les prestations n'ont pas besoin d'un
 * `operation_id` (ils ne coalescent pas sur un identifiant, voir l'en-tête),
 * seulement d'un repère pour `retirerSaisieCoalescable` qui précède l'envoi
 * plutôt que de le suivre.
 */
export function instantAvantEnvoi(): string {
  return new Date().toISOString();
}

function signalerModification(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENEMENT_FILE_MODIFIEE));
  }
}

export type GesteCompteur = {
  readonly type: "compteur";
  readonly action: "demarrer" | "arreter";
};
/** Une pièce remplacée, telle que portée par un geste « rapport » (9I7B). */
export type PieceRemplaceeGeste = {
  readonly designation: string;
  readonly reference: string | null;
  readonly quantite: number;
};
export type GesteRapport = {
  readonly type: "rapport";
  readonly commentaire: string;
  readonly suite: string;
  /**
   * LE REMPLACEMENT INTÉGRAL DE L'ENSEMBLE (9I7B, point 3 du ticket) — voyage
   * dans la MÊME enveloppe que `commentaire`/`suite`, jamais une différence
   * comme `GestePrestations` : aucun autre acteur n'écrit cette table.
   * FACULTATIF — absent, `[]` s'applique (voir `corpsDe`, `envoi-file.ts`) :
   * un geste construit avant 9I7B (ou par une épreuve qui ne porte pas sur
   * les pièces) reste valide.
   */
  readonly pieces?: readonly PieceRemplaceeGeste[];
};
/**
 * LA DIFFÉRENCE, JAMAIS L'ENSEMBLE (9F4H6A-COQUILLE-ANCIENNE-COPIE, point 2)
 * — `ajouterIds`/`retirerIds` portent ce que CET appareil a coché/décoché
 * par rapport à la DERNIÈRE base connue de lui (la dernière réponse serveur
 * acceptée, ou l'instantané au premier chargement) ; jamais l'ensemble
 * résultant, qui effacerait au rejeu une prestation ajoutée ENTRE-TEMPS par
 * quelqu'un d'autre (voir l'en-tête de `definirPrestationsRealiseesDepuisFile`
 * dans `lib/interventions/depot-rapport-terrain.ts`).
 */
export type GestePrestations = {
  readonly type: "prestations";
  readonly ajouterIds: readonly string[];
  readonly retirerIds: readonly string[];
};

/**
 * CALCULE LA DIFFÉRENCE ENTRE LA DERNIÈRE BASE CONNUE ET CE QUI EST VOULU
 * MAINTENANT — fonction pure, appelée par `RapportTerrainAutomatique` juste
 * avant de garder un geste `prestations` en file (voir son docblock).
 */
export function differencePrestations(
  baseConnue: ReadonlySet<string>,
  voulues: ReadonlySet<string>,
): Pick<GestePrestations, "ajouterIds" | "retirerIds"> {
  return {
    ajouterIds: [...voulues].filter((id) => !baseConnue.has(id)),
    retirerIds: [...baseConnue].filter((id) => !voulues.has(id)),
  };
}
export type GesteSignature = {
  readonly type: "signature";
  /** Les champs du formulaire, tels qu'envoyés à la route (`issue` compris). */
  readonly champs: Readonly<Record<string, string>>;
};
export type GestePhoto = {
  readonly type: "photo";
  readonly blob: Blob;
  readonly nomFichier: string;
  readonly libelle: string;
};
export type GesteTerminer = { readonly type: "terminer" };

export type Geste =
  | GesteCompteur
  | GesteRapport
  | GestePrestations
  | GesteSignature
  | GestePhoto
  | GesteTerminer;

export type EntreeFile = {
  readonly id: string;
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  /** L'heure du téléphone au moment de la saisie — jamais recalculée. */
  readonly instantAppareil: string;
  readonly geste: Geste;
  /** Clé de `lib/i18n/fr.ts`, posée après un refus — la saisie reste en file. */
  readonly motifRefus: string | null;
};

type Identite = { readonly utilisateurId: string; readonly societeId: string };

/** Les quatre gestes qui REMPLACENT, jamais ne s'empilent (voir l'en-tête). */
const TYPES_COALESCABLES: ReadonlySet<Geste["type"]> = new Set([
  "rapport",
  "prestations",
  "signature",
  "terminer",
]);

async function magasin(mode: IDBTransactionMode): Promise<{
  readonly base: IDBDatabase;
  readonly objectStore: IDBObjectStore;
}> {
  const base = await ouvrirBaseTerrain();
  const transaction = base.transaction(MAGASIN_FILE, mode);
  return { base, objectStore: transaction.objectStore(MAGASIN_FILE) };
}

/** Posée sur une entrée dont le geste n'est reconnu sous AUCUNE forme connue
 * (ni la courante, ni une ancienne migrée) — voir `gesteReconnu`. */
export const CLE_MOTIF_FORMAT_INCONNU = "terrain.file.format_inconnu";

/**
 * LE TYPE D'UN GESTE ABSENT OU NUL (9F4H6C-FILE-ROBUSTESSE, point 3) — un
 * `.type` lu directement sur `null`/`undefined` LÈVE ; ce n'est jamais un
 * vrai type de `Geste`, ni le type `Geste["type"]` que prétend `EntreeFile`
 * (une entrée de forme inconnue porte toujours `motifRefus ===
 * CLE_MOTIF_FORMAT_INCONNU`, jamais un geste à envoyer). Posé seulement
 * quand `brute.geste` lui-même n'est PAS un objet (`null`, absent, ou un
 * type primitif) — un objet de forme inconnue mais PRÉSENT (par exemple
 * l'ancien `{type:"prestations"}` sans ses champs) garde son `.type` d'
 * origine, déjà sans risque puisque lire une propriété SUR un objet ne lève
 * jamais.
 */
export const TYPE_GESTE_ABSENT = "aucun";

function estTableauDeChaines(valeur: unknown): valeur is string[] {
  return Array.isArray(valeur) && valeur.every((v) => typeof v === "string");
}

/**
 * UNE ENTRÉE ÉCRITE PAR UNE VERSION ANTÉRIEURE À 9I7B NE PORTE PAS `pieces` —
 * devient `[]`, jamais un rejet du geste entier : perdre `commentaire`/
 * `suite` pour un champ absent ou malformé serait pire que renvoyer une
 * saisie de pièces vide. Un élément de forme inconnue, DANS le tableau, est
 * simplement écarté, pour la même raison.
 */
function pieceReconnue(valeur: unknown): PieceRemplaceeGeste | null {
  if (typeof valeur !== "object" || valeur === null) {
    return null;
  }
  const p = valeur as Record<string, unknown>;
  return typeof p.designation === "string" &&
    (typeof p.reference === "string" || p.reference === null) &&
    typeof p.quantite === "number"
    ? {
        designation: p.designation,
        reference: p.reference,
        quantite: p.quantite,
      }
    : null;
}

function piecesReconnues(valeur: unknown): readonly PieceRemplaceeGeste[] {
  if (!Array.isArray(valeur)) {
    return [];
  }
  return valeur
    .map(pieceReconnue)
    .filter((p): p is PieceRemplaceeGeste => p !== null);
}

/**
 * RECONNAÎT UN GESTE LU DEPUIS INDEXEDDB, OU RAPPORTE SON ABSENCE
 * (9F4H6B-FILE-ANCIEN-FORMAT, point 1) — `toutesLesEntrees` castait jusqu'ici
 * le résultat de `getAll` sans validation ; une entrée écrite par une version
 * ANTÉRIEURE à 9F4H6A porte encore `{type:"prestations", prestationIds}`
 * (voir `GestePrestations` ci-dessus, forme publiée jusqu'à `9fcaf346`) et
 * levait dans `corpsDe` (`envoi-file.ts`) faute de `ajouterIds`/`retirerIds`.
 *
 * Cette forme ancienne devient `{ajouterIds: prestationIds, retirerIds: []}`
 * — un AJOUT, jamais l'ensemble ni un retrait qu'elle n'a pas demandé (même
 * principe que `differencePrestations`). Une forme qui ne correspond à AUCUN
 * geste connu, ancien ou courant, rend `null` : l'appelant la garde en file
 * avec `CLE_MOTIF_FORMAT_INCONNU` plutôt que de la perdre ou de lever.
 */
function gesteReconnu(brut: unknown): Geste | null {
  if (typeof brut !== "object" || brut === null) {
    return null;
  }
  const g = brut as Record<string, unknown>;
  switch (g.type) {
    case "compteur":
      return g.action === "demarrer" || g.action === "arreter"
        ? { type: "compteur", action: g.action }
        : null;
    case "rapport":
      return typeof g.commentaire === "string" && typeof g.suite === "string"
        ? {
            type: "rapport",
            commentaire: g.commentaire,
            suite: g.suite,
            pieces: piecesReconnues(g.pieces),
          }
        : null;
    case "prestations":
      if (
        estTableauDeChaines(g.ajouterIds) &&
        estTableauDeChaines(g.retirerIds)
      ) {
        return {
          type: "prestations",
          ajouterIds: g.ajouterIds,
          retirerIds: g.retirerIds,
        };
      }
      // L'ANCIEN FORMAT, D'AVANT 9F4H6A (`prestationIds`, un ensemble entier).
      if (estTableauDeChaines(g.prestationIds)) {
        return {
          type: "prestations",
          ajouterIds: g.prestationIds,
          retirerIds: [],
        };
      }
      return null;
    case "signature":
      return typeof g.champs === "object" && g.champs !== null
        ? { type: "signature", champs: g.champs as Record<string, string> }
        : null;
    case "photo":
      return g.blob instanceof Blob &&
        typeof g.nomFichier === "string" &&
        typeof g.libelle === "string"
        ? {
            type: "photo",
            blob: g.blob,
            nomFichier: g.nomFichier,
            libelle: g.libelle,
          }
        : null;
    case "terminer":
      return { type: "terminer" };
    default:
      return null;
  }
}

async function toutesLesEntrees(): Promise<EntreeFile[]> {
  const { base, objectStore } = await magasin("readonly");
  const brutes = await new Promise<Record<string, unknown>[]>(
    (resolve, reject) => {
      const requete = objectStore.getAll();
      requete.onsuccess = () =>
        resolve(requete.result as Record<string, unknown>[]);
      requete.onerror = () => reject(requete.error);
    },
  );
  base.close();
  return brutes.map((brute) => {
    const geste = gesteReconnu(brute.geste);
    if (geste !== null) {
      return { ...brute, geste } as EntreeFile;
    }
    // FORME INCONNUE — jamais un gel muet : le motif existant (un refus
    // réseau déjà posé) prime, sinon `CLE_MOTIF_FORMAT_INCONNU` s'affiche à
    // sa place. `envoyerFile` (`envoi-file.ts`) ne tente JAMAIS d'envoyer
    // cette entrée (voir sa garde sur ce même motif).
    //
    // `brute.geste` ABSENT OU NUL NE VOYAGE JAMAIS TEL QUEL (point 3,
    // 9F4H6C-FILE-ROBUSTESSE) — chaque lecteur de `.geste.type` à travers la
    // file (tri, envoi, relecteurs d'écran) lèverait sur `null.type`. Un
    // OBJET de forme inconnue, lui, reste tel quel : lire une propriété
    // dessus ne lève jamais, et certains appelants (l'ancien format) s'y
    // attendent encore.
    const gesteSansRisque =
      typeof brute.geste === "object" && brute.geste !== null
        ? brute.geste
        : { type: TYPE_GESTE_ABSENT };
    return {
      ...brute,
      geste: gesteSansRisque,
      motifRefus:
        (brute.motifRefus as string | null) ?? CLE_MOTIF_FORMAT_INCONNU,
    } as EntreeFile;
  });
}

function appartientA(entree: EntreeFile, identite: Identite): boolean {
  return (
    entree.utilisateurId === identite.utilisateurId &&
    entree.societeId === identite.societeId
  );
}

function parOrdreChronologique(a: EntreeFile, b: EntreeFile): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Le verdict d'`ajouterSaisie` (point 2 : jamais « gardé » sans preuve). */
export type ResultatAjout =
  { readonly gardee: true; readonly id: string } | { readonly gardee: false };

/**
 * AJOUTE UNE SAISIE À LA FILE — remplace l'entrée coalescable précédente du
 * même type sur la même intervention **de la MÊME identité**, s'il en existe
 * une, dans la MÊME transaction IndexedDB que l'écriture (point 1 : la
 * coalescence n'est jamais la suppression puis l'écriture dans deux
 * transactions séparées, qui laisseraient une fenêtre où aucune des deux
 * n'existe si l'appareil tombe entre les deux).
 *
 * **L'IDENTITÉ FAIT PARTIE DE LA CLÉ DE COALESCENCE** (point 1, 9F4H3AC) —
 * `interventionId` + type ne suffisent pas : sur un téléphone PARTAGÉ, la
 * saisie du compte B remplacerait sinon en silence celle du compte A pour la
 * même intervention, alors que `listerFile`/`appartientA` promettent de
 * garder la file de chaque identité intacte.
 *
 * `id` et `instantAppareil` sont FACULTATIFS (point 3, 9F4H3A) : un appelant
 * qui a déjà fabriqué son `operation_id` AVANT une première tentative en
 * ligne (le compteur, la signature, « terminer ») le fournit ici pour que la
 * saisie gardée porte le MÊME identifiant que cette tentative — sans quoi un
 * renvoi par la file porterait un second identifiant, inconnu du serveur.
 */
export async function ajouterSaisie(parametres: {
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  readonly geste: Geste;
  readonly id?: string;
  readonly instantAppareil?: string;
}): Promise<ResultatAjout> {
  const id = parametres.id ?? uuidv7Appareil();
  const entree: EntreeFile = {
    id,
    interventionId: parametres.interventionId,
    utilisateurId: parametres.utilisateurId,
    societeId: parametres.societeId,
    instantAppareil: parametres.instantAppareil ?? new Date().toISOString(),
    geste: parametres.geste,
    motifRefus: null,
  };
  let base: IDBDatabase | undefined;
  try {
    const ouverture = await magasin("readwrite");
    base = ouverture.base;
    const objectStore = ouverture.objectStore;
    await new Promise<void>((resolve, reject) => {
      if (TYPES_COALESCABLES.has(parametres.geste.type)) {
        const requete = objectStore.getAll();
        requete.onsuccess = () => {
          // BRUT, JAMAIS PASSÉ PAR `gesteReconnu` (point 3, 9F4H6C-FILE-
          // ROBUSTESSE) — cette lecture directe d'IndexedDB, à la différence
          // de `toutesLesEntrees`, ne normalise rien ; un `geste` stocké
          // absent ou nul lèverait sur `.type` sans la garde ci-dessous.
          const existantes = requete.result as (EntreeFile & {
            readonly geste: Geste | null | undefined;
          })[];
          const precedente = existantes.find(
            (e) =>
              e.interventionId === parametres.interventionId &&
              e.utilisateurId === parametres.utilisateurId &&
              e.societeId === parametres.societeId &&
              e.geste?.type === parametres.geste.type &&
              e.id !== id,
          );
          if (precedente !== undefined) {
            objectStore.delete(precedente.id);
          }
          objectStore.put(entree);
        };
      } else {
        objectStore.put(entree);
      }
      objectStore.transaction.oncomplete = () => resolve();
      objectStore.transaction.onerror = () =>
        reject(objectStore.transaction.error);
      objectStore.transaction.onabort = () =>
        reject(
          objectStore.transaction.error ?? new Error("transaction abandonnée"),
        );
    });
    signalerModification();
  } catch {
    return { gardee: false };
  } finally {
    base?.close();
  }
  return { gardee: true, id };
}

/**
 * RETIRE L'ENTRÉE COALESCABLE DU MÊME TYPE SUR CETTE INTERVENTION — appelée
 * après un envoi EN LIGNE accepté du rapport, des prestations ou de la
 * signature (point 1, C1) : la dernière valeur gagne, et une entrée restée
 * en file pour ce type devient PÉRIMÉE dès que cet envoi réussit. Ne retire
 * que si l'entrée trouvée est plus ancienne que `pasApresInstant` — jamais
 * une entrée écrite APRÈS coup par un autre onglet ou un second geste
 * PENDANT l'envoi.
 *
 * **`pasApresInstant` SE RELÈVE AVANT LA TENTATIVE D'ENVOI, JAMAIS APRÈS SA
 * RÉPONSE** (point 2, 9F4H3AC) — un repère pris ici, après la réponse, serait
 * postérieur à une saisie écrite PENDANT l'aller-retour réseau (un autre
 * onglet, un second geste), et la retirerait à tort alors qu'elle n'a encore
 * jamais été envoyée. L'appelant le relève par `nouvelleOperation()` (ou
 * garde l'instant d'une opération déjà créée pour ce même envoi) AVANT
 * `fetch`, et le fournit ici.
 *
 * `pasApresInstant` reste FACULTATIF pour ne pas casser un appelant déjà
 * conforme à l'ancien contrat ; omis, l'instant est relevé ICI — jamais par
 * l'appelant, qui ajouterait une exemption de plus au gardien L0-08 pour
 * exactement le même fait (voir `tests/unit/calendar/
 * sans-date-courante-implicite.test.ts`).
 */
export async function retirerSaisieCoalescable(parametres: {
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  readonly type: Geste["type"];
  readonly pasApresInstant?: string;
}): Promise<void> {
  const pasApresInstant =
    parametres.pasApresInstant ?? new Date().toISOString();
  const entrees = await listerFilePourIntervention(parametres.interventionId, {
    utilisateurId: parametres.utilisateurId,
    societeId: parametres.societeId,
  });
  const precedente = entrees.find(
    (e) =>
      e.geste.type === parametres.type && e.instantAppareil <= pasApresInstant,
  );
  if (precedente !== undefined) {
    await retirerSaisie(precedente.id);
  }
}

/** La file d'UNE identité, triée chronologiquement — jamais celle d'une autre. */
export async function listerFile(identite: Identite): Promise<EntreeFile[]> {
  try {
    const entrees = await toutesLesEntrees();
    return entrees
      .filter((e) => appartientA(e, identite))
      .sort(parOrdreChronologique);
  } catch {
    return [];
  }
}

/** La file d'UNE identité, restreinte à UNE intervention. */
export async function listerFilePourIntervention(
  interventionId: string,
  identite: Identite,
): Promise<EntreeFile[]> {
  const toutes = await listerFile(identite);
  return toutes.filter((e) => e.interventionId === interventionId);
}

export async function retirerSaisie(id: string): Promise<void> {
  try {
    const { base, objectStore } = await magasin("readwrite");
    await new Promise<void>((resolve, reject) => {
      objectStore.delete(id);
      objectStore.transaction.oncomplete = () => resolve();
      objectStore.transaction.onerror = () =>
        reject(objectStore.transaction.error);
    });
    base.close();
    signalerModification();
  } catch {
    /* rien à retirer, ou IndexedDB indisponible : sans conséquence */
  }
}

/**
 * RETIRE UNE SAISIE REFUSÉE — REVÉRIFIE SON MOTIF AVANT (BAS,
 * 9F4H6D-PRESTATIONS-SANS-PERTE, point 5) — appelée UNIQUEMENT après la
 * confirmation de « Retirer cette saisie » (décision n° 142, `LigneRefus`).
 * Entre l'OUVERTURE de cette confirmation et la CONFIRMATION elle-même, un
 * envoi en cours (`envoyerFile`, déclenché par ailleurs) a pu REJOUER cette
 * même entrée et RÉUSSIR — elle a alors déjà quitté la file, ou y est
 * revenue sous un AUTRE motif. La retirer quand même, sans revérifier,
 * effacerait silencieusement une saisie que le technicien croyait refusée
 * mais qui est en réalité partie. `motifCleAttendu` est celui affiché au
 * moment de la confirmation ; un motif qui ne correspond plus (ou une
 * entrée absente) ne retire RIEN — `signalerModification` relit alors l'état
 * réel, qui n'affiche plus ce bouton-ci.
 */
export async function retirerSaisieRefusee(
  id: string,
  motifCleAttendu: string,
): Promise<void> {
  let actuelle: EntreeFile | undefined;
  try {
    actuelle = (await toutesLesEntrees()).find((e) => e.id === id);
  } catch {
    /* IndexedDB indisponible : même filet que `retirerSaisie`. */
    return;
  }
  if (actuelle === undefined || actuelle.motifRefus !== motifCleAttendu) {
    signalerModification();
    return;
  }
  await retirerSaisie(id);
}

/** Pose le motif d'un refus — la saisie RESTE en file (point 3 : rien ne se perd). */
export async function marquerRefusee(
  id: string,
  motifCle: string | null,
): Promise<void> {
  try {
    const { base, objectStore } = await magasin("readwrite");
    await new Promise<void>((resolve, reject) => {
      const requete = objectStore.get(id);
      requete.onsuccess = () => {
        const existante = requete.result as EntreeFile | undefined;
        if (existante === undefined) {
          resolve();
          return;
        }
        objectStore.put({ ...existante, motifRefus: motifCle });
      };
      requete.onerror = () => reject(requete.error);
      objectStore.transaction.oncomplete = () => resolve();
      objectStore.transaction.onerror = () =>
        reject(objectStore.transaction.error);
    });
    base.close();
    signalerModification();
  } catch {
    /* sans conséquence — le motif ne s'affichera pas, la saisie reste en file */
  }
}

/** Le nombre de saisies en attente d'UNE identité, toutes interventions confondues. */
export async function compterEnAttente(identite: Identite): Promise<number> {
  return (await listerFile(identite)).length;
}

/**
 * LE NOMBRE DE SAISIES EN ATTENTE SUR CET APPAREIL, TOUTES IDENTITÉS
 * CONFONDUES (9F4H4C) — pour la question de D115-3 quand l'instantané de
 * consultation est absent (`effacement-copie-locale.tsx`) : sans lui,
 * l'identité de la file reste inconnue, mais une file non vide doit quand
 * même intercepter la déconnexion plutôt que de la laisser partir en silence.
 */
export async function compterEnAttenteToutesIdentites(): Promise<number> {
  try {
    return (await toutesLesEntrees()).length;
  } catch {
    return 0;
  }
}

/**
 * UNE AUTRE IDENTITÉ A-T-ELLE DES SAISIES EN FILE SUR CET APPAREIL ?
 * (addendum 3 du pilote) — jamais envoyées sous la session courante.
 */
export async function contientSaisiesDuneAutreIdentite(
  identite: Identite,
): Promise<boolean> {
  try {
    const entrees = await toutesLesEntrees();
    return entrees.some((e) => !appartientA(e, identite));
  } catch {
    return false;
  }
}
