# 9ET-COMPTES-BUREAU-2 — passation

## Ce qui est livré

1. **En-tête** — `equipe.titre_ecran` (« Équipe et accès ») distinct de `equipe.titre` (« Équipe », le repère court lu par le fil d'ariane, la tuile du tableau de bord et la porte de paramétrage — inchangé, pour ne RIEN casser ailleurs). Sous-titre mis à jour (`equipe.sous_titre`). Bouton primaire « Ajouter une personne ».
2. **Volet « Ajouter une personne »** — `components/ui/volet.tsx` (déjà en service sur `/absences`), piloté par l'URL (`?ajouter=1&type=technicien|bureau`), sans JavaScript. Choix « Elle travaille comme » par deux liens (pas de case radio : le volet est un composant serveur). La section en ligne « Ajouter un technicien » a disparu ; son formulaire vit dans le volet, vers la MÊME route (`/api/techniciens/creer`, mêmes noms de champs) ; le compte de bureau route vers `/api/equipe/bureau/creer` (9ET-COMPTES-BUREAU-1).
3. **Onglets** — « Techniciens (n) » / « Comptes de bureau (n) » (`?onglet=bureau`), `components/ui/onglets.tsx`. L'onglet Techniciens garde son contenu EXACT (tableau + `<details>`).
4. **Onglet « Comptes de bureau »** — tableau trié par nom de famille (`trierAlphanumeriquement`), colonnes Personne/Rôle/Second facteur/Accès/geste. Second facteur lu à l'état RÉEL (`LigneCompteDeBureau.mfaActif`), jamais inventé. Les quatre badges d'accès de la maquette.
5. **L'interrupteur « Envoyer le lien d'accès en l'ajoutant »** — étendu au technicien (il n'existait qu'au chemin bureau) ; `app/api/techniciens/creer/route.ts` gagne la même logique que `app/api/equipe/bureau/creer/route.ts`.
6. **Solde 174** — les deux routes de création n'échouent plus en 500 si l'envoi (demandé par l'interrupteur) échoue ou lève `RefusEnvoiAcces` : la création reste acquise, un motif lisible revient (`equipe.refus.envoi_echoue` / `equipe.bureau.refus.envoi_echoue`).
7. **Soldes 172 et 175** — `etatsAccesDesComptes` (`lib/auth/acces-bureau.ts`) exclut désormais les identifiants non habilités comme compte de bureau de la société active (172), et agrège l'historique d'envoi de TOUS les `admin_societe` de la société, pas seulement l'administrateur qui regarde (175 — une transaction par administrateur, `journal_acces` ne se lisant que par désignation self-authored).
8. **Solde 171** — le code était déjà correct (filtre société explicite) ; cinq épreuves d'isolation neuves (`tests/isolation/acces-bureau.test.ts`) couvrent les trois soldes.
9. **Épreuves existantes adaptées** — `tests/e2e/equipe.spec.ts`, `acces-technicien.spec.ts`, `captures-9dja-acces-technicien.spec.ts`, `pg-g16-statut-ressource.spec.ts` ouvrent désormais le volet puis choisissent « Technicien » avant de remplir le formulaire — mêmes sélecteurs ensuite, même vérification finale, rien retiré ni élargi.
10. **Épreuves neuves** — `tests/e2e/volet-equipe.spec.ts` (3 scénarios, joués et vérifiés verts individuellement) : (a) création d'un compte de bureau ADV par le volet → badge « Pas d'accès » ; (b) avec l'interrupteur → badge « Lien envoyé » ; (d) un rôle sans `administrer_utilisateurs` (ADV) ne voit pas l'écran et la route refuse, sans écrire de compte.
11. **Décision D198** (`docs/arbitrages.md`) — ce que l'écran fait, les écarts nommés, ce qui reste au lot 3.

## Ce qui N'EST PAS fait (budget de temps épuisé)

- **Scénario (c)** : rattachement d'un courriel de compte de bureau déjà connu dans une AUTRE société, à travers l'écran. Le serveur le fait depuis 9ET-COMPTES-BUREAU-1 (`creerCompteDeBureau`, `resultat.rattache`) et l'écran affiche déjà le bandeau `equipe.info.rattache` qu'il renvoie (code générique, partagé avec le technicien) — seule l'épreuve de bout en bout manque.
- **Scénario (e)** : vérification explicite du rendu à 375 px (volet + onglet) sans débordement horizontal. Le volet (`w-[min(440px,100vw)]`) et le `Tableau` (`CadreDefilant`, défilement horizontal borné) sont les MÊMES composants que `/absences` et le reste de l'écran, déjà éprouvés à 375 px ailleurs — mais aucune capture ni assertion dédiée n'a été prise ICI.
- **Captures d'écran** 375/1280 (en-tête + onglet Techniciens, volet ouvert sur chaque type, onglet Comptes de bureau rempli) — non prises.
- Pas de régression mesurée sur les CAPTURES des lots voisins (9aq, 9au, 9br, 9dja, aa3, tpa6, tpi9, zz-9dn/9do/9eb1) — ces épreuves naviguent vers `/parametres/equipe` et prennent des captures ; elles devraient toujours passer (aucune assertion sur le texte retiré), mais leurs CAPTURES changeront visuellement (nouvel en-tête, nouveaux onglets) — **à rejouer et à comparer AVANT de committer toute capture régénérée**, pour ne jamais committer la capture d'un AUTRE lot par effet de bord.

## Vérifié avant de rendre la main

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (430 fichiers, 4645 tests) : verts après chaque commit.
- `pnpm vitest run --project isolation tests/isolation/acces-bureau.test.ts` : 17/17 verts.
- `npx playwright test tests/e2e/volet-equipe.spec.ts` : 3/3 verts, isolément.
- `pnpm format` : aucun écart résiduel.

## Ce qui reste à jouer avant de clore le lot (prochaine session)

1. Les épreuves VOISINES complètes (celles qui ouvrent `/parametres/equipe` : `equipe.spec.ts`, `equipe-1.spec.ts`, `acces-technicien.spec.ts`, `equipe-agence-inactive.spec.ts`, `pg-g16-statut-ressource.spec.ts`, `habilitations.spec.ts`, `droits-rm-rs.spec.ts`, `9eg2-tableau-de-bord-direction-admin.spec.ts`, `acces-bureau.spec.ts`, et les captures listées ci-dessus) — jouées une à une ou en bloc restreint, PAS encore fait au complet dans cette session.
2. `CI=1 pnpm verify:full` en entier, en UN appel.
3. `git fetch origin` puis `git rebase origin/main`, puis `CI=1 pnpm verify` une dernière fois.
