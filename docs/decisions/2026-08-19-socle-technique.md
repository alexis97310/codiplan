# Socle technique du dépôt

*19 août 2026 — ticket L0-01*

Choix pris en initialisant le dépôt, là où la pile imposée par le CLAUDE.md laissait une marge.

---

## 1. shadcn/ui installé à la main

**Contexte.** L'interface de commande `shadcn` interroge `ui.shadcn.com` pour composer le thème et récupérer les composants. Cet hôte est inaccessible depuis l'environnement d'exécution de la session ; le registre npm, lui, l'est.

**Options écartées.**
*Renoncer à shadcn/ui* — c'est une décision de pile, elle n'est pas à rediscuter ici.
*Attendre un environnement disposant de l'accès* — bloque le ticket sur une contingence d'outillage.

**Choix.** Les fichiers que l'interface de commande aurait écrits sont posés à la main : `components.json` (style *new-york*, base *neutral*, variables CSS, alias `@/components` et `@/lib/utils`), les jetons de thème Tailwind v4 dans `app/globals.css`, `lib/utils.ts` et un premier composant `components/ui/button.tsx`.

**Conséquences.** `pnpm dlx shadcn@latest add <composant>` fonctionnera tel quel depuis un poste disposant de l'accès réseau, puisque `components.json` est conforme. Le thème reste neutre : la thématisation par société relève du ticket L0-09.

---

## 2. Aucune dépendance au-delà du strict nécessaire

**Contexte.** Le CLAUDE.md impose de justifier toute dépendance et de préférer trente lignes à deux cents kilo-octets. L'échafaudage `create-next-app` en pose deux qui ne se justifient pas ici.

**Options écartées.**
*`next/font/google`*, posé par l'échafaudage — impose un appel réseau à chaque compilation. Retiré au profit de la pile de polices système : la compilation redevient reproductible hors réseau, propriété qui compte dans le contexte d'exploitation du produit.
*`tw-animate-css`*, requis par les composants shadcn/ui animés — aucun n'existe encore ; il sera ajouté avec le premier d'entre eux, pas avant.

**Choix.** Les seules dépendances ajoutées à l'échafaudage sont celles de shadcn/ui : `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot`.

**Conséquences.** Un composant shadcn/ui animé ajouté plus tard exigera `tw-animate-css` — c'est à ce moment-là que la dépendance se justifiera.

---

## 3. Aucune chaîne en dur, dès la première page

**Contexte.** Le CLAUDE.md §5 interdit toute chaîne visible en dur dans un composant, à chaque ticket. Le module d'internationalisation est pourtant l'objet du ticket L0-11.

**Options écartées.**
*Écrire « CODIPLAN » dans la page et corriger au ticket L0-11* — c'est exactement la dette que la règle cherche à éviter, et elle se rembourse en parcourant les composants.

**Choix.** `lib/i18n/fr.ts` est amorcé maintenant, avec le dictionnaire plat exigé par l'arbitrage D26 et un accès typé `t(cle)`. La page d'accueil et la métadonnée du document n'écrivent aucune chaîne littérale.

**Conséquences.** Le premier écran respecte la règle sans anticiper le périmètre de L0-11, à qui restent la règle ESLint interdisant les chaînes littérales dans le JSX et le remplissage du dictionnaire.

---

## 4. Prettier ne touche pas aux documents de référence

**Contexte.** Passé sur l'ensemble du dépôt, Prettier réécrit `CLAUDE.md`, le cahier des charges et la note d'arbitrage — emphase, tableaux, retours à la ligne.

**Choix.** `CLAUDE.md` et `docs/` sont exclus dans `.prettierignore`.

**Conséquences.** La mise en forme des documents reste celle de leurs auteurs, et un diff de spécification reste lisible. Les fichiers de `docs/decisions/` sont écrits directement au format attendu.
