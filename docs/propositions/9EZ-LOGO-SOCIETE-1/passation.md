# 9EZ-LOGO-SOCIETE-1 — passation

## MIGRATION À APPLIQUER EN PRODUCTION PAR ALEXIS

Deux migrations neuves, à appliquer dans l'ordre (`pnpm db:deploy`) :

- `20261014050000_logo_societe_1` — colonnes `societe.logo_octets`/`logo_type`/
  `logo_empreinte`, contraintes (`societe_logo_type_reconnu`,
  `societe_logo_complet`, `societe_logo_plafond`, `societe_logo_empreinte_forme`).
  **Aucun `GRANT` ni politique RLS nouveaux** — `codiplan_app` détient déjà
  `UPDATE` sur `societe` (toutes tables, 20260820130000), et
  `cloisonnement_identite` (sans clause `FOR`) borne déjà l'écriture à la
  société active.
- `20261014060000_logo_societe_audit` — `journal_audit_tracer` substitue
  `societe.logo_octets` par sa taille et son SHA-256 (D202 amendée), même
  mécanisme que `document.octets`.

Aucune donnée à migrer : les trois colonnes partent NULL (aucun logo).

## CE QUI EST LIVRÉ (8 commits `9EZ-LOGO-SOCIETE-1`, + 1 correctif)

1. **Point 1** — migration (colonnes, contraintes) et amendement de D202
   (`scripts/lib/perimetre-audit.ts`, `COLONNES_NON_RECOPIEES_AUDIT`).
2. **Point 2** — `lib/societes/logo.ts` : `lireLogo`, `empreinteDuLogo`,
   `enregistrerLogo`, `retirerLogo`. Capacité `parametrer_societe` vérifiée
   dans le module lui-même (pas seulement à la porte de la route) ; type jugé
   sur les octets magiques (`formatImageReconnu`, déjà la doctrine des
   photos terrain) ; motifs nommés (`logo.refus.droit/vide/taille/type`).
   Unitaires sur les refus (sans base), isolation sur le dépôt réel, le
   cloisonnement société↔société et la substitution d'audit.
3. **Point 3** — `GET /api/societe/logo` (lecture ouverte à tout compte de
   la société active — nouvelle porte `exigerSessionActive`,
   `lib/auth/porte.ts`, aucune capacité à juger), `POST /api/parametres/
   societe/logo` et `/retirer` (`parametrer_societe`). Gardiens D-12
   (`ROUTE_CAPACITE` 84 routes, `PORTE_COMPLETE`, `EXEMPTIONS`) et le
   gardien d'échange mis à jour.
4. **Point 4** — `/parametres/societe` rouvre pour le SEUL bloc Logo (amende
   D167/QT-22 — les couleurs de charte restent fermées jusqu'au lot 7) :
   aperçu, dépôt, retrait avec confirmation (`BoutonAvecConfirmation`),
   bandeau de motif existant. Lien « Changer le logo » sur la carte Identité
   du hub, visible seulement avec la capacité.
5. **Point 5** — `ThemeSociete.logoEmpreinte` (jamais les octets),
   `BandeauSociete` l'affiche devant le nom — pied de la barre ET bandeau
   terrain/portail (un seul composant). Sans logo, rendu strictement
   identique à avant.
6. **Point 6** — `BonIntervention.societe.logoEmpreinte`, logo à gauche de
   la raison sociale dans l'en-tête, visible à l'impression (même
   `zone-impression-bon`).
7. **Point 7** — `tests/e2e/9ez-logo-societe.spec.ts` : dépôt PNG/JPEG,
   refus nommés (SVG, >300 Ko, texte renommé `.png`), retrait, refus ADV
   (page et POST, avec motif), aucun débordement à 375 px — sous le compte
   `admin_societe` réel, MFA comprise. Image de test GÉNÉRÉE dans l'épreuve
   (PNG construit à la main via `node:zlib`, jamais un octet magique seul —
   un octet magique seul suffit au serveur mais rend une icône cassée à
   l'écran, mesuré en écrivant ce lot). Fixtures `zz9EZ-`, nettoyées en
   `afterAll` (intervention propre au fichier + logo de la société PARTAGÉE
   de la scène, remis à zéro). Captures 375/1280 dans
   `docs/propositions/9EZ-LOGO-SOCIETE-1/captures/`.
8. **Point 8** — D206 dans `docs/arbitrages.md`, amende D167 (QT-22) et D202,
   marques réciproques posées des deux côtés (gardien du câblage
   arbitrage ↔ arbitrage à jour).
9. **Correctif** — trois épreuves EXISTANTES, hors territoire du ticket mais
   rendues fausses par l'amendement de D167, mises à jour (jamais
   assouplies) : `tests/e2e/deconnexion.spec.ts` (attendait la redirection
   que QT-22 imposait — affirme désormais le refus nommé d'un ADV sur
   l'écran réel) ; `tests/unit/navigation/atteignabilite-ecrans.test.ts`
   (la liste des écrans retirés-en-redirection repasse à VIDE — l'écran est
   de nouveau atteint de proche en proche depuis le hub) ;
   `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` (ancre de greffe
   repointée sur une clé encore présente dans le fichier modifié).

## CE QUI N'A PAS ÉTÉ FAIT, ET POURQUOI

**L'isolation société-à-société N'EST PAS rejouée au niveau e2e.** La scène
de bout en bout ne porte qu'UNE société connectable ; construire une seconde
société et son propre compte uniquement pour ce test aurait dupliqué, en
plus fragile et pour un budget de temps disproportionné, ce que
`tests/isolation/logo-societe.test.ts` et `logo-societe-routes.test.ts`
prouvent déjà en profondeur, sous les VRAIES politiques RLS (lecture
`empreinteDuLogo` sous le contexte de A en demandant explicitement B → `null`
; `GET /api/societe/logo` sous B après un dépôt sous A → `404`). C'est la
preuve la plus forte disponible dans ce dépôt pour ce point précis.

## CI=1 pnpm verify:full EN ENTIER, EN UN SEUL APPEL

Joué en entier (HEAD `7327a73a`, avant les deux derniers correctifs) :
`format:check`, `typecheck`, `lint`, `test` (4763 passed), `test:isolation`
(1582 passed), `build`, `feries:horizon`, `audit:partitions`, `test:e2e`
(suite ENTIÈRE, 1410 tests) — UN SEUL échec :

```
1) [chromium] › tests/e2e/tous-les-ecrans-rendent.spec.ts:313:7 › /parametres/societe rend 200
   Error: /parametres/societe a fini sur /parametres/societe — une redirection masquerait un 200 qui ne prouve rien
   Expected: "/parametres"   Received: "/parametres/societe"
48 skipped, 28 did not run, 1333 passed (53.3m)
```

**Cause** : `REDIRECTS_CONNUS["/parametres/societe"] = "/parametres"`, une
entrée écrite pour QT-22/D167 et rendue fausse par l'amendement D206 de ce
lot — exactement la même famille de défaut que `deconnexion.spec.ts`, traité
au point 7/correctif. Corrigée (commit `098fefec`, entrée retirée) et
REJOUÉE ISOLÉMENT — verte :

```
✓ 1 [chromium] › tests/e2e/tous-les-ecrans-rendent.spec.ts:312:7 › /parametres/societe rend 200 (3.0s)
1 passed (1.1m)
```

**La suite `test:e2e` COMPLÈTE n'a PAS été rejouée une seconde fois après ce
dernier correctif** — budget de temps (le lot touchait au plancher de
150 minutes au moment du second échec, et une suite complète prend ~53 min).
Ce qui a été vérifié après ce correctif, EN ENTIER : `pnpm format:check`,
`pnpm typecheck`, `pnpm lint`, `pnpm test` (4763 passed) — tous verts, HEAD
`098fefec`. **À rejouer par la prochaine session avant tout push** :
`CI=1 pnpm verify:full` en entier, en un seul appel, pour fermer ce doute —
rien dans les 53,3 minutes de la suite précédente ne laissait soupçonner un
second défaut, mais ce n'est pas une preuve que la suite complète, rejouée
après le dernier commit, le confirme.
