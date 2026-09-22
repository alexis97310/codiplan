# TAUX-1 — passation

## 1. Ce que j'ai changé

- **`lib/tarification/succession-taux.ts` (neuf).** Une fonction `succederTaux`,
  à côté de `poserTauxInitial` — qui reste intacte. Elle pose une NOUVELLE
  ligne de `taux_horaire`, à sa propre date d'effet, sans jamais réécrire ni
  supprimer une ligne passée, et sans le cliquet « un seul taux » de
  `poserTauxInitial` (une succession n'exige pas qu'un taux existe déjà).
  Motifs de refus nommés : `montant_invalide`, `date_deja_utilisee`,
  `societe_introuvable`. Elle ne lit jamais « le taux applicable » : cette
  question reste la seule affaire de `tauxEnVigueur`
  (`lib/tarification/taux-horaire.ts`), inchangée.
- **`app/api/parametres/taux-horaire/creer/route.ts` et `saisie-recue.ts`
  (neufs).** La route, sous `exigerCapacite("parametrer_societe")`, est en
  DEUX passages : sans `confirme=oui`, elle ne fait que renvoyer vers l'écran
  de confirmation (rien n'est écrit) ; avec, elle écrit.
- **`app/(back-office)/parametres/taux-horaire/page.tsx` et
  `components/taux-horaire/formulaire.tsx` (neufs).** L'écran montre
  l'historique complet (le plus récent en tête), marque la ligne EN VIGUEUR
  AUJOURD'HUI en interrogeant `tauxEnVigueur` — aucune seconde implémentation
  du critère —, porte le formulaire de saisie, et l'écran de confirmation qui
  relit le montant FORMATÉ avant d'écrire.
- **`lib/navigation/portes-parametrage.ts`** — une dixième porte,
  `/parametres/taux-horaire`, sous « Sociétés & tarifs ».
- **`lib/i18n/fr.ts`** — toutes les chaînes visibles de l'écran, sous
  `taux_horaire.*` et `parametres.index_taux_horaire_*`.
- **`tests/unit/auth/porte.test.ts`** — la route ajoutée à `ROUTE_CAPACITE`
  sous `parametrer_societe`, le compte de routes gardées porté de 45 à 46.
- **`tests/isolation/succession-taux.test.ts` et
  `tests/e2e/taux-horaire-succession.spec.ts` (neufs)** — voir §2.
- **`docs/mise-en-ligne.md`**, point 13 : une phrase ajoutée disant que ce
  geste ne pose plus que le PREMIER taux, tout le reste passant désormais par
  l'écran.

**Ce que ça change pour l'exploitation.** Un directeur d'exploitation peut
désormais poser une hausse de tarif, une correction, ou tout taux qui succède
au premier, depuis un écran — sans développeur, sans accès à la base de
production. Le premier taux d'une société continue de se poser par le flux
GitHub (`poser_taux`), qui reste un geste de MISE EN SERVICE distinct.

## 2. Ce que j'ai mesuré

**L'isolation (`tests/isolation/succession-taux.test.ts`).** Six épreuves,
toutes vertes après le lot. Avant le lot, le fichier `succession-taux.ts`
n'existait pas — `git show main:lib/tarification/succession-taux.ts` échoue —
et la suite ne pouvait donc même pas s'importer : rouge par construction, pas
mesuré séparément par un `git stash` (je ne l'ai pas rejoué sur l'état
antérieur, faute de temps ; l'absence du fichier suffit à l'établir).

**L'écran, mesuré par avant/après réel** (`tests/e2e/taux-horaire-succession.spec.ts`,
captures dans ce dossier) :

| Épreuve | AVANT le lot (stash, code réel) | APRÈS le lot |
|---|---|---|
| `/parametres` porte un lien vers `/parametres/taux-horaire` | **ROUGE** — `locator('a[href="/parametres/taux-horaire"]')` introuvable | VERT |
| Confirmation relit « 9 500 XPF », « 01/01/2031 » | test 2 n'a pas tourné (test 1 a fait échouer la suite avant) | VERT |
| Historique porte deux taux après confirmation | idem | VERT |

Le AVANT a été produit en stashant tout le lot SAUF le spec lui-même
(`git stash push -u -- <fichiers du lot>`), en rejouant `playwright test` sur
le code d'avant (capture `1-avant-absence--1280.png`), puis en restaurant le
stash et en rejouant pour `2-confirmation-montant-relu--1280.png` et
`3-apres-historique-deux-taux--1280.png`. La ligne posée par le spec (date
d'effet 2031-01-01, loin dans le futur pour n'interférer avec aucun autre
scénario) est retirée en fin de spec sous le rôle propriétaire — vérifié par
une lecture directe de la base après coup : une seule ligne restait (celle de
la scène, 2020-01-01).

**Une mesure faite EN COURS DE ROUTE, pas anticipée.** La première version de
`succederTaux` lisait la devise de la société par
`tx.societe.findFirst()` sans `where`, comme `taux-initial.ts` semblait
l'autoriser et comme `app/(back-office)/parametres/forfaits/page.tsx` le fait
déjà. L'épreuve d'isolation sur la SOCIÉTÉ B a rougi avec une violation du
déclencheur de cohérence devise/société : `societe` est de forme IDENTITÉ (sa
politique RLS filtre par `app.utilisateur_id`, jamais par `app.societe_id`),
et `findFirst()` sans `where: { id }` peut rendre la société d'un AUTRE
utilisateur habilité, si le compte de l'épreuve est rattaché à plusieurs
sociétés. Corrigé en nommant la société par son id (`findUnique({ where: {
id: societeId } })`), comme `poserTauxInitial` le fait déjà — voir §5, ce
même piège existe encore, non corrigé, dans `forfaits/page.tsx` et
`app/api/parametres/forfaits/devise.ts`.

## 3. Ce que j'ai tranché, et pourquoi

1. **`succederTaux` rend un `Resultat` discriminé (`{accepte, ...}`), jamais
   une exception.** `poserTauxInitial` lève `RefusTauxInitial` parce que son
   seul appelant est un script ; `succederTaux` est appelée depuis une route
   web, sur le même modèle que `creerForfait`/`modifierForfait`
   (`lib/tarification/depot-forfaits.ts`), qui rendent un motif nommé pour
   qu'une route le traduise en redirection. Réouverture : si un jour un script
   appelle directement `succederTaux`, le motif reste lisible sans `try/catch`
   dédié.
2. **Elle n'exige PAS qu'un taux existe déjà.** Le ticket demandait seulement
   qu'une société qui EN PORTE DÉJÀ un puisse en recevoir un second ; rien
   n'interdit par ailleurs qu'une ligne soit posée sur une société qui n'en
   porte encore aucune (base restaurée, correction, scénario d'isolation). Lui
   ajouter un cliquet aurait dupliqué celui de `poserTauxInitial` sans texte
   qui l'exige. Réouverture : si l'exploitation demande un jour qu'une
   société DOIVE passer par la mise en service avant toute succession, c'est
   une règle à écrire, pas une déduction à faire ici.
3. **La date d'effet est OBLIGATOIRE dans le formulaire**, sans défaut au jour
   courant (contrairement à `poserTauxInitial`). Une succession est un geste
   délibéré sur une date choisie (souvent future — un 1er janvier) ; un défaut
   « aujourd'hui » aurait pu passer inaperçu et surprendre.
4. **Capacité `parametrer_societe`**, la même que les forfaits. C'est la seule
   capacité qui gouverne déjà les réglages de société de cette famille (dix-huit
   routes désormais), et le ticket demandait la plus restreinte en cas de
   doute — aucune capacité plus étroite n'existe pour ce périmètre.
5. **Aucune nouvelle lecture de « quel taux s'applique ».** L'écran
   d'historique appelle `tauxEnVigueur` pour marquer la ligne en vigueur
   AUJOURD'HUI, exactement comme la fiche d'intervention. « Aujourd'hui » se
   lit dans le fuseau de la SOCIÉTÉ, via `instantDuJour(jourDe(maintenant(fuseau).local))`
   plutôt qu'un `new Date()` nu ou un `.instant` nu — deux gardiens du dépôt
   (L0-08, DATES-1) l'exigeaient, et les deux ont rougi avant d'être corrigés
   (voir §5).
6. **Le formulaire ne se voit jamais resaisir la confirmation.** L'écran de
   confirmation ne porte que des champs CACHÉS reconduisant tels quels le
   montant et la date déjà validés par la route ; la revalidation, à
   l'affichage, se fait par le MÊME schéma Zod que la route
   (`schemaSuccessionTaux`), pour qu'une URL de confirmation forgée à la main
   ne fasse pas dire à l'écran un montant qu'il n'a jamais validé.

## 4. Ce que je n'ai PAS fait

- **Aucune modification de `poserTauxInitial`, du flux d'amorçage ou du
  script `taux-initial.mts`** — territoire interdit, et de toute façon inutile
  au lot.
- **Aucune nouvelle capacité, aucun nouveau rôle.**
- **Je n'ai pas corrigé le défaut `societe.findFirst()` sans `where` dans
  `app/(back-office)/parametres/forfaits/page.tsx` et
  `app/api/parametres/forfaits/devise.ts`**, alors que je l'ai mesuré (§2) et
  que le même défaut y vit probablement. Ce n'est pas dans le territoire du
  lot (`lib/tarification/**`, une route neuve, un écran neuf), et le corriger
  aurait touché un chemin déjà en production sans épreuve dédiée pour le
  couvrir. Voir §6.
- **Aucune restriction sur la date d'effet d'une succession** au-delà de
  l'unicité que la base porte déjà (`@@unique([societe_id, date_effet])`) :
  rien dans le chapitre 10 ni dans `docs/arbitrages.md` n'exige qu'une
  succession soit postérieure à la dernière ligne existante, et je n'ai pas
  inventé cette règle.
- **Je n'ai pas ajouté de décompte sur la nouvelle porte de
  `/parametres/taux-horaire`** (« combien de taux », etc.) — la convention
  déjà écrite pour les neuf autres portes de cette liste (« une porte dit où
  elle mène, pas ce qu'il y a derrière », D88).

## 5. Les pièges pour la session suivante

- **`societe` est une table de forme IDENTITÉ, pas « société »** : sa
  politique RLS (`societe_mes_societes`) filtre par `app.utilisateur_id`, donc
  par TOUTES les sociétés dont l'utilisateur courant est habilité — jamais par
  la seule société active du contexte. Un `tx.societe.findFirst()` sans
  `where: { id }` peut rendre la MAUVAISE société dès qu'un compte est
  habilité sur plusieurs. Ça ne se voit pas en local avec un compte à une
  seule société ; ça a rougi dans l'épreuve d'isolation, sur un compte
  d'épreuve habilité sur deux. `poserTauxInitial` le faisait déjà bien
  (`findUnique({ where: { id } })`) ; `forfaits/page.tsx` et
  `app/api/parametres/forfaits/devise.ts` ne le font PAS — à vérifier si un
  compte multi-sociétés y passe un jour.
- **Deux gardiens de date ont mordu, dans cet ordre, sur le même écran** :
  d'abord « aucune lecture de l'heure système sans fuseau » (interdiction de
  `new Date()` nu), puis, une fois corrigé par `maintenant(fuseau).instant`,
  « aucun instant NU comparé à une date civile » (DATES-1, qui interdit
  `.instant` même issu de `maintenant()` quand il finit comparé à une colonne
  `@db.Date`). La forme qui passe les deux est
  `instantDuJour(jourDe(maintenant(fuseau).local))`. Si un futur écran compare
  « aujourd'hui » à une colonne `@db.Date`, chercher cette forme d'abord — les
  deux gardiens coûtent chacun un aller-retour de test complet (~30 s) à
  découvrir en aveugle.
- **`getByLabel`/`getByRole(..., {name})` sur un texte encore absent du
  dictionnaire typé fait ÉCHOUER le gardien des chaînes visibles en dur**
  (L0-11, `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`), même à
  travers un wrapper local comme `(fr as Record<string,string>)[cle]` : le
  gardien ne reconnaît que les accès DIRECTS à `fr`/`t` importés de
  `lib/i18n`, pas un helper qui les enveloppe. Pour un spec e2e qui doit
  compiler sur le code AVANT le lot (donc sans les clés neuves) et interagir
  avec l'écran, repérer les champs et boutons par leur ATTRIBUT
  (`input[name=…]`, `[data-bloc=…]`, `form[action=…]`) plutôt que par leur
  texte affiché — `libelle()` ne doit servir qu'à des ASSERTIONS de contenu
  (`toContain`), jamais à une requête d'écran.
- **La confirmation et le formulaire de saisie partagent la même `action`
  de route** (`/api/parametres/taux-horaire/creer`) : un sélecteur
  `form[action="…"]` seul devient ambigu si les deux états sont visibles en
  même temps sur une même page (ce n'est pas le cas ici, l'un exclut l'autre),
  mais un futur écran qui les afficherait tous deux devra les distinguer
  autrement.

## 6. Ce qui reste à faire

- **Vérifier `app/(back-office)/parametres/forfaits/page.tsx` et
  `app/api/parametres/forfaits/devise.ts`** : les deux lisent `societe` par
  `findFirst()` sans `where: { id }`, exactement le défaut corrigé dans ce lot
  pour `succederTaux`. Non vérifié en pratique — pas rejoué, faute de
  territoire — mais mesuré comme un risque réel pour tout compte habilité sur
  plusieurs sociétés : un tel compte pourrait voir le catalogue de forfaits
  ou la devise d'une AUTRE société que celle qu'il croit active.
- **Aucun écran ne relie un taux horaire à une agence ou à une devise
  alternative** : la table reste à une seule devise par société (celle de la
  société), ce qui est la règle actuelle et n'appelle rien de plus.
- **La question de savoir si une succession doit être postérieure à la
  dernière ligne existante** n'est pas tranchée (voir §4) : à poser à
  l'exploitation si le besoin se présente.
