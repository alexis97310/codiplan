# 9L02-AFFECTER-CHEVAUCHEMENT — passation

Décision d'Alexis du 10/11/2026 : « Changer de technicien » (`affecterTechnicien`) écrivait
`technicien_id` sans juger le chevauchement, ni vérifier que l'identifiant visé désigne un technicien
réel de la société active. Écrite en entier : `docs/arbitrages.md` D248.

## AUCUNE MIGRATION

Les deux correctifs tiennent entièrement dans `lib/` et `app/` : aucune colonne, aucune politique
RLS, aucun schéma n'a changé. `technicien_id` reste sans clé étrangère, comme avant ce ticket — ce
que l'application vérifie maintenant, la base ne le garde toujours pas.

## Ce que ce ticket fait

1. **Le chevauchement, par le MÊME verdict qu'à la pose et au déplacement.** `verdictChevauchementSous`
   (`lib/interventions/depot.ts`) est extraite de `verdictALaPose` — qui l'appelle désormais elle
   aussi, au lieu de porter le calcul en ligne — et partagée avec `affecterTechnicien`. Deux créneaux
   qui se touchent passent toujours (même borne stricte qu'avant).

2. **Un technicien ACTIF de la société active, avant toute écriture.** Vérifié par
   `utilisateur_societe` — rôle `technicien` (`Role.technicien`, jamais une chaîne libre, D5/D47) et
   `utilisateur.actif = true` — avec le filtre société explicite en plus de la politique RLS, même
   discipline que `majorationDeLIntervention` sur la même table. Refus nommé :
   `intervention.refus.technicien_introuvable`.

3. **Le refus se montre DANS le dialogue « Changer de technicien », sans perdre la saisie.** Avant ce
   ticket, un refus de ce formulaire (habilitation, absence — et maintenant chevauchement, technicien
   introuvable) ne s'affichait que dans le bandeau générique de la fiche, le dialogue refermé et le
   choix oublié. `versLaFiche` (`app/api/interventions/actions.ts`) gagne un quatrième paramètre
   optionnel, des paramètres d'URL supplémentaires, utilisé par la seule route `/affecter` pour poser
   `dialogue=changer_technicien` (jamais déduit de `motif`, que `/deplacer` partage pour « absence »
   et « habilitation ») et `technicien_vise` (la saisie refusée, revalidée contre `optionsAffectation`
   avant réaffichage — LIENS-1, un identifiant forgé est ignoré en silence). `Dialogue` et `MenuPlus`
   (`components/ui/`) gagnent chacun un `ouvertInitialement` additif, pour que les deux se rouvrent
   ensemble au rendu qui suit la redirection — un dialogue de `MenuPlus` ne se monte que si le menu
   est ouvert, les deux doivent donc s'ouvrir dans LE MÊME rendu.

## UNE NUANCE SIGNALÉE, PAS TRANCHÉE SEULE : QUEL « ACTIF » ?

Deux colonnes `actif` coexistent sur un technicien : `utilisateur.actif` (le compte, désactivé par
`/parametres/equipe`) et `technicien.actif` (la ressource, bascule propre à la société — c'est CELLE-LÀ
qui retire quelqu'un de la liste PROPOSÉE par le `<select>`, `techniciensActifs` dans la fiche). Ce
ticket vérifie la PREMIÈRE. La seconde aurait été plus stricte — et plus cohérente avec ce que le
`<select>` propose déjà — mais `UTILISATEUR_PAR_ROLE[Role.technicien]`, l'identité canonique de
*toute* la suite d'isolation des interventions (`tests/isolation/setup/global.ts`), n'a jamais de
ligne `technicien` : la vérifier aurait fait échouer des dizaines de scénarios préexistants, sans
rapport avec ce ticket, pour corriger un harnais partagé que je n'ai pas voulu toucher à cette heure.
**À trancher par Alexis** : faut-il aussi fermer `technicien.actif`, et si oui, le harnais
d'isolation doit-il gagner cette ligne pour son identité canonique ?

## Épreuves

- **Isolation** — `tests/isolation/affectation-chevauchement.test.ts` : témoin sans voisine ; le
  chevauchement refuse (et rien n'est écrit) ; deux créneaux qui se touchent passent ; témoin
  technicien actif de la société ; un non-technicien de la société est refusé ; un identifiant d'une
  autre société est refusé ; un technicien inactif (compte désactivé) est refusé.
- **Bout en bout** — `tests/e2e/captures-9l02-affecter-chevauchement.spec.ts` : deux interventions de
  Ducos sur le même créneau, l'une déjà posée sur un technicien, l'autre sans — choisir ce même
  technicien refuse, le motif se montre dans le dialogue rouvert, la sélection reste posée. Captures
  1280/390 sous `docs/propositions/9L02-AFFECTER-CHEVAUCHEMENT/captures/`
  (`CAPTURES_9L02=<dossier>` — rien n'est écrit sans cette variable).
- **Gardien DATES-1** (`tests/unit/dates/comparaison-civile.test.ts`) — l'exemption de
  `lib/interventions/depot.ts` est ancrée sur le texte EXACT de `instantDeLAgence` ; l'extraction de
  `fuseauDeLAgenceSous` a changé ce texte, l'exemption est mise à jour en conséquence (même ligne
  exemptée, même raison).
- **Câblage chapitre 10 ↔ arbitrages** (`tests/unit/docs/cablage-arbitrages.test.ts`) — D248 ↔
  RG-PLA-03 (amendée, nomme l'affectation) et RG-PLA-09 (nouvelle, le technicien actif).
- **Cohérence du backlog** (`tests/unit/docs/coherence-backlog.test.ts`) — L2-08b cite RG-PLA-03 ;
  relu contre son texte amendé, rien n'y a cessé d'être vrai (le blocage reste entier : une
  intervention ne porte toujours qu'un technicien).

## `CI=1 pnpm verify` — jouée au complet, vert

`format:check`, `typecheck`, `lint`, `test` (5771 tests), `test:isolation` (2192 tests) et `build` :
vert de bout en bout.
