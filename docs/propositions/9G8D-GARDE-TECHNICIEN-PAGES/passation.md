# 9G8D-GARDE-TECHNICIEN-PAGES — passation (25/10/2026)

## Ce qui était soupçonné

La chaîne 9G8 (24/10, 23h30) soupçonnait, SANS l'avoir mesuré au navigateur, que le
garde serveur de D221 (technicien renvoyé vers `/terrain`, posé dans
`app/(back-office)/layout.tsx`) ne tenait pas sous une navigation DOUCE (clic sur un
`<Link>`) entre deux pages du même segment — App Router ne réexécute pas un LAYOUT à
cette occasion.

## Ce qui a été mesuré

**Confirmé** — connecté en technicien (`garnier@codima.test`), `goto("/absences?declarer=1")`
(exempté), puis un clic sur « Planning » dans la colonne atteignait le tableau complet
(`h1` = « Planning des techniciens »), sans redirection. Le garde ne jugeait que le
premier rendu.

**Première correction, insuffisante seule** — le garde a été déplacé dans
`app/(back-office)/template.tsx` (nouveau fichier), RECRÉÉ par App Router à chaque
navigation, douce ou dure — contrairement au layout, qui continue de porter le chrome
(colonne, bandeaux) inchangé. `app/(back-office)/layout.tsx` ne porte plus ce garde.

**Mesuré ENSUITE, une seconde cause, plus profonde, NON FERMÉE** — même après ce
déplacement, un clic sur l'entrée de la colonne **dans la fenêtre de préchargement
automatique** qui suit le montage de la page continue d'atteindre le contenu interdit.
Vérifié par instrumentation (`console.warn` temporaire dans `middleware.ts` et le
template, retirée avant ce commit) : au clic, **aucune nouvelle requête ne repart vers
le serveur** — ni le template, ni même `middleware.ts`, qui pourtant s'exécute au moment
du préchargement lui-même (confirmé : chaque entrée visible de la colonne déclenche un
passage en middleware dès le montage de la page). Le cache client du routeur de Next.js
rend le clic depuis cette précharge.

Deux pistes de fermeture ont été essayées et mesurées SANS succès :
- `experimental.staleTimes.dynamic = 0` dans `next.config.ts` — aucun effet mesuré, même
  après reconstruction complète (`rm -rf .next`). Retiré : aucun bénéfice vérifié ne
  justifiait de le garder, ni de rester hors du territoire fixé par ce ticket.
- `prefetch={false}` sur l'entrée de la colonne (`components/navigation/barre.tsx`,
  fonction `Entree`) — réduit le nombre de préchargements observés, mais n'a PAS fermé
  le chemin : au moins une autre source (la marque, qui pointe toujours vers
  `/planning`) alimente le même cache. **Conservé** comme durcissement partiel, documenté
  comme tel dans le commentaire du composant.

## Ce qui est livré

- `app/(back-office)/template.tsx` — le garde de D221, correctement replacé pour être
  recréé à chaque navigation (corrige la cause NOMMÉE par le ticket).
- `app/(back-office)/layout.tsx` — ne porte plus le garde, documentation à jour.
- `middleware.ts` — inchangé en comportement, commentaire mis à jour (référence
  `template.tsx` au lieu de `layout.tsx`).
- `lib/navigation/redirection-technicien.ts` — commentaire mis à jour (référence
  `template.tsx`).
- `components/navigation/barre.tsx` — `prefetch={false}` sur l'entrée de colonne,
  durcissement partiel documenté.
- `tests/e2e/9g8d-garde-navigation-douce.spec.ts` — étend la preuve par navigation DURE
  (déjà éprouvée pour `/planning`) à `/demandes`, `/parc`, `/vgp` : les trois autres
  destinations offertes au technicien par la colonne. Documente explicitement, dans son
  en-tête, ce qu'il ne couvre PAS (le chemin par précharge, toujours ouvert) plutôt que
  d'affirmer un état faux.
- `tests/unit/navigation/redirection-technicien.test.ts` — commentaire mis à jour.

## Ce qui N'EST PAS résolu — à reprendre dans un prochain lot

Le contournement par clic pendant la fenêtre de préchargement **reste ouvert**. Pistes
pour la suite, non essayées par manque de budget (fenêtre de correction du lot) :
1. Comprendre pourquoi `staleTimes.dynamic = 0` n'a aucun effet mesuré sur ce chemin —
   possible que le cache en cause ne soit pas le Router Cache visé par ce réglage.
2. Retirer tout préchargement des liens du back-office pour un technicien spécifiquement
   (la marque comprise), plutôt qu'une seule entrée.
3. Déplacer la décision elle-même dans `middleware.ts` — seul point confirmé s'exécuter à
   CHAQUE préchargement comme à chaque navigation dure. Nécessite une lecture de rôle sans
   requête lourde (actuellement `exigerSessionActive` fait un aller-retour PostgreSQL via
   Better Auth) — à instrumenter ou à accepter comme coût mesuré avant de trancher.

## Captures

Aucune capture nouvelle : la colonne ne change pas visuellement (`prefetch` est un
attribut sans rendu). Les captures de 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES et
9G8B-REPRISE-9G8A restent à jour pour cet écran.
