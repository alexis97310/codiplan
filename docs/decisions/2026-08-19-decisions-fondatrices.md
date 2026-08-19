# Décisions fondatrices du lot 0

*19 août 2026 — première entrée du journal des décisions*

Ces trois choix conditionnent le schéma et ne se rattrapent pas. Ils sont issus de la note d'arbitrage n°1 (D7, D13, D21), reprise ici avec le raisonnement.

---

## 1. Identifiants : clé technique et numéro affiché sont distincts

**Contexte.** Le cahier des charges impose des numéros séquentiels par société (`MAC-001248`, `INT-2026-00312`) et, simultanément, la création de machines et d'interventions hors réseau. Un compteur séquentiel central est par construction inattribuable hors ligne.

**Options écartées.**
*Plages de numéros pré-allouées par appareil* — fonctionne, mais crée des trous dans la numérotation et une gestion de stock de numéros à administrer.
*Renumérotation à la synchronisation* — inacceptable : le numéro figure sur l'étiquette QR déjà collée et sur le rapport déjà signé.

**Choix.** `id` en UUID v7 généré sur l'appareil, portant toutes les relations et le `qr_token`. `numero` nul jusqu'à la première synchronisation, attribué alors par le serveur. Affichage `Local-<6 caractères>` avec pastille « non synchronisé » entre-temps.

**Conséquences.** Le QR encode le jeton, jamais le numéro — l'étiquette reste valide quoi qu'il arrive. Toute interface affichant un numéro doit gérer le cas nul. La contrainte d'unicité sur `numero` est partielle : `WHERE numero IS NOT NULL`.

---

## 2. Calendrier de référence : par usage, pas unique

**Contexte.** Quatre calendriers coexistent — société, agence, site client, technicien — et divergent par construction : Ducos ouvre le samedi, Koné non. Les SLA, la majoration et la détection de conflit ne peuvent pas s'appuyer sur le même.

**Options écartées.**
*Un calendrier global* — faux pour au moins un site, et fausse tous les indicateurs.
*Toujours le calendrier du site client* — absurde pour la majoration, qui rémunère le technicien, pas le client.

**Choix.** Une correspondance explicite usage par usage. SLA → agence de l'intervention. Majoration → agence du technicien. Conflit à la pose → calendrier de travail du technicien. Contrôle « site fermé » → horaires du site, en avertissement seulement. Indicateurs → agence, agrégé par société.

**Conséquences.** `lib/calendar` expose une fonction par usage, jamais une fonction générique paramétrée par un calendrier — le choix du calendrier ne doit pas être laissé à l'appelant. L'accusé de réception sous 30 minutes est en heures ouvrées : une demande déposée le dimanche à 22 h démarre son compteur le lundi matin, ce qui évite des alertes nocturnes sans objet.

---

## 3. Lecture multi-sociétés : un rôle PostgreSQL dédié

**Contexte.** La politique RLS filtre sur la société active et retourne zéro ligne sans contexte. La vue consolidée pour la direction, et plus tard la console éditeur, doivent lire plusieurs sociétés à la fois.

**Options écartées.**
*Bascule successive du contexte* — N requêtes au lieu d'une, et une fenêtre où le contexte est indéterminé.
*Contexte multi-valué* — complexifie la politique RLS elle-même, c'est-à-dire la barrière de sécurité la plus critique du produit.

**Choix.** Un rôle PostgreSQL `codiplan_reporting` disposant de `BYPASSRLS`, en `SELECT` seul, utilisé exclusivement par `lib/reporting`.

**Conséquences.** C'est une porte dérobée assumée, donc encadrée par trois garde-fous : aucun droit d'écriture, journalisation de toute requête avec l'utilisateur d'origine, et un test d'isolation vérifiant qu'aucun chemin applicatif hors `lib/reporting` n'utilise cette connexion. Les rôles éditeur du lot 7 réutiliseront le même mécanisme — d'où leur présence dans l'énumération des rôles dès le lot 0.
