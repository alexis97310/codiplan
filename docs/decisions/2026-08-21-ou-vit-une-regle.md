# Où vit une règle — trois arbitrages de rangement

*Ticket L0-06c. Arbitrages D43, D44 et D45, relevés à la revue de la livraison
D42. Touche D19 (amendé), D11 (rangé) et le §6 du CLAUDE.md.*

## Contexte

Les trois points ont la même forme, et aucun n'est un défaut de code : **une
règle qui n'était pas là où on la cherchait.**

**D43** — un texte de ticket écrivait `7 000 F` là où D19, de rang 1, écrit
`7 000 XPF`. La session n'a rien changé : un énoncé de ticket est de rang 4, il
ne peut pas amender un arbitrage, fût-ce d'une lettre.

**D44** — l'invariant I2, le §6 du CLAUDE.md et le ticket logeaient tous la
conversion de devises dans `lib/reporting`. **D19 seul disait `lib/money`** — et
D19 est de rang 1. Trois sources justes et une source faisant autorité qui les
contredit.

**D45** — l'arrondi au quart d'heure supérieur (D11) était accroché au module
monétaire dans le backlog, et la question s'est posée de le confier au
calendrier. Ni l'un ni l'autre : le calendrier répond à « quand », le module
monétaire à « combien s'écrit comment ». L'arrondi dit **ce qu'on facture**.

## Options écartées

**Pour D43 — « corriger » le formatage vers `F`.** Écarté sans hésitation : cela
aurait fait passer une décision commerciale — comment la monnaie s'affiche devant
un client néo-calédonien — pour une correction de détail, sur la foi d'une
inadvertance de rédaction. Écarté aussi de **laisser la question sans trace** :
elle est réelle, elle se posera, et une question réelle sans déclencheur revient
au pire moment. Elle part au registre avec le sien — la conception du premier
document destiné à un client.

**Pour D44 — écrire le code juste et laisser D19 tel quel.** C'est le
contournement, et c'est la pire des deux erreurs, parce qu'elle ne se voit pas à
l'exécution : le dépôt serait correct et la constitution menteuse. Le prochain
lecteur de D19 logerait la conversion dans `lib/money` **en respectant la
hiérarchie des sources**, et il aurait raison de le faire. Une source de rang 1
qu'on sait fausse est plus dangereuse qu'une source absente : l'absente fait
poser la question, la fausse fait confiance. Écarté aussi d'**effacer la
rédaction d'origine** : un amendement sans trace se rejoue au prochain doute.

**Pour D45 — mettre l'arrondi dans `lib/calendar`.** Séduisant : l'arrondi porte
sur des durées, et les durées sont le métier du calendrier. Mais un module qui
connaît à la fois les horaires d'agence et la politique de facturation lie deux
règles qui n'ont **aucune raison d'évoluer ensemble** : un changement de tarif
pourra casser un planning, et le gardien calendrier se mettra à défendre les
deux. **Le laisser dans `lib/money`** a le même défaut sous une autre forme : le
module monétaire formate et calcule, il ne décide pas ce qu'on facture.

## Choix

**D43 : le code ne bouge pas, la question est datée.** D19 dit `7 000 XPF`, la
maquette l'écrit ainsi, `prisma/seed-data.ts` porte `symbole: null` pour le XPF —
la convention « symbole si la devise en a un, code sinon » produit exactement cet
affichage. La question part au registre avec son **déclencheur explicite** : le
premier document destiné à un client — devis, facture ou rapport d'intervention.
Si le choix se porte alors sur `F`, ce sera un **amendement de D19 et une ligne
de seed**, décidés comme tels.

**D44 : D19 est amendé.** La frontière de conversion s'écrit désormais
`formatMoney` dans `lib/money`, `convertForConsolidation` dans **`lib/reporting`**.
La rédaction d'origine est conservée en note sous la décision. Les autres sources
ont été vérifiées une à une : `docs/backlog.md` (L0-07) portait encore l'ancienne
formulation et est corrigé ; le CLAUDE.md (I2 et §6) et le chapitre 10 (RG-TAR-02)
étaient déjà justes.

**D45 : l'arrondi est rangé en L2-09**, le ticket de valorisation, et le §6 du
CLAUDE.md porte désormais les deux frontières en clair — `money/` ne convertit
pas, `calendar/` ne facture pas. Une frontière écrite dans l'arborescence se lit
au moment où l'on choisit un fichier ; une frontière écrite dans un arbitrage se
lit quand on pense déjà à autre chose.

## Conséquences

**Une question commerciale est inscrite avant d'être rencontrée.** L'arrondi au
quart d'heure supérieur s'applique-t-il à **chaque intervention** ou au **total
d'une journée** ? Cinq passages de cinq minutes font **1 h 15** dans un cas et
**30 minutes** dans l'autre — un facteur deux et demi sur la tournée la plus
courante en dépannage urbain. D11 règle l'agrégation *à l'intérieur* d'une
intervention (« jamais ligne par ligne ») et ne dit rien *entre* interventions.
Elle doit être tranchée **avant** L2-09 : une session qui la découvrirait en
cours d'écriture la trancherait par le plus simple à coder, et le premier client
qui compte ses quarts d'heure la découvrirait à sa facture.

**Rien n'a changé dans le code.** Ni `lib/money` ni `lib/calendar` n'existent
encore — ils arrivent aux tickets L0-07 et L0-08. C'est précisément le bon
moment : ranger une règle avant d'écrire le module coûte une ligne de backlog ;
la déranger après coûte un déplacement de fichiers et un gardien à réécrire.

**Ce que D44 ajoute à D1.** D1 disait : une règle ne s'écrit qu'à un seul
endroit. D44 y ajoute le cas où le mal est déjà fait — **quand deux sources
divergent, on corrige la fausse, on ne s'aligne pas sur la vraie en silence.**
