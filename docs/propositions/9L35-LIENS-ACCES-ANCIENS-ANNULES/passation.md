# 9L35-LIENS-ACCES-ANCIENS-ANNULES — passation

Décision d'Alexis du 23/11/2026 (séance de décisions, point 5 : « anciens liens d'accès : annulés à l'envoi d'un
nouveau »). Écrite en `docs/arbitrages.md` sous **D281**. Ferme le point 3 laissé explicitement non livré par D266
(9L09-SESSIONS-FERMEES-REINITIALISATION, 10/11/2026).

## Ce qui a été livré

1. **Mesure des quatre chemins qui créent un lien** (`git grep requestPasswordReset`) : `lib/auth/lien-d-acces.ts`
   (`preparerLienDAcces`, chokepoint commun à l'envoi/la copie d'un lien ou d'un nouveau lien, pour un compte de
   bureau, un technicien ou une invitation portail déjà en attente ; `inviterClientAuPortail`, pour une identité
   JAMAIS ACTIVÉE qui en avait déjà un, 9L03B) et `lib/auth/amorcage.ts` (`ouvrir`, `reemettre`, les deux gestes
   d'amorçage Q1/D65). `/mot-de-passe-oublie` reste une page texte seul, sans route de réinitialisation (décision du
   pilote du 28/09) — aucun cinquième chemin n'existe.

2. **`prisma/migrations/20261124080000_invalider_liens_anterieurs_9l35`** — `app_invalider_liens_anterieurs(uuid,
   text)`, troisième fonction `SECURITY DEFINER` du dépôt, troisième entrée de `AUTORISEES_PAR_ARBITRAGE` (D50), sur
   le modèle de D226/D233 : propriétaire du schéma, `search_path` figé, `row_security = off` (fail-closed), `REVOKE
   ALL FROM PUBLIC` + `GRANT EXECUTE` au seul rôle applicatif. Nécessaire parce que `verification` ne se désigne que
   par `identifiant` (L1-02d) — aucune politique n'admet `valeur`, la colonne qui porte l'identité du compte. Plus
   étroite que D226/D233 : aucun contexte de société, et la portée d'un appel mal autorisé reste bornée au SEUL
   compte reçu en paramètre — l'habilitation du geste qui l'appelle (D226/D247) est déjà tranchée avant qu'elle ne
   soit atteinte. Filtre `identifiant LIKE 'reset-password:%'` écrit en SQL : les défis de second facteur et la
   confiance d'appareil, qui transitent par la même table sous d'autres préfixes, ne sont jamais touchés.

3. **`lib/auth/invalidation-liens-acces.ts`** (nouveau) — `identifiantLienAcces(jeton)` et
   `invaliderLiensAnterieurs(client, utilisateurId, identifiantAConserver)`. Appelée par les quatre chemins mesurés
   au point 1, une fois leur propre jeton émis, en lui désignant ce jeton pour qu'il soit épargné. Pour `ouvrir`
   (amorçage), l'appel est un no-op mesuré — l'identité vient de naître à cette même fonction, aucun lien antérieur
   n'existe — posé pour éviter un cas spécial plutôt que pour un effet.

4. **Séquence choisie plutôt que même transaction stricte avec l'écriture de Better Auth, et c'est mesuré** :
   `requestPasswordReset` ouvre sa propre transaction interne à travers l'adaptateur Prisma, et aucun appel existant
   du dépôt ne lui passe un `Prisma.TransactionClient` (relecture de tous les appelants de `creerAuth`).
   `invaliderLiensAnterieurs` est donc appelée APRÈS que `requestPasswordReset` a abouti — même séquence que
   `fermerSessionsDuCompte` après `resetPassword` dans D266 (9L09, point 2). La fonction elle-même reste atomique
   (une seule instruction SQL).

5. Le docblock de `reemettre` (`lib/auth/amorcage.ts`), qui annonçait explicitement cette limite (« il ne peut pas
   non plus INVALIDER un jeton précédent encore vivant […] »), est corrigé pour dire ce qui est maintenant vrai.

## Ce qui N'A PAS été fait, et pourquoi — mesuré, hors scope

**`pnpm veille` n'a PAS été étendue à cette troisième fonction.** `lib/db/exemption-fonctions-identite.ts` surveille,
sur la base hébergée, l'exemption et les réglages de D226/D233 — mais le module est nommé et documenté pour deux
fonctions D'IDENTITÉ (qui répondent un booléen) ; `app_invalider_liens_anterieurs` en est une troisième, de nature
différente (elle supprime). L'étendre proprement demanderait de généraliser ce module au-delà de son nom, ce que ce
lot n'avait pas mandat de faire. Un gardien STATIQUE (`security-definer-sous-arbitrage.test.ts`) couvre déjà la
migration ; l'absence de surveillance NOCTURNE de ses réglages sur la base hébergée est un écart connu, à tenir pour
une prochaine décision.

## Épreuves

- **`tests/isolation/invalidation-liens-acces.test.ts`** (nouveau) — deux `describe` :
  - la fonction `SECURITY DEFINER` elle-même (lignes `verification` fabriquées directement) : supprime le lien
    antérieur du MÊME compte, épargne celui qu'on lui désigne, épargne un AUTRE compte et un AUTRE usage (`2fa-…`) ;
    épreuve JUMEAU, un second appel sur un compte déjà invalidé ne lève pas et ne retire rien de plus.
  - le geste réel (`envoyerLienDAcces` puis `envoyerNouveauLienDAcces`, deux techniciens dans deux sociétés
    différentes) : lien 1 envoyé, lien 2 envoyé → lien 1 refusé (motif `refuse`), lien 2 accepté (`choisirLePremierMotDePasse`
    aboutit, connexion réussie) ; le lien de l'AUTRE société, émis avant tout le reste, n'est jamais touché.
- **`tests/e2e/9l35-liens-acces-anciens-annules.spec.ts`** (nouveau) — le parcours complet à travers un navigateur :
  l'administrateur envoie le lien d'accès d'un technicien, puis un nouveau lien (routes d'Équipe, requêtes
  authentifiées sur la session réelle) ; les deux courriels sont interceptés (même mécanique que
  `acces-technicien.spec.ts`) ; le lien 1, présenté sur `/premier-acces`, rend l'écran « lien invalide » ; le lien 2
  aboutit, redirige vers `/connexion`, et la connexion avec le mot de passe choisi réussit.
- `tests/unit/db/security-definer-sous-arbitrage.test.ts` — `AUTORISEES_PAR_ARBITRAGE` porte la troisième entrée ;
  le docblock et l'assertion de liste close sont à jour.

`pnpm test` (6060 tests), `pnpm test:isolation` (2554 tests) et `CI=1 pnpm verify` (format, typecheck, lint, test,
test:isolation, build) passent tous, rejoués en avant-plan pendant ce lot. Le scénario e2e ciblé a aussi été rejoué
en avant-plan (1 scénario, vert) — `pnpm test:e2e` en entier n'a PAS été rejoué (budget du lot, et le mémo du poste
le déconseille : plus de 30 minutes à un worker) ; la file de nuit joue `verify:full` après ce lot.

## Feuille de route

L'entrée de « Décisions en attente » référençant 9L09 est retirée ; une entrée « Livré » référençant 9L35/D281 est
ajoutée.
