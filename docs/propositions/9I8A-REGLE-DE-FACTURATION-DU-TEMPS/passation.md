# 9I8A-REGLE-DE-FACTURATION-DU-TEMPS — passation

## Arrêt au point 1 — la mesure déclenche la clause d'arrêt écrite dans le brief

Le brief du point 1 prévoyait explicitement ce cas et disait quoi faire s'il se présentait :

> « Si la valorisation d'une intervention DÉJÀ clôturée est recalculée à la lecture avec la règle courante,
> ARRÊTE-TOI à ce point et écris-le en passation : il faudrait figer la règle à la clôture, c'est à arbitrer. »

**La mesure confirme le cas.** Aucune ligne de code n'a été écrite au-delà de cette mesure — points 2 à 7 non commencés.

### Ce qui est figé à la clôture, et ce qui ne l'est pas

`cloturerIntervention` (`lib/interventions/depot.ts:1864-2044`) écrit en base, une fois pour toutes, à la clôture :
- `temps_valide_min` (~l.1996) — le temps validé, jamais retouché ensuite ;
- `montant_ht` / `devise_code` (~l.2007-2008) — le total hors taxes déjà composé, ou `null` si inconnu.

Mais `lireFicheIntervention` (~l.2907-3232), qui alimente l'onglet « Valorisation » de la fiche (D83 : « voir l'arrondi
et le plancher s'appliquer sous les yeux »), **ne relit pas ces deux colonnes pour les afficher**. Elle recompose
TOUTE la décomposition à chaque lecture (~l.3095-3135), pour **toute** intervention dont `temps_valide_min` est posé,
**qu'elle soit clôturée ou pas** — rien dans cette branche ne teste le statut ni `cloturee_le` :

```
const v = valoriserTempsPasse(brute.temps_valide_min, taux.taux);   // ~l.3100
const composition = valoriserIntervention({ ... v.mainDoeuvre ... });   // ~l.3106
```

`valoriserTempsPasse` applique le pas d'arrondi et le plancher par les constantes `PAS_ARRONDI_MINUTES` /
`PLANCHER_MINUTES` de `lib/tarification/valorisation.ts` (~l.45-48) — aujourd'hui des constantes de module,
identiques pour tout le dépôt, donc aujourd'hui sans effet observable puisqu'elles ne varient jamais. Le commentaire
du code (~l.3101-3105) dit l'intention : « l'écran ne recalcule pas un total avec sa propre règle » — l'intention
visait l'ANCIEN risque (une seconde formule divergente), pas celui-ci : la MÊME formule, mais dont les PARAMÈTRES
changeraient dans le temps.

**Le taux horaire, lui, est déjà protégé contre ce risque** : `tauxEnVigueur(tx, brute.date_planifiee ?? instant)`
lit le taux **historique**, à la date de l'intervention, jamais « le taux du jour » — c'est une table avec une
fenêtre de validité. Rien d'équivalent n'existe pour le pas d'arrondi, le plancher ou le seuil de palier : ce sont
des constantes nues, sans historique, et le brief demande d'en faire des réglages de société **mutables**.

Le bon d'intervention (`lib/interventions/bon.ts:34-57`) est, lui, déjà correct : il lit `intervention.montant_ht`
tel que la clôture l'a figé, et ne recompose rien — « un bon qui referait ce calcul en serait une seconde lecture ».
C'est exactement le traitement qu'il faudrait pour la fiche, et qu'elle n'a pas.

### Pourquoi c'est un point d'arrêt, pas une mesure qu'on peut trancher seul

`docs/doctrine-arbitrage.md` §4 donne la maxime générale — *« un prix se fige sur le document au moment de la
clôture : une facture ne change pas quand un tarif change »* — et elle répond, en substance, à la question. Mais
le §1 de ce même document, repris au §8 du `CLAUDE.md`, est explicite : une règle qui change **ce qu'un client
paie ou voit** reste un point d'arrêt **malgré** une famille déjà tranchée. Rendre le réglage de société mutable
(point 5 du brief) rend ce bogue latent réel : le jour où une société change son palier, la fiche d'une intervention
clôturée **avant** le changement afficherait une décomposition — et un total — recalculés avec le **nouveau**
réglage, alors que `montant_ht` en base (donc ce qui a été facturé) reste l'ancien. Deux montants divergents sous
les yeux d'un même utilisateur, sur un document qui prétend expliquer l'autre. C'est très exactement ce qu'Alexis a
exclu (« rien de déjà clôturé n'est recalculé »), sauf que l'endroit qui le violerait n'est pas celui que le brief
nommait (`temps_valide_min` est bien figé) — c'est un étage au-dessus, l'AFFICHAGE de sa décomposition.

### Les deux options, et leurs conséquences

**Option A — figer la décomposition elle-même à la clôture.** Ajouter, dans la même migration que les trois
réglages de société, les colonnes qui mémorisent sur `intervention` ce que `cloturerIntervention` a calculé une
fois : les minutes arrondies, les minutes facturées, l'indicateur de plancher appliqué, et les trois paramètres de
règle effectivement utilisés (pour que la décomposition reste lisible et auditable même après un futur changement
de réglage). `lireFicheIntervention` lirait alors ces colonnes **dès que `cloturee_le` n'est pas `null`**, et ne
recalculerait en direct (`valoriserTempsPasse`/`valoriserIntervention`) que pour une intervention **pas encore
clôturée** — un aperçu avant validation, qui n'a par construction rien à figer.
*Conséquence* : un changement de schéma sur `intervention` au-delà des trois colonnes déjà prévues sur `societe` —
plus large que ce que le brief avait balisé en territoire — et une petite divergence de lecture entre « avant » et
« après » clôture qui n'existe pas ailleurs dans ce module (la majoration, elle, n'est actuellement PAS figée non
plus : elle a le même défaut, non mesuré par ce brief, à signaler au registre si A est retenue).

**Option B — ne plus recomposer la décomposition après clôture, sans la figer.** `lireFicheIntervention` cesserait
d'appeler `valoriserTempsPasse`/`valoriserIntervention` pour une intervention clôturée, et afficherait à la place
uniquement ce que la base porte déjà : `temps_valide_min` (le temps réel), `montant_ht` (le total), sans le détail
intermédiaire (arrondi, plancher, main-d'œuvre, majoration séparées). *Conséquence* : aucune migration
supplémentaire, mais une régression d'affichage pour **toute intervention déjà clôturée avant ce lot** (la demande
D83 — « voir l'arrondi et le plancher s'appliquer sous les yeux » — ne serait plus honorée que pour les
interventions closes APRÈS ce lot, si l'option A ultérieure n'est pas aussi posée pour elles) ; et selon ce qui est
réellement demandé pour les anciennes interventions (afficher QUE le total, ou refuser d'afficher l'onglet), une
question supplémentaire à trancher.

Aucune des deux n'a été codée : l'option A seule change un schéma au-delà du territoire fixé par ce brief, et les
deux changent ce qu'un utilisateur voit sur une facture déjà émise — la décision reste à Alexis par construction
(doctrine §1).

## Ce qui N'a PAS été fait

Rien des points 2 à 7. `lib/tarification/valorisation.ts` n'a pas été touché. Aucune migration n'a été écrite.
Aucun réglage n'existe dans Paramètres. `docs/arbitrages.md` n'a reçu aucune décision neuve.

## Mesure du budget

T0 = 08:57 (Pacific/Noumea), limite 150 min. Travail sur la branche dédiée `9i8a-regle-de-facturation-du-temps`,
partant d'`origin/main` (HEAD y était détaché, identique à `origin/main`, au démarrage — `main` était extrait dans
un autre worktree, `/home/aplou/codiplan`). Un seul commit : cette passation, posée dès la mesure faite, bien avant
la moitié du budget.

## Pour reprendre

Faire trancher Alexis entre les options A et B ci-dessus (ou une troisième), puis reprendre à partir du point 2 du
brief original avec la décision écrite en tête (et, si A est retenue, l'étendre à la majoration qui a le même
défaut). `pnpm verify` n'a rien à vérifier de neuf ici — aucun code n'a changé — mais a été rejoué par précaution
avant ce commit.
