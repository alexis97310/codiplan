# Audit d'ergonomie de CODIPLAN — 26 septembre 2026

*Auditeur indépendant (Claude, dans Cowork), qui n'a pas participé au développement. Seule l'expérience d'utilisation est jugée, jamais le code. État de `main` examiné : commit `74f9d6f` (26/09/2026, 06 h 33 à Nouméa). Aucune session Claude Code n'a été lancée et aucun fichier du dépôt n'a été modifié ; ce fichier y entre au début de la session Claude Code décrite au § 6.*

**Sources.**
1. Les 54 images de `docs/captures/` (27 écrans, à 1280 et 390 px). **Elles ont été prises le 18/09/2026 (commit photographié `bbf7e3c`, versées par `f9e67d2`) ; 346 commits sont passés sur `main` depuis : elles ne sont pas relancées à chaque commit.**
2. Pour l'état actuel : les captures que chaque lot dépose dans `docs/propositions/<lot>/captures/` (114 images, du 24 au 26/09), notées ci-dessous `propositions/<lot>/captures/<fichier>`. Les images de `docs/captures/` sont notées par leur seul nom de fichier.
3. Les deux maquettes, rendues en images pour comparer : `CODIPLAN_Maquette.html` (dite « d'origine ») et `codiplan-maquette-complete.html` (dite « complète », qui fait foi depuis D124 et D125 sur les couleurs et sur la disposition des quatorze écrans qu'elle dessine).
4. Quand une capture était périmée ou ambiguë, le libellé actuel a été lu dans `lib/i18n/fr.ts` ; c'est alors dit.
5. Les tickets déjà en file (99F à 99J) et les décisions déjà rendues ont été relus pour ne rien proposer deux fois.

**Légende.** Entre parenthèses : les scénarios concernés (A à F). ⚠ : écart à la maquette ou à une décision écrite, **à arbitrer**, jamais à appliquer d'office — ces points sont exclus du prompt du § 6.

---

## 1. Résumé

1. **Force** — Les erreurs coûteuses sont déjà verrouillées : import contrôlé avant toute écriture et annulable, « Voir l'impact » avant de bloquer un agenda, confirmation avant d'annuler ou de lever, saisie conservée après un refus, refus expliqués en clair.
2. **Force** — Une charpente fidèle à la maquette complète : barre groupée par domaine, surtitre + titre + action principale en haut à droite, statuts colorés selon l'annexe D, menu ☰ sur téléphone.
3. **Force** — Les données se relient : fiches client, site et machine « 360 », « + Intervention » depuis un site ou une machine, recherche par n° de série, onglets du registre avec compteurs, retours qui gardent les filtres.
4. **Faiblesse** — Le planning ne se lit pas d'un coup d'œil : à 1280 px, les cartes de la semaine sont si tronquées que le client n'y apparaît plus (« 08:00 … »), la file « À planifier » est titrée par des numéros provisoires et une P1 y est grise.
5. **Faiblesse** — Des pièges font rater ou ralentissent la tâche : nature « Préventif sous contrat » par défaut, aucun modèle Excel à télécharger, « Transformer en intervention » qui ne crée rien, clôture qui fige le temps sans avertir, « Déplacer » qui fait ressaisir date, heure et durée.
6. **Faiblesse** — Les signaux changent de sens d'un écran à l'autre : trois codes couleur pour la priorité, quatre noms pour « suspendue », du rouge pour de simples compteurs ou des actions sans objet.
7. **À savoir d'abord** — `docs/captures/` a huit jours de retard ; la dernière étape du prompt (§ 6) la relance.
8. **Par où commencer** — GR1 à GR4 (§ 3) retirent les pièges les plus coûteux ; chacun tient en moins d'une demi-journée.

---

## 2. Constats classés par gravité

### 2.1 Bloquants — empêchent la tâche ou la font rater

**B1 — La nature d'une nouvelle intervention est pré-remplie à « Préventif sous contrat »** (A)
- *Écrans* : `propositions/92-CREATION-2/captures/apres-choix-du-lieu-1280.png` (« Nature (obligatoire) ») ; `propositions/73-DEMANDES-2-REPRISE/captures/formulaire-prerempli--1280.png` (même depuis une demande « Compresseur arrêté sur alarme ») ; `intervention-creation--clair--1280.png`.
- *Ce qui se passe* : le champ arrive rempli avec la première valeur de la liste.
- *Pourquoi c'est un problème* : pour un appel de panne, il faut penser à changer la valeur ; sinon un curatif est enregistré comme préventif sous contrat, sans aucun signal — planning faux, et risque sur la facturation. La mention « obligatoire » ne protège de rien puisque le champ n'est jamais vide.
- *Recommandation* : première option vide « — Choisir la nature — », champ requis, aucune valeur par défaut.

**B2 — Aucun modèle Excel ne se télécharge** (F)
- *Écran* : `imports--clair--1280.png` (état du 18/09) ; sur `main`, le libellé affiché est toujours « Le modèle à télécharger n'est pas encore disponible pour ce type d'import. »
- *Ce qui se passe* : l'écran exige « un fichier .xlsx bâti sur le modèle CODIPLAN » dont « la première cellule porte le marqueur du modèle », mais « Télécharger le modèle Excel » est un texte inerte. La maquette d'origine le dessine comme un lien actif.
- *Pourquoi* : un ADV seul ne peut pas produire un fichier accepté ; le premier import en masse échoue avant même le contrôle.
- *Recommandation* : chantier C2 (déjà prévu sous le nom IMPORT-3, SAV-22). ⚠ Fonction annoncée à l'écran mais pas construite : à arbitrer si on la tient pour nouvelle.

### 2.2 Gênants — ralentissent ou font douter

**G1 — Planning, vue Semaine : des cartes tronquées au point d'être illisibles** (A, B, C)
- *Écrans* : `propositions/99E-EVITEMENT/captures/planning-nom-accessible-1280.png` (26/09) ; `propositions/82-PLANNING-6/captures/vue-semaine-apres-1440.png`.
- *Ce qui se passe* : la semaine tient en entier, mais chaque colonne jour fait environ 80 px : « 08:00 … », « Prévent… », « Site Ateli… », « Matériel … » — le client n'apparaît pas. À 1440 px, il est coupé après cinq lettres (« 08:00 Ateli… »). La maquette complète affiche « 08:00 · Garage Boulari / Préventif · Pont 2 colonnes ».
- *Pourquoi* : c'est l'écran central. Pour trouver « l'intervention de demain chez tel client », il faut survoler ou ouvrir les cartes une à une ; deux cartes du même client sont indiscernables, ce qui expose à déplacer la mauvaise.
- *Recommandation immédiate* : la ligne « heure + client » ne se tronque jamais (retour à la ligne, deux lignes au plus) ; les autres lignes gardent troncature et infobulle. *Recommandation de fond* : chantier C1 (⚠).

**G2 — File « À planifier » : des numéros en guise de titres, une P1 grise** (A)
- *Écrans* : `propositions/99E-EVITEMENT/captures/planning-nom-accessible-1280.png` ; `planning--clair--1280.png`.
- *Ce qui se passe* : cartes titrées « Local-000001 », client en deuxième ligne grise ; pastilles « P1 — critique », « P2 — haute », « P3 — normale » toutes grises et identiques.
- *Pourquoi* : l'urgence qu'on vient de saisir ne ressort pas, et le numéro provisoire ne dit rien au planificateur.
- *Recommandation* : titre = client, deuxième ligne = panne signalée ou nature, numéro provisoire en petit ; pastille de priorité colorée (G6). La maquette complète titre ses cartes par la priorité et le client (« P1 · Atelier du Port »). L'indication du glisser-déposer est déjà en file (99J).

**G3 — « Déplacer » : date, heure et durée à ressaisir** (B)
- *Écrans* : `propositions/84-FICHE-ANNULER/captures/confirmation-ouverte-1280.png` (intervention planifiée le 24/09 : les trois champs sont vides) ; `propositions/47-AVERTISSEMENTS-1/captures/bandeau-deplacement-375.png`.
- *Ce qui se passe* : seul le technicien est pré-rempli. Depuis 93 et 97A, le bloc est en plus replié : un clic pour l'ouvrir.
- *Pourquoi* : pour décaler d'une semaine, on retape trois valeurs dont deux ne changent pas, et la durée se retape en minutes alors que le planning l'affiche en « 2 h 00 ». Le glisser-déposer ne peut pas servir : la semaine suivante n'est pas à l'écran.
- *Recommandation* : pré-remplir date, heure de début et durée avec les valeurs actuelles, modifiables. La file des travaux du 25/09 jugeait le champ date vide « voulu », pour que l'avertissement d'agenda bloqué ne dise rien avant qu'une date soit saisie ; pré-remplir déclenche simplement cet avertissement pour la date actuelle, ce qui est juste.

**G4 — « Transformer en intervention » ne crée pas l'intervention et retire la demande de la file** (A)
- *Écran* : `propositions/73-DEMANDES-2-REPRISE/captures/fiche-demande-avant--1280.png`.
- *Ce qui se passe* : le bouton « Transformer en intervention » marque seulement la demande « transformée » ; l'intervention se crée par un lien souligné placé au-dessus, et l'avertissement (« Cette action marque la demande transformée ; elle ne crée pas l'intervention… ») est écrit en petit gris. La liste « Demandes » ne montre que les demandes nouvelles et qualifiées.
- *Pourquoi* : l'utilisateur pressé clique le bouton qui porte le nom de sa tâche ; la demande quitte la file sans qu'aucune intervention n'existe. Le piège est latent aujourd'hui (aucune demande ne peut encore arriver : pas de saisie au bureau, portail fermé), certain dès qu'elles arriveront.
- *Recommandation* : faire du lien « Créer une intervention depuis cette demande » le bouton plein, en tête du bloc ; renommer le bouton actuel « Marquer comme transformée » (contour) ; tant qu'aucune intervention n'est issue de la demande, lui faire demander confirmation (« Aucune intervention n'est née de cette demande. La marquer transformée la retire de la liste. ») avec le dialogue déjà utilisé pour « Annuler ».

**G5 — La clôture fige le temps validé sans prévenir** (D)
- *Écrans* : `propositions/50-INTERVENTIONS-2/captures/fiche-cloturee-1280.png` ; le formulaire de clôture avec un temps mesuré n'apparaît dans aucune capture (voir § 5).
- *Ce qui se passe* : le temps se valide dans le bloc « Clôturer » (« Temps validé (minutes) », pré-rempli par le compteur selon D120) ; une fois l'intervention clôturée, la fiche dit « Seule son annulation reste possible ».
- *Pourquoi* : rien, au moment de valider, ne dit que ce chiffre ne se corrigera plus ; la seconde moitié du scénario D (corriger le temps validé) n'est possible qu'en annulant l'intervention. Que la clôture fige le temps est une règle de gestion : l'audit ne la discute pas, il demande seulement qu'elle se voie avant le geste.
- *Recommandation* : sous le champ, « Après clôture, ce temps ne se corrige plus » ; au clic sur « Clôturer », une confirmation qui répète le temps en heures (« Clôturer avec 1 h 30 validées ? »), avec le dialogue de « Annuler ».

**G6 — Trois codes couleur pour la même priorité** (A, C)
- *Écrans* : `propositions/98-TABLEAU-2/captures/tableau-de-bord-1280.png` (P1, P2 et P3 du même rose-rouge) ; `propositions/99E-EVITEMENT/captures/planning-nom-accessible-1280.png` (P1, P2, P3 grises) ; `propositions/58-REGISTRE-1-REPRISE/captures/bloquees-1280.png` (P3 grise) ; `propositions/93-FICHE-ACTIONS/captures/suspendre-replie-1280.png` (fiche : « P3 — normale » en texte noir).
- *Ce qui se passe* : chaque écran a son code. Le registre, d'après son code (aucune capture n'y montre une P1), met P1 en rouge, P2 en orange, P3 et P4 en gris.
- *Pourquoi* : un code qui change d'écran en écran ne s'apprend pas ; une P1 doit se voir partout de la même façon.
- *Recommandation* : une seule pastille de priorité, la même partout, fiche comprise, avec la correspondance déjà en place dans le registre. ⚠ La palette elle-même est à trancher : la maquette d'origine donne P3 en bleu (`.b-p3`), la complète ne dessine que P1 (rouge) et P4 (bleu).

**G7 — « Suspendue » porte quatre noms, et la tuile du tableau de bord ne mène nulle part** (C)
- *Écrans* : `propositions/98-TABLEAU-2/captures/tableau-de-bord-1280.png` (« Dossiers bloqués 1 », seule tuile sans lien) ; `propositions/58-REGISTRE-1-REPRISE/captures/bloquees-1280.png` (onglet « Bloquées », tuile « En attente », pastille « Suspendue ») ; `propositions/99A-ARRIVEE/captures/planning-apres-connexion-directe-1280.png` (légende « Suspendue / absence »).
- *Ce qui se passe* : un même état, quatre mots. « Dossiers bloqués » ne compte que les attentes de pièce, quand l'onglet « Bloquées » compte toutes les suspensions ; c'est pour cela que 98-TABLEAU-2 n'a pas mis de lien (le compte ne correspondait à aucune liste).
- *Pourquoi* : « ce qui est bloqué » donne deux chiffres selon l'écran, et la tuile la plus visible est un cul-de-sac.
- *Recommandation* : aligner le compte plutôt que renoncer au lien — la tuile compte toutes les suspendues, détail « dont N en attente de pièce » (la maquette complète écrit « 2 pièces attendues · 1 validation »), et mène à l'onglet « Bloquées » ; dans le registre, la tuile « En attente » mène aussi à « Bloquées », et « En cours » à l'onglet du même nom. ⚠ Un seul mot pour cet état serait plus clair, mais « Bloquées » vient de la feuille de route (SAV-07) : à arbitrer.

**G8 — Tableau de bord : les « Priorités opérationnelles » sont titrées par catégorie** (C)
- *Écrans* : `propositions/98-TABLEAU-2/captures/tableau-de-bord-1280.png` ; maquette complète, tableau de bord.
- *Ce qui se passe* : quatre lignes sur six s'intitulent « Intervention à planifier » ; le client n'arrive qu'en sous-ligne grise, après le numéro (« Local-000011 · Atelier Ducos »), et la panne n'apparaît nulle part.
- *Pourquoi* : pour choisir la prochaine action, il faut savoir quoi et chez qui ; le titre répète l'information que la pastille donne déjà.
- *Recommandation* : titre = « panne signalée (à défaut la nature) — client », sous-ligne = « n° · site » ; ligne entière cliquable, le bouton « Ouvrir » restant. Proche de la maquette complète, qui titre deux lignes sur quatre « Compresseur arrêté — Lagon Maintenance », « Pièce attendue — Nouméa Pneus ».

**G9 — Le bloc « Clôturer » s'affiche en rouge dès « À planifier »** ⚠
- *Écrans* : `propositions/93-FICHE-ACTIONS/captures/suspendre-replie-1280.png` ; `propositions/86-LIENS-2-REPRISE/captures/fiche-lien-retour-1280.png`.
- *Ce qui se passe* : les actions secondaires se replient désormais, mais un refus ne se replie jamais : « Aucun temps n'a été mesuré sur cette intervention… » reste déplié, en rouge, juste sous « Planifier ».
- *Pourquoi* : le rouge attire l'œil vers une action hors de propos à ce stade ; à force de voir un bloc rouge sur chaque fiche, on n'y prête plus attention le jour où il compte.
- *Recommandation* : tant que l'intervention n'est pas « Terminée », replier « Clôturer » comme « Suspendre » et « Annuler » (titre seul, ton neutre). ⚠ Contredit la règle écrite de l'écran (« un refus s'affiche toujours tel quel », « en oxyde ») : à arbitrer, avec C5.

**G10 — Téléphone : le registre montre filtres et tuiles avant la liste** (C, E)
- *Écran* : `propositions/58-REGISTRE-1-REPRISE/captures/bloquees-375.png`.
- *Ce qui se passe* : les champs de filtre (huit depuis le filtre technicien), « Rechercher », puis trois tuiles pleine largeur : le premier résultat apparaît après environ 1 300 px de défilement, et le tableau défile ensuite de côté (colonne Site coupée).
- *Pourquoi* : depuis un téléphone, on vient au registre pour une ligne précise ; il faut d'abord traverser deux écrans de formulaire, puis lire un tableau coupé.
- *Recommandation* : sous 768 px, filtres repliés derrière « Filtres (n actifs) », onglets et liste d'abord, tuiles après la liste ; lignes rendues en cartes, comme la liste du planning sur téléphone.

**G11 — Téléphone : la fiche intervention garde ses actions tout en bas, et son titre se colle à la pastille** (B, D)
- *Écrans* : `propositions/50-INTERVENTIONS-2/captures/fiche-a-planifier-375.png` ; `propositions/47-AVERTISSEMENTS-1/captures/bandeau-deplacement-375.png`.
- *Ce qui se passe* : environ 1 800 px de détails avant « Actions » (captures du 24 et du 25/09, antérieures au repli des actions et à 96B : à re-mesurer) ; le bandeau du haut affiche « Intervention Local-B3ACC3À planifier » — il recopie tout le texte du titre, pastille comprise, et c'est toujours le cas sur `main`.
- *Pourquoi* : le geste qu'on vient faire (planifier, déplacer, clôturer) est au bout d'un long défilement ; le titre collé se lit mal.
- *Recommandation* : sous 768 px, le bloc de l'action principale du statut juste sous le titre ; le bandeau reprend le titre seul, sans la pastille.

**G12 — Téléphone : la vue Jour du planning est illisible** (A)
- *Écran* : `propositions/75-PLANNING-5/captures/vue-jour-a-caler-375.png`.
- *Ce qui se passe* : cinq colonnes de techniciens dans 330 px ; les noms se chevauchent (« T. Wamytan » sur « M. Poigoune »), les cartes sont coupées (« Sit… », « Ma… »).
- *Pourquoi* : c'est la vue qui montre qui est libre ; sur téléphone, on ne peut pas la lire.
- *Recommandation* : sous 768 px, vue Jour en liste par technicien (comme la vue Semaine), ou un technicien à la fois avec un sélecteur. À faire après 99F et 99G, en file sur le même écran.

**G13 — Parc : des filtres sans nom** (E)
- *Écrans* : `propositions/99C-PARC-TRI/captures/parc-tri-liste-compacte-1280.png` ; `propositions/99C-PARC-TRI/captures/parc-tri-ordre-client-1280.png`.
- *Ce qui se passe* : les quatre listes de filtre affichent « Tous l… », « Tous l… », « Tous l… », « Toute… » ; la liste est triée par client, mais la ligne ne le montre pas (elle porte famille · n° de série · année, conformément à D126).
- *Pourquoi* : on ne sait pas quel filtre on règle ; et dans une liste triée par client, rien ne dit où commence le client suivant.
- *Recommandation* : un libellé visible sur chaque filtre (Client, Site, Famille, Statut), au besoin sur une seconde rangée. ⚠ Pour le client : un intertitre par client dans la liste, sans toucher au contenu de la ligne fixé par D126 — à arbitrer.

**G14 — Fiche client : l'historique ne dit pas quelle machine** (E)
- *Écrans* : `propositions/48-FICHE-360-1/captures/fiche-client-1280.png` ; `client-detail--clair--1280.png`.
- *Ce qui se passe* : colonnes Référence, Date planifiée, Nature, Site, Statut — pas de machine.
- *Pourquoi* : pour retrouver l'historique d'une machine depuis son client (scénario E), il faut ouvrir chaque intervention.
- *Recommandation* : ajouter la colonne « Machine » (désignation et n° de série, lien vers la fiche machine).

**G15 — Sites : des sites masqués sans le dire, des titres en double, « lieu » au lieu de « site »**
- *Écrans* : `propositions/85-PARC-SITES/captures/cartes-titrees-par-client-1280.png` ; `propositions/48-FICHE-360-1/captures/fiche-site-1280.png` ; maquette complète, sites.
- *Ce qui se passe* : « Afficher aussi les lieux sans équipement » est décoché par défaut, sans dire combien de sites sont cachés ; deux cartes titrées « Atelier Ducos » (le client) ; boutons et titres « Nouveau lieu », « ← Tous les lieux », « Lieux d'intervention », alors que le menu dit « Sites » et la maquette « + Nouveau site ».
- *Pourquoi* : un site qu'on vient de créer, sans machine encore, « disparaît » de la liste ; deux cartes au même titre se confondent ; deux mots pour un même objet font douter.
- *Recommandation* : titre de carte « Client — Site » (maquette) ; sous les filtres, « N sites sans équipement masqués · Afficher » — le masquage par défaut répond à LISTES-1 et reste, seul le nombre caché devient visible ; « site » dans tous les boutons et titres (vocabulaire imposé, D5 et D47).

**G16 — Imports : l'ordre des types n'est pas dit, le motif de rejet est vague** (F)
- *Écrans* : `imports--clair--1280.png` ; `imports-rapport--clair--1280.png` (état du 18/09 ; ordre et libellé inchangés sur `main`).
- *Ce qui se passe* : la liste présente les modèles de matériel avant les familles, alors qu'un modèle exige une famille ; le motif « Cette ligne ne passe pas la saisie : une valeur manque ou n'est pas au format attendu. La correction est dans le fichier. » ne nomme ni la colonne ni la valeur.
- *Pourquoi* : un import dans le désordre se solde par des rejets ; un rejet qui ne dit pas quelle cellule corriger oblige à relire le fichier ligne à ligne.
- *Recommandation* : sous chaque type, une ligne « À importer après : … » ; un motif qui nomme la colonne et la valeur reçue (« Colonne « Code client » : vide »).

**G17 — Durées : trois écritures à l'affichage, la minute à la saisie** (B, D)
- *Écrans* : `propositions/99A-ARRIVEE/captures/planning-apres-connexion-directe-1280.png` (« 11:30 engagées », « 2 h 00 ») ; `parametres-trajets--clair--1280.png` (« 04:00 (240 minutes) ») ; `propositions/93-FICHE-ACTIONS/captures/suspendre-replie-1280.png` (« Durée en minutes ») ; « Temps validé (minutes) » sur `main`.
- *Ce qui se passe* : la même grandeur s'écrit « 2 h 00 », « 04:00 » ou « 11:30 », et se saisit en minutes.
- *Pourquoi* : « 11:30 » se lit comme une heure de la journée ; la saisie en minutes oblige à convertir de tête.
- *Recommandation* : toute durée affichée « 11 h 30 » ; libellés de saisie « (en minutes — ex. 90 = 1 h 30) ».

**G18 — Des textes qui expliquent le logiciel au lieu de guider**
- *Écrans* : `client-creation--clair--1280.png` (« La société vient de la session et n'est jamais une saisie… ») ; `propositions/73-DEMANDES-2-REPRISE/captures/fiche-demande-avant--1280.png` (« Le numéro est attribué par le serveur à la première synchronisation ») ; `propositions/99D-ABSENCES-1/captures/avant-lever-1280.png` (« …la nature d'une indisponibilité regarde la médecine du travail… ») ; `imports-rapport--clair--1280.png` (« Écrit en base exactement les lignes montrées ci-dessus ») ; `enrolement--clair--1280.png` (« Un second facteur s'active ; il ne se retire pas ») ; `parametres-prestations--clair--1280.png` (« La checklist type ne se saisit pas encore : personne n'a dit ce qu'elle porte… ») ; `propositions/46-SELECTEURS-1/captures/parc-nouvelle--modele_id--choisi--1280.png` (« Les quatre champs marqués d'un astérisque sont obligatoires (RG-PAR-02) » — aucun astérisque n'est visible sur la capture).
- *Ce qui se passe* : l'aide justifie un choix de conception, cite une règle par son code, ou annonce ce qui manque.
- *Pourquoi* : pour des utilisateurs pressés et non informaticiens, chaque phrase de justification allonge la lecture et noie la consigne utile ; un astérisque annoncé mais absent fait chercher ce qui est obligatoire.
- *Recommandation* : une consigne d'action d'une phrase (réécritures proposées en GR16) ; aucun code de règle à l'écran ; un astérisque réel sur les quatre champs obligatoires de la fiche machine. La justification reste dans `docs/`. Rejoint SAV-36.

### 2.3 Mineurs — finition

| # | Ce qui se passe (écran) | Pourquoi | Recommandation |
|---|---|---|---|
| M1 | Registre : les tuiles gardent leur valeur « sur tout le registre » quand un filtre est actif, les onglets suivent le filtre (« En cours 3 » et « En cours (0) » côte à côte). *`propositions/64-REGISTRE-2-REPRISE/captures/filtre-technicien-aucun-vue-a-planifier-1280.png`, `propositions/88-REGISTRE-5/captures/registre-filtre-1280-1280.png`* | La mention existe depuis 88-REGISTRE-5, mais deux chiffres pour un même mot font douter. | Tuiles cliquables vers leur onglet (GR6). ⚠ Les faire suivre les filtres contredit le choix écrit de l'écran (« ces trois nombres ne bougent jamais ») : à arbitrer. |
| M2 | « Montant, en unités mineures » (forfaits, taux horaire). *`parametres-forfaits--clair--1280.png`* | Jargon ; sans conséquence en XPF (l'unité mineure est le franc), mais une erreur d'un facteur 100 guette une société en euros — la solution est à vendre. | « Montant (XPF) » ou « Montant en centimes — ex. 1 250 = 12,50 € » selon la devise, exemple sous le champ (SAV-30, pas encore fait). |
| M3 | Barre latérale : les titres de groupe collent à l'entrée précédente (« Absences » / « CLIENTS & PARC »). *`propositions/99E-EVITEMENT/captures/planning-nom-accessible-1280.png`* | Les domaines se distinguent moins bien ; la maquette complète les espace. | Espace au-dessus de chaque titre de groupe, comme la maquette. |
| M4 | Retours : « ← Retour au planning », « ‹ Retour au parc », « ← Tous les clients », « ← Toutes les demandes », « ← Fiche Local-… », fil d'Ariane sur deux fiches ; à droite ou à gauche ; le formulaire de création renvoie toujours « au planning », même ouvert depuis une demande, un client ou une machine. *`propositions/92-CREATION-2/captures/apres-choix-du-lieu-1280.png`, `propositions/99B-FICHE-MACHINE/captures/fiche-machine-vgp-depassee--1280.png`, `propositions/48-FICHE-360-1/captures/fiche-client-1280.png`, `propositions/73-DEMANDES-2-REPRISE/captures/fiche-demande-avant--1280.png`, `propositions/83-BON-5/captures/bon5-ecran-1280.png`* | On cherche le retour à un endroit différent sur chaque écran ; celui de la création mène parfois ailleurs que d'où l'on vient. | Même flèche « ← » partout (la maquette complète écrit « ← Retour au parc ») ; retour du formulaire de création vers l'écran d'origine. Le modèle unique est le chantier C6. |
| M5 | Titres : « Demandes », au pluriel, pour une seule demande ; « Intervention Local-… » sans le client. *`propositions/73-DEMANDES-2-REPRISE/captures/fiche-demande-avant--1280.png`, `propositions/93-FICHE-ACTIONS/captures/suspendre-replie-1280.png`* | Le titre ne dit pas quelle fiche est ouverte. | « Demande — <client> ». ⚠ Pour la fiche machine, le titre générique « Fiche machine » suit la maquette complète (`machinePage()`) : le changer serait un écart. |
| M6 | Planning à 1280 px, vue Semaine : la barre d'actions passe sous le titre, « Créer une intervention » quitte le coin haut droit (il y est à 1440 px et en vue Jour). *`propositions/99E-EVITEMENT/captures/planning-nom-accessible-1280.png`, `propositions/75-PLANNING-5/captures/vue-jour-a-caler-1280.png`* | L'action principale change de place selon la largeur et la vue. | « Créer une intervention » dans la ligne du titre, en haut à droite, à toutes les largeurs ; seuls les boutons de navigation passent à la ligne. |
| M7 | Charge par technicien : le taux se noie dans la formule (même graisse) ; « 131 % » en gris sous le nom ; un technicien sans intervention n'apparaît pas. *`propositions/99A-ARRIVEE/captures/planning-apres-connexion-directe-1280.png`* | La surcharge ne se voit pas. La formule reste : c'est une exigence d'exploitation (« jamais le pourcentage seul »). | Taux en gras, rouge au-delà de 100 %, formule gardée en gris. |
| M8 | Tableau de bord : « Non calculé » en très gros dans une tuile ; le filtre « Tous les besoins » demande un clic sur « Filtrer ». *`propositions/98-TABLEAU-2/captures/tableau-de-bord-1280.png`* | La plus grosse écriture de l'écran annonce une absence ; un clic de plus pour filtrer. | « Non calculé » en texte courant avec le lien vers la charge ; filtre appliqué au changement (le bouton reste pour qui n'a pas JavaScript). |
| M9 | VGP : « ‹ Retour au parc » sur une page qui a sa propre entrée de menu ; « Échéance dépassée » écrit deux fois par ligne ; le bandeau « 1 famille reste à déterminer » est un lien qui n'en a pas l'air. *`propositions/96-VGP-4-REPRISE-2/captures/registre-filtre-depassees-1280.png`* | Un retour vers un écran d'où l'on ne vient pas ; une ligne redondante ; un lien qu'on ne clique pas. | Retirer le retour ; garder « Échéance dépassée » dans la seule colonne État ; souligner le bandeau et y ajouter « → ». |
| M10 | Absences : titre « Blocages d'agenda », menu « Absences ». *`propositions/99D-ABSENCES-1/captures/avant-lever-1280.png`* | On se demande un instant si l'on est sur la bonne page. | ⚠ Déjà en arbitrage (99D-ABSENCES-2). Une issue de plus : aligner le menu sur le titre, fidèle à R3-14 mais écart à la maquette complète. |
| M11 | Référentiel matériel : chaque famille et chaque modèle a son formulaire « Modifier » déplié (page d'environ 2 600 px). *`propositions/80-VISUEL-2/captures/modeles-filtres-famille-a-1280.png`* | La liste utile se perd entre les formulaires ; l'écran Équipe les replie déjà (`propositions/81-EQUIPE-1/captures/avertissement-desactivation-1280.png`). | Formulaires repliés, comme sur Équipe. |
| M12 | Fiches client et site ouvertes directement en saisie ; identité en haut sur le client, en bas et sans titre sur le site. *`propositions/48-FICHE-360-1/captures/fiche-client-1280.png`, `propositions/48-FICHE-360-1/captures/fiche-site-1280.png`* | Risque de modifier en lisant ; les deux fiches ne se lisent pas de la même façon. | Bloc d'identité titré et placé au même endroit sur les deux fiches. |
| M13 | « Le client a été prévenu par courriel » dans le style d'un avertissement (orange). *`propositions/47-AVERTISSEMENTS-1/captures/bandeau-deplacement-375.png`* | Une bonne nouvelle habillée en alerte. | Ton neutre ou vert pour une confirmation. |
| M14 | Après un refus, le message est en bandeau en haut ; le champ fautif n'est ni encadré ni focalisé. *`propositions/56-FORMULAIRES-2/captures/formulaire-apres-refus-1280.png`* | Sur un long formulaire, il faut chercher le champ en cause. | Champ fautif encadré, message sous lui, focus posé dessus. |
| M15 | Connexion sans logo ni couleurs de la marque ; « Révéler la clé » à l'enrôlement. *`connexion--clair--1280.png`, `enrolement--clair--1280.png`* | Rien ne confirme qu'on est au bon endroit ; « révéler » est un mot inhabituel. | Logo CODIPLAN sur la connexion ; « Afficher la clé ». |
| M16 | « Nature » dans les formulaires, « Type » dans le filtre du registre (« Tous les types ») et dans l'historique de la fiche machine. *`propositions/88-REGISTRE-5/captures/registre-filtre-1280-1280.png`, `propositions/99B-FICHE-MACHINE/captures/fiche-machine-vgp-depassee--1280.png`* | Deux mots pour une même donnée. | « Nature » partout. |
| M17 | Santé : « Quatre questions, quatre réponses » pour cinq lignes. *`sante--clair--1280.png`* | Un décompte faux sur une page de contrôle. | Retirer le décompte. |
| M18 | Paramètres (état du 18/09, à revérifier) : bouton « Enregistrer » coupé au bord droit des horaires d'agence à 1280 px ; page d'entrée des paramètres décalée. *`parametres-agences--clair--1280.png`, `parametres--clair--1280.png`* | Un bouton coupé semble inaccessible. | Revoir après la nouvelle prise de vue. |

### 2.4 Rejeu des scénarios A à F

| | Chemin actuel | Frictions | Verdict |
|---|---|---|---|
| **A** — Panne urgente | Planning → « Créer une intervention » → site (recherche), nature (à changer), priorité P1, panne → « Créer » → fiche → « Planifier » : date, heure, durée en minutes, technicien. Environ 12 gestes sur 3 écrans. Pour choisir un technicien libre, la fiche signale seulement un agenda bloqué (66-PLANNING-4), ni la charge ni les créneaux libres : il faut repasser par la vue Jour du planning, ou glisser la carte depuis « À planifier ». Aucune saisie de demande au bureau : l'ADV crée directement l'intervention. | B1, G2, G6, G1 | Faisable, avec un piège (la nature) et une urgence qui ne ressort pas. |
| **B** — Reporter de demain à la semaine suivante | Planning → repérer la carte de demain (tronquée : survol) → fiche → déplier « Déplacer » → ressaisir date, heure, durée → « Déplacer » (client et technicien prévenus par courriel). Environ 7 gestes, dont 3 saisies redondantes ; le glisser-déposer ne franchit pas la semaine. | G1, G3, G17 | Faisable, lent et propice aux erreurs. |
| **C** — Voir retards et attentes | Tableau de bord : « Dossiers bloqués » sans lien, priorités titrées par catégorie → Interventions → onglet « Bloquées ». Aucune capture ne montre d'intervention « en retard » (date passée, non commencée) ni de signal pour ce cas, hors VGP. La liste des suspendues ne montre ni pièce attendue, ni date prévue, ni ancienneté. | G7, G8, G6, M1, C4 | Partiel. |
| **D** — Valider puis corriger le temps | Interventions → onglet « À contrôler » → fiche → « Clôturer » (temps validé en minutes, pré-rempli par le compteur). Après clôture : « Seule son annulation reste possible ». | G5, G17 | Validation faisable (formulaire non vu en capture) ; correction impossible, par règle. |
| **E** — Historique d'une machine | Parc → recherche (n° de série, désignation, client) → panneau « Derniers événements » → « Fiche complète » → « Historique des interventions » : 4 gestes. Autres chemins : fiche site → équipement ; registre → recherche par n° de série. | G13, G14 | Faisable. |
| **F** — Import en masse | Imports → fichier → « Contrôler le fichier » → rapport → « Appliquer l'import » (annulable) : 3 gestes. Mais aucun modèle à télécharger, ordre des types non dit, motif de rejet vague. | B2, G16 | Bloqué pour un premier import sans modèle fourni par ailleurs. |

---

## 3. Gains rapides — moins d'une journée chacun

Dans l'ordre où le prompt du § 6 les applique. Aucun ne touche un point marqué ⚠.

| # | Gain | Constat | Maquette |
|---|---|---|---|
| GR1 | Création d'intervention : « Nature » sans valeur par défaut (option vide « — Choisir la nature — », champ requis), y compris depuis une demande. | B1 | neutre |
| GR2 | Fiche demande : « Créer une intervention depuis cette demande » en bouton plein, en tête du bloc ; l'ancien bouton devient « Marquer comme transformée » (contour), avec confirmation quand aucune intervention n'est issue de la demande. | G4 | neutre |
| GR3 | Clôture : sous « Temps validé », « Après clôture, ce temps ne se corrige plus » ; clic sur « Clôturer » → confirmation qui répète le temps en heures. | G5 | neutre |
| GR4 | « Déplacer » : date, heure de début et durée pré-remplies avec les valeurs actuelles. | G3 | neutre |
| GR5 | Une seule pastille de priorité, la même partout (file « À planifier », tableau de bord, registre, demandes, fiche), avec la correspondance déjà en place dans le registre (P1 rouge, P2 orange, P3 et P4 gris). | G6 | la palette reste ⚠ |
| GR6 | La tuile « Dossiers bloqués » compte toutes les suspendues (« dont N en attente de pièce ») et mène à l'onglet « Bloquées » ; dans le registre, la tuile « En attente » mène à l'onglet « Bloquées », la tuile « En cours » à l'onglet « En cours ». Aucun renommage. | G7, M1 | proche |
| GR7 | Tableau de bord : lignes de priorité titrées « panne signalée (à défaut la nature) — client », sous-ligne « n° · site ». | G8 | proche |
| GR8 | File « À planifier » : client en titre, panne ou nature en deuxième ligne, numéro provisoire en petit. | G2 | conforme |
| GR9 | Carte de la vue Semaine : la ligne heure + client ne se tronque jamais (deux lignes au plus). | G1 | neutre |
| GR10 | Parc : un libellé visible sur chacun des quatre filtres ; la ligne de résultat ne change pas (D126). | G13 | neutre |
| GR11 | Fiche client : colonne « Machine » (désignation + n° de série, lien) dans l'historique. | G14 | neutre |
| GR12 | Sites : titre de carte « Client — Site » ; « N sites sans équipement masqués · Afficher » ; « site » au lieu de « lieu » dans les boutons et titres. | G15 | conforme |
| GR13 | Téléphone, fiche intervention : action principale sous le titre (< 768 px) ; titre du bandeau sans le texte de la pastille. | G11 | neutre |
| GR14 | Durées affichées « 11 h 30 » partout ; libellés de saisie « (en minutes — ex. 90 = 1 h 30) ». | G17 | neutre |
| GR15 | Imports : « À importer après : … » sous chaque type ; motif de rejet qui nomme colonne et valeur quand le contrôle les connaît (sinon, chantier). | G16 | neutre |
| GR16 | Les neuf réécritures du tableau ci-dessous, et un astérisque réel sur les quatre champs obligatoires de la fiche machine. | G18 | neutre |
| GR17 | Finitions : montant selon la devise (M2) ; espace des titres de groupe (M3) ; « Demande — <client> » (M5) ; « Créer une intervention » en haut à droite à toutes les largeurs (M6) ; taux de charge en gras, rouge au-delà de 100 % (M7) ; « Non calculé » en texte courant (M8) ; bandeau VGP souligné, retour retiré, doublon retiré (M9) ; formulaires du Référentiel matériel repliés (M11) ; confirmation en ton neutre (M13) ; champ fautif encadré et focalisé (M14) ; logo sur la connexion et « Afficher la clé » (M15) ; « Nature » partout (M16) ; décompte de la page Santé (M17). | M2, M3, M5 à M9, M11, M13 à M17 | conforme |
| GR18 | Téléphone, registre : filtres repliés, liste d'abord (G10). Moins d'une journée, mais hors prompt : à passer seul, après GR13. | G10 | neutre |

**GR16 — neuf textes à réécrire** (clés de `lib/i18n/fr.ts`) :

| Clé | Aujourd'hui | Proposé |
|---|---|---|
| `clients.nouveau.sous_titre` | « La société vient de la session et n'est jamais une saisie. L'adresse de facturation n'est pas demandée ici… » | Supprimer : l'aide sous « Code Winpro » dit déjà l'essentiel. |
| `demande.sans_numero` | « Le numéro est attribué par le serveur à la première synchronisation. » | « Numéro provisoire » (comme la fiche intervention). |
| `absences.sous_titre` | « … la nature d'une indisponibilité regarde la médecine du travail, pas le planning. » | « Qui n'est pas disponible, et quand. Le motif ne se saisit pas ici. » (garde le sens de R3-14). |
| `imports.appliquer_aide` | « Écrit en base exactement les lignes montrées ci-dessus, et rien d'autre. » | « Importe les lignes nouvelles et modifiées ; les rejets ne sont pas importés. » |
| `enrolement.definitif`, `enrolement.reveler` | « Un second facteur s'active ; il ne se retire pas. Seul un administrateur de la plateforme peut le révoquer, sur demande. » ; « Révéler la clé » | « Une fois activé, ce code vous sera demandé à la connexion. Téléphone perdu : prévenez l'administrateur de la plateforme. » ; « Afficher la clé ». |
| `prestations.sans_checklist` | « La checklist type ne se saisit pas encore : personne n'a dit ce qu'elle porte… » | Supprimer. |
| `machine.nouvelle.sous_titre`, `machine.champ.numero_serie_aide` | « … (RG-PAR-02) … » | Le même texte, sans « (RG-PAR-02) ». |
| `intervention.refus.cloturee_figee` | « Cette intervention est clôturée : elle ne se modifie plus sans trace. Seule son annulation reste possible. » | « Clôturée : contenu et temps validé sont figés. Seule l'annulation reste possible. » |
| `intervention.deduit_du_lieu` | « Déduit du lieu d'intervention — cela ne se saisit pas. » | « Déduite du site. » |

---

## 4. Chantiers plus lourds

- **C1 — Rendre le planning lisible à 1280 px** ⚠. La semaine entière (choix de 82-PLANNING-6) et des cartes lisibles ne tiennent pas ensemble avec une barre de 272 px et une file de 290 px. Trois voies, toutes à arbitrer : replier la file « À planifier » en bandeau au-dessus de la grille ; rendre la barre latérale réductible ; carte « Semaine » réduite à client + nature + durée, site et matériel en infobulle (contredit la demande tenue par 37-AFFICHAGE-MATERIEL-1). Les deux maquettes posent la file à côté de la grille. *Bénéfice* : l'écran central se lit d'un regard ; identifier puis déplacer une intervention ne demande plus d'ouvrir les cartes une à une.
- **C2 — Modèles Excel téléchargeables**, un par type « Contrôle et application » (IMPORT-3, SAV-22) ⚠. L'application sait déjà écrire un `.xlsx` : le fichier des rejets. *Bénéfice* : le scénario F devient faisable par l'ADV seul, et les rejets pour en-tête mal orthographié disparaissent.
- **C3 — Une passe « écran étroit » sur les écrans du bureau** : registre (GR18), fiche intervention (au-delà de GR13), vue Jour (G12), tableau de bord, demandes, parc. Listes en cartes, action principale en tête, filtres repliés, aucun défilement horizontal. *Bénéfice* : le responsable SAV traite une urgence depuis son téléphone sans zoomer ni chercher.
- **C4 — Une file des suspendues outillée** : dans l'onglet « Bloquées », colonnes pièce attendue, disponibilité prévue, ancienneté (rouge au-delà de 30 jours), tri par ancienneté — c'est le bloc « File « en attente de pièce » — suivi dédié » de la maquette d'origine, et les données existent déjà (formulaire « Suspendre »). *Bénéfice* : le scénario C se lit en un écran ; les relances fournisseur partent de la bonne ligne.
- **C5 — Le rouge réservé à l'urgence** ⚠. Aujourd'hui, le rouge sert aussi aux compteurs d'équipements (PASTILLES-1) et aux actions refusées qui ne s'appliquent pas encore (« Qualifier : cette demande est déjà qualifiée », « Clôturer » avant la fin, G9). Proposition : rouge = urgent, en panne, dépassé ou erreur ; gris pour un compte ou un « pas encore » / « déjà fait ». *Bénéfice* : quand l'écran rougit, il y a quelque chose à faire.
- **C6 — Un seul modèle de retour** ⚠ : fil d'Ariane en haut à gauche sur toutes les fiches (Clients › Client › Site › Machine, Interventions › n°), demandé par SAV-00 ; 99I en couvre une partie. La maquette complète dessine un bouton « ← Retour au parc » sur la fiche machine : à arbitrer. *Bénéfice* : on sait toujours où l'on est et comment revenir sans perdre sa liste.
- **C7 — Une passe éditoriale de `lib/i18n/fr.ts`** au-delà des neuf textes de GR16 : une consigne d'action par aide, une phrase, aucune justification d'implémentation. *Bénéfice* : moins de lecture, des consignes qui ressortent.
- **C8 — (déjà prévu) Un numéro lisible pour les interventions** (NUMERO-1). Les « Local-… » occupent les titres de la file, du tableau de bord, des fiches et des bandeaux ; en attendant, GR7 et GR8 mettent le client en avant. *Bénéfice* : un numéro qu'on peut dicter au téléphone.

---

## 5. Ce que je n'ai pas pu évaluer

**Captures manquantes ou périmées**
- `docs/captures/` date du 18/09 (`bbf7e3c`). `accueil--*` montre un écran retiré depuis (99-ACCUEIL-1). Les images à 390 px montrent une barre latérale fixe qui mangeait l'écran : 19 écrans sur 27 débordaient en largeur (images de 400 à 1 093 px). Le menu ☰ a corrigé cela depuis ; le téléphone a été jugé sur les captures de lot à 375 px.
- Écrans absents de `docs/captures/`, jugés sur une capture de lot quand il en existait une : tableau de bord, demandes et fiche demande, registre des interventions, fiche intervention (refusée par le script), bon d'intervention, fiche machine, fiche site, création de machine.
- Sans aucune capture : le formulaire de clôture avec un temps mesuré (cœur du scénario D) ; le contenu de l'onglet « À contrôler » ; le tableau de bord, les demandes et le parc à 375 px ; la fiche intervention après 97A et, à 375 px, après 96B ; la création de site ; les paramètres habilitations, société, taux horaire, détail d'agence ; les imports après application et après annulation ; le portail (refusé par le script, et hors des trois profils).
- État du 18/09 seulement, à revérifier après la nouvelle prise de vue : imports, paramètres, liste des clients, familles VGP « à déterminer ».

**Ce qu'une image ne montre pas**
- Les gestes : glisser-déposer, infobulles, clavier, focus, lecteur d'écran, temps de chargement depuis la Nouvelle-Calédonie, messages d'erreur serveur ou réseau, courriels envoyés.
- Les volumes réels : le semis compte quatre techniciens et une poignée de clients ; avec 300 à 800 machines, parc et registre se comportent autrement, et les noms de clients réels sont plus longs.
- Les différences de menu selon le rôle (ADV, responsable SAV, responsable matériel) : les captures sont prises avec l'identité de démonstration.
- La notion « en retard » (intervention dont la date est passée sans avoir commencé) : aucune capture n'en montre, je ne peux pas dire si l'écran la signale.
- Le suivi par l'ADV jusqu'à « facturée » : aucun écran visible ne porte cet état ; je ne l'ai pas évalué, car ce serait une fonctionnalité.
- L'application technicien (`/terrain`) : hors du périmètre demandé.

**Artefacts de l'outil, non comptés comme défauts** : dates au format `mm/dd/yyyy` (navigateur de capture en anglais, voir `docs/captures/README.md`) ; « Choose File » ; barre latérale qui s'arrête à 900 px ou flotte au milieu d'une capture pleine page (élément fixe).

**Contraste** : mesuré sur quelques textes gris seulement (4,6 à 5,0:1, conforme de justesse) ; la petite taille (11 à 12,5 px) gêne davantage que la couleur.

**Écarts à la maquette ou choix déjà arbitrés, laissés tels quels** : barre latérale groupée au lieu de la barre haute à onze entrées (D121, D124, D125) ; entrée « Demandes » (D133) ; entrées inertes masquées (Contrats, Console éditeur) et « Fiche machine » hors menu ; contenu des lignes du parc (D126) ; titre « Fiche machine » (maquette complète) ; tuile « Demandes à valider : Sans objet » gardée par Alexis le 25/09 ; titre « Blocages d'agenda » (R3-14, question 99D-ABSENCES-2 ouverte) ; compteurs d'équipements en rouge (PASTILLES-1, en attente d'arbitrage) ; formule à côté de chaque taux d'occupation ; aucun verdict de conformité VGP (D88, D128) ; indication du glisser-déposer (99J, en file).

---

## 6. Prompt pour Claude Code — à coller dans une NOUVELLE session

À lancer **boucle de tickets à l'arrêt** : la session travaille dans le même dossier et sur les mêmes ports de test. De préférence après la publication de 99F à 99J, qui touchent le planning et la fiche intervention. Modèle : Sonnet.

```text
NOUVELLE SESSION CLAUDE CODE — CODIPLAN — lot ERGO-26-09 : gains rapides de l'audit d'ergonomie du 26/09/2026
Dossier : C:\Users\aplou\OneDrive\Bureau\Développement\CODIPLAN\depot — modèle Sonnet.

AVANT DE COMMENCER
1. Lis CLAUDE.md et docs/protocole-session.md : ils priment sur cette consigne.
2. La boucle de tickets doit rester à l'arrêt pendant toute la session (même dossier, mêmes ports de test). Si ..\battement.txt a changé depuis moins de 15 minutes, ou si un 11-FILE.sh tourne : arrête-toi et dis-le en une phrase.
3. git pull. Note dans la passation lesquels des lots 99F à 99J sont déjà sur main (git log --oneline | grep -E "99[F-J]-").
4. Copie ..\audit-ergonomie-26-09\audit-ergonomie-2026-09-26.md vers docs/audit-ergonomie-2026-09-26.md sans rien y changer, et commite-le seul : « docs : audit d'ergonomie indépendant du 26/09/2026 ». S'il est absent, arrête-toi et demande-le.
5. Lis les § 2 et 3 de cet audit : chaque gain y a son constat et ses captures de référence.

RÈGLES DU LOT
- Seulement les gains listés, dans l'ordre, un commit par gain, chacun prouvé par au moins un test (scène propre préfixée ERGO, créée et supprimée par l'épreuve ; jamais une fixture SCENE.* partagée).
- Aucune fonctionnalité nouvelle, aucune règle de gestion changée, aucun point marqué ⚠ dans l'audit : ils attendent Alexis.
- Tout texte visible passe par lib/i18n/fr.ts.
- Un gain qui contredit une décision écrite (docs/arbitrages.md, docblock d'un écran) : ne le fais pas, écris pourquoi dans la passation, passe au suivant.
- Captures : pour chaque écran touché ou créé, à 1280 et 375 px, AVANT et APRÈS, dans docs/propositions/ERGO-26-09/captures/.
- Une vérification rouge deux fois de suite : arrête-toi, résume le conflit, demande.
- pnpm format:check et pnpm test avant chaque commit. Sortie courte : une ligne par action.

LES GAINS, DANS CET ORDRE
GR1  Création d'intervention : « Nature » sans valeur par défaut — option vide « — Choisir la nature — », champ requis —, y compris depuis une demande.
GR2  Fiche demande : « Créer une intervention depuis cette demande » devient le bouton plein en tête du bloc ; l'ancien bouton devient « Marquer comme transformée » (contour) et demande confirmation (même dialogue que « Annuler ») quand aucune intervention n'est issue de la demande.
GR3  Clôture : sous « Temps validé », la phrase « Après clôture, ce temps ne se corrige plus » ; au clic sur « Clôturer », confirmation qui répète le temps en heures (« Clôturer avec 1 h 30 validées ? »).
GR4  « Déplacer » : date, heure de début et durée pré-remplies avec les valeurs actuelles de l'intervention.
GR5  Une seule pastille de priorité, la même partout (file « À planifier », tableau de bord, registre, demandes, fiche), avec la correspondance déjà en place dans le registre : P1 rouge, P2 orange, P3 et P4 gris.
GR6  Tableau de bord : la tuile « Dossiers bloqués » compte les mêmes interventions que l'onglet « Bloquées » du registre (toutes les suspendues), avec le détail « dont N en attente de pièce », et mène à cet onglet. Registre : la tuile « En attente » mène à l'onglet « Bloquées », la tuile « En cours » à l'onglet « En cours ». Aucun libellé renommé ; les tuiles gardent leur portée « sur tout le registre ».
GR7  Tableau de bord, « Priorités opérationnelles » : titre « panne signalée (à défaut la nature) — client », sous-ligne « n° · site ».
GR8  Planning, file « À planifier » : client en titre, panne ou nature en deuxième ligne, numéro provisoire en petit.
GR9  Planning, vue Semaine : la ligne heure + client d'une carte ne se tronque jamais (retour à la ligne, deux lignes au plus) ; les autres lignes gardent troncature et infobulle.
GR10 Parc : un libellé visible sur chacun des quatre filtres (Client, Site, Famille, Statut), au besoin sur une seconde rangée ; la ligne de résultat ne change pas (D126).
GR11 Fiche client : colonne « Machine » (désignation + n° de série, lien vers la fiche) dans l'historique des interventions.
GR12 Sites : titre de carte « Client — Site » ; sous les filtres, « N sites sans équipement masqués · Afficher » ; « site » au lieu de « lieu » dans les boutons et titres (« Nouveau site », « ← Tous les sites »).
GR13 Téléphone (< 768 px), fiche intervention : bloc de l'action principale juste sous le titre ; le titre du bandeau du haut ne reprend plus le texte de la pastille de statut.
GR14 Durées : affichage « 11 h 30 » partout (charge par technicien, trajets) ; libellés de saisie « (en minutes — ex. 90 = 1 h 30) ».
GR15 Imports : sous chaque type, « À importer après : … » ; le motif « une valeur manque ou n'est pas au format attendu » nomme la colonne et la valeur quand le contrôle les connaît (sinon : une ligne dans la passation).
GR16 Textes : les neuf réécritures du tableau GR16 de l'audit (§ 3), et un astérisque réel sur les quatre champs obligatoires de la fiche machine.
GR17 Finitions, dans cet ordre : montant selon la devise (« Montant (XPF) » ou « Montant en centimes — ex. 1 250 = 12,50 € ») ; espace au-dessus des titres de groupe de la barre ; titre d'une demande « Demande — <client> » ; « Créer une intervention » en haut à droite du planning à toutes les largeurs ; taux de charge en gras, rouge au-delà de 100 % (formule gardée) ; « Non calculé » en texte courant ; bandeau « famille à déterminer » souligné avec « → », « Échéance dépassée » une seule fois par ligne, retour « au parc » retiré du registre VGP ; formulaires « Modifier » du Référentiel matériel repliés comme sur Équipe ; « prévenu par courriel » en ton neutre ; champ fautif encadré et focalisé après un refus ; logo CODIPLAN sur la connexion et « Afficher la clé » ; « Nature » au lieu de « Type » ; décompte retiré de la page Santé.

FIN DE SESSION — même si des gains restent
1. CI=1 pnpm verify:full vert, puis git pull --rebase et publication directe sur main, sans proposition de fusion.
2. Passation dans docs/propositions/ERGO-26-09/passation.md — fait, pas fait et pourquoi, gains restants, empreintes des commits sur main — commitée et poussée.
3. DERNIÈRE ÉTAPE : relance la prise de vue en suivant docs/captures/README.md (base jetable, semis, lien de premier accès), puis pnpm exec tsx scripts/captures.mts. Vérifie que le README régénéré porte l'empreinte lue par git rev-parse HEAD et la date lue à l'horloge. Commite docs/captures/ seul — « captures : prise au commit <empreinte courte>, <date> » — et pousse. Ton message final, dix lignes, cite l'empreinte de ce commit.
```
