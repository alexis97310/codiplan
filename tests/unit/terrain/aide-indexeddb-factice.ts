/**
 * UN DOUBLE EN MÉMOIRE D'INDEXEDDB, POUR LES ÉPREUVES SOUS JSDOM
 * (9F4H3A-FILE-SANS-PERTE, point 1) — jsdom n'implémente pas IndexedDB (voir
 * `tests/unit/terrain/copie-locale.test.ts`), et `fake-indexeddb` n'est PAS
 * une dépendance du dépôt : l'ajouter pour ce seul usage serait les 200 Ko
 * que CLAUDE.md §2 demande de ne pas ajouter par réflexe.
 *
 * Suffisant pour `lib/terrain/file-saisies.ts` : un seul magasin à clé
 * (`keyPath`), `get`/`getAll`/`put`/`delete`, et un `oncomplete` de
 * transaction qui n'attend QUE les opérations réellement en vol — y compris
 * celles posées PENDANT le traitement d'un `onsuccess` (la coalescence du
 * point 1 pose un `delete` puis un `put` depuis l'intérieur d'un
 * `getAll().onsuccess`).
 *
 * Chaque callback est posé en microtâche, jamais synchrone : comme la vraie
 * API, l'appelant doit pouvoir affecter `requete.onsuccess` APRÈS l'appel
 * qui a produit `requete`.
 */

import { MAGASIN_FILE, ouvrirBaseTerrain } from "@/lib/terrain/base-locale";

type Enregistrement = Record<string, unknown>;

class MagasinFactice {
  readonly table = new Map<string, Enregistrement>();
  constructor(readonly keyPath: string | undefined) {}
}

class RequeteFactice {
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  result: unknown;
  error: unknown;
}

class TransactionFactice {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  // L'ABANDON (point 5, 9F4H3AC) — distinct de `onerror` : une vraie
  // transaction peut s'abandonner (quota dépassé, fermeture de la base)
  // alors que chaque requête posée dedans a individuellement RÉUSSI. Le
  // double le simule plutôt que de réutiliser `onerror`, pour que le code
  // sous épreuve distingue vraiment les deux événements.
  onabort: (() => void) | null = null;
  error: unknown = null;
  private enVol = 0;
  private terminee = false;

  constructor(private readonly abandonnee: boolean = false) {}

  lancer<T>(executer: () => T): RequeteFactice {
    const requete = new RequeteFactice();
    this.enVol += 1;
    queueMicrotask(() => {
      try {
        requete.result = executer();
        this.enVol -= 1;
        requete.onsuccess?.();
      } catch (erreur) {
        requete.error = erreur;
        this.enVol -= 1;
        requete.onerror?.();
      }
      queueMicrotask(() => this.verifierFin());
    });
    return requete;
  }

  private verifierFin(): void {
    if (this.enVol === 0 && !this.terminee) {
      this.terminee = true;
      if (this.abandonnee) {
        this.error = new Error("transaction abandonnée (double d'épreuve)");
        this.onabort?.();
      } else {
        this.oncomplete?.();
      }
    }
  }
}

class ObjectStoreFactice {
  constructor(
    readonly magasin: MagasinFactice,
    readonly transaction: TransactionFactice,
  ) {}

  get(cle: string): RequeteFactice {
    return this.transaction.lancer(() => this.magasin.table.get(cle));
  }

  getAll(): RequeteFactice {
    return this.transaction.lancer(() => [...this.magasin.table.values()]);
  }

  put(valeur: Enregistrement, cleExplicite?: string): RequeteFactice {
    return this.transaction.lancer(() => {
      const cle =
        this.magasin.keyPath === undefined
          ? (cleExplicite as string)
          : String(valeur[this.magasin.keyPath]);
      this.magasin.table.set(cle, valeur);
      return cle;
    });
  }

  delete(cle: string): RequeteFactice {
    return this.transaction.lancer(() => {
      this.magasin.table.delete(cle);
    });
  }
}

class BaseFactice {
  constructor(
    readonly magasins: Map<string, MagasinFactice>,
    private readonly abandonnerTransactions: boolean = false,
  ) {}

  get objectStoreNames(): { contains(nom: string): boolean } {
    return { contains: (nom: string) => this.magasins.has(nom) };
  }

  createObjectStore(nom: string, options?: { readonly keyPath: string }): void {
    this.magasins.set(nom, new MagasinFactice(options?.keyPath));
  }

  transaction(): {
    objectStore(nom: string): ObjectStoreFactice;
  } {
    const transaction = new TransactionFactice(this.abandonnerTransactions);
    return {
      objectStore: (nom: string) => {
        const magasin = this.magasins.get(nom);
        if (magasin === undefined) {
          throw new Error(`magasin introuvable : ${nom}`);
        }
        return new ObjectStoreFactice(magasin, transaction);
      },
    };
  }

  close(): void {
    /* rien à libérer dans le double */
  }
}

/**
 * Installe `globalThis.indexedDB` pour la durée d'un test — RESTAURER avec
 * la fonction rendue, dans un `afterEach`, pour ne jamais laisser le double
 * fuiter vers un autre fichier d'épreuve.
 */
export function installerIndexedDBFactice(options?: {
  readonly enPanne?: boolean;
  /** Chaque transaction s'ABANDONNE plutôt que de se compléter (point 5, 9F4H3AC). */
  readonly enAbandon?: boolean;
}): () => void {
  const magasins = new Map<string, MagasinFactice>();
  const base = new BaseFactice(magasins, options?.enAbandon ?? false);
  const enPanne = options?.enPanne ?? false;

  const indexedDBFactice = {
    open(): RequeteFactice {
      const requete = new RequeteFactice();
      queueMicrotask(() => {
        if (enPanne) {
          requete.error = new Error("IndexedDB en panne (double d'épreuve)");
          requete.onerror?.();
          return;
        }
        (requete as unknown as { result: BaseFactice }).result = base;
        (requete as { onupgradeneeded?: () => void }).onupgradeneeded?.();
        requete.onsuccess?.();
      });
      return requete;
    },
  };

  const precedent = (globalThis as { indexedDB?: unknown }).indexedDB;
  Object.defineProperty(globalThis, "indexedDB", {
    value: indexedDBFactice,
    configurable: true,
  });

  return () => {
    Object.defineProperty(globalThis, "indexedDB", {
      value: precedent,
      configurable: true,
    });
  };
}

/**
 * ÉCRIT UNE ENTRÉE BRUTE, SANS PASSER PAR `ajouterSaisie` (9F4H6C-FILE-
 * ROBUSTESSE, point 3) — `ajouterSaisie` lit `parametres.geste.type` pour
 * savoir si le geste coalesce, ce qui lèverait exactement sur le `geste:
 * null`/absent que ces épreuves veulent simuler en file. Seule une écriture
 * RÉELLEMENT hors-contrat (comme une corruption, ou une version antérieure
 * qui n'aurait pas validé avant d'écrire) peut déposer une telle entrée —
 * cette fonction la simule directement dans le magasin `file`.
 */
export async function ecrireEntreeBrute(
  entree: Record<string, unknown>,
): Promise<void> {
  const base = await ouvrirBaseTerrain();
  await new Promise<void>((resolve, reject) => {
    // `oncomplete`/`onerror` vivent sur `objectStore.transaction`, JAMAIS
    // sur ce que rend `base.transaction(...)` lui-même (même patron que
    // `lib/terrain/file-saisies.ts`) — le double, comme la vraie API, ne les
    // expose qu'à travers l'`objectStore`.
    const objectStore = base
      .transaction(MAGASIN_FILE, "readwrite")
      .objectStore(MAGASIN_FILE);
    objectStore.put(entree);
    objectStore.transaction.oncomplete = () => resolve();
    objectStore.transaction.onerror = () =>
      reject(objectStore.transaction.error);
  });
  base.close();
}
