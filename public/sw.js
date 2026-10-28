/*
 * LE SERVICE WORKER (L3-06, I4, §13.2).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ⚠  CE QU'IL N'A PAS LE DROIT DE METTRE EN CACHE, ET POURQUOI C'EST ÉCRIT EN
 *    PREMIER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **Aucune page authentifiée. Aucune réponse d'API.**
 *
 * La façon la plus simple d'écrire un service worker est de garder toute
 * navigation réussie, et c'est ce qu'écrivent la plupart des recettes. Elle est
 * REFUSÉE ici :
 *
 * > Un cache qui garderait le planning rendu pour la société A le resservirait
 * > à une session de la société B **sur le même appareil**. *Un cache est un
 * > stockage, et I1 ne s'arrête pas au serveur* : aucune politique PostgreSQL
 * > ne s'applique à `caches` — la lecture a déjà eu lieu.
 *
 * Un appareil partagé entre deux techniciens, ou une personne habilitée sur
 * deux sociétés (RG-SOC-03, le cas ordinaire), suffit à rendre la fuite réelle.
 *
 * **La règle est donc une LISTE D'AUTORISÉS, jamais une liste d'interdits.**
 * Une liste d'interdits oublie par construction la route créée demain ; une
 * liste d'autorisés ne peut pas s'élargir toute seule. `tests/e2e/offline/`
 * l'éprouve **par la sortie** : après une session réelle, le cache ne contient
 * ni `/planning`, ni `/arrivee`, ni `/api/`.
 *
 * **`/terrain` et `/terrain/<id>` suivent une TROISIÈME règle, ni coquille ni
 * ignorées (9F4H1) : REPLI sans MISE EN CACHE.** Elles ne sont jamais mises en
 * cache (authentifiées, cloisonnées par société) ; mais quand le réseau leur
 * refuse une réponse, ce fichier sert à leur place la coquille PUBLIQUE
 * `/terrain-hors-reseau`, qui lit sa propre copie dans IndexedDB — jamais le
 * corps d'une réponse authentifiée gardé en cache.
 *
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ## Ce que ce socle fait, et ce qu'il ne fait pas encore
 *
 * Il sert la COQUILLE sans réseau, et désormais la consultation de la journée
 * et des fiches (9F4H1, via IndexedDB — `lib/terrain/copie-locale.ts`). **La
 * file d'opérations reste L3-08** : ce fichier ne met en file aucune
 * écriture, et ne prépare pas sa place.
 *
 * ## Pourquoi « réseau d'abord », et jamais « cache d'abord »
 *
 * Sur un réseau calédonien, le cache d'abord donnerait une page plus rapide et
 * **parfois périmée**, sans que rien ne le dise. Le réseau d'abord coûte
 * l'attente et ne ment jamais : le cache ne sert que lorsque le réseau a
 * réellement échoué. *C'est la même règle que le glisser-déposer du planning —
 * l'écran ne montre jamais un état que la base n'a pas accepté.*
 *
 * ## Pas de notifications push
 *
 * §3.19, repris par le ticket : aucune. Ce fichier n'écoute donc ni `push` ni
 * `notificationclick`, et ce n'est pas un oubli.
 */

/**
 * LE NOM DU CACHE PORTE SA VERSION.
 *
 * Changer ce nom est ce qui purge l'ancien contenu à l'activation : sans lui,
 * une coquille corrigée cohabiterait indéfiniment avec la précédente, et
 * *« videz votre cache » n'est pas une procédure d'exploitation.*
 */
const CACHE = "codiplan-coquille-v3";

/**
 * LES SEULES ROUTES MISES EN CACHE — liste close, et toutes PUBLIQUES.
 *
 * `/sante` est l'écran qui dit si l'installation va bien, et il est conçu pour
 * répondre quand le reste ne répond plus. `/connexion` est la porte d'entrée :
 * hors réseau, mieux vaut un formulaire qui s'affiche et refuse à l'envoi
 * qu'un écran de navigateur en erreur. `/terrain-hors-reseau` (9F4H1) sert la
 * consultation sans réseau — SANS donnée dans son HTML : tout ce qu'elle
 * affiche vient d'IndexedDB, lu par son propre script, APRÈS que cette
 * coquille — identique pour tout le monde — a été servie.
 *
 * `/scanner-hors-reseau` (9I1) suit la même règle, pour la même raison que
 * `/terrain-hors-reseau` ci-dessous : elle ne rend aucune capacité nouvelle
 * (pas de caméra, pas de résolution locale des QR), seulement le message qui
 * dit que le scan est indisponible hors réseau.
 *
 * **Aucune des quatre ne rend de donnée de société.** C'est le critère
 * d'admission, et le seul : *une route entre ici si elle est identique pour
 * tout le monde.*
 */
const COQUILLE = [
  "/sante",
  "/connexion",
  "/terrain-hors-reseau",
  "/scanner-hors-reseau",
];

/**
 * `/terrain` ET SES FICHES — REPLI SANS MISE EN CACHE (9F4H1). Ni dans
 * `COQUILLE` (authentifiées, jamais gardées), ni ignorées : une NAVIGATION
 * dont le réseau échoue y reçoit la coquille `/terrain-hors-reseau` plutôt que
 * l'écran d'erreur du navigateur. Voir `estRepliTerrain` ci-dessous.
 */
const REPLI_TERRAIN = /^\/terrain(\/.*)?$/;

/** `/terrain` ou `/terrain/<id>` — jamais `/terrain-hors-reseau`, déjà dans la coquille. */
function estRepliTerrain(url) {
  return REPLI_TERRAIN.test(url.pathname) && !estDeLaCoquille(url);
}

/**
 * `/scanner` ET `/parc/scanner` — MÊME REPLI SANS MISE EN CACHE, POUR LA MÊME
 * RAISON (9I1-SCANNER-HORS-RESEAU) : deux chemins plats (aucun n'a de
 * sous-route), jamais mis en cache eux-mêmes (authentifiés, cloisonnés par
 * société), mais dont une navigation en échec reçoit `/scanner-hors-reseau`
 * plutôt que l'écran d'erreur du navigateur.
 */
const REPLI_SCANNER = /^\/(scanner|parc\/scanner)$/;

/** `/scanner` ou `/parc/scanner` — jamais `/scanner-hors-reseau`, déjà dans la coquille. */
function estRepliScanner(url) {
  return REPLI_SCANNER.test(url.pathname) && !estDeLaCoquille(url);
}

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(COQUILLE)),
  );
  // La nouvelle version prend la main sans attendre la fermeture des onglets :
  // §13.1 promet une « mise à jour instantanée sans action de l'utilisateur ».
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(
          noms.filter((nom) => nom !== CACHE).map((nom) => caches.delete(nom)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** L'URL est-elle l'une des routes publiques mises en cache ? */
function estDeLaCoquille(url) {
  return COQUILLE.includes(url.pathname);
}

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;

  // **Rien d'autre que `GET`**, et rien d'une autre origine. Une écriture ne se
  // met jamais en cache — c'est la file d'opérations qui la portera (L3-08), et
  // en attendant, une écriture hors réseau échoue franchement.
  if (requete.method !== "GET") return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  // **La liste d'AUTORISÉS, et le reste passe au réseau sans être touché.**
  // Les ressources statiques de Next portent leur empreinte dans leur nom :
  // elles sont immuables, et les garder ne peut pas périmer.
  const statique =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icones/");
  const repliTerrain = estRepliTerrain(url);
  const repliScanner = estRepliScanner(url);
  if (!statique && !estDeLaCoquille(url) && !repliTerrain && !repliScanner) {
    return;
  }

  evenement.respondWith(
    fetch(requete)
      .then((reponse) => {
        // On ne garde que ce qui a réellement abouti SANS REDIRECTION.
        // `reponse.redirected` est vrai quand le `fetch` a SUIVI une
        // redirection. **Mesuré (9F4H1) : une NAVIGATION plein document vers
        // `/connexion` sous une session active esquive déjà ce défaut — le
        // `Request` de navigation suit sa redirection sous la forme d'une
        // réponse `opaqueredirect` (`status: 0`), que `reponse.ok` exclut
        // déjà.** Le vecteur réel est un `fetch()` de SCRIPT — un
        // pré-chargement `next/link` ou une navigation CLIENT — où la réponse
        // suivie est bien `ok`, `basic`, et `redirected: true`. Sans ce test,
        // la clé mise en cache reste celle de la requête D'ORIGINE
        // (`/connexion`), publique, alors que le corps gardé est celui de la
        // page où la redirection a abouti, authentifiée : *mettre en cache une
        // redirection la servirait ensuite hors réseau comme si elle était la
        // page publique* (I1 ne s'arrête pas au serveur). Gardée même si le
        // premier vecteur mesuré s'avère déjà sans risque : défense en
        // profondeur contre le second.
        //
        // **NI `repliTerrain` NI `repliScanner` N'ENTRENT JAMAIS ICI** —
        // `/terrain`, ses fiches, `/scanner` et `/parc/scanner` sont
        // authentifiées, et ce gardien ne distingue pas une société d'une
        // autre : les garder ferait exactement la fuite que l'en-tête de ce
        // fichier refuse.
        if (
          !repliTerrain &&
          !repliScanner &&
          reponse.ok &&
          reponse.type === "basic" &&
          !reponse.redirected
        ) {
          const copie = reponse.clone();
          void caches.open(CACHE).then((cache) => cache.put(requete, copie));
        }
        return reponse;
      })
      .catch(async () => {
        const garde = await caches.match(requete);
        if (garde !== undefined) return garde;
        // LE REPLI DU TERRAIN (9F4H1) — une navigation vers `/terrain` ou une
        // de ses fiches, sans réseau : la coquille PUBLIQUE prend la place de
        // l'écran d'erreur. Elle lit sa propre copie dans IndexedDB ; l'URL
        // D'ORIGINE reste dans la barre d'adresse, c'est elle que cette
        // coquille relit pour savoir quelle fiche ouvrir.
        if (repliTerrain) {
          const coquille = await caches.match("/terrain-hors-reseau");
          if (coquille !== undefined) return coquille;
        }
        // LE REPLI DU SCANNER (9I1) — même règle : une navigation vers
        // `/scanner` ou `/parc/scanner` sans réseau reçoit la coquille
        // PUBLIQUE `/scanner-hors-reseau` plutôt que l'écran d'erreur du
        // navigateur. Aucune donnée à relire : le message est fixe.
        if (repliScanner) {
          const coquille = await caches.match("/scanner-hors-reseau");
          if (coquille !== undefined) return coquille;
        }
        // *Un refus franc plutôt qu'une page inventée* : sans cette réponse, le
        // navigateur afficherait son propre écran d'erreur, ce qui est au moins
        // honnête. Le statut le dit.
        return new Response("", { status: 504, statusText: "hors reseau" });
      }),
  );
});
