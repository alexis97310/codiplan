# Gardien hors-ligne — répertoire sanctuarisé

Invariant **I4** : toute fonctionnalité de l'application technicien est utilisable
en mode avion. Le scénario bout en bout — intervention complète hors réseau puis
synchronisation intégrale sans perte — appartient aux tickets **L3-06 à L3-09**.

~~Ce répertoire est volontairement vide.~~ **IL A SON PREMIER HABITANT DEPUIS
L3-06** — `socle-pwa.spec.ts`, 11/09/2026. Il est exécuté par `pnpm test:e2e`,
donc par `pnpm verify:full`, porte de sortie de chaque lot.

## LA CONDITION DE RÉOUVERTURE, CORRIGÉE LE 13/09/2026

Elle disait : _« jusqu'à ce que le socle PWA, le cache local et la file de
synchronisation existent »_ — c'est-à-dire **après** l'implémentation.

**`docs/guide-pilotage.md` §5 dit l'inverse, et il a raison** : _« Exigez les
tests bout en bout `tests/e2e/offline/` **avant** l'implémentation, et validez
vous-même le scénario en mode avion sur un vrai téléphone. »_ Le point y est
nommé comme le plus difficile du projet, celui qui _« se teste mal, échoue
silencieusement et se corrige tard »_.

Les deux textes se contredisaient depuis L0-02, et **la contradiction ne se
serait vue que le jour où elle décide** — au premier ticket du lot 3, quand
quelqu'un ouvrirait ce README pour savoir quand écrire les scénarios. C'est la
faute du §9 (31/08) : _une prescription écrite à un endroit et non appliquée à
l'autre ne laisse aucune trace, et rien ne la verra si rien n'est posté pour la
voir._

**La condition est donc celle du guide, et pas une autre :**

> **Au premier ticket du lot 3 qui touche le hors-ligne — L3-06 —, les scénarios
> de ce répertoire s'écrivent AVANT le code qu'ils éprouvent.** Le répertoire
> cesse d'être vide à ce moment-là, et non quand la file de synchronisation
> existe.

_Le critère se vérifie et ne s'interprète pas : `app/(mobile)/`, `lib/sync/`, un
manifeste ou un service worker apparaissent au dépôt, ou ils n'y sont pas._

## ~~CE QUI EN EST MESURÉ AUJOURD'HUI, le 13/09/2026~~ — LA CONDITION A SONNÉ

~~Aucun des trois n'existe : pas de `app/(mobile)/`, pas de `lib/sync/`, pas de
manifeste, pas de service worker, aucune référence à IndexedDB dans `lib/` ni
`app/`. **La décision de garder ce répertoire vide tient donc encore** — mais sa
condition, elle, était fausse, et c'est elle qui vient d'être corrigée.~~

**Le 11/09/2026, L3-06 a posé un manifeste et un service worker. La condition
écrite ci-dessus a donc sonné, et elle a été suivie** : les trois scénarios de
`socle-pwa.spec.ts` ont été écrits **avant** le code, et ils ont d'abord rougi.
_La phrase barrée est conservée : elle a gouverné ce répertoire, et ce qui a été
décidé un jour se relit._

## CE QUI RESTE DÛ, ET QUAND

| Ticket                        | Le scénario qui s'écrit AVANT son code                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **L3-07** — cache local       | le parc du client visité est lisible réseau coupé                                                                              |
| **L3-08** — file d'opérations | _l'intervention complète en mode avion, puis la synchronisation intégrale sans perte_ — le scénario que le §5 du guide réclame |
| **L3-09** — conflits          | une intervention annulée pendant sa réalisation hors ligne conserve temps, diagnostic, photos et signature                     |

**La règle ne change pas d'un ticket à l'autre** : le scénario précède le code,
et il rougit avant de verdir. C'est ce que le guide appelle le point le plus
difficile du projet — _« il se teste mal, échoue silencieusement et se corrige
tard »_.

**Et ce qu'aucun scénario ne remplace reste écrit** : le guide demande à
l'exploitation de _« valider elle-même le scénario en mode avion sur un vrai
téléphone »_. Un navigateur piloté n'est pas un téléphone en vol.
