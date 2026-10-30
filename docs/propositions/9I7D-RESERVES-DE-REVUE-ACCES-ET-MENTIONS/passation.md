# 9I7D-RESERVES-DE-REVUE-ACCES-ET-MENTIONS — passation

Décision B d'Alexis (30/10/2026 ~06:50) sur le lien d'accès copié (9I6B), les
réserves de la revue de 9I6B (solde 599) et celles de la revue de 9I7A
(solde 601). Un commit par point.

## Point 1 — décision B : la copie d'un NOUVEAU lien refuse pour direction/admin_societe

`copierNouveauLienDAccesBureau` (`lib/auth/acces-bureau.ts`) lit désormais le
RÔLE de la cible (`roleDuCompteDeBureauMembre`) et refuse nommément
(`cible_protegee`) pour `direction`/`admin_societe`, avant tout jeton émis.
Le premier lien (`copierLienDAccesBureau`) et l'envoi par courriel restent
permis pour ces deux rôles — SEULE la copie d'un nouveau lien est fermée.
L'écran (`MenuGestesAccesActif`, `copieNouveauLienAutorisee`) retire
l'entrée « Copier le lien d'accès » du menu « … » pour ces comptes.
Enregistré au registre sous **D223** (le ticket citait « D222 », déjà pris —
voir la note de numérotation dans `docs/arbitrages.md`).

Épreuves : isolation (refus nommé, sans trace ; premier lien toujours permis,
`it.each` sur les deux rôles), un composant (`MenuGestesAccesActif`, l'entrée
absente/présente), une épreuve e2e de bout en bout — requête forgée sur la
route réelle, ET l'écran (le bouton disparaît pour la direction, reste pour
un ADV témoin).

## Point 2 — réserves de la revue de 9I6B

- **M2** (épreuves de refus manquantes) : `copierNouveauLienDAcces`
  (technicien) n'avait pas l'épreuve « ADV refusé, requête forgée » ;
  `copierNouveauLienDAccesBureau` n'avait NI celle-là NI « société B ».
  Les trois ont été ajoutées sur le modèle de leurs équivalents
  `copierLienDAcces`/`copierLienDAccesBureau`, déjà complets.
- **B4** (`Cache-Control: no-store`) : les quatre routes `copier-*`
  (technicien et bureau, premier et nouveau lien) posent désormais cet
  en-tête sur TOUTE réponse (`lib/auth/reponse-lien-copie.ts`, helper
  partagé) — succès (porte l'URL) comme refus.
- **B5** (le motif nommé affiché) : la route rend `{ erreur: motif }` en
  200 (jamais un code d'échec : un refus nommé n'est pas une panne) ;
  `BoutonCopierLien` l'ignorait et affichait toujours le texte générique.
  Il distingue désormais un refus nommé (texte propre, via
  `prefixeMotifRefus` — le dictionnaire diffère entre technicien et bureau,
  `cible_protegee` n'existant que pour ce second domaine) d'une vraie panne
  (réseau), avec un repli générique si le motif est inconnu.
- **B6** (« lien copié » distinct de « lien envoyé ») : réalisé SANS
  migration — `detailEstCopie` (`lib/auth/lien-d-acces.ts`) relit le texte
  déjà journalisé par `detailCopie`/`detailEnvoi` et pose un drapeau
  `copie: boolean` sur `EtatAcces`/`EtatAccesBureau` (`lien_envoye` et
  `lien_expire`). L'écran affiche « Lien copié le » / « copié le » plutôt
  qu'« envoyé » quand c'est le cas.
- **M3** (invalider les anciens liens non utilisés) — **NON RÉALISÉ, point
  ouvert, et pour une raison structurelle mesurée, pas un manque de temps
  seul** : la table `verification` porte quatre politiques RLS de forme
  « désignation » (migration `20260908090000_categorie3_cloisonnee_l1_02d`) —
  SELECT **et** DELETE n'acceptent que `identifiant = app.
  authentification_identifiant`, jamais un filtre sur `valeur` (l'identifiant
  de la PERSONNE). Sous le rôle applicatif, **lire** les anciens jetons d'un
  utilisateur pour les retirer est donc aussi impossible que les retirer
  directement sans déjà les connaître — mesuré par un essai réel
  (`deleteMany` filtré sur `valeur` + `identifiant LIKE 'reset-password:%'`,
  posé puis retiré, deux formes de filtre Prisma essayées) : 0 ligne
  affectée dans les deux cas, alors que `clientOwner()` (hors RLS) en voit
  bien deux. Invalider « toutes les lignes SAUF celle qui vient d'être
  émise » exigerait une politique RLS supplémentaire sur `valeur` — un
  changement de schéma touchant le cloisonnement de I1, hors territoire de
  ce lot (§8 de `CLAUDE.md` : à signaler, pas à trancher ici).

## Point 3 — réserves de la revue de 9I7A

`lib/societes/identite.ts` : `\r\n` → `\n` AVANT le décompte et le stockage
(`mentionsLegalesNettoyees`) ; un octet NUL ou un caractère de contrôle C0
(hors tabulation et retour à la ligne) refuse nommément
(`mentions_legales.refus.caracteres`), jamais l'erreur 500 que PostgreSQL
lèverait pour l'octet NUL. La zone de texte (`editeur-mentions-legales.tsx`)
porte désormais `maxLength={max}`, le même nombre que le compteur et le
serveur (`MENTIONS_LEGALES_MAX`).

Épreuves : unitaires (NUL, contrôle C0, avant toute écriture) ; isolation de
la ROUTE (`tests/isolation/mentions-legales-routes.test.ts`, modèle
`logo-societe-routes.test.ts`) — ADV et technicien refusés par la porte,
texte > 1000 refusé, `\r\n` conservé en `\n` à l'aller-retour réel (POST puis
relecture en base), octet NUL refusé. Le test « force l'identifiant de B »
(`mentions-legales-societe.test.ts`) vérifie désormais le message PRÉCIS que
Prisma rend sous RLS (« No record was found for an update » — la ligne de B
est invisible au SELECT que Prisma compose avec l'UPDATE, pas le message
Postgres brut « row-level security », que seule une requête SQL directe
produirait) plutôt qu'un `rejects.toThrow()` générique.

**Point ouvert, signalé, pas réalisé** — « la saisie n'est pas perdue après
un refus » : `EditeurMentionsLegales` reste un `<form>` natif qui POSTE et
revient par une redirection 303 ; une rechute (texte trop long, caractère
refusé) remonte un `motif` dans l'URL, mais la page est RECHARGÉE entière —
l'état React (`texte`) repart de `valeurInitiale`, et le texte tapé est
perdu. Réparer cela sans perdre la dégradation « marche sans JavaScript »
exigerait de faire porter à la route un second mode de réponse (JSON,
demandé par un en-tête `Accept` ou un paramètre), pour que le composant
client puisse rester en place et réafficher sa propre saisie — un geste de
la même famille que `BoutonCopierLien`, mais qui touche une route déjà
livrée et son contrat avec le formulaire sans JS. Non commencé dans le
temps de ce lot ; à ouvrir en ticket si Alexis le veut avant 9I7E.

## Point 4 — captures

`docs/propositions/9I7D-RESERVES-DE-REVUE-ACCES-ET-MENTIONS/captures/`, 375 et
1280 px : la ligne d'un compte de direction (sans « Copier un nouveau lien »,
D223), celle d'un ADV témoin (qui le garde), le refus nommé
« Cette personne a déjà choisi son mot de passe. » affiché par
`BoutonCopierLien` au moment de la course de D65 (B5), et le bandeau de
refus des mentions légales (texte > 1000 caractères).

## Écarts au commit, par point

Rien n'a été retiré d'un commit après coup. Le seul écart entre l'énoncé et
le réalisé est M3 ci-dessus (point 2), documenté en détail à l'endroit où il
se pose plutôt que répété ici.
