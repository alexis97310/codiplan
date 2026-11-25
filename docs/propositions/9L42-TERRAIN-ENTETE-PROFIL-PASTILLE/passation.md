# 9L42-TERRAIN-ENTETE-PROFIL-PASTILLE — passation

Ligne « m8, m10b et m13 » de la feuille de route (audit du 10/11/2026 ; maquettes 01-journee et
07-profil, absentes du dépôt — mêmes contraintes déjà rencontrées par 9K25A et 9L41). **Aucune migration.**

## Réserve à trancher avec Alexis — IMPORTANT, lire avant tout le reste

Le ticket demandait de retirer « Se déconnecter » **de l'en-tête**, en plus de l'y laisser dans Profil (déjà
le cas depuis QE-11/D161). Mesuré avant d'écrire une ligne : « Se déconnecter » du bandeau du haut
(`components/navigation/barre.tsx`, `DeconnexionClaire`) est protégé par une décision nommée — docblock de
`tests/unit/navigation/deconnexion-chrome.test.tsx` : **« LA DÉCONNEXION EST DANS LE CHROME, DANS LES TROIS
COQUES (N-02, arbitrage du 16/09/2026) »**, précisément parce qu'aucune des trois mises en page (back-office,
portail, terrain) ne réimplémente le chrome, et que ce test — `describe.each` sur les trois — est la SEULE
preuve pour le portail et le terrain (aucun compte de portail ne peut se connecter pour une épreuve de bout en
bout, et `tests/e2e/deconnexion.spec.ts` le note aussi pour le terrain). `components/navigation/marque.tsx`
donne la raison d'être de cette décision : la pastille de société a justement été retirée de là en 2026 parce
qu'elle « occupait en permanence la place la plus chère de l'écran — celle que la déconnexion réclamait ».

**Retirer « Se déconnecter » du bandeau terrain revient donc à amender N-02 pour ce seul segment** — une vraie
décision, pas un détail d'implémentation, et `tests/e2e/9g3-point2-cibles-375.spec.ts` (« à 375 px, « Se
déconnecter » du bandeau terrain atteint 44 px ») en dépend directement. CLAUDE.md l'interdit sans arrêt :
« Interdit absolu : modifier, désactiver ou assouplir un test pour faire passer la vérification. » Décision
prise **sans arrêt bloquant**, à la manière de 9L41 sur sa maquette absente :

- **« Se déconnecter » n'a PAS été retiré du bandeau du haut.** Il y reste, inchangé, dans les trois coques —
  N-02 tient. Il est bien « rangé dans Profil » (déjà le cas), simplement pas retiré d'ailleurs.
- **« Installer l'application », lui, a été retiré de « Ma journée »** (voir plus bas) : rien ne le protégeait
  à cet endroit (aucune épreuve ne le cible sur `/terrain`), et le dégager de l'écran le plus consulté de la
  journée est la part incontestée de la demande.
- **La pastille réseau, elle, a été posée sur le propre en-tête de CHAQUE ÉCRAN** (le `<h1>` de « Ma journée »
  et celui de « Profil »), pas sur le bandeau du chrome — lecture cohérente avec « maquettes 01-journee et
  07-profil » (un en-tête par écran, pas un bandeau commun aux trois segments), et qui évite justement de
  rouvrir N-02 pour loger un élément neuf dans un bandeau déjà plein.

Si Alexis veut que « Se déconnecter » disparaisse aussi du bandeau terrain (en ne le laissant que dans
Profil), c'est un changement SÉPARÉ : amender N-02 pour le seul segment terrain (numéro d'arbitrage à poser),
et retoucher `deconnexion-chrome.test.tsx` pour qu'il ne couvre plus que les deux autres coques — non fait ici
par prudence, les deux captures AVANT/APRÈS du montrent d'ailleurs tel quel.

## Ce qui a été livré

1. **La pastille réseau** — `components/terrain/pastille-reseau.tsx` (neuf), `PastilleReseau` : « En ligne »
   ou « Hors ligne », suivi de « · N saisie(s) en attente » dès que la file n'est pas vide (même source que
   `BoutonEnvoyer` : `compterEnAttente` et `EVENEMENT_FILE_MODIFIEE` de `lib/terrain/file-saisies.ts`, aucune
   seconde lecture du même fait). Posée à côté du `<h1>` de `app/(mobile)/terrain/page.tsx` (« Ma journée ») et
   de `app/(mobile)/terrain/profil/page.tsx` (« Profil »), dans une rangée `flex-wrap` : une ligne dans le cas
   courant (« En ligne », court), et un retour à la ligne plutôt qu'un débordement dans le cas long (« Hors
   ligne · N saisie(s) en attente ») — les deux cas sont mesurés par l'épreuve e2e (point 4).

   **Couleur, décision du style épuré (13/11/2026)** : `app/globals.css` (`[data-zone="terrain"]`) réserve le
   vert à une RÉPONSE DONNÉE, jamais un état qui change seul. « En ligne » reste donc neutre
   (`bg-app-surface-creuse`/`text-app-encre-faible`) ; seul l'état qui demande un geste (hors réseau, ou une
   file qui ne se vide pas) reprend l'ambre déjà posé par `BandeauReseau`/`BoutonEnvoyer`
   (`border-app-orange-bord bg-app-orange-fond text-app-orange-encre`) — jamais une seconde palette pour le
   même fait. L'état n'est jamais donné par la seule couleur : le mot porte l'information.

   Deux clés neuves dans `lib/i18n/fr.ts` : `terrain.reseau.en_ligne`, `terrain.reseau.hors_ligne`,
   `terrain.reseau.saisie_attente` (« saisie(s) en attente », littéral — demandé ainsi par le ticket).

2. **« Installer l'application » retiré de « Ma journée »**, rangé seulement dans Profil (déjà présent) —
   `app/(mobile)/terrain/page.tsx` ne l'importe plus. Un geste posé une seule fois n'a rien à faire en tête
   d'un écran consulté des dizaines de fois par jour.

3. **En-tête sur une ligne** — chaque écran (« Ma journée », « Profil ») affiche désormais son titre et la
   pastille sur la même ligne à 375 px dans le cas courant, mesuré par l'épreuve e2e sans débordement
   (`document.documentElement.scrollWidth`).

## Épreuves

- `tests/e2e/9l42-terrain-entete-profil-pastille.spec.ts` (neuf, 3 scénarios, aucune scène propre — la
  pastille ne lit que `navigator.onLine` et la file IndexedDB, locale au NAVIGATEUR, jamais partagée entre
  fichiers sous `fullyParallel`) :
  1. à 375 px, « Ma journée » et « Profil » tiennent sur une ligne, pastille « En ligne », « Installer
     l'application » absent de « Ma journée » et présent dans Profil, « Se déconnecter » présent dans le CORPS
     de Profil (`main`, pour l'isoler du bandeau du chrome) ;
  2. hors réseau (`context.setOffline(true)`), la pastille passe à « Hors ligne » ;
  3. une saisie déposée directement dans la file IndexedDB (même technique que `antidaterLeDemarrage` d'autres
     épreuves hors réseau) fait apparaître « En ligne · 1 saisie(s) en attente » sur Profil, même en ligne,
     sans faire déborder la page — le cas de texte le plus long mesuré explicitement.
- Rejouées, vertes : `tests/e2e/9f4h5b-ma-journee-375.spec.ts`, `tests/e2e/9g3-point2-cibles-375.spec.ts`
  (dont « Se déconnecter » du bandeau terrain, toujours à 44 px), `tests/e2e/terrain-largeur.spec.ts`,
  `tests/e2e/offline/9f4h1-consultation.spec.ts`, `tests/e2e/offline/9f4h3a-file-sans-perte.spec.ts` — ce
  dernier régénère ses PROPRES captures (`docs/propositions/9F4H3A-FILE-SANS-PERTE/captures/`, écran Profil
  désormais avec la pastille) ; restaurées par `git checkout --` avant commit, étrangères à ce lot (même
  réflexe que 9K25A).
- `pnpm test` (6095 tests), `pnpm test:isolation` (2573 tests) passent intégralement.

## Captures de ce lot

`docs/propositions/9L42-TERRAIN-ENTETE-PROFIL-PASTILLE/captures/` — AVANT (code d'avant ce lot, commit
`d3d65bb2c`, obtenu par un `git checkout` temporaire des seuls fichiers touchés — jamais un stash, ce lot
commite au fil de l'eau — puis restauré, `pnpm typecheck` rejoué vert) et APRÈS, à 375 px :
`{avant,apres}-ma-journee.png`, `{avant,apres}-profil.png`. On y voit la pastille apparaître à côté du titre,
« Installer l'application » disparaître de « Ma journée », et « Se déconnecter » inchangé aux deux endroits
où il vivait déjà (bandeau du haut et corps de Profil).

## Feuille de route

`lib/feuille-de-route/contenu.ts` : « m8, m10b et m13 » migré vers « Livré depuis le 31/10 », avec sa réserve
écrite dans le texte même (Se déconnecter, N-02) ; retiré de « Application technicien — audit du 10/11/2026 »,
où P6 seul reste. `tests/unit/feuille-de-route/contenu.test.ts` mis à jour en conséquence (section réduite à
un seul élément). `DATE_ETAT_FEUILLE_DE_ROUTE` déjà au 25/11/2026, inchangée.

## Porte de sortie

`pnpm test`, `pnpm test:isolation`, `CI=1 pnpm verify` passent tous, rejoués en avant-plan.
