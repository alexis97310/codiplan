# Captures — 9BN-TP-A3-RAPPORT-IMPORT

Audit du 28/09/2026 (VERIF-PA-MO), constats PA-53, PA-54, PA-55, PA-56, PA-48, PA-51, PA-58.

Prises par `tests/e2e/captures-tpa3-rapport-import.spec.ts` (env `CAPTURES_TPA3_RAPPORT_IMPORT`),
sur sa propre scène (classeurs fabriqués, codes externes préfixés `TPA3-`, lots et fiches nettoyés
en `afterAll`).

- `*-avant-*.png` — rejoué sur le code d'AVANT ce ticket, via un `git worktree` sur le commit
  `2cdee2b` (9BM-PG-G7-ANNULER-DUREE-CREATION — passation), le dernier avant ce ticket.
- `*-apres-*.png` — après le premier commit de ce ticket (`42aeac7`,
  9BN-TP-A3-RAPPORT-IMPORT — durée, textes au passé, rejets groupés, annulation confirmée, lot
  introuvable).

À 1280 et 375 px.

## Ce que chaque paire montre

- `imports-liste-*` — AVANT : « Télécharger le modèle Excel » affiché inerte à côté de son motif,
  et « Contacts » listé en « Contrôle seulement ». APRÈS : le bouton est retiré, Contacts n'apparaît
  plus dans « Imports disponibles » (PA-48, PA-51).
- `rapport-rejets-replie-*` puis `rapport-rejets-ouvert-*` — un classeur de vingt clients à raison
  sociale vide. AVANT : vingt lignes, chacune répétant le motif complet. APRÈS : un seul groupe
  replié (« … 20 — Voir les 20 lignes »), ouvert au clic, le motif ne se lit plus qu'une fois
  (PA-55).
- `rapport-applique-*` — un lot appliqué dont la durée mesurée a été effacée en base (comme
  `tests/isolation/ecran-import.test.ts` pose un type à la main), pour capturer l'anomalie plutôt
  que le cas courant. AVANT : « non mesurée — ce lot n'a pas encore été appliqué » sur un lot
  pourtant appliqué, et les décomptes au futur (« seront créés », « seront mis à jour »). APRÈS :
  « non mesurée » seule, et les décomptes au passé (« ont été créés », « ont été mis à jour »)
  (PA-53, PA-54).
- `dialogue-annulation-*` — clic sur « Annuler ce lot » depuis l'écran `rapport-applique`. AVANT :
  rien n'ouvre de dialogue — le clic soumettait directement le formulaire, et la capture montre le
  lot déjà passé au statut « Annulé », bandeau « Le lot a été annulé, et tout a été défait. » APRÈS :
  un dialogue de confirmation s'ouvre d'abord, citant les chiffres du contrôle (« Ce lot a créé 1
  fiche(s) et en a modifié 0 au contrôle. ») avec « Revenir » et « Confirmer l'annulation » — rien
  n'est encore annulé tant qu'on n'a pas cliqué dedans (PA-56).
- `lot-introuvable-*` — `/imports/00000000-0000-0000-0000-000000000000`. AVANT : un `<main>` nu,
  sans surtitre de domaine ni `<h1>` (seule la barre de navigation du back-office, commune à tout
  l'écran, reste visible). APRÈS : le gabarit `Page` complet (surtitre « PARAMÈTRES », `<h1>` « Rapport
  de contrôle », lien de retour), le message d'introuvable inchangé (PA-58).
