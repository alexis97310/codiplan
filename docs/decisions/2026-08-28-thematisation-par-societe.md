# La lisibilité se calcule : le contraste, et non le refus d'une couleur

*28 août 2026 — ticket L0-09, arbitrage D51.*

## Contexte

La thématisation par société est un paramétrage, pas un développement
(RG-SOC-06) : nom d'affichage, couleur d'identité et couleur d'accentuation
vivent dans `societe`, et un client qui achète la solution change ses couleurs
sans qu'on redéploie. Poser ces couleurs est simple. **Ce qui ne l'est pas,
c'est ce qu'on écrit dessus.**

Le cas, tel que le ticket le pose : un client choisira un jaune pâle, du texte
blanc sera posé dessus, et le résultat sera illisible — dans une application
qu'un technicien lit **au soleil**, sur un écran de téléphone. Mesuré :

| Fond | Encre blanche | Encre calculée |
|---|---|---|
| `#fff9c4` — jaune pâle | **1,07:1** | `#000000` → **19,60:1** |
| `#f4a300` — orange soutenu | 2,08:1 | `#000000` → 10,09:1 |
| `#00ff00` — vert saturé | 1,37:1 | `#000000` → 15,30:1 |
| `#0b5cad` — bleu profond | 6,67:1 | `#ffffff` → 6,67:1 |

Le seuil de référence est **4,5:1** : WCAG 2.1, critère de succès 1.4.3
« Contrast (Minimum) », niveau AA, texte courant. Pour le grand texte et pour
les éléments non textuels — bordures, pastilles, repères porteurs de sens —, la
norme demande **3:1** (critères 1.4.3 et 1.4.11).

Le jaune pâle est donc **quatre fois sous le seuil**, et la couleur qui le
provoque est parfaitement légitime : c'est l'identité visuelle d'un client.

## Options écartées

**Refuser la couleur à la saisie.** C'était la première voie ouverte par le
ticket. Elle est écartée pour trois raisons, dans cet ordre d'importance :

1. **Elle ne garantit rien de plus.** Le choix automatique de l'encre garantit
   déjà 4,58:1 (voir plus bas). Un refus ne peut pas faire mieux sur la question
   posée — il ne fait que déplacer la difficulté chez le client ;
2. **Nous vendons la solution.** Refuser une couleur, c'est refuser l'identité
   visuelle d'un client, qui choisira alors « la couleur la plus proche que le
   logiciel accepte ». Le produit se met à arbitrer une question de marque ;
3. **Un refus posé sur un formulaire ne tient que ce formulaire.** La couleur
   est une donnée : elle arrivera aussi par un import, une reprise, une
   migration, une console d'éditeur. Le seul point par lequel tous les chemins
   d'écriture passent est le **rendu**.

**Éclaircir ou assombrir la couleur du client jusqu'au seuil, et l'afficher
ainsi.** Écartée comme mécanisme principal : elle change en silence la couleur
que le client a choisie. Elle est retenue pour un usage précis et nommé (voir
plus bas), jamais pour le fond d'identité.

**Poser une encre blanche partout, et documenter la recommandation.** C'est le
défaut que le ticket décrit. Une recommandation écrite dans une documentation ne
survit pas à la première société paramétrée un vendredi soir.

## Décision

**L'encre est choisie par le calcul, jamais par le goût — et le refus à la
saisie ne porte que sur la forme.**

**1. Le choix de l'encre est une garantie, pas une heuristique.** Entre le noir
et le blanc, le meilleur des deux ne descend **jamais** sous
`√(1,05 / 0,05) = √21 ≈ 4,5826:1`, quel que soit le fond sRGB. Le pire fond
possible est celui dont la luminance relative vaut
`√(1,05 × 0,05) − 0,05 ≈ 0,179129` : il contraste aussi mal avec le noir qu'avec
le blanc, et c'est le minimum de la fonction. **4,58 > 4,5** : le seuil AA est
franchi par construction, sur toutes les couleurs, pour toujours.

Ce n'est pas une mesure faite sur un échantillon : c'est la valeur de la
fonction en son minimum. Le balayage exhaustif du cube sRGB, dans
`tests/unit/theme/contraste.test.ts`, retrouve exactement 4,5826 — il vérifie
que le code réalise ce que le calcul annonce, il ne le remplace pas.

**2. Ce qui reste refusé à la saisie est d'une autre nature.** Une valeur qui
n'est pas une couleur sRGB — `bleu`, une chaîne vide, un `rgb(…)` — est une
donnée cassée, pas une couleur pâle. Elle est refusée par un schéma Zod et par
une contrainte `CHECK` en base (`societe_couleur_primaire_forme`), éprouvée par
retrait comme le §9 l'exige. **Refus de forme, jamais de teinte.**

**3. La couleur de société employée comme ENCRE est traitée à part.** Le choix
noir/blanc traite le texte posé SUR la couleur. Il ne dit rien du cas inverse —
la couleur de société employée comme texte sur la surface de l'application, où
un jaune pâle sur blanc reste illisible. Une troisième variable est donc
calculée, `--societe-primaire-lisible` : la même couleur, teinte et saturation
conservées, dont seule la **clarté** est déplacée jusqu'à 4,5:1. La couleur
d'origine n'est jamais altérée — elle reste le fond, `--societe-primaire`.

**4. Une société sans charte reçoit le thème neutre CODIPLAN**, défini une seule
fois dans `lib/theme/defaut.ts` et identifié comme LE défaut. Les deux colonnes
de couleur deviennent nullables pour cela : « société sans charte » doit être un
état représentable, sinon le provisionnement d'un client inventerait deux
couleurs et plus personne ne distinguerait ensuite un choix d'un remplissage.

## Conséquences

**Un seul mécanisme, alimenté par la table.** Six variables CSS —
`--societe-{primaire,accent}{,-encre,-lisible}` — posées **côté serveur** sur le
document, depuis la société active de la session. Aucun fichier de style propre
à une société, aucun nom de société dans le code, aucun script côté navigateur :
les couleurs partent avec le HTML, sans clignotement au chargement. Un gardien
statique refuse tout littéral de couleur dans `app/`, `components/` et `lib/`
hors `lib/theme/`, et refuse qu'une feuille de style DÉFINISSE une variable de
société — ce serait un thème écrit à la main.

**Le cloisonnement s'applique à la charte comme au reste.** La lecture passe par
le filtre applicatif puis par la politique RLS `id = app.societe_id` (D42) : une
session active sur A n'obtient pas la charte de B, même en demandant
l'identifiant de B — elle obtient zéro ligne, donc le thème neutre. Le portail
client affiche la charte de la société qui le **sert**, puisque c'est elle que
porte la session d'un compte portail (D10).

**Le rendu devient dynamique.** Lire la session pour choisir des couleurs
interdit de figer la page à la compilation. C'est la conséquence assumée d'une
charte qui est une donnée. En contrepartie, un thème ne fait **jamais** échouer
un rendu : toute impossibilité — pas de session, pas de société, base
injoignable — rend le thème neutre. Le refus d'accès aux **données**, lui, reste
entier ; il est prononcé par les politiques, jamais par la couleur d'un bandeau.

**Une exemption a été ajoutée à un gardien voisin, et elle est prouvée.** Le
gardien des parités (L0-07) refuse tout décimal à quatre chiffres ou plus dans
le code applicatif. Les coefficients de luminance de WCAG 2.1 — `0,2126`,
`0,7152`, `0,0722`, seuil `0,04045` — ont exactement cette forme sans être des
taux. `lib/theme/` est donc exempté de la seule règle de **forme** ; la règle
forte — aucun taux du seed nulle part, `lib/theme/` compris — continue de
s'appliquer, et un scénario l'éprouve en écrivant une vraie parité dans le vrai
fichier. Contourner le motif en écrivant les coefficients sous forme de
fractions aurait rendu le code incomparable au texte de la norme, et interdit
jusqu'à les citer en commentaire : c'est la faute que le gardien
`SECURITY DEFINER` de D50 avait commise puis corrigée.

**Ce qui n'est pas fait, et pourquoi.** Le **logo de société** reste hors
périmètre : la colonne `societe.logo_url` existe depuis L0-03, mais l'afficher
suppose un stockage de fichiers, qui est une décision d'architecture à part
entière. Le mécanisme ne l'empêche pas — le logo entrera par le même chemin que
les couleurs, une colonne lue de plus et un élément de plus dans le bandeau.
Inscrit au registre des arbitrages.

## Ce qui reste ouvert

**Faut-il viser 7:1 sur l'application terrain ?** Le seuil AAA de WCAG 2.1
(critère 1.4.6) est de 7:1, et un écran de téléphone en plein soleil est
précisément le cas qui le justifierait. Il n'est **pas** atteignable par le seul
choix noir/blanc : sur un fond de luminance moyenne, ce choix plafonne à
4,58:1 — c'est une propriété de la fonction, pas une limite d'implémentation.
L'atteindre imposerait de **déplacer la couleur du client**, donc de trancher un
arbitrage : à partir de quel écart la charte d'un client cesse-t-elle d'être la
sienne ? La question est inscrite au registre, avec pour déclencheur le lot 3 —
celui de l'application technicien, où le soleil devient un paramètre réel.
