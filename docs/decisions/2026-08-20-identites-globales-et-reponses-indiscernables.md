# Identités globales, habilitations par société, et refus indiscernables

*Ticket L0-06b. Arbitrage D35, et D34 pour la trace interne. Invariants I1, I8.*

## Contexte

Une même personne travaille légitimement pour deux sociétés. Chez CODIMA, la
directrice d'exploitation suit CODIMA-NC et CODIMA-EU ; chez un client qui
achètera la solution, un dirigeant de groupe suivra ses filiales. Il fallait
trancher entre deux modèles : une identité par société — un compte, un mot de
passe et un second facteur par employeur — ou une identité unique au niveau
plateforme, dont les droits varient selon la société active.

L0-06 a construit le second sans jamais l'écrire : `utilisateur` ne porte pas de
`societe_id`, l'habilitation vit dans `utilisateur_societe`, et la session porte
la société active. D35 en fait une décision explicite plutôt qu'une propriété
émergente du schéma.

Ce choix a une conséquence désagréable, et c'est elle le vrai sujet de cette
note. Si l'identité est globale, alors la page de connexion est **commune à tous
les clients de la plateforme**. Elle répondait jusqu'ici trois choses
différentes : « ce compte n'existe pas », « ce compte existe, le mot de passe est
faux », « ce compte existe et n'est habilité nulle part ici ». Le troisième refus
est un renseignement commercial. Un client saisit l'adresse professionnelle d'un
salarié de son concurrent, lit la réponse, et apprend si ce concurrent est client
de CODIPLAN. Sans mot de passe, sans effraction, sans trace anormale — et, sur la
page de mot de passe oublié, sans même avoir à deviner quoi que ce soit d'autre
qu'une adresse.

Le durcissement complet de la visibilité entre sociétés est prévu au lot 7, avec
la console éditeur. Celui-ci ne pouvait pas y attendre : la fuite est ouverte dès
la première vente, c'est-à-dire dès qu'il y a deux clients.

## Options écartées

**Une identité par société.** Elle supprime la fuite à la racine : deux
employeurs, deux comptes, aucun recoupement possible. Elle coûte cher partout
ailleurs — deux mots de passe et deux seconds facteurs à gérer pour la même
personne, deux comptes à désactiver le jour de son départ, et un journal d'audit
qui ne sait plus dire que c'est la même personne. Elle contredit surtout le
sélecteur de société permanent du §4.4, qui suppose une session unique. Écartée.

**Rendre le message uniforme sans toucher au temps de réponse.** C'est la demi-mesure
courante, et elle ne tient pas : un compte inexistant échoue avant toute
vérification de mot de passe, un mot de passe faux après un hachage scrypt
volontairement coûteux, une habilitation absente après deux allers-retours de
base. Les trois se séparent nettement à la mesure, et la mesure est à la portée
de quiconque sait chronométrer une requête. Écartée : un message uniforme démenti
par le chronomètre donne l'illusion d'une protection, ce qui est pire que pas de
protection du tout.

**Uniformiser aussi le refus « second facteur absent ».** Écartée pour la raison
inverse. Ce refus n'est atteignable qu'une fois le mot de passe validé *et*
l'habilitation établie : il ne dit rien à un tiers. Le rendre opaque priverait
un utilisateur légitime de la seule information qui lui permette d'agir —
activer son second facteur — et transformerait un problème réparable en support
téléphonique.

**Détecter « aucune habilitation nulle part » dès la connexion.** Séduisant, mais
impossible sans ouvrir une brèche : les politiques RLS d'`utilisateur_societe`
ne laissent voir que les lignes de la société active, et il n'y a pas de société
active avant d'en avoir choisi une. Y répondre aurait demandé soit une fonction
`SECURITY DEFINER` lisant par-dessus le cloisonnement, soit une politique
supplémentaire — deux façons d'agrandir la surface pour un gain nul, puisque le
refus tombe de toute façon à l'activation. Écartée.

## Choix

**Un.** L'identité est **unique au niveau plateforme**, les **habilitations sont
par société**. `lib/auth/connexion.ts` n'établit que l'identité : la session en
sort sans `societe_id_active` et ne lit rien tant que `basculerSociete` n'a pas
relu une habilitation en base.

**Deux.** Un **seul motif de refus**, `fr["auth.refus"]`, rendu par tous les
chemins qu'un tiers peut provoquer : compte inexistant, mot de passe faux, entrée
malformée, compte désactivé, aucune habilitation sur la société visée. Il est
écrit une fois, dans le dictionnaire, et un test vérifie qu'il ne contient aucun
des mots qui distingueraient les cas.

**Trois.** Un **plancher de durée commun**, `PLANCHER_REPONSE_MS`, appliqué par
`avecPlancherDeDuree`. Le `finally` compte autant que le reste : sans lui, le
chemin qui lève le plus tôt — le compte inexistant — répondrait encore plus vite
que les autres, et l'uniformité du message ne servirait à rien. La valeur
retenue, 700 ms, est une constante technique et non un délai métier : elle est
choisie au-dessus du coût observé du chemin le plus lent, mesuré à moins de
100 ms sur la base de test. La relever est sans danger ; l'abaisser sous le coût
réel rouvre la fuite, et le scénario d'isolation le fait alors échouer.

**Quatre.** L'uniformité est tournée **vers l'extérieur**. À l'intérieur, le motif
réel est écrit au journal des accès, avec `societe_id_source` et
`societe_id_cible` (D34) : c'est ce qui permet de répondre à « qui a tenté
d'accéder à mes données » sans rien dire à celui qui a tenté.

**Cinq.** Le scénario `tests/isolation/reponses-indiscernables.test.ts` éprouve
les trois cas de D35 **contre la vraie base, sous le rôle applicatif réel**, et
il les éprouve ensemble : même message, et médianes de temps dans un rapport
inférieur à 2 — très en deçà de l'ordre de grandeur qu'exige l'arbitrage. Il
porte aussi un témoin positif : un compte habilité entre bien. Sans lui, un
système entièrement cassé passerait tous les tests négatifs.

## Conséquences

**Le chemin de réinitialisation de mot de passe est tenu d'avance.** Il n'est pas
livré — il suppose Resend, donc le lot 5 —, mais c'est là que la fuite serait la
plus large : elle ne demande même pas de mot de passe. `lib/auth/reponse-uniforme.ts`
est le point de passage unique, et il devra l'être aussi pour ce chemin-là : un
seul message, quel que soit le sort de l'adresse saisie, et le même plancher.

**Un refus ne se lit plus dans le code appelant.** `basculerSociete` rend
désormais le même motif pour « compte inconnu » et pour « aucune habilitation »,
et le scénario `bascule-societe.test.ts` a été corrigé en conséquence : il
n'assertait plus une règle mais la fuite elle-même. Le motif réel reste
accessible, au journal, à qui a le droit de le lire.

**Le sélecteur de société reste à construire.** Rien ne permet aujourd'hui de
lister les sociétés sur lesquelles un compte est habilité : les politiques RLS
l'interdisent hors contexte, et cette note a délibérément refusé d'y percer une
brèche. Le §4.4 en aura besoin ; la façon de la lui donner — fonction
`SECURITY DEFINER` limitée au compte appelant, ou politique lisant
`app.utilisateur_id` — touche au cloisonnement et relève donc d'un arbitrage,
pas d'une session de développement.

**Toute réponse d'authentification coûte désormais 700 ms.** C'est assumé : le
chemin est emprunté une fois par ouverture de session, jamais dans une boucle.
Sur une liaison à latence élevée — la Nouvelle-Calédonie — le plancher se
confond d'ailleurs largement avec le temps de transport.
