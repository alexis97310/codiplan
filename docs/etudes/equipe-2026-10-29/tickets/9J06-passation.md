# 9J06-PORTAIL-FICHE-MACHINE — passation

Budget : T0 04:33 (Pacific/Noumea), limite 110 min.

## Point 1 — inventaire

`app/(portail)/portail/page.tsx` liste déjà le parc (sites, machines) sous la forme « parc » que
`parcDuClient` (`lib/portail/depot.ts`) lit : filtre société + `app.client_id` (désignation D70, validée
par `app_poser_perimetre_client`) + `app.perimetre_sites` (résolu en base depuis `utilisateur_client`,
jamais porté par `ContexteSession`). D98 retire « Fiche machine » de la barre de navigation, pas la fiche
elle-même — une fiche atteinte depuis une liste reste légitime (même principe que les autres objets).
Documents et VGP (CLI-2.3b, lots 8/9, D87/D88) : non construits, dits vides par `placeDesDocuments`/
`placeDuVgp` (`presentation.ts`) — repris tels quels sur la fiche, jamais inventés.

## Point 2 — l'écran

`lib/portail/depot.ts` : `ficheMachineDuParc(contexte, machineId, client?)`, MÊME politique « parc » que
`parcDuClient`, une lecture par id (`machine.findFirst({ where: { id } })` avec le site en relation
imbriquée dans le MÊME appel — deux requêtes au total avec la raison sociale du client, jamais une boucle).
`null` si la machine n'existe pas OU si elle est hors du périmètre — la RLS ne distingue pas les deux cas
(D35, D50), et la fonction non plus.

**Select fermé** (`SELECTION_FICHE_MACHINE_PORTAIL`) : `id`, `numero_serie`, `reference_interne`,
`localisation`, `statut`, `site_id`, `date_mise_en_service` — rien d'autre. `machine` porte aussi
`facture_origine`, `garantie_fin`, `qr_token`, `vgp_exception*`, `criticite`, `source_creation`,
`machine_remplacee_id` : réservées au back-office, jamais dans ce select (gardien : `tests/unit/portail/
machine-colonnes-fermees.test.ts`, même patron que `SELECTION_COMMENTAIRES_CLIENT`).

**Contenu de la fiche, MOINS un montant ou une donnée interne** : état, site, emplacement (si renseigné),
mise en service, client — et les deux places réservées documents/VGP, reprises de la liste. Le contrat
(un prix, D92 doctrine 3.8), l'historique des interventions, le QR et l'agence (donnée interne à CODIMA)
restent HORS de cette fiche : aucun n'appartient à la forme « parc » que ce compte lit, et les deux clés de
dictionnaire déjà posées mais jamais utilisées (`portail.machine.statut`, `portail.machine.mise_en_service`)
confirment ce périmètre plutôt que de le deviner.

`app/(portail)/portail/machines/[id]/page.tsx` — même garde d'accès que `/portail` (session, société,
rôle), `estUuid` + `notFound()` sur un id mal formé ou absent (même garde que `/parc/[id]`), fil d'Ariane
vers `/portail`.

## Point 3 — le lien

Chaque `<li>` de la liste des machines (`app/(portail)/portail/page.tsx`) devient un `<Link
href="/portail/machines/{id}">` englobant toute la carte (au lieu d'un `<li>` nu) — aucune entrée de barre
ajoutée (D98 reste valide).

## Point 4 — épreuves d'isolation, NOUVELLES

`tests/isolation/9j06-portail-fiche-machine.test.ts`, sous la vraie base, par **id direct** plutôt que par
liste (nuance nommée par le ticket) :
- témoin — le compte portail lit la fiche de SA machine, dans SON périmètre ;
- `null` sur une machine du MÊME client mais HORS périmètre de sites (`MACHINE_A2`, témoin : la ligne
  existe) — absente de la LISTE ne suffit pas à montrer qu'elle reste invisible par id direct ;
- `null` sur une machine d'un AUTRE client de la même société (`PORTAIL_A2_CLIENT` lisant `MACHINE_A1` —
  un site d'A1 ne peut, PAR CONSTRUCTION, jamais figurer dans le périmètre d'A2, et ce scénario le montre
  plutôt que de le supposer) ;
- `null` sur une machine d'une AUTRE société (témoin : la ligne existe) ;
- une désignation de client qui n'est pas la sienne LÈVE (D70), elle ne rend pas `null`.

5 épreuves, toutes vertes sous `pnpm vitest run --project isolation`.

## Point 5 — captures

AVANT (liste sans lien, 375/1280 px) : worktree `git worktree add` posé sur `6b501ef05` (le commit qui
précède ce ticket), spec e2e écrite directement dans le worktree, jamais commitée (recette « captures-
avant-apres-e2e », cas « code AVANT déjà commité »). APRÈS (liste avec ses liens, fiche machine ouverte,
375/1280 px) : `tests/e2e/captures-9j06-portail-fiche-machine.spec.ts`, commité.

**Morsure rencontrée et réparée** : `export const metadata` laissé à côté de `export async function
generateMetadata` sur la fiche — Next.js refuse les deux sur le même fichier (« cannot be exported at the
same time »), une erreur de BUILD que ni `pnpm typecheck` ni `pnpm lint` ne voient. Retiré avant la capture
APRÈS.

## État des portes

`pnpm format` / `pnpm typecheck` / `pnpm lint` : verts à chaque point. `pnpm test` : 501 fichiers, 5510
tests, vert. `pnpm test:isolation` (fichier neuf seul puis suite complète) : vert. `pnpm build` : vert (two
compiles successful during the capture runs). Sortie complète de `CI=1 pnpm verify:full` : voir
`9J06-verify-final.txt`, dans ce même dossier.

## Hors territoire, rappelé

`lib/machines/depot.ts` : lecture seule, aucune ligne modifiée. `prisma/` : aucune migration. Documents et
VGP (CLI-2.3b) : non construits, toujours dits vides. `CLAUDE.md` : inchangé.
