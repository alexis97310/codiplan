# Captures — 9EF-TP-UX4-2-FICHES-1

Prises après le lot seulement (voir la passation, « ce que je n'ai pas fait » —
aucune image AVANT n'a été prise sur `main` avant de commencer à écrire).
Commit mesuré : voir `git log -1` au moment de la prise (10/10/2026).

Scène propre, préfixée `9EF1-`, créée et supprimée par
`tests/e2e/9ef-tp-ux4-2-fiches-1.spec.ts` (`CAPTURES_9EF1=1 pnpm exec
playwright test tests/e2e/9ef-tp-ux4-2-fiches-1.spec.ts -g captures`). Compte
`adv`.

| Écran | Fichier | Ce qu'il prouve |
|---|---|---|
| Fiche client, Aperçu | `fiche-client-apercu-{375,1280}.png` | En-tête à faits, pastille Actif, cinq tuiles, onglets, À traiter, Sites en carte, Historique, Interlocuteurs, Identité en lecture |
| Fiche client, onglet Interventions (« Toutes ») | `fiche-client-interventions-{375,1280}.png` | Le tableau paginé, inchangé, sous son nouvel onglet |
| Fiche client, onglet Identité | `fiche-client-identite-{375,1280}.png` | Le formulaire d'écriture existant, derrière « Modifier » |
| Fiche site, lecture | `fiche-site-lecture-{375,1280}.png` | Faits (Client, Adresse, Horaires, Trajet, Zone · agence), consignes en bandeau, Machines du site, Historique, VGP du site, Qui sera prévenu, Habilitations, Interlocuteurs |
| Fiche site, formulaire | `fiche-site-modifier-{375,1280}.png` | Le formulaire d'écriture existant, derrière « Modifier » (`?edition=site`) |

Rôle responsable matériel (RM/RS), fiche client inactif, fiche site sans
consignes : non capturés — hors du temps disponible pour ce lot, à nommer en
passation.
