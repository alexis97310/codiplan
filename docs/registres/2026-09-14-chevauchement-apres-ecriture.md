# Registre — le verrou de chevauchement rendait le semis irrejouable

*14/09/2026. Une entrée par unité de travail. La mesure d'abord, la prose ensuite.*

**Lieu de ce travail** : la branche `claude/wonderful-meitner-use8yq`, partie de `main`
à l'empreinte `6d439d7` (la fusion de #183), constatée par `git log` et non de mémoire.
*Rien de ce registre n'affirme un état de `main` au-delà de cette empreinte.*

**L'horloge.** Ouverture de la session lue à `19:03:20 UTC` (`date -u`), jamais estimée.

## Le socle de mesure

| Ce qui a été fait | Ce qui a été mesuré |
|---|---|
| PostgreSQL 16.13 local démarré, bases `codiplan_test`, `codiplan_mesure`, `codiplan_semis`, `codiplan_avant` | `pg_isready` → `accepting connections` |
| `prisma generate` rejoué | le client embarqué était **périmé** — il réclamait `societe.taux_horaire_defaut`, colonne retirée du schéma le 09/09 |
| `pnpm verify` sur `6d439d7` intact | **non mesuré, et je le dis** : la première exécution de cette session porte déjà mes modifications (§11 du protocole). |

---

## a. LE DÉFAUT, REPRODUIT SUR LE CHEMIN RÉEL

Le semis joué **deux fois** contre une base neuve, migrations comprises, sans le
correctif. Le premier passe, le second tombe — au fichier, à la ligne, au code et au
message de la panne de #57 :

```
/home/user/codiplan/prisma/seed.ts:424:38
PostgresError { code: "23514", message: "calendrier_plage_sans_chevauchement — …" }
```

Ce n'est donc **pas une donnée sale** de la base de démonstration : c'est le verrou qui
refuse à une plage de se remplacer elle-même, sur toute base qui en porte déjà.

## b. LA CAUSE, TRACÉE PLUTÔT QUE DÉDUITE

*Une explication causale qui n'a pas été mise en échec n'est pas une cause* (§9, 08/09).
Un déclencheur témoin, n'imprimant que `TG_WHEN`, `TG_OP` et `NEW.id`, sur les deux
branches d'un `upsert` :

| Branche | Événements levés |
|---|---|
| `upsert` SANS conflit | `BEFORE INSERT (id-neuf)` ; `AFTER INSERT (id-neuf)` |
| `upsert` AVEC conflit | **`BEFORE INSERT (ID-NEUF)`** ; `BEFORE UPDATE (p1)` ; `AFTER UPDATE (p1)` |

Une seule ligne porte l'identifiant fantôme, et c'est `BEFORE INSERT` — le seul événement
qu'`AFTER` ne lève pas sur la branche du conflit. Vérifié en base après coup : la ligne
conservée porte bien `p1`, si bien que l'exclusion `"autre"."id" <> NEW."id"` retrouve son
sens.

**Et la mise en échec a été jouée** : le correctif retiré, le défaut revient — au même
fichier, à la même ligne, avec le même code.

## c. LES SEPT ÉPREUVES, SUR LES TROIS FORMES

Chaque écriture porte un **témoin de `ROW_COUNT`** qui fait échouer le cas si elle ne
touche aucune ligne — c'est le faux vert que la consigne signalait sur le cas 4, et il est
fermé par construction plutôt que par attention.

| | Cas | `BEFORE` (l'état livré) | `AFTER` (retenu) | `BEFORE` + exclusion |
|---|---|---|---|---|
| 1 | re-semis d'une plage inchangée (`ON CONFLICT`) | **REFUSE** ❌ | PASSE | PASSE |
| 2 | plage qui **touche** la précédente (11:30 → 13:00) | PASSE | PASSE | PASSE |
| 3 | plage qui **recouvre** une autre | REFUSE | REFUSE | REFUSE |
| 4a | allongement jusqu'au recouvrement (`UPDATE` direct) | REFUSE | REFUSE | REFUSE |
| 4b | allongement jusqu'au recouvrement (branche du conflit) | REFUSE | REFUSE | REFUSE |
| 5 | raccourcissement légitime | PASSE | PASSE | PASSE |
| 6 | `INSERT` multi-lignes de deux plages qui se recouvrent | REFUSE | REFUSE | REFUSE |

**Le cas 6 CONTREDIT la consigne, et c'est mesuré.** Elle annonçait qu'`AFTER` gagnerait
un cas que `BEFORE` manquait, les déclencheurs `BEFORE ROW` ne se voyant pas les uns les
autres. Sur PostgreSQL 16.13, **`BEFORE ROW` voit les lignes déjà posées par la même
commande** : l'`INSERT` multi-lignes est refusé sous les trois formes, et deux `INSERT`
séparés le sont aussi. Ce cas ne départage donc rien.

## d. CE QUI A DÉPARTAGÉ LES DEUX CANDIDATES

Les sept épreuves les laissent à égalité. Le discriminant a donc été cherché là où le §9
(31/08) dit de le chercher : *l'objet qui viole ma règle est-il encore dans ma
population ?* Index unique retiré dans une transaction annulée, puis une plage posée qui
recouvre une autre **et partage son `debut_minutes`** :

| Candidate | Verdict |
|---|---|
| `AFTER` | **REFUSE** — le verrou mord |
| `BEFORE` + `debut_minutes <> NEW.debut_minutes` | **ACCEPTE — AVEUGLE** |

L'exclusion est inoffensive *parce qu'un autre objet la rend inoffensive*. Le jour où cet
index changerait, le contrôle cesserait de regarder **sans rougir**, et sur les lignes qui
en ont le plus besoin. `AFTER` retenu : il ne s'adosse à rien qu'il ne nomme pas.

Le motif complet, avec ce qui a été écarté, est dans
`docs/decisions/2026-09-14-chevauchement-apres-ecriture.md`.

## e. LA QUESTION PLUS LARGE — COMBIEN D'AUTRES ?

**Population dérivée de `pg_trigger` sur une base réellement migrée**, jamais du texte des
migrations : *c'est l'état final qui compte, pas le verbe qui l'installe* (§9, 26/08,
forme 3). Quatorze déclencheurs non-audit ; le témoin de non-vacuité est ce décompte.

Trois seulement se lèvent **sur `INSERT`**, donc trois seulement peuvent porter la
maladie. Le motif automatique en a signalé deux de plus ; **les deux étaient des faux
positifs, et les lire l'a montré** :

| Déclencheur | Table | Lit sa propre table ? | Atteint par un `upsert` ? | Verdict |
|---|---|---|---|---|
| `plage_sans_chevauchement` | `calendrier_plage` | **oui, et exclut par `id`** | **oui** (`prisma/seed.ts`) | **LE DÉFAUT** |
| `plage_tient_le_pas` | `calendrier_plage` | non — lit `calendrier` ; le motif a matché son propre message de refus | oui | sain, **mesuré** |
| `intervention_facturation_a_la_cloture` | `intervention` | non — ne lit aucune table, il AFFECTE `NEW` | non | sain |

Les onze autres sont en `BEFORE UPDATE` ou `AFTER`, donc hors de portée de la branche
d'insertion : sur la branche du conflit, `BEFORE UPDATE` porte le `NEW.id` de la ligne
**réelle** (tracé au §b). Quatre d'entre eux sont tout de même atteints par un `upsert`
aujourd'hui — `pas_tient_dans_les_plages`, `agence_territoire_verrou_ecarts`,
`site_trajet_suit_agence`, `utilisateur_enrolement_mfa_seul` — et les trois derniers ne
touchent **jamais** `NEW.id` (mesuré sur `prosrc`). Le premier le lit, et c'est sa clé de
jointure vers une AUTRE table, pas une exclusion : mesuré, l'`upsert` de calendrier du
semis passe, et un pas au-dessus de la plus courte plage est toujours refusé.

**Un seul déclencheur du dépôt réunit les trois conditions**, et c'est celui-là.

## f. CE QUE LE GARDIEN EST DEVENU

`tests/isolation/plages-reglables.test.ts` était un bon fichier — jumeaux compris — et il
ne pouvait pas voir ce défaut : **toutes ses écritures passaient par `create` ou
`update`**, les deux verbes qui marchent. Trois scénarios s'y ajoutent :

1. **le semis se rejoue** — deux `upsert` de suite, avec un `id` neuf dans le bloc
   `create` à chaque fois, la forme exacte de `prisma/seed.ts`. Son témoin vérifie que le
   second a bien emprunté la branche du **conflit** (`second.id === premier.id`), sans
   quoi deux insertions distinctes le rendraient vert sans rien exercer ;
2. **le verrou mord toujours sur ce verbe** — *le cas qui doit rester ROUGE* : un `upsert`
   qui recouvre est refusé. Sans lui, rien ne distinguerait un verrou réparé d'un verrou
   désarmé ;
3. **le jumeau** — il ne retire pas le verrou, il lui rend son `BEFORE` et **rien
   d'autre**, ce qui établit que le correctif est bien le moment.

*Mesuré dans les deux directions* : sans le correctif **2 des 13 rougissent** ; avec,
**13 sur 13 passent**.

## g. LA LEÇON, ET ELLE N'EST PAS CELLE QU'ON ATTENDAIT

Le fichier de gardien ne s'était pas trompé de règle : il avait bâti sa population avec
**les verbes qui le satisfaisaient**. Ce n'était pas volontaire, et l'effet est celui
d'une population fabriquée — *un `WHERE` qui recoupe l'assertion* (§9, 31/08) déplacé du
filtre vers le **choix du verbe d'écriture**. La question à poser à un gardien de base
n'est donc pas seulement *quelles lignes regarde-t-il ?* mais **par quel verbe les
écrit-il, et est-ce celui de la production ?**

## h. CAPTURES

**Aucun écran n'est touché ni créé par ce correctif** — il ne change que le moment où un
déclencheur PostgreSQL se lève, et ni `lib/calendar/depot.ts`, ni l'écran
`/parametres/agences`, ni aucun libellé ne bougent. *L'absence de capture est donc une
phrase, et la voici* (§7 de la consigne).
