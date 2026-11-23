# Passation — 9L34-EMPLACEMENTS-DEPLACER-BUREAU

## Ce qui était demandé

Décision d'Alexis du 23/11/2026, point 3 de la séance : « Historique des emplacements : visible à tous ceux qui voient la fiche machine ; le déplacement réservé au bureau, sans le technicien. »

## Ce qui est LIVRÉ

**« Déplacer la machine » réservé au bureau.** Nouvelle capacité `deplacer_machine` (`lib/auth/habilitations.ts`) — ADMS, DIR, RM, RS, ADV, jamais TEC — qui remplace `gerer_machine` sur la seule route `app/api/machines/[id]/deplacer/route.ts` (`gerer_machine` reste inchangé pour tout le reste : créer, modifier, changer de statut). Le bouton de la fiche (`app/(back-office)/parc/[id]/page.tsx`) suit la même garde : ABSENT, jamais désactivé, pour qui n'a pas la capacité.

Décision écrite en **D280** (`docs/arbitrages.md`).

## Ce qui est BLOQUÉ, et pourquoi (documenté en D280 et en feuille de route)

**« Historique des emplacements » visible à tout rôle qui voit la fiche** n'est PAS livré. `historiqueDesEmplacements` (`lib/machines/emplacements.ts`) lit le journal d'audit sous la politique RLS `journal_audit_lecture`, qui n'ouvre qu'à `admin_societe`/`direction` (fonction `app_peut_consulter_journal_audit`, migration `20260829120000_journal_audit`). Cette politique filtre AU NIVEAU DE LA BASE, indépendamment de ce que l'application demande — aucun chemin de code ne peut donner à lire à RM/RS/ADV (ni TEC) des lignes que la RLS leur refuse déjà. L'ouvrir exige une migration, que ce lot n'a pas le droit de poser (consigne du ticket : « AUCUNE migration »).

**Retirer simplement la garde côté écran aurait été un défaut, pas une livraison partielle** : sans la migration, RM/RS/ADV liraient zéro ligne sous RLS et le bloc afficherait « jamais déplacée » pour une machine qui l'a pourtant été — le mensonge que le commentaire de tête de `historiqueDesEmplacements` écarte déjà. Le code n'a donc PAS été touché sur ce point : la garde `peutConsulterEmplacements` reste ce qu'elle était.

**La migration à écrire**, pour une prochaine reprise (décrite en D280) : une politique RLS NOUVELLE et plus étroite sur `journal_audit` (ou une fonction `SECURITY DEFINER` dédiée), qui n'ouvre la lecture qu'aux lignes `entite = 'machine'` dont le `site_id` diffère entre `valeurs_avant` et `valeurs_apres`, à tout rôle de la société — jamais en élargissant `journal_audit_lecture` elle-même, qui doit rester le verrou du journal entier. `consulter_journal_audit` (matrice §5.2) n'est pas touchée.

## Découverte en cours de route : D221 ferme déjà `/parc/[id]` au technicien

`/parc/[id]` est un écran du back-office, et D221 (21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES) ferme TOUT le back-office au technicien par un garde serveur (`app/(back-office)/template.tsx` + `lib/navigation/redirection-technicien.ts`) — `page.goto('/parc/<id>')` pour un compte TEC redirige systématiquement vers `/terrain`, **avant ce ticket comme après**. Capturé dans `captures/technicien-redirige-vers-terrain-{375,1280}.png`.

**Conséquence directe** : aucun rôle qui atteint réellement `/parc/[id]` (ADMS, DIR, RM, RS, ADV) n'a son écran changé par ce ticket — tous avaient déjà le bouton « Déplacer » par `gerer_machine`, et le gardent par `deplacer_machine` (captures `adv-fiche-{avant,apres}-deplacement-1280.png`, quasi identiques). La garde que j'ai posée sur le bouton (`peutPleinement(contexte.role, "deplacer_machine")`) est donc, en pratique aujourd'hui, une défense en profondeur sans effet observable pour un utilisateur réel — elle protège contre un assouplissement futur de D221, elle ne change rien à ce que quiconque voit aujourd'hui. **La preuve qui compte réellement pour ce ticket est le refus SERVEUR** (POST direct à la route, refusé nommément — `tests/e2e/9l34-emplacements-deplacer-bureau.spec.ts`), pas une capture d'écran.

Je n'ai PAS touché à D221 ni à `redirection-technicien.ts` : hors périmètre de ce ticket, et une décision de rang 1 déjà arrêtée.

## Épreuves

- `tests/unit/auth/habilitations.test.ts` — `deplacer_machine` pour les six scénarios concernés (ADMS, DIR, RM, RS, ADV au ●, TEC au refus).
- `tests/unit/auth/route-capacite.ts` — la route pointe vers `deplacer_machine`.
- `tests/e2e/9l34-emplacements-deplacer-bureau.spec.ts` (nouveau) — 4 scénarios : bouton absent pour TEC à 375 et 1280 (redirection D221), POST direct du TEC refusé nommément (`auth.refus_droit`, rien n'est écrit), l'ADV déplace réellement la machine (bureau, 1280).
- `pnpm test`, `pnpm test:isolation`, `CI=1 pnpm verify` (format/typecheck/lint/test/isolation/build) : tous verts.
- Régression vérifiée : `tests/e2e/9l20-deplacer-machine.spec.ts` (ADMS) toujours vert.

## Feuille de route

`lib/feuille-de-route/contenu.ts` : la ligne « Historique des emplacements… (9L20) » sort de « Décisions en attente », entre dans « Décisions prises » (tranché 23/11/2026, D280) ET dans « Bloqué / en enquête » (la migration manquante). La ligne « Déplacer une machine… (9L20) » en « Livré » est complétée : « réservé au bureau depuis 9L34 ».

## Ce qui reste dû

- La migration décrite en D280, pour livrer la seconde moitié de la décision du 23/11.
- `scripts/captures.mts` (régénération complète de `docs/captures/`) non rejouée — hors budget, même choix que 9L33 (déjà en retard d'une trentaine de lots sur ce point).
