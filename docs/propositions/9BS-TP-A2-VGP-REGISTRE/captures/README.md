# Captures — 9BS-TP-A2-VGP-REGISTRE

Prises le 29/09/2026.

- APRÈS photographié contre `main` au commit `3bbb7b0` (dernier commit de code
  du lot, avant cette passation).
- AVANT photographié contre le commit `5f483d0` (dernier commit de `main`
  avant ce lot), depuis un `git worktree` jetable — jamais en modifiant le
  code livré pour reculer.
- Les deux passages jouent le **même fichier**,
  `tests/e2e/captures-tpa2-vgp-registre.spec.ts` (committé, comme les autres
  specs `captures-*` du dépôt — inerte sous `pnpm test:e2e` ordinaire, il
  n'écrit rien sans `CAPTURES_TPA2`) : `CAPTURES_TPA2_PHASE` ne change que le
  nom du fichier produit, jamais le code exécuté. Aucune clé `fr[...]` n'y est
  lue, à dessein : sur le code AVANT, les clés neuves de ce lot n'existent pas
  encore.
- La scène (deux sites, quatre familles, quatre modèles, 53 machines sur le
  premier site + une en retard sur le second) est écrite directement par
  Prisma, jamais par l'application : le schéma ne change pas dans ce lot
  (« Pas de migration »), donc la même écriture vaut sur les deux commits.
- Deux largeurs par scène : 1280 px et 375 px. `fullPage`.
- Le refus de date future est capturé par NAVIGATION (`?motif=vgp.verifier.
  refus.date_future`), jamais par une écriture : sur le code AVANT, la clé
  n'existe pas encore et `estCleTraduction` la rejette silencieusement — le
  formulaire s'affiche donc sans bandeau, exactement l'état « avant ».

## Les huit scènes

| Fichier (préfixe) | Ce qui change |
|---|---|
| `fiche-site-depassee` | `/sites/{site en retard}` — AVANT : `prochaineEcheanceDuSite` rendait déjà la date, donc la tuile affichait une date SANS badge ni ton (texte noir) ; APRÈS : badge rouge « Échéance dépassée » + la lecture de la fiche machine |
| `fiche-site-sans-information` | `/sites/{site à 51 machines}` — **CS30 = PV-34** : AVANT la tuile affiche « — », confondant « aucune machine soumise » et « 51 soumises sans information » ; APRÈS : « 51 sans information » |
| `registre-page-1` / `registre-page-2` | `/vgp?q=TPA2CAP-` (`&page=2`) — AVANT : coupure muette à 200 lignes, aucun compte ni pagination (nos 53 lignes tiennent toutes sous la coupure, donc `page=2` rend la MÊME liste complète) ; APRÈS : compte « 53 machines », « Page 1 sur 2 », cinquième KPI « Sans information » |
| `registre-filtre-sans-information` | `/vgp?etat=sans_information&q=TPA2CAP-` — AVANT : `sans_information` n'est reconnu par aucun filtre, le registre entier (non filtré) s'affiche ; APRÈS : bandeau de filtre actif, 51 lignes |
| `registre-ligne-a-determiner` | `/vgp?q=TPA2CAP-A-DETERMINER` — AVANT : « Enregistrer » toujours visible, sans avertissement ; APRÈS : « Enregistrer » + « Comptera si la famille devient soumise. » |
| `registre-ligne-non-soumise` | `/vgp?q=TPA2CAP-NON-SOUMISE` — AVANT : « Enregistrer » visible malgré la famille non soumise (PV-33) ; APRÈS : masqué |
| `enregistrer-formulaire` / `enregistrer-refus-date-future` | `/vgp/enregistrer/{machine}` — AVANT : champ de date sans borne `max`, aucun bandeau pour le motif `vgp.verifier.refus.date_future` (clé inexistante) ; APRÈS : `max` posé, bandeau rouge affiché |
| `fiche-machine-qr` | `/parc/{machine}` — AVANT : « Le scan ouvre directement la fiche autorisée. » et la ligne « CODIPLAN:<référence> » sous le QR (PV-22) ; APRÈS : les deux retirés |
| `fiche-machine-modifier` | `/parc/{machine}/modifier` — AVANT : sous-titre citant des gestes qu'aucun autre écran ne porte (PV-25) ; APRÈS : sous-titre retiré |
