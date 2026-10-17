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
 */

import { MAGASIN_FILE, ouvrirBaseTerrain } from "./base-locale";
import { uuidv7Appareil } from "./uuid-appareil";

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

/**
 * AJOUTE UNE SAISIE À LA FILE — remplace l'entrée coalescable précédente du
 * même type sur la même intervention, s'il en existe une. Rend l'`id`
 * généré : c'est lui que les routes `compteur`, `signature` et `terminer`
 * reçoivent comme `operation_id` (voir `envoi-file.ts`).
 */
export async function ajouterSaisie(parametres: {
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  readonly geste: Geste;
}): Promise<string> {
  const id = uuidv7Appareil();
  const entree: EntreeFile = {
    id,
    interventionId: parametres.interventionId,
    utilisateurId: parametres.utilisateurId,
    societeId: parametres.societeId,
    instantAppareil: new Date().toISOString(),
    geste: parametres.geste,
    motifRefus: null,
  };
  try {
    if (TYPES_COALESCABLES.has(parametres.geste.type)) {
      const existantes = await toutesLesEntrees();
      const precedente = existantes.find(
        (e) =>
          e.interventionId === parametres.interventionId &&
          e.geste.type === parametres.geste.type,
      );
      if (precedente !== undefined) {
        await retirerSaisie(precedente.id);
      }
    }
    const { base, objectStore } = await magasin("readwrite");
    await new Promise<void>((resolve, reject) => {
      objectStore.put(entree);
      objectStore.transaction.oncomplete = () => resolve();
      objectStore.transaction.onerror = () =>
        reject(objectStore.transaction.error);
    });
    base.close();
  } catch {
    /* la saisie reste dans l'état mémoire de l'appelant ; aucune panne IndexedDB ne doit remonter */
  }
  return id;
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
