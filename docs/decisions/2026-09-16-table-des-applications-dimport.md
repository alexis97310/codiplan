# La table type → écriture existe, et elle est fermée par un gardien

_16/09/2026 — ticket R6-01._

## Contexte

L1-08i n'avait qu'un seul type d'import sous les yeux et a refusé d'écrire une
fonction « applique n'importe quel lot », avec sa raison :

> _« Une fonction “applique n'importe quel lot” devrait tenir une table de
> correspondance entre un type d'import et une écriture, c'est-à-dire une liste
> close de plus, tenue à la main, que le prochain type oublierait. Le jour où un
> second type existe, la question se posera avec deux exemplaires sous les yeux
> plutôt qu'avec aucun. »_

Ce jour est arrivé, et la question se pose avec **cinq** gabarits publiés et une
seule application. Le périmètre réduit du 15/09 promet « l'import Excel
complet » ; l'exploitation a fourni un relevé réel — 653 clients, 599 machines —
qui n'entrera jamais à la main.

Deux mesures ont précédé la décision, et la seconde n'était pas attendue.

**(1) Ce qu'un lot d'un autre type produisait**, mesuré sous `codiplan_app` avec
témoin : sur des **créations**, `schemaCreationClient` lève, la transaction est
annulée, rien n'est écrit ; sur des **modifications**, aucune levée —
`{applique: true, creations: 0, modifications: 0}` et **le lot passe à
`applique`**. Le référentiel est intact et le lot est brûlé : le cliquet ne se
rouvre pas. _Le silence a exactement la forme du succès._

**(2) La prémisse du ticket était fausse.** L'import ne contrôlait pas cinq
types : la route de téléversement était câblée sur `MODELE_CLIENTS` et ne lisait
jamais le marqueur. Une feuille de sites y recevait `marqueur_autre_type`. Les
quatre autres gabarits étaient écrits, éprouvés, **et sans aucun appelant**.

## Options écartées

**Garder le type dans le seul nom de fonction, sans table.** C'est la lettre de
L1-08i, et elle ne tient plus : dès qu'une route doit choisir, quelqu'un écrit
la correspondance — dans un `switch`, dans une suite de `if`, dans une route.
_Une table dispersée dans des routes est la même liste close, à la main, à
l'endroit où elle vieillit le plus silencieusement._

**Dériver la correspondance d'une convention de nom à l'exécution.** Séduisant,
et c'est la forme 6 du §9 (26/08) : ce qui se construit à l'exécution échappe à
tout motif statique. On aurait échangé une liste gardée contre une liste
invisible.

**Écrire aussi l'application des CONTACTS.** `lib/contacts/` ne porte que
`saisie.ts` : il n'existe aucun dépôt. L'écrire ici déciderait à la place de
L1-03b de ce qu'un contact peut porter, _dans le seul chemin où personne ne
relit ce qui entre._

## Décision

**La table existe, et l'objection de L1-08i est fermée par sa seconde moitié —
« que le prochain type oublierait ».** `lib/imports/types-dimport.ts` porte
`APPLICATIONS` et `SANS_APPLICATION`, et un gardien les confronte à **trois
sources qu'aucun fichier gardé ne contrôle** :

1. `APPLICATIONS ∪ SANS_APPLICATION` est **exactement** `TYPES_PUBLIES`,
   lui-même dérivé des constructeurs de gabarits ;
2. les clés d'`APPLICATIONS` sont **exactement** les fonctions
   `appliquerLeLotDe<Type>` que le TEXTE des modules porte, et chacune a son
   `annulerLeLotDe<Type>` ;
3. chaque type applicable a un **index de cible** dans `parc-cibles.ts`.

_Ce n'est donc pas une liste close de plus : c'est une assertion sur des listes
dont aucune ne lui appartient_ (§9, 01/09). Mise en échec sur quatre fautes
réellement écrites — un type retiré de la table, un index de cible retiré, une
application écrite sans son annulation, un gabarit publié non déclaré : chacune
rougit, et en nommant ce qui manque.

**Quatre types s'appliquent** — clients, sites, modèles, prestations. Les
contacts restent au rapport seul, **avec leur motif écrit**, et l'écran ne
montre pas le bouton : _un bouton « Appliquer » qui échoue se lit comme une
panne du fichier_, et l'auteur du classeur chercherait longtemps ce qu'il a mal
rempli.

**Et la route de téléversement lit le marqueur**, dans le même geste. Livrer des
applications sans cela les aurait laissées sans appelant — la maladie exacte que
R3-12 nomme et que L1-05b venait de soigner.

## Conséquences

**Le parent et la cible ne sont pas la même question, et la confusion ne produit
aucune erreur.** `controlerFeuille` reçoit un `ParcConnu` : _une clé qui s'y
trouve est une modification, une clé absente est une création._ Un seul index
existait — celui des clients —, et il aurait servi pour les quatre autres types.
La clé d'un site est `SITE-…`, que cet index ne porte jamais : **toute ligne
serait ressortie en création**, et un second dépôt du même fichier aurait fait
un doublon par ligne. `lib/imports/parc-cibles.ts` répond à la seconde question,
et deux scénarios le gardent — le même fichier redéposé rend 0 création et 1
modification.

**Une affirmation de ce ticket a été mesurée fausse en l'écrivant.**
`parc-cibles.ts` prêtait d'abord à `site` un
`@@unique([societe_id, client_id, libelle])`. _Mesuré dans `pg_indexes` : il
n'en porte aucun_, là où `modele_materiel` et `prestation` en ont un. Un
scénario d'`upsert` l'a démentie en une exécution ; la relecture ne l'avait pas
vue. La clé d'un site peut donc être **ambiguë** au sens de RG-IMP-05, et la
détection l'attrape — un scénario pose deux sites de même libellé et relit
`rejet_motif = cle_ambigue`, avec le témoin que les deux fiches sont intactes.

**Ce que ce ticket n'a pas fermé, et qui est écrit là où on le lira.** Les
contacts n'ont pas non plus d'index de cible : toute ligne de contact ressort en
création. C'est sans conséquence tant qu'aucun lot de contacts ne s'applique, et
ce serait une faute le jour où L1-03b ouvrira le dépôt — **le gardien « chaque
type applicable a un index de cible » est ce qui l'empêchera**, et il rougira ce
jour-là.

**Un fichier de scénarios rend le semis tel qu'il l'a trouvé.** Les deux
nouveaux fichiers étaient verts joués seuls et faisaient rougir **onze
scénarios dans sept fichiers étrangers à l'import** une fois la suite entière
jouée : _le harnais ne recrée pas la base entre deux fichiers_, et une fiche
laissée derrière soi devient une ligne de plus dans le décompte d'un autre.
Éprouvé en jouant la suite deux fois de suite sans réinitialiser la base.

**Réouverture :** _le jour où un sixième gabarit est publié_, la table le réclame
d'elle-même, dans les deux sens.
