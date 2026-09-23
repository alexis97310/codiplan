# L'organisation du code

**Source de rang 1.** Ce texte était dans le `CLAUDE.md` ; il en a été détaché le
16/09/2026 par le ticket AT-05, **sans qu'une ligne change**. Son rang n'a pas bougé —
le noyau le dit, et le noyau nomme ce fichier dans son index : un fichier que le noyau
ne nommerait pas est un fichier que personne n'ouvrirait, et c'est gardé
(`tests/unit/docs/constitution-indexee.test.ts`).

La numérotation des sections ci-dessous est celle du `CLAUDE.md` d'avant la scission :
des gardiens la lisent, et la renuméroter aurait été une réécriture.

---

## 6. Organisation du code

**`(prévu)` marque ce qui n'existe pas encore.** L'arborescence dit deux choses de nature différente — ce qui EST et ce qui est PLANIFIÉ —, et sans cette marque le plan se fait passer pour un état. Elle rend les deux sens gardables : tout module non marqué doit exister, tout module qui existe doit être énuméré. Le jour où le module est écrit, la marque se retire avec le reste (`tests/unit/docs/organisation-du-code.test.ts`).

_Les numéros de ligne du sommaire sont RECALCULÉS, jamais saisis à la main : `pnpm sommaires:regenerer` les régénère depuis l'arborescence ci-dessous, et `tests/unit/docs/constitution-indexee.test.ts` les confronte au fichier réel dans les deux sens (DOC-2, 23/09/2026)._

### Sommaire

- `app/` — ligne 63
- `lib/` — ligne 68
- `lib/db/` — ligne 69
- `lib/auth/` — ligne 115
- `lib/absences/` — ligne 150
- `lib/clients/` — ligne 206
- `lib/habilitations/` — ligne 209
- `lib/contacts/` — ligne 217
- `lib/demandes/` — ligne 227
- `lib/agences/` — ligne 261
- `lib/sites/` — ligne 276
- `lib/machines/` — ligne 306
- `lib/interventions/` — ligne 357
- `lib/materiel/` — ligne 531
- `lib/tarification/` — ligne 564
- `lib/navigation/` — ligne 660
- `lib/money/` — ligne 696
- `lib/courriel/` — ligne 698
- `lib/compteurs/` — ligne 726
- `lib/calendar/` — ligne 745
- `lib/sync/` — ligne 771
- `lib/documents/` — ligne 772
- `lib/excel/` — ligne 798
- `lib/imports/` — ligne 856
- `lib/prestations/` — ligne 1008
- `lib/portail/` — ligne 1027
- `lib/pdf/` — ligne 1043
- `lib/reporting/` — ligne 1044
- `lib/vgp/` — ligne 1045
- `lib/techniciens/` — ligne 1098
- `lib/theme/` — ligne 1103
- `lib/i18n/` — ligne 1138
- `lib/tri/` — ligne 1141
- `components/` — ligne 1146
- `prisma/` — ligne 1147
- `tests/` — ligne 1148
- `docs/` — ligne 1167

---

```
app/
  (sans-session)/ (back-office)/  (mobile)/  (portail)/  (editeur)/  api/
              le premier groupe porte les écrans qui PRÉCÈDENT la session — il
              est la règle de R2-16 elle-même : ce qui décide qu'un écran n'a
              pas de barre est le répertoire où il vit, jamais une liste
lib/
  db/         client Prisma, contexte société, helpers RLS
              migrations-attendues.ts : ce que le CODE DÉPLOYÉ attend (panne du
              11/09) — le paquet de production n'embarque pas
              `prisma/migrations/`, d'où une recopie, et ce qui la confronte au
              répertoire est un gardien qui rougit dans les DEUX sens
              elle se GÉNÈRE depuis le répertoire, elle ne se rédige pas : la
              première rédaction, faite de mémoire, portait 18 noms inventés
              sante.ts : l'état de l'installation, pour la page SANS COMPTE
              /sante — il NE LÈVE JAMAIS : une sonde qui tombe en même temps
              que ce qu'elle surveille ne surveille rien
              et il ne rend aucun secret — ni hôte, ni base, ni identifiant :
              le message brut d'un pilote nomme l'hébergeur et la région (D50)
              « migrations à jour » CONFRONTE `_prisma_migrations` à ce que le
              dépôt attend, et ne se contente plus de chercher un ÉCHEC : une
              migration jamais appliquée n'a pas de ligne, et la sonde
              répondait « oui » (panne du 11/09)
              UNE LECTURE, DEUX RENDUS (R3-01) : `reponseMachine` rend le même
              état à `/api/sante`, pour le contrôle d'après déploiement — une
              seconde lecture écrite « pour la machine » serait la divergence
              du §9, et dans le pire sens, puisque c'est la machine qui décide
              si quelqu'un est prévenu
              `commitDeploye` est la SEULE lecture de la variable d'hébergeur
              qui nomme le commit, et elle rend `null` plutôt qu'une chaîne
              vide : « je ne sais pas » et « rien » ne se corrigent pas au
              même endroit
              `_prisma_migrations` porte UNE LIGNE PAR TENTATIVE, jamais une par
              migration : après un déblocage, le même nom y figure DEUX fois —
              l'essai annulé et l'essai réussi (mesuré le 11/09, 22:32:06 et
              22:32:09). L'ÉTAT D'UNE MIGRATION EST CELUI DE SA DERNIÈRE
              TENTATIVE, et `verdictDesMigrations` est la SEULE lecture de ce
              critère — la moitié « absente » était juste, et la réparer seule
              aurait laissé deux lectures dans la même fonction
              TROIS états et jamais deux : appliquée, EN ÉCHEC (elle bloque les
              suivantes, P3018), annulée (elle se rejoue toute seule). Les deux
              derniers étaient confondus sous « a échoué ou a été annulée », et
              ils n'appellent pas le même geste
              l'ÉCHEC est nommé AVANT l'absence, et l'ordre n'est pas
              arbitraire : une migration en échec empêche d'appliquer celles qui
              manquent, et nommer l'absence d'abord enverrait jouer un geste qui
              ne peut pas aboutir
              `app.client_id` est DÉSIGNÉE par l'appelant et VALIDÉE par la
              base dans la même transaction (D70) — jamais dérivée, la
              dérivation n'étant pas unique ; jamais crue, une désignation
              non validée ne bornant rien
              une désignation refusée LÈVE : un contexte vide rouvrirait la
              branche « utilisateur interne » de la forme « parc »
  auth/       authentification, et la DÉSIGNATION des cinq tables qui la portent
              annuaire.ts : les noms des personnes d'une société (R2-11), et
              depuis le 14/09 la SOMME qui dit pourquoi un nom manque — une
              `Map` n'a qu'une façon de ne pas répondre, et l'écran confondait
              le refus du cloisonnement avec son propre oubli
              (L1-02d) — `session`, `compte`, `verification`, `second_facteur`,
              `utilisateur` : chacune ne se lit qu'en NOMMANT sa ligne
              la surface HTTP est une liste close de chemins FERMÉS, jamais
              une liste de chemins ouverts (D58)
              amorcage.ts : l'ouverture du PREMIER compte (D65), et la
              RÉÉMISSION de son jeton (10/09) — son cliquet est un FAIT de
              `compte`, `mot_de_passe IS NULL`, que l'amorçage laisse et que
              le premier mot de passe choisi referme pour toujours
              premier-acces.ts : l'écran où l'on CHOISIT ce mot de passe —
              l'amorçage y redirigeait depuis le 09/09 et il RENDAIT 404
              (mesuré le 11/09) ; c'est la seule porte d'une base neuve, le
              seed n'attribuant aucun mot de passe
              les deux contrôles de SAISIE viennent avant le jeton : une
              discordance qui brûlerait le jeton coûterait un aller-retour
              humain, un lien de premier accès se transmettant hors bande
              un jeton inconnu et un jeton mort rendent LE MÊME refus (D35)
              enrolement.ts : la SEULE transition en libre-service (D58) —
              elle POSE, elle ne retire jamais ; les deux drapeaux y sont
              écrits par nous, la bibliothèque les désignant par un `id` que
              la politique ne reconnaît pas (L1-02f)
              arrivee.ts : ce qu'un écran a le droit de dire — qui vous êtes,
              pour quelle société, et rien d'autre
              societe-active.ts : `societesDuCompte` LIT ce que D61 et D67 ont
              ouvert, et l'ÉCRAN qui l'appelle est né le 10/09 — les deux
              politiques existaient depuis deux jours sans appelant, et un
              compte habilité sur deux sociétés n'atteignait aucun écran
              echange.ts : le REPORT d'une désignation à l'intérieur d'UNE
              requête (D64) — l'`id` par lequel la bibliothèque réécrit une
              ligne dit QUELLE ligne, la politique dit à QUI elle est ;
              l'`id` ouvre les écritures, JAMAIS les lectures
  absences/   UN BLOCAGE D'AGENDA (L3-04, L3-17, R3-14, RG-PLA-06)
              CODIPLAN N'EST PAS UN OUTIL RH *(arbitrage du 14/09/2026)* : une
              personne, une date de début, une date de fin, ET RIEN D'AUTRE —
              ni nature, ni motif, ni champ libre, ni historique de statut
              ~~le statut a TROIS valeurs et jamais un booléen~~ — `statut`, le
              type `StatutAbsence`, `motif`, `MotifAbsence` et `precision` sont
              SUPPRIMÉS : un cycle demandée → validée → refusée est un circuit
              d'approbation de congés, et `arret` était une donnée de santé sur
              un salarié nommé. La phrase est barrée et non effacée : elle a
              gouverné ce module, et ce qui a été décidé un jour se relit
              le blocage est donc IMMÉDIAT, et le coût est nommé : plus rien ne
              distingue une indisponibilité pressentie d'une indisponibilité
              arrêtée — qui pose la ligne l'arrête, qui se trompe la lève
              la table est de forme « INTERNE » (D94), et c'est décidé à sa
              NAISSANCE — le seul moment où cela ne coûte rien ; elle le reste
              après le dégraissage : savoir que telle personne n'est pas là du
              14 au 28 est une information sur une personne NOMMÉE, même
              dépouillée de sa cause
              periode.ts : la RÈGLE, qui ne lit ni base ni horloge — TOUTE ligne
              bloque, et c'est ce qui la rend plus sûre qu'avant : un critère à
              deux termes se recopie dans chaque lecteur, et une recopie qui
              oublie le second OUVRE en silence
              les bornes sont COMPRISES toutes les deux, une borne ouverte
              ferait travailler quelqu'un le dernier jour de son arrêt
              rupture-de-service.ts : L'ALERTE À EFFECTIF UNIQUE (L3-04a,
              RG-PLA-06, D106) — elle ne propose AUCUN créneau, et c'est une
              décision : *un moteur qui propose sur un effectif d'un ne propose
              rien*, et le planificateur sait ce que le système ne saura jamais
              la maille est l'agence de l'INTERVENTION, jamais celle de
              l'absent (D112) ni la société (D106) : compter par société ferait
              taire l'alerte à Koné parce que Ducos a du monde
              TROIS verdicts — « je ne sais pas combien cette agence a de
              monde » rendrait, sous deux valeurs, exactement ce que rend une
              agence bien pourvue : le silence
              l'ABSENT compte dans l'effectif : être absent quinze jours ne rend
              pas inactif, et le seuil « un seul » cesserait de dire ce qu'il dit
              un blocage ne déplanifie NI ce qui a eu lieu, NI ce qui n'occupe
              rien — et les deux motifs diffèrent : l'une n'a rien à rendre,
              l'autre a un fait à protéger (I5)
              `periodesBloquees` FUSIONNE avant de rendre (L3-17) : deux
              blocages qui se recouvrent ou se touchent n'en font qu'un, sans
              quoi le dénominateur du taux d'occupation les retrancherait deux
              fois et passerait sous zéro
              depot.ts : la POSE et la déplanification sont dans la MÊME
              transaction — un blocage dont les interventions seraient restées
              posées ferait affirmer au planning qu'un absent travaille
              ce qui part est la DATE et le CRÉNEAU, jamais le technicien : une
              intervention qui perd son affectation perd ce qui permet de la
              reposer au même endroit
              l'ORDRE des deux écritures est INDIFFÉRENT, et c'est MESURÉ : le
              verrou ne se lève que sur une date NON NULLE, or la
              déplanification écrit NULL — l'explication inverse avait été
              écrite d'abord, et mise en échec ensuite (§9, 08/09)
              lever un blocage ne rend RIEN : les interventions reparties en
              file ne savent plus où elles étaient, et le journal d'audit est le
              bon endroit pour l'histoire d'une ligne
  clients/    référentiel client (L1-01) — saisie Zod, dépôt cloisonné,
              libellé du code externe paramétrable par société (D29)
              la politique de `client` est de forme « parc », jamais société seule
  habilitations/ qualifications des techniciens (L1-04) — saisie Zod, et
              RG-PLA-04 : l'affectation est BLOQUÉE, jamais signalée
              rien n'est clos ici, à l'inverse des zones et des rôles de
              contact : une société suit des qualifications qu'aucune
              nomenclature ne connaît (D60). La liste réglementaire française
              est un AMORÇAGE du seed, pas une énumération
              la règle vit ici et non en base : elle dépend d'une date
              d'intervention que la base ne connaît pas encore
  contacts/   interlocuteurs d'un client (L1-03) — saisie Zod
              un contact appartient au CLIENT, le site est FACULTATIF : sans
              site, c'est un contact du client, et il ne disparaît PAS pour un
              compte portail restreint (le comptable survit à la restriction
              d'un atelier)
              les rôles et les canaux sont clos ICI et pas en base : une société
              tierce aura d'autres rôles, une énumération en base ferait de leur
              ajout une migration — le raisonnement des zones, en sens inverse
              `signataire` est un rôle de l'ensemble, jamais une colonne à part
              (RG-INT-04) ; aucun envoi n'est écrit ici, L1-03 pose la DONNÉE
  demandes/   LA DEMANDE D'INTERVENTION — le point d'entrée du flux (L2-06)
              la politique est de forme « parc » (D102), et c'est la SEULE table
              du lot 2 où un compte de PORTAIL ÉCRIT (chapitre 9, parcours P5) :
              la clause de société seule y aurait été plus qu'une fuite de
              lecture
              `site_id` est NOT NULL parce qu'il est la colonne de périmètre :
              une demande sans site serait invisible à celui qui l'a déposée
              elle ne porte AUCUN lien vers l'intervention qu'elle devient — le
              chapitre 11 met `demande_id` sur `intervention`, et l'écrire des
              deux côtés serait deux écritures d'un même fait
              cycle-de-vie.ts : il EXPLIQUE, la base GARDE — deux fins, et elles
              ne se ressemblent pas : devenir une intervention, ou être close
              AVEC son motif, qui mesure le service rendu à distance
              aucune ne se rouvre, et aucune ne revient à « nouvelle » : ce qui
              a été qualifié l'a été
              accuse.ts : le standard des 30 minutes, en heures ouvrées de
              l'agence (D13) — l'instant courant est un PARAMÈTRE, jamais une
              lecture, sinon un test vert dirait que l'horloge a bougé
              TROIS états, jamais un booléen : « sans réponse » n'est pas « hors
              délai », et les deux ne se corrigent pas pareil
              le départ du compteur est MATÉRIALISÉ sur la demande : un
              calendrier se modifie, et un départ recalculé bougerait des mois
              plus tard sans qu'aucune écriture ne le dise (le motif de D85)
              depot.ts : les cinq actions sous contexte cloisonné — aucune
              comparaison de société ni de client écrite au-dessus de la
              politique, ce serait une seconde lecture du même critère
              l'agence est DÉDUITE du site (D56) : sans elle, « en heures
              ouvrées de l'agence » n'a pas de sujet
              une agence SANS calendrier REFUSE — « inconnu » n'est pas
              « ouvert », et faire partir le compteur tout de suite promettrait
              une réponse sous 30 minutes un dimanche à 22 h (I7, RG-PLA-07)
              il ne CRÉE pas l'intervention : le lien vit sur
              `intervention.demande_id`, la colonne n'existe pas encore, et une
              transformation que rien ne peut relire est pire qu'une absente
  agences/    LE CHEMIN D'ÉCRITURE D'UNE AGENCE (AGENCE-1) — saisie Zod, dépôt
              cloisonné ; il n'en existait AUCUN hors du semis, et sur une base
              de PRODUCTION neuve (sans semis, par construction — I9), aucune
              agence ne pouvait naître
              une agence SANS calendrier n'ouvre jamais (I7) : `creerAgenceDans`
              écrit les DEUX lignes dans la MÊME transaction, calendrier
              d'abord — même ordre que le semis
              le calendrier neuf ne porte AUCUNE plage, et PARTAGE le code de
              l'agence plutôt que d'en recevoir un propre : les deux unicités
              `(societe_id, code)` mordent sur la MÊME valeur, si bien qu'un
              refus se lit comme UN SEUL motif quelle que soit la table qui a
              mordu — pas de `lib/calendriers/` séparé pour trois lignes qui
              n'ont qu'un seul appelant
              `code` n'est PAS modifiable : c'est la clé qu'un import résout et
              qu'un humain nomme au téléphone
  sites/      référentiel des sites d'intervention (L1-02) — saisie Zod, dépôt
              cloisonné, zones géographiques de D23
              `libellesDesSites` (L3-16) résout client et rattachement APRÈS la
              recherche, jamais dans sa requête : élargir le `select` mêlerait
              ce qu'on CHERCHE et ce qu'on AFFICHE, et l'écran suivant rouvrirait
              le critère
              la politique de `site` est de forme « parc » AVEC le filtre de
              périmètre : c'est la table où les trois filtres mordent ensemble,
              et le troisième est le seul qui sépare deux sites d'un même client
              l'énumération des zones est close ICI, à l'entrée serveur, et
              délibérément pas en base — six valeurs d'UN territoire
              trajet-zone.ts : LE DÉFAUT DE D23, CHIFFRÉ PAR D107 (R3-03) —
              six durées qui n'étaient écrites nulle part, et le §8 refuse
              d'inventer un délai
              ce sont des DÉFAUTS et jamais des constantes : `temps_trajet_zone`
              porte ce qu'une société en corrige, et une constante du dépôt
              ferait d'une correction de terrain une demande de fusion
              la CASCADE a trois étages et rend son ORIGINE — site, société,
              défaut : « 90 » sans son origine ferait revoir les mauvaises
              lignes le jour d'une correction (D56)
              retirer un réglage rend la main au DÉFAUT, jamais à zéro — zéro se
              lirait « l'établissement est sur place »
              `iles` ne porte AUCUN nombre (D107) et UNE SEULE source le tient :
              le schéma de saisie, la résolution et l'écran lisent
              `DEFAUTS_TRAJET_ZONE` — et la résolution rend `null` MÊME si une
              ligne existait, une garantie qui ne vit que dans la validation
              d'entrée n'en étant pas une
              le refus vit au SERVEUR et pas en base : un `CHECK` sur le nom de
              la zone écrirait la géographie calédonienne dans le schéma, ce que
              zones.ts refuse depuis D23 (R3-04)
  machines/   la fiche machine (L2-01) — saisie Zod, et les QUATRE champs
              obligatoires de D6 : modèle, client, site, numéro de série
              le numéro illisible se saisit `SN-INCONNU-<référence>` avec
              `complet = false` — JAMAIS `NULL` : deux `NULL` sont distincts
              pour un index unique, et une colonne nullable ferait de
              l'unicité une passoire sur les fiches les moins renseignées
              `complet` est DÉDUIT du numéro, jamais accepté depuis l'entrée
              ne fabrique NI `id`, NI `qr_token`, NI `numero` : les deux
              premiers naissent sur l'appareil (D7, I10), le troisième est
              attribué par le serveur — et personne ne l'attribue encore, le
              compteur par société venant avec la synchronisation
              qr.ts : le jeton est un SECRET, TIRÉ AU SORT (L2-02, D71) —
              130 bits, tous aléatoires ; `randomBytes`, jamais Math.random
              il ne DÉPEND DE RIEN qu'un tiers puisse connaître : ni l'`id`, ni
              le numéro de série, ni le client ne permettent de le prévoir
              hors ligne quand même (I4) : un tirage local n'exige aucun réseau
              — et n'exige pas non plus que l'`id` existe déjà, ce que les
              planches pré-générées de D7 réclamaient
              D7 se contredisait — « dérivé de l'UUID » et « jetons
              pré-générés avant le départ » ne peuvent pas être vrais
              ensemble ; D71 garde la moitié dont le recensement a besoin
              aucun test de DÉTERMINISME : leur disparition EST le ticket,
              un secret déterministe n'en est pas un
              depot.ts : LA LECTURE DU PARC (R2-21) — sous contexte cloisonné,
              forme « parc », et AUCUNE comparaison de société au-dessus : c'est
              ce qui fait que le même appel sert l'écran interne et le portail
              le résumé se compte SUR LES LIGNES RENDUES, jamais par une seconde
              requête — un bandeau qui compterait autrement que le tableau qu'il
              coiffe met les deux chiffres côte à côte sans dire lequel croire
              ni COMPTEUR ni CONTRAT : la maquette les montre, rien ne les
              porte, et une colonne vide dirait que la donnée manque là où un
              zéro dirait qu'elle vaut zéro (le motif de blocage de R2-13)
              historique.ts : L'HISTORIQUE SURVIT AU DÉMÉNAGEMENT (L2-05) — la
              lecture part de la MACHINE, et `site_id` n'apparaît dans AUCUN
              filtre : partir du site de la machine rendrait un historique
              amputé de tout ce qui précède le déménagement, SANS RIEN DIRE
              les sites traversés se DÉDUISENT de l'historique, aucune table ne
              les porte — une colonne « site précédent » serait une seconde
              écriture du même fait
              ce qu'elle ne dit pas est écrit : un déménagement SANS
              intervention entre les deux ne laisse aucune trace ici, et c'est
              le journal d'audit qui la porte
              resolution.ts : le contrôle de société de D22 n'est PAS écrit
              ici — on lit SOUS le contexte, et la politique décide ; une
              comparaison écrite au-dessus serait une seconde lecture du même
              critère, qui diverge en silence
              un jeton inconnu et le jeton d'une autre société rendent LA MÊME
              chose : les distinguer ferait un oracle (D35, D50)
              aucune vérification de FORME à la lecture — le jeton lu est une
              donnée STOCKÉE, et contrôler sa forme lierait les scans du jour à
              la génération du jour ; seule une borne de TAILLE demeure
  interventions/ l'ORDRE D'INTERVENTION et le planning agissant (lot 2, D84)
              pose.ts : les CONTRÔLES À LA POSE (R2-19) — il décide, il n'écrit
              rien et ne lit aucune base
              le calendrier qui décide est celui de L'AGENCE VISÉE, et d'elle
              seule : l'union affichée en vue semaine est un repère, jamais un
              droit de poser
              une agence SANS calendrier refuse — « inconnu » n'est pas
              « ouvert », et poser sans horaire connu promettrait un rendez-vous
              que personne ne peut tenir (I7)
              un chevauchement est une ERREUR, pas un avertissement : deux
              créneaux qui se TOUCHENT ne se chevauchent pas, une intervention
              annulée n'occupe plus rien, une clôturée si — elle a eu lieu
              saisie.ts : Zod sur toute entrée ; l'agence, le forfait de
              déplacement, le numéro et le statut NE SE SAISISSENT PAS — les
              deux premiers se déduisent du site, le troisième appartient à la
              synchronisation (I10), le quatrième au créneau
              cycle-de-vie.ts : ce qui est permis et ce qui est REFUSÉ, avec la
              raison écrite. Il ne GARDE rien — la base garde, par
              `intervention_cycle_de_vie` : une action refusée à l'écran mais
              acceptée par la base est un trou
              DEUX de ses quatre contraintes sont posées « NOT VALID »
              (D104) : elles valent pour toute ligne NOUVELLE ou MODIFIÉE, et
              les suspensions ANTÉRIEURES à L2-10 ne sont pas relues — elles
              n'ont pas de motif, et personne ne peut en énoncer un à leur
              place ; une DATE est pire encore, aucune valeur de date ne disant
              son propre inconnu, et celle qu'on écrirait deviendrait
              l'ancienneté que la file affiche
              une ligne ancienne qu'on TOUCHE doit se mettre en règle, et c'est
              le seul moment où quelqu'un est là pour dire le motif
              l'état non validé est VISIBLE et jamais tu :
              scripts/lib/contraintes-non-validees.ts, lu chaque nuit par
              « pnpm veille » et à chaque « pnpm verify » par un scénario
              d'isolation — sans quoi « NOT VALID » serait deux mots qui
              n'allument rien
              la SUSPENSION exige son motif (RG-INT-06, L2-10), et une
              intervention DÉJÀ suspendue ne se re-suspend pas : ce serait
              écraser `suspendue_le`, c'est-à-dire rajeunir l'attente que la
              file mesure
              la REPRISE rend le statut que le CRÉNEAU dicte, jamais celui
              d'avant — le planificateur a pu déplacer entre-temps, et c'est
              `statutALaCreation` qui décide, la même règle qu'à la naissance
              ce qui DÉSIGNE une attente de pièce est la RÉFÉRENCE, pas un code
              de motif : aucune énumération n'est inventée, le chapitre 10 n'en
              pose pas
              la reprise n'efface RIEN ici : le déclencheur
              `intervention_sortie_de_suspension` le fait, parce que les
              contraintes l'exigent déjà — l'effacer aussi en TypeScript serait
              une seconde lecture du même critère
              l'ANCIENNETÉ se compte en jours d'HORLOGE et non ouvrés : le
              fournisseur ne livre pas le samedi, mais la pièce n'arrive pas non
              plus — l'inverse du compteur d'accusé de réception (D13), et
              l'écart est délibéré
              annulee > cloturee, jamais l'inverse : I5 donne à l'annulation la
              préséance, et une intervention clôturée par erreur doit pouvoir
              être annulée
              LA MACHINE N'EST PLUS UNE COLONNE (L2-08a) : une visite en
              couvre plusieurs, et `intervention_machine` porte le rattachement
              — forme « filiation » (D103), dont le parent est l'INTERVENTION
              et jamais la machine : l'intervention décide QUI a le droit de
              voir la ligne, la machine est ce dont elle parle
              la politique fille ne recopie NI `app.client_id` NI
              `app.perimetre_sites` : les trois filtres se propagent depuis le
              parent, et un scénario le prouve en LISANT la clause
              RG-INT-01 est tenue par la base au passage en statut de TRAVAIL,
              jamais à la création : le dépannage à l'aveugle est le cas
              ordinaire, et exiger la machine d'emblée refuserait un appel
              trois statuts et pas un — la base garde des ÉTATS, pas des
              trajets ; un `INSERT` direct lui échappe, et la limite est écrite
              depot.ts : les cinq actions sous contexte cloisonné, forme
              « parc » (D84) — aucune comparaison de société écrite au-dessus
              de la politique, ce serait une seconde lecture du même critère
              l'instant courant se lit dans le FUSEAU DE L'AGENCE (L0-08), qui
              est celle qui décide du calendrier de référence (I7)
              le JOURNAL des déplacements n'est pas une table de plus : c'est
              `journal_audit`, par déclencheur, avec les valeurs avant et après
              compteur.ts : LA RÈGLE DU COMPTEUR (R5-02, D119) — elle ne lit
              ni base ni horloge, l'instant est un PARAMÈTRE
              DES SEGMENTS, JAMAIS UN COUPLE : *une pause est un fait*, et huit
              heures entre le premier départ et le dernier arrêt peuvent n'être
              que quatre heures de travail
              elle n'ARRONDIT rien — l'arrondi au quart d'heure et le plancher
              d'une heure restent dans la valorisation : arrondir deux fois
              ferait deux lectures d'un même critère, et la seconde déciderait
              du prix
              un compteur qui TOURNE ne compte pas dans le total et se rend à
              part : *un compteur qui tourne n'est pas un temps acquis*, et
              l'additionner ferait un total qui change tout seul (le motif de D85)
              DEUX GESTES et non trois : sur les segments, « pause » et
              « arrêt » ferment le même segment et rien d'autre — en offrir deux
              qui font la même chose serait mentir sur l'un des deux ; la
              distinction se rouvrira avec le STATUT, que D119 laisse ouvert
              depot-compteur.ts : les quatre actions sous contexte cloisonné —
              forme « interne » (D94), et aucune comparaison de société écrite
              au-dessus de la politique
              les segments lus sont ceux de la PERSONNE, toutes interventions
              confondues : lire ceux de la seule intervention visée laisserait
              démarrer un second compteur ailleurs, que la base refuserait
              ensuite par un index sans motif lisible
              il ne touche NI `statut`, NI `temps_reel_min` : les deux sont les
              questions ouvertes de D119, et un module qui y répondrait par
              accident les aurait tranchées
              statistiques.ts : la CHARGE par technicien — nombre, heures
              engagées, heures ouvrables, barre segmentée
              le type ne porte AUCUN pourcentage : `tauxOccupation` exige
              l'objet entier, si bien qu'un taux ne peut pas voyager sans ses
              deux termes (D56) — et l'écran affiche la FORMULE à côté
              un dénominateur nul rend `null`, jamais 0 % : « pas de
              calendrier » et « n'a rien fait » ne se corrigent pas pareil
              occupation.ts : le dénominateur vient du calendrier de l'AGENCE
              (I7) — d'où la maille (technicien, agence), une agence choisie
              en silence basculant d'une semaine à l'autre
              les ABSENCES VALIDÉES s'en retranchent (L3-17, RG-PLA-06), et
              leurs périodes sont FUSIONNÉES d'abord : un congé prolongé par un
              arrêt se recouvre, et retrancher deux fois les mêmes journées
              rendrait un dénominateur négatif — un taux au-dessus de 100 %
              sans elle, « il était absent » et « il n'a rien fait » rendent le
              même chiffre : c'est la troisième cause que ce module distingue,
              après « pas de calendrier » et « n'a rien fait »
              trajet.ts : LA LECTURE C de D107 (L3-05a) — l'ALLER vers le
              premier lieu de la journée, le RETOUR depuis le dernier, et RIEN
              entre les deux
              sur une journée à UN lieu elle donne exactement la lecture A, et
              c'est la raison décisive de D107 ; sur une journée groupée elle
              cesse de compter un retour à l'agence qui n'a pas eu lieu
              le temps d'un lieu à un autre n'est PAS compté et l'application
              l'ÉCRIT : la colonne ne porte que des durées depuis l'agence, et
              soustraire deux distances à un point commun n'est pas une distance
              il ne TRIE pas : l'ordre reçu est celui que l'écran affiche, et
              trier ici serait une seconde lecture de l'ordre
              une journée dont une EXTRÉMITÉ est inconnue se compte à part,
              jamais zéro — « aucun trajet » et « je ne sais pas » ne se
              corrigent pas au même endroit
              aucun fuseau n'est lu : `date_planifiee` est un DATE, et la
              rapporter à un fuseau la décalerait d'un cran sous UTC+11
              le trajet est un ARGUMENT OBLIGATOIRE de `occupationTechnicien` —
              un appelant qui l'oublierait ne compile pas (la leçon de D70)
              il entre dans le NUMÉRATEUR et jamais dans le dénominateur :
              rouler ne change pas les heures d'ouverture d'une agence
              montants-visibles.ts : QUI VOIT LA VALORISATION (D37, arbitrage
              3.8) — la ligne « voir les montants de vente » de la matrice du
              §5.2, qu'AUCUN écran ne lisait : la fiche affichait taux horaire,
              main-d'oeuvre, forfait, majoration et total à qui l'ouvrait
              ce n'était pas une fuite de cloisonnement — la ligne appartient
              bien à la société de l'appelant — c'était une RÈGLE ÉCRITE QUE
              RIEN N'APPLIQUAIT, et une règle qu'aucun code ne lit ne rougit
              jamais
              le critère se LIT de `niveau(role, ...)`, jamais recopié en
              `role === admin_societe` : une recopie de ligne de matrice
              deviendrait fausse au premier rôle qui change
              il prend un RÔLE et non un contexte — ce qui ne sert pas ne se
              demande pas, et un paramètre plus large ferait croire que la
              décision dépend de la personne
              CE N'EST PAS UN CONTRÔLE D'ACCÈS et il le dit : masquer un bloc
              n'empêche aucune requête, et le faire tenir par la base
              demanderait une quatorzième forme de politique sur des COLONNES
              — un arbitrage, nommé plutôt que commis en passant
              le bloc ne DISPARAÎT pas, il est remplacé par son motif : un bloc
              absent se lirait « pas de montant » là où il faut lire « ce n'est
              pas pour vous » (D88)
              personnes.ts : QUI le planning nomme, et COMMENT il le dit
              (14/09/2026) — `personnesANommer` fait l'UNION des identités des
              interventions ET de celles du référentiel : la vue jour tire ses
              colonnes du second depuis le 12/09, et la résolution des noms ne
              regardait que le premier
              *l'écran a gagné la colonne du technicien libre et lui a retiré
              son nom au même moment* — chaque moitié était juste, leur
              RENCONTRE était fausse, et aucune des deux ne la connaît
              le repli ne montre plus de fragment d'IDENTIFIANT : un UUID v7
              porte l'horodatage sur ses 48 bits de poids fort (I10), si bien
              que huit caractères sont LES MÊMES pour tout un semis — *un
              discriminant qui ne discrimine pas fait croire à une identité*
              « la politique refuse » et « je n'ai pas demandé » ne rendent plus
              la même chaîne : le premier est légitime et le reste, le second
              est une anomalie et se lit comme telle (le motif de D88)
  materiel/   familles et modèles de matériel (L1-05) — saisie Zod, et AUCUNE
              énumération : ni familles, ni marques, ni références. D4 est
              amendé — le mécanisme « référentiel de plateforme + copie
              masquante » est RETIRÉ, il se contredisait. Chez CODIMA les
              modèles viennent du fichier de suivi, pas d'un catalogue
              d'éditeur : ce sont des données saisies
              c'est le raisonnement des zones PRIS À L'ENVERS — les zones sont
              closes parce qu'elles ne bougeront pas, les familles bougeront à
              chaque société
              depot.ts : LE CHEMIN D'ÉCRITURE (L1-05b) — il n'en existait AUCUN
              pendant six jours, et c'était un ENCHAÎNEMENT : une machine exige
              un modèle (D6), un modèle exige une famille, et aucun des deux ne
              pouvait naître — le parc ne se remplissait que par le semis
              il n'écrit AUCUNE colonne de VGP, et ce n'est pas un oubli :
              l'assujettissement se déclare à la FAMILLE avec ses trois valeurs
              (L9-03), « soumis » exige la périodicité ET son texte (L9-04), le
              modèle PRÉCISE sans faire exception (L9-06) — une seconde entrée
              sur la même règle ne connaîtrait pas la première
              une famille naît donc « à déterminer », l'état que L9-03 a choisi
              pour qu'il ne se confonde pas avec « non soumise », et un scénario
              le RELIT en SQL plutôt que de le supposer
              l'ENTRETIEN du constructeur n'est pas la périodicité RÉGLEMENTAIRE,
              et l'écran le dit là où on le saisit : les mêler ferait facturer
              un entretien pour une vérification légale, ou l'inverse
              aucune SUPPRESSION : quatre clés étrangères retiennent une famille
              et deux un modèle, toutes en Restrict — proposer un bouton qui
              échoue huit fois sur dix est pire que de ne pas le proposer
              aucune comparaison de société n'est écrite au-dessus de la
              politique : une famille d'ailleurs et une famille inexistante
              rendent LE MÊME refus (D35, D50)
              l'unicité de ces deux tables est un INDEX et non une contrainte
              (mesuré) — un jumeau écrit en DROP CONSTRAINT échoue en 42704 au
              lieu de retirer le verrou
  tarification/ taux horaire HISTORISÉ par date d'effet (L1-07, RG-TAR-04)
              une intervention se facture au taux en vigueur à SA date : une
              facture qui change quand le tarif change est une facture fausse
              AUCUNE fonction « le taux courant » — elle serait juste
              aujourd'hui et fausse demain, et le premier appelant pressé la
              prendrait pour une intervention du mois dernier
              rend un Montant, jamais un nombre : entier, et avec sa devise
              ne combine RIEN — la composition d'un forfait et d'un taux n'est
              pas tranchée, elle est au registre
              valorisation.ts : RG-TAR-05 amendée par D83 et D89 — arrondi au
              quart d'heure SUPÉRIEUR, puis plancher d'UNE HEURE, appliqués UNE
              SEULE FOIS sur l'intervention entière et jamais tâche par tâche
              le plancher est PAR INTERVENTION, SANS EXCEPTION (D89) : deux
              interventions le même jour sur le même site font DEUX heures, y
              compris si la seconde achève la première — la variante « sauf
              reprise rattachée » est écrite au registre, pas construite
              ~~aucune fonction « valoriser une intervention » : le mode est
              décidé par l'appelant, la composition forfait + excédent n'étant
              pas tranchée~~ — **D77 L'A TRANCHÉE** (09/09) : un forfait
              s'AJOUTE toujours aux heures, et `valoriserIntervention` compose
              depuis L2-09a. La phrase est barrée et non effacée : elle a
              gouverné ce module, et ce qui a été décidé un jour se relit
              le plancher ne vise NI le forfait, NI le trajet, NI le travail
              interne, aucun n'étant facturé à l'heure
              le FORFAIT DE DÉPLACEMENT n'est pas un mode : il s'ajoute
              TOUJOURS (RG-INT-07) — et il n'entrait dans aucun total jusqu'à
              L2-09a, l'écran affichant « Total hors taxes » sur la
              main-d'œuvre seule
              un total qu'on ne sait pas calculer est `null` AVEC SON MOTIF,
              jamais zéro : une intervention au forfait se clôturait à ZÉRO, et
              zéro se lit « gratuit » là où il faut lire « je ne sais pas
              encore » — rien ne sélectionne de forfait de PRESTATION
              ~~la MAJORATION n'y est pas : son taux et son assiette sont
              écrits (D12), la BASE de son prorata ne l'est pas~~ — **D108 L'A
              TRANCHÉE** (12/09) : le prorata se lit sur le CRÉNEAU, et la
              majoration entre dans le total depuis L2-09b. La phrase est barrée
              et non effacée : elle a gouverné ce module
              majoration.ts : LA CONTRAINTE D'UN CRÉNEAU, PAS LES MINUTES
              TRAVAILLÉES (L2-09b, D12, D13, D108) — *le client a fait bloquer
              la soirée d'un technicien ; qu'il finisse tôt ne rend pas la
              soirée disponible*
              les deux bornes du créneau sont OBLIGATOIRES : un créneau absent
              traité comme « entièrement ouvert » rendrait ZÉRO là où il faut
              lire « je ne sais pas », et personne ne le verrait
              le calendrier arrive AVEC l'agence dont il provient, et une
              discordance LÈVE (D13) — `agence_id` de l'intervention est à
              portée de main, et ce n'est PAS elle qui décide (I7)
              ce n'est pas le calendrier de TRAVAIL du technicien : ce que la
              majoration paie est l'indisponibilité de l'ÉTABLISSEMENT, pas la
              disponibilité de la personne
              DEUX arrondis, et le second se fait sur le PREMIER : un client qui
              lit l'assiette doit pouvoir en prendre la moitié et retrouver le
              supplément — une arithmétique fausse à l'œil ouvre un litige
              qu'on ne saurait pas expliquer
              les QUATRE motifs sont prononcés ICI et nulle part ailleurs : le
              dépôt rapporte ce qu'il a observé, ce module décide
              la majoration est un ARGUMENT OBLIGATOIRE de
              `valoriserIntervention` — un appelant qui l'oublie ne compile pas
              (la leçon de D70), et un paramètre facultatif aurait valu zéro
              depot-forfaits.ts : LE CHEMIN D'ÉCRITURE du catalogue (R2-20) —
              « aucune condition » s'écrit NULL, et la SEULE écriture qui
              produise NULL est celle qui OMET la colonne : la contrainte
              refuse `{}`, et Prisma refuse `null` sur une liste scalaire
              d'où un refus NOMMÉ à la modification — omettre y veut dire « ne
              la change pas », et un succès qui ne fait pas ce qu'on lui a
              demandé est pire qu'un refus
              l'unicité qui a mordu se retrouve par une LECTURE après coup, et
              jamais dans l'erreur : `meta.target` nomme les colonnes hors du
              harnais et vaut `null` dedans (mesuré)
              aucune SUPPRESSION : une intervention désigne son forfait, et une
              facture émise sous un forfait disparu ne s'explique plus
              taux-initial.ts : le PREMIER taux d'une société, geste
              d'exploitation SÉPARÉ de l'amorçage (09/09) — refuse dès qu'un
              taux existe ; ni montant ni date codés ici, tous deux fournis
              forfaits.ts : RG-TAR-06, les trois axes d'un forfait (L1-06)
              l'ABSENCE de condition sur un axe n'est pas une condition qui
              échoue — un forfait sans zone s'applique partout, et c'est le cas
              majoritaire ; une valeur d'intervention absente face à une
              condition posée n'est PAS remplie
              le troisième axe est INERTE — les types d'intervention n'existent
              nulle part, le lot 2 les décidera ; la règle est écrite entière
              pour n'avoir pas à changer ce jour-là
              la liste des zones se LIT dans sites/zones.ts, jamais ne s'y
              recopie ; le catalogue naît VIDE, les valeurs sont à l'exploitation
              le RANG décide quand plusieurs conviennent (D86) : explicite,
              stocké, modifiable, le plus petit l'emporte — jamais l'ordre
              d'insertion, jamais l'alphabet d'un code
              l'égalité de rang est un état INTERDIT, refusé par la base sur
              (societe_id, type, rang) : le rang ne se compare qu'entre pairs
              « aucune condition » a DEUX écritures — `null` à la saisie, `[]`
              à la LECTURE — et les deux se lisent ICI
              en BASE c'est `NULL`, et le tableau vide est REFUSÉ : c'est PRISMA
              qui ne sait pas déclarer une liste scalaire nullable, et qui rend
              `[]` pour un `NULL`. La note disait « le tableau VIDE en base » —
              une limite de l'ORM prise pour une propriété de la base (mesuré
              le 11/09) ; qui écrira un forfait envoie `null`, jamais `[]`
  navigation/ LA BARRE À ONZE ENTRÉES de la maquette (D95)
              portes-parametrage.ts : les destinations de la section
              « Sociétés & tarifs » (R3-05) — elles vivent ici et non dans
              l'écran qui les rend : une liste de destinations est une DONNÉE ;
              et le gardien des chaînes en dur lit un fichier qui porte du JSX
              et prend ses littéraux pour du texte visible, ce qu'un tableau de
              routes n'est pas — il a raison de ne pas savoir, c'est la
              DESTINATION d'un texte qui décide (L0-11)
              elles ne portent AUCUN décompte : une pastille « 3 forfaits » se
              lirait comme une mesure, et il faudrait décider ce qu'elle affiche
              quand la lecture échoue (le motif de D88) — une porte dit où elle
              mène, pas ce qu'il y a derrière
              elle n'a AUCUNE entrée « Sites », et l'écran de L3-16 n'en reçoit
              donc pas : la liste est close et confrontée à la maquette, une
              douzième entrée la ferait rougir à raison
              cet écran se rejoint par un LIEN — depuis le lieu d'une
              intervention —, et c'est ce qui lui donne un appelant
              chrome.ts : ce qu'une mise en page a besoin de savoir pour
              peindre, LU UNE SEULE FOIS par rendu (R2-16) — la racine veut la
              société pour la charte, le segment veut le nom pour la pastille,
              et une mise en page ne transmet rien à celles qu'elle englobe
              elle ne lève jamais et n'accorde rien : une pastille absente
              n'est pas un refus, une barre affichée n'est pas une permission
              la barre est rendue par le SEGMENT et jamais par la racine — trois
              groupes de routes, `(sans-session)` sans barre, `(back-office)` et
              `(portail)` avec ; une liste de chemins tenue à la main oublierait
              le prochain écran d'authentification, un répertoire ne s'oublie pas
              la liste est CLOSE et confrontée à `docs/maquette/CODIPLAN_Maquette.html` :
              libellés et ordre compris — deux barres qui divergent, c'est la
              maquette qui a raison
              une entrée dont l'écran n'existe pas est INERTE, jamais absente
              et jamais un lien : un 404 dans une barre se lit comme une panne,
              une entrée manquante ment sur ce que le produit sera
              ce n'est JAMAIS un contrôle d'accès — masquer une entrée serait
              une seconde lecture d'un critère que la politique porte déjà, et
              c'est celle qui vieillit sans rougir
  money/      formatage et arithmétique — point de passage unique
              jamais de conversion : elle vit dans reporting/ (D19 amendé par D44)
  courriel/   LE CANAL D'ENVOI, derrière une interface ÉTROITE (Q8, 13/09/2026)
              trois types et une méthode : le choix du prestataire n'est pas une
              décision d'architecture, il se change le jour où une facture
              arrive — et ce jour-là rien d'autre ne doit bouger
              UN SEUL fichier connaît un prestataire, et un gardien l'exige :
              `resend.ts`, trente lignes de `fetch` plutôt que 200 Ko (§2)
              `Envoi` est une SOMME et jamais un `void` : un appelant ne peut pas
              ignorer la moitié « pas parti » sans que le compilateur le dise —
              le silence a exactement la forme du succès (§9), et un canal qui
              laisse croire qu'il a envoyé est pire qu'un canal absent
              LE CODE DÉMARRE SANS LA CLÉ : rien ne lève au chargement, et
              l'application tourne entière sur une installation où personne n'a
              rien déposé — c'est l'état de toute base neuve, celle-là même où
              l'on cherche à s'envoyer le premier lien
              ce qui échoue est l'ENVOI, et il NOMME la variable qui manque :
              une erreur vague fait chercher du côté du réseau pendant une heure
              ni pièce jointe, ni HTML, ni destinataires multiples — trois
              portes qu'on n'ouvre pas : un courriel d'authentification qui
              porte du HTML est un courriel qu'on apprend à ouvrir sans réfléchir
              AUCUN SECRET, pas même « de test », pas même en commentaire : le
              module ne connaît que des NOMS de variables (I9, dépôt public)
              premier-acces.ts : le courriel d'amorçage — son texte ne passe PAS
              par `lib/i18n/fr.ts`, la coupure de L0-11 se lisant sur la
              DESTINATION : ce n'est pas ce qu'un humain lit en se servant de
              l'application, c'est ce qu'on lui écrit avant qu'il puisse l'ouvrir
              il ne porte NI mot de passe, NI identifiant de société, NI nom de
              base : un courriel se transfère et s'imprime, tout ce qu'il porte
              est durable et hors de notre portée
  compteurs/  LES RELEVÉS, RÉORDONNÉS PAR LE TERRAIN (L2-03, question 3.12)
              regression.ts : l'ordre d'arrivée n'est PAS l'ordre des faits —
              un relevé fait à 8 h sans réseau arrive après un relevé de 10 h,
              et contrôler à l'arrivée signalerait une régression là où il n'y
              en a aucune, sans voir celle qui est là
              un relevé qui régresse est CONSERVÉ et SIGNALÉ, jamais refusé :
              I5 — le travail terrain n'est jamais perdu — et un compteur
              REMPLACÉ repart de zéro ; refuser rendrait impossible de saisir
              le premier relevé d'un compteur neuf, c'est-à-dire de dire vrai
              chaque couple (machine, type) est une SUITE À PART : les mélanger
              ferait de chaque nouvelle machine une régression
              le verdict est rendu pour TOUS les relevés, anomalie ou non —
              sinon « aucune anomalie » et « rien n'a été contrôlé » se lisent
              pareil
              à horodatage ÉGAL, l'ordre est celui de l'UUID v7 (I10), donc du
              temps de saisie : un tri instable rendrait le verdict dépendant
              de l'ordre d'arrivée, ce que 3.12 refuse
              aucune base ici : l'appelant seul sait sous quel contexte
              cloisonné il a lu ses relevés
  calendar/   calendriers d'agence, fériés, jours ouvrés — répond à « quand »
              technicien.ts : la RÈGLE DE PRIORITÉ de D72, écrite une seule fois
              (L3-01a) — horaires PROPRES s'il en a, sinon ceux de son agence ;
              fuseau, territoire, fériés et ponts TOUJOURS ceux de l'agence
              un technicien travaille le samedi par exception, il ne DÉCRÈTE pas
              les fériés de son territoire : c'est la ligne de partage de D46,
              appliquée à une personne au lieu d'une agence
              un technicien SANS rattachement rend `null`, jamais un calendrier
              vide — « inconnu » n'est pas « ouvert » (I7), et un calendrier
              sans plage se lirait « fermé toute la semaine »
              fuseaux IANA, instants UTC, récurrences déroulées à la lecture
              territoire ISO et fuseau : deux attributs de l'agence, jamais
              l'un déduit de l'autre (D46)
              seul endroit où la date courante se lit — et avec un fuseau (L0-08)
              parametrage.ts : horaires, jours travaillés, PAS DE CRÉNEAU —
              réglés par agence et jamais écrits dans un composant (I7)
              l'exception par technicien est un RATTACHEMENT à un autre
              calendrier, jamais une copie de plages : recopier ferait deux
              lectures d'un même critère
              et elle ne MAJORE rien — elle dit quand on travaille, pas à quel
              prix ; la majoration relève de RG-TAR et de l'agence du technicien
              une grille de créneaux ne DÉBORDE jamais sa plage : un dernier
              créneau à cheval sur la fermeture proposerait un rendez-vous que
              l'agence ne peut pas tenir
              jamais de règle de facturation : l'arrondi au quart d'heure
              appartient à la valorisation (D45)
  sync/       (prévu) protocole hors-ligne
  documents/  LA DOCUMENTATION DES MACHINES (lot 8, D87, D93, D94)
              la CIBLE est une SOMME, pas deux champs facultatifs : le modèle
              OU la machine, et le type refuse à la COMPILATION ce que la base
              refuse par `num_nonnulls(...) = 1` — deux verrous qui ne se
              recouvrent pas, aucun ne remplaçant l'autre
              propositions.ts : il PROPOSE, il ne classe JAMAIS seul — un
              rapprochement faux accroche la notice d'un compresseur à un pont
              élévateur, et personne ne le voit avant qu'un technicien suive la
              mauvaise procédure ; c'est de la sécurité, pas de la qualité de
              données
              le rapprochement se fait sur la CLÉ, jamais sur une ressemblance :
              aucune distance d'édition, aucun score, aucun « probablement »
              la tolérance porte sur la GRAPHIE d'une clé, jamais sur la clé
              AUCUNE proposition est une ISSUE, pas un rejet — le fichier reste
              à traiter, et l'œil lui donne sa cible
              les MODÈLES d'abord, et c'est une règle de PRÉSENTATION : le bac
              ne peut pas savoir ce qu'un fichier vise avant qu'on le lui dise
              depot.ts : la DÉDUPLICATION est lue dans un refus `P2002`, jamais
              prévenue par une lecture — entre un SELECT et un INSERT, un
              second dépôt du même fichier passe, et le bac est l'endroit même
              où l'on redépose
              la REPRISE n'a aucune table de session : l'état de la reprise est
              l'état du bac, et il n'y a pas de travail partiel à sauvegarder
              RIEN pour le stockage : `objet_cle` est fournie, jamais fabriquée
              — le module n'existe pas faute d'appelant, et une interface sans
              appelant est la maladie que le portail vient de soigner
  excel/      la GRAMMAIRE des fichiers d'import (L1-08, D31) — et elle seule
              format.ts : marqueur de version, dates, nombres, colonnes
              classeur.ts : LA LIAISON (L1-08c) — elle ne porte AUCUNE règle,
              c'est tout son objet ; L1-08a l'avait promis en écrivant la
              grammaire sur une grille abstraite
              elle rend une SÉRIE et non un `Date` : un `Date` est déjà une date
              valide, il a perdu ce qui permettait de la REFUSER — les trois
              refus de D31 deviendraient inexprimables
              le ZÉRO ne s'écarte pas là : la liaison le transpose, la grammaire
              le range en absence — écarter dans le transport mettrait une règle
              métier là où personne ne la relit
              controle.ts : le RAPPORT de I6, la moitié « d'abord » — il n'écrit
              rien, ne connaît aucune base, et ne sait pas appliquer
              mais il RETIENT ce qu'il décide (L1-08d) : une ligne par ligne
              lue, son action et ses valeurs — l'application ne peut appliquer
              que ce que le rapport a MONTRÉ, et un rapport qui ne retient rien
              ne fait rien appliquer
              les décomptes sont DÉRIVÉS des lignes, jamais comptés à côté :
              décider deux fois la même chose est la divergence du §9 (01/09)
              un gabarit et une ligne vide ne portent AUCUNE clé — leur en
              inventer une les ferait entrer dans l'espace des clés réelles, où
              deux lignes muettes deviendraient la même machine
              les trois refus PRÉCÈDENT toute ligne et ne comptent RIEN : un
              rapport qui proposerait des créations sous une colonne obligatoire
              absente proposerait d'écrire des fiches amputées
              le parc est un PARAMÈTRE, jamais une lecture : l'appelant seul sait
              sous quel contexte cloisonné il l'a obtenu
              le ZÉRO est une ABSENCE, jamais le 30 décembre 1899 : la
              bibliothèque rend cette date-là, et c'est ici qu'on l'écarte —
              171 cellules du fichier réel en dépendent, et les ranger sous
              « hors plage » ferait rejeter 171 machines
              un nombre lu ne rend JAMAIS un flottant : les chiffres et leur
              échelle, pour que I3 ne soit pas enfreint une ligne après nous
              une date se lit en UTC, jamais par un Date local — UTC+11 décale
              le jour d'un cran, et un import du 1er se rangerait au 31
              rend des CODES, jamais du texte : les libellés sont au
              dictionnaire, la coupure de L0-11 s'appliquant au rapport lu par
              un humain (I6, RG-IMP-01)
              rapprochement.ts : ce qu'une ligne DÉSIGNE, et ce qu'elle ne
              désigne pas — écrit contre les MESURES du fichier réel, jamais
              contre une idée de ce qu'un fichier contient d'habitude
              la clé tolère l'absence de série SANS fabriquer de doublon : les
              trois espaces de clés — série nue, référence préfixée `SN-INCONNU-`,
              rang préfixé `LIGNE-` — sont DISJOINTS, et c'est prouvé plutôt
              qu'espéré ; deux lignes muettes ne sont pas la même machine
              72 % de l'historique ne se rattache À RIEN et se reprend QUAND
              MÊME : « non rattachée » est une ISSUE, jamais un rejet — les
              écarter perdrait les trois quarts de l'historique
              le rapprochement se fait sur la CLÉ, jamais sur une ressemblance :
              un rattachement faux attribue une facture à la mauvaise machine,
              et plus personne ne saura qu'il était automatique
              une ligne de GABARIT n'est ni une donnée ni un vide — 652 lignes
              pour 55 codes réels, et les rejeter ferait 597 erreurs sur un
              fichier sain, c'est-à-dire la panne par le bruit
              le total du rapport EXPLIQUE chaque ligne lue : « non rattachée »
              et « incomplète » QUALIFIENT des lignes déjà comptées, elles ne
              s'additionnent pas — sinon le témoin dirait faux dans le sens
              rassurant
  imports/    LE MOTEUR D'IMPORT — ce que `excel/` a décidé, posé en base (L1-08e)
              televersement.ts : ce qu'un fichier doit ÊTRE avant d'être lu
              (L1-11) — il rend des octets, il ne lit AUCUN classeur : la
              grammaire vit dans `excel/`, et une seconde règle d'acceptation
              écrite ici la doublerait
              il vit dans un MODULE et non dans la route : une route de Next.js
              n'expose que ses verbes, et ce qu'on y écrirait serait
              inéprouvable sans démarrer un serveur — or ces refus sont
              précisément ce qu'un fichier hostile rencontre en premier
              la TAILLE est lue avant les octets : mesurer après avoir lu ferait
              entrer en mémoire exactement ce qu'on voulait refuser
              le plafond est MESURÉ contre le classeur réel (59 642 octets) et
              dit de combien il le dépasse — une borne posée sans mesure serait
              un chiffre inventé (§8)
              `Stream` n'est PAS admis : un flux se consomme une fois, et un
              classeur vide se lit comme un classeur sans données
              depot.ts : le LOT NAÎT AU CONTRÔLE, et le chapitre 11 le disait
              depuis l'origine — `import_lot.statut` vaut `controle`, `applique`
              ou `annule` ; I6 veut qu'un rapport précède la validation, et
              l'application ne peut appliquer que ce que le rapport a MONTRÉ
              il ÉCRIT, il ne décide RIEN : toute la décision a été prise par
              `excel/controle.ts`, qui ne connaît aucune base — recalculer ici
              serait une seconde lecture d'un même critère, et dans le pire
              endroit : entre ce qu'un humain a validé et ce qui sera écrit
              les décomptes viennent de `proposerDepuisLesLignes` et de lui
              seul ; ce module en a d'abord tenu un second, retiré plutôt que
              gardé par un test d'égalité
              aucune comparaison de société n'est écrite ici : la forme est
              « interne » (D100), et c'est la base qui prononce
              `valeurs_avant` est écrite par l'APPLICATION seule — avant elle,
              il n'y a rien à restaurer (D15)
              RIEN pour le stockage du fichier source : `objet_cle` existe et
              reste nulle, faute d'appelant — la maladie du portail, évitée
              il sait désormais RELIRE (L1-11) : `listerLesLots`, `lireLeLot` —
              *une couche qui écrit ce que personne ne relit est une couche dont
              on ne peut pas dire si elle écrit juste*
              l'AUTEUR est résolu DANS la transaction cloisonnée, seul endroit
              où la politique parle, et il rend la SOMME de `auth/annuaire.ts` :
              une Map n'a qu'une façon de ne pas répondre
              un lot d'une AUTRE société est « introuvable » et rien de plus —
              les distinguer ferait un oracle (D35, D50)
              types-dimport.ts : CE QU'ON SAIT FAIRE D'UN LOT, SELON SON TYPE
              (R6-01) — la table que L1-08i refusait, et qui n'en est pas une :
              elle est FERMÉE par un gardien contre les gabarits publiés et
              contre le TEXTE des sources, deux listes qu'elle ne contrôle pas
              quatre types sur cinq s'appliquent ; les CONTACTS restent au
              rapport seul, et le motif est mesuré — `lib/contacts/` n'a pas de
              dépôt, c'est L1-03b qui l'écrira
              un type sans application est un ÉTAT et jamais une exception :
              l'écran ne montre pas le bouton et DIT pourquoi ; *un bouton qui
              échoue se lit comme une panne du fichier*
              l'annulation ne se sépare JAMAIS de l'application : *une
              application sans annulation livrerait la moitié de I6*
              parc-cibles.ts : CE QUE LA BASE CONNAÎT DÉJÀ (R6-01) — et ce n'est
              PAS la question des trois autres `parc-*.ts`, qui disent ce qu'une
              CELLULE désigne ; celui-ci dit si la FICHE existe
              les confondre ne produit aucune erreur — *cela produit des
              DOUBLONS*, et seul le second passage du même fichier le révélerait
              les clés ne sont pas recalculées : `cleDuSite`, `cleDuModele` et
              `cleDeLaPrestation` sont celles que les gabarits appellent
              l'AMBIGUÏTÉ est possible sur les sites, et c'est MESURÉ : `site`
              ne porte AUCUN index unique sur (client, libellé), là où
              `modele_materiel` et `prestation` en ont un — une première
              rédaction lui en prêtait un, un scénario d'`upsert` l'a démentie
              modeles.ts : LES GABARITS QUE CODIPLAN PUBLIE (L1-09a), et eux
              seuls — deux sortes de fichiers ne se confondent pas : un gabarit
              tient ses colonnes de NOS schémas de saisie, un fichier de reprise
              les tient du fichier réel du client, qui n'est pas dans le dépôt
              chaque champ de saisie est EXPOSÉ ou ÉCARTÉ NOMMÉMENT, avec son
              motif : un champ écarté sans motif est un champ oublié, et rien
              ne les distingue
              `adresse_facturation` n'y est pas — le chapitre 11 ne lui fixe
              aucune forme, et l'aplatir dans un gabarit la figerait pour tous
              `actif` non plus : un import ne désactive pas, et une colonne
              « Actif » ferait d'un oubli de saisie une désactivation de masse
              le marqueur est DÉRIVÉ du modèle, jamais recopié
              un gabarit qui DÉSIGNE UN PARENT est une FONCTION du parc, jamais
              une constante (L1-09b) : savoir si « Garage Dupont » existe
              demande de regarder le parc, et passer celui-ci à chaque appel
              aurait changé le contrat pour les modèles qui ne désignent rien
              la MÊME clé que le gabarit du parent, jamais une seconde : une
              seconde règle de rapprochement se verrait au pire moment — des
              contacts accrochés au mauvais client
              « saisie refusée » et « parent introuvable » sont DEUX motifs :
              l'une se corrige dans le FICHIER, l'autre dans le PARC
              parc-agences.ts : une agence se rapproche par son CODE et JAMAIS
              par son libellé (D101) — `@@unique([societe_id, code])` fait du
              code une clé, le libellé n'en est pas une
              ce qui rend une clé utilisable n'est pas sa FORME, c'est ce que
              la BASE garantit d'elle : de là l'asymétrie entre l'agence (code
              seul), le client (code puis nom) et le site (client + libellé)
              un site rattaché à la mauvaise agence fausse le temps de trajet
              (D56), le calendrier de référence (I7) et la majoration
              parc-familles.ts : le MÊME motif que les agences, et il n'est PAS
              fusionné avec lui — ils partagent une forme, pas un critère : une
              fonction générique « indexer par code » ferait croire qu'un jour
              les deux changeront ensemble
              une cellule ILLISIBLE ne rend JAMAIS `undefined` : les schémas
              portent `.default(null)`, si bien qu'`undefined` déclenche le
              DÉFAUT — une faute de frappe deviendrait une absence en silence
              un gabarit ne REDIT aucune règle du schéma : « zéro n'est pas une
              périodicité » est écrit dans `materiel/saisie.ts`, et le modèle
              laisse le schéma juger
              parc-clients.ts : L'AMBIGUÏTÉ EST UN FAIT DU PARC (L1-08g) — deux
              fiches qui rendent la MÊME clé rendent indécidable ce qu'une ligne
              désigne, et RG-IMP-05 veut alors un REJET, jamais une création
              elle se lit d'une COLLISION, jamais d'une ressemblance
              une clé ambiguë est RETIRÉE de l'index et reste dans `cles` :
              laisser l'une des deux fiches ferait écraser celle-là plutôt que
              l'autre — un choix au hasard rendu stable par l'ordre de lecture
              la clé est calculée par la MÊME fonction que le contrôle : une
              variante ferait que RIEN ne se rapproche, et tout deviendrait
              création — le défaut même que L1-08f venait de réparer
              `actif` n'est PAS filtré : un client désactivé occupe toujours son
              code, et l'ignorer ferait qu'un import le recrée — un refus
              technique à la place d'un rapprochement
              application.ts : LA SECONDE MOITIÉ DE I6 (L1-08i) — elle
              n'applique QUE ce que le rapport a montré, et ne redécide RIEN :
              elle lit `import_lot_ligne.action` et l'exécute
              si elle recalculait, la validation humaine aurait porté sur un
              écran et l'écriture sur autre chose
              UNE SEULE TRANSACTION : une écriture par ligne laisserait, au
              premier incident, un lot « contrôlé » dont la moitié des fiches
              existe — un état que rien ne décrit et que l'annulation ne
              saurait pas défaire
              `valeurs_avant` se lit AVANT d'écrire : après, il est trop tard,
              et le journal d'audit porterait la seule trace — sur une table
              qu'aucune annulation ne lit
              le TYPE est dans le NOM (`…DeClients`) : une fonction « applique
              n'importe quel lot » tiendrait une liste close de plus, à la main,
              que le prochain type oublierait
              un lot introuvable et un lot d'une autre société rendent LE MÊME
              refus — les distinguer ferait un oracle (D35, D50)
              annulation.ts : PARTIELLE ET SÛRE (L1-08j, I6, D15, D54) — elle
              restaure ce qui peut l'être et refuse le reste AVEC SON MOTIF
              ni délai ni rang de lot (D54) : le critère ligne à ligne traite
              MIEUX le cas des imports qui se recouvrent
              « modifiée depuis » se CONSTATE en comparant, et la comparaison
              porte sur les seuls champs que l'import a écrits — il n'a pas
              touché le reste, il n'a rien à en dire
              « référencée depuis » est COMPTÉE avant, et ce n'est pas le choix
              qu'on ferait spontanément : une violation de contrainte ABANDONNE
              la transaction PostgreSQL entière (25P02, mesuré), si bien que
              lire le refus ferait cesser l'annulation d'être partielle
              ce que le comptage ne garantit pas est ÉCRIT : une référence née
              entre le comptage et la suppression fait échouer l'annulation
              ENTIÈRE — rien n'est défait à moitié, et on la rejoue
              JAMAIS DE SUPPRESSION EN CASCADE : ce qui référence la fiche la
              retient, et c'est la LIGNE qui est refusée
              un lot ANNULÉ garde sa date d'application — un lot annulé a bel
              et bien été appliqué, et l'effacer perdrait la seule trace du
              moment où le parc a changé
  prestations/ LE CATALOGUE DES PRESTATIONS (L1-12 ; D109, D113)
              UNE PRESTATION PORTE UNE DURÉE, JAMAIS UN TAUX — aucune colonne
              de montant, et un gardien statique le refuse sur les COLONNES du
              modèle, jamais sur ses commentaires : ceux-ci doivent au
              contraire nommer la règle, et un gardien qui les lirait rougirait
              sur la phrase qui l'énonce
              et elle ne DÉSIGNE aucun forfait (D113) : le pont de D109 passe
              par l'INTERVENTION, qui reçoit le sien par les trois axes de
              RG-TAR-06 — une clé étrangère ici aurait fait naître la question
              « et si le forfait désigné ne s'applique pas à la zone ? », qu'il
              aurait fallu arbitrer d'avance
              la FAMILLE est facultative : un déplacement, un diagnostic ou une
              formation n'en visent aucune — et son gabarit d'import est le
              premier dont le parent l'est, si bien qu'une cellule VIDE n'y est
              pas un parent introuvable
              la durée est NULLE tant que personne ne l'a estimée, et jamais
              zéro, qui dirait « instantané »
              aucune énumération de prestations : c'est le métier lui-même, et
              il bouge à chaque société — le raisonnement de materiel/
  portail/    le PORTAIL CLIENT, en CONSULTATION SEULE (L2-12, D92)
              rattachementsDuCompte lit la DIXIÈME forme de politique —
              « rattachement » : un compte lit SES rattachements SANS société
              active, ce que D10 rendait impossible en voulant les deux tables
              exclusives (mesuré : identité seule → 0 ligne, et 0 ligne dans
              `utilisateur_societe` — aucun compte portail n'atteignait rien)
              aucune comparaison de société ni de client n'est écrite ici : on
              lit SOUS le contexte, la forme « parc » décide, et une
              comparaison au-dessus serait une seconde lecture du même critère
              RIEN pour l'écriture : « demander une intervention » n'est pas
              tranché, donc ni construit NI PRÉPARÉ — pas de table qui
              l'attendrait, une place réservée étant une décision de personne
              les emplacements des documents (lot 8) et de l'état VGP (lot 9)
              sont TENUS et DITS VIDES — jamais un zéro ni un « à jour », qui
              se liraient comme des mesures ; « sans information » n'est ni
              l'un ni l'autre (D88)
  pdf/        (prévu) génération des rapports
  reporting/  SEULE zone autorisée à convertir des devises
  vgp/        le REGISTRE DES VÉRIFICATIONS PÉRIODIQUES (lot 9, D88)
              CODIPLAN N'AFFIRME JAMAIS LA CONFORMITÉ : les VGP sont commandées
              par les CLIENTS, et il n'apprend leur résultat que si on le lui
              dit. Aucune fonction ne rend un verdict ; le seul calcul est une
              DATE (L9-01)
              assujettissement.ts : TROIS valeurs sur la famille, jamais une
              case à cocher — une case décochée est indiscernable d'une famille
              jamais examinée, et un pont élévateur sortirait du registre en
              silence ; la naissance est « à déterminer »
              « soumis » exige la périodicité ET le texte qui la fonde : sans
              le texte, la périodicité est un chiffre indéfendable
              la CASCADE rend son ORIGINE avec sa valeur — le modèle PRÉCISE le
              rythme, la machine fait EXCEPTION sur la valeur, jamais l'inverse
              une exception sans motif est refusée, et un motif sans exception
              aussi : le second sens est celui qu'on oublie
              information.ts : « sans information depuis X » n'est NI « à jour »
              NI « en retard » — un registre à moitié rempli ressemble à un
              registre complet, et c'est le danger que D88 nomme
              aucune durée n'y est écrite : ni seuil, ni tolérance, ni
              « bientôt » — la périodicité est saisie, jamais inventée (§8)
              l'heure est un PARAMÈTRE, jamais une lecture : lue ici, elle
              rendrait un test vert parce que l'horloge a bougé
              verification.ts : CE QU'ON NOUS A DIT, et D'OÙ (D114) — un rapport
              de l'organisme, une vignette photographiée et une parole du client
              n'ont pas la même valeur le jour d'un contrôle, et l'origine NE SE
              RECONSTITUE PAS après coup
              l'origine est SANS DÉFAUT : une origine par défaut serait une
              valeur probante inventée, sur la ligne même qu'on produirait
              la date qui compte est celle de la VÉRIFICATION, jamais de la
              saisie — une vignette relevée aujourd'hui peut en porter une d'il
              y a onze mois, et c'est elle qui décide de l'échéance
              les observations s'écrivent AVEC la vérification, en une
              transaction : un rapport « avec » enregistré comme un rapport
              « sans » ferait disparaître du travail dû
              observations.ts : LE SEUL POINT OÙ CE LOT ALIMENTE LE PLANNING
              (L9-10) — et rien ne s'engendre tout seul : une intervention créée
              sans qu'on l'ait voulu part au planning et engage une visite
              le type est `controle_reglementaire`, qui existe depuis l'origine :
              inventer un type « vgp » aurait fermé une énumération de statuts
              sans arbitrage (§8)
              le client et le site sont REÇUS, jamais déduits de la machine :
              une machine dit où elle est aujourd'hui, une intervention dit où
              l'on va — et l'historique de L2-05 existe parce que les deux
              divergent au premier déménagement
              campagne.ts : UN objet daté, jamais deux cents alertes (L9-08) —
              un gardien dont on ignore les alertes coûte plus qu'il ne rapporte
              LE COMPTEUR N'EST PAS UNE COLONNE : il se DÉRIVE, parce qu'un
              compteur stocké se désynchronise en silence et qu'un compteur figé
              a l'air de mesurer
              une information ANTÉRIEURE à l'ouverture ne solde rien : c'est
              tout ce que la date d'ouverture sert à borner
              elle ne se clôt pas toute seule à zéro — une campagne close est
              une décision, et le compteur peut remonter
  techniciens/ créer, modifier, désactiver un technicien (ÉQUIPE-1) — les
              trois lignes (Utilisateur, UtilisateurSociete, Technicien) ;
              l'identité s'écrit par `avecDesignationAuth`
              (`lib/auth/lecture-identite.ts`), jamais réinventée ici — voir
              l'en-tête de `depot.ts`
  theme/      charte de la société active — couleurs, encres, variables CSS
              manifeste.ts : les DEUX couleurs que le manifeste d'application
              exige (L3-06) — un manifeste n'est pas une feuille de style, le
              navigateur le lit hors de tout document et ne peut pas résoudre
              `var(--app-marque)` ; elles sont ici parce que `lib/theme/` est le
              répertoire que le gardien de L0-09 désigne déjà, et qu'une
              exemption de plus aurait élargi la règle
              ce qui les confronte à `app/globals.css` est un gardien, jamais la
              relecture — avec le témoin que la variable existe, sinon la
              comparaison serait verte sur deux absences
              apparence.ts : L'APPARENCE du produit, à distinguer de la charte
              (D95) — la charte est une DONNÉE propre à une société, l'apparence
              est le socle sur lequel elle se pose
              aucune couleur n'y est écrite : les palettes sont déclarées dans
              `app/globals.css`, sous la seule forme qu'une feuille de style
              admet pour une couleur — la déclaration de variable
              un écran ne nomme jamais une couleur, il nomme un RÔLE : ajouter
              un thème, c'est un bloc de style et une entrée de liste, et
              aucun écran à rouvrir
              `CLASSES_LIEN` y vit pour la raison de `LARGEUR_UTILE_PX` :
              *un habillage écrit dans un écran est un habillage par écran*, et
              six liens en portaient quatre — visibles au SURVOL seulement,
              donc jamais sur un téléphone (mesuré le 14/09/2026)
              la maquette est MUETTE sur les liens — elle ne porte aucun `<a>`,
              tout y est un `<button>` — et l'écart s'écrit avec ce point précis
              PAS de sélecteur, et PAS d'apparence sombre : le premier serait un
              réglage sans usage tant qu'il n'y a qu'un thème, la seconde serait
              des couleurs que personne n'a validées
              statuts.ts : les couleurs des huit statuts d'intervention
              (annexe D, promue au rang de règle par le §1) — une RÈGLE du
              produit et non une charte : « en cours » est rouge chez tout le
              monde, c'est un code de lecture partagé, pas une préférence
              la lisibilité se CALCULE : seuil 4,5:1 (WCAG 2.1, 1.4.3 AA),
              garanti par le choix noir/blanc, qui plancher à √21 ≈ 4,58 (D51)
              seul endroit du code où une couleur s'écrit en clair
  i18n/       dictionnaire fr.ts — SEUL endroit où une chaîne visible s'écrit
              vocabulaire.ts : agence et site, définis une fois avec leur
              distinction (D5, D47) ; le code nomme la notion, pas le mot
  tri/        LE TRI ALPHANUMÉRIQUE DES LISTES DE RÉFÉRENTIEL (LISTES-1,
              23/09/2026) — un seul `Intl.Collator`, jamais un `ORDER BY`
              la base hébergée trie les majuscules d'abord, une collation
              mesurée à `psql` et que ce dépôt n'a ni les moyens de constater
              à distance ni le droit de changer sans migration (§8)
components/
prisma/       schema.prisma, migrations/, seed.ts
tests/
  unit/  isolation/  e2e/offline/   ← les trois derniers sont sanctuarisés
  isolation/migrations-sur-base-agee.test.ts : LES MIGRATIONS REJOUÉES CONTRE
              DES DONNÉES (11/09/2026) — `verify` migre une base VIDE puis
              sème, donc aucune migration n'était éprouvée contre des lignes
              préexistantes, le seul monde où elle s'applique vraiment
              il rejoue par `prisma migrate deploy`, le chemin de la
              production : `$executeRawUnsafe` refuse un lot multi-instructions
              (42601, mesuré), rejouer le SQL à la main était impossible
              il s'arrête avant chaque RESSERREMENT — contrainte validée,
              SET NOT NULL, index unique, colonne obligatoire sans défaut, et
              CHANGEMENT DE TYPE, celle qu'on oublie parce qu'elle ne ressemble
              pas à une contrainte — posé sur une table qu'une migration
              ANTÉRIEURE a créée
              une table VIDE au resserrement fait ÉCHOUER : une migration
              éprouvée contre rien n'est pas éprouvée, et c'est la faute que ce
              harnais a commise à sa première exécution
              la population est DÉRIVÉE du répertoire : une migration écrite
              demain y entre d'elle-même
docs/
  cahier-des-charges.md  arbitrages.md  backlog.md  guide-pilotage.md
  decisions/  maquette/
```

Le domaine métier est en français (`intervention`, `machine`, `societe`, `agence`), le code technique en anglais (`createIntervention`, `useSyncQueue`). Jamais mélangés dans un même identifiant.

---
