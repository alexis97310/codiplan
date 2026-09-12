# Une migration fusionnée atteint la base sans qu'une main la lui porte

*12/09/2026 — D116, amendement du §12 de `docs/protocole-session.md`.*

## Contexte

Le §12 posait une asymétrie et la nommait : **le code se déploie seul, les données non.** Vercel reconstruit à chaque fusion ; rien ne reportait une migration sur la base hébergée. La parade était un **geste nommé** dans le compte rendu, armé depuis R3-01 par un rappel (la fusion écrit le geste dans son résumé) et une mesure (le job `deploiement` ouvre `/api/sante` et rougit si la base est en arrière).

**Les trois ont échoué le même soir.** Le 12/09/2026, quatre migrations ont été fusionnées entre 21 h 55 et 22 h 27 ; quatre fois le code s'est déployé et la base est restée en arrière ; `/planning` est tombé. La réparation a demandé **deux passages manuels du flux**, dont un avec `reinitialiser_demo` coché — une purge qui vide toutes les sociétés sans condition — **et les comptes ont été effacés**. L'arbitre du projet ne pouvait plus entrer dans sa propre application.

C'est le §9 du 12/09 dans sa forme la plus chère : *une règle écrite dans un document que personne ne relit au bon moment n'est pas un gardien ; elle en a exactement la forme, et elle ne produit aucun signal quand on l'oublie.*

## Options écartées

**Rendre le rappel plus visible** — un commentaire sur la proposition, une case à cocher, une étiquette. Écarté : *c'est ce qui a déjà été tenté et qui vient d'échouer.* Le rappel du 11/09 nommait le flux, le champ et la valeur de chaque champ, et il n'a pas été lu. Un rappel se lit ou ne se lit pas ; ajouter un quatrième canal ne change pas sa nature.

**Faire rougir la CI tant que la base est en retard.** Écarté : la mesure existe déjà (`deploiement`), elle a rougi, et *rougir après la panne n'est pas l'éviter*. Elle reste — elle constate désormais un état qui doit se corriger tout seul, ce qui est son bon usage.

**Automatiser aussi le seed.** Écarté, et c'est la borne 4. `prisma/seed.ts` écrit des **données**, et une donnée réécrite automatiquement à chaque commit est exactement le risque de perte que le §12 protégeait. *D116 n'automatise que ce qui casse la production quand il manque : le SCHÉMA.*

## Choix

Le flux « DB migrate & seed » se déclenche sur `push` vers `main` limité à `prisma/migrations/**`, **sous quatre bornes qui sont la condition de l'acceptation** :

1. **Cible `demonstration` uniquement.** La cible est *calculée* dans une étape nommée et le chemin automatique refuse toute autre valeur. Elle n'est pas héritée d'une entrée vide : sur un `push`, `inputs.cible` vaut la chaîne vide, et le `else` existant aurait donné le bon résultat par le mauvais chemin — *une garantie qui tient à ce qu'une valeur soit vide cesse le jour où elle ne l'est plus*, la faute mesurée le 09/09.
2. **La purge n'est jamais automatique.** Sa condition exige `workflow_dispatch` **en plus** de sa case, pour la même raison.
3. **L'automatique refuse une base qui n'est plus une fiction.** `scripts/refus-si-donnees-reelles.mts`, joué **avant** la migration.
4. **Déclenchement restreint à `prisma/migrations/`.**

Et le flux **dit ce qu'il a fait** : les migrations posées entrent au résumé, par soustraction entre une lecture avant et une lecture après.

## Conséquences

**La borne 3 porte tout le poids, et son critère était déjà écrit.** Le §9 du 30/08, en refusant de reporter le partitionnement du journal, notait que le déclencheur aurait été *« gardable »* parce que *« le contrôle de cloisonnement énumère déjà les sociétés à chaque migration, il aurait suffi qu'il échoue dès qu'une société hors démonstration apparaît »*. C'est exactement ce critère, écrit pour une autre raison, repris ici.

Il lit sous une **identité exemptée des politiques**. Sans cela, `FORCE ROW LEVEL SECURITY` lui ferait voir **zéro société** et conclure « aucune étrangère » — *il ne se tromperait pas, il ne regarderait rien*, et il OUVRIRAIT sur une base pleine de données réelles. La lecture de l'identité exemptée a été **déplacée** depuis `scripts/inventaire.mts` vers `scripts/lib/identite-exemptee.ts` plutôt que recopiée : deux lectures d'un même critère divergent en silence (§9, 01/09).

**« Rien observé » refuse aussi.** Une base neuve et une lecture filtrée rendent le même zéro, et on ne part pas sur un doute. Le code de sortie `75` distingue « je n'ai pas pu regarder » de `1` « j'ai regardé et je refuse » — la séparation que la veille tient déjà, *les mêler apprendrait à ne lire ni l'un ni l'autre*.

**Le geste nommé du §12 demeure** pour le seed, la purge et la cible `production`. Ce qui change est qu'on ne compte plus sur la mémoire pour la moitié qui tombe en panne ; ce qui ne change pas est que la moitié qui détruit demande toujours quelqu'un.

**Ce que ce dispositif ne prouve pas, et qui se dit ici.** Les quatre bornes sont tenues par un gardien **statique** — il lit le fichier du flux, il ne peut pas dire ce qu'un exécuteur fera. La mesure qui le complète est l'exécution réelle après une fusion touchant `prisma/`, et elle ne se joue pas dans `verify`. *La première fusion qui porte une migration est donc l'épreuve de cette décision*, et c'est elle qu'il faut regarder plutôt que ce document.
