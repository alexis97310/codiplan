# Registre — la prise de vue du 13 septembre 2026

*Une entrée par unité de travail. La mesure d'abord, la prose ensuite.*

*Point de départ : `main` = `b8c3f76` (constaté par `git log`, pas de mémoire),
arbre propre. Branche de travail : `claude/adoring-turing-br30wm`. Périmètre
déclaré : `docs/captures/`, `scripts/captures.mts`, ce registre — une autre
session travaille en parallèle sur les lots 8 et 9 et sur le moteur d'import.*

*Horloge du conteneur : `date -u` → **2026-09-10 19:34:09 UTC** au démarrage,
**20:11 UTC** à la rédaction. Elle est en retard de trois jours sur le
calendrier de l'exploitation, comme les deux nuits précédentes l'avaient déjà
constaté. **Les documents suivent le calendrier de l'exploitation ; les mesures
portent l'heure lue.***

---

## CE QUI EST LIVRÉ

**48 captures, 12 écrans sur 13, dont SEPT qui n'avaient jamais été
photographiés.** Commit photographié : `b8c3f76`, prise du 2026-09-10 20:08 UTC,
base PostgreSQL 16 locale et jetable (I9).

| | Avant | Après |
|---|---|---|
| Écrans photographiés | 6 | **12** |
| Images | 24 | **48** |
| Refus | 4 (`enrolement`, structurels) | **4** (`portail`, et le motif a changé de nature) |

Les sept nouveaux : `premier-acces`, `connexion-code`, `intervention-detail`,
`parametres-agences`, `parametres-forfaits`, `enrolement` (jamais obtenu
jusqu'ici), et `portail` — **refusé, et c'est le §4 ci-dessous.**

---

## 1 — LE DÉFAUT QUE SEULE L'IMAGE MONTRE : UN BLOC ILLISIBLE SUR `/arrivee`

**Mesuré, pas jugé à l'œil.** Sur les quatre variantes de `arrivee`, dans le
bloc qui porte la charte de la société :

| Ce qui est écrit | Couleur | Sur le fond `(11, 92, 173)` | Seuil WCAG 2.1 AA (1.4.3) |
|---|---|---|---|
| les VALEURS — « CODIMA Nouvelle-Calédonie », « direction » | `(255,255,255)` | **6,67:1** | 4,5:1 ✔ |
| les LIBELLÉS — « Société active », « Rôle » | `(115,115,115)` | **1,41:1** | 4,5:1 ✘ |

*Identique en clair et en sombre, à 1280 px et à 390 px : le fond est la couleur
de la société, il ne suit pas le thème.*

**La cause tient en une ligne, et elle est banale** :
`app/(back-office)/arrivee/page.tsx:125`. Le composant `Ligne` pose
`text-muted-foreground` sur son libellé — un gris calibré pour le fond de la
PAGE. Réutilisé à l'intérieur de `bg-societe-primaire`, il se retrouve sur un
bleu foncé.

**Et le gris n'est pas en cause** : mesuré sur `parametres-agences`, le même
`text-muted-foreground` rend **4,74:1** sur le fond clair et **7,66:1** sur le
fond sombre. Il est juste partout où il a été pensé, et faux au seul endroit où
il a été emprunté. Les deux autres usages de `bg-societe-primaire` — le bandeau
et le bouton du planning — ne portent aucun texte atténué : **le défaut est à un
seul endroit.**

**Ce qu'aucun gardien n'aurait vu.** D51 garantit 4,5:1 sur les couleurs de
STATUT, par le choix noir/blanc ; ce bloc-ci n'en relève pas. Il n'existe aucune
assertion sur « le texte de ce bloc se lit », et il n'y en aurait pas eu :
*on n'écrit pas d'assertion sur un invariant qu'on n'a pas encore vu (§9,
09/09).* L'image, elle, met la couleur du texte à côté de son fond.

**NON CORRIGÉ — hors de mon périmètre**, `app/` appartenant à l'autre session
ce soir. La réparation est d'une ligne : donner au libellé une encre dérivée de
`--societe-primaire-encre` plutôt que le gris de la page.

---

## 2 — LE MUR D'ENTRÉE DU PORTAIL : D92 A OUVERT LA LECTURE, RIEN N'OUVRE LA PORTE

**Mesuré en voulant simplement photographier `/portail`.**

```
$ … amorcage-premier-compte.mts --reemettre --email portail@example.test …
Refus : L'identité portail@example.test n'est pas habilitée sur la société
« CODIMA Nouvelle-Calédonie » : la réémission ne sert qu'une identité ouverte
par le geste d'amorçage, sur SA société.
```

**Vérifié au code plutôt que sur le seul message** : `lib/auth/amorcage.ts:443`
compte les lignes de `utilisateur_societe` pour l'identité et refuse à zéro. Et
un compte portail en a **zéro par construction** — D10 veut les deux tables
exclusives. Les deux autres portes sont fermées de la même façon :
`ouvrirPremierCompte` exige une société **sans aucune** habilitation, et
l'inscription en libre-service n'existe pas (D58). *Le seul émetteur d'un lien
de premier accès est le geste d'amorçage.*

**Donc : aucun compte portail ne peut recevoir de mot de passe, donc aucun ne
peut se connecter, donc l'écran livré par L2-12 n'est atteignable par personne.**

**C'est le mur de D92 remonté d'un cran, et il se découvre de la même façon.**
D92 écrivait : *« aucun compte portail n'atteignait aucun écran, et rien ne le
disait — il n'existait pas d'écran de portail pour buter dessus »*. L'écran
existe depuis ; ce qui manquait cette fois n'était pas un lecteur mais **un
photographe**. La dixième forme de politique est juste, elle est éprouvée, et
elle garde une porte devant laquelle personne ne peut se présenter.

**JE M'ARRÊTE ICI, comme la consigne le demande** : ouvrir une voie d'accès aux
comptes portail touche à l'authentification et aux droits — c'est un arbitrage,
pas une décision de session, et `docs/arbitrages.md` appartient à l'autre
session ce soir. **Les quatre captures du portail sont refusées, et le refus
porte la mesure** plutôt qu'une généralité : quiconque relit
`docs/captures/README.md` lit la cause exacte, pas « il manque une identité ».

*Ce qu'il faudra trancher : par quel geste un compte portail reçoit son premier
mot de passe. Une réémission qui accepte un rattachement `utilisateur_client` à
la place d'une habilitation `utilisateur_societe` est la forme la plus étroite ;
elle n'est pas la seule, et elle n'est pas à moi.*

---

## 3 — UN README QUI AFFIRMAIT DES IMAGES QUE LA PURGE VENAIT DE SUPPRIMER

**Le défaut, dans le script, avant ce ticket** : la passe d'avant-enrôlement
poussait `enrolement--clair--1280` dans la liste des prises ; la purge, elle,
compare cette liste aux noms du disque — qui portent `.png`. **Une capture
réussie était donc supprimée comme obsolète, et listée quand même dans le
tableau « Les images ».**

**Il n'a jamais mordu, et c'est ce qui le rend intéressant** : les quatre images
de cette passe étaient refusées jusqu'au 11/09, et la prise complète du 11/09
n'a pas abouti. *Un défaut invisible parce que ce qu'il casse n'existe pas encore
(§9, 08/09)* — il attendait exactement le ticket qui allait faire réussir ces
images.

**Réparé à la source** (le nom porte son extension), **et gardé au-delà de sa
source** : la purge est devenue une **confrontation à double sens**. Ce qui est
sur le disque sans être dans la liste est supprimé ; ce qui est dans la liste
sans être sur le disque est **retiré du README et écrit dans les refus**. *La
population vient du disque, que le script ne contrôle pas (§9, 10/09) — et non
de sa propre mémoire, qui est précisément ce qu'on veut vérifier.*

**Preuve que la correction mordait** : à la prise de 19:45 UTC, les quatre
images d'`enrolement` ont survécu à la purge pour la première fois. Sous
l'ancien code, elles auraient été effacées et annoncées.

---

## 4 — L'EXPLICATION QUE J'AI RÉFUTÉE, ET CE QU'ELLE CACHAIT

Le registre du 12/09 conclut : *« ce que ce conteneur ne sait pas faire […] : la
prise de vue complète. Le moteur Prisma du serveur Next est réclamé par
l'ordonnanceur du bac à sable dès que la commande qui l'a lancé se termine. »*

**C'est faux, et la mesure a coûté cinq minutes.** Serveur lancé, sondé toutes
les cinq secondes : **`/sante` répond correctement pendant 198 secondes**, sans
une seule erreur, mémoire libre stable à 15,2 Go. Rien ne réclame le moteur.

**La vraie cause, isolée par variation d'une chose à la fois :**

| Ce que j'ai fait varier | Résultat |
|---|---|
| la même requête `utilisateurSociete.findMany` hors de Next, même base | **1 ligne** — le code et la base sont sains |
| `next start` (production) | 500, puis **48 × « Engine is not yet connected »** |
| `next dev` (développement), tout le reste identique | **le refus s'affiche en clair à l'écran** |

Le message que `next dev` a rendu : *« Le rôle « postgres » ne peut pas servir de
rôle applicatif […] il est propriétaire de la base ».* **J'avais mis le rôle
propriétaire dans `DATABASE_URL`**, ce que `.env.example` interdit en toutes
lettres et ce que `garantirRoleApplicatif` refuse — à bon droit.

**Ce qui rend le symptôme trompeur est une décision juste.** `lib/db/client.ts`
ferme le client après le refus, *« pour que le refus soit un vrai refus de se
connecter et non un simple avertissement »*. Le message exact est donc émis
**une fois**, puis **quarante-huit** lignes de moteur déconnecté le recouvrent —
et celles-là ne parlent que de Prisma. *Un message juste sur une cause fausse,
l'espèce qui envoie chercher ailleurs*, et qui a fait conclure, la nuit
précédente, à une contrainte de l'hébergeur.

**Écrit là où quelqu'un le relira** : la procédure du README distingue désormais
les deux rôles, avec la phrase qui manquait — *quand le serveur de production
devient incompréhensible, le relancer en développement coûte deux minutes et
nomme la cause.*

**Et une seconde cause se tenait derrière la première.** Un serveur d'une
commande antérieure **gardait le port 3100** : il répondait encore aux pages
statiques, tandis que le serveur que je croyais interroger avait échoué sur
`EADDRINUSE` — dans son journal, que je ne lisais pas. *J'ai photographié un
mort pendant deux prises.* La procédure le dit maintenant, et la sonde
d'attente a changé de nature : **elle frappe `/sante`, qui touche la base**, au
lieu de `/`, que sert un serveur sans base. *Une sonde qui ne touche pas ce dont
on a besoin valide un serveur qui ne peut pas servir.*

---

## 5 — L'OUTIL, OU L'ÉCRAN : LE `mm/dd/yyyy` DU DÉTAIL D'INTERVENTION

L'image de `intervention-detail` montre un champ de date en **`mm/dd/yyyy`** —
format américain, sur une application française, en Nouvelle-Calédonie. C'est
exactement ce qu'un lecteur relèverait, et **c'est l'outil, pas l'écran.**

**Mesuré** — sous `locale: "fr-FR"` dans le navigateur de prise de vue :

| Ce qui est lu | Valeur |
|---|---|
| `navigator.language` | `fr-FR` |
| `Intl.DateTimeFormat().resolvedOptions().locale` | `fr-FR` |
| `new Date(2026,8,14).toLocaleDateString()` | **`14/09/2026`** |
| le gabarit d'un `<input type="date">` | **`mm/dd/yyyy`** |
| le même, avec `--lang=fr-FR` au lancement | **`mm/dd/yyyy`** — inchangé |

Le gabarit d'un champ de date est rendu par l'INTERFACE du navigateur, pas par
la locale de la page, et ce Chromium n'embarque pas ses traductions. Sur un
navigateur réglé en français, ces champs affichent `jj/mm/aaaa`.

**Écrit dans le README, à côté des images**, parce qu'une image se relit comme
une preuve : sans cette ligne, elle prouverait un défaut qui n'existe pas. *La
distinction est celle du registre du 12/09 — l'outil, ou l'écran — et elle se
tranche par une mesure, jamais à l'œil.*

**Ce que je n'ai PAS tranché** : le planning affiche ses dates en `2026-09-02`,
forme ISO. Celle-là vient bien de l'application. Est-ce voulu — une forme non
ambiguë — ou un reste ? *C'est une règle de présentation, elle n'est pas à moi,
et je la signale plutôt que de la changer.*

---

## 6 — CE QUE LES IMAGES CONFIRMENT, ET QUI VALAIT D'ÊTRE REGARDÉ

- **L'incohérence du 09/09 est réparée** : plus aucun badge « À planifier » sur
  une ligne datée. La section « À planifier » ne porte que `Local-000001`, sans
  date ; les cinq datées sont sous « Période affichée ».
- **I7 se voit** : Koné du lundi au vendredi, Ducos et Dolbeau jusqu'au samedi,
  sur le même écran. Aucun calendrier global.
- **D56 se voit** : le taux d'occupation est affiché **avec sa formule** et ses
  deux termes — « 00:00 engagées / 496:00 ouvrables » —, jamais seul.
- **I10 se voit** : « Intervention Local-000001 », avec la phrase qui explique
  que le numéro vient du serveur à la première synchronisation.
- **Le catalogue de forfaits DIT qu'il est vide** au lieu d'afficher zéro ligne
  — la doctrine de D88 appliquée avant D88.
- **`connexion-code` porte le thème neutre CODIPLAN**, et non la charte d'une
  société : à ce moment-là aucune société n'est active, et l'écran ne prétend
  pas le contraire.

*Observation mineure, non traitée : le calendrier de l'agence Dolbeau est
« Nouméa — horaires de démonstration ». C'est le semis, pas l'écran.*

---

## 7 — CE QUE J'AI CHANGÉ, ET CE QUE JE N'AI PAS TOUCHÉ

**`scripts/captures.mts`** — sept écrans ajoutés ; le drapeau « avant
enrôlement » remplacé par **trois passes nommées** (avant-enrôlement, défi de
second facteur, portail), parce que trois écrans n'existent pas sous la session
ordinaire et pour trois raisons différentes ; un chemin qui se **découvre** sur
l'écran précédent plutôt que de s'écrire en dur ; la purge devenue
confrontation ; **le refus qui dit ce qu'il a vu** — l'URL atteinte et les
premiers mots rendus, ce qui a désigné la cause du §4 en une lecture ; le statut
des réponses d'authentification hors 200 retenu et rendu avec le refus, *parce
que le script n'est pas l'appelant que D35 protège : il est l'instrument de
mesure* ; et la **procédure de préparation**, que le script annonçait « dans le
README qu'il écrit » et que ce README ne portait pas.

**`docs/captures/`** — 48 images, README réécrit par la commande.

**NON TOUCHÉ, délibérément** : `prisma/`, les migrations, `docs/arbitrages.md`,
`docs/backlog.md`, et `app/` — le défaut du §1 y vit et attend une main qui ne
soit pas en train d'écrire ailleurs.

**Portes, mesurées sur l'état poussé** — et rapportées telles quelles :

| Porte | Résultat |
|---|---|
| `pnpm format:check` | vert |
| `pnpm typecheck` | vert |
| `pnpm lint` | vert |
| `pnpm test` | **103 fichiers verts, 1 rouge — 1118 tests passés, 0 échoué** |
| `pnpm test:isolation`, `pnpm build` (dans `verify`) | non joués sur cet état |

**Le fichier rouge est `tests/unit/excel/fixture-dates.test.ts`, et il ne vient
pas de ce ticket.** Sa cause, lue et non supposée : `Cannot find module
'read-excel-file/node'`. La dépendance est **déclarée** dans `package.json`
depuis D90 (`9b8cb29`) et **absente de `node_modules`** — l'installation de ce
conteneur est antérieure au commit qui l'ajoute. *Aucun test n'échoue sur une
assertion : le fichier ne se charge pas.* **Je ne l'installe pas** : cela
toucherait au verrou de dépendances, et le moteur d'import est le terrain de
l'autre session ce soir. Un `pnpm install` le referme.

*Je n'annonce donc pas « `verify` vert » : je ne l'ai pas joué en entier sur cet
état, et un vert mesuré à un instant et annoncé pour un autre est un vert
inventé (§9, 02/09).*
