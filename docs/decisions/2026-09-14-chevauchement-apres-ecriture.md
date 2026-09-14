# Le déclencheur de chevauchement se lève APRÈS l'écriture

*14/09/2026 — correctif de R3-13, ouvert par l'échec du semis à la fusion de #183.*

## Contexte

R3-13 a posé sur `calendrier_plage` trois déclencheurs, dont
`plage_sans_chevauchement`, en `BEFORE INSERT OR UPDATE`. La fusion de #183 a
déclenché « DB migrate & seed » #57 : la migration s'est appliquée, et **le
semis** a échoué en `23514` à `prisma/seed.ts:424`, sur `tx.calendrierPlage.upsert`.

La cause a été **mesurée** sur un PostgreSQL 16.13 jetable, par un déclencheur
témoin n'imprimant que `TG_WHEN`, `TG_OP` et `NEW.id` :

```
upsert SANS conflit     BEFORE INSERT (id-neuf) ; AFTER INSERT (id-neuf)
upsert AVEC conflit     BEFORE INSERT (ID-NEUF) ; BEFORE UPDATE (p1) ; AFTER UPDATE (p1)
```

Un `upsert` Prisma dont le bloc `create` appelle `uuidv7()` compile en un seul
`INSERT … ON CONFLICT DO UPDATE`, et la ligne candidate porte un identifiant
**neuf**. PostgreSQL lève `BEFORE INSERT` sur cette candidate avant de détecter
le conflit : le déclencheur voyait la ligne existante — même calendrier, même
jour, mêmes bornes, `id` différent — et concluait au recouvrement. *La plage se
chevauchait elle-même parce qu'elle ne s'était pas encore reconnue.*

**Une seule ligne de cette trace porte l'identifiant fantôme, et c'est
`BEFORE INSERT`** — le seul événement qu'`AFTER` ne lève pas sur la branche du
conflit.

## Options, et ce qui les a départagées

Les deux candidates passent les **sept** épreuves jouées (re-semis inchangé,
plage qui touche, plage qui recouvre, allongement jusqu'au recouvrement par
`UPDATE` puis par la branche du conflit, raccourcissement légitime, `INSERT`
multi-lignes de deux plages qui se recouvrent entre elles). Elles ne se
départagent donc pas sur la couverture nominale.

**Écartée — garder `BEFORE` et ajouter `AND "autre"."debut_minutes" <>
NEW."debut_minutes"`.** Son argument est que
`@@unique([calendrier_id, jour_semaine, debut_minutes])` interdit déjà deux
plages de même début le même jour, si bien que l'exclusion ne retirerait de la
population que la ligne elle-même. C'est vrai aujourd'hui — **et ce n'est pas le
déclencheur qui le rend vrai**. Le verrou écarterait de ce qu'il examine
précisément la classe de lignes qu'un AUTRE objet rend impossible : *un `WHERE`
qui recoupe l'assertion* (CLAUDE.md §9, 31/08), dont la question prescrite est
*« l'objet qui viole ma règle est-il encore dans ma population ? »*

La réponse a été mesurée plutôt qu'argumentée — index unique retiré dans une
transaction annulée, puis une plage posée qui recouvre une autre **et partage
son `debut_minutes`** :

| Candidate | Verdict |
|---|---|
| `AFTER INSERT OR UPDATE` | **REFUSE** — le verrou mord |
| `BEFORE` + exclusion sur `debut_minutes` | **ACCEPTE — aveugle** |

**Écartée — modifier le semis.** Le semis est correct ; c'est le verrou qui est
mal posé. Un semis rendu compatible aurait laissé le défaut intact pour l'écran,
l'import et toute console.

## Choix, et ses conséquences

`plage_sans_chevauchement` passe en `AFTER INSERT OR UPDATE`, par une migration
neuve — `20260914200000_chevauchement_apres_ecriture`. **La fonction n'est pas
touchée** : ni son corps, ni son message, ni le nom qu'elle met dans son texte.
Seul le moment change. Un `AFTER` qui lève une exception annule la commande
exactement comme un `BEFORE` ; la différence est interne à la transaction et
jamais visible d'un appelant.

Ce que le choix coûte : la ligne fautive est brièvement écrite avant d'être
annulée. Ce qu'il gagne : le contrôle ne s'adosse plus à un objet qu'il ne nomme
pas. *Il ne coûte pas une ligne de plus, il coûte un mot de moins.*

Les deux autres déclencheurs de R3-13 restent en `BEFORE`, **vérifiés et non
supposés** : `plage_tient_le_pas` ne lit que `calendrier`, et
`pas_tient_dans_les_plages` est en `BEFORE UPDATE` seul, donc hors de portée de
la branche d'insertion.

## Condition de réouverture

*Le jour où `btree_gist` devient disponible sur la base hébergée*, une contrainte
`EXCLUDE USING gist` sur un `int4range` remplacerait le déclencheur par une règle
déclarative — c'est ce que R3-13 avait déjà écarté faute de pouvoir créer une
extension, et le motif n'a pas changé.
