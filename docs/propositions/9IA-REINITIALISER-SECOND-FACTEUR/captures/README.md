# Captures — 9IA-REINITIALISER-SECOND-FACTEUR

Prises sur la scène de démonstration (base e2e jetable, `prisma/seed.ts`), société CODIMA
Nouvelle-Calédonie, compte `admin.societe@codima.test`. Une identité jetable (`9ia-capture@codima.test`,
rôle Direction, second facteur enrôlé pour de vrai) sert de cible. Aucune donnée de production.

## Fichiers

- `equipe-bureau-ligne-1280.png` / `equipe-bureau-ligne-375.png` — `/parametres/equipe?onglet=bureau`,
  la ligne du compte cible avec le bouton « Réinitialiser le second facteur » sous le badge « Actif ».
  Absent de la ligne « Administration de démonstration » (l'acteur lui-même) : B ne se réinitialise
  jamais lui-même.
- `equipe-bureau-confirmation-1280.png` / `equipe-bureau-confirmation-375.png` — le dialogue de
  confirmation ouvert, avec le message « Elle devra enregistrer son nouveau téléphone à sa prochaine
  connexion. »

## 9IA1-REPRISE-9IA — D226, exclusivité

- `9ia1-exclusivite-second-facteur-1280.png` / `9ia1-exclusivite-second-facteur-375.png` —
  `/parametres/equipe?onglet=bureau`, DEUX cibles jetables en vis-à-vis sur le même écran :
  « 9IA1 Capture Exclusif » (enrôlée pour de vrai, second facteur Actif) porte le bouton
  « Réinitialiser le second facteur » ; « 9IA1 Capture Partagé » (second facteur Actif, rattachée
  aussi à CODIMA Europe) ne le porte pas — un admin_societe ne contrôle pas entièrement cette
  identité (D226).
