# Captures — 9EF-TP-UX4-2-FICHES-2

Commit mesuré : `1c948401` (verrouillé par `git rev-parse HEAD` au moment du lot ; ce commit porte le même
contenu que la version APRÈS ci-dessous — seul `docs/propositions/` change entre ce commit et le suivant).
Prises le 10/10/2026, à 1280 px et 375 px, par `tests/e2e/captures-9ef-fiches-2.spec.ts`
(`CAPTURES_9EF2=docs/propositions/9EF-TP-UX4-2-FICHES-2/captures pnpm exec playwright test tests/e2e/captures-9ef-fiches-2.spec.ts`).

**APRÈS SEULEMENT** — aucune image AVANT n'a été prise sur `main` avant ce lot (même déviation que
9EF-TP-UX4-2-FICHES-1, qui ne portait pas non plus de captures AVANT ; voir la passation, « Ce que je n'ai
pas fait »).

Scène : les fiches machine viennent de la scène de DÉMONSTRATION (`pnpm db:seed`, lecture seule) ; les
fiches contact viennent d'une scène propre au ticket (`CLIENT_9EF2`/`SITE_9EF2`, créée et supprimée par le
spec).

| Fichier | Écran | Ce que ça prouve |
|---|---|---|
| `fiche-machine-en-service-{1280,375}.png` | `/parc/<id>` (machine EN SERVICE) | En-tête au gabarit (surtitre, titre objet, pastille), pas d'alerte |
| `fiche-machine-en-panne-{1280,375}.png` | `/parc/<id>` (machine EN PANNE) | Alerte ROUGE (décision 54), faits à icônes (Client, Site, N° de série, Année de vente, VGP), « Corriger la fiche » et « + Intervention » en tête |
| `fiche-client-interlocuteurs-ferme-{1280,375}.png` | `/clients/<id>?onglet=interlocuteurs` | Titre « Interlocuteurs (n) », téléphone/mobile/courriel en liens visibles sans clic, pastille bleue du donneur d'ordre, « Reçoit les courriels de planification. » |
| `fiche-client-interlocuteurs-ouvert-{1280,375}.png` | idem, après clic sur « + Interlocuteur » | Le formulaire de création s'ouvre, dernier élément du bloc |
| `fiche-site-interlocuteurs-ferme-{1280,375}.png` | `/sites/<id>` | Même bloc, côté site |
| `fiche-site-interlocuteurs-ouvert-{1280,375}.png` | idem, après clic sur « + Interlocuteur » | Formulaire ouvert, côté site |
