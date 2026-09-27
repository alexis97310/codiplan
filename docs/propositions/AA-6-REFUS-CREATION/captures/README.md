# Captures — AA-6-REFUS-CREATION

Écran « Créer une intervention » (`/interventions/nouvelle`), après soumission
sur un site rattaché à une agence (établissement) inactive. Le bandeau rouge
affiche le motif nommé `intervention.refus.agence_inactive` :

> Ce lieu est rattaché à un établissement inactif : rattachez-le d'abord à un
> établissement actif.

Le site (`AA6CAP-Client — AA6CAP-Site`) est forgé par la scène de
`tests/e2e/captures-9az-aa6-refus-creation.spec.ts`, prise après le commit
AA-6-REFUS-CREATION : une agence créée directement `actif=false`, avec un
site déjà rattaché — le fait antérieur que le refus protège. Le site reste
proposé par le sélecteur (RG-PLA-08 ne filtre que sur le client actif), et
c'est précisément pourquoi le refus SERVEUR est nécessaire.

- `refus-agence-inactive-1280.png` — 1280 px
- `refus-agence-inactive-375.png` — 375 px

Aucun AVANT n'a été produit : le refus n'existait pas avant ce ticket, et le
reproduire demanderait un second worktree hors du budget de ce lot (même
constat que `tests/e2e/captures-parcours-1.spec.ts`).
