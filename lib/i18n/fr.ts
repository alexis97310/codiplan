/**
 * Dictionnaire français — source unique des chaînes visibles par l'utilisateur.
 *
 * Décision D26 : le français est en dur en V1, mais aucune chaîne visible n'est
 * écrite dans un composant. Le dictionnaire est **plat** : une clé, une chaîne,
 * jamais d'imbrication. Ajouter une langue reviendra à ajouter un fichier.
 *
 * ## LA COUPURE — ce qui passe par ici, et ce qui n'y passe pas (L0-11)
 *
 * Elle se dit une fois, ici, plutôt que de se rejouer à chaque cas. C'est la
 * même famille de coupure que « documentation contre exécution » du gardien de
 * D50 : ce n'est pas le fichier qui décide, c'est la DESTINATION du texte.
 *
 * **Passe par le dictionnaire** — tout ce qu'un humain lit en se servant de
 * l'application : le texte d'un composant, le libellé d'une action, le titre
 * d'une page, le texte d'un attribut que restitue un lecteur d'écran, et le
 * message d'erreur RENDU À L'ÉCRAN. Le refus d'authentification de D35 en est
 * l'exemple : il est vu par un utilisateur, il est donc au dictionnaire.
 *
 * **N'y passe pas** — tout ce qu'un développeur ou une machine lit : le message
 * d'un gardien, celui d'une exception technique, une trace, une erreur de
 * migration, le libellé d'un test, le nom d'un rôle ou d'un statut. Ces
 * chaînes-là ne se traduisent pas : les traduire brouillerait la recherche dans
 * les journaux et ferait dépendre un diagnostic d'une langue d'interface.
 *
 * **Le cas limite, tranché : une exception dont le message finirait à l'écran.**
 * Elle ne se règle pas en traduisant le message de l'exception, mais en ne
 * transportant pas de texte dans une exception — la couche de rendu choisit sa
 * clé. Une chaîne technique qui devient visible est une chaîne qui a changé de
 * destination : c'est une clé de plus ici, jamais une traduction là-bas.
 *
 * Le gardien `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` tient le
 * premier bord de la coupure ; le second n'a besoin d'aucun gardien, puisqu'il
 * consiste à ne rien faire.
 *
 * ## LE VOCABULAIRE IMPOSÉ
 *
 * « Agence » et « site » sont définis ici, une fois, avec leur distinction —
 * voir `lib/i18n/vocabulaire.ts` pour la notion, et la note de décision du
 * 31/08/2026 pour le raisonnement. D47 a dû corriger le chapitre 10 parce que
 * le mot « site » y désignait des agences ; le dictionnaire rend cette confusion
 * plus difficile en n'offrant qu'un seul endroit où chacun des deux mots
 * s'écrit.
 */
export const fr = {
  "app.nom": "CODIPLAN",
  "app.description":
    "Gestion des plannings d'intervention et du parc machines.",
  "accueil.titre": "CODIPLAN",
  "accueil.accroche":
    "Plannings d'intervention et parc machines — Nouvelle-Calédonie.",
  "accueil.socle": "Socle technique en place. Aucune fonctionnalité métier.",
  "accueil.action": "Consulter la documentation",
  // Thématisation par société (L0-09). Le NOM de la société n'est jamais une
  // chaîne du dictionnaire : c'est une donnée, lue en base. Seuls les libellés
  // qui qualifient le thème vivent ici.
  "theme.societe": "Charte de la société",
  "theme.neutre": "Thème neutre CODIPLAN",
  // Message unique de tous les refus d'authentification (D35). Il ne dit ni si
  // le compte existe, ni si le mot de passe est faux, ni si le compte est
  // habilité quelque part : c'est exactement son objet.
  "auth.refus":
    "Accès refusé. Vérifiez vos identifiants ; si le problème persiste, contactez l'administrateur de votre société.",
  // ── Le premier écran (ticket L1-02f) ──────────────────────────────────────
  // Sobre assumé : ce qu'un humain lit pour entrer, et rien de plus. La charte
  // de la société vient du thème (L0-09) ; aucune couleur ne s'écrit ici.
  "connexion.titre": "Connexion",
  "connexion.accroche": "Identifiez-vous pour accéder à votre société.",
  "connexion.email": "Adresse électronique",
  "connexion.mot_de_passe": "Mot de passe",
  "connexion.valider": "Se connecter",
  "connexion.code": "Code à six chiffres",
  "connexion.code.accroche":
    "Saisissez le code affiché par votre application d'authentification.",
  "connexion.code.valider": "Valider le code",
  "connexion.apres_enrolement":
    "Votre second facteur est actif. Reconnectez-vous en présentant votre code : la session qui porte vos droits est celle qui a présenté le facteur.",

  // L'ENTRÉE — le lien qui manquait, et sans lequel un écran n'a pas d'appelant.
  "arrivee.entrer.portail": "Voir votre parc",
  "arrivee.entrer.planning": "Ouvrir le planning",

  // Registre des VGP — CODIPLAN n'affirme jamais la conformité (lot 9, D88).
  // Il enregistre ce qu'un organisme agréé a écrit, et ne calcule que des dates.
  "vgp.periodicite_requise":
    "Déclarer ce matériel soumis exige une périodicité : sans elle, personne ne sait quand la prochaine visite est due.",
  "vgp.reference_requise":
    "Indiquez le texte qui fonde cette périodicité. Sans lui, c'est un chiffre que personne ne pourra défendre.",
  "vgp.motif_requis":
    "Une exception ne se pose jamais sans sa raison : écrivez le motif, pour que quelqu'un puisse la rejuger.",
  "vgp.motif_orphelin":
    "Ce motif n'explique aucune exception. Posez l'exception, ou retirez le motif.",
  "vgp.a_determiner":
    "À déterminer — personne n'a encore examiné si ce matériel est soumis.",
  "vgp.hors_registre": "Hors registre",
  "vgp.sans_information": "Sans information",
  "vgp.information_recue": "Dernière information reçue",

  // Portail client — CONSULTATION SEULE (L2-12, D92).
  "portail.titre": "Votre parc",
  "portail.sous_titre":
    "Ce que CODIMA suit pour vous. Cette page est en consultation seule.",
  // LE VOCABULAIRE IMPOSÉ NE S'ÉCRIT PAS ICI (L0-11) : la notion se nomme par
  // `mot("site")`, et ces libellés portent tout SAUF le mot. Une clé
  // « Vos sites » aurait recopié dans le dictionnaire ce dont `vocabulaire.ts`
  // est la seule maison.
  "portail.vos": "Vos",
  "portail.machines": "Vos machines",
  // ── LES SIX ÉTATS D'UNE MACHINE (R2-21) ─────────────────────────────────
  //
  // *Un état de machine est lu par un PLANIFICATEUR, pas par une machine* : il
  // passe donc au dictionnaire, contrairement à un nom de rôle. Les trois
  // premiers libellés sont ceux de la maquette, qui fait foi ; les trois autres
  // n'y figurent pas et sont écrits au plus simple.
  "statut_machine.en_service": "En service",
  "statut_machine.en_panne": "En panne",
  "statut_machine.arretee": "Arrêtée",
  "statut_machine.remplacee": "Remplacée",
  "statut_machine.ferraillee": "Ferraillée",
  "statut_machine.fusionnee": "Fusionnée",
  "portail.machine.serie": "Numéro de série",
  "portail.machine.localisation": "Emplacement",
  "portail.machine.statut": "État",
  "portail.machine.mise_en_service": "Mise en service",
  "portail.sans_machine":
    "Aucune machine ne figure à votre parc pour le périmètre qui vous est ouvert.",
  "portail.sans_lieu":
    "Aucun lieu d'intervention ne vous est ouvert. Signalez-le à votre interlocuteur CODIMA.",
  "portail.perimetre":
    "Vous ne voyez que les lieux sur lesquels votre compte est habilité.",
  "portail.client": "Client",
  "portail.documents": "Documents",
  "portail.documents.a_venir":
    "Les documents de cette machine ne sont pas encore consultables ici.",
  "portail.vgp": "Contrôle réglementaire (VGP)",
  "portail.vgp.sans_information":
    "Sans information — CODIPLAN n'enregistre pas encore les contrôles de cette machine. Ce n'est ni « à jour », ni « en retard ».",
  "portail.reserve": "Cet écran est réservé aux comptes de portail client.",

  // Premier accès — l'écran où l'on CHOISIT son mot de passe (D65).
  // L'amorçage redirigeait ici depuis le 09/09 ; l'écran n'existait pas, et la
  // seule porte d'entrée d'une base neuve rendait 404.
  "premier_acces.titre": "Choisissez votre mot de passe",
  "premier_acces.accroche":
    "Ce lien ne sert qu'une fois. Le mot de passe que vous choisissez ici est le vôtre : personne d'autre ne le connaît, et il ne peut plus être réémis par ce chemin.",
  "premier_acces.mot_de_passe": "Nouveau mot de passe",
  "premier_acces.confirmation": "Confirmez le mot de passe",
  "premier_acces.valider": "Enregistrer et se connecter",
  "premier_acces.sans_jeton":
    "Ce lien de premier accès est incomplet. Demandez-en un nouveau à la personne qui vous l'a transmis.",
  "premier_acces.refuse":
    "Ce lien n'est plus valide, ou le mot de passe n'a pas été accepté. Demandez un nouveau lien à la personne qui vous l'a transmis.",
  "premier_acces.discordance":
    "Les deux mots de passe saisis ne sont pas identiques.",
  "premier_acces.trop_court":
    "Le mot de passe doit compter au moins huit caractères.",
  "premier_acces.abouti":
    "Votre mot de passe est enregistré. Connectez-vous avec.",

  // Enrôlement du second facteur — la seule transition en libre-service (D58).
  "enrolement.titre": "Activer votre second facteur",
  "enrolement.accroche":
    "Votre rôle exige un second facteur d'authentification. Cette étape est obligatoire et ne se fait qu'une fois.",
  "enrolement.definitif":
    "Un second facteur s'active ; il ne se retire pas. Seul un administrateur de la plateforme peut le révoquer, sur demande.",
  "enrolement.mot_de_passe": "Confirmez votre mot de passe pour révéler la clé",
  "enrolement.reveler": "Révéler la clé",
  "enrolement.cle": "Clé à saisir dans votre application d'authentification",
  "enrolement.cle.aide":
    "Ajoutez cette clé à votre application d'authentification, puis saisissez le code qu'elle affiche.",
  "enrolement.codes_secours": "Codes de secours",
  "enrolement.codes_secours.aide":
    "Notez-les maintenant : ils ne seront plus affichés. Chacun ne sert qu'une fois, si vous perdez votre application.",
  "enrolement.code": "Code affiché par votre application",
  "enrolement.confirmer": "Confirmer l'activation",
  "enrolement.code_invalide":
    "Ce code n'est pas valide. Vérifiez l'heure de votre appareil, puis réessayez avec le code affiché à l'instant.",

  // Page d'arrivée — qui vous êtes, pour quelle société, et rien d'autre.
  "arrivee.titre": "Vous êtes connecté",
  // R2-04 — l'accroche que la forme de back-office réclame. *Ce que l'écran
  // AFFICHE ne change pas d'un mot* : cette ligne ne dit rien de plus que le
  // titre, elle le situe.
  "arrivee.accroche":
    "Votre compte, la société sur laquelle vous travaillez, et par où entrer.",
  "arrivee.compte": "Compte",
  "arrivee.email": "Adresse électronique",
  "arrivee.societe": "Société active",
  "arrivee.role": "Rôle",
  // **CE TEXTE A ÉTÉ CORRIGÉ le 10/09/2026** : il annonçait que « le choix
  // d'une société parmi plusieurs arrivera avec le back-office », ce qui est
  // devenu faux le jour où le choix a été écrit. Il ne s'affiche désormais que
  // dans le seul cas qui reste : aucune habilitation du tout.
  "arrivee.sans_societe":
    "Aucune société active, et aucune habilitation sur ce compte. Contactez l'administrateur de votre société.",
  "arrivee.deconnexion": "Se déconnecter",
  // ── LE CHOIX D'UNE SOCIÉTÉ (D61, D67 — écran écrit le 10/09/2026) ────────
  //
  // Il manquait, et son absence était un MUR : un compte habilité sur deux
  // sociétés n'en activait aucune, donc n'atteignait aucun écran cloisonné.
  // Les deux politiques qui le rendent possible existaient depuis deux jours.
  "arrivee.choix.titre": "Choisir la société sur laquelle travailler",
  "arrivee.choix.aide":
    "Vous êtes habilité sur plusieurs sociétés. Une seule est active à la fois, et tout ce que vous verrez ensuite lui appartient.",
  "arrivee.choix.activer": "Travailler sur cette société",
  "arrivee.choix.active": "Société active",
  // Une société dont le nom n'est pas revenu est affichée QUAND MÊME, avec son
  // identifiant : taire la ligne ferait disparaître une habilitation réelle,
  // et le compte ne comprendrait pas pourquoi il ne peut pas y aller.
  "arrivee.choix.sans_nom": "Société sans nom lisible",

  // ── Référentiel client (ticket L1-01) ─────────────────────────────────────
  // Ce que le PRODUIT dit. Ce qu'une SOCIÉTÉ dit est une donnée, lue en base :
  // `societe.libelle_code_externe` remplace « client.code_externe » ci-dessous
  // quand elle l'a renseigné (D29, lib/clients/code-externe.ts). Même coupure
  // que la charte de L0-09 — le nom et les couleurs d'une société ne sont pas
  // des constantes de compilation.
  "client.titre": "Clients",
  "client.raison_sociale": "Raison sociale",
  // Libellé GÉNÉRIQUE, affiché à une société qui n'a pas nommé son ERP. « Code
  // Winpro » est le libellé de CODIMA, pas celui du produit (D29).
  "client.code_externe": "Code externe",
  "client.ridet": "RIDET",
  "client.categorie": "Catégorie",
  "client.adresse_facturation": "Adresse de facturation",
  "client.conditions_reglement": "Conditions de règlement",
  "client.commercial_referent": "Commercial référent",
  "client.actif": "Actif",
  "client.recherche": "Rechercher un client",
  "client.recherche.vide": "Aucun client ne correspond à cette recherche.",
  // Refus rendus à l'écran : ils sont vus par un utilisateur, ils sont donc au
  // dictionnaire. Le dépôt ne transporte qu'une CLÉ (`MotifRefusClient`) — une
  // exception ne porte jamais de texte destiné à un humain.
  "client.refus.code_externe_en_double":
    "Ce code externe est déjà porté par une autre fiche de votre société. Le code identifie un client à l'import : deux fiches ne peuvent pas le partager.",
  "client.refus.client_introuvable": "Cette fiche client est introuvable.",

  // ── Référentiel des sites d'intervention (ticket L1-02) ───────────────────
  //
  // **Aucune de ces entrées n'écrit le mot imposé, et ce n'est pas un choix de
  // style.** « Site » se définit UNE fois, sous « vocabulaire.site », et se
  // compose partout ailleurs depuis `mot("site")` — un gardien refuse qu'il
  // soit écrit ici (D5, D47, L0-11). Les libellés ci-dessous sont donc ceux des
  // CHAMPS, jamais celui de la notion : c'est la couche de rendu qui assemble
  // « Sites » ou « Rechercher un site » à partir du vocabulaire.
  "site.libelle": "Libellé",
  "site.client": "Client",
  // Le rattachement (D56) — l'établissement CODIMA dont le site dépend.
  //
  // **La valeur n'écrit pas le mot imposé, et c'est la règle de L0-11 qui
  // l'exige** : « agence » se définit une fois, sous `vocabulaire.agence`, et
  // se compose ailleurs depuis `mot("agence")`. Un libellé complet se rend donc
  // `${mot("agence")} — ${t("site.rattachement")}`, jamais en écrivant la
  // notion ici. Le gardien l'a refusé sur la première rédaction, à raison.
  "site.rattachement": "Rattachement",
  "site.adresse": "Adresse",
  "site.commune": "Commune",
  "site.zone_geo": "Zone géographique",
  "site.latitude": "Latitude",
  "site.longitude": "Longitude",
  // Décisives pour les sites miniers : badge, EPI, induction sécurité,
  // autorisation préalable (chapitre 2.9).
  "site.consignes_acces": "Consignes d'accès et de sécurité",
  "site.horaires": "Horaires d'accès",
  // Le temps saisi FAIT FOI ; l'estimation par zone n'est qu'un défaut (D23,
  // RG-PLA-05). Le libellé le dit, pour que personne ne croie à une estimation.
  // Et il dit D'OÙ L'ON PART (D56) : un nombre dont la signification dépend
  // d'une autre colonne ne voyage jamais seul, pas même à l'écran. Le mot
  // imposé n'y est pas écrit — voir « site.rattachement » ci-dessus.
  "site.temps_trajet_min": "Temps de trajet depuis le rattachement (minutes)",
  // D74 : c'est une donnée de PLANIFICATION. L'aide le dit à celui qui saisit,
  // pour que personne ne croie renseigner un temps facturable.
  "site.temps_trajet_min.aide":
    "Sert au calcul de charge et aux tournées, jamais à la facturation : le déplacement se facture par forfait de zone. Laisser vide pour utiliser l'estimation par zone géographique.",
  "site.actif": "Actif",
  "site.recherche.vide": "Aucun résultat ne correspond à cette recherche.",
  // Les six zones de D23. Leurs libellés sont des NOMS DE LIEUX de
  // Nouvelle-Calédonie : ils vivent au dictionnaire parce qu'un humain les lit,
  // et la valeur stockée reste le code technique (`grand_noumea`), qui ne se
  // traduit pas.
  "site.zone.grand_noumea": "Grand Nouméa",
  "site.zone.sud": "Sud",
  "site.zone.cote_est": "Côte Est",
  "site.zone.cote_ouest": "Côte Ouest",
  "site.zone.nord": "Nord",
  "site.zone.iles": "Îles",
  // Refus rendus à l'écran. Le dépôt ne transporte qu'une CLÉ
  // (`MotifRefusSite`) — une exception ne porte jamais de texte destiné à un
  // humain. « Hors de votre périmètre » ne distingue pas le client inexistant
  // du client d'une autre société : les séparer apprendrait qu'un identifiant
  // existe ailleurs, ce que D50 refuse.
  "site.refus.client_hors_perimetre":
    "Ce client n'existe pas dans votre périmètre.",
  "site.refus.fiche_introuvable": "Cette fiche est introuvable.",
  "site.refus.agence_hors_societe":
    "Ce rattachement n'existe pas dans votre société.",
  // Le refus de D56, rendu à l'écran. Il dit la marche à suivre, comme celui de
  // la base — et il ne nomme ni l'ancien rattachement ni le nouveau : un refus a
  // le droit d'être lisible, jamais d'être informatif (D50).
  "site.refus.trajet_a_revoir":
    "Le temps de trajet est mesuré depuis le rattachement. En changer sans revoir ce temps laisserait une valeur qui ne veut plus rien dire : saisissez le nouveau temps, ou videz le champ pour revenir à l'estimation par zone.",

  // ── Vocabulaire imposé (CLAUDE.md §3, arbitrages D5 et D47) ───────────────
  // Les SEULES entrées où les mots « agence » et « site » s'écrivent en toutes
  // lettres. Partout ailleurs dans ce fichier, ils se composent depuis ces
  // clés — un gardien le vérifie. Le préfixe « vocabulaire. » n'est pas une
  // convention d'écriture : c'est lui qui désigne ces entrées au gardien.
  "vocabulaire.agence": "Agence",
  "vocabulaire.agence.pluriel": "Agences",
  "vocabulaire.agence.definition":
    "Établissement CODIMA — Ducos, Koné, Dolbeau. L'intervention en part, et c'est le calendrier de l'agence qui fait foi. Ce n'est jamais un lieu appartenant à un client : celui-là est un site.",
  "vocabulaire.site": "Site",
  "vocabulaire.site.pluriel": "Sites",
  "vocabulaire.site.definition":
    "Lieu d'intervention chez un client. Ses horaires produisent un avertissement, jamais un blocage. Ce n'est jamais un établissement CODIMA : celui-là est une agence.",
  // ── Le TAUX D'OCCUPATION (D76) — le nom, et sa formule à côté du nom ──────
  // Tout le temps passé en intervention compte, même non facturé — garantie,
  // geste commercial, reprise, recensement. C'est une OCCUPATION, jamais un
  // rendement : le mot « productivité » ferait décider sur un chiffre qui ne
  // mesure pas ce qu'il laisse croire, et un gardien refuse qu'il entre ici.
  "vocabulaire.taux_occupation": "Taux d'occupation",
  "vocabulaire.taux_occupation.formule":
    "heures d'intervention ÷ heures travaillées",
  "vocabulaire.taux_occupation.definition":
    "Part du temps travaillé passée en intervention, sur la période. Tout le temps d'intervention compte, facturé ou non — garantie, geste commercial, reprise, recensement. Ce n'est pas un rendement : rien n'y dit ce qui a été facturé.",

  // ── LES ANOMALIES D'IMPORT (L1-08, D31) ───────────────────────────────
  //
  // `lib/excel/format.ts` ne rend que des CODES ; les libellés sont ici, parce
  // que le rapport de contrôle est lu par un humain (I6, RG-IMP-01). Chaque
  // libellé dit ce qui bloque ET la marche à suivre : un refus a le droit
  // d'être lisible, jamais d'être informatif sur ce que son destinataire n'a
  // pas le droit de lire (D50) — ici il ne parle que du fichier apporté.
  "import.anomalie.marqueur_absent":
    "Ce fichier n'est pas un modèle CODIPLAN : sa première cellule ne porte pas de marqueur de format. Téléchargez le modèle correspondant au type d'import et recommencez la saisie dedans.",
  "import.anomalie.marqueur_illisible":
    "Le marqueur de format de ce fichier est abîmé. La première cellule doit contenir le marqueur du modèle, inchangé — retéléchargez le modèle et recopiez-y vos lignes.",
  "import.anomalie.marqueur_autre_type":
    "Ce fichier est un modèle CODIPLAN, mais pas celui de cet import. Vérifiez le type d'import choisi, ou téléchargez le modèle correspondant.",
  "import.anomalie.marqueur_version_anterieure":
    "Ce fichier suit une version antérieure du modèle. Téléchargez la version en cours et recopiez-y vos lignes : les colonnes ont changé depuis.",
  "import.anomalie.marqueur_version_posterieure":
    "Ce fichier suit une version du modèle plus récente que celle que cette application sait lire. Il n'est pas lu plutôt que d'être lu de travers.",
  "import.anomalie.entete_en_double":
    "Deux colonnes portent le même en-tête. Renommez ou supprimez la colonne en trop : sans cela, l'une des deux serait ignorée sans qu'on sache laquelle.",
  "import.anomalie.colonne_obligatoire_absente":
    "Une colonne obligatoire manque au fichier. Vérifiez que la ligne d'en-têtes du modèle n'a pas été modifiée.",
  // LA PAIRE, DITE EN UNE PHRASE. Une colonne obligatoire manque, et un en-tête
  // du fichier lui ressemble : les signaler séparément laissait le lecteur
  // rapprocher lui-même deux lignes du rapport. L'appariement reste EXACT — la
  // ressemblance explique, elle ne choisit pas.
  "import.anomalie.colonne_obligatoire_absente_ressemblance":
    "Une colonne obligatoire manque, et une colonne du fichier lui ressemble sans être identique. Corrigez son en-tête pour qu'il soit exactement celui du modèle : l'orthographe, les accents et la casse comptent.",
  "import.anomalie.date_format":
    "Cette date n'est pas au format attendu. Le seul format accepté est JJ/MM/AAAA — par exemple 03/04/2026.",
  "import.anomalie.date_hors_plage": "Cette date n'existe pas au calendrier.",
  "import.anomalie.date_avec_heure":
    "Cette cellule porte une heure en plus de la date. Mettez la colonne au format date seule.",
  "import.anomalie.nombre_format":
    "Ce nombre n'est pas au format attendu. Utilisez la virgule comme séparateur décimal, sans séparateur de milliers.",
  "import.anomalie.nombre_separateur_milliers":
    "Ce nombre contient un séparateur de milliers. Écrivez-le sans espace : 1234,56 et non 1 234,56.",
  "import.anomalie.nombre_point_decimal":
    "Ce nombre utilise le point comme séparateur décimal. Utilisez la virgule : 1234,56 et non 1234.56.",
  "import.anomalie.cellule_vide": "Cette cellule est vide.",
  "import.avertissement.colonne_inconnue":
    "Cette colonne ne fait pas partie du modèle : elle est ignorée, et n'empêche pas l'import.",

  // ── Le planning et les interventions (lot 2, D84) ────────────────────────
  "planning.titre": "Planning des interventions",
  "planning.sous_titre":
    "Ce qui est posé, ce qui attend d'être posé, et ce qui a été fait.",
  "planning.file_attente": "À planifier",
  "planning.vide": "Aucune intervention sur cette période.",
  "planning.creer": "Créer une intervention",
  "planning.retour": "Retour au planning",
  // La flèche fait partie du LIBELLÉ lu à voix haute : elle est ici, comme
  // tout ce qu'un humain lit (L0-11), et non écrite en dur dans le composant.
  "planning.retour_fleche": "← Retour au planning",
  "planning.periode": "Période affichée",

  // ── LES STATISTIQUES PAR TECHNICIEN (10/09/2026) ─────────────────────────
  //
  // **JAMAIS LE POURCENTAGE SEUL**, et c'est une demande d'exploitation avant
  // d'être une préférence d'affichage : « 82 % » ne veut rien dire sans ses
  // deux termes — 82 % de quoi, sur quelle période, calculé comment ? La
  // formule est donc une clé à part, affichée à côté du taux, et un gardien
  // refuse que l'écran montre l'un sans l'autre.
  "statistiques.titre": "Charge par technicien",
  "statistiques.sous_titre":
    "Sur la période affichée, et par établissement : c'est le calendrier de l'établissement qui donne les heures ouvrables.",
  "statistiques.technicien": "Technicien",
  "statistiques.non_affectees": "Interventions non affectées",
  // Le SINGULIER est une clé à part : « 1 interventions » est une faute que
  // personne ne relit deux fois, et qu'aucune assertion n'attrape — c'est
  // l'image du planning qui l'a montrée.
  "statistiques.nombre": "interventions",
  "statistiques.nombre_un": "intervention",
  "statistiques.heures_engagees": "engagées",
  "statistiques.heures_ouvrables": "ouvrables",
  "statistiques.taux": "Taux d'occupation",
  // « 0 % » se lit « n'a rien fait ». Quand du temps a été engagé et que le
  // taux s'arrondit à zéro, l'écran cesse d'affirmer un faux et dit sa borne.
  "statistiques.taux_infime": "moins de 1\u00a0%",
  // La FORMULE, écrite en toutes lettres. Elle est ce qui rend le pourcentage
  // interprétable, et elle ne se déduit pas de « 82 % ».
  // Le SIGNE POUR CENT est du texte qu'un humain lit : il vient d'ici comme le
  // reste (L0-11), avec l'espace insécable que le français exige devant lui.
  "statistiques.pourcent": "\u00a0%",
  // LE SÉPARATEUR N'APPARTIENT À AUCUN ÉCRAN — il s'appelait
  // `statistiques.separateur`, et la fiche d'intervention en a eu besoin le
  // jour où elle a affiché « CACES — bloquante » (L3-02). *Une clé nommée
  // d'après son premier appelant devient fausse au second*, et la pente
  // suivante est d'en écrire une deuxième qui dit la même chose.
  "ponctuation.separateur": " — ",
  "statistiques.formule":
    "heures engagées ÷ heures ouvrables du calendrier de l'établissement",
  "statistiques.sans_calendrier":
    "Pas de taux : cet établissement n'a pas de calendrier, et les heures ouvrables sont donc inconnues. Ce n'est pas zéro pour cent.",
  "statistiques.sans_duree":
    "sans durée saisie — elles comptent dans le nombre, et pour zéro minute dans le taux",
  "statistiques.sans_duree_un":
    "sans durée saisie — elle compte dans le nombre, et pour zéro minute dans le taux",

  "intervention.titre": "Intervention",
  "intervention.reference": "Référence",
  "intervention.client": "Client",
  "intervention.machine": "Machine",
  // ── Les notions IMPOSÉES ne s'écrivent pas ici ───────────────────────────
  //
  // « agence » et « site » se définissent une seule fois, dans les entrées
  // `vocabulaire.*` (D5, D47, L0-11). Le code nomme la NOTION — `mot("site")`,
  // `mot("agence")` — et jamais le mot ; les clés ci-dessous portent donc ce
  // qui les entoure, et le composant compose.
  "intervention.deduit_du_lieu":
    "Déduit du lieu d'intervention — cela ne se saisit pas.",
  "intervention.refus.lieu_inconnu":
    "Ce lieu n'existe pas pour ce client, ou il n'est pas dans votre périmètre.",
  "intervention.refus.lieu_sans_rattachement":
    "Ce lieu n'est rattaché à aucun établissement. Le rattachement de l'intervention en est déduit : renseignez-le d'abord.",
  // RG-PLA-06 (L3-04). **Le motif ne nomme ni la personne ni la période**, et
  // ce n'est pas de la pudeur : un refus est un canal d'information soumis au
  // cloisonnement comme une requête (D50). Qui planifie voit l'absence sur
  // l'écran des absences, où la politique décide ; le refus dit ce qui bloque
  // et la marche à suivre, il ne renseigne pas.
  "absence.refus.inconnue":
    "Cette absence n'existe pas, ou elle n'est pas dans votre périmètre.",
  "absence.refus.deja_tranchee":
    "Cette absence a déjà été validée ou refusée. Une décision ne se reprend pas : les interventions déplanifiées ne retrouveraient pas leur créneau.",
  "intervention.refus.absence":
    "Ce technicien est indisponible à cette date. Le créneau est refusé.",
  "intervention.refus.habilitation":
    "Ce technicien ne détient pas les habilitations exigées ici. L'affectation est refusée.",
  // RG-PLA-04, sa moitié BLOQUANTE et sa moitié qui AVERTIT (L3-02, D9, D73).
  //
  // *Le code de l'habilitation n'est pas dans ces phrases, et c'est voulu* : il
  // est une donnée de société, il se LIT en base à côté du technicien affiché,
  // et il ne traverse jamais une URL — un texte recopié depuis un paramètre est
  // un canal d'écriture ouvert à qui forge un lien (L1-02f, D50). Ces libellés
  // sont les invariants de la phrase ; la donnée s'y accole à l'écran.
  "intervention.habilitations.exigees": "Habilitations exigées par ce lieu",
  "intervention.habilitations.bloquante": "bloquante",
  "intervention.habilitations.absente": "absente",
  "intervention.habilitations.expiree_le": "expirée le",
  "intervention.habilitations.satisfaites":
    "Ce technicien détient toutes les habilitations exigées ici.",
  "intervention.avertissement.habilitation":
    "Ce technicien ne détient pas toutes les exigences NON bloquantes de ce lieu. L'affectation est acceptée ; le détail est sur la fiche.",
  "intervention.type": "Nature",
  "intervention.priorite": "Priorité",
  "intervention.statut": "Statut",
  "intervention.date": "Date planifiée",
  "intervention.creneau": "Créneau",
  "intervention.technicien": "Technicien",
  "intervention.aucun_technicien": "Aucun technicien affecté",
  "intervention.duree_estimee": "Durée estimée",
  "intervention.mode_valorisation": "Mode de valorisation",
  "intervention.forfait_deplacement": "Forfait de déplacement",
  "intervention.sans_numero":
    "Le numéro est attribué par le serveur à la première synchronisation.",

  "intervention.action.affecter": "Affecter un technicien",
  "intervention.action.deplacer": "Déplacer",
  "intervention.action.cloturer": "Clôturer",
  "intervention.action.annuler": "Annuler l'intervention",
  "intervention.action.creer": "Créer",

  "intervention.cloture.temps_reel": "Temps réellement passé (minutes)",
  "intervention.cloture.arrondi": "Arrondi au quart d'heure supérieur",
  "intervention.cloture.plancher": "Plancher d'une heure appliqué",
  "intervention.cloture.facture": "Temps facturé",
  "intervention.cloture.taux": "Taux horaire en vigueur à cette date",
  "intervention.cloture.main_doeuvre": "Main-d'œuvre",
  "intervention.cloture.forfait_deplacement": "Forfait de déplacement",
  "intervention.cloture.total": "Total hors taxes",
  // UN TOTAL QU'ON NE SAIT PAS CALCULER SE DIT (L2-09a). *Zéro se lit
  // « gratuit »*, et une absence d'information ne s'affiche jamais comme une
  // réponse négative — c'est vrai d'un montant plus que de tout le reste.
  "intervention.cloture.total_inconnu": "Sans information",
  "intervention.cloture.total_motif": "Ce qui manque",
  "intervention.total.forfait_de_prestation_absent":
    "Le forfait de prestation de cette intervention n'est pas encore choisi : le catalogue ne le propose pas. Le total ne peut pas être calculé tant qu'il manque.",
  "intervention.total.main_doeuvre_absente":
    "Le temps réellement passé n'est pas saisi : la main-d'œuvre ne peut pas être calculée.",
  "intervention.total.devises_incompatibles":
    "Le forfait et la main-d'œuvre ne sont pas dans la même monnaie. Aucun total n'est calculé : une conversion ici fausserait le montant.",
  "intervention.cloture.explication":
    "Le temps est arrondi au quart d'heure supérieur, puis relevé à une heure minimum. Les deux s'appliquent une seule fois, sur l'intervention entière.",

  "intervention.annulation.motif": "Motif de l'annulation",
  "intervention.annulation.obligatoire":
    "Le motif est obligatoire. Une annulation n'efface rien : elle se justifie.",

  // ── LES REFUS À LA POSE (R2-19) — chacun NOMME son motif ────────────────
  //
  // *Un bloc qui revient à sa place sans explication apprend à ne plus faire
  // confiance à l'écran* (exploitation, 11/09/2026). Ces quatre messages disent
  // ce qui bloque et la marche à suivre ; aucun ne COMPTE ni ne NOMME ce que son
  // destinataire n'a pas le droit de lire (D50).
  "intervention.deplacement.heure":
    "Heure de début (laisser vide pour une journée sans heure)",
  "intervention.deplacement.duree": "Durée en minutes",
  "intervention.deplacement.explication":
    "Même effet que le glisser-déposer du planning, et mêmes refus. L'heure se donne dans l'heure locale du lieu d'intervention.",
  "intervention.refus.jour_ferme":
    "Le calendrier qui décide pour cette intervention n'ouvre pas ce jour-là. La ligne du planning montre l'union des calendriers du technicien : c'est un repère, pas un droit de poser.",
  "intervention.refus.hors_ouverture":
    "Cette heure est en dehors des horaires d'ouverture du calendrier qui décide pour cette intervention.",
  "intervention.refus.duree_invalide":
    "Une intervention dure au moins un créneau. Tirez la poignée sous le début du bloc, jamais au-dessus.",
  "intervention.refus.chevauchement":
    "Ce technicien a déjà une intervention sur ce créneau. Deux interventions au même moment ne se posent pas.",
  "intervention.refus.agence_sans_calendrier":
    "Aucun calendrier ne décide pour cette intervention : aucune pose n'est possible tant que les horaires ne sont pas réglés.",
  "intervention.refus.inconnue":
    "Cette intervention n'existe pas, ou elle n'est pas dans votre périmètre.",
  "intervention.refus.annulee_figee":
    "Cette intervention est annulée : elle ne se modifie plus. Une annulation n'efface rien et ne se défait pas.",
  "intervention.refus.cloturee_figee":
    "Cette intervention est clôturée : elle ne se modifie plus sans trace. Seule son annulation reste possible.",
  "intervention.refus.deja_cloturee": "Cette intervention est déjà clôturée.",
  "intervention.refus.deja_annulee": "Cette intervention est déjà annulée.",
  "intervention.refus.temps_manquant":
    "Saisissez le temps réellement passé avant de clôturer. C'est lui qui détermine ce qui est facturé.",
  // ── LA SUSPENSION ET LA FILE « EN ATTENTE DE PIÈCE » (L2-10, RG-INT-06) ──
  "intervention.suspension.titre": "Suspendre l'intervention",
  "intervention.suspension.motif": "Motif de la suspension",
  "intervention.suspension.motif_aide":
    "Obligatoire. Une intervention arrêtée sans qu'on sache pourquoi est une intervention perdue : celui qui la retrouvera dans trois semaines n'aura personne à qui demander.",
  "intervention.suspension.piece": "Référence de la pièce attendue",
  "intervention.suspension.date_dispo": "Disponibilité prévue",
  "intervention.suspension.piece_aide":
    "Pour une attente de pièce seulement, et les deux vont ensemble : une référence sans date de disponibilité fait une file d'attente qu'on ne sait pas trier.",
  "intervention.suspension.depuis": "Suspendue depuis",
  "intervention.suspension.horizon_depasse":
    "La date de disponibilité annoncée est passée.",
  "intervention.action.suspendre": "Suspendre",
  "intervention.action.reprendre": "Reprendre",
  "intervention.refus.deja_suspendue":
    "Cette intervention est déjà suspendue. Sa date de suspension ne se réécrit pas : c'est elle qui mesure depuis combien de temps elle attend.",
  "intervention.refus.pas_suspendue":
    "Cette intervention n'est pas suspendue : il n'y a rien à reprendre.",
  "intervention.refus.motif_manquant":
    "Le motif est obligatoire. Une suspension sans motif laisse une intervention arrêtée sans que personne sache pourquoi.",
  "intervention.refus.taux_absent":
    "Aucun taux horaire n'est en vigueur à cette date. Renseignez le tarif avant de clôturer : facturer à zéro serait pire que refuser.",

  // ── LA DEMANDE D'INTERVENTION (L2-06) ───────────────────────────────────
  //
  // Le point d'entrée du flux. Les refus nomment ce qui bloque et la marche à
  // suivre ; aucun ne COMPTE ni ne NOMME ce que son destinataire n'a pas le
  // droit de lire (D50) — « introuvable » couvre la demande qui n'existe pas et
  // celle qui est hors périmètre, et les distinguer ferait un oracle.
  "demande.titre": "Demandes",
  "demande.source": "Origine",
  "demande.urgence": "Urgence",
  "demande.description": "Symptôme décrit",
  "demande.machine_arretee": "Machine à l'arrêt",
  "demande.date_souhaitee": "Date souhaitée",
  "demande.contact": "Interlocuteur",
  "demande.sans_numero":
    "Le numéro est attribué par le serveur à la première synchronisation.",

  "demande.accuse.titre": "Accusé de réception",
  "demande.accuse.repondu_dans_le_standard": "Répondu dans les temps",
  "demande.accuse.repondu_hors_standard": "Répondu au-delà du standard",
  "demande.accuse.sans_reponse": "Sans réponse pour l'instant",
  "demande.accuse.sans_reponse_depasse": "Sans réponse, standard dépassé",
  "demande.accuse.explication":
    "Le délai se compte en heures ouvrées de l'établissement dont dépend le lieu d'intervention : une demande déposée le dimanche soir démarre son compteur à l'ouverture du lundi.",

  "demande.action.accuser": "Accuser réception",
  "demande.action.qualifier": "Qualifier",
  "demande.action.transformer": "Transformer en intervention",
  "demande.action.clore": "Clore sans suite",

  "demande.cloture.motif": "Motif de la clôture",
  "demande.cloture.explication":
    "Une demande close sans intervention garde son motif : c'est ce qui mesure le service rendu sans déplacement.",

  "demande.refus.introuvable":
    "Cette demande n'existe pas, ou elle n'est pas dans votre périmètre.",
  "demande.refus.lieu_inconnu":
    "Ce lieu n'existe pas pour ce client, ou il n'est pas dans votre périmètre.",
  "demande.refus.lieu_sans_rattachement":
    "Ce lieu n'est rattaché à aucun établissement. Le délai d'accusé de réception se compte sur ses heures ouvrées : renseignez le rattachement d'abord.",
  "demande.refus.agence_sans_calendrier":
    "Les horaires de l'établissement dont dépend ce lieu ne sont pas réglés. Sans eux, le délai de réponse n'a pas de point de départ.",
  "demande.refus.deja_qualifiee": "Cette demande est déjà qualifiée.",
  "demande.refus.deja_accusee":
    "La réception de cette demande a déjà été accusée. L'horodatage ne se réécrit pas : c'est lui qui mesure le délai de réponse.",
  "demande.refus.transformer_sans_qualifier":
    "Qualifiez la demande avant de la transformer : c'est la qualification qui décide de la nature, de la durée et de l'affectation.",
  "demande.refus.deja_transformee":
    "Cette demande est devenue une intervention : elle ne change plus. C'est l'intervention qui se poursuit ou s'annule.",
  "demande.refus.deja_close":
    "Cette demande est close sans suite et ne se rouvre pas. Son motif mesure le service rendu à distance ; déposez une nouvelle demande.",

  "demande.source.appel": "Appel téléphonique",
  "demande.source.portail": "Portail client",
  "demande.source.email": "Courriel",
  "demande.source.echeance_contrat": "Échéance contractuelle",
  "demande.source.seuil_compteur": "Seuil de compteur",
  "demande.source.detection_technicien": "Détection par un technicien",

  "demande.statut.nouvelle": "Nouvelle",
  "demande.statut.qualifiee": "Qualifiée",
  "demande.statut.transformee": "Transformée",
  "demande.statut.close_sans_suite": "Close sans suite",

  "demande.motif.resolue_telephone": "Résolue par téléphone",
  "demande.motif.hors_perimetre": "Hors périmètre",
  "demande.motif.refus_client": "Refus du client",
  "demande.motif.doublon": "Doublon",

  "statut.a_planifier": "À planifier",
  "statut.planifiee": "Planifiée",
  "statut.envoyee": "Envoyée",
  "statut.en_cours": "En cours",
  "statut.suspendue": "Suspendue",
  "statut.terminee": "Terminée",
  "statut.cloturee": "Clôturée",
  "statut.annulee": "Annulée",

  "type_intervention.preventif_contrat": "Préventif sous contrat",
  "type_intervention.preventif_hors_contrat": "Préventif hors contrat",
  "type_intervention.curatif": "Curatif",
  "type_intervention.installation": "Installation",
  "type_intervention.garantie": "Garantie",
  "type_intervention.controle_reglementaire": "Contrôle réglementaire",
  "type_intervention.expertise": "Expertise",
  "type_intervention.reprise": "Reprise",
  "type_intervention.recensement": "Recensement",

  "priorite.p1": "P1 — critique",
  "priorite.p2": "P2 — haute",
  "priorite.p3": "P3 — normale",
  "priorite.p4": "P4 — basse",

  "mode_valorisation.forfait": "Forfait",
  "mode_valorisation.temps_passe": "Temps passé",
  "mode_valorisation.forfait_plus_heures": "Forfait plus heures",

  // ── Les zones géographiques (D23) et le catalogue de forfaits (D86) ───────
  //
  // Les six zones sont closes dans `lib/sites/zones.ts` ; ce sont leurs
  // LIBELLÉS qui vivent ici, parce qu'un humain les lit à l'écran.
  "zone.grand_noumea": "Grand Nouméa",
  "zone.sud": "Sud",
  "zone.cote_est": "Côte Est",
  "zone.cote_ouest": "Côte Ouest",
  "zone.nord": "Nord",
  "zone.iles": "Îles",

  "type_forfait.deplacement": "Déplacement",
  "type_forfait.mise_en_service": "Mise en service",
  "type_forfait.controle": "Contrôle",
  "type_forfait.prestation": "Prestation",

  "forfaits.titre": "Forfaits applicables",
  "forfaits.sous_titre":
    "Pour une zone donnée, quels forfaits s'appliquent et dans quel ordre.",
  "forfaits.zone": "Zone géographique",
  "forfaits.voir": "Voir",
  "forfaits.vide":
    "Le catalogue est vide. Aucun forfait ne se facture tant qu'aucun n'est saisi.",
  "forfaits.rang": "Rang",
  "forfaits.code": "Forfait",
  "forfaits.montant": "Montant",
  "forfaits.conditions": "Conditions",
  "forfaits.verdict": "Pour cette zone",
  "forfaits.sans_condition": "Aucune — s'applique partout",
  "forfaits.condition_famille": "Une famille de matériel",
  "forfaits.retenu": "Retenu",
  "forfaits.applicable_apres":
    "Applicable, mais un rang plus petit passe avant",
  "forfaits.ecarte": "Écarté — ses conditions ne sont pas remplies",
  "forfaits.inactif": "Inactif",
  "forfaits.explication_rang":
    "Le plus petit rang l'emporte. Deux forfaits de même nature ne peuvent pas partager un rang : la base le refuse, pour que deux interventions identiques ne se facturent jamais différemment selon l'ordre où les forfaits ont été saisis.",

  // ── Le paramétrage d'ouverture (lot 2, I7) ────────────────────────────────
  //
  // « Agence » et « site » ne s'écrivent pas ici : le code nomme la notion.
  "parametres.titre": "Réglage des horaires d'ouverture",
  "parametres.sous_titre":
    "Les jours travaillés, les horaires et le pas des créneaux. Chaque établissement a les siens : rien n'est écrit dans l'application.",
  "parametres.calendrier": "Calendrier",
  "parametres.jours": "Jours travaillés",
  "parametres.horaires": "Horaires",
  "parametres.pas": "Pas des créneaux (minutes)",
  "parametres.pas_enregistrer": "Enregistrer le pas",
  "parametres.creneaux_exemple": "Créneaux proposés un jour ouvré",
  "parametres.sans_calendrier":
    "Aucun calendrier n'est rattaché : aucun créneau ne peut être proposé.",
  "parametres.exception_technicien": "Exception par technicien",
  "parametres.exception_explication":
    "Un technicien peut recevoir un autre calendrier de la société — un temps partiel, une alternance, un renfort du matin. C'est un rattachement, jamais une copie d'horaires : les horaires changent à un seul endroit.",
  "parametres.exception_aucune": "Aucune exception enregistrée.",
  // ── LES COLONNES DU TABLEAU DENSE (R2-05) ────────────────────────────────
  //
  // La maquette range ce contenu en TABLEAU, pas en cartes. Les libellés
  // portent tout SAUF les notions imposées : le composant compose le titre de
  // la colonne d'établissement depuis `mot("agence")`.
  // ── L'ÉCRAN « PARC MACHINES » (R2-21) ───────────────────────────────────
  "parc.titre": "Parc machines clients",
  "parc.sous_titre":
    "Ce que CODIMA suit, chez qui, et ce qu'il reste à compléter.",
  "parc.colonne_reference": "Référence",
  "parc.colonne_modele": "Modèle",
  "parc.colonne_serie": "N° de série",
  "parc.colonne_lieu": "Client / lieu",
  "parc.colonne_mise_en_service": "Mise en service",
  "parc.colonne_statut": "Statut",
  "parc.famille": "Famille",
  "parc.vide": "Aucune machine n'est enregistrée pour cette société.",
  "parc.total": "machines",
  "parc.incompletes": "fiches à compléter",
  "parc.a_completer": "À compléter",
  "parc.non_synchronisee": "non synchronisée",
  "parc.borne":
    "Les premières fiches du parc, les incomplètes d'abord. La recherche et l'export viennent avec les écrans de lot 2.",
  "parametres.colonne_pas": "Pas",
  "parametres.colonne_creneaux": "Créneaux",
  "parametres.colonne_exceptions": "Exceptions",
  "parametres.aucune_agence":
    "Aucun établissement n'est enregistré pour cette société.",
  "parametres.sans_calendrier_court": "Aucun calendrier",
  "parametres.refus_pas":
    "Le pas des créneaux se règle en minutes entières, entre 1 et 480.",

  // ── LA BARRE DE NAVIGATION — les onze entrées de la maquette (D95) ───────
  //
  // Onze, et dans cet ordre : c'est la barre que la maquette porte, et elle
  // fait foi sur la disposition. Les entrées dont l'écran n'existe pas encore
  // sont rendues INERTES plutôt qu'absentes — la barre dit ce que le produit
  // contient, jamais ce que vous avez le droit d'ouvrir (voir
  // `lib/navigation/entrees.ts`).
  "nav.libelle": "Navigation principale",
  // Le nom du produit est coupé en deux parce que la maquette le peint en deux
  // couleurs. Le couper dans le composant aurait été écrire du texte dans une
  // balise, ce que L0-11 refuse.
  "nav.marque_debut": "CODI",
  "nav.marque_fin": "PLAN",
  "nav.marque_metier": "SAV",
  "nav.a_venir": "Écran à venir",
  "nav.tableau_de_bord": "Tableau de bord",
  "nav.planning": "Planning",
  "nav.interventions": "Interventions",
  "nav.parc_machines": "Parc machines",
  "nav.contrats": "Contrats",
  "nav.app_technicien": "App technicien",
  "nav.portail_client": "Portail client",
  // D97 — l'entrée de la barre DU PORTAIL. Distincte de « Portail client »,
  // qui est l'entrée du back-office vers ce même espace : ce n'est pas le même
  // lecteur, donc ce n'est pas le même mot.
  "nav.portail_parc": "Votre parc",
  "nav.imports_excel": "Imports Excel",
  "nav.societes_tarifs": "Sociétés & tarifs",
  "nav.console_editeur": "Console éditeur",

  // ── LA GRILLE DU PLANNING (D95) ──────────────────────────────────────────
  "planning.colonne_technicien": "Technicien",
  "planning.semaine": "Semaine",
  "planning.du": "du",
  "planning.au": "au",
  "planning.semaine_avant": "← Semaine précédente",
  "planning.semaine_apres": "Semaine suivante →",
  "planning.semaine_vide": "Aucune intervention posée sur cette semaine.",
  "planning.file_vide": "Rien n'attend d'être posé.",
  // La légende de la maquette, six entrées, dans son ordre. Elle NOMME des
  // familles de couleur, pas des statuts un à un : huit statuts, cinq
  // familles, et c'est la maquette qui groupe (voir `lib/theme/statuts.ts`).
  // ── LES DEUX VUES DU PLANNING (11/09/2026) ───────────────────────────────
  "planning.vue_semaine": "Semaine",
  "planning.vue_jour": "Jour",
  "planning.jour_avant": "← Jour précédent",
  "planning.jour_apres": "Jour suivant →",
  "planning.colonne_heure": "Heure",
  "planning.jour_vide": "Aucune intervention posée ce jour-là.",
  "planning.creneaux_libres": "créneaux libres",
  "planning.pas": "pas de",
  "planning.jour_occupe": "Occupé",
  "planning.jour_libre": "Libre",
  "planning.jour_hors_ouverture": "Hors ouverture",
  "planning.legende.planifiee": "Planifiée",
  "planning.legende.en_cours": "En cours / P1",
  "planning.legende.terminee": "Terminée",
  "planning.legende.suspendue": "Suspendue / absence",
  "planning.legende.interne": "Atelier / interne",
  "planning.legende.ferme": "Jour non ouvert",

  // Les jours abrégés — l'en-tête d'une colonne de la grille, « Lun 17 ».
  "jour.court.1": "Lun",
  "jour.court.2": "Mar",
  "jour.court.3": "Mer",
  "jour.court.4": "Jeu",
  "jour.court.5": "Ven",
  "jour.court.6": "Sam",
  "jour.court.7": "Dim",

  "jour.1": "lundi",
  "jour.2": "mardi",
  "jour.3": "mercredi",
  "jour.4": "jeudi",
  "jour.5": "vendredi",
  "jour.6": "samedi",
  "jour.7": "dimanche",

  // ── La page de santé, sans compte (mise en ligne) ─────────────────────────
  "sante.titre": "État de l'installation",
  "sante.sous_titre":
    "Quatre questions, quatre réponses. Cette page ne demande aucun compte et ne montre jamais d'adresse, de nom de base ni d'identifiant.",
  "sante.base": "La base de données répond",
  "sante.role": "Le rôle de connexion est le bon",
  "sante.role_explication":
    "L'application doit se connecter avec un rôle non propriétaire, faute de quoi le cloisonnement entre sociétés ne s'applique pas.",
  "sante.migrations": "Les migrations sont à jour",
  "sante.migration_manquante": "Migration non appliquée",
  "sante.societes": "Sociétés enregistrées",
  "sante.comptes": "Comptes enregistrés",
  "sante.oui": "oui",
  "sante.non": "non",
  "sante.inconnu": "inconnu",
  "sante.non_lisible": "non lisible d’ici",
  "sante.tout_va_bien": "L'installation répond et paraît complète.",
  "sante.quelque_chose_cloche":
    "Quelque chose ne va pas : les lignes marquées « non » ci-dessous disent quoi.",
} as const;

export type CleTraduction = keyof typeof fr;

/** Retourne la chaîne française associée à une clé du dictionnaire. */
export function t(cle: CleTraduction): string {
  return fr[cle];
}

/**
 * Une chaîne venue de L'EXTÉRIEUR désigne-t-elle une clé du dictionnaire ?
 *
 * Le premier écran reporte ses refus d'une route vers une page par un paramètre
 * d'URL (L1-02f). Ce paramètre est une CLÉ, jamais un texte : sans ce filtre,
 * n'importe qui ferait écrire n'importe quoi à la page en forgeant un lien.
 * Une chaîne inconnue n'affiche rien du tout.
 */
export function estCleTraduction(valeur: string): valeur is CleTraduction {
  return Object.hasOwn(fr, valeur);
}
