# 99F-CIBLES-375 — passation

## Ce que j'ai changé

Sur `/planning`, sous `sm` (téléphone) :

- le lien vers les blocages d'agenda (`absences.titre`, `app/(back-office)/planning/page.tsx`) ;
- le lien « Voir les interventions sans durée → »
  (`statistiques.charge_incomplete_lien`, `app/(back-office)/planning/statistiques.tsx`).

portent désormais une zone cliquable d'au moins 44 px de haut (`inline-flex
min-h-11 items-center`) et un texte porté à 13 px (contre 11,5 px et ~12 px).
Les classes ajoutées sont effacées à partir de `sm` (`sm:inline sm:min-h-0
sm:text-[11.5px]`/`sm:text-xs`) : le rendu bureau est resté octet pour octet
identique à avant (mesuré, voir ci-dessous).

**Pour l'exploitation** : ces deux liens se touchent désormais du pouce sur un
téléphone sans viser un texte de 14-16 px de haut — le premier ouvre le
registre des blocages d'agenda, le second filtre le registre des
interventions sur celles sans durée saisie. Aucun changement de comportement,
seulement de zone cliquable.

## Ce que j'ai mesuré (AVANT/APRÈS, sur la main de ce ticket)

Mesures prises par un scénario Playwright réel (`boundingBox()`), pas
estimées :

| Lien | 375 px, avant | 375 px, après | 1280 px, avant | 1280 px, après |
|---|---|---|---|---|
| `absences.titre` | 14 px | **≥ 44 px** | 14 px | **14 px (inchangé)** |
| `statistiques.charge_incomplete_lien` | 16 px | **≥ 44 px** | — (non exigé par le ticket) | — |

`tests/e2e/planning-cibles-375.spec.ts` porte ces deux mesures comme
assertions (44 px à 375, 13-15 px à 1280) — elles ne sont donc pas qu'un
constat ponctuel, elles restent gardées.

J'ai aussi mesuré, à 375 px, deux familles d'éléments cliquables NON
retouchées, pour justifier de les laisser hors de ce lot (voir plus bas) :
- l'onglet « Jour » (`Onglets`) : **34 px** de haut ;
- le bouton « ← Semaine précédente » (`Deplacement`) : **36 px** de haut.

## Ce que j'ai tranché, et pourquoi

**Le territoire s'arrête aux deux liens cités par l'audit (constat 40), pas à
tout ce qui est sous 44 px sur l'écran.** Deux autres familles d'éléments
cliquables sont mesurées au-dessus sans y entrer :

- Les onglets Semaine/Jour et les boutons de déplacement de semaine/jour
  (`Onglets`, `Deplacement`, `app/(back-office)/planning/page.tsx`) sont des
  **boutons** avec fond et `px-3 py-2`, mesurés à 34-36 px — sous la cible,
  mais très au-dessus des 14-16 px des deux liens traités, qui sont du texte
  NU. `tests/e2e/planning-6.spec.ts` fige déjà leur rendu par rôle et nom
  accessible ; les agrandir aurait élargi le territoire d'un ticket à budget
  de 150 minutes vers un écran que 82-PLANNING-6 vient de stabiliser
  (25/09/2026).
- Les références d'intervention des sections « Jour sans heure » et « Hors
  grille » (`SansHeureVide`, `HorsGrille`) ne sont pas des liens d'ACTION
  greffés sur un contenu : elles SONT le contenu, au même titre que les blocs
  de la grille — le commentaire `data-carte-liste` de `page.tsx` le dit déjà.
  L'audit qualifie l'adaptation mobile du planning de bonne « par ailleurs » ;
  ces listes en sont, et je ne les ai pas mesurées comme cibles à corriger.

**La taille de texte passe de 11,5/~12 px à 13 px sous `sm` seulement pour les
deux liens traités** (jamais pour le texte voisin) : le ticket la demande
explicitement, et l'agrandir SEULEMENT sur le lien plutôt que sur tout son
conteneur évite de changer la taille des chiffres et labels environnants sur
la carte de charge, que ce ticket ne touche pas par ailleurs.

**`CLASSES_LIEN` (`lib/theme/apparence.ts`) n'a pas été modifiée.** Cette
constante est partagée par dix-neuf écrans (gardée par
`tests/unit/theme/lien-visible.test.ts`) ; y ajouter la cible tactile aurait
changé la zone cliquable de tous ces écrans sans mesure ni ticket pour eux.
Les classes de cible tactile sont donc posées localement, à côté de
`CLASSES_LIEN`, uniquement sur `/planning`.

## Ce que je n'ai PAS fait

- Je n'ai pas élargi la zone cliquable des onglets Semaine/Jour ni des
  boutons de déplacement, malgré une hauteur mesurée sous 44 px (voir
  ci-dessus).
- Je n'ai pas touché aux listes « Jour sans heure » / « Hors grille » ni aux
  blocs de la grille.
- Je n'ai posé aucune migration, aucune ligne de semis, aucun prix.
- Je n'ai pas ajouté ni modifié de clé du dictionnaire (`lib/i18n/fr.ts`) :
  la scène de l'épreuve réutilise la clé de témoin déjà ouverte par
  `planning-3.spec.ts` (`planning.e2e.nom_technicien`).

## Pièges pour la session suivante

- Sur ce poste, `min-h-11` résout à 44 px (le `body` du produit fixe
  `font-size: 14px`, mais les utilitaires `rem` de Tailwind se calculent sur
  la racine `html`, jamais réécrite) — ne pas re-mesurer ce point à chaque
  ticket, mais s'en souvenir si un futur thème touche `html { font-size }`.
- `page.getByRole("link", { name: NOM })` où `NOM` est une chaîne écrite à la
  main fait rougir `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` (forme
  3, « DEUX TEMPS ») : passer par `fr["clé"]`, jamais par un littéral, même
  pour un nom de technicien forgé qu'aucun utilisateur réel ne voit.
- Le jour de scène `MARDI + 105` est désormais pris (fichier
  `planning-cibles-375.spec.ts`) ; les décalages déjà réservés par d'autres
  fichiers e2e sont 21/35/49/63/91/92 — un prochain ticket doit choisir un
  autre multiple de 7.

## `CI=1 pnpm verify:full`

Quatre passages complets. Le premier (avant l'ajout des captures dans le
spec) était vert : 294 passés, 3 sautés, 0 échec. Les deux suivants ont fait
rougir `tests/e2e/glisser-deposer.spec.ts` — un test en échec, un autre
« flaky » —, avec le même nom que la flakiness déjà documentée par
`99D-ABSENCES-1/passation.md` et `99E-EVITEMENT/passation.md`, sans rapport
avec ce lot : `glisser-deposer.spec.ts` lancé seul (`--workers=1`) est passé
8/8. Un quatrième passage complet est repassé au vert : **294 passés, 3
sautés, 0 échec**. Aucun fichier de ce lot n'est importé par le planning de
glisser-déposer.

## Ce qui reste à faire

- Les onglets Semaine/Jour et les boutons de déplacement de semaine/jour
  restent sous 44 px (34-36 px mesurés) : un ticket dédié peut les élargir en
  augmentant leur `py`, mais il touchera un rendu que `planning-6.spec.ts`
  vérifie déjà par capture/role, et mérite sa propre mesure avant/après.
- Aucune autre page du back-office n'a été passée en revue par ce lot :
  l'audit du 25/09/2026 ne cite que `/planning` (constat 40) pour les cibles
  tactiles, mais un même défaut peut exister ailleurs.
