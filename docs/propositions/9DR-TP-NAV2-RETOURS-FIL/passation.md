# 9DR-TP-NAV2-RETOURS-FIL — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

**Un composant de fil unique**, `components/navigation/fil-d-ariane.tsx`, extrait de `components/mise-en-page/page.tsx` (qui ne le portait que pour les fiches client et site). Il rend le fil complet à partir de 901 px et, au téléphone, le réduit au seul PARENT immédiat précédé d'un chevron CSS (`before:content-['‹']`) — jamais écrit dans `lib/i18n/fr.ts`. Chaque lien, réduit ou complet, porte `min-h-[32px]` (reprise de la zone cliquable que 99B-FICHE-MACHINE avait déjà posée sur l'ancien retour de la fiche machine).

**Le fil est désormais posé sur** : les fiches client, site (corrigée — voir plus bas), machine, demande, d'un lot d'import, d'une agence, d'un calendrier d'agence, d'un forfait, et sur les huit sous-pages de `/parametres/*` (agences, trajets, forfaits, taux horaire, prestations, matériel, équipe, habilitations). Seize écrans portent un fil aujourd'hui, contre deux avant ce lot. Pour un exploitant, chaque fiche dit maintenant clairement où elle se range et quel écran l'a précédée, au lieu d'un lien de retour isolé dont le libellé ne correspondait pas toujours à la destination (TR-50).

**Correction d'un fil faux** : la fiche site affichait « Clients › <client> › <site> » alors que le menu allume « Sites » pour `/sites` — le premier maillon est désormais « Sites », avec le client comme second maillon.

**Un seul retour par écran** : partout où le fil remplace un ancien lien « ← … », ce lien a disparu plutôt que de doubler le premier maillon du fil. `RetourParametres` (composant et clé `parametres.retour`) est supprimé, de même que les clés `demandes.retour`, `forfaits.retour`, `machine.retour`, `calendrier.retour` et la clé déjà morte `planning.retour`. `clients.retour` et `agence.retour` survivent : ils servent encore `clients/nouveau` et `agences/nouvelle`, deux formulaires sans fil.

**`depuis` étendu** (TR-49) : la liste fermée `OrigineFiche` reçoit `tableau_de_bord` ; les trois listes de priorités du tableau de bord et les deux liens directs du planning vers la fiche intervention posent désormais `?depuis=…` explicitement, au lieu de retomber en silence sur « Retour au planning ».

**TR-51** : le `<h1>` et le titre d'onglet de la fiche intervention nomment désormais le client — « <client> — Intervention <référence> » — via `titreDeLaFiche`, appelée des deux côtés pour ne jamais diverger.

**TR-47** : le bouton de menu du bandeau mobile passe de 36 px (`h-9 w-9`) à 44 px (`h-11 w-11`).

**D168** (`docs/arbitrages.md`) consigne cette décision et revient explicitement sur D122.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- Fiches/sous-pages portant un fil d'Ariane : **2 → 16**.
- Clés `*.retour*` du dictionnaire commençant par « ← » : **19 → 13** (6 supprimées : `demandes.retour`, `forfaits.retour`, `machine.retour`, `calendrier.retour`, `parametres.retour`, et `planning.retour` qui n'avait aucune mention AVANT ce lot non plus — déjà morte).
- Bouton de menu mobile : **36 px → 44 px** (`h-9 w-9` → `h-11 w-11`), mesuré par un test de rendu (`tests/unit/navigation/bandeau-mobile-bouton-44px.test.tsx`).
- Suite complète : `pnpm test` **4088/4088** verts, `pnpm test:isolation` **1449/1449** verts, `pnpm typecheck`/`pnpm lint`/`pnpm format:check`/`pnpm build` verts.
- e2e : les cinq fichiers que ce lot touche directement ou dont le texte attendu aurait pu changer (`liens-3.spec.ts`, `retour-parametres.spec.ts`, `fiche-360-1.spec.ts`, `fiche-intervention.spec.ts`, `tableau-de-bord-liens-tuiles.spec.ts`, `ecrans-largeur-utile.spec.ts`, `liens-2.spec.ts`, `9dg-tp-s1-lecture-technicien.spec.ts`) + le nouveau `9dr-fil-d-ariane.spec.ts` + le smoke test `tous-les-ecrans-rendent.spec.ts` (47 passés, 3 ignorés pour une raison préexistante sans rapport avec ce lot) — **tous verts**, voir « ce que je n'ai pas fait » pour ce qui manque à cette liste.

Pas de capture AVANT/APRÈS produite (voir plus bas, « ce que je n'ai pas fait »).

## Ce que j'ai tranché et pourquoi

- **La fiche intervention garde son retour nu contextuel** (`retourFiche`, les six clés `intervention.retour.*` et `planning.retour_fleche`) plutôt que de la convertir en un fil à trois ou quatre niveaux. Le mécanisme existant est déjà dynamique (sept origines possibles selon `depuis`) et solidement éprouvé par `tests/unit/interventions/retour-demande-absences.test.ts` et `tests/e2e/fiche-intervention.spec.ts` ; le convertir aurait exigé de nouvelles clés, un nouveau calcul à plusieurs niveaux (client ? site ? origine ?) et la réécriture de ces deux fichiers de tests, pour un gain incertain tant que personne n'a dessiné la forme exacte attendue. Nommé dans D168, laissé explicitement au ticket suivant.
- **`depuis` n'est pas étendu aux liens vers la fiche MACHINE** (depuis un site, un client, une intervention, le registre VGP) ni aux formulaires de création. La fiche machine n'a aujourd'hui qu'un mécanisme d'origine pour revenir au PARC filtré (`retourVersParc`), pas pour revenir à un client ou un site d'origine : lui ajouter cette capacité est un travail à part, nommé pour le ticket suivant plutôt que bâclé ici.
- **Les libellés des deuxième et troisième maillons des fils de Paramètres réutilisent le `titre` déjà affiché par chaque écran** (ex. `t("parametres.titre")` pour les agences, qui affiche en réalité « Réglage des horaires d'ouverture ») plutôt que d'inventer un nouveau libellé « propre » : c'est le texte déjà validé par un ticket antérieur (TP-NAV1, D167), et le dupliquer sous un nouveau nom aurait recréé exactement la faute que D168 répare ailleurs (deux lectures d'un même critère).
- **Vérification A1 de l'addendum 4** (garde d'entrée de la fiche agence) : déjà satisfaite sur main par 9DQ (`z.uuid().safeParse(agenceId)` suivi de `notFound()`, dans la page ET dans `generateMetadata`), avec son propre gardien (`tests/unit/agences/segment-malforme.test.ts`). Aucune action nécessaire.

## Ce que je n'ai PAS fait

- **Les addenda 2, 3, 5 et 6** (durcissements de tests d'autres lots — 9DO, 9DS, 9DL, 9DQ — contre la pollution de scène sous `fullyParallel`) n'ont pas été traités : ce lot s'est concentré sur son propre périmètre (fil d'Ariane, retours, `depuis`, TR-47/TR-51) plutôt que d'ajouter six chantiers indépendants supplémentaires dans la même session. Ils restent entiers pour une session dédiée.
- **L'addendum « demande.refus.capacite_requise »** (05/10 ~05h40) n'a pas été vérifié ni traité : je n'ai pas eu le temps de confirmer qu'aucun rôle n'atteint cette branche avant de la retirer, et je préfère ne rien supprimer sur une hypothèse non vérifiée plutôt que de risquer une suppression fausse.
- **Aucune capture AVANT/APRÈS n'a été produite** (ni 1280 ni 375 px, ni bandeau téléphone) : le temps restant a été consacré à la correction, aux tests et à `pnpm verify`/e2e ciblé plutôt qu'aux captures. `tests/e2e/captures-9aq-cg1-retour-parametres.spec.ts` reste fonctionnel (gated par variable d'environnement) pour qui veut les produire.
- **`pnpm verify:full` dans son intégralité n'a pas été rejoué** — en particulier `pnpm test:e2e` ne couvre que les ~80 scénarios des huit fichiers e2e listés ci-dessus plus `tous-les-ecrans-rendent.spec.ts`, pas les 253 fichiers de la suite complète. `pnpm feries:horizon` et `pnpm audit:partitions` n'ont pas été relancés non plus — aucune migration ni donnée temporelle n'étant touchée par ce lot, le risque mesuré est faible, mais ce n'est pas la même chose qu'une vérification faite.

## Les pièges pour la session suivante

- **Les specs qui prennent une capture écrasent des PNG à chaque exécution** (`liens-2.spec.ts`, `liens-3.spec.ts`, `fiche-360-1.spec.ts`, et sans doute d'autres) : les relancer en local salit `git status` de PNG modifiés qui n'ont rien à voir avec le lot en cours. Je les ai restaurés avant de commiter (`git checkout --`) ; la session suivante devra faire pareil si elle rejoue ces fichiers.
- **`getByRole("link", { name: fr["nav.parc_machines"] })` et consorts sont désormais AMBIGUS sur une page qui porte le fil** : la barre de navigation principale ET le fil d'Ariane peuvent tous les deux porter un lien du même nom (« Parc machines », « Clients »…). Tout scénario e2e qui cherche un tel lien sans le scoper à `page.getByRole("navigation", { name: fr["navigation.fil_ariane"] })` ou à la barre latérale lèvera une erreur « strict mode violation ». C'est ce qui a cassé `liens-3.spec.ts` dès que son retour a migré vers le fil — corrigé dans ce lot, mais tout NOUVEAU scénario qui ouvre une fiche portant un fil devra y penser.
- **La liste fermée `CLASSES_LIEN` de `tests/unit/theme/lien-visible.test.ts` est une égalité stricte** : tout fichier qui gagne ou perd son seul usage de `CLASSES_LIEN` doit être ajouté ou retiré de cette liste, triée alphabétiquement. Oublié une fois pendant ce lot (`fil-d-ariane.tsx` à ajouter, `mise-en-page/page.tsx` et `parametres/agences/calendrier/[id]/page.tsx` à retirer) — repéré par le test lui-même, pas par relecture.
- **`tests/unit/i18n/chevron-retour.test.ts` tient un plancher dynamique** (« au moins 7 clés retour commencent par ← ») : supprimer des clés `*.retour*` peut le faire tomber sous le plancher si on en supprime trop d'un coup. Ce lot en a supprimé 6 et reste à 13 — large marge, mais la prochaine suppression (la fiche intervention, si elle passe au fil) devra re-vérifier ce compte.
- **La fiche agence et la fiche calendrier n'ont pas de « bannerTitre » séparé du `<h1>`** comme la fiche machine : leur dernier maillon de fil réutilise directement `titreDeLAgence`/`titreDuCalendrier`, qui composent déjà le mot imposé (« Agence <libellé> », « Calendrier — <libellé> ») — ce n'est PAS la même convention que les autres fils (nom brut de l'entité). Gardé ainsi par manque de temps pour harmoniser ; à revoir si Alexis trouve la fiche agence incohérente avec les autres.

## Ce qui reste à faire

1. Fil d'Ariane (à plusieurs niveaux) pour la fiche intervention, remplaçant son retour nu contextuel.
2. `depuis` pour les liens vers la fiche machine (site, client, intervention, VGP) et pour les formulaires de création (client, site, intervention).
3. Captures AVANT/APRÈS du lot (1280 et 375 px, bandeau téléphone), sur une scène propre.
4. Les addenda 2, 3, 5 et 6, non traités (voir « Reprise 9DRA » ci-dessous pour ce qui a changé sur ce point).
5. ~~L'addendum « demande.refus.capacite_requise » — vérifier d'abord, puis agir.~~ Vérifié par la reprise 9DRA (ci-dessous) : **atteignable, donc conservé**.
6. ~~Rejouer `pnpm verify:full` dans son intégralité~~ Fait par la reprise 9DRA (ci-dessous).

## Reprise 9DRA (06/10/2026)

### Ce que j'ai changé, et ce que ça change pour l'exploitation

**Récupéré le travail non commité d'une 1ʳᵉ session 9DRA coupée par un redémarrage du PC** (branche `voie1-reste-1006-0735`) : les 4 commits `9DR-TP-NAV2-RETOURS-FIL — partie A/B/C+D/E` ci-dessus (rejeu de la garde `9DR-TP-NAV2-RETOURS-FIL-garde`, contenu identique) et un reste non commité (TR-51 largeur de titre, trois specs e2e adaptés à `?depuis=…`/au fil d'Ariane de `sites.spec.ts`). Un conflit sur `docs/arbitrages.md` entre D168 (ce ticket) et D170 (9DT, publié sur `main` entre-temps) a été résolu en gardant les deux décisions, D168 avant D170 dans l'ordre du fichier. Le reste récupéré laissait `/parametres/donnees` (ajouté par 9DT après coup) importer `RetourParametres`, supprimé par ce ticket : basculé sur `filAriane`, même forme que les sept autres sous-pages de Paramètres.

**Corrigé LE ROUGE réel de `verify:full`** (`tests/e2e/fiche-375.spec.ts:191`, `scrollWidth` 1508 > 375) : TR-51 place le nom du client — un mot long et sans espace dans le scénario de ce test — dans le `<h1>` de la fiche intervention. `break-words` (`overflow-wrap: break-word`) ne réduit PAS la taille min-content d'un item flexible dans Chrome/la plupart des moteurs ; seul `break-all` (`word-break: break-all`, déjà le choix retenu sur les `<dd>` de cette même fiche) le fait. Même défaut, un cran plus haut et plus largement partagé : le conteneur du titre (`components/mise-en-page/page.tsx`) et le bandeau mobile qui reprend ce même titre en le tronquant (`components/navigation/bandeau-mobile.tsx`) n'avaient pas de `min-w-0` sur l'item flexible concerné — un défaut latent depuis COQUE-375/FICHE-360-1, jamais révélé tant qu'aucun titre n'était assez long pour forcer le débordement. Trois correctifs CSS, tous d'une ligne.

### Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Le tableau des parties et addenda du ticket 9DR** (relecture faite à partir de `docs/propositions/9DR-TP-NAV2-RETOURS-FIL/passation.md`, de mon propre texte de reprise, et du dépôt — **le fichier source du ticket, `tickets/recales/9DR-TP-NAV2-RETOURS-FIL.md`, n'existe nulle part dans ce dépôt ni dans son historique** ; voir « ce que je n'ai pas fait ») :

| Partie / addendum | État | Preuve |
|---|---|---|
| Refus mort de la fiche demande (partie centrale du ticket, § « Un seul retour par écran ») | **Fait** | Commits partie B, `RetourParametres`/5 clés `*.retour` supprimées |
| O2-O6 (fil posé sur fiches/sous-pages Paramètres) | **Fait** | Commits parties A/B — 16 écrans portent un fil, contre 2 avant |
| S1 (TR-49, `depuis` étendu) | **Fait** | Commit partie C/D |
| A1 (garde d'entrée fiche agence) | **Déjà satisfait, aucune action** | `z.uuid().safeParse(agenceId)` + `notFound()`, vérifié ce jour dans `app/(back-office)/parametres/agences/[agenceId]/page.tsx:82,120-121` — confirmé par 9DQ, pas par ce lot |
| L1-L2 (TR-51 titre + TR-47 bouton 44px) | **Fait** | Commit partie C/D |
| Q1-Q3 (D168 arbitrage + fil au téléphone) | **Fait** | Commit partie E |
| Addendum « demande.refus.capacite_requise » (branche morte ?) | **Vérifié cette session : PAS mort, conservé** | Voir « ce que j'ai tranché » |
| Addenda « durcissement de tests sous `fullyParallel` » (2/9DO, 3/9DS "S1 vgp2/vgp-4", 5/9DL "L1-L2 agence par position", 6/9DQ "Q1-Q2 agences forgées/comptées") | **Non traités** | Voir « ce que je n'ai pas fait » |
| Captures AVANT/APRÈS du lot | **Non faites** | Voir « ce que je n'ai pas fait » |

  **Attention** : les libellés « O2-O6 », « S1 », « A1 », « L1-L2 », « Q1-Q3 » de la ligne ci-dessus viennent du texte du ticket 9DRA lui-même (qui les cite) et de `passation.md` — je n'ai PAS pu les confronter au texte source du ticket 9DR, introuvable. Le rapprochement entre ces codes et les parties du lot est donc une **reconstitution**, pas une lecture directe.
- `pnpm test:e2e` complet (971 tests, 1 worker, environ 50 min), rejoué deux fois avant correction (même échec reproductible aux deux passages) puis une fois après (0 échec) : **970/971 → 971/971** (un test ignoré par ailleurs, préexistant, sans rapport).
- `pnpm test` : 4101/4101 verts (inchangé). `pnpm test:isolation` : 1460/1460 verts (inchangé — la 1ʳᵉ session en avait mesuré 1449 avant son propre lot ; l'écart vient des tests ajoutés par les commits repris, pas de cette reprise). `pnpm build`, `pnpm feries:horizon`, `pnpm audit:partitions` : verts.
- `document.documentElement.scrollWidth` sur `fiche-375.spec.ts` (scène à nom de client long, sans espace) : **1508 → 375**.

### Ce que j'ai tranché et pourquoi

- **L'addendum « `demande.refus.capacite_requise` est-il mort ? » — NON, il reste.** Lu `app/(back-office)/demandes/[id]/page.tsx` : la page n'exclut que `Role.technicien` ; `qualifier_affecter` est accordé à TOUS les autres rôles internes (`ADMS, DIR, RM, RS, ADV`) mais rien n'empêche un rôle PORTAIL (`Role.client`) ou un rôle éditeur d'atteindre cette URL de back-office directement (aucun middleware, aucune garde de segment ne ferme `/demandes/*` à ces rôles — chaque page se garde elle-même, et celle-ci ne se garde que contre le technicien). `role === null` est par ailleurs impossible dès que `societeId !== null` (`lib/auth/session.ts:114`), donc ce n'est pas ce chemin qui active la branche — c'est un rôle PRÉSENT mais sans la capacité. C'est exactement le motif de refus « rôle présent, capacité absente » que D153/`lib/auth/porte.ts` documente comme une discipline voulue, pas un oubli. Rien à supprimer.
- **Je n'ai pas tenté de reproduire ni de corriger les addenda 2/3/5/6** (durcissement de tests contre `fullyParallel`) : cet environnement de reprise exécute `test:e2e` avec **UN SEUL ouvrier** (mesuré : « Running 971 tests using 1 worker », deux fois), jamais en parallèle réel — la classe de bug que ces addenda visent (pollution de scène entre ouvriers concurrents) ne peut donc pas s'y observer. J'ai ouvert `tests/e2e/vgp-4.spec.ts` (piste S1) et trouvé une assertion qui COMPTE LARGE sans filtre (`expect(lignes).toHaveCount(1)` sur `/vgp?etat=depassees`, qui suppose que la société entière ne porte qu'une seule machine en échéance dépassée — celle du semis) ; je n'ai pas poussé plus loin faute de pouvoir la reproduire ni de temps pour auditer 9DO/9DL/9DQ avec le même soin, et une correction à l'aveugle sur une assertion qui passe aujourd'hui risquait de déplacer le défaut plutôt que de le fermer. Laissé nommément à la session suivante plutôt que bâclé ici (règle des deux rouges / ne pas deviner).

### Ce que je n'ai PAS fait

- **Le texte source du ticket 9DR n'a pas pu être relu** : ni `tickets/recales/9DR-TP-NAV2-RETOURS-FIL.md` (chemin donné par les instructions de reprise) ni aucune trace dans `docs/backlog.md`, l'historique git, ou les worktrees voisins (`codiplan`, `codiplan-voie2`) ne le contiennent. Le tableau ci-dessus reconstitue l'état des parties/addenda à partir de `passation.md` (écrit par la session qui a réellement vu le ticket) et des indices du texte de reprise 9DRA lui-même.
- **Les addenda 2 (9DO), 3 (9DS), 5 (9DL) et 6 (9DQ)** — durcissement de tests d'autres lots contre `fullyParallel` — non traités, pour la raison exposée ci-dessus.
- **`depuis` étendu aux liens vers la fiche MACHINE**, et aux formulaires de création — non fait (déjà nommé par la 1ʳᵉ session).
- **Aucune capture AVANT/APRÈS n'a été produite** pour ce lot — ni par la 1ʳᵉ session ni par cette reprise ; le temps a été consacré à la récupération du travail perdu, à la recherche du rouge réel et à sa correction vérifiée.
- **La fiche agence/calendrier sans `bannerTitre` séparé** (incohérence déjà nommée par la 1ʳᵉ session) — non harmonisée.

### Les pièges pour la session suivante

- **`break-words` ne protège PAS un item flexible contre un mot long sans espace** : seul `break-all` (ou `overflow-wrap: anywhere`, si Tailwind l'expose dans ce projet) réduit la taille min-content prise en compte par le calcul de rétrécissement flex/grid. Tout nouveau titre composé qui peut un jour porter un nom de tiers (client, site, agence…) sans garantie d'espaces doit suivre le même choix que les `<dd>` de la fiche intervention, pas `break-words`.
- **Un item flexible qui doit RÉTRÉCIR (`truncate`, `break-all`…) a aussi besoin de `min-w-0`** sur lui-même ET sur chacun de ses ancêtres flex — l'un sans l'autre ne suffit pas. `bandeau-mobile.tsx` et `mise-en-page/page.tsx` en manquaient ; une autre mise en page flexible du dépôt peut porter le même défaut latent, non testé tant qu'aucun contenu n'est assez long pour le révéler.
- **`pnpm test:e2e` complet ici tourne à UN SEUL ouvrier** (971 tests, ~50 min) — les addenda qui visent une pollution de scène SOUS `fullyParallel` ne peuvent pas être vérifiés ici : il faut soit un environnement à plusieurs ouvriers, soit une relecture de code pure (comme celle faite ci-dessus pour `vgp-4.spec.ts`), jamais une « ça passe donc c'est bon » dans cet environnement précis.
- **Le ticket source 9DR est introuvable dans ce dépôt** : si une future reprise en a besoin, il faudra le redemander plutôt que de supposer qu'il existe quelque part sous un autre nom.

### Ce qui reste à faire

1. Les addenda 2 (9DO), 3 (9DS, piste repérée : `tests/e2e/vgp-4.spec.ts`, assertion `expect(lignes).toHaveCount(1)` non scopée), 5 (9DL), 6 (9DQ).
2. Fil d'Ariane à plusieurs niveaux pour la fiche intervention (nommé par la 1ʳᵉ session, toujours vrai).
3. `depuis` étendu à la fiche machine et aux formulaires de création (nommé par la 1ʳᵉ session, toujours vrai).
4. Captures AVANT/APRÈS du lot complet, sur une scène propre.
5. Harmoniser la fiche agence/calendrier avec le reste des fils (`bannerTitre`).
