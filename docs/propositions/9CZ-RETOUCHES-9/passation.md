# 9CZ-RETOUCHES-9 — passation

Retouches issues des relectures pilote de 9CW (publié ae8737e, second facteur) et 9CV
(publié 8102a8e). Aucune décision : D64 et D149 tiennent tels quels. Migration : NON.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

1. **Rien en code de production** pour le point 1 — D64 affirmait déjà, et affirme
   toujours, que le cliquet d'échecs du second facteur couvre le chemin « code de
   secours » (`verifyBackupCode`), en plus du chemin TOTP. Ce lot ajoute la PREUVE
   manquante (`tests/isolation/plancher-second-facteur-code-secours.test.ts`) ; aucune
   ligne de `app/`, `lib/auth/` ou `prisma/` n'a changé. Pour l'exploitation : rien ne
   change, la garantie était déjà en place, elle est maintenant mesurée.
2. **`lib/i18n/fr.ts`**, clé `enrolement.codes_secours.aide` — le texte affirmait « ils ne
   seront plus affichés », faux depuis 9CW (les codes restent relus côté serveur tant que
   l'enrôlement n'est pas confirmé, y compris après un code refusé). Un utilisateur qui
   recevait ce message pouvait croire la page perdue et chercher à les re-générer, ou
   paniquer à la vue des mêmes codes réapparaître. Le texte dit maintenant le vrai : ils
   restent affichés jusqu'à la confirmation, plus jamais après.
3. **`tests/unit/outils/fichiers-source.ts`** (`sansCommentaires`) — un `<` suivait
   aveuglément la même règle qu'une balise JSX fermante (`</a>`), y compris quand ce
   n'était que l'opérateur « inférieur à ». Conséquence mesurée : un littéral regex
   immédiatement après un `<` (`a < /x\/*y/`) pouvait faire croire à un commentaire bloc
   ouvert par erreur, qui avalait tout le code jusqu'au premier `*/` RÉEL, bien plus loin
   dans le fichier. Corrigé : seul un `<` IMMÉDIATEMENT suivi d'un `/` est traité comme une
   balise fermante ; sinon l'ancien comportement (regex possible juste après) est restauré.
   Ce module n'est utilisé que par des gardiens statiques (tests) — aucun impact
   d'exploitation, seulement sur la fiabilité des gardiens eux-mêmes.
4. **`tests/unit/ui/priorite-une-correspondance.test.ts`** — `<Priorite` satisfaisait la
   garantie GR5/D144 sans vérifier sa provenance : un composant LOCAL `function Priorite`,
   sans rapport avec `components/ui/priorite.tsx`, aurait passé le gardien. Corrigé :
   `<Priorite` ne suffit plus seul, il faut aussi l'import `Priorite` depuis
   `@/components/ui/priorite`. Aucun des six fichiers réels n'est affecté : ils passent
   tous par `tonDePriorite()` directement, aucun ne rend `<Priorite` aujourd'hui.
5. **`scripts/lib/delai-connexion.ts`** (`avecDelaiDeConnexion`) — le resserrement du
   02/10/2026 (relecture 9CR) avait retiré, avec `URL`/`URLSearchParams`, la validation
   qu'`avecDelaiDeConnexion` portait implicitement. Une URL non analysable ne levait plus.
   Corrigé : `new URL(url)` sert de garde en tête de fonction (son résultat n'est jamais
   utilisé pour reconstruire la chaîne, pour ne pas réintroduire le ré-encodage que 9CR
   avait justement retiré). Ce module ne sert qu'à `scripts/controle-cloisonnement.mts` —
   aucun impact d'exploitation en dehors de ce contrôle de CI.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Point 1** — le test mesure EN ESSAYANT : 10 (`SEUIL_ECHECS_SECOND_FACTEUR`) codes de
  secours faux comparés réellement (401), puis fermeture de la porte (429) au 11ᵉ ; les
  compteurs en base (`echecs_verification`, `verrouille_jusqu_a`) confirment. Mesuré vert
  du premier coup — **lu dans la bibliothèque d'abord** (`verifyBackupCode` appelle les
  mêmes `assertTwoFactorNotLocked`/`recordTwoFactorFailure`/`resetTwoFactorFailures` que
  `verifyTOTP`, désignées par `id`), puis confirmé en l'essayant réellement.
- **Point 3a** — comparé la sortie de `sansCommentaires` ancienne vs nouvelle sur les
  **1267 fichiers `.ts`/`.tsx`/`.mts` suivis par git** : **0 divergence** (le cas fautif
  n'existe pas dans le dépôt aujourd'hui, comme annoncé par le ticket). Le cas fabriqué
  (`a < /x\/*y/.test(s)` suivi d'un vrai commentaire bloc plus loin) a été vérifié ROUGE
  avec l'ancien code (il avalait tout jusqu'au `*/` réel), puis VERT avec le correctif.
- **Point 3b et 3c** — ROUGE constaté en revenant temporairement à l'ancien code (la
  fonction ou la ligne retirée), VERT après correction, pour chacun des deux points.
- **Captures** — `/enrolement`, étape clé+QR+codes de secours, à 1280 et 375 px. AVANT :
  code d'avant ce lot (`fr.ts` stashé temporairement, commit `6e5e3ed`). APRÈS : commit de
  ce lot (voir `captures/README.md` pour le hash exact, posé après le commit).

## Ce que j'ai tranché et pourquoi

- Pour le point 3a, j'ai choisi de restreindre la règle au SEUL cas `<` immédiatement suivi
  de `/` plutôt que d'essayer de distinguer plus finement « opérateur de comparaison » de
  « début de balise » par une analyse plus large (regarder en arrière le dernier jeton,
  etc.) — le ticket l'autorisait explicitement (« sinon pas de changement d'attente ») et
  la mesure sur les 1267 fichiers suivis confirme que cette restriction est sûre sur le
  dépôt réel.
- Pour le point 3b, j'ai choisi `@/components/ui/priorite` comme chemin attendu (mesuré :
  c'est le chemin réel qui exporte `Priorite`) plutôt qu'un paramètre générique — aucun
  autre composant de ce nom n'existe dans le dépôt.
- Pour le point 3c, `new URL(url)` est utilisé UNIQUEMENT comme garde (jeté ensuite) :
  reconstruire la chaîne à partir de l'objet `URL` aurait ré-encodé `options=-c%20x`,
  exactement le défaut que la relecture 9CR avait fermé le 02/10/2026.

## Ce que je n'ai PAS fait

- Je n'ai touché à AUCUNE politique RLS, AUCUNE migration, AUCUN déclencheur PostgreSQL
  (lecture seule sur `prisma/`, comme imposé).
- Je n'ai pas élargi, affaibli ni retiré un seul test existant.
- Je n'ai pas ajouté de jumeau (« CONTRE-ÉPREUVE ») au test du point 1 : le ticket demandait
  une mesure directe, pas une paire ; en ajouter une aurait dépassé le périmètre demandé.
- Je n'ai pas touché aux scripts `9CX` (démo) ni `9CY` (transmission groupée) : aucun
  fichier commun constaté avec ce lot, comme annoncé.

## Les pièges pour la session suivante

- Le test du point 1 (`plancher-second-facteur-code-secours.test.ts`) prend ~1 s mais ouvre
  plusieurs défis de second facteur par exécution : s'il devient lent, vérifier d'abord que
  `SEUIL_ECHECS_SECOND_FACTEUR` n'a pas changé (le nombre de défis nécessaires en dépend).
- La mesure du point 3a (1267 fichiers, 0 divergence) a été faite avec un script JETABLE
  dans `/tmp/sondage/` (non commité) — à refaire à la main si une relecture future doute du
  résultat ; la méthode est décrite ci-dessus (comparer `sansCommentaires` ancienne vs
  nouvelle sur `git ls-files -- '*.ts' '*.tsx' '*.mts'`).
- Les captures AVANT ont été prises en stashant `lib/i18n/fr.ts` SEUL (pas tout le lot) —
  c'est le seul fichier qui affecte le rendu de l'écran capturé ; si un futur lot touche
  aussi ce même écran, vérifier qu'aucun autre fichier de ce lot n'influence le rendu avant
  de réutiliser ce raccourci.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Les points 1 à 3 sont clos, mesurés,
  et les captures sont posées.
