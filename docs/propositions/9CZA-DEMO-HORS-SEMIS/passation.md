# 9CZA-DEMO-HORS-SEMIS — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`scripts/lib/doublons-machine.ts` (`planDeNettoyage`) : quand une intervention
porte plusieurs rattachements machine et qu'AU MOINS UN porte le préfixe du
semis (`PREFIXE_RATTACHEMENT_SEED`), le plan garde désormais la plus petite
ligne DU SEMIS et retire toutes les autres — y compris celles posées à la
main par l'application, qui jusqu'ici faisaient refuser le plan entier
(verdict `hors_semis`). Le cas « aucune ligne du groupe n'est du semis » est
inchangé : refus, comme avant. `rapportDoublons` nomme chaque ligne retirée
qui n'est pas du semis (« posée hors du semis — retirée, décision du
03/10/2026 ») pour qu'un humain qui lit le rapport voie qu'une machine
posée à la main, pas seulement un doublon du semis, est sur le point d'être
détachée.

Pour l'exploitation : le flux « DB doublons machine — démonstration » peut
désormais proposer puis appliquer un plan sur l'état réellement bloqué
(P3009, cf. `base-demo-p3009-diagnostic.md`) — avant ce lot, il refusait
systématiquement (code 1) parce qu'une des deux lignes en doublon est une
ligne posée à la main (`01a0c25e-…`), jamais préfixée par le semis. Le §7 ter
de `docs/mise-en-ligne.md` est mis à jour en conséquence. Aucune migration,
aucune connexion réelle : seule la fonction pure et son rapport changent.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Sur un état FABRIQUÉ reproduisant exactement l'état mesuré en démonstration
le 03/10 (mêmes identifiants que ceux nommés dans le refus observé par
Alexis) : voir `docs/propositions/9CZA-DEMO-HORS-SEMIS/README.md`.

- AVANT (code d'avant ce lot) : `REFUS`, code de sortie `1`, rien de proposé.
- APRÈS (ce lot) : plan à 1 groupe, `gardee` = la ligne du semis
  (`0192f0a0-b000-…0001`), `retirees` = [la ligne posée à la main
  (`01a0c25e-…`)], `Total à retirer : 1 ligne(s)`.

Je n'ai PAS rejoué ce script contre une base réelle (jetable ou de
démonstration) — interdit par ce lot (« aucune connexion à une base réelle
ou de démo »). La mesure ci-dessus porte sur la fonction pure uniquement ;
l'exécution réelle du flux GitHub sur la base de démonstration bloquée
reste à faire par Alexis (voir « ce qui reste à faire »).

## Ce que j'ai tranché et pourquoi

Un groupe où COHABITENT plusieurs lignes du semis (cas non mesuré en démo,
mais couvert par un test) : j'ai gardé la plus petite ID *parmi celles du
semis* et retiré toutes les autres lignes du groupe (semis excédentaires
et lignes posées à la main confondues) — c'est la lecture la plus directe
du texte de la décision (« on garde le rattachement DU SEMIS … et on retire
tous les autres »), qui ne distingue pas les autres lignes du semis des
lignes manuelles une fois la ligne à garder choisie.

Le docblock du module cite la décision (date, `claude/decisions-alexis-03-10.md`
point 6) plutôt qu'un numéro dans `docs/arbitrages.md` — le ticket est
explicite : « Aucun numero de decision dans docs/arbitrages.md (regle
d'exploitation de la seule demo, ecrite dans le docblock du module) ».

## Ce que je n'ai PAS fait

Je n'ai touché ni le flux `.github/workflows/db-doublons-machine-demo.yml`
(toujours manuel, `appliquer` décoché par défaut), ni
`scripts/nettoyer-doublons-machine-demo.mts` (son comportement suit
automatiquement le nouveau plan — rien dans son code ne dépendait de
l'ancien verdict `hors_semis` au-delà de ce qu'il fait encore aujourd'hui
pour le cas « aucune ligne du semis »). Je n'ai exécuté aucune migration, je
n'ai supprimé aucune machine, je n'ai levé `FORCE ROW LEVEL SECURITY` nulle
part, je n'ai touché à aucune base réelle ou de démonstration.

## Les pièges pour la session suivante

- Le script `scripts/nettoyer-doublons-machine-demo.mts` n'a pas été rejoué
  contre la vraie base de démonstration bloquée depuis ce lot : la prochaine
  exécution du flux GitHub (lecture seule d'abord, `appliquer` décoché) est
  le premier test réel de ce changement sur l'état mesuré par Alexis. S'il
  diffère de ce qui est documenté ici (par exemple si la base porte d'autres
  lignes en doublon que celles nommées dans le refus du 03/10), le rapport
  le dira — le lire avant d'appliquer.
- La comparaison lexicographique des identifiants (`parPlusPetitId`) ne
  privilégie plus jamais une ligne hors semis : si un jour une ligne du semis
  ET une ligne posée à la main ont le même suffixe par coïncidence, seul le
  préfixe `PREFIXE_RATTACHEMENT_SEED` décide d'abord qui est « du semis »,
  l'ordre lexicographique ne départage qu'ENTRE lignes du semis.
- Le test existant « refuse si une ligne en doublon ne porte pas un
  identifiant du semis » a changé d'objet (il porte maintenant sur « AUCUNE
  ligne n'est du semis ») — une relecture rapide du diff de
  `tests/unit/db/doublons-machine.test.ts` suffit à voir qu'aucune autre
  attente n'a été retirée ni affaiblie.

## Ce qui reste à faire

Rejouer le flux « DB doublons machine — démonstration » (`appliquer` décoché)
sur la vraie base de démonstration bloquée, lire le nouveau rapport, puis
(si le plan convient) le relancer avec `appliquer` coché, suivi de « DB
resolve » puis « DB migrate & seed » comme décrit au §7 ter de
`docs/mise-en-ligne.md` — ce sont des gestes d'exploitation, hors du
territoire de ce lot (lecture seule imposée), et ils reviennent à Alexis.
