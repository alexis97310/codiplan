# 9L46-FINITIONS-LISTE-TELEPHONE-MDP-TECHNICIEN — passation

Réserve de revue (feuille de route, section « Réserves des revues, à regrouper ») : « Finitions :
liste déroulante sur téléphone (clavier, bas d'écran), écran de changement de mot de passe pour le
technicien. » Deux sujets, deux correctifs — aucune migration, aucune règle métier touchée.

## AUCUNE MIGRATION

Conforme à la consigne : rien dans `prisma/schema.prisma` n'a bougé.

## Point 1/2 — la liste déroulante masquée par le clavier tactile

### Mesure

Aucun composant commun de liste n'existe en dehors de
`components/ui/selecteur-recherche.tsx` (SELECTEURS-1) — c'est la SEULE liste à panneau rendu en
JavaScript (position calculée) du dépôt. Le `<select>` natif de
`components/terrain/checklist-terrain.tsx` (quand une checklist a plus de `MAX_OPTIONS_SEGMENTS`
choix) ouvre un picker du SYSTÈME D'EXPLOITATION, jamais un panneau posé par ce dépôt : aucun calcul
de ce dépôt ne décide où il s'affiche, et il n'y a donc rien à corriger là.

Mesuré sur `SelecteurRecherche` : son panneau se positionne déjà bien (9I7E/9I7E1/9I8E — retourne
vers le haut si la place manque, borné à la fenêtre). Le défaut mesuré est ailleurs : tous ces
calculs lisent `window.innerHeight`, qui NE RÉTRÉCIT PAS quand le clavier tactile s'ouvre sur la
plupart des navigateurs mobiles (testé : seul `window.visualViewport.height` le fait). Le panneau
ouvrait donc son calcul sur la foi d'un espace que le clavier recouvrait réellement à l'écran —
exactement le défaut nommé par le ticket.

### Correctif

`components/ui/selecteur-recherche.tsx` : nouvelle fonction `hauteurVisible()` (lit
`window.visualViewport?.height ?? window.innerHeight`), utilisée partout où le composant lisait
`window.innerHeight` (le calcul de position `recalculer`, et `champEstVisible`, qui reçoit
désormais cette hauteur en paramètre plutôt que de relire `window.innerHeight` elle-même). Les
évènements `resize`/`scroll` de `window.visualViewport` (quand il existe) rejoignent ceux de
`window` déjà écoutés, pour que l'ouverture ou la fermeture du clavier, pendant que le panneau est
ouvert, redéclenche le calcul.

Aucun comportement bureau (1280 px) changé : `window.visualViewport` y vaut la même chose que
`window.innerHeight` (pas de clavier tactile), donc `hauteurVisible()` y rend exactement la valeur
d'avant.

### Épreuves

Aucun navigateur de test (Playwright, headless ou pas) n'ouvre un clavier tactile réel : le point 1
de `tests/e2e/9l46-finitions-liste-telephone-mdp-technicien.spec.ts` simule l'écart en remplaçant
`window.visualViewport` par un objet à soi (`addInitScript`, AVANT tout script de page), plus bas
que la fenêtre réelle (400 px de visible contre 800 px de fenêtre) — exactement ce qu'un clavier
tactile creuse. Le champ est placé, par défilement programmatique (jamais par un redimensionnement
de fenêtre, qui aurait changé `window.innerHeight` lui-même), à une hauteur où l'ANCIEN calcul
aurait ouvert le panneau bien au-delà des 400 px visibles ; l'épreuve prouve que le panneau reste
entièrement dans ces 400 px, et que sa dernière option reste réellement cliquable
(`elementFromPoint`, même technique que `assertListeVisibleEtCliquable`, 9I7E).

Les épreuves existantes du composant (`tests/e2e/9i8e-reserves-listes-et-pieces.spec.ts`,
`tests/e2e/9i7e-creer-machine-listes-deroulantes.spec.ts`, `tests/e2e/selecteurs-1.spec.ts`, 15
scénarios) restent vertes sans modification — le correctif ne change rien tant qu'aucun
`visualViewport` divergent n'est posé.

## Point 3/4 — l'écran de changement de mot de passe du technicien

### Mesure

`/mon-compte` (bureau, 9I9-MON-COMPTE) porte déjà le geste complet
(`changerSonMotDePasse`, `lib/auth/mon-compte.ts`) — règles de mot de passe, verrou partagé avec la
connexion (9L07/D258), second facteur reporté, journal (9L43). Ce geste est RÔLE-AGNOSTIQUE : il
relit l'identité depuis la session, jamais un paramètre reçu. Mais la route API
(`app/api/session/mon-compte/mot-de-passe/route.ts`) ne connaissait que deux destinations de retour
— `/mon-compte` (bureau) et `/portail/mon-compte` (portail, D70) — et AUCUNE des deux n'est
atteignable par un technicien : `/mon-compte` lui est fermé par le garde-fou de D221
(`app/(back-office)/template.tsx`). Le technicien n'avait donc, avant ce lot, AUCUN moyen de changer
son mot de passe une fois connecté (seul « mot de passe oublié » depuis `/connexion` l'ouvrait,
hors session).

### Ce qui a été fait

1. **`app/(mobile)/terrain/profil/mot-de-passe/page.tsx` (créé)** — même garde que
   `/terrain/profil` (`obtenirSession` puis `perimetreDuPlanning`, accès `complet` → `/planning`,
   `aucun` → `/arrivee`), même formulaire que `/mon-compte` (réutilise tel quel
   `components/session/formulaire.tsx` (`Champ`), `components/session/champs-nouveau-mot-de-passe.tsx`
   et `components/ui/message.tsx`), postant vers la MÊME route API — **aucune règle de mot de passe
   neuve, aucune capacité neuve**.
2. **`app/(mobile)/terrain/profil/page.tsx`** — un lien « Changer mon mot de passe » vers ce nouvel
   écran, posé entre le bouton d'installation PWA et le formulaire de déconnexion.
3. **`app/api/session/mon-compte/mot-de-passe/route.ts`** — la destination de retour distingue
   désormais un troisième cas : `estRolePortail` (inchangé) → `/portail/mon-compte` ; sinon,
   `perimetreDuPlanning(contexte).acces === "restreint"` (un technicien, au sens déjà tranché par
   R5-01 — jamais un `role === technicien` recopié) → `/terrain/profil/mot-de-passe` ; sinon (accès
   `complet`, bureau) → `/mon-compte` comme avant. **Aucune nouvelle route API** : la même ligne de
   `tests/unit/auth/porte.test.ts` (`EXEMPTIONS`) couvre toujours ce fichier, son compte
   `ROUTE_CAPACITE` est inchangé.
4. **`lib/i18n/fr.ts`** — deux clés neuves (`terrain.mot_de_passe.titre`, `.retour`), et une clé de
   fixture d'épreuve (`acces9l46.e2e.nom`). Les libellés de champ et les motifs de retour
   (`mon_compte.mot_de_passe.*`) sont RÉUTILISÉS tels quels — même texte, même geste derrière les
   deux écrans.
5. **Style** : écran composé des MÊMES classes Tailwind que `/terrain/profil` lui-même
   (`bg-app-surface`, `border-app-bord`, `text-16`) plutôt que des jetons « fiche terrain épurée »
   du 13/11/2026 — `/terrain/profil` et `/terrain/[id]` (la fiche à laquelle la décision du 13/11
   s'applique au premier chef) n'ont eux-mêmes pas encore migré vers ces jetons. Appliquer un style
   neuf à ce seul sous-écran l'aurait rendu incohérent avec l'écran dont il part. Reste à faire,
   hors de ce lot : la migration de `/terrain/profil` (et de ce sous-écran avec lui) vers les
   jetons `--app-terrain-*`.

### Épreuves

`tests/e2e/9l46-finitions-liste-telephone-mdp-technicien.spec.ts`, second scénario : un technicien
créé pour ce lot (compte propre, jamais la scène partagée) reçoit son lien de premier accès, choisit
son mot de passe, se connecte (375 px), ouvre « Profil » → « Changer mon mot de passe », se voit
refuser un mot de passe actuel faux (ramené sur CE même écran, jamais `/mon-compte`), puis aboutit,
se déconnecte, et rouvre une session avec le mot de passe choisi. Scène nettoyée en totalité
(`journal_acces`, `session`, `compte`, `technicien`, `utilisateur_societe`, `utilisateur`).

`tests/unit/ui/composants-base.test.tsx` — le témoin de boutons `size="lg"` du terrain (fermé,
32 → 33) est mis à jour pour compter le bouton neuf de cet écran ; `tests/unit/ui/retouches-2a.test.ts`
porte une liste FERMÉE de 7 fichiers distincte (`FICHIERS_TERRAIN`) qui n'inclut pas ce fichier
neuf — son propre témoin (32) est donc inchangé.

## Captures

`docs/propositions/9L46-FINITIONS-LISTE-TELEPHONE-MDP-TECHNICIEN/captures/` — `/terrain/profil`
(AVANT/APRÈS, 375 px : le lien neuf) et `/terrain/profil/mot-de-passe` (AVANT = 404 réel, capturé
sur le commit précédent par un worktree jetable ; APRÈS = l'écran créé). Prises avec un spec e2e
temporaire (`tests/e2e/zz-captures-9l46.spec.ts`), jamais committé, supprimé après usage — recette
du worktree jetable (même technique que GR17 : `node_modules` lié, `.env` copié, aucune
réinstallation).

**`docs/captures/` (galerie globale) non rejouée.** `pnpm captures:etat` constate 76 fichiers de
surface déjà divergents du commit photographié (`6d207f0`), accumulés par plusieurs lots antérieurs
(9L38 à 9L44 notamment) sans que la galerie n'ait été reprise depuis. Ni `/terrain/profil` ni
`/terrain/profil/mot-de-passe` ne font partie des ~70 écrans qu'elle couvre (vérifié par recherche
dans `docs/captures/README.md`) : rejouer la galerie entière maintenant n'aurait changé AUCUNE des
images déjà commises — seul l'en-tête (commit, date) aurait bougé — pour le prix d'un cycle complet
(migration + semis + construction + ~280 captures). Laissé à un lot de rattrapage dédié, sur le
modèle de 9L45 (qui a déjà comblé un rattrapage analogue pour un autre périmètre).

## Épreuves rejouées

`pnpm test` : 540 fichiers, 6098 tests, vert (après correction du témoin ci-dessus).
`pnpm test:isolation` : 268 fichiers, 2581 tests, vert — inchangé par ce lot (aucune table du
périmètre d'audit touchée). `CI=1 pnpm verify` à jouer après le rebase.

## Feuille de route

L'élément de réserve a migré de « Réserves des revues, à regrouper » (qui disparaît, vidée de son
seul élément) vers « Livré depuis le 31/10 » (`lib/feuille-de-route/contenu.ts`), référencé 9L46.
`DATE_ETAT_FEUILLE_DE_ROUTE` déjà au 26/11/2026 (posée par le lot précédent, le jour même) —
inchangée.

## Arbitrage

Aucun numéro `D-xxx` neuf : aucune règle métier, aucun montant, aucun délai n'a été inventé.
La seule décision d'implémentation qui mérite d'être nommée ici — la destination de retour suit
`perimetreDuPlanning(...).acces === "restreint"`, jamais `role === technicien` recopié — applique
R5-01 tel qu'il est déjà tranché, elle ne le réinterprète pas.

## Reste à faire (hors budget de ce lot)

- Migrer `/terrain/profil` (et son sous-écran neuf) vers les jetons « fiche terrain épurée » du
  13/11/2026, comme le reste de l'application technicien le fera.
- Rattraper `docs/captures/` (galerie globale), en retard de 76 fichiers de surface sur plusieurs
  lots antérieurs à celui-ci.
