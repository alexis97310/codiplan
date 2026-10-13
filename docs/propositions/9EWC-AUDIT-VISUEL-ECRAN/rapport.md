# 9EWC-AUDIT-VISUEL-ECRAN — rapport

Audit **à l'écran** : chaque route du site est rendue (Chromium, base jetable, scène et
comptes de `tests/e2e/setup/`) à 1280 et 375 px, photographiée, et comparée à la même
route de la maquette (`docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html`),
elle aussi rendue. 68 écrans du catalogue de la maquette, 66 effectivement capturés côté
site (deux de plus que le texte du ticket ne l'annonçait : le catalogue en compte 68, pas
exactement 65 — compté dans `tests/audit-visuel/catalogue.ts`). **Aucun code de
l'application n'a été modifié.**

Outil : `playwright.audit.config.ts` + `tests/audit-visuel/` + `pnpm audit:visuel`.
Captures : `docs/propositions/9EWC-AUDIT-VISUEL-ECRAN/captures/` (240 images, JPEG q70,
demi-résolution). Mesures automatiques : `mesures.json`.

## Note de méthode — ce que les mesures automatiques ratent, et pourquoi

Trois des six mesures prévues au ticket se sont révélées peu fiables une fois les
captures REGARDÉES, et ont été corrigées ou écartées dans `tests/audit-visuel/mesures.ts`
avant la prise de vue finale (voir le commit du point 2) :

- **Contraste** : la première version lisait `textContent`, qui descend dans les enfants.
  Sur la marque « CODIPLAN SAV » du chrome (un seul `<a>` autour de deux `<span>` de
  couleurs différentes), cela comparait le texte réuni des deux à la couleur du
  conteneur — ratio 1.04 sur un logo parfaitement lisible, **sur les 66 pages**. Corrigé :
  seul le texte PROPRE de chaque élément (ses nœuds texte directs) est mesuré.
- **Contrôles natifs — `<details>`** : `getComputedStyle(summary, "::-webkit-details-marker")`
  ne reflète pas, sous Chromium headless, la règle `[&::-webkit-details-marker]:hidden` qui
  masque le triangle (vérifié : le signalait encore sur `/planning`, dont le triangle est
  masqué depuis 9EWA-RENDU-VISUEL-1 point 6). Le contrôle automatique a été retiré ; le
  triangle natif se vérifie à l'œil ci-dessous, et c'est ainsi qu'il a été trouvé ailleurs.
- **Contrôles natifs — cases à cocher** : `components/ui/case-a-cocher.tsx` GARDE
  délibérément l'apparence native (constat CG8) — seule la cible tactile change sous
  768 px. Un décompte non nul n'est donc PAS un défaut ; aucune case native n'est listée
  en défaut ci-dessous pour cette seule raison.
- **Halo de focus** : la première version CLIQUAIT dans `#contenu` à une position fixe
  pour y déclencher un focus. Sur beaucoup d'écrans, ce point atterrissait sur le fil
  d'Ariane et le clic réel NAVIGUAIT avant la capture — la photo montrait alors la
  MAUVAISE page (sept pages au moins : `/parametres/habilitations`,
  `/parametres/materiel`, `/parametres/equipe`, `/parametres/agences`,
  `/parametres/donnees`, `/parametres/trajets`, `/parametres/prestations`, retombées sur
  `/parametres`). Corrigé par un `focus()` PROGRAMMATIQUE sur `#contenu` (sa vraie cible,
  celle du lien d'évitement) — zéro risque de navigation. Toutes les captures ont été
  reprises après ce correctif.
- **Collision de clés de fichier** : deux paires d'écrans du catalogue partageaient la
  même route hors requête (`/planning` et `/planning?vue=jour` ; `/premier-acces` et
  `/premier-acces?cas=expire`) ou la même route sous deux rôles (`/terrain`, bureau et
  technicien) : la seconde capture écrasait la première. Corrigé dans `catalogue.ts`
  (clé incluant la requête + désambiguïsation par rôle) ; toutes les captures reprises.
- **Barre basse mobile « flottante »** : sur plusieurs captures `fullPage` à 375 px
  (`/planning`, `/interventions`, `/imports`, `/absences`), la barre de navigation basse
  (`fixed inset-x-0 bottom-0`, `components/navigation/barre-basse-bureau.tsx:59`)
  apparaît au milieu de la page plutôt qu'en bas — artefact CONNU des captures
  `fullPage` avec un élément `position: fixed` (capturé une fois à la jointure de
  défilement), pas un défaut réel : un utilisateur qui défile la voit correctement
  fixée en bas. **Ne pas le corriger** sur la foi de ces captures.

Avec ces correctifs, les mesures automatiques restantes (défilement parasite,
débordement horizontal, troncature, images cassées, erreurs console) sont fiables ; zéro
échec de capture (`echecs: []`). Une seule erreur console relevée dans tout le lot — un
404 sur `terrain-i-i436`, expliqué dans son verdict ci-dessous : une limite de la
résolution de cet outil (mauvais technicien), pas un défaut du site.

## Verdicts par écran

Légende : **C** conforme, **ÉF** écarts faibles, **ÉM** écarts moyens, **PA** page absente
(aucune route sur le site — `[MANQUE]`), **NC** non couvert dans le temps imparti (raison
donnée). Capture : `<clé>-site-{1280,375}.jpg` / `<clé>-maquette-{1280,375}.jpg` sous
`captures/`.

### Accès

| Écran | Clé | Verdict | Remarque |
|---|---|---|---|
| Connexion | `connexion` | C | — |
| Code du second facteur | `connexion-code` | C | capture spéciale (second passage, compte déjà enrôlé) |
| Mot de passe oublié | `mot-de-passe-oublie` | C | — |
| Activer le second facteur | `enrolement` | C | capture spéciale (compte dédié jamais enrôlé) |
| Premier accès (lien) | `premier-acces` | C | capture spéciale (jeton non consommé) |
| Lien d'accès expiré | `premier-acces-cas-expire` (maquette) / `premier-acces-expire` (site) | ÉM | voir DÉF-3 |
| Choisir la société | `arrivee` | NC | aucun compte de la scène n'est habilité sur deux sociétés (D35) ; hors budget d'en créer un sans toucher `scene.ts` |

### Exploitation

| Écran | Clé | Verdict | Remarque |
|---|---|---|---|
| Tableau de bord | `tableau-de-bord` | ÉF | mise en page proche, jetons de carte différents de la maquette (bordure pleine vs barre de couleur) — stylistique, pas un défaut isolable |
| Indicateurs du mois | `indicateurs` | PA | `[MANQUE]` — maquette « Nouvelle », aucune route `/indicateurs` |
| Planning · semaine | `planning` | C | — |
| Planning · jour (frise) | `planning-vue-jour` | C | — |
| Demandes | `demandes` | C | registre vide dans la scène (« Aucune demande à traiter ») |
| Qualifier une demande | `demandes-d31` | NC | aucune `Demande` en base — le semis n'en pose aucune, la scène non plus |
| Interventions (registre) | `interventions` | ÉF | « ▸ Plus de filtres » porte le triangle natif, DÉF-1 |
| À facturer | `interventions-a-facturer` | C | — |
| Nouvelle intervention | `interventions-nouvelle` | C | — |
| Fiche · à planifier (P1) | `interventions-i452` | ÉF | onglets de statut débordent en largeur à 375 (horizontal, voulu) |
| Fiche · en cours | `interventions-i436` | C | — |
| Fiche · rapport à valider | `interventions-i419` | NC | aucune intervention `terminee` distincte de « prête à clôturer » dans le temps imparti — même repère que la ligne suivante |
| Fiche · prête à clôturer | `interventions-i425` | NC | idem |
| Fiche · suspendue | `interventions-i421` | C | — |
| Fiche · reprise de l'archive | `interventions-h0` | C | approximée par une intervention clôturée du semis |
| Bon d'intervention | `interventions-i431-bon` | C | — |
| Absences | `absences` | C | — |

### Clients & parc

| Écran | Clé | Verdict | Remarque |
|---|---|---|---|
| Clients | `clients` | C | — |
| Nouveau client | `clients-nouveau` | C | — |
| Fiche client | `clients-c14` | C | — |
| Sites | `sites` | C | — |
| Nouveau site | `sites-nouveau-client-c10` | C | — |
| Fiche site | `sites-s11` | C | case native « Bloquante » — CG8, pas un défaut |
| Parc machines | `parc` | C | — |
| Nouvelle machine | `parc-nouvelle-site-s18` | ÉM | DÉF-2 (dates `mm/dd/yyyy`), à vérifier sur poste réel |
| Fiche machine | `parc-m14` | C | — |
| Corriger la fiche machine | `parc-m14-modifier` | NC | non ouverte en détail (budget) — capturée, non inspectée à l'œil |
| VGP · registre | `vgp` | ÉF | 8× « ▸ Voir le motif » porte le triangle natif, DÉF-1 |
| VGP · réserves | `vgp-reserves` | PA | `[MANQUE]` — maquette « Nouvelle » |
| VGP · familles à déterminer | `vgp-a-determiner` | C | — |
| Enregistrer une vérification | `vgp-enregistrer-m1` | ÉM | DÉF-2 (date) |
| Scan d'une étiquette | `scan-QR-7F3A9C` | PA | `[MANQUE]` — maquette « Nouvelle » |

### Paramètres

| Écran | Clé | Verdict | Remarque |
|---|---|---|---|
| Paramètres (hub) | `parametres` | C | — |
| Agences | `parametres-agences` | C | — |
| Fiche agence | `parametres-agences-a1` | C | — |
| Nouvelle agence | `parametres-agences-nouvelle` | C | — |
| Tarifs (taux et forfaits) | `parametres-tarifs` | PA | `[MAQ]` — la maquette FUSIONNE taux et forfaits (statut « Fusionnée ») ; le site garde deux pages séparées, DÉF-4 |
| Trajets par zone | `parametres-trajets` | C | — |
| Prestations | `parametres-prestations` | C | catalogue vide dans la scène |
| Référentiel matériel | `parametres-materiel` | ÉF | « ▸ Modifier la famille/le modèle » × 8, triangle natif, DÉF-1 |
| Équipe et accès | `parametres-equipe` | ÉF | « ▸ Modifier — Nom » × 4, triangle natif, DÉF-1 |
| Habilitations | `parametres-habilitations` | ÉF | « ▸ Modifier — CODE » × 15, triangle natif, DÉF-1 (le plus dense des sept écrans touchés) |
| Données à compléter | `parametres-donnees` | C | — |
| Journal d'audit | `parametres-journal` | PA | `[MANQUE]` — maquette « Nouvelle » |
| Imports Excel | `imports` | ÉM | bouton de fichier natif anglais, DÉF-2 ; voir aussi note de méthode (barre basse) |
| Rapport d'import (contrôlé) | `imports-L17` | C | — |
| Rapport d'import (appliqué) | `imports-L16` | NC | aucun `ImportLot` au statut `applique` dans la scène/le semis |
| Mon compte | `compte` | PA | `[MANQUE]` — maquette « Nouvelle » |
| App technicien (rôle bureau) | `terrain` | C | refus propre (« Réservé aux techniciens ») ; barre basse terrain quand même affichée, conforme à R2-16 (« une barre affichée n'est pas une permission », `app/(mobile)/layout.tsx`) — pas un défaut |
| État de l'installation | `sante` | C | — |

### Terrain

| Écran | Clé | Verdict | Remarque |
|---|---|---|---|
| Ma journée | `terrain-technicien` | C | — |
| Intervention à démarrer | `terrain-i-i440` | ÉM | DÉF-2 (bouton photo anglais) |
| Intervention en cours | `terrain-i-i436` | NC | **limite de l'outil, pas du site** : l'intervention `en_cours` résolue appartient à un AUTRE technicien que celui de la scène — `/terrain/[id]` refuse à bon droit (404 « Page introuvable »). Aucune intervention `en_cours` n'existe pour le technicien de la scène dans le temps imparti |
| Rapport | `terrain-i-i436-rapport` | NC | pas de route dédiée — geste en écran, non une URL |
| Signature et fin | `terrain-i-i436-signature` | NC | idem |
| Scanner un QR | `terrain-scan` | PA | `[MANQUE]` — maquette « Nouvelle » |
| Fiche machine | `terrain-machine-m4` | PA | `[MANQUE]` — maquette « Nouvelle » |
| Mes machines | `terrain-machines` | PA | `[MANQUE]` — maquette « Nouvelle » |
| Machine express | `terrain-machine-express` | PA | `[MANQUE]` — maquette « Nouvelle » |
| Profil | `terrain-profil` | C | — |

### Hors V1

| Écran | Clé | Verdict | Remarque |
|---|---|---|---|
| Portail client | `portail` | NC | hors V1, écarté du budget (compte portail = identité séparée, D10) |

**Compte** : 66 écrans avec tentative de capture site, 46 `C`/`ÉF` (conformes ou écarts
faibles, sans défaut neuf), 5 `ÉM` (défauts ci-dessous), 10 `PA` (`[MANQUE]`, routes
absentes — presque toutes marquées « Nouvelle » dans la maquette, donc attendu), 9 `NC`
(non couverts, raison donnée page par page — essentiellement des états de données que la
scène ne produit pas, à distinguer d'un défaut du site).

## Défauts

### [BUG] DÉF-1 — Triangle natif de `<details>`, visible sur sept écrans

**Résumé** : `<summary>` sans `[&::-webkit-details-marker]:hidden` → le navigateur dessine
son propre triangle ▸, visuellement incohérent avec le reste de l'app (qui utilise des
icônes `chev-r`/`chev-d` ailleurs). **9EWA-RENDU-VISUEL-1 point 6 a déjà réparé ce
DÉFAUT EXACT** sur `/planning` (`app/(back-office)/planning/statistiques.tsx:90`) et une
instance de `contacts/presentation.tsx:170` le porte déjà aussi — le motif est connu, il
n'a simplement pas été étendu à ces sept-là.

Fichiers et lignes (le `<summary>` sans la classe de masquage) :
- `app/(back-office)/parametres/habilitations/page.tsx:184` (densité : 15 instances —
  « ▸ Modifier — CODE », captures `parametres-habilitations-site-*.jpg`)
- `app/(back-office)/parametres/materiel/page.tsx:232` et `:333` (8 instances — familles
  et modèles, capture `parametres-materiel-site-*.jpg`)
- `app/(back-office)/parametres/equipe/page.tsx:435` (4 instances — un par technicien,
  capture `parametres-equipe-site-*.jpg`)
- `app/(back-office)/vgp/page.tsx:863` (8 instances — un « ▸ Voir le motif » par machine
  du registre, capture `vgp-site-*.jpg`)
- `app/(back-office)/interventions/page.tsx:751` (« ▸ Plus de filtres », capture
  `interventions-site-*.jpg`)
- `app/(back-office)/demandes/[id]/page.tsx:885` (motif du « Clore », non capturé faute
  de demande en base — à vérifier au correctif)
- `app/(back-office)/imports/[id]/page.tsx:414` (groupes de rejets, capture
  `imports-L17-site-*.jpg` — non visible sur cette capture précise car aucun rejet,
  mais le `<summary>` existe dès qu'un groupe est rendu)

**Correctif** : ajouter `[&::-webkit-details-marker]:hidden marker:hidden` (et l'icône de
repli si la maquette en montre une) sur chacun des `<summary>` listés — le même geste que
`planning/statistiques.tsx:90` et `contacts/presentation.tsx:170` appliquent déjà. Pas de
composant partagé à écrire : sept retouches identiques, un gardien de non-régression
(`tests/unit/ui/…`) qui échoue si un `<summary>` du dépôt n'a pas la classe pourrait
éviter un huitième oubli — à soumettre à Alexis plutôt qu'à écrire d'office (ajout d'un
gardien, pas juste un correctif de rendu).

### [BUG]/vigilance DÉF-2 — Contrôles natifs en anglais : dates et sélecteur de fichier

**Résumé** : les `<input type="date">` affichent le placeholder `mm/dd/yyyy` (anglo-saxon)
au lieu du format français, et les `<input type="file">` affichent « Choose File / No
file chosen » au lieu de « Choisir un fichier / Aucun fichier choisi ». Vu sur
`parc-nouvelle-site-s18-site-1280.jpg` (trois dates), `vgp-enregistrer-m1-site-1280.jpg`
(une date), `imports-site-1280.jpg` et `terrain-i-i440-site-1280.jpg` (le bouton photo).

**Mais** : ces deux chaînes sont des chaînes NATIVES du navigateur, pas du texte écrit par
l'application — elles suivent la langue d'INTERFACE du navigateur (réglage du poste),
jamais `locale: "fr-FR"` posé côté page ou côté contexte Playwright (mesuré : le
contexte de capture porte bien `locale: "fr-FR"`, et l'affichage reste anglais — signe
que c'est la langue du Chromium headless de ce poste qui parle, pas celle de la page).
**Je ne peux pas, depuis cet outil, distinguer un défaut réel d'un artefact de ce poste
de capture.** À vérifier sur un poste réel configuré en français avant d'ouvrir un
ticket — si confirmé là aussi, le correctif n'est pas dans le dépôt mais dans la
configuration du navigateur cible, sauf à remplacer les champs natifs par des champs
habillés (décision à soumettre, pas un correctif de rendu).

### [MAQ] DÉF-3 — « Lien d'accès expiré » : 404 générique plutôt qu'un message dédié

**Résumé** : la maquette (`premier-acces-cas-expire-maquette-*.jpg`) montre un message
dédié — « Ce lien n'est plus valide · Un lien d'accès ne sert qu'une fois et reste
valable une heure. Demandez-en un nouveau à la personne qui vous l'a transmis. · Aller à
la connexion ». Le site (`premier-acces-expire-site-*.jpg`), sur le même jeton rejoué
après consommation, rend la page 404 générique du dépôt (« Page introuvable · Cette
adresse ne correspond à aucun écran de CODIPLAN »).

**Correctif probable** : `app/(sans-session)/premier-acces/page.tsx` doit distinguer
« jeton inconnu/déjà consommé » de « route inconnue » et rendre le message dédié de la
maquette plutôt que de laisser remonter au 404 générique — fichier à confirmer en
ouvrant le ticket (je n'ai pas tracé le chemin exact de l'échec du jeton dans le temps
imparti).

### [MANQUE] DÉF-4 — Tarifs : la maquette fusionne, le site sépare

**Résumé** : la maquette porte « Tarifs (taux et forfaits) » (`#/parametres/tarifs`,
statut « Fusionnée ») comme un écran unique. Le site garde `/parametres/taux-horaire` et
`/parametres/forfaits` séparés (vus l'un et l'autre depuis le hub `/parametres`,
`parametres-site-1280.jpg`, cartes « Forfaits applicables » et « Taux horaire »
distinctes). Pas forcément un défaut — peut-être une fusion non encore faite, ou un écart
accepté non documenté dans `docs/arbitrages.md` à ma connaissance. **Point d'arrêt** :
je ne tranche pas moi-même (§8 CLAUDE.md, « changement de schéma… » n'applique pas ici,
mais la fusion de deux écrans est un choix de produit) — à confirmer avec Alexis avant
d'ouvrir un ticket de fusion.

## Ce qui est DÉJÀ corrigé (vérifié sans régression)

Les six défauts de la décision n° 94 (13/10) qui motivent ce lot sont adressés par
**9EWA-RENDU-VISUEL-1**, déjà en file :
- encadré bleu autour de la page → point 2 (`main#contenu:focus` ciblé)
- titres du menu illisibles → point 1 (`cn` et l'échelle typographique)
- mini-barres de défilement → point 3 (`overflow-y-hidden`)
- filtres du Parc tronqués → point 4 (`min-w-[140px]`)
- case « sans équipement » en double → point 5 (D179)
- bas du planning en rendu brut → point 6 (carte + triangle masqué)

**Aucune régression constatée** sur ces six points dans cet audit — `tableau-de-bord`,
`parc`, `sites`, `clients` (filtres) et `planning` (barre basse, triangle de « Charge par
technicien ») ont été vérifiés à l'œil et correspondent à la description de 9EWA.

## Propositions de lots

Classées par gravité puis par composant partagé d'abord — un correctif de composant vaut
pour toutes les pages qu'il touche.

1. **9EWD-TRIANGLE-DETAILS-7-ECRANS** (DÉF-1, [BUG], ~30 min) — ajouter
   `[&::-webkit-details-marker]:hidden marker:hidden` aux sept `<summary>` listés
   (habilitations, materiel ×2, équipe, vgp, interventions, demandes, imports). Le plus
   gros gain pour le plus petit lot : habilitations seule porte 15 triangles visibles sur
   un seul écran.
2. **9EWE-LIEN-EXPIRE-MESSAGE** (DÉF-3, [MAQ], ~45 min) — tracer le chemin d'échec du
   jeton dans `app/(sans-session)/premier-acces/`, rendre le message dédié de la maquette
   au lieu du 404 générique. Dépend de retrouver le point exact où `choisirLePremierMotDePasse`
   ou son lecteur de jeton échoue et où ce refus est actuellement affiché.
3. **Vérification manuelle DÉF-2** (pas un lot de code) — ouvrir trois ou quatre écrans à
   champ de date (`parc/nouvelle`, `vgp/enregistrer`) et le bouton photo de
   `/terrain/[id]` sur un poste réel configuré en français ; si l'anglais persiste,
   ouvrir un point d'arrêt (§8) plutôt qu'un ticket — remplacer un `<input type="date">`
   natif par un champ habillé est une décision d'interface, pas un correctif isolé.
4. **Décision DÉF-4** — poser la question à Alexis : fusionner `/parametres/taux-horaire`
   et `/parametres/forfaits` (suivre la maquette) ou documenter l'écart dans
   `docs/arbitrages.md`. Pas de ticket tant que la décision n'est pas prise.

**Déjà couvert par les lots en file**, pas de proposition supplémentaire :
9EWA-RENDU-VISUEL-1 (les six défauts de la décision 94) et 9EWA1/9EWB1 (régressions et
géométrie 375/1280 déjà réparées — vérifiées sans régression ci-dessus). 9EX/9EY
(Équipe), 9EZ (logo), 9F1 (tableau de bord direction), 9F2 (terrain jours), 9F3 (terrain
hors ouverture), 9F4 (terrain enregistrement auto) ne sont pas encore publiés sous
`docs/propositions/` au moment de cet audit ; à confirmer contre leur contenu une fois
publiés avant d'ouvrir les lots ci-dessus, au cas où l'un les couvrirait déjà (aucun titre
ne laisse penser que « triangle natif », « lien expiré » ou « tarifs fusionnés » en
fassent partie, mais 9F2/9F3 touchent le terrain et pourraient croiser DÉF-2 côté photo).
