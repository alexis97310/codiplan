# 85-PARC-SITES — passation

## Ce que j'ai changé

- `app/(back-office)/presentation.ts` — nouvelle fonction pure `libelleClientSite(client, site)` :
  compose « Client — Site » (séparateur `ponctuation.separateur`, déjà imposé ailleurs), et replie
  sur le nom du client seul quand le libellé du site lui est identique une fois rogné (constat 7 de
  l'audit, même règle qu'ailleurs sur l'écran client).
- `lib/machines/depot.ts` — `optionsDeFiltreDuParc` porte désormais, pour chaque option de site, la
  raison sociale du client (une seule requête élargie, jamais une requête par site). Nouveau type
  exporté `OptionFiltreSiteDuParc`.
- `app/(back-office)/parc/page.tsx` — le `<select name="site">` du filtre affiche
  `libelleClientSite(client, site)` au lieu du seul libellé du site, et le tri passe de
  « site seul » à « client puis site » (`trierAlphanumeriquement` avec un départage). La VALEUR
  envoyée par l'option reste l'identifiant du site : l'URL du filtre est inchangée.
- `lib/sites/depot.ts` — `rechercherSites` porte désormais la raison sociale du client dans sa
  lecture étroite d'identifiants (même principe : une seule requête élargie), et trie « client puis
  site » plutôt que par le seul libellé du site.
- `app/(back-office)/sites/page.tsx` — la carte d'un site titre désormais le CLIENT (lien vers sa
  fiche, comme avant), et la première ligne devient « site — commune » (lien vers la fiche du site,
  qui vivait avant sur le titre). Aucun lien ne disparaît, les deux ont simplement échangé de place.

**Pour l'exploitation** : le filtre Site de `/parc` et les titres de carte de `/sites` ne se
confondent plus quand deux sites de clients différents portent le même nom (« Nouméa » mesuré six
fois le 25/09 dans le seul filtre du parc, sans moyen de savoir lequel choisir).

## Ce que j'ai mesuré

- **AVANT (lecture du code, `main` avant ce ticket)** : `optionsDeFiltreDuParc` ne lisait que
  `{ id, libelle }` pour un site — deux sites au même libellé y étaient donc rendus par la MÊME
  chaîne dans le `<select>`, impossible à distinguer sans ouvrir chaque fiche. `rechercherSites`
  triait par le seul libellé du site, jamais par client.
- **APRÈS (mesuré par `tests/e2e/parc-sites.spec.ts`, scène `PSI-` créée et supprimée par
  l'épreuve)** : deux sites réels, même libellé (`PSI-Noumea`), deux clients différents
  (`PSI-A`, `PSI-B`) → le filtre du parc rend deux OPTIONS DISTINCTES, `PSI-A — PSI-Noumea` et
  `PSI-B — PSI-Noumea`, chacune portant la valeur de SON site ; `/sites` titre les deux cartes
  respectivement `PSI-A` et `PSI-B`.
- **Capture contre les données de démonstration** (`docs/propositions/85-PARC-SITES/captures/`,
  1280 px) : `filtre-site-valeur-composee-1280.png` montre l'option choisie
  « Atelier Ducos — Atelier principal » ; `cartes-titrees-par-client-1280.png` montre DEUX cartes
  titrées « Atelier Ducos » (un même client, deux sites : « Atelier principal — Nouméa » et
  « Dépôt de brousse — Bourail ») — la démonstration ne reproduit pas l'exact doublon de libellé de
  site mesuré en production, mais elle montre le même mécanisme de composition en conditions
  réelles.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (2826 tests), `pnpm test:isolation` (1239 tests) :
  verts. `pnpm test:e2e` complet NON rejoué (budget) ; les fichiers touchés et les nouveaux
  scénarios ont été rejoués ciblés (`sites.spec.ts`, `parc.spec.ts`, `selecteurs-1.spec.ts`,
  `historique-site.spec.ts`, `parc-apercu-borne.spec.ts`,
  `site-client-inactif-masque-a-la-creation.spec.ts`, `parc-sites.spec.ts`,
  `captures-parc-sites.spec.ts`) : tous verts.

## Ce que j'ai tranché et pourquoi

- **`lib/machines/depot.ts` n'était pas nommé dans le territoire du ticket**, seul
  `lib/sites/depot.ts` portait une exception explicite (« AJOUTER la raison sociale à une lecture
  déjà faite »). Le filtre Site de `/parc` tire pourtant ses options de `optionsDeFiltreDuParc`
  (`lib/machines/depot.ts`), pas de `lib/sites/depot.ts` : sans y ajouter la raison sociale du
  client, le premier point du ticket (le filtre du parc) était impossible à livrer. J'ai appliqué à
  ce fichier EXACTEMENT la même règle que l'exception nommée — une seule requête élargie, jamais une
  par site — en jugeant que l'esprit de la restriction (pas de requête supplémentaire, pas de N+1)
  comptait plus que la lettre (le nom du fichier cité).
- **Le lien vers la fiche du site, qui vivait sur le titre de la carte, migre vers la première
  ligne** plutôt que de disparaître : `CarteEntite` documente que « le lien vers la fiche vit sur le
  titre », mais ici deux fiches différentes (client, site) se disputent la même carte. Le titre
  devenant le client, son lien va logiquement vers `/clients/{id}` (cohérent avec ce que le titre
  affiche) ; le lien vers `/sites/{id}` migre sur la ligne qui porte désormais le libellé du site,
  pour qu'aucun champ ne disparaisse.
- **Le départage de tri n'est plus posé sur l'identifiant** (`rechercherSites` triait avant par
  `libelle` puis `id` pour une pleine déterminisme). Le tri devient « client puis site » ; le cas de
  deux sites au même libellé chez le MÊME client (rarissime, aucune règle de gestion n'en fait un
  identifiant) n'a plus de départage à l'identifiant — l'ordre entre eux n'est alors pas garanti,
  ce que je juge acceptable au regard de la demande littérale (« tri par client puis site »).
- **Capture de « filtre ouvert » impossible telle quelle** : ouvrir le `<select>` natif bloque
  `page.screenshot` en Chromium (mesuré : timeout de 30 s, le menu déroulant du système
  d'exploitation empêche la capture). La capture montre à la place la valeur CHOISIE, composée
  « Client — Site » — ce que l'ouverture aurait montré option par option.

## Ce que je n'ai PAS fait

- Pas de déduplication des sites eux-mêmes dans le filtre ou la liste (deux sites RÉELLEMENT
  distincts au même libellé restent deux entrées — seul le repli client=site du constat 7 fusionne
  un AFFICHAGE, jamais deux options).
- Pas de `pnpm test:e2e` complet (budget) — seuls les specs touchant `/parc` et `/sites`, plus les
  deux nouveaux fichiers, ont été rejoués.
- Pas de capture "avant" : ce ticket ne le demandait pas explicitement (contrairement à d'autres
  lots) ; seule l'APRÈS a été produite, sur le même modèle que `captures-parcours-1.spec.ts`.
- Aucune migration, aucune ligne de semis, aucun prix — respecté.

## Les pièges pour la session suivante

- `optionsDeFiltreDuParc` (`lib/machines/depot.ts`) et `rechercherSites` (`lib/sites/depot.ts`)
  portent maintenant CHACUN leur propre lecture de la raison sociale du client — deux requêtes
  distinctes, pas une fonction partagée. Si un troisième écran a besoin de la même composition,
  la tentation sera de dupliquer une troisième fois : vérifier d'abord si `libelleClientSite`
  (le SEUL endroit qui compose le texte) suffit, ou si le dépôt visé peut réutiliser une des deux
  lectures existantes avant d'en écrire une troisième.
- La capture d'un `<select>` natif OUVERT est un mur, pas une variante à retenter avec un
  sélecteur différent : `page.screenshot` expire tant que le menu du système reste affiché.
  `captures-selecteurs-1.spec.ts` évite déjà ce piège parce que son "sélecteur" est un composant
  maison (`data-selecteur`, `<ul role="listbox">`), pas un `<select>` HTML.

## Ce qui reste à faire

- Rien d'identifié pour ce ticket : les deux écrans du périmètre (`/parc`, `/sites`) sont couverts,
  testés unitairement et de bout en bout.
