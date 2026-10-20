# 9F5B-CORRECTIFS-AUDIT-FONCTIONNEL — Passation

Lot de correction des constats 1 à 5 du rapport de l'audit fonctionnel 9F5
(`docs/audits/9F5-fonctionnel/rapport.md`, `4e5d997c`). Un commit par point,
dans l'ordre du ticket.

## Point 1 — Le refus nomme la vraie cause (constat 1)

**Avant** : `motifDuRefusDeSaisie` (`app/api/interventions/creer/formulaire.ts:90`)
ne regardait que le CHEMIN de l'issue Zod, jamais le CODE — une description de
plus de 4000 caractères recevait « La panne signalée ou le travail demandé est
obligatoire. », aussi trompeur qu'une case vide qu'elle n'est pas.

**Après** : le code de l'issue (`too_big`) désigne un motif à part,
`intervention.refus.panne_trop_longue` (« Le texte est trop long : 4000
caractères au plus. »), clé i18n NEUVE — l'ancienne `panne_manquante` reste
inchangée pour une description vide. Propagé à `champEnCause`
(`app/(back-office)/interventions/presentation.ts`) : le champ encadré et
focalisé reste `description` pour les deux motifs. Les deux autres champs
désignés avec certitude (`type`, `priorite`) sont mesurés : ce sont des
énumérations sans ambiguïté de code, rien à y changer.

**Épreuves** : `tests/unit/interventions/creer-retour-formulaire.test.ts`
(description vide / 4001 / 4000 caractères exactement), `tests/unit/
interventions/champ-en-cause.test.ts`, `tests/e2e/champ-fautif.spec.ts` (nouveau
cas : le bon champ encadré, le bon message, jamais « obligatoire »),
`tests/e2e/9f5b-captures-refus-trop-long.spec.ts` (capture).

**Capture** : `captures/9f5b-description-trop-longue-refus-{375,1280}.png` — le
bandeau affiche bien « Le texte est trop long : 4000 caractères au plus. ».

## Point 2 — Date passée : avertir, laisser faire (D123, D217, constat 2)

**Avant** : `verdictOuverture` (`lib/interventions/pose.ts`) juge le jour OUVERT
et l'heure d'ouverture, jamais la date par rapport à AUJOURD'HUI — planifier ou
transmettre une intervention à une date déjà passée n'était refusé nulle part,
ni à la pose (`.../deplacer`) ni à la transmission individuelle
(`.../transmettre`). Seule la transmission GROUPÉE excluait ces lignes de son
tri d'affichage (`motifsNonTransmissible`, `lib/interventions/cycle-de-vie.ts`).

**Après** — décision D123 d'Alexis (19/10/2026 ~05:53, Projet), écrite en
D217 de `docs/arbitrages.md` : « avertir, laisser faire ». `verdictDatePassee`
(`lib/interventions/pose.ts`), même forme à trois états que `verdictOuverture` :
un jour STRICTEMENT avant aujourd'hui (jour civil de l'AGENCE, I7/L0-08) devient
une porte « à confirmer ». Sans confirmation (`confirmer_date_passee`), rien
n'est écrit, refus nommé `intervention.refus.date_passee`, `confirmable: true`.
Confirmé, l'écriture a lieu avec l'avertissement
`intervention.avertissement.date_passee`. Portée : `verdictALaPose`
(`lib/interventions/depot.ts`, utilisée par `.../deplacer` ET sa prévisualisation
`.../verdict-pose`) et `transmettreIntervention` (`.../transmettre`), chacune
avec sa case dans son dialogue (`DialoguePlanifier`, `DialogueDeplacer`,
`DialogueTransmettre`). **Aujourd'hui et demain : aucun avertissement.**

**Limite mesurée et acceptée** (voir D217) : le glisser-déposer du planning et
la fenêtre de pose (`components/planning/{pose,fenetre-pose}.tsx`) partagent la
même porte serveur mais pas (encore) sa confirmation — ils continuent de montrer
le refus nommé, confirmable, mais leur case de confirmation n'envoie que
`confirmer_hors_ouverture`. Aucune régression (avant : silence et écriture ;
après : refus nommé). Généraliser leur mécanique à deux motifs est hors budget
de ce lot ; condition de réouverture posée dans D217.

**Épreuves** : `tests/unit/interventions/pose.test.ts` (`verdictDatePassee`, six
cas), `tests/isolation/date-passee.test.ts` (nouveau, base réelle : pose et
transmission, refus confirmable puis acceptation confirmée, avec avertissement),
`tests/e2e/9f5b-date-passee.spec.ts` (dialogue : avertissement visible,
confirmation acceptée, enchaîné pose → transmission). Cinq fixtures isolation
existantes (dates fixées en septembre 2026, désormais passées par l'avancée
réelle de l'horloge) adaptées pour confirmer explicitement une date hors sujet
de leur propre test : `tests/isolation/{pose-habilitation,absence,absences-2,
verdict-pose-lecture,transmission-groupee}.test.ts`.

**Captures** : `captures/9f5b-date-passee-pose-dialogue-avant-375.png` (les deux
cases de confirmation, pose), `captures/9f5b-date-passee-pose-refus-1280.png`
(refus nommé, rien écrit), `captures/9f5b-date-passee-pose-accepte-1280.png`
(acceptée, avertissement visible), `captures/9f5b-date-passee-transmission-
dialogue-375.png`, `captures/9f5b-date-passee-transmission-accepte-1280.png`.

## Point 3 — Pas d'appel réseau inutile sur /terrain (constat 3)

**Avant** : `app/(mobile)/layout.tsx:57` montait `<CopieLocaleTerrain />` pour
TOUTE visite de `/terrain/*`, déclenchant `GET /api/terrain/instantane` même
pour un rôle à accès complet (admin_societe, responsable_materiel,
responsable_sav, direction) — la route refuse à raison (403,
`exigerCapacite("consulter_planning")`), mais l'appel lui-même est de trop (et
atteint même `/terrain` quand `PageTerrain` y rend `<ReserveAuxTechniciens />`
pour ce rôle).

**Après** : le rôle, déjà lu côté serveur par `chromeDeLaRequete` (R2-16,
`lib/navigation/chrome.ts`), est redescendu en prop implicite (une seule
lecture, §9) : `app/(mobile)/layout.tsx` ne monte `<CopieLocaleTerrain />` que
si `role === Role.technicien`. Aucune nouvelle requête, aucun changement dans
`components/terrain/copie-locale.tsx`.

**Épreuves** : `tests/e2e/9f5b-terrain-copie-locale-perimetre.spec.ts` (nouveau :
un rôle à accès complet → zéro requête `/api/terrain/instantane` ; un technicien
→ la requête part) ; `tests/e2e/offline/9f4h1-consultation.spec.ts` (voisine,
rejouée verte : le technicien garde exactement sa copie locale).

## Point 4 — Noms accessibles (constats 4 et 5)

**Avant** : `app/(back-office)/parametres/forfaits/[id]/page.tsx` — le
`<select name="zone">` du sélecteur de zone n'avait ni `id` ni `htmlFor` liant
son `<label>`. `components/interventions/photos-terrain.tsx` — les champs
`fichier` et `libelle` du formulaire « ajouter une photo » n'avaient ni
`<label>` ni `aria-label`.

**Après** : `id="zone-forfait"` + `htmlFor` sur le `<label>` existant (aucune
clé i18n neuve). Pour les deux champs photo, un `<label>` par champ, lié par
`useId()`, visuellement masqué (`sr-only`, classe déjà employée ailleurs dans le
dépôt) pour ne rien changer au gabarit visible : le libellé réutilise la clé
i18n EXISTANTE `terrain.photos.libelle` (« Légende »), et une seule clé NEUVE,
`terrain.photos.fichier` (« Photo »), est ajoutée pour le champ fichier.

**Épreuves** : `tests/e2e/9f5b-noms-accessibles.spec.ts` (nouveau) —
`getByLabel(...)` trouve chacun des trois champs (zone, fichier, légende) ; sa
propre fiche jetable pour la photo (jamais `SCENE.rapportVierge`, écrite en SQL
brut ailleurs — le gardien `tests/unit/e2e-donnees-partagees.test.ts` l'interdit).

## Points ouverts

- Le glisser-déposer et la fenêtre de pose du planning ne généralisent pas
  encore leur confirmation à deux motifs (D217, condition de réouverture
  posée) — refus nommé mais pas encore confirmable depuis ces deux surfaces.
- `tests/audit-fonctionnel/parcours-edge.spec.ts` porte un test diagnostique
  antérieur (« planifier puis transmettre sur une date déjà passée n'est
  refusé ni à la pose ni à la transmission ») qui documentait très précisément
  le constat 2 — il échouera désormais, À RAISON : la décision D123/D217 ferme
  ce trou. Ce fichier n'a pas été touché (interdit du lot), conformément à sa
  propre nature de journal d'audit (« chaque test TROUVE et DÉCRIT ; aucun ne
  corrige ») ; le signaler au pilote pour mise à jour ou retrait de ce cas lors
  d'un prochain lot.

## FIN — vérification

`CI=1 pnpm verify:full` a été lancé EN ENTIER, au premier plan, en un seul appel
(`verify-final.txt`) : il a tourné 1 h sans finir — `test:e2e` en CI tourne à
UN SEUL worker (1489 épreuves), et le dépôt n'offre pas ce budget en une
session. Le journal s'arrête en plein balayage (`tous-les-ecrans-rendent` et
voisins), sans trace de régression nouvelle avant la coupure (quelques `F`
isolés dans le reporter point, sans nom — le process a été tué avant le
résumé). **Lancé à la place, et VERT en entier** : `CI=1 pnpm verify`
(`verify-narrow.txt` — format:check, typecheck, lint, test unitaire 464/464
fichiers, test:isolation 186/186 fichiers, build). Les épreuves e2e voisines
du lot (créations, pose/planification D93, transmission groupée, hors-ligne,
tous-les-écrans) ont été rejouées À LA MAIN plus tôt dans ce lot, SÉRIELLEMENT
(`--workers=1`) pour écarter une course entre fichiers parallèles — toutes
vertes ; voir le détail par point ci-dessus. `git rev-parse --short HEAD` :
`c101af1c`.

## Captures commitées

```
$ ls -la docs/propositions/9F5B-CORRECTIFS-AUDIT-FONCTIONNEL/captures/
9f5b-date-passee-pose-accepte-1280.png              112872 octets
9f5b-date-passee-pose-dialogue-avant-375.png         49776 octets
9f5b-date-passee-pose-refus-1280.png                118197 octets
9f5b-date-passee-transmission-accepte-1280.png      109052 octets
9f5b-date-passee-transmission-dialogue-375.png       52589 octets
9f5b-description-trop-longue-refus-1280.png         118958 octets
9f5b-description-trop-longue-refus-375.png           51153 octets
```
