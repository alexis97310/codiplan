# Le module de prêt — conception, avant tout code

_Ticket 70-PRET-A, 25 septembre 2026. Réf. PRET-01…04, feuille de route SAV du
23/09 §4. **Ce document ne modifie ni `prisma/`, ni `lib/`, ni `app/`, ni
`tests/` : aucun bloc `prisma` qu'il contient n'a été appliqué.**_

## 1. Contexte

`Machine` (`prisma/schema.prisma`) porte le matériel **d'un client, sur un
site** — `client_id` et `site_id` y sont deux des « quatre obligatoires de D6 »
(schema.prisma:1443). Un pont de prêt n'a ni l'un ni l'autre à sa naissance :
il appartient à CODIMA, vit à l'atelier ou chez un client selon la semaine, et
se réserve avant de se sortir. Le forcer dans `Machine` obligerait soit un
`client_id` nul sur une colonne qui ne l'est pas, soit un faux client CODIMA —
la ligne P1 ci-dessous l'exclut nommément.

Le cahier des charges ne l'ignore pas mais ne le règle pas : §1362 range « la
gestion des prêts et du parc de remplacement » dans les fonctions non
livrées en V1. Le chapitre 10 (rang 2) est muet, le chapitre 11 (rang 3)
aussi — ce document n'écrit donc aucune règle de gestion nouvelle ; il propose
un schéma que PRET-B soumettra, au moment de l'écrire en migration, aux mêmes
points d'arrêt que n'importe quel autre ticket (CLAUDE.md §8).

`prisma/migrations/20260914100000_plages_reglables_r3_13/migration.sql`
(lignes 16-21) a déjà tranché, sur un problème voisin — deux plages qui ne se
recouvrent pas —, qu'une contrainte `EXCLUDE USING gist` exigerait
`btree_gist`, et **qu'aucune migration de ce dépôt n'a jamais créé
d'extension**. La §4 ci-dessous reprend cet arbitrage et l'étend au cas du
prêt.

## 2. Les arbitrages d'Alexis (23/09) — recopiés, non redécidés

| # | Sujet | Décision |
|---|---|---|
| P1 | Modèle | **Registre séparé** (tables neuves), `Machine` intouchée ; jamais de faux client CODIMA |
| P2 | Lien SAV | Rattaché à une intervention, sauf motif saisi par un responsable |
| P3 | Droits | Réserver, prolonger, annuler : bureau (ADMS, DIR, RM, RS) + ADV. Remettre et reprendre : technicien affecté ou bureau |
| P4 | Marge entre deux prêts | Fixe : **2 jours ouvrés**, toutes familles (calendrier de l'agence) |
| P5 | Remise à disposition | Après un contrôle « apte » enregistré, jamais au simple retour |
| P6 | VGP du parc de prêt | 12 mois, **bloquante** : VGP dépassée = actif non prêtable |
| P7 | Commercial | Une case « prêt facturé » qui signale le prêt à l'ADV. **Aucun montant, aucune caution, aucune facture** |
| P8 | Livraison / reprise | Mission au planning rattachée au dossier, comptée une seule fois dans la charge |
| P9 | Inventaire | Fourni plus tard par Alexis ; exige avant PRET-B ; **aucun actif inventé** |

## 3. Schéma proposé

Quatre tables, toutes de la première catégorie de I1 (`societe_id NOT NULL`),
`(societe_id, id)` en clé, FK composées — la forme systématique du dépôt
depuis L1-01 (`docs/decisions/2026-09-01-premiere-table-metier-client.md`).

### 3.1 `pret_actif` — le pont, propriété de CODIMA

Pas de `client_id`, pas de `site_id` : c'est tout l'objet de P1. `agence_id`
dit où l'actif est rattaché (atelier de Ducos, de Koné, de Dolbeau) — c'est ce
champ, et non un site client, qui fixe le calendrier de la marge P4 (I7 : *le
calendrier de référence dépend de l'usage*).

`modele_id` référence `modele_materiel`, qui depuis l'amendement du 08/09/2026
à D4 (`docs/constitution/invariants.md:29`) est une **table métier cloisonnée
par société** et non plus un référentiel de plateforme — la FK est donc
composée sur `(societe_id, modele_id)`, comme toute autre référence à cette
table.

`date_derniere_vgp` est nullable, et c'est une décision : une ligne jamais
contrôlée **n'a pas de date qui vaudrait "conforme"**, elle vaut *absence de
preuve*. « VGP dépassée » (P6) se calcule à la lecture — `date_derniere_vgp
IS NULL OR date_derniere_vgp + 12 mois < aujourd'hui` — et ne se stocke
**jamais** sous forme de booléen. C'est le même raisonnement que
`vgp_campagne` (§11.2 du cahier des charges, D114) : *« un compteur stocké se
désynchronise en silence, et un compteur figé est pire qu'une alerte de trop,
parce qu'il a l'air de mesurer »*. Ici l'horloge tranche un fait métier
(prêtable ou non), jamais une ligne de cloisonnement — I1's D85 (« aucune des
treize formes n'évalue l'heure ») ne s'applique pas à cette colonne, et c'est
la distinction à garder : D85 vise le cloisonnement, pas la disponibilité
métier.

```prisma
model PretActif {
  id         String @id @db.Uuid
  societe_id String @db.Uuid
  agence_id  String @db.Uuid
  modele_id  String @db.Uuid

  numero_serie String
  /// Texte libre à l'ouverture (PRET-B) : câbles, télécommande, sangles.
  /// Une énumération fermerait une liste que l'atelier complète au fil de
  /// l'eau — comme `client.categorie` (L1-01).
  accessoires String?

  /// apte | a_controler | en_entretien | en_panne | retire — énumération
  /// close en base, vocabulaire d'exploitation à confirmer par Alexis avant
  /// PRET-B (comme `vgp_verification.origine`, D114).
  etat_technique String

  /// NULLABLE : voir le texte ci-dessus. « VGP dépassée » se calcule, ne se
  /// stocke pas.
  date_derniere_vgp DateTime? @db.Date

  cree_le    DateTime @default(now())
  modifie_le DateTime @updatedAt

  societe Societe @relation(fields: [societe_id], references: [id], onDelete: Restrict, onUpdate: Restrict)
  agence  Agence  @relation(fields: [societe_id, agence_id], references: [societe_id, id], onDelete: Restrict, onUpdate: Restrict)
  modele  ModeleMateriel @relation(fields: [societe_id, modele_id], references: [societe_id, id], onDelete: Restrict, onUpdate: Restrict)

  @@unique([societe_id, id])
  /// Un numéro de série CODIMA ne se partage pas entre deux ponts.
  @@unique([societe_id, numero_serie])
  @@map("pret_actif")
}
```

### 3.2 `pret_dossier` — une réservation, un client, une période

**Réserve un `pret_actif` précis dès sa création** — pas de table de jonction
intermédiaire : la question posée par P4 (deux prêts du même actif ne se
touchent pas à moins de 2 jours ouvrés) est exactement celle que
`calendrier_plage` posait sur `(calendrier_id, jour_semaine)` — ici c'est
`(pret_actif_id, période)`. Voir §4.

`intervention_id` ou `motif` — P2 exige l'un des deux. C'est une règle qui
porte sur **une seule ligne** (elle ne regarde ni une autre ligne ni une autre
table), donc une contrainte `CHECK` la porte, contrairement aux deux règles de
R3-13 qui exigeaient un déclencheur. Ce que le `CHECK` ne peut pas porter —
« saisi par un **responsable** » — est une vérification de rôle : elle vit à
la couche applicative (`lib/auth/porte.ts`), comme le périmètre du technicien
sur `cloturer_intervention` (D131) ; poser une politique de rôle en base
exigerait un `SECURITY DEFINER` que ce dépôt refuse (§9, D50).

`marge_jusqu_au` mérite une explication : ce n'est **pas** une seconde
information saisie, c'est `periode_prevue_fin` **plus** 2 jours ouvrés du
calendrier de l'agence de l'actif — calculée une fois, à la pose ou à la
prolongation, par `lib/calendar` (qui sait déjà lire `calendrier_plage` et
`calendrier_ferie`, R3-13, I7). Elle est **matérialisée** exactement pour la
raison que D85 donne pour une colonne de cloisonnement qui dépendrait de
l'heure — *« quand un fait dépend du temps, il est matérialisé : une colonne
porte l'état, un travail écrit la colonne »* — appliquée ici à un fait
métier : sans elle, le déclencheur de non-chevauchement (§4) devrait
recalculer un jour ouvré agence par agence, en PL/pgSQL, ce qui dupliquerait
la logique de `lib/calendar` — exactement ce que le §7 de `invariants.md`
interdit pour un autre calendrier (« l'ordre de lecture ne s'inverse
jamais », même principe : une seule maison pour un calcul de calendrier).

```prisma
model PretDossier {
  id         String @id @db.Uuid
  societe_id String @db.Uuid

  pret_actif_id String @db.Uuid
  client_id     String @db.Uuid
  site_id       String? @db.Uuid
  contact       String?

  /// L'un des deux est obligatoire (CHECK ci-dessous) ; P2.
  intervention_id   String? @db.Uuid
  motif             String?
  motif_saisi_par   String? @db.Uuid // utilisateur — rôle responsable vérifié en couche applicative

  machine_depannee_id String? @db.Uuid

  periode_prevue_debut DateTime
  periode_prevue_fin   DateTime
  /// periode_prevue_fin + 2 jours ouvrés du calendrier de l'agence de
  /// pret_actif — calculée par lib/calendar, jamais par un déclencheur. Voir
  /// le texte ci-dessus et §4.
  marge_jusqu_au       DateTime

  periode_reelle_debut DateTime?
  periode_reelle_fin   DateTime?

  /// reserve | remis | retour_recu | cloture | annule_avant_remise
  etape String

  /// P7 — signale le dossier à l'ADV. Aucun montant, aucune caution.
  pret_facture Boolean @default(false)

  cree_le    DateTime @default(now())
  modifie_le DateTime @updatedAt

  societe          Societe       @relation(fields: [societe_id], references: [id], onDelete: Restrict, onUpdate: Restrict)
  actif            PretActif     @relation(fields: [societe_id, pret_actif_id], references: [societe_id, id], onDelete: Restrict, onUpdate: Restrict)
  client           Client        @relation(fields: [societe_id, client_id], references: [societe_id, id], onDelete: Restrict, onUpdate: Restrict)
  site             Site?         @relation(fields: [societe_id, site_id], references: [societe_id, id], onDelete: Restrict, onUpdate: Restrict)
  intervention     Intervention? @relation(fields: [societe_id, intervention_id], references: [societe_id, id], onDelete: Restrict, onUpdate: Restrict)
  machine_depannee Machine?      @relation(fields: [societe_id, machine_depannee_id], references: [societe_id, id], onDelete: Restrict, onUpdate: Restrict)

  @@unique([societe_id, id])
  @@index([societe_id, pret_actif_id])
  // CHECK (intervention_id IS NOT NULL OR motif IS NOT NULL) — posé en migration, P2.
  @@map("pret_dossier")
}
```

### 3.3 `pret_mouvement` — sortie, livraison, reprise, réception

Fille de `pret_dossier` (forme « filiation », §5) : « qui, quand, d'où, vers
où ». Quatre types suffisent à P8 : la livraison et la reprise sont les deux
qui portent une mission au planning (I7/P8), sortie et réception restent
internes à l'atelier.

```prisma
model PretMouvement {
  id         String @id @db.Uuid
  societe_id String @db.Uuid

  pret_dossier_id String @db.Uuid

  /// sortie_atelier | livraison | reprise | reception_atelier
  type_mouvement String
  horodatage     DateTime
  auteur_id      String   @db.Uuid // utilisateur
  origine        String
  destination    String

  cree_le DateTime @default(now())

  societe Societe     @relation(fields: [societe_id], references: [id], onDelete: Restrict, onUpdate: Restrict)
  dossier PretDossier @relation(fields: [societe_id, pret_dossier_id], references: [societe_id, id], onDelete: Restrict, onUpdate: Restrict)

  @@unique([societe_id, id])
  @@index([societe_id, pret_dossier_id])
  @@map("pret_mouvement")
}
```

### 3.4 `pret_controle` — apte / non apte, à la remise à disposition

Fille de `pret_actif` et non de `pret_dossier` (§5) : un contrôle porte sur
**l'actif**, pas sur le dossier qui a précédé son retour — c'est lui qui gate
la disponibilité de l'actif pour le *prochain* dossier (P5).

```prisma
model PretControle {
  id         String @id @db.Uuid
  societe_id String @db.Uuid

  pret_actif_id String @db.Uuid

  /// apte | non_apte
  resultat      String
  auteur_id     String   @db.Uuid // utilisateur
  date_controle DateTime
  motif         String? // renseigné quand resultat = non_apte

  cree_le DateTime @default(now())

  societe Societe   @relation(fields: [societe_id], references: [id], onDelete: Restrict, onUpdate: Restrict)
  actif   PretActif @relation(fields: [societe_id, pret_actif_id], references: [societe_id, id], onDelete: Restrict, onUpdate: Restrict)

  @@unique([societe_id, id])
  @@index([societe_id, pret_actif_id])
  @@map("pret_controle")
}
```

## 4. Trois dimensions séparées

**État technique** — `pret_actif.etat_technique`, saisi (P6 : `en_panne`,
`en_entretien`, `retire` sortent l'actif du prêtable quel que soit le
planning).

**Étape du dossier** — `pret_dossier.etape`, saisie par les mouvements et les
contrôles : `reserve → remis → retour_recu → cloture`, ou
`reserve → annule_avant_remise`.

**Disponibilité, calculée, jamais saisie** — pour un actif et une date :
*ni `en_panne`, ni `en_entretien`, ni `retire`* **ET** *VGP non dépassée
(§3.1)* **ET** *aucun `pret_dossier` non annulé de cet actif dont
`[periode_prevue_debut, marge_jusqu_au]` couvre la date*. Le **retard** en
découle de la même façon : un dossier `remis` dont `periode_prevue_fin` est
dépassée sans mouvement de reprise est en retard — une colonne `en_retard`
serait le même compteur figé que `vgp_campagne` refusait (D114) ; ce dépôt
n'en pose pas.

## 5. Double réservation impossible par la base

**Le problème est identique, presque au mot près, à celui que R3-13 a déjà
tranché** : deux lignes qui se recouvrent sur `(clé de regroupement,
plage)` — là `(calendrier_id, jour_semaine)`, ici `(pret_actif_id,
[periode_prevue_debut, marge_jusqu_au])`.

| | (a) `EXCLUDE USING gist` + `btree_gist` | (b) Déclencheur, sur le modèle de `plages_reglables_r3_13` |
|---|---|---|
| Déclaratif | Oui — la contrainte se lit au schéma | Non — deux fonctions PL/pgSQL, comme `calendrier_plage_sans_chevauchement` |
| Exige `btree_gist` | **Oui** — première extension du dépôt | Non |
| Message d'erreur | Générique (« conflicting key value violates exclusion constraint ») — heurte D50 (un refus doit être lisible) sans réécriture manuelle du message | Écrit à la main, comme les deux exceptions de R3-13 |
| La marge P4 (jours **ouvrés**, calendrier d'agence) | Doit être **immutable** à l'index — un calcul de jours ouvrés dépend de `calendrier_ferie`, qui change ; PostgreSQL interdirait ou désynchroniserait silencieusement une expression d'index sur une fonction non immuable | Compare deux colonnes déjà matérialisées (`marge_jusqu_au`, §3.2) — aucune fonction de calendrier n'entre dans le déclencheur |
| Privilège requis | `CREATE EXTENSION` sur la base hébergée — dont ce dépôt ne tient pas les privilèges (`docs/decisions/2026-09-01-premiere-table-metier-client.md`, même réserve) | Aucun privilège au-delà de ce que toute migration exige déjà |

**Recommandation : (b), le déclencheur**, pour les mêmes raisons que R3-13,
et une raison propre au prêt en plus — la marge ouvrée. Poser `btree_gist`
pour la première fois dans un module qui n'est encore qu'une conception,
sur une base dont l'hébergeur ne nous a jamais confirmé qu'il l'autorise,
est un pari dont le gain (une syntaxe plus déclarative) ne compense pas le
risque (une migration qui échoue en production, sans recours immédiat). Ce
que (a) exigerait d'Alexis, précisément : confirmer auprès de l'hébergeur
que `CREATE EXTENSION btree_gist` est autorisé sur l'instance de production,
et accepter que ce module ouvre la voie — toute table future qui voudrait
une exclusion de plage en hériterait sans repasser par cet arbitrage.

Le déclencheur de (b), écrit en PRET-B, portera deux gardes distinctes,
exactement comme R3-13 : une sur `INSERT`/`UPDATE` de `pret_dossier`
(chevauchement avec un autre dossier non annulé du même actif) et aucune sur
`pret_actif` puisque la marge n'a pas d'équivalent au « pas » de
`calendrier_pas_tient_dans_les_plages` ici.

## 6. Cloisonnement

**`pret_actif` — forme « société ».** Aucun `client_id`, aucune raison d'être
plus stricte que `agence`, `calendrier` ou `taux_horaire` — les mêmes tables
de forme « société » qu'`invariants.md` (I1, ligne « société ») cite en
exemple.

**`pret_dossier` — forme « interne », pas « société ».** C'est le point où ce
document s'écarte d'une lecture rapide de la consigne d'ouverture (« forme
société ») et le signale explicitement, comme le fait tout document de ce
répertoire lorsqu'une doctrine déjà tranchée s'applique à un cas nouveau.
`pret_dossier` porte un `client_id`, exactement comme `document_recu`
(§11.2 du cahier des charges) — et `document_recu` est précisément la table
que D94 a rangée dans la treizième forme, « interne » : *société* **et**
`app.client_id` **ABSENT**, pour la raison suivante, écrite mot pour mot
dans `invariants.md:100` : *« une table qu'aucun compte portail ne lit,
quel que soit son client »*. P9 range aujourd'hui le portail client hors
périmètre (PRET-E, non planifié). Donner à `pret_dossier` la forme « société »
nue laisserait, le jour où PRET-E réutiliserait par erreur `app.client_id`
sans y penser, un compte portail lire les dossiers de prêt de **tous** les
clients de sa société — la fuite exacte que D94 a fermée sur `document_recu`.
La forme « interne » coûte : *tant que `pret_dossier` n'a pas sa propre
forme « parc » (PRET-E), même un compte interne dont le contexte porterait
par erreur un `client_id` ne verrait aucun dossier* — un coût jugé
acceptable puisqu'aucun rôle du §5.2 n'agit aujourd'hui avec un `client_id`
posé hors du portail.

**`pret_mouvement` et `pret_controle` — forme « filiation » (D103).** *Une
fille est visible si son parent l'est* : `pret_mouvement` s'adosse par
`EXISTS` à `pret_dossier`, `pret_controle` à `pret_actif`, sans réécrire
aucune clause de société ni de client — recopier `societe_id` serait une
seconde source du même fait (§9, 01/09 ; `invariants.md:144`). `WITH CHECK`
répète le `USING`, comme `intervention_machine` (D103) : on n'ajoute un
mouvement ou un contrôle qu'à un dossier ou un actif qu'on voit déjà.

**Portail client — hors périmètre (P9, PRET-E).** Aucune des quatre tables ne
lit `app.client_id` en écriture ; `pret_dossier` ne le lit pas non plus en
lecture, ce qui est le sens même de la forme « interne » ci-dessus.

## 7. Capacités neuves (PRET-B) — noms et rôles d'après P3

**Sans toucher `lib/auth/habilitations.ts` ici** — ce fichier est décidé par
arbitrage, jamais par un document de conception (`invariants.md`, ligne
23 : « toute addition passe par un arbitrage »). Ce que P3 fixe déjà :

| Capacité proposée | Rôles `complet` | Rôles `restreint` |
|---|---|---|
| `reserver_pret` | ADMS, DIR, RM, RS, ADV | — |
| `prolonger_pret` | ADMS, DIR, RM, RS, ADV | — |
| `annuler_pret` | ADMS, DIR, RM, RS, ADV | — |
| `remettre_reprendre_pret` | ADMS, DIR, RM, RS, ADV | TEC — scopé au technicien affecté au dossier, sur le modèle exact de `cloturer_intervention` (D131) |

**Un point que P3 ne tranche pas, et qui reste un point d'arrêt pour
PRET-B (CLAUDE.md §8) : qui enregistre un contrôle (`pret_controle`) et qui
gère le parc de prêt lui-même (créer/modifier `pret_actif`, une fois
l'inventaire de P9 fourni) ?** Aucune des deux capacités n'est nommée dans
le tableau P1–P9. Deviner — par exemple en recopiant `gerer_machine` — serait
inventer une règle de gestion absente du chapitre 10, ce que ce document
s'interdit.

## 8. Écrans

Aucun n'existe aujourd'hui ; tous viennent avec PRET-B/C selon le découpage
§9.

- **Liste « Parc de prêt »** — un `pret_actif` par ligne : modèle, n° de
  série, agence, état technique, VGP (avec l'alerte calculée de §4, jamais
  un statut stocké), disponibilité à la date choisie. Filtrable par agence,
  état, disponibilité.
- **Fiche actif** — l'historique de ses `pret_mouvement` et `pret_controle`,
  ses réservations passées et à venir.
- **Fiche dossier** — client, site, contact, rattachement (intervention ou
  motif), période prévue/réelle, étape, case « prêt facturé », et les
  actions ouvertes par la capacité de qui regarde (§7).
- **Bons de remise / retour** — imprimables, React-PDF, sur le modèle de
  69-BON-3 (« le bon imprimable dit quand, quoi, où et pourquoi ») : le bon
  de remise nomme l'actif, le dossier, la date et le motif ; le bon de
  retour ajoute l'état constaté et, s'il existe déjà, le résultat du
  contrôle.

## 9. Découpage

**PRET-B** — migrations des quatre tables (§3), le déclencheur de
non-chevauchement (§4), l'inventaire initial (attend P9, aucun actif
inventé), la réservation avec calcul de `marge_jusqu_au`, les capacités
`reserver_pret`/`prolonger_pret`/`annuler_pret`.

**PRET-C** — remise (mouvement + passage à `remis`), retour (mouvement +
passage à `retour_recu`), contrôle (`pret_controle`, remise à disposition
conditionnée à `apte` — P5), bons imprimables de remise et de retour, la
capacité `remettre_reprendre_pret`.

**PRET-D** — prolongation (recalcul de la plage et de `marge_jusqu_au`,
refusée si elle heurte le dossier suivant), retard (calculé, §4), les
missions de livraison/reprise au planning et leur comptage unique dans la
charge (P8).

**PRET-E** — portail client (D) : ouvre `pret_dossier` à `app.client_id`,
donc une nouvelle forme de politique ou l'extension de « parc » — non
planifiée, non tranchée ici.

## 10. Recette

- Deux réservations simultanées sur le même actif, périodes qui se
  chevauchent (avec ou sans la marge P4) → une seule réussit, l'autre est
  refusée par le déclencheur avec un message qui nomme ce qui bloque et rien
  de plus (D50).
- Une prolongation qui ferait chevaucher le dossier suivant → refusée ; le
  dossier suivant reste inchangé.
- Un retour non enregistré après `periode_prevue_fin` → le dossier reste
  `remis`, l'actif reste indisponible pour tout autre dossier ; le retard se
  lit au calcul (§4), aucune colonne ne le fige.
- Un retour constaté endommagé → `pret_controle` `non_apte` ; l'actif reste
  non prêtable et les réservations futures qui le visent sont signalées à
  l'écran (fiche actif), sans qu'aucune ne soit annulée automatiquement.
- Un dossier de la société A et un dossier de la société B, y compris en
  composant l'URL de l'un depuis une session ouverte sur l'autre → chacun
  invisible de l'autre société (forme « interne », §6). *Ceci teste le
  cloisonnement par société, pas un cloisonnement par client à l'intérieur
  d'une société* — tant que PRET-E n'existe pas, un rôle interne voit tous
  les dossiers de prêt de sa société, quel qu'en soit le client, et c'est le
  comportement voulu par P9.
- Une intervention liée à un dossier de prêt passe à `cloturee` alors que le
  dossier n'a reçu aucun mouvement de reprise → le dossier reste `remis`,
  l'actif reste indisponible ; la clôture de l'intervention ne ferme jamais
  un prêt à sa place (I5 : le travail terrain — ici la restitution physique
  — n'est jamais présumé par un statut de planification).
