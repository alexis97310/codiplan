# 9EY-EQUIPE-ALERTE-TOUT-ENVOYER — passation

## `CI=1 pnpm verify:full` EN ENTIER, EN UN SEUL APPEL — VERT

Rejoué APRÈS le commit du point 6 (HEAD `f83bb971`) : `format:check`,
`typecheck`, `lint`, `test` (4750 passed), `test:isolation` (1570 passed),
`build`, `feries:horizon`, `audit:partitions`, `test:e2e` (suite ENTIÈRE) —
sortie :

```
48 skipped
1351 passed (52.8m)
```

Code de sortie 0. La suite e2e complète a régénéré 227 captures PNG/PDF
d'autres tickets (effet de bord connu de `test:e2e` en entier, aucune
n'appartient au territoire de ce lot) : les modifiées restaurées
(`git checkout --`), les neuves non trackées supprimées — arbre propre,
aucune capture étrangère committée.

## CE QUI EST LIVRÉ (4 commits `9EY-EQUIPE-ALERTE-TOUT-ENVOYER`, écran Équipe terminé)

1. **Point 1 — route d'envoi groupé.** `POST /api/equipe/envoyer-acces/tous`
   calcule elle-même sa population (techniciens actifs + comptes de bureau de
   la société active dont l'accès n'est pas « actif ») — jamais reçue du
   formulaire. Un échec par personne (refus nommé, courriel non parti,
   `RefusEnvoiAcces`) est compté, sans arrêter les autres envois. Garde
   `exigerCapacite("administrer_utilisateurs")`, enregistrée dans
   `ROUTE_CAPACITE` (82 routes). 4 tests unitaires (mocks) :
   `tests/unit/equipe/envoyer-acces-tous.test.ts`.
2. **Point 2 — alerte + dialogue « Tout envoyer » à l'écran.**
   `AlerteAccesAOuvrir` (`alerte-acces.tsx`) — vue par défaut seulement, texte
   singulier/pluriel composé hors du dictionnaire (D26), **aucun
   `role="status"`** (voir le piège nommé par le pilote — six épreuves
   existantes exigent ce compte à 0). Dans `?acces=a-ouvrir`, une barre de
   filtre porte le même bouton. Bandeau de retour (succès vert / échec
   partiel orange) composé hors du dictionnaire, jamais via `BandeauMotif`
   générique (le nombre ne s'y traduit pas).
3. **Point 3 — « Renouveler <CODE> ».** `renouvelerAttribution`
   (`lib/habilitations/depot.ts`) met à jour la MÊME ligne (jamais un retrait
   suivi d'une recréation), désignée par société (refus `introuvable` sinon).
   `schemaRenouvellementAttribution` exige une expiration strictement
   postérieure à l'obtention. Route `POST /api/habilitations/attributions/
   [id]/renouveler`. Lien-bouton sous les tags du tableau et dans le pied des
   cartes, pour chaque habilitation EXPIRÉE. 4 tests unitaires + 2 scénarios
   d'isolation (le jumeau qui débloque une affectation ; une tentative
   depuis une autre société, refusée sans rien changer).
5. **Point 5 — épreuves e2e neuves et captures**, fixtures `zz9EY-`/
   `zz9EYCAPT-`, nettoyage `afterAll` : voir « CE QUI N'A PAS ÉTÉ FAIT »
   ci-dessous pour ce que le scénario (b) ne couvre pas, et pourquoi.
6. **Doc** : D205 dans `docs/arbitrages.md` (ferme la condition de
   réouverture de D204).

## UN VRAI BUG MESURÉ ET CORRIGÉ EN ÉCRIVANT CE LOT

**Le dialogue « Tout envoyer » posé AVANT le tableau dans le DOM cassait une
épreuve EXISTANTE, hors territoire** — `9eg2-tableau-de-bord-direction-admin.
spec.ts`, « la tuile « Accès à ouvrir » ouvre l'équipe filtrée… », cherche le
nom de SON technicien par `getByText(nom).first()`. Un `<dialog>` fermé reste
dans le DOM (`display: none` natif, jamais retiré) : posé avant le tableau,
le dialogue (qui liste les mêmes personnes que l'alerte) créait une occurrence
MASQUÉE du nom, AVANT sa ligne visible — `.first()`, sans égard à la
visibilité, retenait l'occurrence masquée, et l'épreuve échouait avec
« expected visible, received hidden ». **Corrigé en reposant l'alerte/la
barre de filtre APRÈS le tableau et les cartes** (commentaire au point
d'insertion dans `page.tsx`) — un écart nommé avec la position de la
maquette, voir D205.

**Second effet de bord mesuré sur la même épreuve voisine, de nature
différente** — le premier jet du scénario (b) de 9EY cliquait réellement sur
« Envoyer les N liens ». La route envoie à TOUTE la société active, jamais
filtrée sur mes fixtures : ce clic envoyait donc aussi un lien à CHAQUE AUTRE
personne sans accès actif de la scène partagée au moment où l'épreuve
tournait — dont le technicien de `9eg2-...`, dont une épreuve VOISINE suppose
l'état intact (« Aucun lien envoyé »). Le clic a été RETIRÉ du scénario (b) ;
l'envoi réel reste couvert sans aucun effet de bord par
`tests/unit/equipe/envoyer-acces-tous.test.ts` (mocks).

Les deux corrections sont documentées en commentaire à leur point d'écriture
(`page.tsx`, `tests/e2e/9ey-equipe-alerte-tout-envoyer.spec.ts`) — à relire
avant de toucher à nouveau la position de cette alerte ou d'écrire une
épreuve e2e qui cliquerait réellement sur « Tout envoyer » contre la scène
partagée.

## CE QUI N'A PAS ÉTÉ FAIT (budget de temps)

- **Point 4 — les reliquats de la revue 9ET-2** (186, 187, 191, 192) ne sont
  PAS repris : le budget de temps a été entièrement consommé par les points
  1, 2, 3 et 5, et par les deux correctifs ci-dessus (non prévus par le
  pilote, mesurés en écrivant ce lot). Rien n'a été commencé sur ce point ;
  aucun fichier de son territoire (`lib/tableau-de-bord/lectures.ts`,
  `sousTexteAccesBureau`, `volet-equipe.spec.ts`) n'a été touché.
- **Scénario (b) du point 5 — le clic final n'est PAS joué en e2e**, pour la
  raison ci-dessus (pollution de la scène partagée). L'envoi réel (succès,
  décompte du bandeau) est couvert par le test unitaire mocké. Un scénario
  d'échec PARTIEL (certains partis, d'autres non) est également hors budget,
  et couvert par le même fichier unitaire.
- **`pnpm test:isolation` EN ENTIER** — à rejouer avant de clore le lot
  (ciblé : `alimentation-habilitations.test.ts`, vert, 6/6).
- **`CI=1 pnpm verify:full` EN ENTIER** — voir le résultat consigné ci-dessous
  si le budget de temps l'a permis, sinon à rejouer avant tout lot suivant.

## TERRITOIRE TOUCHÉ, FIDÈLE À CE QUI ÉTAIT PRÉVU

`app/(back-office)/parametres/equipe/` (page.tsx, presentation.ts, deux
fichiers neufs `alerte-acces.tsx`/`dialogue-renouveler.tsx`),
`app/api/equipe/envoyer-acces/tous/`, `app/api/habilitations/attributions/
[id]/renouveler/`, `lib/habilitations/depot.ts` (fonction neuve
`renouvelerAttribution`), `lib/habilitations/saisie.ts` (schéma neuf),
`lib/i18n/fr.ts` (clés neuves), `tests/unit/ui/plancher-12-pages.test.ts`
(liste), `tests/unit/auth/porte.test.ts` (ROUTE_CAPACITE), les épreuves
neuves. **Hors territoire, non touché** : `lib/auth/habilitations.ts`,
`lib/tableau-de-bord/lectures.ts`, `prisma/` (aucune migration),
`tests/e2e/setup/scene.ts`, `components/ui/*`,
`components/mise-en-page/page.tsx`, `lib/courriel/`.
