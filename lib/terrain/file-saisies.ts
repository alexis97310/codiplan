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
export type GesteRapport = {
  readonly type: "rapport";
  readonly commentaire: string;
  readonly suite: string;
};
export type GestePrestations = {
  readonly type: "prestations";
  readonly prestationIds: readonly string[];
};
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

async function toutesLesEntrees(): Promise<EntreeFile[]> {
  const { base, objectStore } = await magasin("readonly");
  const entrees = await new Promise<EntreeFile[]>((resolve, reject) => {
    const requete = objectStore.getAll();
    requete.onsuccess = () => resolve(requete.result as EntreeFile[]);
    requete.onerror = () => reject(requete.error);
  });
  base.close();
  return entrees;
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
          const existantes = requete.result as EntreeFile[];
          const precedente = existantes.find(
            (e) =>
              e.interventionId === parametres.interventionId &&
              e.utilisateurId === parametres.utilisateurId &&
              e.societeId === parametres.societeId &&
              e.geste.type === parametres.geste.type &&
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
