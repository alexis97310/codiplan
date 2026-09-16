# La stack imposée, et ce qu'elle a cessé d'imposer

**Source de rang 1.** Ce texte était dans le `CLAUDE.md` ; il en a été détaché le
16/09/2026 par le ticket AT-05, **sans qu'une ligne change**. Son rang n'a pas bougé —
le noyau le dit, et le noyau nomme ce fichier dans son index : un fichier que le noyau
ne nommerait pas est un fichier que personne n'ouvrirait, et c'est gardé
(`tests/unit/docs/constitution-indexee.test.ts`).

La numérotation des sections ci-dessous est celle du `CLAUDE.md` d'avant la scission :
des gardiens la lisent, et la renuméroter aurait été une réécriture.

---

**Le §2 nommait SheetJS, et il a été écrit quand SheetJS était sur npm** *(amendement du 09/09/2026)*. Le paquet `xlsx` y est figé sur `0.18.5` — c'est ce que le registre annonce comme `latest` —, et **deux avis de sécurité HAUTS le visent sans correctif atteignable depuis npm** : `patched_versions: <0.0.0` pour les deux, l'éditeur ne publiant plus que sur sa propre distribution. Le premier, CVE-2023-30533, est une pollution de prototype **qui se déclenche à la lecture d'un fichier apporté** — l'usage exact et unique de ce module. *« Borner par l'usage » ne borne rien quand l'usage EST le vecteur.*

**TRANCHÉ LE 10/09/2026 — la bibliothèque est `read-excel-file`** *(D90)*. Ce qui manquait à la comparaison du 09/09 était **un vrai fichier d'Excel** : elle le disait elle-même — *« aucun fichier produit par Excel lui-même n'a été lu »*. L'exploitation a fourni le sien, une fixture en a été tirée **par retrait** (`tests/fixtures/dates-excel.xlsx`), et les quatre dates relevées en sortent **identiques sous trois fuseaux**, dont `Pacific/Noumea`. Le sérial était le proxy d'un critère — *« le jour ne bouge pas »* — qu'on sait maintenant mesurer directement : §9 du 01/09, *une borne posée faute de savoir mesurer se retire quand la mesure existe.* Le paragraphe qui suit reste écrit : il dit pourquoi SheetJS est écarté, et c'est cela qu'on relit.

**Ce n'était donc pas une contrainte qu'on contourne, c'était une contrainte devenue CADUQUE** — un vestige, comme la borne du déclencheur d'événement. *Une décision qui nomme un fournisseur sur une prémisse fausse ne lie plus.* Le §2 exige désormais **une bibliothèque de lecture `.xlsx` maintenue** ; il n'en nomme plus aucune, et le choix est un arbitrage que la comparaison du registre du 09/09/2026 instruit. Le nom est **barré et non effacé** : ce qui a été décidé un jour se relit, sinon on le redécide.

**Le §2 imposait Schedule-X, et la contrainte est RETIRÉE** *(D105, 12/09/2026)*. Le motif n'est pas le coût d'une réécriture — c'est que **LES REFUS NOMMÉS SONT LA RÈGLE MÉTIER, PAS CELLE DU COMPOSANT**. Quatre contrôles décident si une intervention peut se poser — calendrier de l'agence visée (RG-PLA-07), chevauchement, habilitation (RG-PLA-04), absence validée (RG-PLA-06) —, chacun avec **son motif écrit**. *On ne délègue pas à une bibliothèque ce qui fait la valeur du produit* : un composant calendrier propose son propre modèle de validité, et l'y plier c'est ou bien perdre les motifs, ou bien les recalculer à côté — **deux lectures d'un même critère** (§9, 01/09), dans l'écran où le planificateur travaille toute la journée.

Les vues **mois** et **année** ne sont demandées ni par la maquette ni par aucun ticket, et le jour où une vue mensuelle sera voulue ce sera pour les **ÉCHÉANCES** — prochaines VGP, fins de contrat — *pas pour le planning* : un agenda de créneaux et un calendrier d'échéances ne se lisent pas de la même façon. **Le nom est barré et non effacé**, comme SheetJS : ce qui a été décidé un jour se relit. L'exception « hors composant calendrier » de la colonne *Style* **reste** — elle n'interdit rien, elle ouvre une porte que personne n'est obligé de franchir. Réouverture : *le jour où une vue MOIS ou ANNÉE du PLANNING est écrite à la maquette ou demandée par un ticket.*