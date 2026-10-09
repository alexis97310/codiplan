# Captures — 9EDZ-DEMANDES-CONNEXION-MAQUETTE

Générées par `tests/e2e/captures-9edz-demandes-connexion.spec.ts`, phase
`apres` uniquement (voir la passation, « ce que je n'ai pas fait » — la
phase `avant`, sur `8e9b760a`, n'a pas été rejouée).

| Écran | Fichier(s) | Ce qu'il prouve |
|---|---|---|
| `/demandes`, onglet « À traiter » | `demandes-apres-{1280,375}.png` | Sous-titre unique, colonne « Source », bouton « + Demande » |
| `/demandes/:id`, demande transformée | `demandes-id-apres-{1280,375}.png` | Carte « Suite donnée » avec le lien vers l'intervention issue |
| `/connexion` | `connexion-apres-{1280,375}.png` | Deux colonnes, bouton « Afficher », « Mot de passe oublié ? » avant le bouton |
| `/connexion/code` | `connexion-code-apres-{1280,375}.png` | Six cases, « ← Retour à la connexion » en tête, pli de secours |
| `/mot-de-passe-oublie` | `mot-de-passe-oublie-apres-{1280,375}.png` | Deux colonnes, retour en tête, deux paragraphes |
| Volet « Nouvelle demande » ouvert | `demandes-volet-ouvert-apres-{1280,375}.png` | Source, Client, Site, Machine, description |
| Volet après un refus | `demandes-volet-refus-apres-1280.png` | Bandeau rouge, volet rouvert |
| Liste avec le message de succès | `demandes-creee-apres-1280.png` | « Demande créée. » avec son lien |
| Onglet « À traiter », pastille | `demandes-pastille-apres-1280.png` | L'onglet s'allume (une demande en retard dans la scène) |
