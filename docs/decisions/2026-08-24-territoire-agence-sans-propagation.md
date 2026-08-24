# Changer le territoire d'une agence : aucune propagation, un refus, et une procédure

*24 août 2026 — ticket L0-09a, arbitrage D49. Complète D48.*

## Contexte

Le chaînage de D48 relie l'écart local de calendrier au territoire de son
agence. Il soulève aussitôt une question que la décision n'avait pas tranchée :
**que se passe-t-il si le territoire d'une agence change ?** Le cas est réel et
banal — une faute de saisie corrigée trois semaines plus tard, une agence
rattachée au mauvais code au moment du paramétrage.

La question a d'abord été traitée comme une modalité d'implémentation, et
`ON UPDATE CASCADE` posé sans que personne le décide. Vérification faite en base
— et non déduite du code —, voici ce que cette valeur produisait :

| Contenu du calendrier de l'agence | Effet de `UPDATE agence SET territoire = …` |
|---|---|
| Uniquement des **ponts** | **Réécriture silencieuse** des écarts. `UPDATE 1`, pas un mot |
| Au moins un **férié travaillé** | Échec, mais en désignant `jour_ferie` — pas le vrai problème |

Mesuré sur le jeu de démonstration, agence Dolbeau, dont les trois écarts sont
des ponts :

```
avant : DOLBEAU | écart NC | 2026-12-24, 2027-12-24, 2028-12-24
UPDATE agence SET territoire='FR' WHERE code='DOLBEAU'  →  UPDATE 1
après : DOLBEAU | écart FR | 2026-12-24, 2027-12-24, 2028-12-24
```

Une même correction qui **passe ou casse selon le contenu du calendrier**, et qui
ne dit jamais ce qu'elle a fait : c'est le pire des deux comportements. Le cas
qui réussit est le plus dangereux, puisque c'est celui qui ne prévient pas.

## Options écartées

**`ON UPDATE CASCADE`** — la propagation. Elle traite le territoire de l'écart
comme une simple copie technique à tenir à jour. Il n'en est rien : un écart
adossé désigne le fait public d'un territoire, et un pont a été décidé dans le
calendrier d'un territoire. Changer le territoire de l'agence ne les déplace
pas, il les **invalide**.

**`ON UPDATE SET NULL`** — impossible, et heureusement : la colonne est
`NOT NULL`, c'est précisément ce que D48 a établi.

**Un contrôle applicatif qui préviendrait avant de propager.** Il ramène le
problème que D48 a écarté : il protège les chemins d'écriture qu'on connaît.

**Le déclencheur seul, sans `RESTRICT`.** Un message clair, mais une garantie qui
tient à une fonction PL/pgSQL qu'un `DROP TRIGGER` suffit à retirer. Le verrou
doit rester déclaratif.

## Décision

**`ON UPDATE RESTRICT` des deux côtés du chaînage.** Changer le territoire d'une
agence est **refusé** tant qu'il lui reste un écart de calendrier.

Le refus de PostgreSQL est le bon comportement : mieux vaut bloquer et forcer une
décision humaine que laisser une correction anodine réécrire un calendrier en
silence. Une agence sans écart change de territoire sans obstacle — le verrou ne
gêne que le cas où il y a réellement quelque chose à décider.

`RESTRICT` est posé **aussi** sur la clé vers `jour_ferie`, pour la même raison :
corriger la date ou le territoire d'un fait public ne doit pas réécrire en
silence l'écart d'une société. Le référentiel est écrit par l'éditeur, l'écart
appartient à la société ; l'un ne modifie pas l'autre sans que quelqu'un le
décide.

**Un déclencheur porte le message, à côté du verrou et jamais à sa place.**
`RESTRICT` refuse, mais parle de clés : « violates foreign key constraint … is
still referenced ». Il dit que c'est interdit, pas quoi faire.
`agence_territoire_verrou_ecarts` s'exécute avant le contrôle de la clé et lève
le premier :

> Territoire de l'agence **DOLBEAU** : changement **NC → FR** refusé. **3
> écart(s)** de calendrier subsistent (du 2026-12-24 au 2028-12-24) et désignent
> les fériés de NC. Un changement de territoire les invalide. **Marche à
> suivre** : traiter d'abord les écarts de cette agence — supprimer les ponts
> qui n'ont plus lieu d'être, et réadosser chaque férié travaillé au fait public
> du NOUVEAU territoire — puis changer le territoire.

Retiré, la clé refuse encore, avec le message générique. Le déclencheur n'est
qu'une voix ; le verrou reste déclaratif, et un test éprouve les deux
séparément.

## La procédure — changer le territoire d'une agence

1. **Constater** ce qui bloque : lister les écarts de l'agence
   (`calendrier_ferie` pour cette `agence_id`). Le message du refus en donne
   déjà le nombre et les dates extrêmes.
2. **Décider écart par écart**, et c'est le point : cette décision appartient à
   l'exploitant, pas à une clé étrangère.
   - **Pont** — un jour ordinaire que l'agence chôme. Il reste valable si la
     décision d'entreprise tient sur le nouveau territoire ; il tombe si le jour
     n'a plus de sens là-bas. Le supprimer, ou le laisser après l'avoir
     réexaminé.
   - **Férié travaillé** — il désigne le fait public d'un territoire qui n'est
     plus le sien. Le supprimer, ou le **réadosser** au férié équivalent du
     nouveau territoire quand il en existe un à la même date.
3. **Traiter les écarts** : supprimer ceux qui tombent, réadosser ceux qui
   restent — en visant le `jour_ferie` du **nouveau** territoire.
4. **Changer le territoire** de l'agence. L'écriture passe alors.
5. **Vérifier l'horizon** : `pnpm feries:horizon`. Le nouveau territoire doit
   avoir douze mois de fériés devant lui ; `pnpm feries:etendre` s'il en manque.

L'ordre ne s'inverse pas. Un écart réadossé avant le changement de territoire
serait refusé par la clé du fait public ; c'est pourquoi l'étape 3 supprime, et
ne réadosse qu'après — ou, plus simple sur un petit volume, supprime tout à
l'étape 3 et repose les écarts après l'étape 4.

## Conséquences

**Le seed reste idempotent.** PostgreSQL n'applique la règle référentielle que si
la clé change réellement, et le déclencheur commence par écarter les écritures
qui laissent le territoire inchangé. Les `upsert` du seed, qui réécrivent
`territoire` à l'identique à chaque exécution, passent sans obstacle —
vérifié par un double `pnpm db:seed`.

**Une agence ne se corrige plus d'un `UPDATE`.** C'est le coût, et il est
assumé : la correction devient une opération de paramétrage en cinq temps plutôt
qu'une ligne. Elle concerne un cas rare, et elle remplace une réécriture
silencieuse de calendrier.

**Un déclencheur `BEFORE` pré-empte les contraintes, et il fallait le voir.** Le
premier jet répondait « 2 écarts subsistent » à quelqu'un qui venait d'écrire
`NOUVELLE_CALEDONIE` — un message juste, sur une question qu'on ne posait pas,
qui masquait le contrôle de forme ISO. Le déclencheur laisse désormais filer tout
code mal formé vers `agence_territoire_iso_alpha2`, à qui cette faute appartient.
C'est le scénario d'isolation du code ISO, écrit à L0-08, qui l'a fait tomber :
un test de refus voisin est le meilleur détecteur d'un message qui déborde.

**Ce que le refus ne couvre pas.** Le déclencheur lit `calendrier_ferie` sous les
politiques de cloisonnement (`SECURITY INVOKER`, comme toute lecture
applicative). Si elles masquaient les écarts, son décompte vaudrait zéro et il
laisserait passer — la clé étrangère, elle, contrôle l'intégrité hors RLS et
refuserait quand même. Le pire cas est donc un message générique, jamais une
écriture acceptée.

## Ce que l'épisode enseigne

**Une action référentielle est une règle de gestion déguisée en modalité
technique.** `ON UPDATE CASCADE` n'avait pas été décidé : c'est le défaut de
Prisma, recopié dans la migration sans que la question « et si ça change ? » soit
posée. Il répondait pourtant, tout seul, à une question qui appartient au
métier — que devient un calendrier quand l'agence change de territoire ? Une
valeur par défaut qui répond à une question qu'on n'a pas posée est une décision
prise par personne.

Le corollaire pratique : **toute clé étrangère nouvelle dit ses deux actions, et
les justifie**. `ON DELETE` était déjà regardé — supprimer, c'est visible.
`ON UPDATE` ne l'était pas, parce que « les identifiants ne changent jamais ».
C'est vrai des identifiants techniques ; c'est faux de toutes les colonnes
métier qu'un chaînage fait entrer dans une clé.

**Et l'épreuve par retrait a mordu sur elle-même.** Le premier gardien écrit pour
cette décision passait au vert **avec `CASCADE` rétabli** : la propagation
échouait alors sur la clé du fait public, et le motif d'erreur générique s'en
accommodait — vert pour la mauvaise raison. Seul le retrait réel l'a montré. Le
scénario a été rendu discriminant en le plaçant dans la configuration où
`CASCADE` réussissait *en silence* — une agence n'ayant plus qu'un pont — et en
exigeant le nom de la clé de l'agence. C'est la deuxième fois en deux tickets
qu'un gardien vert sur un cas fabriqué se révèle aveugle à la faute réelle.
