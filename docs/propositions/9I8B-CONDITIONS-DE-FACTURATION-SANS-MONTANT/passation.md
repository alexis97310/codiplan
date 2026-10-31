# 9I8B-CONDITIONS-DE-FACTURATION-SANS-MONTANT — passation

Les huit points du brief sont faits. Aucune migration, aucune politique RLS, aucun droit modifié.

## Point 1 — mesure

- Écran de signature du technicien : `components/terrain/rapport-automatique.tsx` (le composant,
  rendu avant la zone de signature), sa page serveur `app/(mobile)/terrain/[id]/page.tsx`. Le bloc est
  inséré juste avant la section « Signature » (anciennement ligne 1947).
- Le bon : `app/(back-office)/interventions/[id]/bon/page.tsx` (tuiles, `valorisationTuile` ~l.484,
  réservée à `interne`), `lib/interventions/bon.ts` (`forfaitLibelle` — en réalité le libellé du
  FORFAIT DE DÉPLACEMENT, voir plus bas — `montantTotal`). `version-bon.ts`/`montants-visibles.ts`
  n'ont pas changé : ce lot ne touche à aucun droit.
- Facturation : `lib/tarification/valorisation.ts` (`valoriserIntervention`, trois modes : `forfait`,
  `temps_passe`, `forfait_plus_heures` ; la majoration D12/D108 vient de `lib/tarification/
  majoration.ts`), `lib/tarification/forfaits.ts` (le catalogue, le forfait de DÉPLACEMENT).
- La règle du temps (9I8A1-REPRISE-9I8A) : trois colonnes sur `societe` (`facturation_plancher_min`,
  `facturation_palier_min`, `facturation_seuil_palier_min`, `prisma/schema.prisma` ~l.186-188),
  figées à la clôture dans `intervention.valorisation_figee` (~l.1822) et relues par
  `lireFicheIntervention` (`lib/interventions/depot.ts`) sans jamais recalculer une fiche close.
- Ce que le technicien peut lire aujourd'hui : rien ne l'empêchait de lire le libellé d'un forfait ou
  les trois réglages de règle par une requête — ce n'est pas une politique RLS qui le protège, c'est
  l'ÉCRAN qui ne les affichait pas (même nature que la note de `montants-visibles.ts`). **Aucune
  politique RLS ni aucun droit n'a donc eu besoin de changer** : le point d'arrêt prévu par le brief
  ne s'est pas présenté.

**Mesuré, pas supposé** : `forfait_deplacement_id` est la SEULE relation de forfait qu'une
intervention porte en base aujourd'hui. Rien ne sélectionne de forfait de PRESTATION
(`lib/tarification/valorisation.ts`, `exigeUnForfaitDePrestation` — « rien ne sélectionne de forfait
de prestation »). La phrase « Intervention facturée au forfait » (mode `forfait`/`forfait_plus_heures`)
n'a donc JAMAIS de libellé à nommer tant que ce choix n'existe pas (lot 2, types d'intervention) —
`conditionsDeFacturation` rend alors la phrase sans libellé (« Intervention facturée au forfait. »),
documenté dans D225 et dans le docblock de `lib/tarification/conditions.ts`.

## Point 2 — `lib/tarification/conditions.ts`

Fonction pure `conditionsDeFacturation`, testée à l'unité (14 épreuves) : les deux règles explicites
du brief (60/30/5 et 60/15/1), un plancher ≠ 60 min nommé en toutes lettres, le forfait (avec et sans
libellé), `forfait_plus_heures` (porte les deux), le déplacement (présent/absent), la majoration
(présente/absente), et une épreuve qui mesure qu'AUCUNE ligne ne porte jamais ni la forme de
`formatMoney` ni un code de devise — y compris pour un libellé de forfait LIBRE qui contient un
chiffre sans en être un montant (« Forfait VIP — 5000 points fidélité »), cas noté en commentaire dans
le test plutôt que supposé.

## Point 3 — l'écran de signature

`lib/interventions/depot.ts` porte le SEUL chemin qui calcule la règle de société et la majoration
(un booléen, jamais le supplément) pour un écran SANS montant : `lignesConditionsFacturation`. Elle
existe précisément pour qu'AUCUN appelant n'ait à écrire `mode_valorisation` ou `devise_code` dans son
propre fichier — le gardien statique `tests/unit/terrain/sans-montant.test.ts` cherche justement ces
noms dans les écrans du terrain, et il a été ÉTENDU à `components/terrain/rapport-automatique.tsx` par
ce lot. `app/(mobile)/terrain/[id]/page.tsx` appelle cette fonction et passe le résultat (déjà en
texte) en prop `conditionsFacturation`.

**Écart mesuré, assumé** : la coquille hors réseau (`components/terrain/consultation-hors-reseau.tsx`,
alimentée par la copie locale de `/api/terrain/instantane`) reçoit `conditionsFacturation={[]}` — le
bloc n'apparaît donc PAS en mode hors réseau. L'instantané ne porte pas ces lignes aujourd'hui ; les y
ajouter aurait exigé de toucher `app/api/terrain/instantane/route.ts` et le format de la copie locale
(IndexedDB), hors du temps de ce lot. Rien ne régresse (I4 : les gestes qui fonctionnaient hors réseau
le font toujours), mais l'affichage des conditions, lui, n'est pas encore un geste qui fonctionne hors
réseau. Noté dans D225.

Épreuve e2e dédiée (`tests/e2e/9i8b-conditions-de-facturation-sans-montant.spec.ts`, sa propre scène,
préfixée `9I8B-`) : le bloc est visible, la règle et le déplacement s'affichent (lignes rendues par la
fonction de production, jamais recopiées à la main — le gardien L0-11 l'aurait refusé sinon, voir plus
bas), le HTML de la fiche ET les réponses réseau de `/api/terrain/instantane` sont scrutées contre la
forme d'un montant et contre les codes de devise.

## Point 4 — le bon

`BonIntervention.conditionsFacturation` (nouveau champ), calculé par `lignesConditionsFacturation` dans
le MÊME `Promise.all` que les quatre autres blocs hors transaction (prestations, photos, signature,
pièces) — pas de requête supplémentaire sur l'intervention elle-même. Rendu dans une tuile dédiée,
juste après la tuile « Intervention » comme la tuile Valorisation (qui elle reste réservée à
`interne`), sur LES DEUX versions.

**La règle figée** (brief : « règle lue telle qu'elle était à la clôture si 9I8A l'a figée, sinon
celle de la société ») : `lignesConditionsFacturation` prend un paramètre optionnel `figee` qui, pour
une intervention clôturée AVEC décomposition figée, décode `valorisation_figee` et en tire la règle et
la majoration RÉELLEMENT appliquées — jamais le réglage courant. Pour une clôture ANTÉRIEURE à
9I8A1 (sans figée), elle retombe sur `REGLE_HISTORIQUE`, exactement comme `lireFicheIntervention`.
Mesuré par une épreuve d'isolation qui change le réglage de la société APRÈS la clôture et vérifie que
le bon continue de dire l'ANCIENNE règle.

## Point 5 — registre

D225, `docs/arbitrages.md` : les deux citations d'Alexis (conditions sans montant ; tarifs chiffrés
dans l'espace client, à venir) et les deux écarts mesurés (forfait de prestation sans libellé,
coquille hors réseau non alimentée).

## Point 6 — captures

- `terrain-conditions-facturation-375.png` (écran de signature, 375 px)
- `bon-conditions-facturation-client-375.png` et `-1280.png` (bon, version client)

## Un piège rencontré, pour la prochaine session

Le gardien `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` (L0-11) analyse aussi les fichiers
`tests/e2e/*.spec.ts` : toute chaîne littérale passée à `page.getByText(...)`/`getByRole({name:...})`
y est une faute, MÊME composée par template literal avec un fragment du dictionnaire + un littéral
(ex. le `.` final). Les deux épreuves e2e de ce lot appellent directement `conditionsDeFacturation`
(la fonction de PRODUCTION) pour obtenir le texte attendu, plutôt que de le recomposer à la main —
même discipline que `formatAdresseSite` déjà réutilisée par `9f4-terrain-enregistrement-auto.spec.ts`.

## `pnpm verify:full`

Lancé en entier, tracé dans `verify-final.txt` à côté de ce fichier.
