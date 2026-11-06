# 9J21-PORTAIL-FINITIONS-INVITATION — passation

## État : LIVRÉ, captures incomplètes (voir point 7)

Budget de 120 min. T0 = 08:27 (Pacific/Noumea). Commits livrés, du plus ancien au plus récent :

1. `82fc0c93d` — points 2, 3, 4 : le lien affiché, le message juste, le refus d'un compte interne.
2. `d72a0153a` — point 5 (tentative 1) : `pretAChoisirUneDestination` dans `app/(apres-session)/arrivee/decision.ts`.
3. `ae3ed5334` — point 6 : l'adresse invitée, affichée en lecture seule sur `/premier-acces`.
4. `00de7d446` — point 5 bis : la VRAIE réparation — `etatArrivee` (`lib/auth/arrivee.ts`) bloquait encore.
5. `e62dfa2be` — point 7 : captures 375/1280 px, **APRÈS seulement**.

## Mesure (point 1)

- Carte « Accès portail » : `app/(back-office)/clients/[id]/page.tsx:1229-1273`, sous-composant
  `components/clients/formulaire-invitation-portail.tsx`.
- Route : `app/api/clients/[id]/inviter/route.ts` — rend `{url, dejaActif}` ou `{erreur}` en JSON,
  `Cache-Control: no-store`, jamais de redirection.
- `inviterClientAuPortail` : `lib/auth/lien-d-acces.ts:575-702` (avant ce ticket ; les numéros de
  ligne ont bougé depuis). Désigne l'identité par le COURRIEL seul, sans jamais vérifier si elle
  porte déjà une ligne `utilisateur_societe` (compte interne) avant d'y poser un rattachement
  `utilisateur_client`.
- `/premier-acces` : `app/(sans-session)/premier-acces/page.tsx` — ne lisait AUCUN courriel, ni en
  entrée ni en sortie ; l'identité vient exclusivement du jeton
  (`lib/auth/premier-acces.ts#choisirLePremierMotDePasse`).
- `/arrivee` : `app/(apres-session)/arrivee/decision.ts` + `page.tsx` + `lib/auth/arrivee.ts`.
  Le bouton « Travailler sur cette société » poste sur `/api/session/societe` (`basculerSociete`),
  qui redirige TOUJOURS vers `/arrivee` — c'est `/arrivee` qui décide ensuite.
- Distinction compte interne / compte client : AUCUN champ sur `Utilisateur` — elle vit uniquement
  dans la table où la ligne existe (`utilisateur_societe` vs `utilisateur_client`), lue par
  `lireRole`/`roleDansLaSocieteActive` (`lib/auth/societe-active.ts`, `lib/auth/lien-d-acces.ts`).

## Point 2 — Le lien affiché (`components/clients/formulaire-invitation-portail.tsx`)

Après « Inviter au portail », le lien s'affiche désormais en clair dans un champ `readonly`, avec
un bouton « Copier » (`clients.acces.copier_lien` — clé déjà présente, jamais câblée avant ce
ticket) et son texte de durée de validité. L'état `EtatInvitation` perd ses variantes `copie` /
`a_copier_a_la_main` au profit d'une seule `lien`, portée en mémoire React — jamais relue de la
base, jamais stockée en clair, disparaît au rechargement.

## Point 3 — Le message juste

`surSaisie` ramène l'état à `repos` dès que le champ courriel change : le message affiché parle
toujours de la DERNIÈRE invitation, jamais de la précédente.

## Point 4 — Le refus d'un compte interne

`inviterClientAuPortail` (`lib/auth/lien-d-acces.ts`) appelle désormais `roleDansLaSocieteActive`
sur l'identité trouvée par courriel, AVANT tout rattachement `utilisateur_client`. Un rôle non nul
(donc une ligne `utilisateur_societe` dans la société active) refuse nommément
(`compte_interne`), sans écriture. Nouvelle clé `clients.acces.refus.compte_interne`. Épreuve
d'isolation ajoutée dans `tests/isolation/invitation-portail-client.test.ts` (crée un compte
interne actif, vérifie le refus et l'absence de rattachement).

## Point 5 — L'arrivée, EN DEUX TEMPS (lire avant de toucher à nouveau ce chemin)

**Premier correctif (`d72a0153a`), INSUFFISANT.** `basculerSociete` pose toujours `clientId: null`
pour un compte portail (D70) : désigner le client n'est pas le rôle de la bascule. La redirection
automatique de `app/(apres-session)/arrivee/page.tsx` se gardait sur `estContexteActif`, qui EXIGE
ce `clientId` — j'ai ajouté `pretAChoisirUneDestination` (devenu `societeEtRoleEtablis`, voir plus
bas) pour la remplacer À CET ENDROIT. **Ça ne suffisait pas.**

**La vraie cause (`00de7d446`).** `etatArrivee` (`lib/auth/arrivee.ts`) teste `estContexteActif`
LUI AUSSI, et PLUS TÔT que `page.tsx` — il rend `{issue: "sans_societe"}` pour un compte portail
juste basculé, alors qu'une société EST active. `page.tsx` ne voit donc jamais `etat.issue ===
"arrivee"`, et mon premier correctif était du code mort pour ce chemin précis. Résultat observable
avant correction : la société s'affichait comme NON active (bouton « Travailler sur cette
société » au lieu du badge « Accès actif »), le clic rebasculait sur le même contexte, et la boucle
se refermait sans jamais mener au portail — exactement le symptôme d'Alexis.

**Réparation.** `societeEtRoleEtablis` vit maintenant dans `lib/auth/contexte.ts`, à côté
d'`estContexteActif` dont il est le relâchement délibéré (société + rôle + second facteur, sans
l'appariement rôle↔client qui ne sert qu'à OUVRIR une transaction cloisonnée). `etatArrivee`
l'utilise à la place d'`estContexteActif`. La lecture de la raison sociale, qui passait par
`avecContexteApplicatif` (lequel aurait LEVÉ une exception pour ce même contexte), passe désormais
par `avecIdentite` + la forme « adhésion » — la même lecture que `societesDuCompte`.
`app/(apres-session)/arrivee/decision.ts` ne porte plus sa propre copie du prédicat (import direct
de `lib/auth/contexte.ts` dans `page.tsx`).

**Preuve** : `tests/e2e/captures-9j21-finitions-invitation.spec.ts` (scène D) — un compte client à
société unique, connexion directe, atterrit sur `/portail` (la connexion active déjà seule la
société, comme pour un compte ADV à une société, `arrivee.spec.ts`). `tests/unit/auth/contexte.test.ts`
et `tests/unit/app/arrivee-decision.test.ts` pour la fonction pure.

## Point 6 — L'adresse bloquée au premier accès

`choisirLePremierMotDePasse` ne lisait (et ne lit toujours) AUCUN courriel soumis : l'identité vient
exclusivement du jeton. Ce qui manquait n'était pas un contrôle, c'était l'affichage.
`inviterClientAuPortail` pose désormais l'adresse invitée dans le lien lui-même
(`redirectTo=/premier-acces?email=...` — Better Auth la reporte jusqu'au lien final, en plus du
jeton). `/premier-acces` l'affiche en texte (nouvelle clé `premier_acces.compte`), JAMAIS dans un
champ soumis au serveur : il n'existe donc structurellement aucune autre adresse à transmettre, et
rien à « changer ». Aucune lecture de base ajoutée au GET (D35/D50 intacts).

Épreuves : `tests/isolation/invitation-portail-client.test.ts` (le `callbackURL` porte bien
`?email=`), `tests/e2e/captures-9j21-premier-acces-adresse.spec.ts` (affichage, absence de champ
nommé).

## Point 7 — Captures : APRÈS SEULEMENT (lire avant de les compléter)

`tests/e2e/captures-9j21-finitions-invitation.spec.ts` couvre les quatre scènes, aux deux largeurs,
mais **sans AVANT**. Tentative faite (checkout détaché sur `f6385f699`, le commit qui précède ce
ticket) : la scène A y échoue — l'ancien composant tente `navigator.clipboard.writeText` et bascule
sur un état de repli (`a_copier_a_la_main`) que je n'ai pas eu le temps de rejouer correctement
avant la limite de 120 minutes. Plutôt que de dépasser le budget, j'ai abandonné la tentative,
restauré HEAD, et retiré les scénarios AVANT du fichier commité (ils auraient autrement tourné pour
toujours dans `verify:full`/CI contre le code APRÈS, et y auraient échoué — le même constat que les
tickets précédents de ce lot, qui ne committent jamais leurs variantes AVANT telles quelles).

**Pour qui reprend ce point** : rejouer `git checkout f6385f699`, copier une version ad hoc
(NON commitée) du spec avec les quatre scénarios AVANT adaptés au comportement RÉEL de l'ancien
composant (scène A : chercher l'état `a_copier_a_la_main`, pas l'absence de `input[readonly]`),
`CAPTURES_9J21=... pnpm exec playwright test ... -g AVANT`, puis `git checkout -` pour revenir.

## Vérification

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:isolation` verts après chaque commit.
`tests/e2e/arrivee.spec.ts`, `tests/e2e/captures-9j02a-acces-portail.spec.ts`,
`tests/e2e/9g6-point3-premier-acces.spec.ts` rejoués sans régression.
`verify:full` laissé à la file.

## Fichiers touchés (hors tests et captures)

- `lib/auth/lien-d-acces.ts` — refus `compte_interne`, `?email=` sur le lien.
- `lib/auth/contexte.ts` — `societeEtRoleEtablis`.
- `lib/auth/arrivee.ts` — `etatArrivee` utilise `societeEtRoleEtablis` et `avecIdentite`.
- `app/(apres-session)/arrivee/page.tsx`, `decision.ts` — idem côté route.
- `components/clients/formulaire-invitation-portail.tsx` — le lien affiché.
- `app/(sans-session)/premier-acces/page.tsx` — l'adresse affichée.
- `lib/i18n/fr.ts` — `clients.acces.refus.compte_interne`, `premier_acces.compte`, texte de
  `clients.acces.lien_copie` ajusté (ne prétend plus avoir copié automatiquement).
