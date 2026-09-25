# 99E-EVITEMENT — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`components/mise-en-page/page.tsx` : le `<main>` que rend `Page` (le gabarit commun à vingt-huit des vingt-neuf écrans du back-office, la seule exception étant `app/(back-office)/interventions/[id]/bon/page.tsx`, une page d'impression sans chrome) porte désormais `id="contenu"` et `tabIndex={-1}` — une cible que le clavier peut atteindre par script, sans l'ajouter à l'ordre de tabulation naturel.

`app/(back-office)/layout.tsx` : un lien « Aller au contenu » (clé `navigation.aller_au_contenu`) est posé en tout premier enfant de la coque, avant la barre de navigation — masqué (`sr-only`) tant qu'il n'a pas le focus, visible dès qu'un clavier l'atteint (`focus:not-sr-only`). Il cible `#contenu`.

`components/ui/tableau.tsx` : `Tableau` accepte un prop optionnel `libelle`, posé en `aria-label` sur l'élément `<table>`. Aucun appelant existant n'est affecté tant qu'il ne le passe pas — le composant sert des dizaines d'écrans (paramètres, parc, imports…) que ce ticket ne touche pas.

`app/(back-office)/interventions/page.tsx` : le registre passe `libelle={t("interventions.titre")}` à `Tableau`.

`app/(back-office)/planning/page.tsx` : les deux grilles (vue semaine, vue jour — deux `<table>` distincts, jamais affichés ensemble) portent `aria-label={t("planning.titre")}`.

Pour l'exploitation : une personne qui navigue au clavier peut désormais sauter la colonne de navigation dès le premier `Tab`, sans la traverser lien par lien avant d'atteindre le tableau de bord, le planning ou toute autre page. Un lecteur d'écran annonce « Interventions » en entrant dans le tableau du registre et « Planning des interventions » en entrant dans la grille du planning, plutôt qu'un tableau anonyme.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **AVANT** : aucune occurrence de « Aller au contenu », `#contenu` ou équivalent dans `app/`, `components/`, `lib/i18n/fr.ts` (recherche texte, confirmée avant toute modification). Aucun des deux tableaux (`/interventions`, `/planning`) ne portait de `caption` ni de `aria-label` — vérifié en lisant `components/ui/tableau.tsx` et les deux `<table>` de `app/(back-office)/planning/page.tsx` avant modification.
- **APRÈS**, capturé par `tests/e2e/evitement.spec.ts` (trois scénarios, aucune scène forgée — les trois écrans se mesurent tels quels sur le compte de l'épreuve) :
  - sur `/tableau-de-bord`, premier `Tab` → le lien porte le focus (`toBeFocused`) et devient visible (`toBeVisible`) ; `Entrée` → `#contenu` porte le focus ;
  - sur `/interventions`, `getByRole('table', { name: fr["interventions.titre"] })` trouve le tableau ;
  - sur `/planning` (vue semaine par défaut, viewport 1280×900, au-dessus du seuil `lg` sous lequel la grille se masque), `getByRole('table', { name: fr["planning.titre"] })` trouve la grille.
- Capture `lien-evitement-focalise-1280.png` : le lien, focalisé, apparaît en haut à gauche de `/tableau-de-bord`, au-dessus de la colonne de navigation.
- **`pnpm test`** : 267 fichiers, 2869 tests, vert (aucun test retiré).
- **`pnpm format:check` / `pnpm typecheck` / `pnpm lint` / `pnpm build`** : verts.
- **`CI=1 pnpm verify:full`** : premier passage — 1 échec et 1 test « flaky » dans `tests/e2e/glisser-deposer.spec.ts`, sans rapport avec ce lot (voir « Le piège mesuré » ci-dessous) ; les trois scénarios de `tests/e2e/evitement.spec.ts` déjà verts à ce passage. Second passage complet : **292 passés, 3 sautés, 0 échec** — confirmé vert de bout en bout, e2e comprise.

## Ce que j'ai tranché et pourquoi

- **Une seule clé i18n pour les deux grilles du planning** (`planning.titre`, déjà existante — « Planning des interventions ») plutôt qu'une clé par vue (semaine/jour). Les deux `<table>` ne sont jamais dans le DOM en même temps (la vue courante seule est rendue), et les deux représentent la même notion pour une personne qui les nomme au clavier : distinguer « vue semaine » de « vue jour » dans le nom accessible aurait ajouté une clé sans ajouter d'information utile à ce stade.
- **`Tableau` reçoit un prop optionnel plutôt qu'un `aria-label` obligatoire.** Il sert des dizaines d'écrans que l'audit ne nomme pas ; l'imposer partout aurait exigé une clé i18n par écran, hors du territoire de ce ticket (« le composant de page commun et les tableaux de **deux** écrans »).
- **Le lien cible l'`id` posé par `Page`, jamais un `id` séparé par écran.** `Page` est le gabarit commun à vingt-huit écrans sur vingt-neuf (grep vérifié) ; poser l'`id` une fois, à sa source, évite qu'un écran neuf l'oublie — la même discipline que le surtitre de domaine du même fichier.
- **`tabIndex={-1}` sur `<main>`, pas de style de focus personnalisé.** Le focus visuel par défaut du navigateur suffit et respecte la consigne du ticket (« focus visible present (a garder) ») sans inventer un second jeton d'apparence.

## Ce que je n'ai PAS fait

- Je n'ai pas ajouté d'`aria-label` sur les autres tableaux du dépôt (paramètres, parc, imports, etc.) — hors territoire de ce ticket, qui ne nomme que le registre et le planning.
- Je n'ai pas touché `app/(back-office)/interventions/[id]/bon/page.tsx` (la page d'impression) : elle ne passe pas par `Page` et n'a pas de `<main>` — le lien d'évitement pointe vers un `id` qui n'existe pas sur cette seule page. C'est une page d'impression sans chrome de navigation (pas de barre à sauter) ; l'écart est mesuré, pas corrigé, faute de territoire.
- Je n'ai pas ajouté de `<caption>` visible : `aria-label` répond au même besoin (le nom accessible) sans ajouter de texte à l'écran, cohérent avec la densité de la maquette pour ces deux tableaux.
- Aucune capture à 375 px : le lien d'évitement et le nom accessible d'un tableau ne sont pas des propriétés qui varient avec la largeur d'écran.

## Les pièges pour la session suivante

- **`tests/e2e/glisser-deposer.spec.ts` est flaky, sans rapport avec ce lot** — déjà documenté par `99D-ABSENCES-1/passation.md`. Confirmé de nouveau ici : un run isolé de ce seul fichier (`--workers=1`) a fait échouer un test différent de celui du premier passage complet (« connexion interrompue » puis « erreur serveur » selon l'exécution), et un second passage complet de `verify:full` est repassé au vert sans aucune modification. Aucun fichier de ce lot n'est importé par le planning ni par le glisser-déposer.
- **`Tableau` porte maintenant un prop `libelle` optionnel** — un futur écran qui veut un nom accessible n'a qu'à le passer ; il n'a pas besoin d'une nouvelle clé si le titre de l'écran (`t("xxx.titre")`) convient déjà.
- **`Page` pose `id="contenu"` sur CHAQUE écran qui l'utilise** — un futur composant qui rendrait un second `<main>` sur le même écran créerait un `id` dupliqué. Aucun écran actuel ne le fait (vérifié).

## Ce qui reste à faire

Rien d'identifié dans le territoire de ce ticket. L'écart mesuré sur la page d'impression (`.../bon/page.tsx`, sans `<main id="contenu">`) reste ouvert si un audit futur l'exige explicitement.
