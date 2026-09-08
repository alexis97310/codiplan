# Le geste d'ouverture du premier compte — un cliquet en base

*9 septembre 2026. Arbitrage D65. Ticket L1-02h.*

## Contexte

`utilisateur_ouverture` (L1-02c) exige une société active **et**
`app_peut_administrer_identites()` — c'est-à-dire `admin_societe`, seul rôle de
la ligne « Administrer les utilisateurs » du §5.2 depuis D37. Pour la
**première** identité d'une société, il n'existe personne à être. Aucun compte
de la base hébergée ne portait de mot de passe, et rien ne pouvait en poser un :
**personne ne pouvait se connecter à CODIPLAN.**

La session de la nuit du 08/09 a mesuré l'impasse et **refusé de poser le
geste**, parce qu'un script d'amorçage devrait poser lui-même `app.societe_id`
et `app.role` — s'attribuant une autorité que personne ne lui a accordée. Le
refus était juste ; ce qui manquait était une sortie.

## Options écartées

**Le script pose `app.role = 'admin_societe'`.** C'est l'auto-habilitation. La
politique serait satisfaite et la garantie serait vide : n'importe quel script
pourrait faire de même, et rien dans la base ne distinguerait l'amorçage d'une
escalade de privilège. Écartée.

**Une fonction `SECURITY DEFINER` qui ouvrirait l'identité par-dessus les
politiques.** Interdite par D50, dont la liste d'exceptions est close et vide,
et qui a un gardien statique. Écartée sans discussion.

**Un `admin_plateforme` fabriqué au seed, avec un mot de passe connu.** Un mot de
passe dans le dépôt viole I9 ; un mot de passe hors dépôt mais posé par le seed
devient une clé permanente que personne ne fait tourner. Écartée.

**Ne rien faire et provisionner à la main en SQL.** C'est ce que l'absence de
décision produisait de fait. Écrire un `INSERT` d'identité à la main suppose de
connaître le format d'empreinte de mot de passe de la bibliothèque, ce qui est
exactement le genre de couplage qu'on paye deux ans plus tard. Écartée.

## Choix

**Ce n'est pas au script de prétendre à une autorité : c'est à la BASE
d'admettre un cas, et ce cas doit se détruire en s'exerçant.**

`utilisateur_ouverture` reçoit une seconde branche : une identité peut être
ouverte sans rôle qui administre **si et seulement si la société visée ne porte
aucune habilitation** — pas « aucun administrateur », aucune habilitation
quelle qu'elle soit. Le script ne pose aucun rôle : il passe `role: null`, et
c'est la moitié qui compte.

C'est un **cliquet**, la forme de D62 : la première habilitation créée rend la
branche inapplicable pour toujours. Et la branche n'ouvre qu'un `INSERT` sur
`utilisateur` — **ouvrir une identité n'accorde rien**, sans habilitation le
compte ne lit aucune donnée cloisonnée.

Le geste ne pose **aucun mot de passe qui transite** : il en tire un au hasard
pour satisfaire la bibliothèque, ne le rend à personne, et remet un **jeton de
premier accès** — une ligne de `verification`, à usage unique et datée. La trace
va à `journal_acces` sous `ouverture_identite`, jamais à `journal_audit` : une
identité n'appartient à aucune société, et le journal d'audit est cloisonné et
partitionné.

## Conséquences

**La condition de retrait est constatée par la machine.**
`tests/unit/auth/amorcage-retrait.test.ts` échoue dès qu'un appel à
`signUpEmail` apparaît hors du geste et hors des tests : le jour où le chemin
administratif existe, le gardien réclame le retrait de l'amorçage — script,
module, branche de politique et scénarios. Éprouvé dans les trois sens : la
faute réellement écrite dans `lib/auth/connexion.ts` le fait rougir en nommant
le fichier et la ligne ; la même mention en prose ne le fait pas rougir ; et le
geste retiré sans sa branche le fait rougir aussi — c'est le sens silencieux.

**Émettre un jeton et le consommer sont deux droits distincts.** L'instance de
production ne porte pas `sendResetPassword` et ne peut donc rien émettre
(`RESET_PASSWORD_DISABLED`, mesuré) ; `/reset-password` valide et consomme.
Personne ne peut faire émettre un jeton depuis un navigateur.

**Ce qui reste dû.** Aucune PAGE ne rend `/reset-password/<jeton>` : le premier
accès se termine aujourd'hui par un appel d'API. C'est écrit plutôt que
découvert le jour de la mise en ligne.
