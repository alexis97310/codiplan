/**
 * L'OUVERTURE PARTAGÉE DE LA BASE `codiplan-terrain` (9F4H3-HORS-RESEAU-
 * ENVOYER, point 1) — extraite de `copie-locale.ts` (9F4H1) pour que
 * `file-saisies.ts` y ajoute SON magasin sans risquer deux appels
 * `indexedDB.open` à des versions différentes : IndexedDB refuse une
 * connexion qui demande une version inférieure à celle déjà posée sur le
 * disque, et deux constantes `VERSION_BASE` distinctes auraient fini par
 * s'y heurter dès que l'une des deux aurait tourné en premier.
 *
 * Les DEUX magasins sont créés dans le MÊME `onupgradeneeded`, chacun sous sa
 * propre garde `contains` — celle de `instantane` est inchangée depuis
 * 9F4H1 ; seule celle de `file` est neuve.
 */

const NOM_BASE = "codiplan-terrain";
const VERSION_BASE = 2;

export const MAGASIN_INSTANTANE = "instantane";
export const MAGASIN_FILE = "file";

export function ouvrirBaseTerrain(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const requete = indexedDB.open(NOM_BASE, VERSION_BASE);
    requete.onupgradeneeded = () => {
      const base = requete.result;
      if (!base.objectStoreNames.contains(MAGASIN_INSTANTANE)) {
        base.createObjectStore(MAGASIN_INSTANTANE);
      }
      if (!base.objectStoreNames.contains(MAGASIN_FILE)) {
        base.createObjectStore(MAGASIN_FILE, { keyPath: "id" });
      }
    };
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}
