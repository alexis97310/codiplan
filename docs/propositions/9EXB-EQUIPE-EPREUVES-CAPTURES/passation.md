# 9EXB-EQUIPE-EPREUVES-CAPTURES — passation

## Ce qui a été livré (5 commits `9EXB-EQUIPE-EPREUVES-CAPTURES`)

1. **Captures** (`tests/e2e/captures-9exb-equipe.spec.ts`,
   `docs/propositions/9EXB-EQUIPE-EPREUVES-CAPTURES/captures/`) — neuf images, EN VIEWPORT
   (sans `fullPage`), 375 et 1280 px : onglet Techniciens rempli, menu « … » ouvert, dialogue
   « nouveau lien » (D86), onglet Comptes de bureau, cartes sous 900 px. Toutes regardées :
   tableau à 1280, bascule en cartes à 375 (tableau masqué), menu et dialogue lisibles aux deux
   largeurs, onglet bureau correctement activé (un premier essai capturait l'onglet Techniciens
   par erreur — l'assertion qui suivait le clic ne garantissait pas la navigation, corrigé par
   `page.waitForURL(/onglet=bureau/)`). Aucune fixture neuve : la scène globale
   (`tests/e2e/setup/scene.ts`) ouvre déjà un compte ACTIF pour un technicien
   (`COMPTE_TECHNICIEN_EPREUVE`) et pour plusieurs comptes de bureau — assez pour montrer le menu
   « … » des deux types de personne sans rien écrire en base.

2. **Isolation — une fuite inter-société RÉELLE, corrigée** (`lib/auth/acces-technicien.ts`,
   `tests/isolation/acces-technicien.test.ts`, `tests/isolation/acces-bureau.test.ts`).
   `etatsAccesDesTechniciens` lisait l'état d'accès de N'IMPORTE QUEL `utilisateurId` transmis,
   SANS vérifier son appartenance à la société active — contrairement à sa sœur
   `etatsAccesDesComptes` (`lib/auth/acces-bureau.ts`), qui calcule `idsValides` avant de
   répondre. Seule la discipline des deux appelants (`page.tsx`, `lib/tableau-de-bord/
   lectures.ts`, qui ne transmettent que des listes déjà filtrées par société) protégeait
   l'écran — un appel direct avec l'identifiant d'un technicien de la société B rendait son état
   RÉEL (dont « actif », donc l'existence d'un mot de passe). Une épreuve d'isolation le mesure
   AVANT correctif (échoue), le correctif ajoute un filtre `idsValides` explicite (même parade que
   `etatsAccesDesComptes`), l'épreuve passe après. Complète aussi deux trous nommés par le pilote :
   `envoyerNouveauLienDAccesBureau` contre un VRAI compte de bureau de la société B (refuse
   `introuvable`, aucun journal écrit — déjà protégé par le filtre `societe_id` de
   `compteDeBureauMembre`, confirmé plutôt que corrigé) ; un administrateur membre des DEUX
   sociétés n'influence jamais l'état lu pour l'autre société (déjà protégé, confirmé).

3. **Refus sans droit** (`tests/unit/equipe/nouveau-lien-refus-sans-droit.test.ts`) — les deux
   routes `nouveau-lien` (technicien et bureau) refusent quand `exigerCapacite` rend `null`
   (ADV, technicien), redirigent vers `motifDuRefus()`, et n'appellent JAMAIS le geste d'envoi.

4. **Mot de passe déjà posé** (`tests/isolation/nouveau-lien-mot-de-passe-deja-pose.test.ts`) —
   épreuve d'intégration de bout en bout : un compte qui a DÉJÀ choisi son mot de passe, puis
   reçoit un « nouveau lien » (D86), peut en choisir un second sur `/premier-acces`
   (`choisirLePremierMotDePasse` n'a aucune garde sur l'état antérieur du compte) ; l'ancien mot
   de passe reste valide jusqu'à l'usage EFFECTIF du nouveau lien, qui le remplace. **Confirmé tel
   quel, aucun correctif requis** — le comportement attendu par le pilote est bien celui observé.
   Le jeton de réinitialisation est lu directement dans `verification`
   (`identifiant = "reset-password:<jeton>"`, `valeur = utilisateurId`, mesuré dans le code source
   de `better-auth`), `envoyerNouveauLienDAcces` ne le rendant jamais lui-même.

5. **E2E** (`tests/e2e/9exb-equipe-techniciens.spec.ts`, fixtures `zz9EXB-`, nettoyage
   `afterAll`) : (a) les trois tags d'habilitation triés par code, avec leurs trois couleurs
   (expirée/à renouveler ≤ 60 j/lointaine) ; (c) les quatre états d'accès dont « Lien expiré » via
   un journal antidaté ; (d) le menu « … » envoie un nouveau lien pour un technicien ET pour un
   compte de bureau, bandeau « Lien envoyé à <courriel> » dans les deux cas ; (e) à 375 px, cartes
   visibles, tableau caché, aucun débordement horizontal (`scrollWidth ≤ 375`) ; (f) l'ADV refuse
   à l'écran ET au serveur (route `nouveau-lien` forgée directement avec sa session).

## Points ouverts

- **Scénario (b) du point 5, NON ÉCRIT** (budget de temps) : « À venir » — 0 intervention →
  « aucune » grisé ; N interventions avec un accès NON actif → texte orange + « sans accès à
  l'application ». `compterInterventionsAVenirParTechnicien` (`lib/techniciens/depot.ts`) exige
  une scène client/site/intervention complète en plus du technicien, hors du budget de ce lot. Le
  code lui-même n'a pas été touché — seule l'épreuve manque.
- Les épreuves voisines mesurées vertes séparément (`pnpm test:isolation` en entier : 177 fichiers,
  1568 tests, 0 échec) ; la suite e2e COMPLÈTE (dont les épreuves voisines `*equipe*`, `*acces*`,
  `*premier-acces*`, `porte*`) est couverte par `CI=1 pnpm verify:full` ci-dessous, jouée EN ENTIER
  en un seul appel plutôt que fichier par fichier, pour la même raison que la note de 9EXA : une
  suite qui éprouve tous les maillons n'éprouve pas la chaîne au complet tant qu'elle ne tourne pas
  d'un bloc.

## `CI=1 pnpm verify:full` — voir `verify-final.txt` dans ce même dossier pour la sortie complète
