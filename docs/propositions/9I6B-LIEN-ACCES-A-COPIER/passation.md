# 9I6B-LIEN-ACCES-A-COPIER — passation

## Le besoin, et la décision d'Alexis (29/10/2026)

« pour les comptes utilisateur, je dois pouvoir activer le compte manuellement dans les
paramètres (je n'ai pas encore de nom de domaine) » → choix **A** : un bouton « Copier le lien
d'accès » dans Paramètres → Équipe. **La personne choisit toujours elle-même son mot de
passe : l'administrateur ne le connaît jamais.** Le lien expire comme aujourd'hui (une heure,
`DUREE_LIEN_PREMIER_ACCES_SECONDES`).

## Point 1 — la mesure

- `lib/auth/lien-d-acces.ts` (`envoyerLienDAccesPartage`) : vérifie `administrer_utilisateurs`
  côté serveur, lit l'identité par désignation, pose le compte « au repos » si besoin, fait
  émettre le jeton par une instance munie du canal (`url` capturée via `creerAuth`), puis
  envoie le courriel. `envoyerLienPremierAcces` ne lève jamais : un canal non configuré ou un
  refus de Resend rend `{ parti: false, motif }`.
- Sans nom de domaine vérifié, **Resend refuse tout destinataire qui n'est pas Alexis** : la
  trace s'écrit quand même (`ouverture_identite`/`reemission_premier_acces`), mais le
  destinataire réel ne reçoit jamais le courriel. L'écran affichait déjà ce cas
  (`equipe.acces.non_parti`), sans offrir de porte de sortie.
- Durée de validité du lien : une heure (`DUREE_LIEN_PREMIER_ACCES_SECONDES`, `lib/auth/
  config.ts:162`), affichée en clair (« Lien copié — valable une heure… », même texte que le
  badge existant `equipe.acces.badge.valable_une_heure`).
- Trace au journal : `journal_acces`, événement `ouverture_identite` (premier envoi) ou
  `reemission_premier_acces` (réémission), auteur l'administrateur, `detail` nomme la cible
  par un marqueur `cible:<id>` en fin de chaîne (`viseCetteCible`). **Jamais l'URL
  elle-même** — c'était déjà vrai pour l'envoi (seul le motif du prestataire y figure), et
  reste vrai pour la copie.

## Point 2 — serveur

`lib/auth/lien-d-acces.ts` : la préparation commune (garde de capacité, identité, cliquet de
D65, compte au repos, émission du jeton) est extraite dans `preparerLienDAcces`, privée,
partagée par `envoyerLienDAccesPartage` (inchangée en comportement) et la fonction neuve
`copierLienDAccesPartage`, qui rend `{ accepte: true, url }` au lieu d'envoyer un courriel, et
trace « lien copié par l'administrateur » (jamais le jeton) dans `detail`.

`lib/auth/acces-technicien.ts` / `lib/auth/acces-bureau.ts` : `copierLienDAcces` /
`copierNouveauLienDAcces` (et leurs équivalents `*Bureau`) posent la même question
d'appartenance que les fonctions d'envoi existantes (`technicienMembreEtActif` /
`compteDeBureauMembre`) avant d'appeler `copierLienDAccesPartage` — **même refus, même
cloisonnement, même cliquet D65 que l'envoi**, aucune règle nouvelle.

Quatre routes JSON, même garde `administrer_utilisateurs` que les routes d'envoi
existantes (`exigerCapacite`, identifiant dans le chemin, jamais le corps) :

- `POST /api/equipe/[id]/copier-lien` (premier lien, technicien)
- `POST /api/equipe/[id]/copier-nouveau-lien` (mot de passe oublié, D86, technicien)
- `POST /api/equipe/bureau/[id]/copier-lien` (bureau)
- `POST /api/equipe/bureau/[id]/copier-nouveau-lien` (bureau)

Chacune rend `{ url }` en JSON si acceptée, `{ erreur: motif }` sinon (`403` si la capacité
manque, `200` pour un refus nommé du geste lui-même) — jamais une redirection : c'est l'écran,
côté navigateur, qui pose l'URL dans le presse-papiers.

## Point 3 — écran

`components/equipe/bouton-copier-lien.tsx` (`BoutonCopierLien`) : un bouton client qui appelle
la route, écrit l'URL au presse-papiers (`navigator.clipboard.writeText`) et affiche « Lien
copié — valable une heure. Envoyez-le à la personne, elle choisira son mot de passe. » ; si le
navigateur refuse le presse-papiers, l'URL est montrée UNE fois dans un champ en lecture seule
sélectionnable (`onFocus` → `select()`). L'URL ne vit que dans l'état local de ce composant.

Posé :

- à côté du bouton Envoyer/Renvoyer existant, pour chaque technicien/compte sans mot de passe
  (`GesteAccesTechnicien`, `BlocAcces`, `GesteAccesBureau` — `app/(back-office)/parametres/
  equipe/page.tsx`) ;
- comme seconde entrée du menu « … » d'un accès déjà actif (`EntreeCopierLien`,
  `menu-nouveau-lien.tsx`), à côté de « Envoyer un nouveau lien d'accès » — même cliquet D65
  sauté (mot de passe oublié, D86).

Visible seulement à qui détient `administrer_utilisateurs` : c'est la garde d'entrée de
l'écran lui-même (inchangée), aucune garde supplémentaire n'était nécessaire.

## Point 4 — épreuves

**Isolation** (`tests/isolation/acces-technicien.test.ts`, `tests/isolation/
acces-bureau.test.ts`) : premier appel (compte au repos, trace « lien copié par
l'administrateur », jamais le jeton), second appel (`reemission_premier_acces`), cliquet D65 et
son contournement « nouveau lien », **un rôle sans droit (ADV) refusé avant toute écriture**,
**une cible d'une AUTRE société introuvable** (même refus qu'un identifiant inconnu, D50).

**e2e** (`tests/e2e/9i6b-lien-acces-a-copier.spec.ts`) : un administrateur copie le lien d'un
technicien de sa propre scène (presse-papiers accordé, lu après le clic), l'ouvre dans un
AUTRE contexte navigateur (déconnecté), choisit son mot de passe, se connecte jusqu'à
`/terrain` ; la page qui vient de copier, rechargée, ne contient jamais le lien en clair. Un
second test forge une requête `POST /api/equipe/<id>/copier-lien` depuis une session ADV et
mesure le refus `403 { erreur: "acces_refuse" }` rendu par la route elle-même.

**Écart assumé** : le refus « admin d'une AUTRE société », pour la voie e2e, n'est PAS rejoué
par un second compte `admin_societe` enrôlé dans une seconde société du harnais (coût élevé,
aucun compte `admin_societe` de CODIMA-EU n'existe dans le semis — seule `direction@codima.test`
a une double habilitation, et c'est un rôle sensible qu'il aurait fallu enrôler au second
facteur rien que pour cette mesure). La route (`app/api/equipe/[id]/copier-lien/route.ts`)
n'ajoute RIEN entre `exigerCapacite` et l'appel direct de `copierLienDAcces` : l'épreuve
d'isolation qui appelle cette même fonction avec un contexte de société A sur une cible de
société B EST la requête forgée, au même titre qu'un appel HTTP avec un cookie d'une autre
société — documenté en tête du fichier e2e.

Isolation (`pnpm test:isolation`) : verte, 1696 épreuves (10 nouvelles pour ce lot), sans
assouplissement d'aucune RLS — ce lot ne touche à aucune politique.

## Point 5 — captures

`tests/e2e/captures-9i6b-lien-acces-a-copier.spec.ts` (même discipline que
`captures-9dja-acces-technicien.spec.ts`, dossier gardé par une variable d'environnement) a
produit, dans `docs/propositions/9I6B-LIEN-ACCES-A-COPIER/captures/` :

| Fichier | Taille |
|---|---|
| `equipe-copier-lien-bouton-1280.png` | 194 301 octets |
| `equipe-copier-lien-bouton-375.png` | 150 426 octets |
| `equipe-copier-lien-message-1280.png` | 199 803 octets |
| `equipe-copier-lien-message-375.png` | 153 798 octets |

Aucun lien réel visible dans aucune des quatre (le message de succès ne porte jamais l'URL ;
le repli presse-papiers, qui la porterait, n'est jamais atteint puisque la permission est
accordée avant le clic).

## `CI=1 pnpm verify:full`

Sortie complète dans `verify-final.txt` (ce dossier). Si `test:e2e` (la suite COMPLÈTE,
~1700 épreuves, un seul worker) ne finit pas dans le temps imparti, c'est noté comme tel — le
sous-ensemble pertinent (`equipe.spec.ts`, `equipe-1.spec.ts`, `acces-technicien.spec.ts`,
`acces-bureau.spec.ts`, `9i6b-lien-acces-a-copier.spec.ts`, 10 épreuves) a été rejoué
séparément et verdict vert, sans régression, avant d'écrire cette passation.

## Territoire tenu

Aucune migration. Aucun mot de passe saisi ou connu par l'administrateur. Aucun lien d'accès
écrit dans un fichier, un journal ou une capture. Événements de journal réutilisés
(`ouverture_identite`, `reemission_premier_acces`) — aucun événement neuf, aucune migration
d'enum.
