# 9K06-PORTAIL-COMPTE-TELEPHONE — passation

## Ce qui était mesuré au départ (I5)

- La pastille « Mon compte » (`components/navigation/barre.tsx`) menait TOUT rôle
  connecté, portail compris, vers `app/(back-office)/mon-compte/page.tsx`.
- Cette route construit son `contexte` directement depuis `session.contexte`, où
  `clientId` vaut **toujours** `null` à la lecture de session (`lib/auth/session.ts`,
  D70 — « une session de rôle `client` est REFUSÉE par `motifRefusContexte`, faute de
  désignation. C'est voulu et c'est bruyant »).
- `avecContexteApplicatif` appelle `exigerContexteActif` en premier, qui **lève** pour
  un rôle du portail sans client désigné — avant même d'atteindre la politique RLS.
- **Mesuré en lisant la chaîne d'appel, pas supposé** : `session.contexte.clientId`
  (toujours `null`) → `avecContexteApplicatif` → `exigerContexteActif` → lève. Le
  correctif et l'épreuve (`tests/e2e/9k06-portail-compte-telephone.spec.ts`) ont été
  écrits ensemble ; l'épreuve n'a donc pas été rejouée contre le code d'avant (elle
  prouve le comportement APRÈS : la pastille mène à un écran qui rend, et un rôle du
  portail qui visite `/mon-compte` en est redirigé plutôt que d'y lever).
- La route `/api/session/mon-compte/mot-de-passe` elle, ne juge aucun rôle
  (`exigerSessionActive`, pas `exigerContexteActif`) — elle aurait réussi pour un
  compte portail, mais sa redirection de succès était câblée en dur vers
  `/mon-compte`, qui aurait ensuite levé de la même façon.

## Ce qui a été fait

1. **`app/(portail)/portail/mon-compte/page.tsx`** (neuf) — le pendant portail : désigne
   le client comme le fait `/portail` (rattachement du compte, D70), puis affiche nom,
   courriel, raison sociale et adresse du client (lecture seule), le changement de mot
   de passe (réutilise `/api/session/mon-compte/mot-de-passe`, inchangée dans sa
   logique) et la déconnexion. Ne lit JAMAIS les habilitations ni le second facteur —
   deux notions de bureau qu'un compte portail ne porte pas.
2. **`lib/portail/depot.ts`** : nouvelle fonction `ficheDuCompte` (raison sociale +
   adresse de facturation du client, sous contexte — même politique « parc » que
   `parcDuClient`, aucune politique neuve).
3. **`app/(portail)/portail/presentation.ts`** : `adresseDuCompte`, qui met en une ligne
   le JSON `{rue, commune}` de `client.adresse_facturation` — même convention que
   `formatAdresseSite` (`lib/interventions/bon.ts`), adaptée parce que `client` ne porte
   pas de colonne `commune` séparée comme `site`.
4. **`app/(back-office)/mon-compte/page.tsx`** : redirige vers `/portail/mon-compte` si
   le rôle est du portail, au lieu de laisser lever `avecContexteApplicatif` — le
   correctif à la source du constat.
5. **`app/api/session/mon-compte/mot-de-passe/route.ts`** : la redirection suit
   désormais le rôle (`estRolePortail(contexte.role)`), jamais une valeur reçue de la
   requête (pas d'open-redirect) — calculée côté serveur depuis le contexte déjà lu.
6. **`components/navigation/barre.tsx`** : la pastille choisit son `href` selon le rôle
   (`CHEMINS_MON_COMPTE.bureau`/`.portail`) — écrit en clé d'objet, pas en ternaire nu,
   pour que `scripts/lib/atteignabilite-ecrans.ts` (`cheminsDesignes`) voie les deux
   chemins (son gardien, `tests/unit/navigation/atteignabilite-ecrans.test.ts`, a
   d'abord rougi sur le ternaire). `app/(portail)/layout.tsx` passe maintenant `role` à
   `BarreDeNavigation` (vérifié : aucune des cinq entrées de `ENTREES_PORTAIL` n'est
   listée dans `CAPACITE_REQUISE`, donc aucune n'est masquée par ce changement).

## Ce qui a été fait (I7 — 16 px et 44 px sous 640 px)

- **`components/portail/gabarit.tsx`** (neuf) — gabarit PARTAGÉ : `CLASSE_CHAMP_PORTAIL`
  (`text-base sm:text-[13px]`), `CLASSE_BOUTON_PORTAIL` et `CLASSE_DEPLIANT_PORTAIL`
  (`min-h-11`), le composant `ChampPortail`, et `LienTelephone` (numéro affiché →
  `<a href="tel:…">`).
- Appliqué à `app/(portail)/portail/contacts/vue.tsx` (le `Champ` local dupliqué est
  retiré, `type="tel"` sur téléphone/mobile, les deux numéros affichés passent par
  `LienTelephone`) et `app/(portail)/portail/demandes/vue.tsx` (selects, textarea,
  bouton, dépliant).
- `app/(portail)/portail/machines/[id]/page.tsx` : le bouton « Signaler une panne »
  reprend aussi `CLASSE_BOUTON_PORTAIL`, par cohérence (même famille de bouton que les
  deux écrans ci-dessus).
- **Deux composants PARTAGÉS avec le bureau** (`components/session/formulaire.tsx`,
  `components/session/champs-nouveau-mot-de-passe.tsx`) reçoivent la même responsive
  `text-base … sm:text-sm` : la page `/portail/mon-compte` neuve en dépend pour son
  formulaire de mot de passe, et la correction ne change rien pour le bureau au-delà de
  640 px.
- **`components/ui/carte-pas-recopiee.test.ts`** : `components/portail/gabarit.tsx`
  recrée le motif des quatre jetons de `Carte` (pour le `<summary>` d'un `<details>`,
  catégorie déjà nommée dans ce gardien) — ajouté à `EXCEPTIONS`, raison écrite.

## Ce qui a été fait (I8 — la fiche intervention étiquetée)

- `app/(portail)/portail/interventions/[id]/page.tsx` : les quatre valeurs non
  étiquetées (statut, nature, date, numéro — pas cinq : le site l'était déjà, via
  `siteDeLIntervention`, qui compose son propre « Site : … ») passent par un `<dl>` de
  `LigneFiche` (même patron que `LigneIdentite` de `/mon-compte`).
- Intervention `terminee` (pas encore `cloturee`) : affiche désormais le texte déjà
  écrit pour le refus de `/bon` (`portail.interventions.bon.refus_non_cloturee`,
  « Le bon sera disponible une fois l'intervention clôturée ») — réutilisé, pas
  dupliqué.
- Intervention `cloturee` : « Télécharger le bon » devient un `<Link>` stylé en bouton
  (`CLASSE_BOUTON_PORTAIL`), toujours un lien (`role="link"` inchangé —
  `captures-9j08a-portail-bon.spec.ts` continue de le trouver par ce rôle).

## Ce qui N'A PAS été fait, et pourquoi (contradiction signalée, §0 du noyau)

Le ticket demande, dans la même phrase que le repli « pas de page faisable » :
« « Mot de passe oublié » pour un client : « Contactez votre agence » (texte seulement) ».
**`app/(sans-session)/mot-de-passe-oublie/page.tsx` est un composant SYNCHRONE, sans
aucune lecture de session — par décision explicite (D162/D188, « aucun formulaire,
aucune route publique de réinitialisation »).** Cette page est atteinte AVANT toute
authentification : il n'existe aucun moyen d'y savoir si la personne qui regarde
l'écran est un client ou un compte interne sans y ajouter une lecture d'identifiant
(courriel) que la décision du 28/09 exclut justement. Le texte actuel,
« Demandez un nouveau lien d'accès à votre administrateur. », est déjà générique à
tout rôle — et reste exact pour un client : son compte EST administré par un
administrateur interne (`lib/auth/lien-d-acces.ts`, hors territoire de ce ticket).
Rendre ce texte spécifique au portail demanderait de rouvrir une décision de rang 1
que ce ticket n'autorise pas à toucher (« ne touche ni l'invitation »). **Je n'ai donc
rien changé sur cette page** — à trancher explicitement si un texte distinct reste
voulu, avec le mécanisme qui permettrait de distinguer le rôle avant connexion.

## Épreuves

- **`tests/e2e/9k06-portail-compte-telephone.spec.ts`** (neuf, 8 scénarios) : I5 (la
  pastille mène à un écran utilisable ; un rôle du portail ne retombe jamais sur
  `/mon-compte` ; le changement de mot de passe refusé revient sur
  `/portail/mon-compte`) ; I7 (16 px sur les champs de `/portail/contacts` et
  `/portail/demandes` à 375 px, `type="tel"`, lien `tel:` rendu, 44 px sur les
  dépliants et boutons) ; I8 (une intervention `terminee` dit l'attente, sans bouton
  bon ; une `cloturee` propose le bon en bouton ≥ 44 px). 8/8 verts.
- **`tests/e2e/captures-9k06-portail-compte-telephone.spec.ts`** (neuf) : captures
  APRÈS, 375/1280 px, des trois écrans — `docs/propositions/9K06-PORTAIL-COMPTE-
  TELEPHONE/captures/`. **APRÈS SEULEMENT** (même constat que
  `captures-9j22-portail-bon-technicien-temps.spec.ts`) : un AVANT fidèle pour le
  formulaire de demande et la fiche intervention exigerait une seconde compilation de
  production, hors du budget de 120 minutes — la recette pour le rejouer est écrite en
  tête du fichier. Rien n'est capturable avant ce ticket pour « Mon compte » du
  portail, qui n'existait pas (même motif que 9J08A pour `/bon`).
- **Non-régression** : `tests/e2e/9i9-mon-compte.spec.ts` (2/2, le chemin bureau
  inchangé), `tests/e2e/tous-les-ecrans-rendent.spec.ts` (60/60, 3 skip attendus),
  `tests/e2e/captures-9j08a-portail-bon.spec.ts`, `9k02-portail-menu-accueil.spec.ts`,
  `9k03-portail-machines-panne.spec.ts` (24/24) — le lien du bon reste trouvé par son
  rôle `link` malgré le changement de style.
- `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (5559/5559),
  `pnpm test:isolation` (1971/1971) : tous verts avant chaque commit.

## Ce qui N'A PAS été touché (interdits du ticket)

Aucune migration, aucune politique RLS, aucune capacité neuve, aucun montant, aucun
courriel, aucune donnée de production, aucune dépendance nouvelle. `lib/auth/
lien-d-acces.ts`, `depot/`, `11-FILE.sh`, `CLAUDE.md` non touchés.

## État au moment de rendre la main

- Branche dédiée `9K06-PORTAIL-COMPTE-TELEPHONE`, partant d'`origin/main` (`main` est
  extrait ailleurs, `/home/aplou/codiplan`).
- Trois commits, un par point livré, tous verts avant chacun.
- Reste à faire avant de rendre la main : `git fetch origin` + `git rebase origin/main`,
  `CI=1 pnpm verify`, vérifier l'arbre propre. `verify:full` est laissé à la file (non
  joué ici, conformément à la consigne).

## Reprise 9K06A-REPRISE-9K06

Premier passage de `verify:full` sur 9K06 (`9K06-PORTAIL-COMPTE-TELEPHONE-verify-1.txt`) :
1 seul échec, `tests/e2e/captures-9j08b-portail-temps-par-etat.spec.ts:277` — même classe
que 9K02A.

- **Constat** : le `<dl>` de la fiche intervention posé par ce ticket (point I8 ci-dessus)
  étiquette la date avec le texte fixe `"Date planifiée"` (`intervention.date`,
  `lib/i18n/fr.ts`). L'épreuve 9J08B, elle, cherchait `fr["statut.planifiee"]`
  (`"Planifiée"`) sans `exact: true` sur la même page — `getByText('Planifiée')` résout
  désormais le `<dt>Date planifiée</dt>` **et** le `<span>Planifiée</span>` du temps par
  état (« strict mode violation »).
- **Correctif** : `exact: true` posé sur cette seule recherche
  (`tests/e2e/captures-9j08b-portail-temps-par-etat.spec.ts:277`) — pas un assouplissement
  (règle du ticket) : la recherche vise toujours le même texte, juste sans correspondance
  partielle.
- **Recherche élargie** (consigne du ticket) : passage de `tests/e2e/**` pour toute
  recherche par texte NON exacte d'un mot que les nouvelles étiquettes de 9K06 contiennent
  (« Planifiée », « Statut », « Nature », « Numéro », « Date ») sur un écran du portail.
  Aucune autre occurrence trouvée : `9k06-portail-compte-telephone.spec.ts` et
  `captures-9k06-portail-compte-telephone.spec.ts` posaient déjà `exact: true` sur
  `intervention.statut`/`.type`/`.date`/`.numero` (écrits avec le ticket). Les autres
  occurrences de `getByText` non exactes sur des écrans du portail (`demande.statut.*`
  sur `/portail/demandes`, `portail.machine.serie` sur la fiche machine) visent des
  textes qui ne partagent aucune sous-chaîne avec les quatre étiquettes neuves et n'ont
  pas échoué.
- **Rejoué, `CI=1 --workers=1`** : `captures-9j08b-portail-temps-par-etat.spec.ts` (4/4),
  les 14 fichiers `*portail*.spec.ts` (83/83), `tous-les-ecrans-rendent.spec.ts`
  (60/60, 3 skip attendus) ; puis `CI=1 pnpm verify` (format/typecheck/lint/test/
  test:isolation/build), vert.
- Aucun code d'application modifié — seule l'épreuve était fausse, la fiche intervention
  est correcte.
- Branche `9K06A-REPRISE-9K06`, créée depuis `9K06-PORTAIL-COMPTE-TELEPHONE-garde`
  (identique à `origin/main` + les 4 commits de 9K06, aucune divergence à reporter par
  cherry-pick). Un commit. `verify:full` laissé à la file.
