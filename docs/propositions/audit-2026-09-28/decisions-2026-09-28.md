# Decisions d'Alexis — audit de toutes les pages (28/09/2026)

| Question | Reponse d'Alexis (28/09/2026) | Lot |
|---|---|---|
| QT-1 acces des comptes | **Oui, APRES le lot de cloisonnement TP-S** : « Envoyer le lien d'acces » depuis Equipe (techniciens), puis comptes de bureau, puis mot de passe oublie | TP-ACC |
| QT-2 ce que lit et fait un technicien | **RG-DRO-02** : ses interventions et leurs fiches, le parc des clients qu'il visite sous 7 jours, sa propre absence ; ni le registre complet, ni les chiffres de la societe, ni les tarifs, ni les absences des autres ; il garde creer/modifier une machine | TP-S |
| QT-3 droits d'import | **Par type de donnees** : D130 pour clients et sites ; familles, modeles, prestations : droits de leur ecran | TP-S |
| QT-4 cycle de vie D8 | **A la lettre** : « Terminer » (En cours → Terminee) d'abord ; cloture seulement depuis « Terminee » ; transitions hors matrice refusees ; une cloturee ne s'annule plus | TP-CY |
| QT-5 signature du client | **Exigee au « Terminer »**, avec un motif d'absence trace et notifie au responsable ; D-S5 a ecrire dans `docs/arbitrages.md` | TP-CY, terrain |
| QT-6 mode de valorisation | **Choisi a la planification** (qualification), modifiable jusqu'a la cloture par ADV, responsables, direction, administrateur ; plus de preselection | TP-ARG |
| QT-7 montants d'une cloturee | **Figes a la cloture** ; fiche et bon lisent le montant fige ; forfait historise comme le taux (D109) | TP-ARG |
| QT-8 montants sur le bon | **Jamais sur le bon client** : une version client sans montant, une version interne | TP-ARG, bon |
| QT-9 reserves VGP | **Un etat par reserve** (a traiter, levee, ecartee avec motif), reprise de l'etat importe, affichee, transformee en intervention une par une par un geste humain (migration) | TP-VGP |
| QT-10 contenu du QR | **Une adresse web** (avec le jeton, session exigee), avant toute impression en serie ; revient sur la lettre du cahier des charges §11 | TP-PARC |
| QT-11 texte sous le QR | **Designation et numero de serie**, plus « Local-… » | TP-PARC |
| QT-12 gestes sur une machine | **Le bureau seul**, trace (ancien et nouveau site, date, motif) ; restreint le droit machine du technicien de la matrice §5.2 pour ces gestes | TP-PARC |
| QT-13 ordre du registre VGP | **Ordre du 25/09 garde** (depassees les plus anciennes en tete) + compte, pagination, tuile et filtre « Sans information » | TP-A2, TP-VGP |
| QT-16 client inactif | **Desactivation refusee** si des interventions restent ouvertes (une terminee non cloturee compte), en listant ces interventions ; D165 | TP-CLI |
| QT-26 ordre global | **D'accord avec le §9 de l'audit** (PG-G14 « Transmettre » avance avant PG-G11 a G13) | tout |

Serie 3 (QT-14 a QT-25) et decisions de fin du §7 : posees avant le lot concerne ; ajoutees ici par le
ticket qui les consomme.
