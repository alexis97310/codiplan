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
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ## Ce que ce socle fait, et ce qu'il ne fait pas encore
 *
 * Il sert la COQUILLE sans réseau. **Le cache des données est L3-07**
 * (IndexedDB, le parc du client visité), **la file d'opérations est L3-08**.
 * Ce fichier ne connaît ni l'un ni l'autre, et ne prépare pas leur place :
 * *une place réservée est une décision de personne.*
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
const CACHE = "codiplan-coquille-v1";

/**
 * LES SEULES ROUTES MISES EN CACHE — liste close, et toutes PUBLIQUES.
 *
 * `/sante` est l'écran qui dit si l'installation va bien, et il est conçu pour
 * répondre quand le reste ne répond plus. `/connexion` est la porte d'entrée :
 * hors réseau, mieux vaut un formulaire qui s'affiche et refuse à l'envoi
 * qu'un écran de navigateur en erreur.
 *
 * **Aucune des deux ne rend de donnée de société.** C'est le critère
 * d'admission, et le seul : *une route entre ici si elle est identique pour
 * tout le monde.*
 */
const COQUILLE = ["/sante", "/connexion"];

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
  if (!statique && !estDeLaCoquille(url)) return;

  evenement.respondWith(
    fetch(requete)
      .then((reponse) => {
        // On ne garde que ce qui a réellement abouti. *Mettre en cache une 404
        // ou une redirection la servirait ensuite hors réseau comme si elle
        // était la page.*
        if (reponse.ok && reponse.type === "basic") {
          const copie = reponse.clone();
          void caches.open(CACHE).then((cache) => cache.put(requete, copie));
        }
        return reponse;
      })
      .catch(async () => {
        const garde = await caches.match(requete);
        if (garde !== undefined) return garde;
        // *Un refus franc plutôt qu'une page inventée* : sans cette réponse, le
        // navigateur afficherait son propre écran d'erreur, ce qui est au moins
        // honnête. Le statut le dit.
        return new Response("", { status: 504, statusText: "hors reseau" });
      }),
  );
});
