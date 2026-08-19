# CODIPLAN — Constitution du dépôt

Ce fichier est lu automatiquement par Claude Code à chaque session. Il fait autorité sur tout le reste.
Si une instruction de ce fichier contredit une demande ponctuelle, **signaler la contradiction avant d'agir**.

---

## 1. Ce qu'est ce projet

Plateforme web de gestion des plannings d'intervention de techniciens et du parc machines de leurs clients.
Multi-société, multi-devise, avec une application mobile hors-ligne et une console éditeur, la solution étant destinée à être vendue.

**Le cahier des charges fait foi** : `docs/cahier-des-charges.md` (v1.2, 23 chapitres).
Toute question fonctionnelle se tranche en le relisant, pas en improvisant. Si le cahier des charges est muet ou ambigu sur un point, **s'arrêter et poser la question** plutôt que d'inventer une règle métier.

Contexte d'exploitation : Nouvelle-Calédonie. Réseau mobile absent sur une partie du territoire, latence élevée vers l'hébergeur, monnaie sans décimale, fuseau UTC+11 sans changement d'heure.

---

## 2. Stack imposée

| Couche | Choix | Ne pas substituer |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | — |
| Style | Tailwind CSS + shadcn/ui | Pas de librairie UI supplémentaire |
| Base | PostgreSQL 16 + Row Level Security | — |
| ORM | Prisma | Pas de SQL brut hors migrations et politiques RLS |
| Auth | Better Auth, sessions serveur, MFA sur rôles sensibles | — |
| Validation | Zod, sur toute entrée serveur sans exception | — |
| Tests unitaires | Vitest | — |
| Tests bout en bout | Playwright | — |
| Excel | SheetJS | — |
| PDF | React-PDF | — |
| Gestionnaire de paquets | pnpm | Pas de npm ni yarn |

**Ajouter une dépendance est une décision, pas un réflexe.** Toute nouvelle dépendance doit être justifiée en une phrase dans le message de commit. En cas de doute, écrire les 30 lignes plutôt que d'ajouter 200 Ko.

---

## 3. Invariants non négociables

Ces neuf règles ne se discutent pas. Une modification qui en viole une est un défaut, même si elle compile et que les tests passent.

### I1 — Cloisonnement multi-société
Toute table métier porte `societe_id`. Toute requête est filtrée par société **côté serveur**, et la base applique en plus une politique RLS. Il n'existe aucun chemin de lecture qui ne porte pas le filtre.
*Vérification : `pnpm test:isolation` doit rester vert.*

### I2 — Jamais de conversion de devise ligne à ligne
Les montants sont stockés dans la devise de la société avec leur code. La conversion n'existe que dans les agrégats de consolidation, à parité datée et explicite.

### I3 — Décimales portées par la devise
XPF : zéro décimale. EUR : deux. Jamais de `toFixed(2)` en dur. Le formatage passe par `formatMoney(montant, devise)` et par rien d'autre.

### I4 — Le terrain fonctionne sans réseau
Toute fonctionnalité de l'application technicien doit être utilisable en mode avion : consultation, saisie, photos, signature, création de machine. Une fonctionnalité mobile qui exige le réseau est refusée.

### I5 — Le terrain fait foi sur l'exécution, le back-office sur la planification
Règle de résolution des conflits de synchronisation. Temps, diagnostic, checklist, photos, signature, création de machine → le terrain gagne. Affectation, créneau, priorité → le back-office gagne. Tout conflit est journalisé.

### I6 — Aucun import appliqué sans contrôle préalable
Un import Excel produit d'abord un rapport (créations, modifications, rejets motivés), puis attend une validation explicite. Il reste annulable intégralement pendant 24 heures.

### I7 — Calendriers propres à chaque site
Ducos ouvre du lundi au samedi, Koné du lundi au vendredi. Les jours fériés sont paramétrés par site et peuvent être travaillés. **Aucun calendrier global codé en dur.**

### I8 — Traçabilité
Toute création, modification ou suppression sur intervention, contrat, machine, paramétrage société ou compte client est journalisée avec auteur, horodatage et valeurs avant/après.

### I9 — Aucune donnée de production dans le dépôt
Pas de client réel, pas de photo, pas de clé, pas de fichier `.env`. Les jeux de test sont générés par `prisma/seed.ts`.

---

## 4. Commandes

```bash
pnpm dev              # serveur de développement
pnpm typecheck        # tsc --noEmit — zéro erreur exigé
pnpm lint             # eslint — zéro avertissement exigé
pnpm test             # vitest, tests unitaires
pnpm test:isolation   # tests de cloisonnement multi-société (bloquant)
pnpm test:e2e         # playwright
pnpm db:migrate       # prisma migrate dev
pnpm db:seed          # jeu de données de démonstration, 2 sociétés
pnpm build            # build de production
pnpm verify           # typecheck + lint + test + test:isolation + build
```

`pnpm verify` est la **porte de sortie de toute tâche**. Rien n'est terminé tant qu'elle échoue.

---

## 5. Définition de « terminé »

Une tâche n'est terminée que si **toutes** ces conditions sont réunies :

1. `pnpm verify` passe sans erreur ni avertissement.
2. Les critères d'acceptation du ticket sont couverts par au moins un test automatisé.
3. Aucun `any`, aucun `@ts-ignore`, aucun `eslint-disable` ajouté sans commentaire justifiant la ligne.
4. Aucun `console.log` résiduel.
5. L'interface est en français, avec la terminologie du glossaire (annexe A du cahier des charges).
6. Les nouvelles requêtes portent le filtre société.
7. Le message de commit décrit le *pourquoi*, pas le *quoi*.

**Interdit absolu :** modifier, désactiver ou assouplir un test pour faire passer la vérification. Si un test échoue, c'est le code qui est faux — ou le test révèle une ambiguïté du cahier des charges, auquel cas il faut s'arrêter et le signaler.

---

## 6. Organisation du code

```
app/
  (back-office)/        écrans desktop — planning, parc, interventions, contrats
  (mobile)/             PWA technicien
  (portail)/            portail client
  (editeur)/            console éditeur
  api/
lib/
  db/                   client Prisma, contexte société, helpers RLS
  auth/
  money/                formatage et arithmétique monétaire — point de passage unique
  calendar/             calendriers de sites, jours fériés, jours ouvrés
  sync/                 protocole de synchronisation hors-ligne
  excel/                imports et exports
  pdf/                  rapports et propositions
components/
prisma/
  schema.prisma
  migrations/
  seed.ts
tests/
  unit/
  isolation/            cloisonnement multi-société — ne jamais alléger
  e2e/
docs/
  cahier-des-charges.md
  decisions/            un fichier par décision technique structurante
```

**Conventions de nommage.** Le domaine métier est en français : `intervention`, `machine`, `contrat`, `societe`, `technicien`, `echeance`. Le code technique est en anglais : `createIntervention`, `useSyncQueue`. Ne pas mélanger dans un même identifiant.

---

## 7. Comment travailler

- **Un ticket à la fois.** Lire le ticket, relire la section correspondante du cahier des charges, écrire le test, écrire le code, lancer `pnpm verify`, commiter.
- **Test d'abord** pour toute règle de gestion. Les règles sont numérotées (RG-INT-01…) : le test porte le numéro de la règle en commentaire.
- **Commits petits et atomiques.** Un ticket peut donner plusieurs commits ; un commit ne doit jamais couvrir deux tickets.
- **Décisions techniques structurantes** → un fichier dans `docs/decisions/` : le contexte, les options écartées, le choix, les conséquences. Trois paragraphes suffisent.
- **En cas de blocage** : ne pas contourner, ne pas simplifier le périmètre en silence. S'arrêter, décrire précisément ce qui bloque et les options envisagées.

---

## 8. Points où il faut s'arrêter et demander

Ne jamais trancher seul sur :

- une **règle métier absente ou ambiguë** dans le cahier des charges ;
- un **montant, un taux, un délai** non spécifié — ne pas inventer de valeur par défaut ;
- un **changement de schéma de base** touchant `societe_id`, les devises ou les statuts d'intervention ;
- l'**assouplissement d'un invariant** du chapitre 3 ;
- l'ajout d'une **dépendance lourde** ou d'un service externe payant ;
- tout ce qui touche à la **sécurité du cloisonnement** ou aux données personnelles.

Dans ces cas : s'arrêter, exposer le problème, proposer deux options avec leurs conséquences, attendre.

---

## 9. Erreurs déjà commises à ne pas refaire

Cette section se remplit au fil du projet. Chaque erreur corrigée y laisse une ligne, pour qu'elle ne se reproduise pas.

- *(à compléter)*
