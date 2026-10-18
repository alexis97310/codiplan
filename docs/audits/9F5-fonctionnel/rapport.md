# 9F5-AUDIT-FONCTIONNEL-PARCOURS — Rapport

Audit du fonctionnement : parcours métier de bout en bout, rôle par rôle, et balayage automatique
de tous les écrans. Mesuré sur une base locale jetable (`pnpm audit:fonctionnel`), jamais sur
l'hébergée. **Aucune correction n'a été apportée** : ce rapport TROUVE et DÉCRIT ; les corrections
sont des lots séparés, à écrire par le pilote à partir des fiches ci-dessous.

Outils produits (lecture seule sur le reste du dépôt) : `tests/audit-fonctionnel/` (harnais,
balayage par rôle, parcours scriptés), `pnpm audit:fonctionnel`, et ce dossier.

---

## Sommaire

| # | Constat | Gravité | Catégorie |
|---|---|---|---|
| 1 | Description de création trop longue (> 4000 car.) refusée avec le MÊME message qu'une description VIDE | GÊNANT | Défaut constaté |
| 2 | Planifier puis transmettre sur une date déjà PASSÉE n'est jamais refusé, à l'écart de la transmission groupée | GÊNANT | Question pour Alexis |
| 3 | `/terrain` : un rôle à accès complet déclenche un appel réseau qui échoue en 403, visible en console | MINEUR | Défaut constaté |
| 4 | `/parametres/forfaits/[id]` : le sélecteur de zone n'a pas de `<label>` associé | MINEUR | Défaut constaté |
| 5 | Le dépôt de photo terrain (fichier + libellé) n'a pas de nom accessible | MINEUR | Défaut constaté |
| 6 | `/interventions/a-facturer` ne montre jamais rien, même juste après clôture + bon | — | Conforme à une décision écrite |
| 7 | Deux onglets sur la même fiche : le second « Transmettre », périmé, est refusé nommément | — | Conforme (vérifié) |
| 8 | Rechargement en cours de frappe du rapport terrain : aucune perte mesurée | — | Conforme (vérifié) |
| 9 | Accents, guillemets, balise `<script>`, émoji dans une description : rendus tels quels, jamais exécutés | — | Conforme (vérifié) |
| 10 | Terrain hors réseau : consultation réelle (pas seulement un statut 200) | — | Conforme (vérifié) — corrige la note du ticket |
| 11 | Pause méridienne (hors ouverture par l'heure) : refusée sans confirmation, acceptée et mentionnée avec | — | Conforme (vérifié, D93) |

Ce que le balayage automatique par rôle (point 2) n'a PAS trouvé, et qui vaut d'être dit : sur
**153 pages visitées au total** (6 rôles : adv 24, technicien 3, admin_societe 39,
responsable_materiel 24, responsable_sav 23, direction 40), **aucune réponse 4xx/5xx**, aucune
image cassée, et aucun bouton/lien sans nom accessible. Le détail est dans `balayage.json` /
`balayage.md`.

---

## 1. Description de création trop longue reçoit le message « panne manquante »

**Rôle** : ADV (ou tout rôle qui crée une intervention). **Écran** : `/interventions/nouvelle`.

**Étapes exactes** :
1. Se connecter en `adv@codima.test`.
2. Ouvrir `/interventions/nouvelle`, choisir un site, une nature, une priorité.
3. Dans « Panne signalée / travail demandé », saisir plus de 4000 caractères (mesuré avec 4100).
4. Valider « Créer ».

**Attendu** : un refus qui dit la VRAIE cause — le texte est trop long — pour que la personne sache
quoi faire (chapitre 10, règle générale de refus nommé, R2-19 et consorts : *« le refus appartient
au contrôle qui le prononce, et il nomme ce qui cloche »*, même famille que L3-01b citée dans
`app/api/interventions/creer/route.ts`).

**Obtenu** : la redirection porte `?motif=intervention.refus.panne_manquante`, et le bandeau affiche
« **La panne signalée ou le travail demandé est obligatoire.** » — exactement le message d'un champ
VIDE, alors que le champ était rempli, très au-delà de la limite.

**Cause, nommée** : `app/api/interventions/creer/formulaire.ts`, fonction `motifDuRefusDeSaisie`
(lignes ~90–114). Elle regarde UNIQUEMENT quel CHAMP porte l'erreur Zod (`probleme.path.includes("description")`),
jamais QUELLE RÈGLE a échoué (`min(1)` vide, ou `max(4000)` trop long — `lib/interventions/saisie.ts`,
`description: z.string().trim().min(1).max(4000)`). Les deux causes, opposées, tombent sur le même
message.

**Capture** : `captures/9f5-edge-description-trop-longue-message-trompeur-1280.jpg`.

**Lot de correction proposé** : `CORRECTIF-PANNE-MESSAGE-TROMPEUR` — territoire
`app/api/interventions/creer/formulaire.ts` (+ son test unitaire existant, à étendre). Distinguer le
message selon l'issue Zod (`too_small` vs `too_big` sur `description`). Durée estimée : 30 min
(fonction pure, déjà isolée et déjà testée pour être « testable sans session ni base »).

---

## 2. Date déjà passée : ni la pose ni la transmission individuelle ne la refusent

**Rôle** : ADV. **Écran** : fiche intervention (`/interventions/[id]`), dialogue « Planifier à la main ».

**Étapes exactes** :
1. Créer une intervention « à planifier » sur un site de Ducos.
2. Ouvrir sa fiche, « Planifier à la main » : date = un lundi de la semaine **dernière** (jour
   normalement ouvert à Ducos, 10:00 — à l'écart de toute question de jour fermé ou d'horaire),
   durée 60 min, un technicien.
3. Valider. Puis cliquer « Transmettre au technicien » et confirmer.

**Attendu** : non spécifié explicitement au chapitre 10 pour la pose/transmission INDIVIDUELLE —
seul `motifsNonTransmissible` (`lib/interventions/cycle-de-vie.ts`) porte un motif `date_passee`,
et UNIQUEMENT pour trier les listes « Transmettre toutes les planifiées prêtes » / « Transmettre
demain ». La question se pose donc, elle ne se tranche pas d'elle-même par le code existant.

**Obtenu** : la pose est acceptée (statut « Planifiée », aucun `?motif=`), et la transmission
individuelle aussi (statut « Affectée ») — pour une date déjà passée, sans aucun avertissement.

**Pourquoi ceci est une QUESTION et non un défaut constaté** : le dépôt a peut-être de bonnes
raisons de permettre ceci (régulariser une intervention faite hors ligne et déclarée en retard,
par exemple) — rien dans `docs/arbitrages.md` ni au chapitre 10 ne tranche le cas. Mais
l'INCOHÉRENCE entre la transmission individuelle (qui ne vérifie rien) et la transmission groupée
(qui exclut explicitement les dates passées, `aPartirDe` dans `motifsNonTransmissible`) suggère que
ce n'est pas un choix délibéré pour le premier chemin, plutôt un angle mort.

**Lot ou arbitrage proposé** : ouvrir un ticket `arbitrage` — « Faut-il avertir (pas forcément
refuser) quand on planifie ou transmet sur une date déjà passée ? » — avec deux issues : (a) ajouter
un avertissement informatif, sans bloquer (léger, ~1 h, même famille que la confirmation D93) ; (b)
laisser en l'état et l'écrire dans `docs/arbitrages.md` comme une décision volontaire, avec sa
condition de réouverture.

---

## 3. `/terrain` : un rôle à accès complet déclenche un appel réseau qui échoue (403), en console

**Rôle** : admin_societe, responsable_materiel, responsable_sav, direction (tout rôle à périmètre
de planning « complet »). **Écran** : `/terrain`.

**Étapes exactes** :
1. Se connecter avec un rôle à accès complet (ex. `admin.societe@codima.test`).
2. Ouvrir `/terrain`.

**Attendu** : l'écran rend `<ReserveAuxTechniciens>` (refus nommé, D'APRÈS QT-24) — rien d'autre
ne devrait se produire.

**Obtenu** : une requête `GET /api/terrain/instantane` part quand même et répond 403 (« Failed to
load resource: the server responded with a status of 403 »), visible dans la console. La route
elle-même refuse CORRECTEMENT (son en-tête le dit explicitement : *« un rôle à accès complet n'a pas
de copie personnelle à emporter »*) — le défaut n'est pas la réponse 403, c'est l'APPEL lui-même.

**Cause, nommée** : `components/terrain/copie-locale.tsx` (`CopieLocaleTerrain`) est monté SANS
condition dans `app/(mobile)/layout.tsx`, pour TOUT le segment `/terrain/*` — y compris quand la
PAGE elle-même va rendre un refus plutôt que du contenu. Le composant ne sait pas que la page qu'il
accompagne va refuser.

**Capture** : non pertinente (l'anomalie n'est visible qu'en console réseau, jamais à l'écran) —
voir `docs/audits/9F5-fonctionnel/balayage.json`, entrées `admin_societe` / `responsable_materiel` /
`responsable_sav` / `direction`, page `/terrain`.

**Lot de correction proposé** : `CORRECTIF-TERRAIN-COPIE-ROLE` — territoire
`components/terrain/copie-locale.tsx` ou `app/(mobile)/layout.tsx`. Ne monter `CopieLocaleTerrain`
que pour un périmètre `restreint` (déjà calculé côté serveur, à faire descendre en prop, ou relire
côté client via la même fonction). Durée estimée : 20–30 min.

---

## 4. `/parametres/forfaits/[id]` : le sélecteur de zone n'a pas de `<label>` associé

**Rôle** : admin_societe, direction. **Écran** : `/parametres/forfaits/[id]` (type « déplacement »).

**Étapes exactes** :
1. Se connecter en `admin.societe@codima.test`.
2. Ouvrir une fiche forfait de type déplacement (ex. `01a0e2e0-0000-7000-8000-0000000000f1`).

**Attendu** : tout champ de saisie porte un nom accessible (§5 de la définition de « terminé »
implique une interface utilisable, et un `<select>` sans nom associé n'est pas lu par un lecteur
d'écran).

**Obtenu** : `app/(back-office)/parametres/forfaits/[id]/page.tsx` (~ligne 264) pose un `<label>`
et un `<select name="zone">` côte à côte, dans le même `<form>`, mais SANS `htmlFor`/`id` qui les
lie, et sans que le `<select>` soit un DESCENDANT du `<label>`. Visuellement associés, pas
programmatiquement.

**Lot de correction proposé** : `CORRECTIF-A11Y-FORFAITS-ZONE` — un `id` + `htmlFor`, ou envelopper
le `<select>` dans le `<label>`. Durée estimée : 10 min.

---

## 5. Le dépôt de photo terrain n'a pas de nom accessible (fichier + libellé)

**Rôle** : technicien. **Écran** : `/terrain/[id]`, section « Photos ».

**Étapes exactes** :
1. Se connecter en `garnier@codima.test`.
2. Ouvrir une fiche terrain avec la section Photos visible (ex. `SCENE.rapportTravaillee`).

**Attendu** : même règle qu'au constat 4.

**Obtenu** : `components/interventions/photos-terrain.tsx` (~lignes 181–193) pose `<input
type="file" name="fichier">` et `<input type="text" name="libelle">` SANS `<label>`, sans
`aria-label` — seul un `placeholder` les décrit, et un `placeholder` n'est pas un nom accessible
(il disparaît à la saisie, et beaucoup de lecteurs d'écran ne l'annoncent pas comme un libellé).

**Lot de correction proposé** : même lot que le constat 4, ou un lot dédié
`CORRECTIF-A11Y-PHOTOS-TERRAIN` — ajouter un `<label>` (visuellement masqué si le gabarit l'exige)
pour les deux champs. Durée estimée : 15 min.

---

## 6. `/interventions/a-facturer` ne montre jamais rien — CONFORME, pas un défaut

**Constat** : même après avoir fait circuler une intervention jusqu'à « Clôturée » et imprimé son
bon (parcours P1 complet, point 3(a)), elle n'apparaît jamais dans « À facturer ».

**Pourquoi ce n'est PAS un défaut** : la page le dit elle-même, dans son propre en-tête
(`app/(back-office)/interventions/a-facturer/page.tsx`) : *« Elle ne lit AUCUNE intervention. […]
`statut_facturation` existe déjà en base, mais aucune lecture de cette colonne n'a de sens avant que
FACTURE-1 décide des règles de préparation. Inventer une liste ou un compte ici serait une valeur
devinée. »* C'est un EMPLACEMENT posé d'avance (TP-UX3-1-REGISTRE-1, QE-8), pas un défaut de ce
lot-ci — FACTURE-1 (QT-19) n'est pas encore passé.

---

## 7–11. Cinq comportements vérifiés, et confirmés corrects

Chacun aurait pu être un défaut ; la mesure dit le contraire. Les capturer ici évite qu'un futur
audit reparte des mêmes doutes.

- **(7) Deux onglets sur la même fiche** (point 3(d)) : le premier onglet transmet, le second —
  resté sur l'état « Planifiée » périmé — clique « Transmettre » lui aussi. Le serveur refuse
  nommément (`?motif=intervention.refus.pas_planifiee`) : aucune double transmission, aucun
  plantage muet. Capture : `captures/9f5-edge-deux-onglets-transmission-perimee-1280.jpg`.
- **(8) Rechargement pendant la frappe du rapport terrain** (point 3(e)) : un rechargement juste
  après avoir tapé, sans quitter le champ au clavier, n'a fait perdre AUCUN texte — le rechargement
  déclenche lui-même le `blur` qui enregistre, et l'écriture en base a été vérifiée directement
  (colonne `intervention.commentaire_technicien`), après avoir vidé le brouillon local pour exclure
  une fausse preuve.
- **(9) Caractères spéciaux** (point 3(f)) : guillemets, apostrophes, accents, émoji, et une balise
  `<script>` collée dans la description d'une intervention s'affichent tels quels — jamais exécutés
  (vérifié par l'absence de tout dialogue natif et par une variable globale qui serait restée à
  `true` si le script avait tourné).
- **(10) Terrain hors réseau** (point 3(i)) : CONTREDIT la note « CE QUI EXISTE » de ce ticket, qui
  se savait périmée (*« revérifie, des lots sont passés depuis »*) — `/terrain` et `/terrain/[id]`
  affichent leurs VRAIES données hors réseau, avec un bandeau « Hors connexion — copie du
  <date>, lecture seule ». Les lots `9F4H1-HORS-RESEAU-CONSULTATION`, `9F4H2A-REJEU-SANS-DOUBLON` et
  `9F4H4-HORS-RESEAU-OUVERTURE-A-FROID` (visibles dans l'historique git récent) ont déjà livré cette
  consultation hors réseau — L3-07 n'est donc plus entièrement « au backlog ». Captures :
  `captures/9f5-edge-terrain-hors-reseau-375.jpg`, `captures/9f5-edge-terrain-fiche-hors-reseau-375.jpg`.
- **(11) Pause méridienne, hors ouverture par l'heure** (point 3(c)) : refusée sans la case
  « Je confirme la pose hors des horaires d'ouverture », acceptée et mentionnée (« Posée hors
  ouverture, confirmée par … ») avec — exactement la même discipline D93 que les trois fichiers
  existants vérifient déjà pour un JOUR fermé, mais qu'aucun ne vérifiait pour une HEURE fermée un
  jour par ailleurs ouvert. Capture : `captures/9f5-edge-hors-ouverture-confirmee-1280.jpg`.

---

## Ce qui n'a PAS pu être audité, et pourquoi

- **(b) Demande → transformation en intervention** : territoire déjà couvert en profondeur par
  trois fichiers e2e existants (`demandes.spec.ts`, `demandes-2.spec.ts`,
  `demandes-marquer-transformee.spec.ts`) — non rejoué par manque de temps restant, pas par absence
  de couverture.
- **(g) Import avec rejets puis réimport** : non atteint — le budget de parcours neufs (90 min) a
  été consommé par les points 2 et 3(a, c, d, e, f, i), jugés plus rentables (enchaînements jamais
  éprouvés plutôt qu'un écran isolé déjà couvert).
- **(h) Parc/VGP : nouvelle machine → VGP** : non atteint, même raison.
- **La transmission GROUPÉE** (« Transmettre toutes les planifiées prêtes », « Transmettre demain »)
  n'a pas été rejouée à l'écran — seul le code (`motifsNonTransmissible`) a été lu, ce qui a nourri
  le constat 2. Un audit futur pourrait vérifier à l'écran que l'exclusion de `date_passee` s'y
  affiche bien, nommément.
- **Le `jour fermé` via le dialogue manuel** n'a pas été réaudité : déjà couvert par
  `creation-jour-ferme.spec.ts` (deux scénarios, refus et confirmation).
