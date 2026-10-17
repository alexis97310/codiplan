/**
 * LA COPIE LOCALE DU TECHNICIEN — IndexedDB, un seul enregistrement
 * (9F4H1-HORS-RESEAU-CONSULTATION, points 3 et 6 ; décisions n° 105 et 106
 * d'Alexis, 14/10/2026).
 *
 * ## UNE SEULE CLÉ, JAMAIS UNE CLÉ PAR COMPTE
 *
 * Un appareil professionnel n'a jamais deux techniciens connectés à la fois
 * (la copie s'efface à la déconnexion, et à l'arrivée d'une copie d'une
 * AUTRE identité — voir `effacerSiAutreIdentite`). Une seule entrée suffit
 * donc, et c'est ce qui rend l'effacement total (`effacerCopie`) aussi simple
 * qu'un `clear()`.
 *
 * ## ELLE N'ÉCHOUE JAMAIS BRUYAMMENT
 *
 * Même règle que `components/pwa/enregistrement.tsx` : IndexedDB peut être
 * absent (navigateur ancien, mode privé qui le bride) ou refuser d'ouvrir.
 * Toute fonction ici ravale l'erreur — une copie manquante n'est jamais pire
 * que l'absence de hors-ligne, et ne doit jamais casser la page EN LIGNE.
 *
 * **L'OUVERTURE DE LA BASE EST PARTAGÉE** (9F4H3-HORS-RESEAU-ENVOYER, point
 * 1) — `base-locale.ts` tient désormais `NOM_BASE`/`VERSION_BASE` et les DEUX
 * magasins, pour que ce fichier et `lib/terrain/file-saisies.ts` n'ouvrent
 * jamais la même base à deux versions différentes.
 */

import { MAGASIN_INSTANTANE, ouvrirBaseTerrain } from "./base-locale";

const CLE = "actuel";

/** La forme minimale qu'une copie doit porter pour être comparée/affichée. */
export type InstantaneTerrain = {
  readonly utilisateurId: string;
  readonly societeId: string;
  readonly genereLe: string;
  readonly [cle: string]: unknown;
};

/** Écrit la copie — REMPLACE toute copie précédente, quelle que soit son identité. */
export async function ecrireCopie(
  instantane: InstantaneTerrain,
): Promise<void> {
  try {
    const base = await ouvrirBaseTerrain();
    await new Promise<void>((resolve, reject) => {
      const transaction = base.transaction(MAGASIN_INSTANTANE, "readwrite");
      transaction.objectStore(MAGASIN_INSTANTANE).put(instantane, CLE);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    base.close();
  } catch {
    /* pas de copie locale ; la page en ligne continue de fonctionner */
  }
}

/** Lit la copie, ou `null` si l'appareil n'en porte aucune. */
export async function lireCopie(): Promise<InstantaneTerrain | null> {
  try {
    const base = await ouvrirBaseTerrain();
    const valeur = await new Promise<InstantaneTerrain | null>(
      (resolve, reject) => {
        const transaction = base.transaction(MAGASIN_INSTANTANE, "readonly");
        const requete = transaction.objectStore(MAGASIN_INSTANTANE).get(CLE);
        requete.onsuccess = () =>
          resolve((requete.result as InstantaneTerrain | undefined) ?? null);
        requete.onerror = () => reject(requete.error);
      },
    );
    base.close();
    return valeur;
  } catch {
    return null;
  }
}

/** Efface la copie — déconnexion (6a), arrivée sur `/connexion` (6b). */
export async function effacerCopie(): Promise<void> {
  try {
    const base = await ouvrirBaseTerrain();
    await new Promise<void>((resolve, reject) => {
      const transaction = base.transaction(MAGASIN_INSTANTANE, "readwrite");
      transaction.objectStore(MAGASIN_INSTANTANE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    base.close();
  } catch {
    /* rien à effacer, ou IndexedDB indisponible : sans conséquence */
  }
}

/**
 * ÉCRIT LA COPIE REÇUE — en effaçant d'abord l'ancienne si elle appartient à
 * une AUTRE identité (6c : un autre compte, ou une autre société active sur
 * le même compte). Un simple `put` sous la clé unique aurait le même effet
 * sur le DISQUE, mais nommer l'effacement est ce que le point 6 demande : un
 * changement d'identité n'est pas une mise à jour, c'est un départ.
 */
export async function ecrireCopieEnRemplacantLidentite(
  instantane: InstantaneTerrain,
): Promise<void> {
  const precedente = await lireCopie();
  if (
    precedente !== null &&
    (precedente.utilisateurId !== instantane.utilisateurId ||
      precedente.societeId !== instantane.societeId)
  ) {
    await effacerCopie();
  }
  await ecrireCopie(instantane);
}
