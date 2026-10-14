# 9EWB3-CONNEXION-MAQUETTE — passation

Les cinq écrans d'accès (`/connexion`, `/connexion/code`, `/mot-de-passe-oublie`,
`/premier-acces`) reprennent le gabarit scindé de la maquette : panneau sombre bord à
bord à partir de 1024 px, logo unique qui bascule de place au lieu de se dupliquer. Pas de
bloc société (`aSoc()`), pas de puce « Données fictives » — conformément aux décisions
n° 102 et 103 d'Alexis du 14/10, écrites ici en une ligne comme demandé.

## Point 1 — écran scindé plein écran

`app/(sans-session)/layout.tsx` ne change que par `relative`, posé sur le `<div>` que
`LargeurUtile` habille. C'est l'ancrage dont `CadreAcces` (`components/session/
cadre-acces.tsx`) a besoin pour s'étendre en `absolute inset-0` — bord à bord, sans toucher
`LargeurUtile` ni les trois autres écrans du segment (`/`, `/sante`, `/enrolement`, hors
territoire). Pas de restructuration de routes : le risque d'une telle restructuration
(un test — `tests/unit/app/barre-par-segment.test.ts` — nomme littéralement `(sans-session)
/connexion/page.tsx`) aurait été plus coûteux que le gain.

`CadreAcces` se reconstruit en grille CSS (`grid-rows-[auto_1fr]`, deux colonnes à partir
de 1024 px) : le panneau sombre et le formulaire occupent chacun toute la hauteur
disponible. `MarqueAcces` (nouveau, `components/navigation/marque.tsx`) est un item de
grille À PART, jamais niché dans le panneau : un seul `<a href="/">`, dont les classes
Tailwind basculent à 1024 px (fond, couleurs de texte, padding) plutôt que d'en rendre un
second — exigence de `marque-connexion.spec.ts` (un seul lien). Les quatre pages ont perdu
leur `<MarqueClaire accueil="/" />` autonome : `CadreAcces` la porte désormais.

Mesuré par les deux épreuves neuves (`tests/e2e/9ewb3-connexion-maquette.spec.ts`) : à
1280 px le panneau fait 640 px ± 2 px (50 % exact de 1280) et sa couleur de fond est
identique à celle de la marque (même nœud visuel) ; à 375 px, `scrollWidth` du document ne
dépasse jamais 375 px et la marque reste visible malgré la disparition du panneau.

## Point 2 — formulaire de connexion et mot de passe oublié

`app/(sans-session)/connexion/page.tsx` : `libelleChampObligatoire` (déjà utilisé ailleurs
pour le même suffixe, `lib/i18n/obligatoire.ts`) sur l'adresse et le mot de passe
(`ChampMotDePasse` reçoit maintenant un libellé déjà suffixé) ; champs à `h-10` (40 px) ;
bouton `size="lg"` pleine largeur (`className="w-full"`) ; « Afficher »/« Masquer »
(`components/session/champ-mot-de-passe.tsx`) et « Mot de passe oublié ? » en
`text-app-marque font-bold underline` — le jeton de lien bleu gras déjà en usage ailleurs
dans le dépôt (`parametres/equipe/page.tsx:1220`), jamais une couleur inventée.

`app/(sans-session)/mot-de-passe-oublie/page.tsx` : même style de titre/texte, et le
retour « Retour à la connexion » porte désormais l'icône `chev-l` au lieu du caractère
« ← » dans le texte — voir point 3 pour la même décision côté `/connexion/code`.

## Point 3 — code à deux facteurs

Cases de `components/session/champ-code.tsx` portées à 48×56 (`h-14 w-12`), 44×52 sous
900 px (`max-[899px]:h-[52px] max-[899px]:w-[44px]`, les seules valeurs arbitraires — ce
sont des dimensions, pas des tailles de texte, donc hors de l'échelle typographique figée).
Police à `text-24` : la maquette demande 22 px, hors de l'échelle `D138/D143`
(12/13/14/15/16/18/24/28) — 24 est la valeur la plus proche, même règle déjà appliquée
ailleurs au dépôt pour les tailles « rondes » de la maquette.

« Retour à la connexion » reste EXACTEMENT le `<button type="submit">` de déconnexion
(piège K3 documenté dans le fichier : un `<a href="/connexion">` boucle sur une
demi-session) — seul son style change (lien bleu gras + icône `chev-l`), et le caractère
« ← » quitte le texte du dictionnaire puisque l'icône porte désormais le sens visuel
(`aria-hidden`, le texte reste le seul nom accessible).

Le pli de secours (`<details>`) est maintenant dans un encadré : `border-app-bord`,
`rounded-md` (12 px, exactement `--radius-md`), `px-3.5 py-2.5` (14/10 px, la paire
Tailwind qui tombe pile sur les valeurs de la maquette).

## Points 4 et 5 — premier accès (« Bienvenue ») et lien plus valide

`app/(sans-session)/premier-acces/page.tsx` entièrement reconstruit : écran scindé,
« Bienvenue » sans prénom ni e-mail (rien n'est lu du jeton au GET — c'était déjà vrai
avant ce lot, et ça le reste), aide reprise mot pour mot de la maquette, deux règles de
saisie affichées EN INDICATION (coche verte statique, `text-app-vert-plein` — la
validation serveur ne change pas, hors territoire), conseil d'ajout à l'écran d'accueil,
bouton « Enregistrer mon mot de passe ». Les libellés `premier_acces.mot_de_passe`
(« Nouveau mot de passe ») et `premier_acces.confirmation` restent inchangés — seul le
suffixe « (obligatoire) » s'y ajoute — parce que plusieurs épreuves de bout en bout les
cherchent par sous-chaîne (`acces-bureau.spec.ts`, `acces-technicien.spec.ts`,
`captures-9dja-acces-technicien.spec.ts`) : une recherche par sous-chaîne (le comportement
par défaut de `getByLabel` côté Playwright) continue de les trouver dans le libellé
suffixé.

Un jeton absent ou vide rend désormais UN SEUL écran « Ce lien n'est plus valide », quel
que soit `motif` — avant ce lot, la page ignorait déjà `motif` dans ce cas précis mais
affichait le texte `premier_acces.sans_jeton` (« incomplet… », orienté vers un lien
tronqué) ; elle affiche maintenant `premier_acces.lien_invalide.*`, le texte de la
maquette, qui couvre aussi bien un jeton expiré, déjà servi ou inconnu — les distinguer
apprendrait à un tiers l'état d'un compte (D35, D50). `premier_acces.sans_jeton` et
`premier_acces.refuse` restent au dictionnaire (une épreuve, `tests/unit/auth/
premier-acces.test.ts`, vérifie seulement que les CLÉS existent, jamais leur texte ni leur
usage à l'écran) : ils n'ont simplement plus de lecteur dans cette page.

`metadata.title` de la page (`premier_acces.titre`) est maintenant « Premier accès »
(le titre d'onglet) plutôt que l'ancien texte d'accroche — décision de séparation entre le
titre d'onglet et le H1 affiché (« Bienvenue »), qui n'ont plus besoin d'être le même
texte maintenant que l'écran distingue les deux contrairement à l'ancien `Formulaire`.

## Point 6 — textes et épreuves

Toutes les nouvelles clés sont dans `lib/i18n/fr.ts`, textes de la maquette mot pour mot
(`premier_acces.bienvenue`, `.regle_longueur`, `.regle_confirmation`,
`.conseil_telephone`, `.lien_invalide.*`).

`tests/e2e/9ewb3-connexion-maquette.spec.ts` : quatre épreuves légères (sans compte, sans
jeton) couvrant le panneau à 50 %, l'absence de débordement à 375 px, le suffixe
« (obligatoire) », et le double déclenchement de l'écran « lien plus valide » (sans jeton,
puis avec `?motif=premier_acces.refuse`) ; une cinquième, plus lourde (même patron que
`captures-9dja-acces-technicien.spec.ts` : un technicien créé par l'épreuve, son lien de
premier accès intercepté via `FICHIER_COURRIELS_CAPTURES`), qui prend les captures 375/1280
EN VIEWPORT (`fullPage: false`) de connexion, mot-de-passe-oublié, premier-accès et
premier-accès-lien-invalide — gardées sous `docs/propositions/9EWB3-CONNEXION-MAQUETTE/
captures/`, écrites seulement quand `CAPTURES_9EWB3` est posée (même interrupteur que
`CAPTURES_9DJA`), donc jamais en `pnpm verify`/`verify:full` ordinaire.

### Points ouverts

- **`/connexion/code` n'est pas capturé.** Ce cinquième écran exige un compte
  `direction`/`admin` DÉJÀ passé par l'enrôlement du second facteur (OTP réel,
  `@better-auth/utils/otp`) avant de pouvoir s'y présenter — le patron existe
  (`tests/e2e/9edz-connexion-code.spec.ts`), mais le reprendre pour UNE capture
  supplémentaire dépassait le budget de ce lot au-delà des quatre autres écrans. Les
  classes de `champ-code.tsx` (point 3) restent vérifiées par les épreuves existantes
  (`9edz-connexion-code.spec.ts`, `9edz-champ-code.test.tsx`), seulement pas par une
  capture.
- **Une maladresse de `git add -p`** a fait atterrir TOUTES les clés `lib/i18n/fr.ts`
  neuves (points 3, 4 et 5) dans le commit du point 2 — rien n'est perdu, seule la
  coupure entre commits est imparfaite. Noté dans les messages de commit concernés.

## Vérification finale

`pnpm verify` (format, typecheck, lint, test, test:isolation, build) et une passe ciblée de
`pnpm exec playwright test` sur les épreuves voisines nommées par le ticket
(`*connexion*`, `marque-*`, `barre-*`, `acces-*`, `premier-acces*`, `formulaire*`,
`champ-code*`, `plancher-typographique*`, `sans-chaine-visible-en-dur*`) — trois échecs
rencontrés lors d'un passage groupé (`enrolement-secrets-hors-url.spec.ts`,
`habilitations.spec.ts`, `saisie-gardee-tpa4b.spec.ts`) se sont révélés être de
l'interférence entre spécifications lancées en parallèle par un `--grep` trop large
(état partagé de la base), confirmé en les rejouant seuls : les trois passent.
