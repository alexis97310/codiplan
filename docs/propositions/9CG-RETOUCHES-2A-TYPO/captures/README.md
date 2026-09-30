# 9CG-RETOUCHES-2A-TYPO — captures AVANT/APRÈS

- **Commit AVANT** (`avant/`) : `6dcd517` — le premier commit de code de ce ticket (« la mesure des captures lit l'échelle et la graisse »), avant qu'aucune classe ne bouge : c'est l'état où la mesure du script sait déjà compter les six colonnes, mais où rien n'a encore été retouché.
- **Commit APRÈS** (`apres/`) : `b0382e5` — après les six commits de code de ce ticket (échelle, graisse 700, terrain à 16 px, chiffres tabulaires/plancher étendu, trois cas d'héritage trouvés par la mesure elle-même).
- Même commande (`scripts/captures.mts`), même liste de 48 écrans, largeurs 1280, 1024 et 375 px (`LARGEURS_CAPTURES=1280,1024,375`, comme demandé — pas 390), deux bases locales jetables distinctes (`codiplan_captures_9cg`, `codiplan_captures_9cg_apres`) — même semis de démonstration (`pnpm db:seed`), aucune donnée réelle (I9). Comme 9CB et 9CA : le second facteur d'un compte de démonstration activé pendant une prise n'est pas rejouable sans son secret, d'où deux bases plutôt qu'une seule resemée.
- 120 images prises de chaque côté, 18 refusées des deux côtés (mêmes refus, mêmes causes) : `arrivee-sans-societe` (exige `SECRET_TOTP` d'un compte multi-société déjà enrôlé), `portail` (aucun compte portail ne peut recevoir de mot de passe aujourd'hui, D10), `intervention-detail`, `demande-detail`, `intervention-bon` (aucune donnée du semis dans l'état requis) et `client-detail` (le témoin de l'écran n'est pas trouvé sur la fiche du premier client) — tous des refus structurels déjà documentés par 9BZ/9CA/9CB, sans rapport avec ce ticket.

## La mesure, AVANT → APRÈS, par largeur

Somme sur les 48 écrans capturés à chaque largeur (voir le détail écran par écran dans `avant/README.md` et `apres/README.md`, section « Mesure »).

| Largeur | Textes < 12 px (D138) | Cibles sous le seuil | Débordement (somme, px) | Erreurs | Hors échelle (D143) | Petits textes légers (point 11) | Terrain < 16 px (point 8) |
| ------- | ---------------------- | --------------------- | ------------------------ | -------- | --------------------- | --------------------------------- | --------------------------- |
| 1280 px | 0 → 0                   | 0 → 0                  | 0 → 0                     | 0 → 0    | **294 → 0**            | **1507 → 11**                      | 48 → 20                      |
| 1024 px | 0 → 0                   | 0 → 0                  | 74 → 74                   | 0 → 0    | **294 → 0**            | **1507 → 11**                      | 48 → 20                      |
| 375 px  | 0 → 0                   | 364 → 362               | 52 → 85                   | 0 → 0    | **262 → 0**            | **1135 → 11**                      | 48 → 20                      |

**Ce que chaque colonne dit :**

- **Hors échelle : tombe à zéro aux trois largeurs.** C'était l'objet des points 6, 7 et 10 (12,5 px → 13 px, 19-27 px ramenés à 18/24/28 px) : plus aucun texte du dépôt ne rend une taille calculée hors des huit valeurs de l'échelle (12/13/14/15/16/18/24/28 px).
- **Petits textes légers : divisé par ~137 (1507 → 11).** C'était l'objet du point 11 (700 minimum à 12-13 px). Les 11 qui restent, aux trois largeurs, sont EXACTEMENT les sept occurrences de `CLASSES_LIEN_TUILE` (« Voir X sur le planning → », etc.) — « le lien sous une tuile », nommément laissé hors territoire de ce ticket (réservé à 9CH-RETOUCHES-2B-COMPOSANTS, voir « Ce que je n'ai pas fait »). Trois cas d'héritage ont été trouvés et corrigés grâce à cette mesure même (`arrivee/page.tsx`, `imports/[id]/page.tsx`, `parametres/equipe/page.tsx`) — invisibles au gardien statique, qui n'exige une graisse que sur la ligne qui porte elle-même le jeton de taille.
- **Terrain < 16 px : 48 → 20, ne tombe pas à zéro, et c'est attendu.** La mesure ne connaît pas l'exception « surtitre ou pastille » que porte le gardien statique (`retouches-2a.test.ts`) — elle compte TOUT texte sous 16 px sur un écran terrain, y compris les surtitres (`uppercase`, 12 px) et les pastilles (`rounded-full`, 12 px) légitimement laissés au rang « plus petit texte » par la lecture retenue du point 8, ET le bandeau de navigation (`components/navigation/barre.tsx`, « SAV », « CODIMA Nouvelle-Calédonie », « Se déconnecter », initiales), qui n'est PAS un écran du terrain au sens du point 8 (partagé avec le back-office et le portail). Le détail des 20 restants est visible dans `apres/README.md`, sections « terrain » et « terrain-intervention ».
- **Débordement à 375 px : 52 → 85, en hausse.** Non mesuré comme un défaut de ce ticket : aucune classe de largeur, de marge ni de disposition n'a été touchée (territoire strictement typographique). Écart à investiguer séparément — voir « Ce qui reste à faire ».
- **Cibles sous le seuil à 375 px : 364 → 362, quasi stable** (une variation de 2, dans le bruit d'un texte qui change de largeur visuelle à cible constante).
- **Débordement à 1024 px : 74 → 74, inchangé** — préexistant, hors territoire (le parc, déjà nommé par 9CB comme un écart non lié).

**Une hypothèse n'est pas une mesure** : ces chiffres sont ceux que `scripts/captures.mts` a écrits dans chaque `README.md`, à la volée, sur une base fraîchement semée — jamais une extrapolation depuis le grep statique du ticket.
