# Registre — journée du 9 septembre 2026 : le planning devient agissant

*Écrit au fil de l'eau. Chaque état ci-dessous a été observé dans le même geste que son écriture (§9, 07/09) ; les durées sont lues à l'horloge, jamais comptées en tours de parole (§9, 09/09).*

---

## 0 — CE QUE LA MESURE A CONTREDIT, ET QUI EST ÉCRIT PLUTÔT QUE TU

Cinq écarts entre la file de travail et l'état réel du dépôt. Aucun n'a arrêté la journée ; chacun a une voie qui restait ouverte, et c'est celle qui a été prise.

| Ce qui était écrit | Ce que la mesure rend | La voie prise |
| --- | --- | --- |
| Branche `claude/protocole-de-nuit-7qqhxh` | La consigne d'environnement assigne `claude/protocole-session-absent-79grtr` | La branche **assignée**. Pousser ailleurs est explicitement interdit. |
| Point de départ `docs/registres/2026-09-09-nuit-charte-et-ecrans.md` | **Le fichier n'existe pas.** Le registre le plus récent est `2026-09-11-nuit.md` | Repris depuis la section « Où reprendre » de celui-là. |
| « Les six écrans affichent » | **Quatre existaient**, et aucun n'était un planning. `/planning`, `/clients`, `/techniciens` et `/premier-acces` rendaient **404** — mesuré par requête sur l'application qui tourne | Les captures montrent ce qui existe ; le planning a été **construit**. |
| « L'agence impose le forfait de déplacement » | Les conditions d'un forfait portent sur la **zone**, la famille et le type — **jamais sur l'agence** (RG-TAR-06, D23), et le code le dit depuis L1-06 | Le forfait est déduit de la **zone du site**, par la règle déjà écrite et déjà éprouvée. L'utilisateur ne le saisit pas, ce qui était l'objet de la consigne. |
| « Lot 2 sur la base de D81 et D82 », « le gardien de non-portance (D80) » | **D80, D81 et D82 n'existent pas.** Le dernier arbitrage numéroté était D79 | La correction du §0 est écrite **sans numéro**, pour ne pas occuper l'un des trois. D83 et D84 prennent la suite. |

---

## 1 — CE QUI EST CONSTRUIT

### D83 — l'arrondi ET le plancher (c'est de l'argent)

RG-TAR-05 ne portait qu'un arrondi. D57 en avait tranché la **maille** — par intervention — sans jamais poser de plancher, si bien qu'une intervention de douze minutes se facturait un quart d'heure. **Les deux règles sont désormais écrites dans leur ordre, avec leur portée** : ni forfait, ni trajet, ni travail interne, aucun n'étant facturé à l'heure. Une intervention étalée sur deux jours reste **une** intervention.

**Le jumeau est double, et c'est le point.** *12 minutes facturent une heure* passe déjà si l'on n'a écrit que le plancher — l'arrondi y est invisible. *3 h 47 facturent 4 h 00* passe déjà si l'on n'a écrit que l'arrondi — le plancher ne mord pas à 227 minutes. Chacun est aveugle à la moitié que l'autre éprouve ; les deux mises en échec rejouent la règle amputée.

`lib/tarification/valorisation.ts`, `tests/unit/tarification/valorisation.test.ts`, D83, RG-TAR-05 réécrite, D57 marquée, L2-09 corrigée au backlog — sa ligne « cinq passages de cinq minutes font 1 h 15 » **cessait d'être vraie** et dit maintenant cinq heures.

### D84 — la table `intervention`, et sa forme de politique

Quatre nuits durant, rien du lot 2 n'avait été construit, et la raison n'était pas les colonnes : **la forme de politique d'`intervention` est un arbitrage de cloisonnement**. D84 la prend — forme **« parc »**, le plancher mesuré —, écrit son coût et sa **condition de réouverture**, et laisse la restriction des 7 jours de RG-DRO-02 applicative : dépendante de l'horloge, elle serait une dixième forme dont aucun jumeau ne peut mesurer deux fois le même verdict.

**La liste `TABLES_PARC` réclamait nommément cet arbitrage** — *« le jour où `intervention` rejoindra le parc, ce sera un arbitrage, pris au lot 2, jamais une ligne ajoutée en séance. »* C'est lui.

**Deux verrous de cycle de vie sont EN BASE**, pas seulement à l'écran : toute modification d'une intervention annulée ; toute modification d'une clôturée **autre que son annulation** — I5 donne à `ANNULEE` la préséance ; et la clôture sans temps saisi. *Une action refusée à l'écran mais acceptée par la base est un trou.*

### Le planning agissant — les cinq actions

Créer, affecter, déplacer, clôturer, annuler. **Ce qui NE se saisit pas est ce qui compte** : l'agence et le forfait de déplacement se déduisent du lieu, le numéro appartient à la synchronisation (I10), le statut au créneau.

Sur la fiche, **un refus prend la place de l'action**, en oxyde, avec sa raison — jamais un bouton grisé, qui laisse croire qu'il suffirait d'insister. La clôture montre **D83 décomposé** : 12 minutes saisies, 15 après arrondi, 1 h 00 après plancher, 8 500 XPF. *Un total seul donne le résultat sans donner la raison, et c'est ce qui fait douter d'une facture.*

**Le journal des déplacements n'est pas une table de plus** : c'est `journal_audit`, par déclencheur, avec les valeurs avant et après.

### Le paramétrage par agence

`calendrier.pas_creneau_minutes` — **par calendrier donc par agence** : rien ne dit que Ducos et Koné découpent leur journée pareil. `technicien_calendrier` — l'exception, qui est un **rattachement** à un autre calendrier, jamais une copie de plages. **Elle ne majore rien** : elle dit *quand* on travaille, jamais *à quel prix*.

**Une grille de créneaux ne déborde jamais sa plage** : le cas qui décide de sa justesse n'est pas celui où le pas divise la plage, c'est celui où il ne la divise pas.

### La mise en ligne

`pnpm db:deploy` — une commande, base neuve ou en service. `docs/mise-en-ligne.md` réécrite pour être suivie **depuis un téléphone** : huit gestes en tête, et pour chaque variable **ce qui casse quand elle manque**.

**`/sante`, sans compte**, dit en clair : base jointe, rôle applicatif, migrations à jour et laquelle manque, sociétés et comptes. **Elle ne tombe jamais avec ce qu'elle surveille** — jumeau mesuré : connexion pointée sur un port où rien n'écoute, la page rend **200** et dit « non » trois fois. Elle ne montre **jamais** d'hôte, de base ni d'identifiant.

### Les captures

**32 images** — huit écrans × deux thèmes × deux largeurs — produites en parcourant les chemins **réels**. Le thème sombre suit désormais la préférence du système : `.dark` était une classe que personne ne posait.

---

## 2 — VERT

| Porte | État |
| --- | --- |
| `pnpm test` | **971 scénarios**, 0 échec |
| `pnpm test:isolation` | **523 scénarios**, 0 échec |
| `pnpm typecheck` / `pnpm lint` / `format:check` | 0 erreur, 0 avertissement |
| `pnpm build` | passe, **19 routes** |

**CI verte sur `af22a91`** (run #353/#354, 20:13:34 → 20:19:01). Les runs des commits suivants étaient en cours à l'écriture de cette ligne.

---

## 3 — ROUGE, ET CE QUI A ÉTÉ RÉPARÉ EN CHEMIN

**Le seed était cassé et personne ne le savait** — `taux_horaire_defaut` manquant. Cause : un **client Prisma périmé**, pas le seed. Réparé par `prisma generate` ; rien à corriger au dépôt.

**Le `Maximum call stack size exceeded` du §9 (09/09) s'est reproduit, à la lettre.** `sousSociete` du harnais prend **deux** arguments, celle de la production en prend trois : passer un client Prisma là où un identifiant est attendu fait récurser Prisma sans fin. *Un message juste sur une cause fausse.* Le §9 le décrivait déjà ; le connaître n'a pas protégé de l'écrire.

**Cinq gardiens ont mordu, et chacun avait raison :**

1. `new Date()` dans le dépôt des interventions — l'heure est désormais lue **dans le fuseau de l'agence** (L0-08).
2. Le périmètre d'audit a **réclamé** `intervention` puis `technicien_calendrier` le jour de leur création, sans qu'aucune liste soit à compléter. C'est D55 en acte, pour la cinquième et la sixième fois.
3. Le vocabulaire imposé a refusé « site » et « agence » écrits dans le dictionnaire — le code nomme la **notion**.
4. Les couleurs de statut ont été **déplacées dans `lib/theme/`** : une couleur ne s'écrit en clair qu'à un seul endroit. C'est le gardien qui l'a dit, pas la relecture.
5. Le chapitre 11 a exigé d'être complété pour les deux tables nouvelles.

**DEUX ÉPREUVES ONT CHANGÉ DE CIBLE, et c'est le signe que le mécanisme sert.** `liste-parc` et `perimetre-audit` prenaient `intervention` pour exemple d'une addition **non arbitrée**. D84 l'a arbitrée : garder cette cible aurait fait **cesser les deux épreuves de rejouer une violation** — elles auraient mesuré un cas devenu légitime, **en restant vertes**. C'est le §9 du 11/09, rencontré en chemin. Les deux visent désormais `contrat`, qui n'existe pas.

---

## 4 — CE QUE J'AI TRANCHÉ MOI-MÊME, AVEC LA CONDITION DE RÉOUVERTURE

| Décision | Condition de réouverture, vérifiable sans être interprétée |
| --- | --- |
| **D84** — `intervention` prend la forme « parc » | *Le jour où un rôle de technicien reçoit un accès direct à l'API sans passer par nos points d'entrée serveur, ou le jour où l'exploitation demande que RG-DRO-02 morde en base, la dixième forme devient un arbitrage dû.* |
| **Le forfait est déduit de la ZONE du site**, non de l'agence | *Le jour où un forfait devra dépendre de l'agence, RG-TAR-06 gagnera un quatrième axe — et ce sera un amendement de la règle, pas un réglage.* |
| **Le premier forfait applicable l'emporte** | *Le jour où deux forfaits de déplacement se disputeront la même zone, ce sera un arbitrage, pas un `orderBy` choisi en séance.* |
| **Le plancher de D83 ne vise que le mode « temps passé »** | *Le jour où la composition forfait + heures excédentaires sera tranchée, la question du plancher sur l'excédent se posera avec elle.* |
| **La correction du §0 n'a pas de numéro** | *Sans objet : elle retire une instruction, elle n'arbitre rien.* |

---

## 5 — CE QUI EST LAISSÉ OUVERT SANS RÉPONSE PAR DÉFAUT DÉGUISÉE

**LE PLANCHER PAR INTERVENTION, OU PAR SITE ET PAR JOUR ?**

D83 pose le plancher et le laisse **par intervention**, c'est-à-dire par la maille déjà tranchée par D57 — et non par un choix nouveau.

**La conséquence chiffrée, mesurée :** deux interventions courtes sur le même site le même jour facturent **deux heures**. Sous la maille « site et jour », elles en factureraient **une**. *Un facteur deux sur un mode d'exploitation ordinaire : la tournée qui repasse l'après-midi finir le matin.*

**Ce n'est pas une modalité d'implémentation : c'est le prix que paie un client.** Aucune valeur par défaut n'est déguisée en réponse — le code applique la maille de D57, et le jour où l'exploitation répond « par site et par jour », c'est un **amendement de D83**, pas un réglage. Inscrit au registre de `docs/arbitrages.md` avec son déclencheur : la première facture réelle portant deux interventions le même jour sur le même site.

---

## 6 — CE QUI N'A PAS ÉTÉ FAIT, ET C'EST LA LIGNE FRANCHE

1. **La PWA n'est pas installable, et rien n'y prépare** — mesuré : ni `public/manifest.json`, ni agent de service, ni icône, ni répertoire `public/`. Ce n'est pas un réglage manquant, c'est le lot 3 (M7).
2. **Le moteur d'import n'a pas avancé d'une ligne** — cinquième journée. Le blocage tient toujours à un mot de l'exploitation sur la lecture du classeur.
3. **Le portail client en consultation n'a pas été construit.** La table `intervention` porte désormais la forme « parc », donc le cloisonnement qu'il exige est en place ; l'écran ne l'est pas.
4. **Les statistiques technicien n'ont pas été construites** — et un obstacle de fond les attend : la table `technicien` du chapitre 11 **n'existe pas**, et un taux d'occupation suppose de savoir qui est technicien et combien d'heures il doit.
5. **La base hébergée n'a pas été observée** — injoignable depuis une session, le mandataire ne relaie pas le TCP vers Neon. Aucun état de cette base n'est affirmé nulle part dans ce registre.
6. **Aucune migration n'a été appliquée à la base réelle.** Deux migrations sont écrites et appliquées **sur une base locale jetable seulement** : `20260909200000_intervention_l2_planning` et `20260909210000_parametrage_par_agence`.

---

## 7 — LES TROIS CHOSES QUE JE FERAIS ENSUITE

| Ce que je ferais | Ce qui la rend prête, ou non |
| --- | --- |
| **1. Le calendrier visuel du planning** (Schedule-X, imposé au §2) | **Prête.** Les créneaux, les jours travaillés et le pas sont en base et lus par `lib/calendar/parametrage.ts` ; les interventions portent leurs créneaux. Il ne manque que le composant. |
| **2. Le portail client en consultation seule** | **Prête pour le cloisonnement, pas pour la décision.** La forme « parc » est posée sur `intervention` (D84) et éprouvée. Mais **le bouton « demander une intervention » n'est pas tranché**, et la consigne dit de ne pas le construire : l'écran se ferait donc sans savoir s'il aura un bouton. |
| **3. La table `technicien`** (chapitre 11) | **Pas prête, et c'est un arbitrage.** D72 en dépend, les statistiques d'occupation en dépendent, l'affectation la nommerait plutôt qu'un identifiant d'utilisateur. Elle porte « coût horaire » et « taux de facturation par défaut » — deux montants que **personne n'a fixés**, et le §8 du CLAUDE.md interdit d'inventer un taux. |

---

## OÙ REPRENDRE

*Écrit en DERNIER et à la fin du fichier : une session neuve lit la fin d'un registre, pas son milieu.*

**L'état :** la branche `claude/protocole-session-absent-79grtr` porte tout le travail du jour, poussée. La proposition de fusion est **#85**. Arbre propre.

**Ce qu'une session neuve doit savoir avant de mesurer quoi que ce soit :**

- **La base hébergée est injoignable depuis une session** — `pnpm veille` sort en **75**, ce qui veut dire « je n'ai pas pu regarder », jamais « elle a dérivé ».
- **Le conteneur porte une `DATABASE_URL` d'environnement qui pointe sur Neon, et elle l'emporte sur `.env`.** C'est ce qui a produit deux fausses réparations aujourd'hui. Pour travailler en local : `service postgresql start`, une base jetable, et **passer `DATABASE_URL` explicitement à chaque commande** — le fichier ne suffit pas.
- **Le client Prisma se régénère après toute migration**, et le serveur de développement doit être **redémarré** ensuite : il garde le module chargé, et `tx.intervention` reste `undefined` sinon.

**Les deux premières choses à faire, dans cet ordre :**

1. **Appliquer les deux migrations du jour à la base réelle**, par le flux `db-migrate.yml` — elles ne sont passées que sur une base locale jetable.
2. **Répondre sur le plancher par site et par jour** (§5). Une phrase suffit, et elle change ce qu'un client paie.
