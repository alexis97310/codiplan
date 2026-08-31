# Ce qui atteint l'écran passe par le dictionnaire — et ce qui décide d'un fichier se déduit

*31 août 2026 — ticket L0-11, arbitrage D26, vocabulaire imposé de D5 et D47.*

## Contexte

D26 tranche que le français est en dur en V1 et pose la seule contrainte qui
coûte zéro aujourd'hui : **aucune chaîne visible n'est écrite dans un
composant**. Le dictionnaire `lib/i18n/fr.ts` existe depuis L0-01 ; ce ticket
lui donne ce qui lui manquait — la coupure écrite, le vocabulaire imposé, et un
gardien.

Trois questions se posaient, et une seule est difficile.

**Où passe la frontière ?** Un dépôt qui traduit tout traduit aussi ses messages
d'erreur techniques, et un diagnostic devient alors dépendant d'une langue
d'interface. Un dépôt qui ne traduit rien laisse les libellés se disperser.

**Qui est concerné ?** C'est la question difficile. Le réflexe est d'énumérer
les répertoires de rendu — `app/`, `components/` —, et le dépôt sait où cela
mène : trois listes closes ont été fausses parce qu'une décision ultérieure
créait une table et que personne ne revenait la ranger (§9 du CLAUDE.md, D41).
Une liste de répertoires vieillirait de la même façon, et **elle vieillirait
sans bruit** : le fichier oublié ne serait pas signalé, il serait simplement
hors périmètre.

**Et le vocabulaire ?** D5 a imposé « agence » pour l'établissement CODIMA et
« site » pour le lieu d'intervention chez un client. D47 a dû revenir corriger
deux règles du chapitre 10 qui disaient « site » en désignant des agences —
parce que D5 avait corrigé le glossaire et laissé les règles. Rien
n'empêchait ce même glissement de se produire dans le code.

## Options écartées

**Une règle ESLint seule.** C'était le critère d'acceptation inscrit au backlog.
Mesuré : `react/jsx-no-literals` voit le texte nu entre deux balises et le
littéral dans un conteneur, et rien d'autre — ni `title="Enregistrer"`, ni
`metadata.title`, ni `screen.getByText("CODIPLAN")`, ni la constante remontée en
tête de fichier. Elle est **conservée** parce qu'un signalement à la frappe
coûte moins cher qu'une vérification échouée dix minutes plus tard, mais elle
n'est pas la règle : elle en dit moins, jamais autre chose.

**Un gardien à expressions régulières.** Il aurait fallu décider si `"Bonjour"`
est un libellé, une classe CSS, une clé ou une URL — donc une heuristique, donc
la vacuité qui est le mode de défaillance dominant de cette méthode (§9). Le
gardien lit l'**arbre syntaxique** : un texte est visible parce qu'il est un
`JsxText`, pas parce qu'il ressemble à du français. La graphie disparaît du même
coup — c'est la forme 1 du §9 rendue sans objet plutôt que traitée.

**Une liste de répertoires concernés.** Écartée pour la raison dite plus haut :
elle serait fausse au premier ticket qui crée un écran ailleurs.

## Le choix

**La coupure est écrite une fois, en tête de `lib/i18n/fr.ts`**, et le gardien
n'en porte qu'un renvoi. Ce qu'un humain lit en se servant de l'application
passe par le dictionnaire — texte, libellé d'action, titre de page, attribut lu
par un lecteur d'écran, message d'erreur **rendu à l'écran**. Ce qu'un
développeur ou une machine lit n'y passe pas — message de gardien, exception
technique, trace, erreur de migration, libellé de test, nom de rôle ou de
statut. Le cas limite est tranché plutôt que laissé ouvert : une exception dont
le message finirait à l'écran ne se règle pas en la traduisant, mais en ne
transportant pas de texte dans une exception — la couche de rendu choisit sa
clé.

**Ce qui décide qu'un fichier est concerné se DÉDUIT.** Le gardien part de tout
le dépôt, et un fichier est concerné s'il porte l'une de trois marques, chacune
un fait du cadre technique et non une opinion sur le rôle du fichier :

| Marque | Le fait |
|---|---|
| rend du JSX | le compilateur n'accepte cette syntaxe que dans un `.tsx` |
| exporte des `metadata` | contrat de Next.js : titre et description du document |
| interroge l'écran | API de Testing Library ou de Playwright |

Une page écrite demain est concernée **le jour où elle est écrite**. Il n'y a
donc aucune liste d'exemptions : `lib/i18n/fr.ts` porte toutes les chaînes du
produit et n'est pas exempté — il ne rend rien. Le seul laissez-passer est une
référence au dictionnaire dans un emplacement visible, et il est lui aussi
déduit : des fonctions et objets **réellement exportés** par `lib/i18n`, résolus
à travers les alias d'import du fichier examiné. Ajouter un accesseur à
`lib/i18n/index.ts` l'autorise ; une fonction locale nommée `t` n'autorise rien.

**Le vocabulaire imposé vit dans le dictionnaire, et ne s'y écrit qu'une fois.**
« Agence » et « site » sont définis sous les clés `vocabulaire.*`, avec leur
pluriel et une définition qui **nomme ce que la notion n'est pas**. Le code ne
manipule plus le mot mais la notion — `mot("agence")` —, et un second gardien
refuse que l'un des deux mots soit écrit ailleurs dans le dictionnaire, y
compris dans une constante du fichier. La leçon de D47 était : *un arbitrage qui
corrige un mot doit dire où ce mot est écrit.* La réponse est désormais
mécanique : il est écrit là, et nulle part ailleurs.

## Ce que les gardiens voient, et ce qu'ils ne voient pas

Éprouvés sur les six formes du §9, chaque verdict étant un scénario et non une
opinion. Les trois formes que le ticket nomme — la chaîne dans un attribut, la
chaîne concaténée, le texte d'un test de rendu — sont prises, comme le sont le
gabarit, le tableau assemblé, l'argument d'appel, le ternaire,
`dangerouslySetInnerHTML`, et la constante déclarée en tête puis affichée plus
bas (**c'est l'état final qui compte, pas le verbe qui l'installe**). Les
greffes de la forme 5 sont faites dans les fichiers réels — `app/page.tsx`,
`app/layout.tsx`, le bandeau de société, les deux tests de rendu —, jamais dans
un fichier fabriqué.

**Les limites, annoncées comme celle du gardien de D50 :**

1. **Le texte qui vient d'ailleurs.** Le gardien lit là où le texte est écrit à
   l'écran, jamais d'où il vient : une chaîne exportée par un module et affichée
   par un composant lui est invisible. Le dépôt en portait un cas — `NOM_NEUTRE`
   dans `lib/theme/theme.ts`, affiché par le bandeau quand aucune société n'est
   active. Il est ramené au dictionnaire **à la main**, faute de pouvoir l'y
   contraindre, et le commentaire du code le dit.
2. **Le libellé passé en propriété d'un composant.** Le nom d'une propriété est
   libre : aucune liste statique ne distingue `libelle="Planning"` de
   `variant="outline"`. La parade n'est pas un gardien mais un **type** : un
   composant qui affiche du texte reçoit une `CleTraduction`, jamais une
   `string`, et le compilateur refuse alors le littéral. C'est la règle à tenir
   au lot 1, quand les premiers composants de saisie arriveront.
3. **Le rendu sans JSX** (`createElement`) et l'assemblage délibéré à
   l'exécution. Un gardien statique arrête la correction bien intentionnée, pas
   un contournement décidé.
4. **Laquelle des deux notions l'auteur voulait désigner.** Écrire `mot("site")`
   là où il fallait `mot("agence")` reste possible, et reste faux. C'est
   exactement la faute de D47, et aucune lecture statique ne la voit — seule une
   relecture humaine le peut. Ce qui est garanti est plus étroit : le mot juste
   existe à un seul endroit, il y est défini, et sa définition nomme ce qu'il
   n'est pas.

**Le témoin**, puisqu'un décompte nul ressemble toujours à un sans-faute : le
gardien échoue si le parcours lit moins d'une centaine de fichiers, et il échoue
si l'une des trois marques ne reconnaît **aucun fichier réel** du dépôt — une
marque qui ne voit rien est une règle vérifiée sur rien.

## Conséquences

Trois scénarios de rendu — cinq assertions — ont changé de côté : ils
comparaient l'écran à un littéral recopié, ils le comparent maintenant au
dictionnaire. Ce n'est pas un
affaiblissement — l'assertion porte sur le même texte —, mais un déplacement :
le contenu se vérifie là où le dictionnaire est le **sujet**
(`tests/unit/i18n/dictionnaire.test.ts`), et le rendu se vérifie contre la
source. Un scénario qui fige la chaîne de son côté ne prouve plus que l'écran la
tient du dictionnaire ; il prouve que deux endroits disent la même chose,
jusqu'au jour où l'un des deux change.

Le coût d'écriture d'un écran est inchangé : une clé de plus au dictionnaire,
un `t(...)` dans le composant.

**Au registre, hors périmètre :** un client acheteur voudra peut-être son propre
vocabulaire — « atelier » plutôt qu'« agence ». Rien ici ne l'empêche, et c'est
délibéré : le code nomme la **notion**, jamais le mot, si bien qu'un libellé
propre à une société viendrait se substituer à la valeur de la clé sans qu'une
ligne de composant bouge. Le mécanisme n'est **pas construit** — il suppose une
décision sur la portée (par société ? par territoire ?) et sur qui le paramètre.
