# 9L07-CONNEXION-TENTATIVES-LIMITEES — passation

Décision d'Alexis du 10/11/2026 : cinq échecs de mot de passe sur un même compte déclenchent un
refus temporisé de quinze minutes, de même forme qu'un refus ordinaire (D35 : un refus ne révèle
pas si le compte existe). `/api/session/connexion` n'avait qu'un plancher de durée commun à tous
les refus — aucune limite au nombre d'essais ; le limiteur intégré à la bibliothèque
d'authentification est tenu en mémoire du processus et ne protège rien sur un hébergement sans
état. Ce lot pose le vrai limiteur. Arbitrage : D260.

## MIGRATION À JOUER PAR ALEXIS

`20261115040000_limite_connexion_tentatives_9l07` — une seule, neuve, appliquée par
`pnpm db:deploy` (staging, puis la cible visée). Elle crée la table `tentative_connexion`, ses deux
index, ses trois politiques RLS (lecture, ajout, purge — aucune politique d'`UPDATE`, voir
ci-dessous), accorde `SELECT`/`INSERT`/`DELETE` à `codiplan_app` et retire explicitement `UPDATE`
(les privilèges par défaut de la base l'accordent à toute table neuve), et ajoute une valeur à
l'énumération `EvenementAcces` (`connexion_temporisee`). Aucune colonne `NOT NULL` n'est ajoutée à
une table existante : pas de défaut transitoire à prévoir.

## Ce qui a été fait

1. **`prisma/schema.prisma`** — le modèle `TentativeConnexion` (`tentative_connexion` : id,
   identifiant, adresse_ip, survenue_le) et la valeur d'énumération `connexion_temporisee`.
   `identifiant` porte le courriel **tel que saisi**, normalisé (`trim().toLowerCase()`), qu'il
   désigne ou non un compte réel — c'est ce qui rend le refus identique dans les deux cas (D35).
   Une ligne par échec, jamais un compteur réarmé : la fenêtre glissante de quinze minutes se
   calcule en comptant les lignes récentes, sans tâche planifiée de remise à zéro.
2. **`tentative_connexion` entre dans la TROISIÈME catégorie de I1** (D260) — sixième table de la
   liste close, au même titre que `session`, `compte`, `verification`, `second_facteur` et
   `journal_acces`. Sa forme est « désignation », et elle RÉUTILISE deux variables de session déjà
   posées ailleurs — `app.authentification_email` (désigne déjà `utilisateur` par le courriel
   saisi, L1-02c) et `app.adresse_ip` (déjà posée par `lib/db/rls.ts`, chapitre 11.2) — plutôt que d'en
   ouvrir deux de plus. `lib/auth/lecture-identite.ts` porte une entrée `tentativeConnexion` de
   plus dans `CLES_DESIGNATION`, couverte sans code neuf par le gardien qui dérive sa population
   de cette liste (`tests/unit/auth/formes-d-appel.test.ts`).
3. **`lib/auth/limiteur-connexion.ts` (créé)** — `SEUIL_ECHECS_CONNEXION = 5`,
   `FENETRE_ECHECS_CONNEXION_SECONDES = 900`, citant la décision ; `verrouille` (compte, puis
   adresse si connue, avec une horloge injectable) ; `enregistrerEchec` ; `reinitialiserEchecs` ;
   `extraireAdresseIp` (premier maillon de `x-forwarded-for`, extraction volontairement minimale —
   « si c'est simple »).
4. **`lib/auth/connexion.ts` (`tenterConnexion`)** — le verrou se vérifie **avant** tout appel à la
   bibliothèque d'authentification : verrouillé, le mot de passe n'est jamais vérifié et aucun
   échec de plus n'est posé, sans quoi la fenêtre glisserait sans fin et ne lèverait jamais. Un
   échec est posé sur chaque chemin de refus lié aux identifiants (statut hors 200, `APIError`,
   réponse inattendue) ; **jamais** sur l'exception non-`APIError` (base injoignable, TR-31) ni sur
   le refus « compte désactivé » (le mot de passe y est déjà confirmé correct — règle d'un autre
   ordre). Une connexion qui franchit l'étape du mot de passe — session ouverte ou second facteur
   requis — remet le compteur à zéro. Le second facteur garde ses propres règles (D62), inchangées.
5. **`app/api/session/connexion/route.ts`** — passe `extraireAdresseIp(requete.headers)` à
   `tenterConnexion`.
6. **Journal d'accès** — `connexion_temporisee`, journalisé **seulement** quand le courriel
   présenté correspond à un compte réel (`journal_acces.utilisateur_id` est `NOT NULL` ; aucune
   ligne à écrire pour un courriel qui ne désigne personne). Cette asymétrie ne fuite rien : la
   réponse HTTP est identique dans les deux cas, seul le journal — que l'appelant ne lit jamais —
   se tait ou parle.
7. **Guardiens mis à jour à leur source** (liste close de I1, catégorie 3) :
   `tests/unit/db/categories-i1.test.ts`, `docs/constitution/invariants.md` §3,
   `docs/cahier-des-charges.md` (chapitre 11.2), `lib/db/migrations-attendues.ts`,
   `scripts/lib/rls-declaree.ts` (`TABLES_RLS_FORCEE`), `scripts/lib/tables-comptees.ts`
   (`EXEMPTIONS_DECOMPTE`), `tests/isolation/portail-matrice.test.ts` (`CLASSIFICATION_LECTURE` —
   « fermee », même motif que les cinq tables voisines), `tests/unit/calendar/sans-date-courante-
   implicite.test.ts` (exemption nommée pour `maintenant()` dans le limiteur — un INSTANT comparé
   à `survenue_le`, jamais une date calendaire, et le défaut doit être injectable pour les
   scénarios).

## Épreuves

- **`tests/isolation/limiteur-connexion.test.ts`** (créé) : cinq échecs verrouillent, même avec le
  BON mot de passe ensuite ; un compte INCONNU se verrouille exactement de la même façon (D35) ; la
  fenêtre glisse — horloge injectée, aucune attente réelle, le verrou se lève passé quinze minutes
  exactement ; une connexion réussie remet le compteur à zéro ; le verrou par adresse joue même sur
  des comptes différents, et n'affecte pas un compte sans adresse commune ; le verrouillage est
  journalisé (« connexion_temporisee ») pour un compte réel ; JUMEAU — sans la politique de lecture,
  un dénombrement intégral de la table (sans aucune désignation posée) passerait, alors que sous la
  vraie politique il rend zéro ; aucune politique d'`UPDATE` — la table ne se corrige jamais.
- **`tests/unit/auth/connexion-indisponible.test.ts`** — adapté : ces trois scénarios (TR-31)
  fabriquaient déjà une instance Better Auth factice ; depuis D260, `tenterConnexion` consulte le
  limiteur avant tout appel à cette instance, et un client Prisma factice (décompte à zéro) a été
  ajouté pour que ces trois scénarios restent des tests UNITAIRES, sans base réelle — le
  verrouillage lui-même est éprouvé ailleurs, en isolation.
- `pnpm test`, `pnpm test:isolation`, `CI=1 pnpm verify` : tous verts. `tests/e2e/9edz-
  connexion.spec.ts`, `tests/e2e/9ewb3-connexion-maquette.spec.ts`, `tests/e2e/deconnexion.spec.ts`
  et `tests/e2e/tous-les-ecrans-rendent.spec.ts` rejoués entièrement : tous verts — en particulier
  « un mot de passe faux revient sur /connexion avec le refus, en ton refus », inchangé.

## Captures

**Aucune** — le texte affiché au refus ne change pas (même redirection, même motif
`auth.refus`) : la consigne du ticket (« capture du refus seulement si le texte affiché change »)
ne s'applique pas ici. Aucun écran n'a été créé ni modifié.

## Ce qui reste ouvert

- La table `tentative_connexion` ne porte aucune purge automatique des lignes devenues inutiles
  (passé la fenêtre de quinze minutes, une ligne ne sert plus à rien mais n'est retirée par
  aucune tâche). Question du chapitre 22 (lot 7), si elle se pose — écrite dans D260.
- Si une tentative devait un jour être comptée ou refusée PENDANT le verrouillage lui-même (par
  exemple pour prolonger la fenêtre à chaque nouvel essai), la condition de réouverture de D260
  s'applique : elle suppose aujourd'hui qu'aucune ligne n'est ajoutée tant que le verrou tient.

## Reprise 9L07A — le ticket était recalé pour un délai dépassé qui ne se mesure plus

Repris le 16/11/2026. Les artefacts cités par le ticket de reprise —
`tickets/recales/9L07-CONNEXION-TENTATIVES-LIMITEES.md`, `traces/9L07-CONNEXION-TENTATIVES-
LIMITEES-verify-1.txt` et `-verify-2.txt` — n'existent sur aucun des checkouts de cette machine
(`codiplan`, `codiplan-voie1`, `codiplan-voie2`, `codiplan-equipe`, `.codiplan-parallele`,
`.codiplan-staging`, `.codiplan-mesure-cluster`), ni dans l'historique d'aucune branche connue. Le
ticket portait néanmoins la cause mesurée en toutes lettres (fichier, ligne, délai) ; le travail a
continué sur cette seule base, et c'est signalé ici parce que le contrat « référence » annoncé n'a
pas pu être relu.

**1. Report.** Branche créée à jour d'`origin/main` (428570fe1, pointe désormais après 9L04JA).
Les quatre commits de `9L07-CONNEXION-TENTATIVES-LIMITEES-garde` (points 1, 2, 3, 5 — **le point 4
n'a jamais existé** : cohérent avec un lot recalé avant d'atteindre l'étape épreuves e2e/captures)
reportés par cherry-pick, sans modification de leur contenu. Deux collisions avec ce qui a été
publié depuis, résolues en GARDANT les deux côtés :
- `lib/db/migrations-attendues.ts` — le point 1 posait sa migration au même horodatage
  (`20261115030000`) que `20261115030000_prestations_par_famille_materiel_9l04j`, fusionné entre
  temps. Le répertoire de migration de 9L07 est renommé au prochain horodatage libre,
  `20261115040000_limite_connexion_tentatives_9l07` — répercuté dans `docs/arbitrages.md` et dans ce
  document.
- `docs/arbitrages.md` — le point 5 posait son arbitrage sous le numéro **D258**, déjà pris depuis
  par la décision sur la légende des photos (9L04E). Renuméroté **D260** (prochain libre sur
  `origin/main` au moment du rebase, après D259/9L04J) ; toutes les références internes à « D258 »
  dans ce document corrigées en conséquence. Le message du commit cherry-pické garde « D258 » dans
  son intitulé historique — seul le contenu, qui est de rang 1, compte.
- `pnpm prisma generate` rejoué après le cherry-pick : sans lui, le client Prisma ne porte pas le
  délégué `tentativeConnexion`, et cinq fichiers d'isolation SANS RAPPORT avec 9L07
  (`reponses-indiscernables`, `refus-silencieux`, `chaine-session`, `portail-matrice`,
  `limiteur-connexion`) échouaient par `TypeError: Cannot read properties of undefined (reading
  'count')` — pas une régression du lot, un oubli de régénération après la migration reportée.

**2. Mesure de la cause annoncée — elle ne se reproduit pas.** La cause écrite dans le ticket de
reprise : `tests/unit/navigation/atteignabilite-ecrans.test.ts:158` dépasserait 5000 ms, le fichier
à 7,8 s, par la faute de ce que 9L07 ajoute au graphe d'`ecransOrphelins`. Mesuré, `CI=1
--maxWorkers=1`, trois états distincts, chacun dans un `git worktree` isolé partageant
`node_modules` :
- `origin/main` (428570fe1, AVANT tout 9L07) : 3 passages, phase « tests » 1,34–1,36 s.
- **Le commit recalé lui-même** (`17948233a`, exactement l'état qui aurait échoué deux fois) : 3
  passages, phase « tests » 1,48–1,49 s.
- Cette branche de reprise (9L07 sur le `main` d'aujourd'hui) : 5 passages, phase « tests »
  1,46–1,49 s.

Écart main → 9L07 : environ 120 ms — proportionné au peu que 9L07 ajoute à scanner, à mille lieues
d'un passage à 7,8 s. Vérifié aussi que la population de `ECRANS` (les `page.tsx` de
`app/(back-office)/`) n'a aucune raison structurelle de gonfler : aucun de ces écrans n'importe
`lib/auth/connexion.ts`, `lib/auth/lecture-identite.ts` ni `lib/auth/limiteur-connexion.ts`, ni
directement ni par la fermeture suivie par `sourceAvecComposants` — seul `lib/techniciens/depot.ts`
(utilisé par deux écrans back-office) mène à `lib/auth/connexion.ts`, et cet import préexistait sur
`main`, inchangé par 9L07. `ecransOrphelins` reste O(écrans × chemins désignés par écran), borné par
le nombre d'écrans du dépôt — rien de quadratique que ce lot pourrait faire exploser. **Le test n'a
pas été touché, le délai n'a pas été relevé** (interdit sans cause mesurée, et la cause mesurée ici
est : il n'y a pas de cause dans ce code). L'explication la plus probable est une contention
transitoire de la machine partagée au moment précis des deux passages du pilote — cette machine
porte, au moment de cette reprise, des dizaines de répertoires `/tmp/codiplan-*` et de branches
`voie1-reste-*`/`voie2-reste-*` créées à quelques minutes d'écart, signe d'une activité concurrente
continue. Si le test retombe en rouge pour le même motif, c'est un sujet d'infrastructure (charge du
poste), pas un défaut de 9L07.

**3. Localisateurs e2e de la même famille.** Aucun à corriger : les quatre commits de 9L07 ne
touchent ni `lib/i18n/fr.ts`, ni un écran, ni une route back-office — vérifié par lecture du diff
des quatre commits. Il n'existe aucun libellé ou bouton neuf ou renommé qu'un `getByText`/`getByRole`
imprécis pourrait rencontrer.

**4. Épreuves rejouées au premier plan, `CI=1` :**
- `tests/unit/navigation/atteignabilite-ecrans.test.ts`, 5 fois de suite, `--maxWorkers=1` : vert à
  chaque passage (~1,47 s).
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` : 61 réussis, 4 ignorés (préexistants, hors de ce lot).
- Aucun fichier e2e ne porte littéralement le nom `9L07` ou `9L07-CONNEXION-TENTATIVES-LIMITEES` —
  rejoué à la place la famille qui exerce `/connexion` : `9edz-connexion.spec.ts`,
  `9edz-connexion-code.spec.ts`, `9ewb3-connexion-maquette.spec.ts`, `deconnexion.spec.ts`,
  `marque-connexion.spec.ts` — 20 réussis.
- `pnpm test:isolation` : 247 fichiers, 2274 épreuves, tout vert.
- `CI=1 pnpm verify` : vert (format, typecheck, lint, test, test:isolation, build), rejoué deux
  fois pour s'assurer que ce n'était pas un hasard.
- `verify:full` volontairement NON joué : laissé à la file, comme demandé.

**5. Captures.** Aucune — inchangé depuis la passation d'origine : ce lot ne touche aucun écran ni
aucun texte affiché.
