# 9L04L-CAPTURES-REGENEREES — passation

## Ce qui a été trouvé AVANT de régénérer quoi que ce soit

La procédure décrite par `docs/captures/README.md` était **cassée**, et pas par la série
9L04C…9L04K : la connexion d'un compte à second facteur (`admin_societe`, `direction`)
échouait systématiquement, dès le second essai de connexion dans la même prise de vue.

Cause isolée (via une reproduction au `curl`, hors Playwright, pour éliminer les
hypothèses de délai et de limite de débit) : `/connexion/code` porte **trois** boutons
`button[type="submit"]` — « Retour à la connexion » (déconnexion, premier dans le DOM),
« Vérifier » (le bon), « Utiliser » (code de secours). `scripts/captures.mts` ciblait
`page.click('button[type="submit"]')` sans le scoper à son formulaire : Playwright
résolvait le **premier** bouton — la déconnexion — et le code TOTP n'était jamais
présenté. Corrigé en scopant le clic à `form[action="/api/session/code"]`.

Au-delà de ce correctif, plusieurs témoins et chemins de `scripts/captures.mts` avaient
suivi des renommages applicatifs sans être mis à jour (liste complète dans le message du
commit). Le plus coûteux à diagnostiquer : `/parametres/forfaits` n'a plus de page
propre (le catalogue a migré vers `/parametres/tarifs`), et le témoin nu « Forfaits »
matchait en réalité le lien de navigation — la capture précédente photographiait un
écran différent sous ce nom sans qu'aucune assertion ne rougisse.

`COURRIEL` est passé d'un rôle restreint à `direction` : `admin_societe` masque la carte
« Priorités opérationnelles » du tableau de bord (c'est voulu, D37 — il n'administre que
comptes, agences et habilitations, jamais les montants), ce qui faisait échouer son
témoin sans que l'écran soit cassé. `COURRIEL_MULTI` a repris l'identité `admin_societe`
(habilitation ajoutée en SQL sur la société EU, **sur la seule base jetable de cette
prise**, jamais dans `prisma/seed-data.ts`) puisque `direction` sert déjà `COURRIEL`.

## Durée de la procédure

Un cycle complet (base jetable détruite et recréée, migration, semis, construction,
serveur, amorçage des trois identités, prise de vue) prend environ **90 secondes** une
fois le serveur construit, et l'essentiel de ce lot a été passé à diagnostiquer les
témoins périmés plutôt qu'à attendre la procédure elle-même. Elle a été rejouée sept
fois en tout au cours de ce lot.

## Écrans ajoutés à la liste

Aucun. La consigne permanente anticipait des écrans neufs de la série 9L04C…9L04K
(feuille d'une photo, récapitulatif, feuille « Terminer », réglage des familles de
prestations, « Rétablir l'accès ») : à l'examen, aucun ne correspond à un ÉCRAN séparé —
ce sont des états d'un écran déjà photographié (la feuille « Terminer » et la feuille
d'une photo non conforme sont des volets de la fiche terrain, déjà capturée sous
`terrain-intervention` ; « Rétablir l'accès » est un bouton de `parametres-equipe`, déjà
capturé). Rien n'a donc été ajouté.

## Écran retiré

`agence-modification` : `/parametres/agences/[agenceId]/modifier` n'existe plus comme
route distincte — l'édition d'une agence est désormais un formulaire EN LIGNE sur sa
fiche (`app/(back-office)/parametres/agences/[agenceId]/page.tsx`, action
`.../modifier`), déjà photographiée sous `agence-detail`. Un second écran aurait
photographié la même page. La fonction de découverte devenue inutile
(`premierLienDeModificationAgence`) a été supprimée avec lui.

## Écrans dont l'aspect a changé depuis la dernière prise (ad4feee9, 27/09/2026)

Toute la série 9L04B…9L04K a changé l'application technicien (`terrain`,
`terrain-intervention`) : fond peint, filets au lieu de cartes, barre d'action fixe,
checklist épurée, détail du point non conforme. Elle était déjà captée par les lots
9L04B à 9L04K individuellement — cette régénération ne fait que la rafraîchir sur un
commit plus récent. Au-delà : `tableau-de-bord`, `interventions`, les écrans de
paramètres administratifs et la fiche d'agence sont désormais visibles dans leur forme
RÉELLE pour la première fois depuis longtemps — les prises précédentes de ces écrans
sous un compte restreint ou sous un harnais cassé ne montraient pas ce qu'un rôle
`direction` voit réellement.

## Ce qui n'a pas pu être photographié, et pourquoi

Deux refus, tous deux légitimes et déjà documentés par le script lui-même (voir
`docs/captures/README.md`, section « Refusées à cette prise ») :

- **`portail`** (4 images) : aucun compte portail ne peut recevoir de lien de premier
  accès aujourd'hui (D10 — un compte portail n'a aucune ligne dans `utilisateur_societe`,
  et l'amorçage en exige une). Limitation architecturale connue, pas un défaut de cette
  prise.
- **`demande-detail`** (4 images) : le semis de démonstration ne pose aucune ligne dans
  `demande` (table vide à 0 ligne, vérifié directement en base). Le registre
  `/demandes` lui-même SE photographie (témoin corrigé), mais aucune fiche n'existe à
  détailler.

## État du dépôt

- Aucun changement de code applicatif, aucune migration, aucune donnée de production.
- `scripts/captures.mts` modifié (le harnais de prise de vue, pas l'application).
- `docs/captures/` régénéré en entier (README + 172 images, dont les nouvelles largeurs
  1024/375 déjà en place depuis une série antérieure).
- La base jetable utilisée (`codiplan_captures`, conteneur `codiplan-pg-voie1`, port
  5441) a été détruite après la dernière prise ; le serveur de capture a été arrêté.
