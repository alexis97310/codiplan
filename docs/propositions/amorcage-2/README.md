# AMORCAGE-2 — la chaîne de mise en ligne se suit jusqu'au bout, et deux gestes ont leur bouton

Travail commité **sur la branche `amorcage-2`, créée depuis `main`** (la consigne
du ticket), en deux commits : `a15daf4` (constat 3 — l'inventaire lit la cible du
flux) puis `b2c3d99` (constats 1 et 2 — la note corrigée, les deux cases, le
gardien). Rien n'est poussé, rien n'est fusionné : **tout ce qui suit est vrai
sur cette branche, non fusionnée**, et nulle part ailleurs.

**Aucune capture** : le ticket ne touche aucun écran — un flux GitHub, une note,
deux scripts d'inventaire, trois fichiers de test. Il n'y a rien à
photographier ; ce qui se mesure ici se mesure en commandes, et elles sont
ci-dessous.

## 0. Une contradiction dans la consigne, et comment elle a été tranchée

Le territoire interdisait `scripts/` — *« si tu crois devoir toucher un script
de scripts/, ARRÊTE-TOI et dis-le : ces scripts marchent, c'est leur absence de
bouton qui est le défaut »* — et le constat 3 demandait de corriger
`scripts/lib/inventaire.ts`, ligne 144, nommément. Les deux ne tiennent pas
ensemble : le code qui arrête la chaîne est dans `scripts/`, et l'autre flux
(`db-migrate.yml`) était interdit lui aussi.

**Tranché ainsi, et dit ici plutôt qu'en silence** : l'interdit sur `scripts/`
vise les deux scripts du constat 2 (`taux-initial.mts`, `etendre-feries.mts`),
qui ne sont pas touchés ; le constat 3 est corrigé là où le ticket le situe —
`scripts/lib/inventaire.ts` et `scripts/inventaire.mts`, et **rien d'autre** —
sans toucher `db-migrate.yml`, parce que le renseignement existait déjà :
`CIBLE_RETENUE`, posée dans `$GITHUB_ENV` par l'étape qui décide de la cible,
et que personne ne lisait (`grep CIBLE_RETENUE` : une seule ligne, celle qui
l'écrit).

## 1. Constat 3 — zéro société est un ÉTAT en production neuve (`a15daf4`)

**Rejoué localement sur une base neuve**, migrée par un propriétaire NON
superutilisateur membre d'un rôle `BYPASSRLS` avec `SELECT` — la forme du rôle
de migration d'un hébergeur infogéré, celle que `prendreIdentiteExemptee`
attend :

| Commande (base vide, 0 société) | Avant / sans renseignement | Avec `CIBLE_RETENUE=production` |
|---|---|---|
| `pnpm exec tsx scripts/inventaire.mts` | **exit 1** — *« aucune société en base : le seed n'a pas produit le socle attendu »* — le rouge exact du 22/09 à 11 h 50 | **exit 0** — *« Socle attendu : AMORÇAGE (cible « production », seed sauté) »*, inventaire écrit |
| `scripts/controle-cloisonnement.mts` sous `codiplan_app`, ensuite | — | **exit 0** — 0 société, 45 tables dans l'état RLS exigé, 69 politiques à la bonne forme |

Le socle attendu est un type, `SocleAttendu = "seed" | "amorcage"`, et
`ecartsInventaire` l'exige en argument — aucun défaut à la signature, le seul
appelant le dit. `socleAttendu(env)` lit `CIBLE_RETENUE` ; **absente ou vide,
le sens est le strict** (« seed ») : un inventaire joué depuis un poste exige
le socle plutôt que de supposer une production. Sur la démonstration, zéro
société reste un écart, et un total faux reste un écart quel que soit le socle.

**Vu rouge d'abord** : `tests/unit/db/inventaire.test.ts`, 5 rouges sur 32 —
le cas production, les trois lectures de la cible, le câblage (la variable est
écrite AVANT l'étape d'inventaire dans `db-migrate.yml`, et le script l'appelle)
— puis 32 verts. Le journal de l'étape imprime désormais quel socle il a exigé.

## 2. Constat 1 — le rôle avant les secrets, les secrets avant la migration (`b2c3d99`)

La note disait *« après le geste 4, `ALTER ROLE codiplan_app … PASSWORD »* ;
le flux exige `PRODUCTION_DATABASE_URL` — qui porte ce mot de passe — **avant
de partir**. Corrigé aux §0 (3 bis), §1, §6 (geste 4) et §7 : `CREATE ROLE
codiplan_app LOGIN PASSWORD '…' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE
NOINHERIT` depuis la console SQL, **puis** les deux secrets, **puis** la
migration, qui trouve le rôle (`IF NOT EXISTS`, ligne 51) et lui accorde ses
droits. Le texte faux est barré, pas effacé, et la ligne dit qu'il a été
mesuré le 22/09 sur une vraie installation.

`NOBYPASSRLS` est expliqué : c'est l'attribut qui soumet le rôle aux
politiques ; sans lui, l'application verrait toutes les sociétés, la garde de
démarrage refuserait, et entre les deux rien ne cloisonnerait.

**Ce chemin est celui que la mesure locale a pris** : `codiplan_app` existait
au cluster avant la migration de la base neuve (créé par la base de test), la
migration a sauté la création et posé les `GRANT` — le contrôle de
cloisonnement sous ce rôle passe (tableau ci-dessus).

## 3. Constat 2 — deux cases, deux étapes, deux `if` (`b2c3d99`)

`grep -n "feries:etendre\|taux-initial" .github/workflows/` rendait **rien**.
Le flux « Amorcer une base » porte désormais 17 entrées (limite GitHub : 25
depuis décembre 2025) : `poser_taux` + `societe` + `montant` + `date_effet`, et
`etendre_feries`. Chaque case part **décochée** ; seuls les référentiels
partent cochés, et le gardien nomme cette exception.

| Geste | Ce que l'étape fait | Ce qu'elle refuse |
|---|---|---|
| `poser_taux` | `TAUX_INITIAL_CONFIRME=oui`, `--societe "$SOCIETE" --montant "$MONTANT"`, `--date` seulement si renseigné ; sortie dans `/tmp/taux.txt`, masque, retrait, résumé avec le **taux formaté** à relire | société vide ; **montant vide — « c'est un prix »**, avant même d'appeler le script |
| `etendre_feries` | `HORIZON_DATABASE_URL=$DATABASE_URL pnpm feries:etendre`, **aucun argument** ; même barrières ; résumé avec l'horizon avant/après | rien de plus que le script : sans agence, *« Aucun territoire n'est rattaché à une agence »*, relayé tel quel — aucun territoire inventé |

Ordre tenu : référentiels → société → taux → fériés (une agence appartient à
une société, et se crée dans l'application après le premier compte : les fériés
se jouent lors d'une exécution ultérieure, la case seule cochée).

**Mesuré sous le propriétaire non superutilisateur, sur la base neuve** :
`taux-initial.mts --montant ""` → exit 2 (*« n'est pas un entier »* — d'où le
refus en amont, qui parle d'un prix) ; `--montant 7000` → **« 7 000 XPF hors
taxes », exit 0** ; rejoué → refus du cliquet, exit 1.

### Le gardien — `tests/unit/ci/gestes-amorcage.test.ts`, 13 épreuves

Population **dérivée** : les entrées `type: boolean` du flux (témoin : les deux
cases de naissance y sont), clos dans les deux sens — toute case a EXACTEMENT
une étape qui joue une commande sous `if: ${{ inputs.<case> }}`, la condition
est la case seule, toute condition nomme une entrée déclarée. Puis le prix
(défaut `""`, refus du vide avant l'appel, aucun nombre après `--montant`,
arguments passés = arguments que le script lit par `argument(argv, …)`,
cliquet armé sous le nom que le script exporte, société nommée) et les
agences (aucun argument à un script qui n'en lit aucun, première variable de
`urlBase()` lue dans `scripts/lib/feries.ts`, ordre, phrase de refus présente
dans le script et dans le flux).

| Mesure | Résultat |
|---|---|
| État 0 — flux d'avant | 4 verts / 9 rouges (les gestes n'existent pas) |
| **État 1 — cases déclarées, aucune étape** | **10 rouges / 13**, le premier : *« case(s) déclarée(s) sans aucune étape — un bouton qui ne fait rien : poser_taux, etendre_feries »* |
| État 2 — étapes écrites | 13 verts |
| Sept fautes greffées une à une dans le fichier réel, puis retirées (`diff` : identique) | défaut `"7000"` → 1 rouge ; `--montant 7000` → 1 ; `--territoire NC` → 1 ; refus du vide retiré → 1 ; `if: poser_taux \|\| creer_societe` → 2 ; `HORIZON_DATABASE_URL` retirée → 1 ; `--devise XPF` ajouté → 1 |

`url-hors-journal.test.ts` : les deux nouvelles étapes entrent dans sa
population (mêmes barrières, même expurgation éprouvée sur une chaîne
PostgreSQL), et son témoin « 6 confrontations » devient
`FLUX.length × entrées` — il valait 6 à la main et rougissait à 12.

## 4. CE QUI A ÉTÉ MESURÉ ET QUI CONTREDIT LA CONSIGNE — le bouton des fériés

*« Ces scripts marchent »* est vrai du taux et **faux des fériés sur une base
hébergée**, et c'est mesuré, pas supposé :

| `pnpm feries:etendre`, base neuve, **une agence** (`NC`) en base | Résultat |
|---|---|
| `HORIZON_DATABASE_URL` = propriétaire NON superutilisateur (le rôle de migration d'un hébergeur) | **exit 1 — *« Aucun territoire n'est rattaché à une agence »*** |
| même base, `HORIZON_DATABASE_URL` = superutilisateur (le poste, la CI) | **exit 0 — 36 fériés ajoutés, horizon 2028-12-25** |

Cause, lue : `agence` porte `FORCE ROW LEVEL SECURITY`
(`relforcerowsecurity = t`, vérifié) et `lireAgences` (`scripts/lib/feries.ts`)
la lit **sans contexte ni identité exemptée** — le propriétaire voit zéro
ligne et le script se croit sans agence. C'est le §9 du 07/09 mot pour mot,
et le seul environnement où le défaut existe est celui que `verify:full` ne
joue jamais (`feries:horizon` tourne sous `postgres`, superutilisateur).

**Ce que j'ai fait** : le bouton existe, dans la forme demandée ; son étape,
son résumé, la note (§6 geste 14, §9) et le README disent la limite, avec la
mesure, plutôt que d'envoyer créer une agence qui est déjà là. **Ce que je n'ai
pas fait, et pourquoi** : réparer `scripts/lib/feries.ts` — lire les agences
sous l'identité exemptée, comme `scripts/inventaire.mts` le fait par
`prendreIdentiteExemptee` — est hors territoire, et la consigne demandait de
s'arrêter et de le dire. C'est un ticket : sans lui, ce bouton refuse sur
Neon même quand une agence existe, et `pnpm feries:horizon` — même lecture —
est aveugle de la même façon sur l'hébergé.

## 5. La porte jouée

`pnpm verify:full`, **en entier**, sur `b2c3d99`, de **2026-09-22T02:36:26Z**
à **2026-09-22T02:40:49Z** (heures lues à l'horloge) — **EXIT=0** :

| Étape | Résultat |
|---|---|
| `format:check`, `typecheck`, `lint` (`--max-warnings 0`) | sans erreur ni avertissement |
| `test` (unitaires) | **227 fichiers, 2 465 tests passés** (2 436 sur `main` : + 29, dont 13 du gardien neuf, 6 de l'inventaire, 10 d'`url-hors-journal` par population — 5 épreuves × 2 étapes) |
| `test:isolation` | **99 fichiers, 1 061 tests passés** |
| `build` | compilé |
| `feries:horizon`, `audit:partitions` | passés |
| `test:e2e` | **117 passés, 2 sautés** — les deux `test.skip` préexistants de `tous-les-ecrans-rendent.spec.ts` |

## 6. Ce que je n'ai pas fait

- **Le flux n'a pas été joué sur GitHub** : rien n'est poussé. Ce qui est prouvé
  est le YAML lu par les gardiens et les scripts rejoués localement sous les
  rôles de l'hébergé ; ce qui ne l'est pas est l'exécuteur lui-même.
- **L'étape « Poser les référentiels de plateforme » n'a pas les deux
  barrières** (sortie dans un fichier, masque, retrait) : elle joue le script à
  nu, et `referentiels-plateforme.mts` relance lui aussi les erreurs de pilote.
  Même faute, même fichier, hors de la demande — nommée, pas corrigée.
- **`scripts/lib/feries.ts`** — voir §4.
- **`controle-cloisonnement.mts` sur 0 société** conclut *« exactement les
  lignes de chaque société sous son contexte »* d'un ensemble vide ; il dit
  « 0 société(s) » deux lignes plus haut, mais la phrase finale est vraie de
  rien. Hors territoire, nommé.
- La base et les rôles de mesure (`codiplan_mesure`, `mesure_owner`,
  `mesure_bypass`) ont été supprimés après la mesure.
