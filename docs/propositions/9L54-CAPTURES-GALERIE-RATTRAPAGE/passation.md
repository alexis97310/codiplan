# 9L54-CAPTURES-GALERIE-RATTRAPAGE — passation

## Ce qui a été fait

`docs/captures/` n'avait pas été régénéré depuis `6d207f0` (14/11/2026) : la galerie
photographiait un commit vieux de treize jours de travail. Rejoué intégralement la
procédure de `docs/captures/README.md` sur une base PostgreSQL 16 locale et jetable
(port 5555, binaires PostgreSQL 18 forcés via `PGJ_BIN` — seule version installée sur ce
poste, comme le font déjà les deux autres clusters jetables observés en parallèle sur ce
poste, ports 5433 et 5441), migrée, semée, construite, puis les trois identités
amorcées (`scripts/amorcage-premier-compte.mts --reemettre`) et leur mot de passe posé
à la main (Playwright, jamais écrit au dépôt — I9).

Résultat : **172 captures prises, 8 refusées (toutes deux légitimes et déjà
documentées), 0 retirée.** 81 des 172 images ont changé à l'octet ; 91 sont restées
identiques (écrans non touchés depuis la dernière prise). Aucun écran ajouté, aucun
retiré — ce rattrapage ne fait que rafraîchir une liste déjà complète sur le commit
`2f7142b` (`2f7142bbbc6ed7d7e0aca3a05fc659107b4b8148`), 27/11/2026 11:40 UTC.

## Un faux départ, corrigé avant de committer quoi que ce soit

Premier essai : `COURRIEL=admin.societe@codima.test`, `COURRIEL_MULTI=direction@codima.test`
— ce que l'exemple de commande du README actuel (section « Comment la rejouer »,
littéral dans `scripts/captures.mts`, voir plus bas) laisse croire. Deux échecs en
cascade :

- `admin.societe` est **mono-société** : `/arrivee` redirige automatiquement dès que la
  société unique est active (`destinationSiSocieteUnique`, `app/(apres-session)/arrivee/
  decision.ts`), donc le témoin « société » de l'écran `arrivee` ne se rencontre jamais,
  et `admin_societe` masque en outre la carte « Priorités opérationnelles » du tableau de
  bord (D37) — deux témoins manqués pour la même cause mal choisie.
- Le correctif immédiat (inverser : `COURRIEL=direction`, `COURRIEL_MULTI=admin.societe`
  avec une seconde habilitation ajoutée EN SQL sur CODIMA-EU, **sur la seule base jetable
  de cette prise**, jamais dans `prisma/seed-data.ts`) est exactement ce que la passation
  de 9L04L-CAPTURES-REGENEREES avait déjà établi et consigné le 14/11. Le second essai sur
  la MÊME base a lui-même échoué : la passe « sans-societe » du premier essai avait déjà
  activé un second facteur sur `direction@codima.test` (utilisée alors comme
  `COURRIEL_MULTI`) sans que le script retienne la clé — `connexionSansSociete` l'ignore
  délibérément (commentaire en tête de fonction). Reconnecter `direction` comme
  `COURRIEL` au second essai a donc buté sur un défi TOTP dont la clé n'était plus
  connue. Base détruite et recréée une seconde fois, procédure rejouée en UNE SEULE
  passe avec les bonnes identités dès le départ — c'est ce run qui a produit les 172
  captures committées.

**Leçon pour la prochaine régénération** : ne jamais lancer `scripts/captures.mts` deux
fois de suite sur la même base en changeant d'identité — la première passe peut avoir
déjà enrôlé un second facteur sur un compte qu'on compte réutiliser différemment.
Repartir d'une base fraîche dès qu'un rôle change de casquette entre deux essais.

## L'exemple de commande du README reste faux, et ce n'est pas corrigé ici

La section « Comment la rejouer » de `docs/captures/README.md` est un **littéral
intégral** dans `scripts/captures.mts` (fonction `redigerReadme`) : le script ne la
dérive de rien, il la réécrit mot pour mot à chaque prise. Son exemple d'étape 4 affiche
toujours `COURRIEL_MULTI=direction@codima.test`, alors que depuis 9L04L (14/11/2026)
l'identité correcte pour `COURRIEL` est `direction` et celle de `COURRIEL_MULTI` est
`admin_societe` (avec sa seconde habilitation ajoutée en SQL). Corriger ce littéral est
un changement de `scripts/captures.mts`, donc du CODE — hors périmètre de ce ticket
(« aucun fichier de code »). Laissé tel quel, nommé ici pour que la prochaine prise ne
retombe pas dans le même faux départ.

## Une régression RÉELLE, trouvée par la mesure — pas par le témoin

La table « Mesure » du README (colonne « Erreurs », console du navigateur) remonte un
écart neuf sur les deux seuls écrans qui en rendent : `terrain` (0 → 1 erreur) et
`terrain-intervention` (0 → 2 erreurs). Reproduit isolément (Playwright, hors capture,
sous le compte technicien `garnier@codima.test`) :

```
[response] 200 http://127.0.0.1:3100/terrain-hors-reseau
[console] error Refused to frame 'http://127.0.0.1:3100/' because an ancestor
violates the following Content Security Policy directive: "frame-ancestors 'none'".
[frame navigated] chrome-error://chromewebdata/
```

**Cause isolée** : `components/terrain/copie-locale.tsx` (`PrechargementCoquille`,
ticket 9F4H4B) charge `/terrain-hors-reseau` dans un `<iframe>` caché pour préchauffer
le cache du service worker hors ligne — mécanisme qui ne se monte QUE pour le rôle
`technicien` (`app/(mobile)/layout.tsx:78`). `next.config.ts:83` (ticket
**9L08-EN-TETES-SECURITE**, commit `559ed3743`, postérieur à la dernière prise du
14/11) pose depuis lors un en-tête `Content-Security-Policy: frame-ancestors 'none'`
sur **toutes** les réponses, y compris celle de `/terrain-hors-reseau` elle-même. Le
navigateur refuse donc d'encadrer sa propre page : l'iframe atterrit sur
`chrome-error://chromewebdata/`, et le préchauffement du cache hors-ligne du technicien
**ne se produit plus jamais**, silencieusement — `PrechargementCoquille` est écrite pour
ne jamais échouer bruyamment (« même contrat que `components/pwa/enregistrement.tsx` »),
donc rien ne le signale ailleurs qu'ici, dans la mesure de ce script.

**Portée** : ce n'est pas un défaut de capture ni de cette base jetable — l'en-tête
`frame-ancestors 'none'` est posé pour TOUT visiteur, y compris un vrai technicien sur un
vrai téléphone. Le mécanisme de 9F4H4B (I4 — le terrain fonctionne sans réseau) est
cassé par 9L08 depuis le 559ed3743, et personne ne l'a vu parce que la galerie n'avait
pas été régénérée depuis. Deux tickets déjà livrés se contredisent ; à arbitrer
(desserrer `frame-ancestors` pour l'origine propre, ou remplacer le mécanisme de
préchauffement par autre chose qu'un iframe) — **hors périmètre de ce ticket** (aucun
fichier de code, aucune migration). Signalé ici pour qu'un ticket dédié s'en charge.

Note mineure, même table : `terrain-intervention` porte désormais 1 texte « hors
échelle » aux quatre largeurs — le titre de fiche (`h1.text-app-encre.truncate.text-17`,
`app/(mobile)/terrain/[id]/page.tsx:527`) mesure 17 px, hors de l'échelle fermée
12/13/14/15/16/18/24/28 (D138/D143). La ligne elle-même n'a pas été touchée par 9L53 (le
dernier lot sur ce fichier) ; elle existait déjà, simplement jamais vue faute de prise
récente. Non corrigée ici, pour la même raison que ci-dessus.

## Ce qui n'a pas pu être photographié, et pourquoi

Les 8 mêmes refus que la dernière prise, tous deux légitimes et déjà documentés par le
script (section « Refusées à cette prise ») :

- **`portail`** (4 images) : aucun compte portail ne peut recevoir de lien de premier
  accès aujourd'hui (D10 — un compte portail n'a aucune ligne dans `utilisateur_societe`,
  et l'amorçage en exige une).
- **`demande-detail`** (4 images) : le semis de démonstration ne pose aucune ligne dans
  `demande`. Le registre `/demandes` se photographie ; aucune fiche n'existe à détailler.

## Contrôle I9

Les 81 images changées relues : aucune ne montre de nom de client réel, de numéro de
série réel ni d'adresse courriel réelle — uniquement les identités `*@codima.test` /
`*@example.test` du semis de démonstration et des données inventées (« Atelier Ducos »,
« Garage du Nord », etc.).

## État du dépôt

- Aucun changement de code applicatif, aucune migration, aucune donnée de production.
- `docs/captures/README.md` et 81 images régénérées ; 0 ajoutée, 0 retirée.
- La base jetable (port 5555, conteneur ad hoc hors dépôt), le serveur de capture
  (port 3100) et les scripts temporaires de pose de mot de passe (hors dépôt, `/tmp` et
  effacés du répertoire de travail) ont tous été détruits après la dernière prise.
- `pnpm test`, `pnpm test:isolation` et `CI=1 pnpm verify` rejoués après coup, tous
  trois verts.
