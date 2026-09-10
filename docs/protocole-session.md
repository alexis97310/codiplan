# CODIPLAN — Protocole de session

**Rang 1, à égalité avec `docs/arbitrages.md`.** Ce document dit **comment une session travaille** ; `docs/arbitrages.md` dit **ce qui a été décidé**. Ils ne se recouvrent pas et ne s'arbitrent pas l'un l'autre : en cas de contradiction entre les deux, c'est un défaut à signaler, pas un ordre de préséance à appliquer.

*Écrit le 10/09/2026. Motif : les sept sections ci-dessous étaient recopiées à l'identique en tête de chaque consigne depuis dix jours. **Une règle recopiée à la main est une règle qui s'érode** — un jour on en oublie une, et rien ne le dit. Elle est écrite ici une fois, et appelée.*

---

## 1. Qui décide quoi

**Un arbitrage appartient à Alexis SI ET SEULEMENT S'IL touche l'une de ces trois choses :**

| | |
|---|---|
| **l'argent facturé** | un montant, un taux, une majoration, une règle qui change ce qu'un client paie |
| **une obligation légale** | VGP, conservation des données, mentions obligatoires, droit du travail |
| **ce qu'un client voit** | le portail, un document remis, un libellé qui sort de chez CODIMA |

**Tout le reste appartient à la session.** Elle tranche, elle écrit la décision dans `docs/arbitrages.md` **avec sa condition de réouverture**, elle continue.

*Une décision écrite et réversible vaut mieux qu'une journée d'attente.* Le coût d'une décision qu'on rouvre est de la relire ; le coût d'une session arrêtée est la journée entière.

**La CONDITION DE RÉOUVERTURE n'est pas une formalité, c'est ce qui rend la décision réversible.** Elle se vérifie, elle ne s'interprète pas : *« le jour où une route de portail lit une table de forme société »* est une condition ; *« si cela pose problème »* n'en est pas une. Sans elle, « tranché » devient « oublié ».

**Les numéros de décision appartiennent à celui qui écrit la décision.** Une consigne qui porte un numéro se lit **pour son contenu** ; le numéro se réattribue au moment de l'écriture, en suivant le dernier attribué dans `docs/arbitrages.md`.

---

## 2. Les deux seuls cas d'arrêt

Une session s'arrête et rend la main dans **deux** cas, et deux seulement :

1. **Un geste physique qui appartient à Alexis** — créer un compte, poser un secret, payer, cliquer dans une console d'hébergeur : tout ce qui est **hors du dépôt**.
2. **Une action irréversible sur des données réelles** — effacer, écraser, envoyer à un tiers.

**Rien d'autre n'arrête une session.** En particulier : ni une règle métier ambiguë, ni une mesure qui contredit une décision écrite, ni une consigne qu'on juge mauvaise.

**Si une mesure contredit une décision écrite : on l'écrit, on prend la voie qui reste ouverte, on continue.** Une contradiction mesurée est un renseignement, pas un mur — et un ticket `arbitrage` la porte à Alexis sans immobiliser la session (§5).

> **Ce paragraphe ne s'assouplit pas.** Un cas d'arrêt affaibli pour qu'une nuit tourne plus longtemps est un défaut, pas une optimisation.

---

## 3. Une consigne mesurée fausse se refuse, et le refus se motive

Une consigne — de la file, d'un ticket, d'Alexis lui-même — qui est **mesurée fausse** ne s'exécute pas.

**La mesure prime sur l'origine de la demande.** Et le refus se paye en une phrase qui dit **ce qui a été mesuré**, jamais en une opinion.

*Un refus sans motif est une désobéissance ; un refus motivé est le seul canal par lequel une consigne se corrige.* Éprouvé le 13/09/2026 : le lot 8 devait livrer le stockage derrière une interface avec implémentation locale ; c'eût été une interface sans appelant, la maladie même que le portail venait de soigner. Le refus a été motivé, et **l'exploitation l'a ratifié en écrivant que sa consigne était mauvaise**.

---

## 4. Ne jamais affirmer un état observable sans l'observer

Un état du dépôt, de la base, de la CI, de l'horloge est **observable en une commande**. C'est précisément parce qu'il est bon marché à observer qu'on l'énonce de mémoire — avec la forme grammaticale d'un fait.

- **« Je n'ai pas pu regarder » est une réponse.** « C'est vert » sans avoir regardé n'en est pas une.
- **Un contrôle dont la population est vide ne rend pas un vert : il rend une absence de mesure.** Zéro contre zéro n'est pas un résultat.
- **Distinguer toujours « je n'en ai pas trouvé » de « il n'y en a pas ».**
- **Une durée est un état** : avant de dire « lent », « bloqué », « depuis N minutes », lire une horloge et donner les **deux bornes**.
- **Une impossibilité s'énonce avec son coût, ou pas du tout.** « Il faudrait rejouer X contre Y » est un devis, pas une conclusion — et un devis se chiffre avant d'être refusé.

Le §9 du `CLAUDE.md` porte les mesures qui ont fondé chacune de ces lignes ; elles ne sont pas recopiées ici.

---

## 5. Le ticket `arbitrage` — le seul canal vers Alexis

Une décision qui appartient à Alexis (§1) **n'arrête pas la session** : elle ouvre un ticket portant l'étiquette **`arbitrage`**, et la session continue sur ce qui reste ouvert.

**C'est le seul canal entre une session automatique et Alexis.** Un ticket d'arbitrage **incompréhensible par quelqu'un sans contexte est un ticket raté** — il sera lu sur un téléphone, entre deux rendez-vous, par quelqu'un qui n'a pas le dépôt sous les yeux.

Quatre sections, dans cet ordre, et aucune n'est facultative :

```markdown
## La question
Une phrase. Sans jargon, sans identifiant de ticket, sans nom de fichier.

## Ce que j'ai mesuré
Des faits, avec la commande ou la requête qui les a produits.
Jamais ce que je suppose. Si je n'ai pas pu mesurer, je l'écris.

## Les issues possibles
Deux ou trois, chacune avec CE QU'ELLE COÛTE — en argent, en travail,
ou en ce qu'on perd. Une recommandation est permise ; une seule issue
présentée n'est pas un arbitrage, c'est une annonce.

## En attendant
Ce qui est BLOQUÉ, nommément. Et ce qui CONTINUE quand même.
```

Le premier paragraphe doit tenir dans une notification. Si la question ne se pose pas sans lire le dépôt, elle est mal posée.

---

## 6. Plafond de méta-travail

- **Au plus UNE inscription au §9 du `CLAUDE.md` par session**, rencontrée en chemin, **jamais cherchée**.
- **Aucun gardien de gardien.**
- **En cas d'hésitation entre auditer et construire : construire.**

*Le dépôt fabrique des gardiens ; sa pente naturelle est d'en fabriquer sur ses propres gardiens, indéfiniment, et de ne plus rien livrer.*

---

## 7. Économie de contexte

- **Ne jamais relire un fichier qu'on vient d'écrire.**
- **Aucun diff, aucun extrait long, aucune sortie de test complète.** Une ligne par action.
- **Registre au fil de l'eau**, dans `docs/registres/`.
- **Commits petits et fréquents. Propositions ouvertes et fusionnées au vert, sans attendre personne.**
- **NE PAS ATTENDRE LA CI EN DORMANT** : lancer la vérification, passer au travail suivant, revenir fusionner.
- **Si le contexte devient étroit** : commiter, écrire « Où reprendre » dans le registre, et **le dire en une phrase**. *Ne pas mourir en silence.*

---

## 8. Forme du rapport

**Dix lignes** : ce qui est construit, ce qui est vert, ce qui est rouge, ce qui a été décidé seul, où reprendre.

**CHAQUE affirmation portant sur un artefact construit nomme l'empreinte du commit SUR `main` où elle se vérifie. Sans empreinte, elle n'est pas écrite.**

Une chose vraie ailleurs que sur `main` se dit **avec son lieu** — « sur la branche X, non fusionnée » — ou ne se dit pas. Une branche, un répertoire de travail, une session ouverte sont des lieux qui n'existent que pour celui qui les regarde ; `main` est le seul lieu que le destinataire d'un rapport puisse ouvrir.

---

## 9. Secrets et captures

- **Jamais de secret dans le dépôt, dans un registre, ni dans une capture.** Ni jeton, ni mot de passe, ni chaîne de connexion, ni nom d'hôte d'hébergeur (D50).
- **Une capture porte l'empreinte du commit photographié, LUE dans `git`, et la date LUE à l'horloge** — jamais écrites de mémoire. C'est ce qui distingue une image datée d'une image qui a l'air datée.
- Les jeux de données d'une capture viennent de `prisma/seed.ts`, jamais de la base hébergée (I9).

---

## 10. La file de nuit

`docs/backlog.md` est la file que lit la session nocturne. **« Le premier travail non bloqué » doit être une LECTURE, pas une interprétation** — d'où un marqueur d'état sur chaque ticket, et une commande qui le lit :

```bash
pnpm file          # le premier travail non bloqué, et pourquoi les précédents sont écartés
```

Trois états, et trois seulement :

| Marqueur | Sens |
|---|---|
| `*File :* LIBRE` | à prendre — le premier de la file dans l'ordre du document |
| `*File :* LIVRÉ` | fait ; la session passe au suivant |
| `*File :* BLOQUÉ — <motif>` | **le motif est obligatoire et non vide** : il dit par quoi, en une ligne |

Le marqueur se pose **sur la ligne qui suit immédiatement le titre du ticket**. Un ticket sans marqueur fait échouer `pnpm verify` (`tests/unit/docs/file-de-nuit.test.ts`) : *une file dont un élément n'a pas d'état n'est pas une file, c'est une liste de vœux.*

**Un blocage n'est pas un arrêt.** La session marque `BLOQUÉ`, ouvre le ticket `arbitrage` s'il en faut un (§5), et **prend le travail suivant**.

---

## 11. Budget d'exécution

Le budget GitHub Actions est une ressource **mesurée et finie**, jamais un acquis. **Une exécution planifiée — nuit ou vérification — dont le plafond DÉCLARÉ dépasse ce qu'il reste avant la remise à zéro mensuelle NE PART PAS** : elle se réduit à ce qui tient dans le reste, ou elle attend le renouvellement. Ce n'est pas un principe abstrait : c'est ce que D95 (`docs/arbitrages.md`) a tranché en écartant l'option qui l'aurait rendu sans objet — un dépôt public aux minutes gratuites.

**La mesure, datée.** Le 10/09/2026, GitHub indiquait 1 923 minutes consommées sur 2 000 incluses, remise à zéro 21 jours plus tard : **77 minutes restantes.** Alexis passe le compte au forfait Pro, qui porte l'inclus à 3 000 minutes — **la contrainte se desserre, elle ne disparaît pas**, et rien ne dit à quelle date du cycle courant le changement de forfait prend effet. Le budget d'une exécution se calcule sur le **solde observé au moment où on la programme**, jamais sur le forfait annoncé pour plus tard.

**Deux consommateurs distincts tirent sur le même solde chaque nuit, et ni l'un ni l'autre ne se règle depuis ce fichier :** `ci.yml` porte son propre déclencheur `schedule`, une heure avant celui de `nuit.yml`, et son plafond déclaré (`verify-full` 30 min + `veille-hebergee` 10 min = 40 min) s'impute au solde avant que la nuit automatique ne parte. Le budget d'une nuit se calcule donc **après** avoir réservé ce que `ci.yml` prend cette nuit-là, jamais avant.

**Le calcul de la première nuit, écrit et non deviné** (issue #99) : 77 − 40 = **37 minutes** disponibles pour `nuit.yml`, avant toute marge pour les poussées de la journée qui suivra — chacune capable de déclencher `verify` (plafond 20 min). Le plafond par défaut de `nuit.yml` doit rester **au minimum qui permet de mesurer**, très en-deçà des 37 minutes disponibles — une valeur confortable choisie sans preuve n'est pas un budget, c'est un pari. **Valeur recommandée, non appliquée** : `timeout-minutes: 15`, budget de tours `20` — aucune session issue d'un ticket ou d'une issue n'a les droits d'écrire dans `.github/workflows/` ; ces deux nombres restent à poser à la main tant que cette limitation tient.

**Un budget deviné est une affirmation ; un budget mesuré sur plusieurs nuits réelles est une donnée (§4).** Tant qu'aucune nuit n'a mesuré son coût réel — en minutes GitHub ET en crédits Claude — le plafond par défaut ne monte pas. **Ce paragraphe est lui-même une affirmation à vérifier plutôt qu'à croire** : à la date où il est écrit, plusieurs nuits ont déjà tourné sous l'ancien plafond (120 min / 150 tours, jamais abaissé faute d'accès en écriture à `nuit.yml`), et leurs registres (`docs/registres/2026-09-1{0,1,2,3}-nuit.md`) ne portent aucune mesure de minutes ni de crédits. La mesure demandée par l'issue #99 n'a donc jamais été prise. **Une session qui clôt une nuit écrit son coût réel dans son registre, dans les DEUX unités, ou explique pourquoi elle ne le peut pas** — sans quoi cette règle reste, comme la précédente, une intention plutôt qu'une garantie.

**Le rechargement automatique des crédits Claude est désactivé, délibérément, et aucune session ne suggère de l'activer.** C'est le coupe-circuit d'un travail non surveillé, attesté par Alexis le 10/09/2026 (issue #99) : une nuit qui s'emballe s'arrête d'elle-même faute de crédits plutôt que de continuer à consommer sans qu'un humain ne le voie. Proposer sa réactivation — même au motif de « ne pas perdre une nuit » — retirerait ce coupe-circuit au profit de la continuité, l'échange inverse de celui que ce paragraphe protège.
