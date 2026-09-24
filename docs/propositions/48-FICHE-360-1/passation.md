# 48-FICHE-360-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Fiche site (`/sites/[id]`)**
- Fil d'Ariane `Clients › <client> › <site>`, en liens, au-dessus du titre — nouvelle
  prop `filAriane` sur `components/mise-en-page/page.tsx`, partagée, pas propre à cette
  fiche.
- Synthèse en tête (`data-bloc="synthese-site"`) : équipements actifs du site,
  interventions ouvertes, dernière intervention (date + nature, lien), prochaine
  échéance VGP si le registre la connaît déjà. Chaque compteur porte un
  `data-compteur` stable.
- Actions en contexte « + Intervention » (préremplie `?site=`) et « + Machine »
  (préremplie `?client=&site=`), visibles selon les capacités `creer_demande` et
  `gerer_machine` — les mêmes que les routes qu'elles ouvrent.
- Bloc « Équipements enregistrés » (`data-bloc="equipements-site"`) : les machines
  ACTIVES du site (jamais remplacée/ferraillée/fusionnée), triées famille → marque →
  référence → n° de série, chacune avec un lien vers sa fiche et un « + Intervention »
  préremplie site ET machine. Paginé à 50 (`EQUIPEMENTS_PAR_PAGE_SITE`).
- Le formulaire de modification n'a pas bougé de contenu ; il est descendu sous ces
  nouveaux blocs.

**Fiche client (`/clients/[id]`)**
- Fil d'Ariane `Clients › <client>`.
- Synthèse en tête (`data-bloc="synthese-client"`) : lieux d'intervention actifs,
  équipements actifs (tous sites confondus), interventions ouvertes, dernière
  intervention.
- Actions « + Site » (préremplie `?client=`, capacité `gerer_client_site`) et
  « + Intervention » (lien simple, capacité `creer_demande` — voir « ce que j'ai
  tranché »).
- Liste des lieux : nouvelle colonne « Équipements » (pastille réutilisée de
  40-PASTILLES-1) et pastille « sous contrat » (CONTRAT-SITE-1) à côté du libellé —
  aucune des deux pastilles n'a été redessinée, ce sont les mêmes fonctions
  (`compteurEquipements`, `compteurContrat`) que `/sites`.
- Contacts triés « Donneur d'ordre » en tête, ordre stable pour les autres.

**Préremplissage par l'URL, sur le modèle LIENS-1**
- `/sites/nouveau?client=` préremplit le client (le rattachement, lui, reste sans
  défaut — c'est le champ que D56 protège, pas celui-ci).
- `/parc/nouvelle?client=&site=` préremplit client ET site dans `FormulaireMachine`
  (nouvelles props `clientInitial`/`siteInitial`, mode création seulement).
- Les deux valident contre le périmètre déjà lu sous le contexte cloisonné ; un
  identifiant hors périmètre retombe en silence sur le champ vide.

**Dépôt (nouvelles lectures, toutes agrégées, aucune requête par ligne)**
- `lib/machines/depot.ts` : `equipementsActifsDuSite` (page + total),
  `nombreEquipementsActifsDuClient`.
- `lib/interventions/depot.ts` : `interventionsOuvertesDuSite`,
  `interventionsOuvertesDuClient`.
- `lib/vgp/registre.ts` : `prochaineEcheanceDuSite` — rejoue `ligneDuRegistre` (déjà
  écrite pour `listerLeRegistre`) sur les machines d'UN site, jamais une seconde
  écriture de la cascade d'assujettissement.

**Correction connexe** — `tests/e2e/porte-capacites.spec.ts:107` comptait TOUTES les
fiches client de CODIMA-NC avant/après une requête forgée ; la scène de
`fiche-360-1.spec.ts` crée un client en parallèle (`fullyParallel`) et l'aurait fait
rougir sans rapport avec ce qu'il éprouve (piège nommé par le ticket). Il compte
maintenant la fiche forgée par son nom.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Gardien du vocabulaire imposé** (`tests/unit/i18n/vocabulaire-impose.test.ts`) :
  AVANT mes premières clés (« Sites actifs », « + Site », « Équipements du site »,
  fixtures « F360 — Site... ») → 5 tests rouges, le mot « site » écrit en clair hors
  `vocabulaire.*`. APRÈS reformulation (« lieu(x) », composition `mot("site")`) → 0
  rouge, `pnpm test` 251/251 fichiers, 2717/2717 tests verts.
- **Liste close des porteurs de `CLASSES_LIEN`**
  (`tests/unit/theme/lien-visible.test.ts`) : AVANT l'ajout du fil d'Ariane à
  `components/mise-en-page/page.tsx` → 1 test rouge (liste incomplète). APRÈS l'entrée
  ajoutée → vert.
- **Gardien L0-11 sur les tests de rendu**
  (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`) : AVANT → 7 emplacements en
  faute dans `fiche-360-1.spec.ts` (numéros de série, « 0 », « — » écrits en dur dans
  des `getByText`/`toHaveText`). APRÈS (fixtures dictionnaire, `String(0)`,
  `ouTiret(null)`) → 0 faute, `pnpm verify` intégralement vert (format, typecheck,
  lint, 2717 tests unitaires, 1196 tests d'isolation, build).
- **Isolation** (`tests/isolation/fiche-360-1.test.ts`) : sur `SITE_F360` (2 machines
  actives + 1 remplacée, 1 intervention ouverte + 1 annulée), `equipementsActifsDuSite`
  rend `total=2` et jamais la remplacée ; `interventionsOuvertesDuSite` rend `1`. Sur
  `SITE_B1_S1`/`CLIENT_B1` (témoin : au moins une machine active et une intervention
  ouverte existent réellement, vérifié sous le propriétaire), les quatre lectures lues
  sous le contexte de SOCIÉTÉ A rendent zéro. 117 fichiers, 1196 tests d'isolation
  verts.
- **Bout en bout** (`tests/e2e/fiche-360-1.spec.ts`) : 6 scénarios verts — le bloc
  équipements rend exactement 3 lignes sur le site qui en porte 3, 0 sur celui qui
  n'en porte aucun ; « + Intervention » d'une machine arrive avec `site`+`machine`
  cochés à l'écran (pas seulement dans l'URL) ; le fil d'Ariane clique et ramène au
  client ; « + Site » arrive avec le client déjà sélectionné dans le `<select>` ;
  les compteurs « dernière intervention »/« prochaine VGP » d'un site neuf affichent
  « — », jamais « 0 » — vérifié par lecture du DOM, pas par supposition.
- **Suite complète, après toutes les corrections** : `pnpm verify:full` intégral —
  `feries:horizon` (2 territoires, vert), `audit:partitions` (13 partitions, vert),
  `pnpm test:e2e` (202 tests verts, 3 sautés — sans rapport avec ce ticket, des routes
  `[id]` sans fixture dans `tous-les-ecrans-rendent.spec.ts`), en plus des specs
  `historique-site.spec.ts`, `sites.spec.ts`, `contacts.spec.ts`, `liens-fiches.spec.ts`
  qui visaient déjà ces deux fiches — aucune assertion existante modifiée, aucune
  régression.

## Ce que j'ai tranché et pourquoi

- **« Interventions ouvertes » = statut hors `{terminee, cloturee, annulee}`.** Aucune
  règle du chapitre 10 ni de `docs/arbitrages.md` ne nomme ce regroupement ; c'est un
  compteur d'affichage, pas une règle qui change ce qu'un client paie ou une
  préséance de synchronisation. Repris du regroupement déjà écrit dans
  `prisma/schema.prisma` pour I5. **Condition de réouverture** : si le chapitre 10 ou
  `docs/arbitrages.md` nomme un jour ce regroupement autrement.
- **« + Intervention » depuis la fiche client est un LIEN SIMPLE, jamais préremplie.**
  `ChampSiteEtMachines` (`interventions/nouvelle`) organise la saisie autour du SITE,
  pas du client — préremplir depuis le client exigerait un second mécanisme
  (choisir un client puis filtrer ses sites côté client), hors du périmètre mesuré de
  ce ticket. **Condition de réouverture** : si ce formulaire gagne un jour un champ
  client de premier niveau.
- **La liste des lieux de la fiche client compte TOUS les équipements par site**
  (`equipementsParSite`, existante), pas seulement les actifs — délibérément la MÊME
  notion que la pastille de `/sites` (le commentaire de cette fonction le dit :
  « la même notion... pour qu'un site affiché à 0 ne soit jamais aussi un site que le
  filtre aurait dû masquer »). Le bloc « Équipements du site », lui, ne montre que les
  actives : deux emplacements, deux questions différentes (« qu'est-ce qui existe » vs
  « qu'est-ce qui est physiquement là aujourd'hui »).
- **Les actions « + Intervention »/« + Machine »/« + Site » sont gated par capacité**
  sur les DEUX fiches, contrairement à `/parc` et `/interventions` où le bouton
  « Nouvelle » de la liste n'est pas gated côté écran (seule la route l'est). Choix
  explicite : ces actions sont posées EN CONTEXTE sur une fiche, sur le même modèle
  que `peutModifierSite` déjà écrit dans ce fichier pour CONTRAT-SITE-1, pas sur le
  modèle d'un écran d'entrée.
- **Le `sousTitre` LIENS-1 existant sur la fiche site (lien vers le client) n'a pas
  été retiré**, malgré la redondance visuelle avec le nouveau fil d'Ariane — pour ne
  rien changer au comportement déjà couvert par `tests/e2e/liens-fiches.spec.ts` et
  au commentaire du code qui s'y réfère explicitement.

## Ce que je n'ai PAS fait

- Pas de « prochaine VGP due » sur la fiche CLIENT — le ticket ne la demande que pour
  la fiche site.
- Pas de préremplissage client pour « + Intervention » sur la fiche client (voir
  ci-dessus, choix nommé).
- Pas de couverture d'isolation dédiée pour `prochaineEcheanceDuSite` — elle passe
  par le même `avecContexteApplicatif` que tout le reste, déjà éprouvé ailleurs, mais
  je n'ai pas écrit de scénario qui le reprouve spécifiquement avec une vraie donnée
  VGP sous une autre société (le ticket ne nommait que « les compteurs et le bloc
  équipements »).
- Rien touché à `depot/` ni `11-FILE.sh` (interdit).
- Aucune migration, aucune ligne de semis, aucun prix (interdit).
- Le lot 46-SELECTEURS-1 (sélecteurs de recherche serveur) n'est pas sur `main` —
  mesuré en début de session — et je ne l'ai ni fusionné ni attendu ; `/sites/nouveau`
  et `/parc/nouvelle` gardent leurs `<select>` pleine liste.

## Les pièges pour la session suivante

- **Le gardien L0-11 (`sans-chaine-visible-en-dur.test.ts`) scanne aussi les fichiers
  de test.** Un texte attendu par un `getByText`/`toHaveText`/`getByRole({name})` doit
  venir de `fr[...]`, jamais d'un littéral — et un `const X = "texte"` local ne
  protège rien : le gardien résout un identifiant vers sa constante littérale du
  même fichier (« le deux-temps ne protège pas », forme 3 du §9). Pour un nombre
  simple, `String(variable)` passe (aucune chaîne littérale dans l'arbre) ; pour une
  absence, réutiliser `ouTiret(null)` plutôt que recopier « — ».
- **`notIn`/les filtres Prisma sur un enum veulent un tableau MUTABLE.** Un
  `readonly X[]` ou un `Set` non typé explicitement (`new Set([...])` sans
  `Set<StatutMachine>`) fait échouer `tsc`. Spreader (`[...ensemble]`) suffit une
  fois le `Set` correctement typé.
- **`porte-capacites.spec.ts:107` reste fragile en esprit** : toute future scène e2e
  qui crée des CLIENTS de CODIMA-NC en parallèle doit vérifier qu'aucun compte global
  (client/site/machine) n'est repris ailleurs sans le même correctif (compter par nom
  forgé, jamais par société entière).
- **`FormulaireMachine` distingue déjà « création » de « modification »** dans son
  type `Props` ; les nouvelles props `clientInitial`/`siteInitial` ne vivent que sur
  la branche création — les ajouter par erreur à la branche modification ne
  compilerait pas (elles n'existent pas sur ce type).

## Ce qui reste à faire

- Décider si « + Intervention » depuis la fiche client doit un jour préremplir le
  client (actuellement un lien simple, nommé ci-dessus).
- Étendre la synthèse client d'une « prochaine VGP » si l'exploitation la demande.
- Quand 46-SELECTEURS-1 atteindra `main`, revérifier que les préremplissages
  `?client=`/`?site=` de `/sites/nouveau` et `/parc/nouvelle` survivent au nouveau
  composant de sélection (ils reposent aujourd'hui sur un `<select>` natif et son
  `defaultValue`).
