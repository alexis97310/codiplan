# 9BS-TP-A2-VGP-REGISTRE — passation

Commits de code : `eafcf3f`, `4fff954`, `6ffd297`, `86304e0`, `3bbb7b0`.
Commit des captures : `0258392`. Tous sur `main`, en local, non poussés.

## Ce que j'ai changé

1. **Fiche site (CS30 = PV-34).** `prochaineEcheanceDuSite` (`lib/vgp/
   registre.ts`) rendait `Date | null` — `null` confondait « aucune machine
   soumise » et « soumises toutes sans information ». Elle rend désormais une
   `SyntheseVgpSite` (`{ retenue, sansInformation, soumises }`), calculée par
   une fonction pure nouvelle, `syntheseVgpDuSite`. La tuile
   `[data-compteur="vgp-prochaine"]` de `sites/[id]` affiche : le badge
   `tonEtat`/`libelleEtatCourt` + `libelleEcheance` si une échéance est
   connue ; sinon « N sans information » (nouvelle clé
   `sites.fiche.synthese.vgp_sans_information`) si des soumises n'ont jamais
   rien dit ; sinon `—`, inchangé.
2. **Registre compté et paginé (PV-30, PV-31).** `LIGNES_AFFICHEES` (coupure
   muette à 200) est retirée ; le tableau pagine désormais par
   `LIMITE_RECHERCHE_PAR_DEFAUT` (50, comme `/parc`), avec `<Pagination>` et
   son décompte. Un cinquième KPI « Sans information » (écart nommé à D125)
   compte `estSansInformation`, nouvelle voie partagée par `resumerLeRegistre`
   et un nouveau filtre `?etat=sans_information`.
3. **« Enregistrer » selon le régime (PV-33).** `enregistrementPropose` lit
   `ligne.assujettissement` (la valeur RÉSOLUE) : `soumis` propose le lien,
   `a_determiner` le propose avec l'avertissement « Comptera si la famille
   devient soumise. » (décision d'Alexis, 29/09/2026), le reste (`non_soumis`,
   `verifie`) le masque.
4. **Date de vérification future refusée (PV-46).** `refusDeLaDateDeVerification`
   (fonction pure, `lib/vgp/saisie-verification.ts`) compare la date saisie au
   jour civil de la société — `debutDuJourSociete` (`lib/interventions/
   depot.ts`) et `cleJourDeDate` (`lib/calendar/agence.ts`) exportées, aucune
   nouvelle fonction de jour civil écrite. La route rejuge le refus AVANT
   d'écrire (un POST direct qui contournerait le `max` du champ est refusé) ;
   le formulaire pose `max` en confort de saisie.
5. **Textes du QR et de « Corriger la fiche » (PV-22, PV-25).**
   `machine.qr.description` réduite à sa première phrase ; la ligne
   « CODIPLAN:<référence> » et `machine.qr.jeton_prefixe` retirées en entier ;
   `machine.modifier.sous_titre` retirée et le formulaire ne pose plus de
   sous-titre. Les deux retraits sont nommés dans
   `ECARTS_MAQUETTE_CONTENU_FICHE` (D128).
6. **Épreuves.** Cinq nouveaux fichiers unitaires
   (`synthese-site`, `enregistrement-propose`, cas ajoutés à
   `voies-a-prevoir`, `saisie-verification`, `etat-vide-du-registre`, et
   `tests/unit/machines/tp-a2-textes.test.ts`), et un e2e nouveau,
   `tests/e2e/vgp-affichage-tpa2.spec.ts` (scène propre, prefixée `TPA2`,
   créée et supprimée par l'épreuve).

## Ce que j'ai mesuré

- `pnpm verify` intégral (format:check, typecheck, lint, test — 3289 tests,
  test:isolation — 1290 tests, build) : **vert**, exécuté après chaque
  commit de code.
- `tests/e2e/vgp-affichage-tpa2.spec.ts` : **5/5 verts** contre une vraie
  base (`E2E_DATABASE_URL`, port 5433 local). Une régression a été mesurée et
  corrigée en cours de route (voir « ce que j'ai tranché »).
- Rejoué contre une vraie base, pour confirmer l'absence de régression :
  `fiche-360-1.spec.ts`, `fiche-machine.spec.ts`, `fiche-machine-vgp.spec.ts`,
  `vgp-retard-visible.spec.ts`, `vgp-4.spec.ts` (15/15 verts) ;
  `tous-les-ecrans-rendent.spec.ts`, `messages-tpa4a.spec.ts`,
  `defilement-tableau.spec.ts`, `vgp-finitions.spec.ts` (46 verts, 3 skip sans
  rapport avec ce lot) ; `tests/unit/auth/porte.test.ts`,
  `tests/unit/theme/lien-visible.test.ts`,
  `tests/isolation/vgp-compte-tuile-registre.test.ts` (29 verts).
- Captures AVANT/APRÈS (huit scènes, deux largeurs) confirmant visuellement
  la tuile `—` → `51 sans information`, la coupure muette → pagination
  comptée, le formulaire sans `max`/sans bandeau → avec les deux, le lien
  systématique → conditionné au régime.

## Ce que j'ai tranché, et pourquoi

- **L'identifiant du second site de la scène e2e évite la sous-chaîne
  « TPA2- »** (`TPA2X-DEPASSEE`, modèle « TPA2 MODELE DEPASSEE » avec espaces).
  Mesuré : le registre n'a pas de filtre par site, et une recherche
  `?q=TPA2-` porte sur toute la société — un numéro ou une désignation
  portant ce trait d'union aurait fait dériver le compte « 53 machines » du
  premier test vers 54.
- **Le tri par urgence place les deux machines « hors registre » en dernier
  palier**, dans l'ordre de lecture de `listerLeRegistre` — qui trie par
  `numero_serie` quand `numero` est nul (toujours vrai pour des machines
  jamais synchronisées). Avec 53 lignes et une page de 50, les identifiants
  alphabétiquement après les 51 numérotés (`TPA2-A-DETERMINER`,
  `TPA2-NON-SOUMISE`) tombent en page 2. Le test « Enregistrer » a d'abord
  cherché ces deux lignes sous `?q=TPA2-` (page 1 par défaut) et a rougi une
  fois ; corrigé pour rechercher chaque machine par son propre numéro de
  série, ce qui l'isole sur une page unique et teste la RÈGLE DU BOUTON,
  jamais la pagination (déjà couverte par le premier test du fichier). Un
  seul rouge, pas deux : pas de contournement nécessaire.
- **`SyntheseVgpSite.soumises`** (nombre de lignes non `hors_registre`) est
  calculé par `syntheseVgpDuSite` mais n'est consommé par AUCUN appelant
  aujourd'hui — gardé dans le type parce que le test 0.a du ticket l'exige
  explicitement et qu'il documente une donnée déjà calculée sans coût
  supplémentaire, jamais parce qu'un écran en a besoin.
- **`enregistrementPropose` masque aussi `verifie`** (« vérifié non
  soumis »), non cité littéralement par la décision d'Alexis (qui ne nomme
  que « soumis », « à déterminer », le reste). `verifie` n'est pas « soumis »
  (voir `information.ts` : seul `soumis` sort de `hors_registre`), donc la
  question de VGP ne s'y pose pas plus que pour `non_soumis` — cohérent avec
  la doctrine du fichier, jamais vérifié séparément par Alexis.

## Ce que je n'ai PAS fait

- Pas de migration, pas de ligne de semis, pas de prix — conforme aux
  interdits du ticket.
- La tuile du tableau de bord (« VGP à prévoir ») mène toujours à
  `?etat=depassees` (PV-31, hors territoire de ce ticket).
- Le serveur ne lit toujours pas la famille au moment d'enregistrer une
  vérification (PV-33) : masquer le bouton pour `non_soumis` n'empêche pas un
  POST direct sur l'URL de cette machine. Inchangé, documenté par le ticket
  comme limite connue.
- L'import VGP (`lib/imports/vgp.ts`) accepte toujours une date future —
  hors territoire, non touché.
- Le cas d'une EXCEPTION de machine posée à `a_determiner` reçoit le même
  avertissement que sa famille (« si la famille devient soumise ») — texte
  légèrement inexact dans ce seul cas, signalé par le ticket comme à trancher
  plus tard, non résolu ici.
- Aucune capture n'a été prise pour `/vgp?etat=depassees` ni
  `?etat=a_venir` spécifiquement pour ce lot : ces filtres existaient déjà
  avant (VGP-4) et ne changent pas de comportement ici.

## Pièges pour la session suivante

- **`listerLeRegistre` trie par `numero` (souvent nul) puis `numero_serie`** :
  toute scène e2e forgeant plus de `LIMITE_RECHERCHE_PAR_DEFAUT` (50) lignes
  doit anticiper que l'ordre alphabétique des numéros de série décide de la
  page où chaque ligne tombe — chercher une ligne précise par son PROPRE
  numéro de série plutôt que par un préfixe partagé évite la surprise.
- **Les captures AVANT/APRÈS se rejouent via `git worktree`**, jamais en
  modifiant le code livré : `git worktree add --detach <chemin> <commit
  précédent>`, copier le fichier `captures-*.spec.ts` (non committé à ce
  commit-là) dans le worktree, symlinker `node_modules` et copier `.env`
  (aucune dépendance ni migration n'avait changé entre les deux commits de ce
  lot — à vérifier avant de reproduire la recette si ce n'est plus le cas),
  jouer `CAPTURES_..._PHASE=avant`, puis `git worktree remove --force`.
- **`FormulaireVerification` exige désormais `dateMax`** (prop non
  facultative) : tout futur appelant devra le calculer via
  `debutDuJourSociete` + `cleJourDeDate`, comme `vgp/enregistrer/[id]/
  page.tsx` le fait.
- **`prochaineEcheanceDuSite` ne rend plus une `Date | null`** mais une
  `SyntheseVgpSite` — un futur appelant qui recopierait l'ancienne signature
  de mémoire se tromperait de type sans avertissement du compilateur s'il ne
  regarde pas l'import.

## Ce qui reste à faire

- Reposer un lien de la tuile du tableau de bord vers un filtre plus fin que
  `?etat=depassees` si un futur audit le demande (PV-31, hors lot).
- Faire lire la famille par le serveur au moment d'enregistrer une
  vérification, pour fermer complètement PV-33 (POST direct sur une machine
  `non_soumis`).
- Trancher le cas de l'exception de machine `a_determiner` dont le texte
  d'avertissement est légèrement inexact (signalé, non résolu).
- TP-PARC (QT-11) doit reposer une désignation et un numéro de série sous le
  QR, à la place de la ligne « CODIPLAN:<référence> » retirée ici.
