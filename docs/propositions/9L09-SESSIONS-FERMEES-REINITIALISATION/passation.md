# 9L09-SESSIONS-FERMEES-REINITIALISATION — passation

Décision d'Alexis du 10/11/2026 (« OK »). Écrite en `docs/arbitrages.md` sous **D266**.

## Ce qui a été livré

1. **`lib/auth/fermeture-sessions.ts`** (nouveau) — `fermerSessionsDuCompteDansLaTransaction(tx, utilisateurId)`
   et `fermerSessionsDuCompte(client, utilisateurId)`. Le patron (poser `app.utilisateur_id` sur la
   CIBLE, puis `session.deleteMany`) existait déjà, recopié trois fois (`revoquerAccesPortailClient`,
   `retirerAccesInterne`, `fermerLesAutresSessions` de `lib/auth/mon-compte.ts`) — ce module factorise
   la forme pour les deux nouveaux appelants ci-dessous, SANS toucher aux trois call-sites existants
   (hors périmètre de ce ticket, et ils ont chacun une forme légèrement différente : fermeture
   partielle selon la société, ou fermeture de « toutes sauf une »).

2. **`lib/auth/reinitialisation.ts`** (`reinitialiserSecondFacteur`) — ferme désormais TOUTES les
   sessions du SUJET, en DERNIER geste de la transaction `avecContexteRls` qui porte déjà les deux
   écritures de 9IA (`second_facteur`, `utilisateur.mfa_actif`). `app.utilisateur_id` valait l'AUTEUR
   pour ces deux écritures (I8) ; il est réarmé sur le SUJET juste avant `session.deleteMany`, et rien
   d'autre ne le relit après dans cette transaction.

3. **`lib/auth/premier-acces.ts`** (`choisirLePremierMotDePasse`) — ferme désormais TOUTES les sessions
   déjà ouvertes du compte, une fois `resetPassword` abouti. Ce module n'ouvre lui-même aucune session
   (D35/D50 : la personne se reconnecte ensuite) — « fermer les autres » revient donc à « fermer
   toutes ». Le compte visé est appris en lisant `verification` (table `identifiant` = `reset-password:${jeton}`,
   désignée comme Better Auth la lit lui-même) **avant** l'appel à `resetPassword`, puisque la réponse de
   ce dernier ne rend jamais l'identité. Un jeton qui ne désigne rien (inconnu, déjà consommé) ne fait
   rien fuiter de plus : le refus qui suit reste le motif unique `refuse`, et aucune session n'est
   fermée. Signature changée : la fonction prend désormais un troisième paramètre `client` (défaut
   `prisma`), nécessaire pour cette lecture et pour la fermeture — tous les appelants de production
   (`app/api/session/premier-acces/route.ts`) et les scénarios e2e qui n'en passaient pas gardent le
   défaut de production, inchangé.

4. **MESURÉ, et noté dans le docblock** : l'option du greffon Better Auth
   (`emailAndPassword.revokeSessionsOnPasswordReset`) appelle `deleteUserSessions` à travers
   l'enveloppe de désignation — qui ne pose aucune désignation pour un `WHERE utilisateur_id = …` sur
   `session` (seul le JETON désigne en lecture, `CLES_DESIGNATION.session.ou`). Zéro ligne supprimée,
   même constat déjà écrit pour la même méthode dans `lib/auth/mon-compte.ts`. L'option n'a donc pas
   été activée ; le geste reste applicatif, par le patron du point 1.

## Ce qui N'A PAS été fait, et pourquoi — à reprendre (point 3 du ticket)

**Invalider les liens antérieurs non utilisés du même compte à l'émission d'un nouveau lien n'a pas
été implémenté.** Mesuré avant d'écrire une ligne : la table `verification` n'est cloisonnée que par
DÉSIGNATION sur `identifiant` (L1-02d, les quatre politiques — lecture, ouverture, modification,
consommation — ne lisent QUE cette colonne). Aucune politique n'accepte `valeur` (qui porte l'identité
du compte) ni aucune autre colonne ; aucune fonction `SECURITY DEFINER` arbitrée (D226, D233) ne porte
sur cette table. Retrouver « les jetons antérieurs du même compte » pour les supprimer exige de
connaître leur `identifiant` — une chaîne aléatoire que l'émetteur ne conserve jamais — ce qui n'est
possible ni par une lecture désignée existante, ni sans ouvrir une nouvelle forme de politique ou une
troisième fonction `SECURITY DEFINER`. Les deux sont des migrations, et ce lot n'en autorisait aucune.
Le point 4 du ticket (épreuve « ancien lien refusé, nouveau lien accepté ») n'a donc pas été écrit :
l'écrire contre le comportement actuel aurait exigé de l'assouplir pour le faire passer, ce qui est
l'interdit absolu du lot. Écrit en détail dans D266, section « ce que cette décision n'est pas », avec
sa condition de réouverture.

**Aucune migration** — conforme à l'interdit du lot.

**Aucun écran changé** — conforme à l'annonce du ticket ; aucune capture n'a donc été prise.

## Épreuves

- **`tests/isolation/reinitialisation-second-facteur.test.ts`** — un cas ajouté : deux sessions posées
  pour le sujet, `reinitialiserSecondFacteur` appelée, les deux sessions ont disparu (requête
  suivante refusée par construction : plus aucune ligne à présenter).
- **`tests/isolation/premier-acces.test.ts`** — deux blocs ajoutés :
  - un compte séparé (société dédiée, l'amorçage n'ouvrant que la PREMIÈRE identité d'une société) :
    deux sessions posées, `choisirLePremierMotDePasse` appelée avec un jeton de premier accès valide,
    les deux sessions ont disparu après un résultat `abouti` ;
  - un lien EXPIRÉ (ligne `verification` insérée directement avec `expire_le` déjà dans le passé) est
    refusé, avec le MÊME motif `refuse` qu'un jeton jamais émis — scénario manquant avant ce lot,
    maintenant prouvé plutôt que supposé (la bibliothèque, mesurée, traite déjà une ligne expirée comme
    invalide dans `consumeVerificationValue`).
- **`tests/isolation/nouveau-lien-mot-de-passe-deja-pose.test.ts`** — deux appels existants à
  `choisirLePremierMotDePasse` complétés avec le nouveau paramètre `client` (sinon : la fonction
  retombe sur le `prisma` de production, qui exige `DATABASE_URL`, absent de l'environnement des
  scénarios d'isolation — qui ne posent que `TEST_DATABASE_URL`). Sans ce correctif, l'échec de ce
  fichier laissait des comptes sans nettoyage, qui polluaient ensuite deux fichiers sans rapport
  (`absence.test.ts`, `planning-referentiel-technicien.test.ts`) quand la suite tournait en entier —
  constaté, puis corrigé, avant de considérer le lot terminé.

`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (5950 tests), `pnpm test:isolation`
(2281 tests) et `CI=1 pnpm verify` passent tous, rejoués en avant-plan pendant ce lot. Deux specs e2e
ciblées ont aussi été rejoués en avant-plan (`9g6-point3-premier-acces.spec.ts`,
`9ia-reinitialiser-second-facteur.spec.ts`, 6 scénarios, tous verts) — `pnpm test:e2e` en entier n'a
PAS été rejoué (budget du lot) ; la file de nuit joue `verify:full` après ce lot.
