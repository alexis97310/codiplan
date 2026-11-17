# 9L13-SUSPENDRE-ARRETE-COMPTEUR — passation

Démarré le 18/11/2026 à 08:00 (Nouméa), budget 90 min.

## La règle tenue

Décision d'Alexis du 10/11/2026 (« OK ») : suspendre une intervention ferme
désormais le segment de compteur ouvert, dans la même transaction que le
changement de statut. Avant ce lot, `cloturerIntervention` et
`annulerIntervention` REFUSAIENT déjà quand un compteur tournait (D160,
QT-4) — `suspendreIntervention` seule laissait courir le compteur pendant
une attente de pièce, et le temps mesuré pré-remplissait le temps validé
d'une durée qui n'était pas du travail.

## Ce qui est livré

### Point 1 — la suspension ferme le segment, en base

`lib/interventions/depot.ts` (`suspendreIntervention`) :

- avant d'écrire `statut = 'suspendue'`, cherche le segment OUVERT sur
  CETTE intervention (`fin IS NULL`) — celui d'un renfort compris, jamais
  seulement celui de l'auteur de la suspension (un renfort peut encore
  travailler quand le bureau suspend) ;
- s'il en existe un, le ferme (`fin = instant`, l'heure de l'agence, comme
  le reste de la fonction) PUIS relit tous les segments de l'intervention et
  réécrit `temps_mesure_min` comme leur somme — même ordre et même calcul que
  `arreterLeCompteur` (`depot-compteur.ts`) : le déclencheur
  `intervention_temps_mesure_est_celui_du_compteur` exige que cette colonne
  soit exactement cette somme, et il faut donc fermer le segment AVANT de
  l'écrire ;
- aucun segment ouvert (l'intervention n'a jamais démarré de compteur, ou
  l'a déjà arrêté) : rien de plus ne s'écrit, `temps_mesure_min` reste ce
  qu'il était.

`reprendreIntervention` n'était déjà touché par aucun geste sur
`segment_travail` — vérifié, la reprise n'ouvre toujours aucun segment,
seul un geste explicite sur le compteur (« Démarrer »/« Reprendre le
compteur ») en rouvre un.

### Point 2 — la file hors réseau

Vérifié dans `lib/terrain/envoi-file.ts` (`ORDRE_PIPELINE`) : `compteur`
(rang 0) part déjà avant `suspendre` (rang 3) — rien à changer là. Et avec
le point 1, l'ordre importe désormais moins qu'avant : la seule entrée
`suspendre`, envoyée seule, suffit à faire fermer le segment côté serveur
— aucun geste `compteur: arrêter` n'est jamais mis en file par
`BoutonSuspendreTerrain` (vérifié dans le composant), et il n'en a plus
besoin.

### Point 3 — épreuves et captures

- `tests/isolation/suspension.test.ts` — cinq scénarios nouveaux : aucun
  segment ouvert après suspension ; le temps mesuré est figé (n'augmente
  pas avec l'horloge) ; la reprise n'ouvre rien ; une suspension sans
  compteur en cours ne touche à rien ; le segment d'un RENFORT se ferme
  aussi quand ce n'est pas lui qui suspend.
- `tests/e2e/9l13-suspendre-arrete-compteur.spec.ts` (nouveau) — en ligne et
  en mode avion, à 375 et 1280 px : le bandeau « Le compteur tourne
  depuis » disparaît après « J'attends une pièce », remplacé par le refus
  de redémarrage (`compteur.refus.suspendue`) ; en mode avion, seule la
  suspension part en file (jamais un arrêt explicite), et le segment est
  pourtant bien fermé une fois « Envoyer » pressé — la preuve que le point
  1 couvre ce cas sans aide du client.
- Captures dans `docs/propositions/9L13-SUSPENDRE-ARRETE-COMPTEUR/captures/`
  (avant/après, 375 et 1280 px) pour le scénario en ligne.
- `docs/arbitrages.md` — D270.

## Ce qui n'a pas été livré, et pourquoi

Aucune migration : rien ne manquait en base pour ce geste (`segment_travail`
et son unicité « un seul segment ouvert par personne » existaient déjà).

## Note sur l'environnement de ce poste

`pnpm build` (donc `CI=1 pnpm verify`, dernière étape) a échoué par manque
de mémoire sur la passe « Linting and checking validity of types » de
`next build`, à la limite `--max-old-space-size=6144` fixée dans
`package.json` — alors que `pnpm typecheck` et `pnpm lint`, joués juste
avant dans la MÊME exécution de `pnpm verify`, passent sans alerte à cette
même limite. Rejoué isolément avec `--max-old-space-size=9216`, `next
build` passe sans erreur. Mesuré : ce n'est pas une régression de ce lot —
aucun fichier de ce lot n'ajoute une surface significative au typage de
l'application, et le même échec se reproduit à l'identique sur une
exécution de `pnpm build` seul, sans rapport avec `suspendreIntervention`.
Rien n'a été changé dans `package.json` pour contourner ceci : une
augmentation de la limite committée serait une décision distincte, hors de
ce ticket.
