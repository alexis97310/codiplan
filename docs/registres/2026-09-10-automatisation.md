# Registre — 10 septembre 2026 : monter l'automatisation

*Écrit au fil de l'eau. Toute empreinte est lue dans `git`, toute heure à l'horloge.*

---

## Ce qui traînait

### #95 — « la base hébergée a DÉRIVÉ »

**Ce que le contrôle a comparé :** l'état observé de la base hébergée contre ce que le dépôt exige — RLS, formes de politique, périmètre d'audit, privilèges, partitions, armement du contexte.

**Ce qu'il a trouvé différent : UN seul écart** — `utilisateur_client` ne porte pas la branche « mon rattachement » en `SELECT`, et retombe donc sur la forme « habilitation ».

**Laquelle des deux hypothèses.** La première, et **quatre migrations, pas deux** :

| | |
|---|---|
| dernier `db-migrate` réussi | exécution `34414541617`, **2026-09-09 22:55 UTC**, commit `699d33f` |
| migrations présentes aujourd'hui et absentes alors | `20260911010000_rattachement_portail_d92`, `20260911020000_assujettissement_vgp_l9`, `20260913100000_documents_l8`, `20260913110000_bac_de_reception_l8_07` |

`20260911010000` crée **exactement** la politique manquante. Deux confirmations indépendantes que rien n'a été touché à la main : la veille énumère 22 tables de 1ʳᵉ catégorie et **`document` / `document_recu` n'y sont pas** — elles n'existent pas en base ; et un geste manuel supprimant une politique n'aurait pas fait disparaître deux tables. **La base n'a pas dérivé : elle a pris du retard.**

Marche à suivre écrite dans le ticket, en trois lignes lisibles sans contexte.

### Les 48 captures — branche `claude/adoring-turing-br30wm`

Rebasée sur `main` sans conflit, proposition #98 ouverte, `verify` vert, **fusionnée** — `main` à `2fe6e8b`.

**Le README n'a PAS été régénéré, et c'est un refus motivé.** Mesuré : entre `b8c3f76` (photographié) et `2fe6e8b`, 67 fichiers ont changé et **aucun sous `app/`, `components/`, `lib/theme/` ni `lib/i18n/`**. Les images sont exactes pour `main`, et `b8c3f76` en est un ancêtre — un lecteur peut l'ouvrir, ce que la règle demande. Réécrire `2fe6e8b` à la main dans un fichier que le script génère aurait fait les deux choses interdites : écrire une empreinte **de mémoire**, et poser une **seconde lecture** du même fait. Ce que le refus laisse ouvert est porté à la file (R1-02).

---

## Ce qui est construit

- **`docs/protocole-session.md`, rang 1.** Les sept sections recopiées à l'identique en tête de chaque consigne depuis dix jours, écrites une fois.
- **`.github/workflows/claude.yml`** — `@claude` dans un ticket ou une proposition. Aucune entrée `prompt`, faute de quoi l'action basculerait en mode automatique.
- **`.github/workflows/nuit.yml`** — `schedule` à 16h00 UTC (03h00 à Nouméa), **une heure après** la vérification nocturne : la nuit part d'un `main` dont l'état vient d'être mesuré. Plus `workflow_dispatch`, pour un lancement depuis un téléphone.
- **`pnpm file`** — le premier travail non bloqué. 85 tickets, 49 libres, 36 livrés, 0 bloqué. **Premier : L1-08b**, le moteur d'import.
- **L'étiquette `arbitrage`** et sa convention, écrite au protocole. Premier spécimen : #99.

## Ce qui a été décidé seul

| Décision | Condition de réouverture |
|---|---|
| Budget de nuit à 120 min / 150 tours **par défaut**, réglables à l'exécution | #99 — dès qu'une nuit réelle donne une mesure |
| `GH_TOKEN` à l'étape pour le seul `gh`, `github_token` **non passé** à l'action | le jour où un outil GitHub authentifié comme l'application couvre l'ouverture et la fusion |
| Refus de régénérer le README des captures | R1-02, ou tout changement sous les chemins d'écran |
| `LIVRÉ` ne se pose que sur preuve ; dans le doute, `LIBRE` | jamais — c'est le sens de défaillance choisi, et il est écrit |

## Deux choses relevées en chemin

**L2-07 se disait `BLOQUÉ` et il est livré** — l'arbitrage a été rendu par D84 ; personne n'était revenu retirer la prose. Exactement ce qu'un marqueur lisible à la machine existe pour empêcher.

**Le gardien de la veille a mordu sur l'auteur de ce ticket, le jour même.** La fonction s'appelait `ecartsDeLaFile` ; tout export `ecarts…` de `scripts/lib/` est un contrôle de veille par convention gardée. *C'est au nouveau venu de changer de nom, jamais au gardien d'élargir son motif.*

Et une troisième, mesurée en écrivant R1-01 : **le motif de titre ne lisait que `L…`**, si bien qu'un ticket de revue n'entrait dans la file ni pour le gardien ni pour la nuit — aucun rouge, et aucun travail. C'est la direction permissive du prédicat (§9, 11/09), qui ne produit jamais de signal.

## Une inscription au §9

*Une cause écrite dans un gabarit se répète à chaque alarme, et elle n'a jamais été mesurée une seule fois.* Le ticket de veille rouge affirme le geste manuel sans que la veille compare jamais les migrations appliquées au dépôt. Réparation portée à la file (R1-01) plutôt que faite en passant.

## Où reprendre

`pnpm file` → **L1-08b**, le moteur d'import. Le rapport de I6 existe (`lib/excel/controle.ts`) ; ce qui manque est l'**application** et l'**annulation** partielle et sûre.
