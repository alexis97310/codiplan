# Toutes les pages — découpage en tickets (lots TP)

*28/09/2026. Ce fichier accompagne `docs/audit-ergonomie-2026-09-28.md`. Il s'adresse au **pilote**, la conversation Cowork qui écrit les tickets de la file.*

Chaque ligne TP-A et TP-I9 devient un ticket ; dans les autres lots, chaque partie (S1, C1…) devient la partie d'un ticket regroupé de deux ou trois parties. Gabarit habituel :
- « OBLIGATOIRE : TU COMMITES » en tête ;
- `<!-- limite 150m -->` en ligne 3 (210m pour trois parties) ;
- LE CONSTAT mesuré, CE QUE TU FAIS, Territoire ;
- le bloc commun, de « INTERDITS » à « POUR FINIR » ;
- DEUX ROUGES ET TU T'ARRÊTES ;
- les captures AVANT et APRÈS ;
- une passation.

*Noms* : lots `TP-…`, questions `QT-1` à `QT-26`, constats `IN-`, `CS-`, `PV-`, `PA-`, `TR-`, `MO-` (preuves dans `constats/`). Aucun ne se confond avec D…, P…, L…, QG-…, PG-… ou AA-….

## Règles avant d'écrire un ticket

1. **Remesurer sur `main`** (clone, `git pull`) chaque fait cité. Les `fichier:ligne` datent de `bcc637e`. Ce qui a changé depuis ne donne pas de ticket, seulement une ligne dans la file des travaux. *Un rapport lu n'est pas une mesure.*
2. **Les verdicts `constats/VERIF-*.md` prévalent** sur les six rapports (gravités revues, doublons fusionnés, références corrigées).
3. **Un défaut « déduit »** (non vu en ligne) : le ticket COMMENCE par un test qui le reproduit. Si ce test ne rougit pas, le ticket s'arrête et le dit.
4. **Un ticket marqué ⚠ QT-x ne s'écrit qu'après la réponse d'Alexis.** Point d'arrêt §8 : règle métier absente, argent, schéma touchant statuts, devises ou `societe_id`, invariant, cloisonnement.
5. **Captures**
   - Tout ticket qui touche un écran dépose `docs/propositions/<ticket>/captures/` : AVANT et APRÈS, à 1280 et 375 px, avec un `README.md` (commit photographié, date).
   - Scène de démonstration uniquement, jamais une donnée de production (I9).
   - **Le ticket le dit en toutes lettres** : « prends des captures d'écran de chaque écran touché ou créé ».
6. **Jamais une valeur inventée** (durée, délai, taux, seuil, prix) : « valeur à fixer par Alexis ».
7. **Rien en parallèle de la file** : une seule session Claude Code, un seul dépôt, un seul jeu de ports de test.

---

## TP-0 — Les documents dans le dépôt (1 ticket, sans code)

| Ticket | Contenu | Preuve |
|---|---|---|
| **TP-0-DOCS** | Depuis le dossier `audit-ergonomie-28-09/` du PC : `audit-ergonomie-2026-09-28.md` → `docs/` ; `lots.md` → `docs/propositions/audit-2026-09-28/` ; `constats/*.md` (10 fichiers, README compris) → `docs/propositions/audit-2026-09-28/constats/`. Commit seul. | `git show --stat` : 12 fichiers, aucun fichier de code. |

## TP-A — Ce qui est faux à l'écran, sans décision à prendre (6 tickets, aucune migration)

| Ticket | Constats | Ce que tu fais | Territoire | Preuve |
|---|---|---|---|---|
| **TP-A1-HISTORIQUES-CLIENT-SITE** | CS29, CS9, PV-15, PV-05, CS12, IN-04 ≡ CS13 | (1) **Un seul ordre d'historique**, lu par un comparateur exporté : d'abord les interventions ouvertes sans date (« à traiter », par urgence puis ancienneté), puis la date décroissante. Appliqué à la fiche site (plus aucune « À planifier » coupée par la borne de 12), à la fiche client (les ouvertes sans date en page 1), à la fiche machine (ordre actuel commenté : Alexis confirme, PV-15) et à l'aperçu du parc. Le texte « celles qui restent à planifier en bas » est corrigé en conséquence. (2) Tuile « Interventions ouvertes » → ancre de l'historique, où les ouvertes sont en tête (le registre n'a pas de filtre client) ; « Équipements » → `/parc?client=` ou `/parc?site=`. (3) `/interventions/nouvelle?client=` : la recherche de site est limitée au client, et le site est présélectionné s'il est seul. Le lien sans préremplissage de FICHE-360-1 était un choix de périmètre, pas une décision. | `lib/interventions/depot.ts` (l. 2597-2602, 2743-2756), `lib/machines/historique.ts`, `app/(back-office)/{clients/[id],sites/[id],parc,interventions/nouvelle}/page.tsx`, `lib/i18n/fr.ts` | Test d'isolation : un site à 13 interventions datées et 2 sans date → les 2 sans date en tête. e2e : `?client=` limite la recherche. Captures des deux fiches. |
| **TP-A2-VGP-AFFICHAGE** (⚠ QT-13 pour l'ordre seulement) | CS30 ≡ PV-34, PV-30, PV-31, PV-33, PV-46, PV-22 (texte), PV-25 (texte) | (1) Tuile de la fiche site : la même lecture que la fiche machine (« Échéance dépassée depuis le … » en ton d'alerte, sinon « Prochaine échéance ») ; « — » distingue « aucune machine soumise » de « sans information ». (2) Registre : compte total et pagination (plus de coupe muette à 200) ; tuile et filtre « Sans information » (D88 §2). L'ordre du 25/09 est gardé sauf réponse contraire à QT-13. (3) Sur une ligne « Hors registre », « Enregistrer » est masqué pour une famille non soumise ; pour une famille « à déterminer », avertir « comptera si la famille devient soumise » (PV-33, choix à confirmer). (4) Date de vérification postérieure au jour civil de la société (son fuseau) refusée, avec un refus nommé — selon la réponse listée en fin du §7 de l'audit. (5) Retirer « Le scan ouvre directement la fiche autorisée » et le préfixe « CODIPLAN: » (écart de contenu nommé dans `lib/machines/ecarts-maquette.ts`, D128) ; retirer le sous-titre de « Corriger la fiche » qui renvoie à des gestes inexistants. | `lib/vgp/registre.ts`, `app/(back-office)/{sites/[id],vgp,parc/[id],parc/[id]/modifier}/page.tsx`, `components/vgp/formulaire-verification.tsx`, `lib/vgp/saisie-verification.ts`, `lib/i18n/fr.ts` | Test pur : échéance passée → état « dépassée » sur la fiche site. Test : date future refusée. e2e : pagination du registre. Captures. |
| **TP-A3-RAPPORT-IMPORT** | PA-53, PA-54, PA-55, PA-56, PA-48, PA-51, PA-58 | (1) La ligne « durée » ne dit « pas encore appliqué » que si le lot n'est pas appliqué ; sinon « non mesurée ». (2) Textes au passé après application. (3) Rejets regroupés par motif (nombre, correction à faire, lien « Télécharger les rejets »), le détail replié. (4) « Annuler ce lot » en bouton secondaire, avec une confirmation qui dit ce qui sera défait. (5) Le lien « Télécharger le modèle Excel » et le type « Contacts » sont masqués tant qu'ils ne font rien : écart nommé à la maquette (D128). MO-10 rouvrira « Contacts », IMPORT-3 le modèle Excel. (6) Lot introuvable : page avec titre et retour. | `app/(back-office)/imports/{page.tsx,[id]/page.tsx,presentation.ts,types.ts}`, `lib/i18n/fr.ts` | Test de présentation (appliqué et durée vide → pas « pas encore appliqué ») ; e2e : un lot de scène à 20 rejets de même motif → une ligne groupée. Captures. |
| **TP-A4-MESSAGES** | CS14 et TR-6 (message), TR-31, IN-22, IN-07, PV-36, IN-12, CS17, PA-05, PV-18, CS23, CS42, CS46, IN-03, PA-06, PV-45, PV-26 | (1) Un refus de **droit** a sa clé (« Votre rôle ne permet pas cette action »), distincte de l'échec de connexion ; « base injoignable » a la sienne. (2) Les trois motifs faux d'IN-22. (3) Période inversée → message, et non une liste vide. (4) Messages vides propres au filtre (VGP, registre). (5) Réussites en ton de confirmation, pas dans le cadre rouge. (6) Message après l'enregistrement d'une machine. (7) **Saisie gardée après un refus** sur les formulaires de création (client, site, interlocuteur, agence, forfait, vérification, intervention : demande d'origine et mode compris). (8) « Rien n'a été modifié » retiré quand on ne le sait pas. | routes qui rendent `auth.refus` pour un refus de droit, routes `app/api/interventions/[id]/{affecter,suspendre,cloturer}`, routes de création concernées, `lib/auth/connexion.ts`, `components/parc/formulaire-machine.tsx`, pages correspondantes, `lib/i18n/fr.ts` | Tests de route : chaque refus rend sa clé ; e2e : un refus garde la saisie (client, site). Captures des messages. |
| **TP-A5-LIBELLES** | PV-02, TR-53, TR-28, TR-54, TR-7, PA-24, PA-11, PA-18, PA-19 (texte), CS34, CS1, IN-23, IN-25 | (1) « Agence CODIMA » → « Agence » (écart de contenu nommé dans `lib/machines/ecarts-maquette.ts`, D128) ; « CODIMA » et « Winpro » retirés des textes affichés (portail compris), ou lus depuis la société. (2) Sous-titre du planning : « du 28/09 au 03/10/2026 · Glisser-déposer ». (3) Titre du calendrier des absences : les deux mois quand la semaine est à cheval. (4) « 30 min » une seule fois. (5) Statut « remplacé le … » sur un ancien taux. (6) « Retenu » seulement pour la nature que le calcul applique (le déplacement). (7) Phrase « Aucun forfait de déplacement pour cette zone : le déplacement n'est pas facturé » (affichage seul, aucun calcul changé). (8) « … et aux tournées » retiré. (9) Badge « Actif » / « Inactif ». (10) Historique repris : pas de « le compteur n'a pas encore tourné » sur une clôturée, « Reprise de l'archive » en bandeau, l'année affichée. (11) Libellé de la note interne. | `lib/i18n/fr.ts`, `app/(back-office)/{parc,parc/[id],planning,absences,parametres/trajets,parametres/taux-horaire,parametres/forfaits,clients,interventions/[id]}/…`, `app/(portail)/portail/page.tsx` | Test du dictionnaire : aucune valeur affichée (hors clés `vocabulaire.*.definition`, non affichées) ne contient « CODIMA » ni « Winpro » ; tests de rendu (sous-titre, mois). Captures. |
| **TP-A6-TRIS-MISE-EN-PAGE** | PV-06, PA-27, PA-39, TR-9, IN-46, PV-11, MO §2 (gardien) | (1) Aperçu du parc à 375 px : plus de débordement. (2) Agences inactives en fin de liste, grisées, sans réglage du pas. (3) Équipe et liste « Personne » triées par nom (LISTES-1), avec un choix vide. (4) Tableau de bord : annulées exclues d'« Interventions aujourd'hui » et d'« Urgences ». (5) Lien « Registre des vérifications périodiques » retiré du bas du parc. (6) Le gardien `pnpm chemins` regarde aussi `lib/vgp/*.ts` et les modules hors `depot*.ts`, avec la liste d'exemptions à jour. | `components/ui/maitre-detail.tsx`, `app/(back-office)/parametres/agences/…`, `lib/techniciens/depot.ts`, `lib/absences/ecran.ts`, `app/(back-office)/tableau-de-bord/page.tsx`, `scripts/lib/chemins-de-depot.ts` | Tests : tri de l'équipe ; tuile sans annulée ; `pnpm chemins` rougit sur une fonction VGP sans appelant, puis sa liste d'exemptions est justifiée. Captures. |

## TP-I9 — Données réelles dans le dépôt (1 ticket)

| Ticket | Constat | Ce que tu fais | Preuve |
|---|---|---|---|
| **TP-I9-NOMS-REELS** | CS28 (VERIF-CS-PV §5) : des raisons sociales présentées comme réelles (« mesurées en production », à confirmer par Alexis) figurent dans des commentaires (`lib/sites/depot.ts:452-453`, `lib/tri/collation.ts:12`, `lib/interventions/depot.ts:2540`, `app/api/recherche/sites/route.ts:28`, `lib/i18n/fr.ts:3778`), dans des tests (`tests/unit/tri/collation.test.ts`, `tests/e2e/historique-client.spec.ts`, `tests/unit/tableau-de-bord/presentation.test.ts`, `tests/e2e/creation-2.spec.ts`) et dans des passations | Les remplacer par des noms fictifs de la scène, en gardant ce que le test éprouve (accents, tri). Ne pas réécrire l'historique git : le dire à Alexis dans la passation. | `git grep` des noms relevés : zéro ; tests verts. |

## TP-S — Cloisonnement et sécurité (⚠ QT-2, QT-3 et décisions de fin du §7 de l'audit ; point d'arrêt ; 2 à 3 tickets ; **avant TP-ACC**)

Contenu selon la réponse (a) recommandée :

| Partie | Constats | Ce que tu fais |
|---|---|---|
| S1 lecture technicien | IN-06, PV-10, CS5, PA-01, TR-4 | Le technicien lit ce que RG-DRO-02 (amendée par D22) lui ouvre : ses interventions et leurs fiches, le parc des clients chez qui il a une intervention planifiée sous 7 jours, la résolution QR ; ni registre complet, ni chiffres de la société, ni tarifs, ni absences des autres. Il garde « Créer / modifier une machine » (§5.2), sauf réponse (b) à QT-2. Garde de page et de route, **et** politique RLS si la matrice l'exige (migration → geste d'Alexis). |
| S2 écriture du terrain | TR-23 | Toute route `app/api/terrain/[id]/*` vérifie que l'intervention est celle de la personne. Même règle dans les dépôts (`depot-compteur`, `depot-rapport-terrain`, photos, signature). |
| S3 droits d'écran | CS14, CS31, IN-29, PV-49, CS6, PA-02, PA-25 | Un écran n'offre que ce que le serveur accepte (`peut`, `peutPleinement`) ; « ○ » selon la réponse listée en fin du §7 ; agences sous `administrer_agences` ; ADV et trajets selon la réponse listée en fin du §7 (R3-03). |
| S4 import | PA-49 | Droits par type d'import, alignés sur les écrans (D130 pour clients et sites). |
| S5 demandes | IN-41 | Actions d'une demande sous « qualifier / affecter ». |
| S6 second facteur | TR-36, TR-34, TR-38, TR-37 | Secrets et codes de secours hors de l'URL (lecture unique côté serveur) ; saisie d'un code de secours à la connexion ; « Se déconnecter » sur l'enrôlement ; QR à l'enrôlement. |

Preuve : épreuves d'isolation « technicien A ne lit ni n'écrit l'intervention de B » (lecture, compteur, rapport, photos), « technicien : 403 sur le registre complet et sur les tarifs » ; e2e de l'enrôlement (l'URL ne contient aucun secret).

## TP-CY — Cycle de vie (⚠ QT-4, QT-5 et décisions de fin du §7 ; point d'arrêt ; migration (déclencheur du cycle de vie) ; 2 tickets ; avec ou après PG-G14 « Transmettre »)

| Partie | Constats | Ce que tu fais (réponse a) |
|---|---|---|
| C1 « Terminer » | IN-14 ≡ TR-21, IN-11 | Geste « Terminer » au terrain (En cours → Terminée, compteur fermé, garde RG-INT-02 : temps renseigné, checklist — 3.10 : pas de checklist = condition remplie) ; signature selon QT-5 ; bon disponible sur place ; « À contrôler » vivant. |
| C2 matrice D8 | IN-15, TR-19, IN-16 | Refus serveur **et** déclencheur alignés sur la matrice D8 : pas de suspension avant démarrage, pas de démarrage depuis « À planifier », clôture depuis « Terminée » seulement, clôturée terminale. Écran : blocs et boutons hors matrice retirés. **Ordre** : C1 avant C2, sinon aucune clôture n'est plus possible. |
| C3 compteur et pause | IN-17 ≡ TR-18, IN-18, TR-14, TR-20 | Clôturer ou annuler est refusé tant qu'un compteur tourne, avec le refus nommé « Un compteur tourne encore sur cette intervention » (aucune décision). Fermer plutôt le segment à l'instant de la clôture ou de l'annulation écrirait un temps facturé (D119, D120) : seulement si Alexis le choisit (fin du §7). La pause ouverte est fermée à l'annulation ; la journée du technicien masque les annulées ; le « vu » ne peut plus faire planter la fiche ; plus d'erreur 500 sur le rapport d'une intervention figée. |
| C4 annulation | IN-19 | Courriel au client et au technicien à l'annulation d'une intervention planifiée, selon la réponse d'Alexis (3.11, 3.19 ; fin du §7), par le mécanisme d'AVERTISSEMENTS-1. |

Preuve : épreuves de transition (table de D8 complète : permis et refusés) ; e2e compteur → terminer → clôturer.

## TP-TER — Terrain (1 à 2 tickets ; après TP-CY ; à fondre dans le lot « terrain » en file)

TR-22, PV-24, TR-16, TR-15, TR-24, TR-25 :
- fiche du technicien : panne signalée, créneau, contact cliquable, machine, priorité ;
- bandeau « compteur en cours » ;
- « Démarrer » affiché seulement quand il est permis, « Reprendre » sur une suspendue.

Captures à 375 px avec le compte technicien de la scène.

## TP-ACC — Accès des comptes (⚠ QT-1 ; §8 ; 1 à 2 tickets ; **après TP-S**)

TR-40, PA-36, MO-1, MO-15, TR-32, MO-16 :
- Sur Équipe : « Envoyer le lien d'accès » (administrateur de la société), qui crée le compte de connexion et émet le jeton par le courriel existant ; état « lien envoyé / accès activé » ; « Renvoyer » ; réémission pour un mot de passe oublié.
- Ensuite, les comptes de bureau (rôle choisi dans la liste de D37).
- Le geste d'amorçage est retiré comme D65 le prévoit (`tests/unit/auth/amorcage-retrait.test.ts`).
- Corriger le commentaire faux de `lib/techniciens/depot.ts:79-80`.

Preuve : e2e « un technicien créé dans Équipe se connecte, démarre et arrête son compteur ».

## TP-ARG — Argent (⚠ QT-6, QT-7, QT-8 ; point d'arrêt ; migration (forfait daté) ; 2 tickets)

- IN-01 : mode de valorisation choisi à la planification, modifiable jusqu'à la clôture, par les rôles qui qualifient (ADV, responsables, direction, administrateur).
- PA-03, PA-23 : montants figés à la clôture et lus figés par la fiche et le bon ; forfait historisé (date d'effet) comme le taux ; la nature d'un forfait déjà désigné ne change plus.
- PA-12 : texte de confirmation du taux antidaté, avec le nombre d'interventions non clôturées touchées.
- IN-35 : bon du client sans montant, bon interne à part.
- PA-20 : case « Cumulable » retirée (D77), selon la réponse listée en fin du §7.
- PA-04 : devise lue avec l'identifiant de la société.
- IN-24 : montant de l'archive.

Preuve : épreuve « changer le taux ou le forfait ne change pas le montant affiché d'une clôturée ».

## TP-VGP — Réserves et régime (⚠ QT-9, QT-13 et décisions de fin du §7 ; migration pour l'état des réserves ; 2 à 3 tickets)

- PV-43, MO-3 : vue « Réserves » du registre (machine, client — site, date, organisme, libellé, état) et « Créer l'intervention », une par une. Corriger d'abord `planifierLObservation` : une seule transaction pour la création et le lien.
- PV-41, PA-45, MO-29 : bloc « Familles à déterminer » dans le registre, avec « Décider le régime » (règle `schemaAssujettissementFamille`) et l'ouverture de la campagne existante ; exception motivée par machine (D88 §6) ; puis retrait de `/vgp/a-determiner`.
- PV-12 : fiche machine — états justes, date de la dernière information, « Enregistrer » pour une machine jamais renseignée, bloc « Vérifications reçues ».
- MO-12, PV-37 : filtres Client et Site ; vue groupée imprimable ; recherche étendue.
- PV-32 : clients inactifs hors du registre, selon la réponse listée en fin du §7 (D129 muet sur la VGP).
- PV-35 : horizon « à venir » unique (valeur à fixer par Alexis).

## TP-PARC — Gestes, QR, étiquette (⚠ QT-10, QT-11, QT-12 ; 2 tickets)

- PV-25, MO-8 : bloc « Gestes » de la fiche machine (changer l'état, transférer, remplacer, sortir du parc), tracés, et « Historique des états et des emplacements » ; option « Sorties du parc » sur `/parc` (PV-01). Retirer ensuite « Remplacée » et « Ferraillée » de la création (PV-27).
- PV-22, MO-4 : page d'atterrissage du scan, session exigée ; QR selon QT-10.
- PV-21, PV-23 : étiquette avec désignation et numéro de série (QT-11), sans la carte entière ; planche de plusieurs machines (`engendrerPlancheDeJetons`).
- PV-03, PV-08 : recherche sur la référence interne ; seuil des garanties fixé par Alexis, tuile cliquable, fin de garantie visible (PV-17).

## TP-CLI — Clients, sites, interlocuteurs (⚠ QT-16, QT-17, QT-18 ; 2 tickets)

- CS43 (bug, sans décision) : vider le courriel d'un interlocuteur → refus nommé au lieu d'une erreur serveur.
- CS44, QT-17 : courriel exigé du seul donneur d'ordre.
- CS45 : « qui est prévenu » sur les fiches.
- CS16, QT-16 : désactivation d'un client refusée tant qu'il a des interventions ouvertes, avec leur liste ; CS15, CS27 : l'état inactif signalé.
- CS40 : homonymes discernables (commune, code) ; un nom tapé sans choix → refus clair, saisie gardée.
- CS24 : jeton d'idempotence sur les créations (client, site, interlocuteur).
- CS2 : recherche sans accents, commune comprise.
- CS19 : tris LISTES-1.
- MO-11 : adresse du site selon QT-18, sur la fiche, le bon et le terrain.

## TP-ABS — Absences (⚠ QT-15, QT-23 ; 1 ticket ; avec PG-G15)

- TR-2, QT-15 : « Écourter » et un état par ligne (à venir, en cours, terminée).
- TR-3 : fenêtre du tableau des absences alignée sur la semaine naviguée, ou étendue.
- TR-8, QT-23 : la tuile.
- TR-5 : un technicien peut bloquer son propre agenda (R3-14), selon la réponse listée en fin du §7.
- MO-31 : « Déclarer une absence » depuis la ligne d'un technicien du planning (avec PG-G13).

**Coordination** : PG-G15 (« Absence » partout, environ 23 clés et le témoin des captures, et la demi-journée). D136 est absente de `docs/arbitrages.md` : la faire écrire par PG-G15 ou TP-ABS.

## TP-DEM — Demandes (⚠ QT-14 ; migration si (a) ; 1 ticket)

- Réponse (a) : « Créer une demande » depuis la suite à donner d'une intervention (source « détection technicien », lien vers l'intervention d'origine), et un onglet « Traitées ».
- Dans tous les cas : IN-42 (une demande transformée ne se réutilise pas), IN-43 (textes), IN-44 (aucun motif présélectionné), IN-40.

## TP-NAV — Navigation, hub, agences (⚠ QT-21, QT-22, QT-24 ; ⚠ disposition du hub (D125), forme du retour (C6 du 26/09), glossaire : décisions de fin du §7 ; 2 à 3 tickets)

- TR-48 à TR-51 : un seul modèle de retour (fil d'Ariane partout, « ← » seulement sans fil, `depuis` sur tous les points d'entrée), titres nommés.
- MO-27, PA-07 : hub en sections, sans les portes Clients et Sites ; titre selon QT-21 ; charte selon QT-22.
- MO-30, PA-27 à PA-35 : page « Agences » (liste, puis une fiche par agence : identité, horaires, fériés travaillés et ponts), adresses distinctes pour l'agence et le calendrier, territoire et fuseau choisis dans une liste.
- TR-44, QT-24 : « App technicien ».
- TR-52, TR-55 : glossaire d'affichage, et gardien du vocabulaire étendu aux synonymes.

## TP-MOD — Nouveaux écrans (⚠ QT-19, QT-20 ; 3 à 4 tickets)

- **À facturer** (FACTURE-1, QT-19) : onglet du registre gardé par `preparer_facturation` ; colonnes client, site, nature, date de clôture, temps validé, forfait, montant (avec le droit) ; export Excel ; « Marquer facturée » (n° et date de facture Winpro, migration). **Après TP-ACC et TP-CY.**
- **Indicateurs du mois** (QT-20) : décomptes seulement ; chaque chiffre vient de la même requête que la liste qu'il ouvre.
- **Données à compléter** (MO-7) : porte « Données » du hub.
- **Exporter** (MO-9) : registre, parc, registre VGP.
- **Import des contacts appliqué** (MO-10).
- **Plus tard** : « Mon compte », journal d'audit.

---

## Ordre global proposé (QT-26)

1. **TP-0-DOCS**, juste après le ticket en cours.
2. **La file du planning GMAO continue jusqu'à PG-G10** (fin de PG-C). On y intercale TP-A1 à TP-A6 puis TP-I9, un après chaque groupe PG.
3. **Le circuit** : DEPLANIFIEE-1 (à sa place, après PG-G10) → PG-G14 (avancé avant PG-G11 à G13 : revient sur l'ordre accepté le 27/09) → TP-S → TP-CY → TP-TER (avec le lot « terrain ») → TP-ACC → TP-ARG → « À facturer ».
4. **Ensuite** : PG-G11 à G13, PG-G15 avec TP-ABS, PG-G16, PG-G17 avec TP-PARC, puis TP-VGP, TP-CLI, TP-DEM, TP-NAV et le reste de TP-MOD.

## Ce qui NE doit PAS arriver

- Un compte de technicien ouvert (TP-ACC, ou tout autre chemin) **avant** TP-S.
- La matrice D8 appliquée (C2) avant « Terminer » (C1) : plus aucune clôture ne serait possible.
- Une migration publiée sans le geste d'Alexis (RELEASE-1).
- Une session Claude Code lancée à côté de la file.
- Un ticket qui « améliore aussi » un écran hors de son territoire.
- Une valeur inventée : seuil de garantie, horizon « à venir », priorité d'une intervention née d'une réserve, montants.
- Un test modifié pour faire passer un ticket, un invariant assoupli.
- Une donnée de production dans une capture, un test ou un document (I9).
