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
  private enVol = 0;
  private terminee = false;

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
      this.oncomplete?.();
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
  constructor(readonly magasins: Map<string, MagasinFactice>) {}

  get objectStoreNames(): { contains(nom: string): boolean } {
    return { contains: (nom: string) => this.magasins.has(nom) };
  }

  createObjectStore(nom: string, options?: { readonly keyPath: string }): void {
    this.magasins.set(nom, new MagasinFactice(options?.keyPath));
  }

  transaction(): {
    objectStore(nom: string): ObjectStoreFactice;
  } {
    const transaction = new TransactionFactice();
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
}): () => void {
  const magasins = new Map<string, MagasinFactice>();
  const base = new BaseFactice(magasins);
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
