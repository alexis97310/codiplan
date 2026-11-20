# 9L29-RELECTURE-REPRENDRE-P2025 — passation

T0 = 13:26 (Pacific/Noumea, 20/11/2026). Limite 150 min, code neuf arrêté à T0+110
(15:16).

## Point 1 — le défaut existe-t-il toujours sur `origin/main` actuel ?

Les six commits de `9L08C-TERRAIN-REPRENDRE-SUSPENSION-garde` (bouton terrain
« Reprendre ») ont été reportés À LA MAIN sur cette branche (pas un cherry-pick
littéral : `tests/unit/auth/porte.test.ts` a depuis été restructuré — la table
`ROUTE_CAPACITE` a migré vers `tests/unit/auth/route-capacite.ts` — et
`app/(mobile)/terrain/[id]/page.tsx`, `lib/i18n/fr.ts`,
`components/terrain/consultation-hors-reseau.tsx` ont divergé ; les quatre ont été
fusionnés à la main ou par `git apply --3way`, sans changer le contenu fonctionnel
du bouton). `pnpm typecheck` propre après report.

**Rejoué 3 fois, foreground, `CI=1 --workers=1 --retries=0`, base jetable recréée
à chaque lancement (`tests/e2e/setup/base.ts`) : 3 essais, 3 échecs.** Toujours le
même P2025 au même endroit — `tx.intervention.update(...)` dans
`reprendreIntervention`, appelé par `POST /api/terrain/[id]/reprendre` — après
« suspendre » en ligne. Le second scénario (reprise hors réseau puis rejouée par
« Envoyer ») échoue en cascade (timeout) parce que le premier scénario a laissé la
page sur l'état d'erreur sans que ce soit la cause propre du second — à vérifier
scénario par scénario si besoin, mais le signal utile est déjà là.

**Ceci est PLUS systématique que la mesure de 9L08CA** (qui notait 2 échecs sur 4
sur ce poste). Deux lectures possibles : D270 (9L13, suspension ferme le segment de
compteur dans la même transaction) a changé la fenêtre de course et l'a rendue plus
large/plus fréquente ; ou la variance observée en 9L08CA tenait à la charge de la
machine à ce moment-là, pas à une vraie probabilité différente. À garder en tête
pendant la relecture : **D270 a touché `suspendreIntervention`**, directement en
amont de l'état que `reprendreIntervention` doit retrouver.

## Point 2 — relecture ligne à ligne (en cours)

(à continuer)
