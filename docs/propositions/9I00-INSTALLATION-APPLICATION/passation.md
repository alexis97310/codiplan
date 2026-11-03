# 9I00-INSTALLATION-APPLICATION — passation

Brief validé par Alexis le 31/10/2026 (`claude/ticket-installation-application.md`),
mis en tête de file le 03/11/2026. Travaillé sur une branche dédiée
`9I00-INSTALLATION-APPLICATION` partant d'`origin/main` (`a47ae2118`), parce que
`main` est extrait dans un autre worktree (`/home/aplou/codiplan`) — annoncé en
début de session, comme demandé par le lot.

## Ce qui est livré

1. **Détection, fonction pure** (`lib/pwa/installation.ts`) :
   - `detecterEtatInstallation` rend `deja_installee` / `android_chrome` /
     `ios_safari` / `autre` à partir de trois signaux déjà lus par l'appelant
     (mode autonome, invitation Android captée, agent utilisateur) — aucun
     accès au DOM dans la fonction elle-même.
   - `detecterPlateforme` (page publique, point 4) rend `ios`/`android`/`autre`
     du seul agent utilisateur — distincte de la précédente parce qu'une page
     qui EXPLIQUE un geste n'a besoin d'aucun `beforeinstallprompt` capté pour
     savoir quelles deux étapes montrer, à la différence d'un bouton qui le
     DÉCLENCHE.
   - Épreuves unitaires des deux fonctions, agents utilisateurs et drapeaux
     simulés (`tests/unit/pwa/installation.test.ts`).

2. **Bouton « Installer CODIPLAN »** (`components/pwa/magasin-installation.tsx`
   + `components/pwa/bouton-installer.tsx`) :
   - `FournisseurInstallationPwa` capte `beforeinstallprompt`/`appinstalled`
     **une seule fois, à la racine** (`app/layout.tsx`, à côté
     d'`EnregistrementServiceWorker`) : l'évènement ne se déclenche qu'une
     fois par chargement de page, et un composant posé sur `/terrain` seul
     l'aurait perdu au passage vers `/terrain/profil`.
   - `BoutonInstallerCodiplan` en consomme l'état : bouton Android (déclenche
     `prompt()`), bandeau iOS refermable et mémorisé PAR APPAREIL (`localStorage`
     en `try/catch`, même contrat que `components/navigation/barre.tsx`), texte
     de repli ailleurs, **absent** une fois l'application installée.
   - Posé sur la journée (`app/(mobile)/terrain/page.tsx`) et le profil
     (`app/(mobile)/terrain/profil/page.tsx`).

3. **Étape après le premier accès** (`app/(apres-session)/installation/`) :
   - Le signal « ce compte vient de choisir son mot de passe » voyage EN
     CLAIR, sans cookie ni session intermédiaire : `/connexion` pose un champ
     caché `suite=installation` quand le motif affiché est
     `premier_acces.abouti` ; `/api/session/connexion` le reporte sur sa
     redirection (`/arrivee?suite=installation`) ; **l'aiguillage se décide
     dans `app/(apres-session)/arrivee/page.tsx`**, après que
     `destinationSiSocieteUnique` (`decision.ts`, resté PUR et inchangé) ait
     calculé la destination d'un compte à société unique — si cette
     destination est `/terrain` (périmètre restreint, donc un technicien) ET
     que le motif a été reporté, la page bifurque vers
     `/installation?suite=/terrain`.
   - Un rôle de bureau (destiné à `/planning` ou `/portail`) ne voit jamais
     cette étape — la condition porte sur la destination, jamais sur une
     liste de rôles qui pourrait diverger de `decision.ts`.
   - `/installation` (session requise, aucun chrome, même segment que
     `/arrivee`) réutilise `BoutonInstallerCodiplan` tel quel : les mêmes
     trois cas que la journée. « Plus tard » mène toujours à la destination
     reçue en clair (`?suite=`), jamais recalculée — une liste close d'une
     seule valeur aujourd'hui (`/terrain`), avec un repli sur elle si la
     valeur est absente ou étrangère.
   - **Limite connue, non résolue par ce lot** : un technicien dont le rôle
     exige un second facteur passe par `/connexion/code`, qui ne reporte pas
     le champ caché — il manque l'étape cette seule fois, sans jamais être
     bloqué (en pratique, un rôle à périmètre restreint n'a aujourd'hui aucune
     raison de porter cette exigence, mais rien ne l'empêche).

4. **Page publique `/installer`** (`app/(sans-session)/installer/`) :
   - Sans session, protégée de la même façon que `/connexion` (le segment
     `(sans-session)` EST la règle d'accès). Lit `headers().get("user-agent")`
     côté serveur plutôt que `beforeinstallprompt` — cette page explique un
     geste, elle ne le déclenche jamais, et un visiteur qui n'a encore rien
     cliqué n'a capté aucun évènement.
   - Trois cas (Android/iOS/autre), aucune donnée de société — éprouvé par
     `tests/e2e/9i00-installer-public.spec.ts` (grep négatif sur « agence » et
     « site »).
   - Renvoie vers `/connexion`.

   **Affiche imprimable** (`app/(back-office)/parametres/equipe/affiche/`) :
   - Même garde que `/parametres/equipe` (`administrer_utilisateurs`).
   - Un QR (`components/ui/qr-code.tsx`, sans dépendance neuve) vers l'URL
     ABSOLUE de `/installer`, lue du `host`/`x-forwarded-proto` **de la
     requête qui ouvre la page**, jamais d'une variable d'environnement qui
     daterait du déploiement.
   - Aucune donnée personnelle ni de société sur l'affiche.
   - L'impression suit le mécanisme déjà posé par `print-bon`/`print-vgp`
     (`app/globals.css`) — même raison citée trois fois dans ce fichier :
     `:has()` mesuré et refusé pour ce geste. Une 4ᵉ occurrence du même
     mécanisme, jamais une variante.
   - Lien ajouté sur `/parametres/equipe`, à côté de « Ajouter une personne ».

5. **Textes** — tous nouveaux dans `lib/i18n/fr.ts`, préfixes `pwa.installer.*`
   (bouton/bandeau), `pwa.page_installer.*` (page publique), `pwa.etape.*`
   (interstitiel), `pwa.affiche.*` + `equipe.affiche.lien` (affiche).

6. **Épreuves** :
   - Unitaires : les deux fonctions de détection (point 1).
   - Bout en bout : `/installer` pour les trois agents et l'absence de donnée
     de société ; une connexion ordinaire qui ne voit jamais l'étape
     d'installation ; `/installation` qui rend ses trois cas et dont « Plus
     tard » mène à la bonne destination ; `/installation` qui exige une
     session. Voir le point ouvert ci-dessous sur ce qui n'est PAS couvert.

## Décisions prises en cours de route

- **Le signal « vient de choisir son mot de passe » voyage par un champ caché
  de formulaire, jamais par un cookie.** Un cookie aurait exigé de le poser,
  le lire, puis le faire expirer ou le consommer explicitement — trois gestes
  pour un signal qui tient en un paramètre d'URL le temps d'un aller-retour.
  Le motif `premier_acces.abouti` affiché sur `/connexion` (déjà une CLÉ,
  jamais un texte, D35) sert de condition pour poser le champ ; `/api/session/
  connexion` le reporte à son tour ; `/arrivee` décide seule, selon le rôle.
  Trois redirections, chacune portant un bout du signal, aucune ne le
  réinterprète.
- **`decision.ts` reste pur et inchangé.** La bifurcation vers `/installation`
  vit dans `page.tsx`, après l'appel à `destinationSiSocieteUnique` — une
  seconde lecture du critère « ce rôle va-t-il à `/terrain` ? » aurait pu
  diverger du premier en silence (§9, 01/09) ; la condition compare le
  RÉSULTAT déjà calculé (`destination === "/terrain"`) plutôt que de relire le
  rôle ou le périmètre une seconde fois.
- **`BoutonInstallerCodiplan` est réutilisé tel quel dans l'interstitiel.** Le
  brief demande « les mêmes trois cas » pour l'étape après le premier accès —
  c'est littéralement le même composant, pas une seconde forme du même
  rendu.
- **Le bandeau iOS recopiait `bg-app-surface`/`border-app-bord`/`border`/
  `rounded-*` à la main** (mesuré par `tests/unit/ui/carte-pas-recopiee.test.ts`,
  qui a rougi) : remplacé par `<Carte>` (titre + `enTeteDroite` pour le bouton
  de fermeture). Le bouton Android, qui porte la même combinaison de classes
  que le lien « Scanner » déjà existant sur `/terrain` (`app/(mobile)/terrain/
  page.tsx`, hors du périmètre de ce gardien), est ajouté aux `EXCEPTIONS` du
  même fichier (catégorie « bouton »), parce que c'est un `<button>` qui AGIT,
  jamais un encadré à lire.
- **`lib/pwa/` déclaré au §6** (`docs/constitution/organisation-du-code.md`),
  régénéré par `pnpm sommaires:regenerer`. Deux numéros de ligne que
  `tests/unit/docs/constitution-indexee.test.ts` fixait en dur sur l'ancien
  état du fichier (`lib/auth/` ligne 121→122, `lib/db/` ligne 75→76 dans son
  propre scénario de mutation) ont été corrigés pour la même raison —
  recalculer une référence à un fichier qui a légitimement bougé n'est pas
  assouplir une assertion.
- **L'URL du QR de l'affiche est lue du `host` de la requête, jamais d'une
  variable d'environnement.** Aucune convention de ce genre n'existait dans
  le dépôt (grep vide sur `NEXT_PUBLIC_URL`/`URL_PRODUCTION` côté affichage) ;
  lire `headers()` au moment de l'ouverture de la page est la seule source qui
  ne peut pas dater.

## Un quirk d'outillage rencontré, sans conséquence pour le lecteur

Aucun — les deux gardiens qui ont rougi (organisation du code, Carte recopiée)
l'ont fait pour de bonnes raisons, documentées ci-dessus, pas par un défaut de
l'outillage.

## Territoire respecté

- Aucune migration, `prisma/` non touché.
- Aucune politique RLS.
- `app/manifest.ts` et `public/sw.js` lus, jamais modifiés.
- `lib/auth/**` touché seulement pour l'aiguillage d'après premier accès
  (`app/(apres-session)/arrivee/page.tsx`, `app/(sans-session)/connexion/
  page.tsx`, `app/api/session/connexion/route.ts`) — annoncé ci-dessus comme
  demandé par le lot, aucune règle d'authentification elle-même n'a changé.
- `app/(back-office)/template.tsx` non touché.
- `CLAUDE.md` non touché.
- Aucune dépendance nouvelle (le QR réutilise `components/ui/qr-code.tsx`,
  déjà fondé sur `qrcode-generator`).
- Aucune donnée de production, aucun identifiant réel.

## Points ouverts, et pourquoi ce lot les laisse ouverts

- **La connexion EFFECTIVEMENT passée par `/premier-acces` n'est pas rejouée
  par un navigateur.** `COMPTE_TECHNICIEN_EPREUVE` a déjà choisi son mot de
  passe avant que les fichiers de ce lot ne s'exécutent
  (`tests/e2e/setup/global.ts`) — `choisirLePremierMotDePasse` refuse un
  compte dont `mot_de_passe` n'est plus `NULL`. Rejouer le chemin complet
  exigerait sa propre scène (une identité, une habilitation sur UNE société,
  un jeton émis par `reemettreJetonPremierAcces`), au même coût que
  `tests/e2e/acces-technicien.spec.ts` (sa propre scène, préfixée, détruite en
  `afterAll`). Les trois épreuves livrées couvrent tout ce qui est EN AVAL du
  champ caché (une connexion ordinaire ne le voit pas, `/installation` rend et
  mène correctement, la session est exigée) ; ce qui reste dû est la preuve
  que `/premier-acces` lui-même pose bien le champ au bon moment, de bout en
  bout, à travers un vrai navigateur.
- **Aucune capture AVANT/APRÈS.** Ce lot n'a pas posé de capture « AVANT » au
  tout début de la session, sur le code non modifié — une omission mesurée
  après coup, trop tard pour la corriger sans fausser la paire (une capture
  « avant » prise maintenant montrerait déjà du code d'un autre lot livré
  depuis). Produire malgré tout des captures « APRÈS » seules aurait rendu un
  README qui prétend comparer sans rien à comparer. Les cinq écrans touchés
  ou créés (journée, profil, page post-premier-accès, `/installer`, affiche)
  restent à capturer par le lot qui rouvrira ce territoire, ou par une reprise
  dédiée.
- **Le second facteur et le champ caché** — voir la limite nommée au point 3
  ci-dessus.

## `pnpm verify:full`, en entier

Voir `verify-final.txt`, produit en fin de lot.
