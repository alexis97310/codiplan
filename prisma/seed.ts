import { Prisma, PrismaClient, type StatutIntervention } from "@prisma/client";

import { avecDesignationAuth } from "../lib/auth/lecture-identite";
import { Role } from "../lib/auth/roles";
import {
  instantAMinutes,
  jourSuivant,
  maintenant,
  type JourLocal,
} from "../lib/calendar/fuseau";
import { avecSociete, avecSocieteEtRole } from "../lib/db/rls";
import { uuidv7 } from "../lib/db/uuid";
import { engendrerJetonQr } from "../lib/machines/qr";
import { ajouterMois } from "../lib/vgp/information";
import {
  DELAIS_SEED,
  DUREE_MAXIMALE_MS,
  allersRetoursTransaction,
} from "./seed-delais";
import {
  COMPTES_PORTAIL,
  DEVISES,
  FAMILLES_MATERIEL_DEMONSTRATION,
  FORFAITS_DEMONSTRATION,
  HABILITATIONS_AMORCAGE,
  INTERVENTIONS_AVEC_MACHINES_DEMONSTRATION,
  INTERVENTIONS_DEMONSTRATION,
  LOTS_IMPORT_DEMONSTRATION,
  LUNDI_DEMONSTRATION,
  MACHINES_DEMONSTRATION,
  MODELES_MATERIEL_DEMONSTRATION,
  VERIFICATIONS_VGP_DEMONSTRATION,
  identifiantParc,
  colonnesDeSuspension,
  TECHNICIENS_PAR_AGENCE,
  identifiantIntervention,
  PARITES,
  SOCIETES,
  UTILISATEURS_INTERNES,
  anneeDeDepartFeries,
  ecartsDeLAgence,
  feriesDuTerritoire,
  anneesFeries,
  societeParCode,
} from "./seed-data";

/**
 * LES STATUTS QU'UN VERROU DE BASE REFUSE DE TOUCHER (D84).
 *
 * `intervention_cycle_de_vie` refuse toute modification d'une ligne clôturée ou
 * annulée. « Terminée » s'y ajoute ici pour une autre raison : une intervention
 * finie a eu lieu un jour précis, et la ramener sur la semaine courante
 * raconterait une histoire fausse.
 */
const STATUTS_TERMINAUX = new Set<StatutIntervention>([
  "cloturee",
  "annulee",
  "terminee",
]);

/**
 * Un jour local en DATE UTC — la forme que `date_planifiee` porte (`@db.Date`).
 *
 * Jamais par un `Date` local : UTC+11 décale le jour d'un cran, et une
 * intervention du lundi se rangerait au dimanche.
 */
function jourEnDate(jour: JourLocal | null): Date | null {
  return jour === null
    ? null
    : new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));
}

/**
 * L'instant d'un créneau — un jour local, une heure locale, un fuseau.
 *
 * `creneau_debut` est un INSTANT et non une date : 07:30 à Nouméa et 07:30 à
 * Lyon ne sont pas le même moment, et c'est tout l'objet de la colonne.
 */
function instantDuCreneau(
  jour: JourLocal | null,
  minutes: number | null,
  fuseau: string,
): Date | null {
  return jour === null || minutes === null
    ? null
    : instantAMinutes(jour, minutes, fuseau);
}

/**
 * Amorçage du socle multi-société (tickets L0-03 puis L0-08).
 *
 * Écrit le jeu de démonstration décrit dans `seed-data.ts` : deux sociétés —
 * l'une en XPF avec trois agences (Ducos, Koné, Dolbeau), l'autre en EUR — et
 * un compte portail rattaché à un client. Idempotent : les `upsert` portent sur
 * les clés naturelles (code, email, identifiant fixe de société), les UUID v7
 * (I10) ne sont attribués qu'à la création.
 *
 * Le ticket L0-08 y ajoute le référentiel territorial des jours fériés (D46) et
 * les calendriers d'ouverture des agences, avec leurs plages et la surcharge
 * des fériés travaillés (D13). Les horaires sont des valeurs de DÉMONSTRATION,
 * dites comme telles dans leur libellé — les horaires réels des agences CODIMA
 * seront saisis plus tard. Ce qui n'est pas de la démonstration, en revanche,
 * c'est que Ducos ouvre le samedi et Koné non : c'est RG-PLA-01, et le jeu de
 * test doit la porter.
 *
 * Le seed CONSERVE le rôle propriétaire — il instancie son propre client, sans
 * passer par `lib/db/client`, dont le contrôle de démarrage refuserait ce rôle.
 * Depuis `FORCE ROW LEVEL SECURITY`, ce rôle est néanmoins soumis aux politiques
 * de cloisonnement : chaque écriture sur une table cloisonnée est donc encadrée
 * par `avecSociete`, qui pose `app.societe_id`. Les référentiels de plateforme
 * (`devise`, `parite`) et l'identité globale (`utilisateur`) ne sont pas
 * cloisonnés et s'écrivent hors contexte.
 *
 * **Les délais des transactions sont fixés explicitement** (`seed-delais.ts`),
 * et non laissés aux défauts de Prisma : ceux-ci valent pour un réseau local,
 * pas pour une base à Sydney atteinte depuis un exécuteur GitHub. Voir
 * `docs/decisions/2026-08-23-seed-transaction-latence-neon.md`.
 *
 * **Chaque section annonce ce qu'elle va faire AVANT de le faire.** L'ordre
 * n'est pas un détail : la dernière ligne du journal désigne alors la section
 * qui a échoué, et non la dernière qui a réussi. Un seed qui s'interrompt à
 * l'autre bout du monde ne se déboguera jamais autrement.
 */
const prisma = new PrismaClient();

/** Origine monotone du journal — une DURÉE, jamais une date (gardien L0-08). */
const DEBUT = performance.now();

/**
 * Une ligne de progression, préfixée du temps écoulé.
 *
 * Les secondes écoulées ne sont pas de la décoration : ce sont elles qui ont
 * manqué pour lire l'incident du 23 août 2026, où la seule information
 * disponible était « l'étape a duré 15 s ». Un écart d'une seconde entre deux
 * lignes voisines DIT la latence, et la latence est ici la cause.
 *
 * `process.stdout.write` plutôt que `console.log`, banni par CLAUDE.md §5 et
 * par la règle ESLint `no-console` — c'est la convention déjà suivie par tous
 * les scripts de `scripts/`.
 */
function etape(message: string): void {
  // Le dixième de seconde est composé à la main, par division entière : le
  // gardien I3 refuse tout arrondi d'affichage écrit dans le code applicatif,
  // et il a raison de ne pas distinguer une durée d'un montant — c'est la
  // règle qui compte, pas l'intention de celui qui l'écrit.
  //
  // La sortie est donc de l'ARITHMÉTIQUE ENTIÈRE, et surtout PAS un passage
  // par `lib/money` : une durée n'est pas un montant, et D45 sépare le temps
  // de l'argent. Faire formater des secondes par le module monétaire pour
  // contenter un gardien monétaire franchirait exactement la frontière que ce
  // gardien existe pour tenir.
  const millisecondes = Math.round(performance.now() - DEBUT);
  const secondes = Math.floor(millisecondes / 1000);
  const dixiemes = Math.floor((millisecondes % 1000) / 100);
  const ecoule = `${secondes}.${dixiemes}`;
  process.stdout.write(`[seed +${ecoule.padStart(6)} s] ${message}\n`);
}

/** « 1 ligne », « 2 lignes » — ce journal est lu par un humain. */
function pluriel(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}

/**
 * LE MOYEN DE CONNEXION AU REPOS — sans lui, la base de démonstration a des
 * données et AUCUNE PORTE.
 *
 * **Mesuré le 11/09/2026 :** après `pnpm db:seed`, la table `compte` porte
 * **zéro ligne**. Les cinq identités de démonstration existent, elles sont
 * habilitées, elles ont un planning garni — et **aucune ne peut se connecter**.
 * Le geste d'amorçage refuse (« la société porte déjà des habilitations » : il
 * n'ouvre que la PREMIÈRE identité), et la réémission refuse aussi
 * (« l'identité ne porte aucun moyen de connexion »). *Les deux refus sont
 * justes ; c'est l'état qu'ils lisent qui manquait.*
 *
 * Ce que cette fonction pose est **exactement l'état que l'amorçage laisse
 * derrière lui** — un compte à mot de passe NUL. C'est le cliquet de D65, dans
 * son sens ouvert : personne ne peut se connecter avec, et la réémission sait
 * s'en servir pour délivrer une URL de premier accès. *Aucun mot de passe
 * n'entre au dépôt, et il n'en existe aucun tant qu'une personne n'en a pas
 * choisi un ; dès qu'elle l'a fait, l'état ne revient jamais (D65).*
 *
 * Les trois valeurs ne sont pas devinées : elles sont MESURÉES sur un compte
 * réellement ouvert par `signUpEmail` — `emetteur = "local:credential"`,
 * `fournisseur_id = "credential"`, `compte_externe_id` = l'identifiant de
 * l'identité. Écrire autre chose ferait une ligne que la bibliothèque ne
 * reconnaîtrait pas, et le refus arriverait au premier `/premier-acces`.
 *
 * La création passe par la DÉSIGNATION : la politique `compte_ouverture` exige
 * `app.authentification_utilisateur_id`, que `avecDesignationAuth` renseigne
 * depuis le `data` d'un `create` (L1-02d). Une écriture faite sans elle serait
 * refusée EN SILENCE — zéro ligne, pas d'erreur.
 */
async function poserLeMoyenDeConnexionAuRepos(
  prisma: PrismaClient,
  utilisateurId: string,
): Promise<void> {
  const designe = avecDesignationAuth(prisma);
  const existant = await designe.compte.findFirst({
    where: { utilisateur_id: utilisateurId },
    select: { id: true },
  });
  // LE SEED NE RÉÉCRIT PAS : si un compte existe, il porte peut-être un mot de
  // passe CHOISI, et le cliquet de D65 ne se rouvre jamais. Même sens de
  // défaillance que l'abstention du 09/09 sur les interventions verrouillées.
  if (existant !== null) {
    return;
  }
  await designe.compte.create({
    data: {
      id: uuidv7(),
      utilisateur_id: utilisateurId,
      emetteur: "local:credential",
      compte_externe_id: utilisateurId,
      fournisseur_id: "credential",
      mot_de_passe: null,
    },
  });
}

async function seed(): Promise<void> {
  etape(`devises — ${pluriel(DEVISES.length, "ligne")}`);
  for (const devise of DEVISES) {
    await prisma.devise.upsert({
      where: { code: devise.code },
      update: {
        libelle: devise.libelle,
        decimales: devise.decimales,
        symbole: devise.symbole,
      },
      create: devise,
    });
  }

  etape(`parités — ${pluriel(PARITES.length, "ligne")}`);
  for (const parite of PARITES) {
    const date_effet = new Date(parite.date_effet);

    await prisma.parite.upsert({
      where: {
        devise_code_date_effet: {
          devise_code: parite.devise_code,
          date_effet,
        },
      },
      update: { taux: parite.taux, source: parite.source },
      create: {
        id: uuidv7(),
        devise_code: parite.devise_code,
        date_effet,
        taux: parite.taux,
        source: parite.source,
      },
    });
  }

  for (const [indexSociete, societe] of SOCIETES.entries()) {
    // Le rang ouvre à chaque société sa propre plage d'identifiants de
    // démonstration. Il part de 1 : un rang nul ne se distinguerait pas de
    // l'absence de rang.
    const rangSociete = indexSociete + 1;
    const { id, agences, calendriers, clients, ...champsSociete } = societe;

    // ── 1. LE FAIT PUBLIC, d'abord (D46, complément 2) ────────────────────
    //
    // `jour_ferie` est un référentiel de plateforme : pas de `societe_id`,
    // donc aucun contexte à poser — comme `devise` et `parite`. La clé
    // naturelle est le couple (territoire, date), ce qui rend l'amorçage
    // idempotent et permet de corriger un libellé sans dupliquer la ligne.
    //
    // **Horizon GLISSANT** (D46, complément 3) : l'année de départ est l'année
    // en cours DANS LE FUSEAU DE LA SOCIÉTÉ — le 1er janvier n'arrive pas au
    // même instant à Nouméa et à Paris. Rejouer le seed étend donc l'horizon
    // sans qu'aucune liste d'années n'ait à être modifiée ; et
    // `scripts/horizon-feries.mts` échoue si l'horizon retombe sous douze mois.
    const anneeDeDepart = anneeDeDepartFeries(societe);
    const territoires = [
      ...new Set(agences.map((agence) => agence.territoire)),
    ];

    const annees = anneesFeries(anneeDeDepart);
    const lignesFeries = territoires.reduce(
      (total, territoire) =>
        total +
        annees.reduce(
          (parAnnee, annee) =>
            parAnnee + feriesDuTerritoire(territoire, annee).length,
          0,
        ),
      0,
    );
    etape(
      `${societe.code} — jours fériés : ${pluriel(lignesFeries, "ligne")} ` +
        `(territoires ${territoires.join(", ")} ; horizon ${annees[0]}–` +
        `${annees[annees.length - 1]})`,
    );

    for (const territoire of territoires) {
      for (const annee of annees) {
        for (const ferie of feriesDuTerritoire(territoire, annee)) {
          const date = new Date(`${ferie.date}T00:00:00.000Z`);

          await prisma.jourFerie.upsert({
            where: { territoire_date: { territoire: ferie.territoire, date } },
            update: { libelle: ferie.libelle, mobile: ferie.mobile },
            create: {
              id: uuidv7(),
              territoire: ferie.territoire,
              date,
              libelle: ferie.libelle,
              mobile: ferie.mobile,
            },
          });
        }
      }
    }

    // ── 2. La société, ses calendriers, ses agences et LEURS ÉCARTS ────────
    //
    // La politique de `societe` est `id = app.societe_id` : une société ne peut
    // s'écrire que sous son propre contexte, y compris depuis le seed.
    //
    // ── LES DÉLAIS, ET POURQUOI ILS SONT ÉCRITS ICI ───────────────────────
    //
    // Cette transaction enchaîne une trentaine d'écritures SÉQUENTIELLES : la
    // société, ses calendriers, chaque plage horaire, chaque agence, chaque
    // écart local. Chacune est un aller-retour complet vers la base. Le défaut
    // de Prisma — 5 000 ms — les tient toutes en local, où un aller-retour
    // coûte une milliseconde, et n'en tient qu'une vingtaine depuis un
    // exécuteur GitHub vers Neon à Sydney, où il en coûte deux cents. Au-delà,
    // le moteur ferme la transaction et la requête suivante échoue en P2028.
    //
    // On ne découpe PAS pour rentrer dans le défaut : le seed doit rester
    // atomique — une société dotée de ses calendriers mais privée de ses
    // agences est un état que rien ne rattrape. On dit donc combien de temps
    // la transaction a le droit de durer. Le chiffre et son arithmétique sont
    // dans `seed-delais.ts`, et un test les redemande à chaque fois que le
    // seed grossit.
    etape(
      `${societe.code} — transaction cloisonnée : ouverture ` +
        `(~${allersRetoursTransaction(societe)} allers-retours, ` +
        `délai ${DUREE_MAXIMALE_MS / 1000} s)`,
    );

    await avecSociete(
      prisma,
      id,
      async (tx) => {
        await tx.societe.upsert({
          where: { id },
          update: champsSociete,
          create: { id, ...champsSociete },
        });

        // ── Clients de démonstration (ticket L1-01) ─────────────────────────
        //
        // Écrits DANS la transaction cloisonnée, et pour deux raisons : la
        // politique de `client` est de forme « parc », elle exige donc
        // `app.societe_id` posé — le seed conserve le rôle propriétaire, et
        // depuis `FORCE ROW LEVEL SECURITY` ce rôle y est soumis comme les
        // autres ; et une société dotée de ses agences mais privée de ses
        // clients est un état que rien ne rattrape.
        //
        // `upsert` sur l'identifiant FIXE : rejouer le seed corrige un libellé
        // au lieu de créer une seconde fiche, et le compte portail de
        // `COMPTES_PORTAIL` retrouve toujours le même client.
        etape(`${societe.code} — clients de démonstration : ${clients.length}`);

        for (const client of clients) {
          // Les SITES ne sont pas écrits ici : ils le sont plus bas, une fois
          // les agences connues (D56). `champsClient` est donc construit sans
          // eux — explicitement plutôt que par une variable inutilisée, qui
          // demanderait à ESLint de fermer les yeux sur ce qu'il a raison de
          // signaler.
          const { id: clientId, adresse_facturation, sites, ...reste } = client;
          void sites;
          const champsClient = reste;

          await tx.client.upsert({
            where: { id: clientId },
            update: {
              ...champsClient,
              adresse_facturation: adresse_facturation ?? Prisma.DbNull,
            },
            create: {
              id: clientId,
              societe_id: id,
              ...champsClient,
              adresse_facturation: adresse_facturation ?? Prisma.DbNull,
            },
          });
        }

        // Les calendriers AVANT les agences : `agence.calendrier_id` les
        // référence, et la clé étrangère posée par la migration L0-08 refuserait
        // l'ordre inverse. Un calendrier ne porte que des HEURES — le territoire
        // et les écarts appartiennent à l'agence (D46, compléments 1 et 2).
        const identifiants = new Map<string, string>();
        // Les identifiants d'agence, résolus par CODE. Les agences n'ont pas
        // d'identifiant fixe au jeu de démonstration — elles sont `upsert`ées
        // par `(societe_id, code)` —, et les sites doivent pouvoir nommer la
        // leur (D56). C'est aussi ce qui impose l'ordre : les agences AVANT les
        // sites, comme les calendriers avant les agences.
        const identifiantsAgences = new Map<string, string>();

        etape(
          `${societe.code} — calendriers : ${calendriers.length}, ` +
            `plages : ${calendriers.reduce((total, calendrier) => total + calendrier.plages.length, 0)}`,
        );

        for (const calendrier of calendriers) {
          const enregistre = await tx.calendrier.upsert({
            where: {
              societe_id_code: { societe_id: id, code: calendrier.code },
            },
            update: { libelle: calendrier.libelle },
            create: {
              id: uuidv7(),
              societe_id: id,
              code: calendrier.code,
              libelle: calendrier.libelle,
            },
          });
          identifiants.set(calendrier.code, enregistre.id);

          for (const plage of calendrier.plages) {
            await tx.calendrierPlage.upsert({
              where: {
                calendrier_id_jour_semaine_debut_minutes: {
                  calendrier_id: enregistre.id,
                  jour_semaine: plage.jour_semaine,
                  debut_minutes: plage.debut_minutes,
                },
              },
              update: { fin_minutes: plage.fin_minutes },
              create: {
                id: uuidv7(),
                societe_id: id,
                calendrier_id: enregistre.id,
                jour_semaine: plage.jour_semaine,
                debut_minutes: plage.debut_minutes,
                fin_minutes: plage.fin_minutes,
              },
            });
          }
        }

        etape(
          `${societe.code} — agences : ${agences.length}, écarts locaux : ` +
            `${agences.reduce((total, agence) => total + ecartsDeLAgence(agence, anneeDeDepart).length, 0)}`,
        );

        for (const agence of agences) {
          const calendrierId = identifiants.get(agence.calendrier_code);
          if (calendrierId === undefined) {
            throw new Error(
              `Agence ${agence.code} : calendrier « ${agence.calendrier_code} » ` +
                "absent du jeu de démonstration de sa société.",
            );
          }

          const enregistree = await tx.agence.upsert({
            where: { societe_id_code: { societe_id: id, code: agence.code } },
            update: {
              libelle: agence.libelle,
              adresse: agence.adresse,
              territoire: agence.territoire,
              calendrier_id: calendrierId,
            },
            create: {
              id: uuidv7(),
              societe_id: id,
              code: agence.code,
              libelle: agence.libelle,
              adresse: agence.adresse,
              territoire: agence.territoire,
              calendrier_id: calendrierId,
            },
          });
          identifiantsAgences.set(agence.code, enregistree.id);

          // ── 3. L'ÉCART LOCAL, ensuite et jamais avant ────────────────────
          //
          // La lecture de `jour_ferie` traverse la transaction cloisonnée sans
          // encombre : le référentiel est lisible par toutes les sociétés (D46).
          // Un écart qui désignerait un férié inexistant est refusé par
          // `ecartsDeLAgence` : un écart surcharge un fait public, il ne le crée
          // pas.
          for (const ecart of ecartsDeLAgence(agence, anneeDeDepart)) {
            const date = new Date(`${ecart.date}T00:00:00.000Z`);

            const ferie =
              ecart.ferie_libelle === null
                ? null
                : await tx.jourFerie.findUnique({
                    where: {
                      territoire_date: { territoire: agence.territoire, date },
                    },
                    select: { id: true },
                  });

            // `territoire` est RECOPIÉ depuis l'agence, jamais saisi (D48) :
            // c'est la colonne par laquelle le chaînage tient l'écart des deux
            // côtés à la fois — vers l'agence, et vers le fait public. La base
            // refuserait d'ailleurs toute autre valeur.
            await tx.calendrierFerie.upsert({
              where: {
                agence_id_date: { agence_id: enregistree.id, date },
              },
              update: {
                travaille: ecart.travaille,
                motif: ecart.motif,
                territoire: agence.territoire,
                jour_ferie_id: ferie?.id ?? null,
              },
              create: {
                id: uuidv7(),
                societe_id: id,
                agence_id: enregistree.id,
                date,
                territoire: agence.territoire,
                jour_ferie_id: ferie?.id ?? null,
                travaille: ecart.travaille,
                motif: ecart.motif,
              },
            });
          }
        }

        // ── 4. Les SITES, après les agences et jamais avant (L1-02, D56) ───
        //
        // L'ordre est une contrainte de la base : `site` porte deux clés
        // étrangères composites, l'une vers son client, l'autre vers son
        // AGENCE de rattachement. Les clients sont écrits plus haut, les
        // agences juste au-dessus ; les sites viennent donc en dernier.
        //
        // `upsert` sur l'identifiant FIXE, comme les clients : rejouer le seed
        // corrige un libellé au lieu de créer un second lieu, et
        // `COMPTES_PORTAIL.perimetre_sites` retrouve toujours le même
        // identifiant.
        const sites = clients.flatMap((client) =>
          client.sites.map((site) => ({
            site,
            clientId: client.id,
            // Un lieu est OUVERT quand son client l'est aussi : un client
            // inactif garde ses lieux, mais on n'y travaille plus.
            ouvert: client.actif && site.actif,
          })),
        );
        etape(`${societe.code} — sites de démonstration : ${sites.length}`);

        for (const { site, clientId } of sites) {
          const { id: siteId, horaires, agence_code, ...champsSite } = site;
          const agenceId = identifiantsAgences.get(agence_code);
          if (agenceId === undefined) {
            throw new Error(
              `Site ${siteId} : agence « ${agence_code} » absente du jeu de ` +
                "démonstration de sa société. Un site dépend d'une agence et " +
                "d'une seule (D56) ; il n'y a pas de valeur par défaut.",
            );
          }

          await tx.site.upsert({
            where: { id: siteId },
            update: {
              ...champsSite,
              agence_id: agenceId,
              horaires: horaires ?? Prisma.DbNull,
            },
            create: {
              id: siteId,
              societe_id: id,
              client_id: clientId,
              agence_id: agenceId,
              ...champsSite,
              horaires: horaires ?? Prisma.DbNull,
            },
          });
        }

        // ── 5. Les INTERVENTIONS de démonstration (lot 2, D84) ─────────────
        //
        // **Pourquoi le seed en pose, alors qu'il n'a posé aucune machine.**
        // Un planning vide ne démontre rien : il ne dit pas si les couleurs de
        // statut se lisent, si la file d'attente se distingue des lignes
        // posées, ni si le calcul de RG-TAR-05 s'affiche. *Ce sont des DONNÉES
        // DE DÉMONSTRATION, dites comme telles*, et elles disparaissent avec
        // `scripts/purge-demonstration.mts` comme les clients et les sites.
        //
        // Elles viennent APRÈS les sites, et l'ordre est une contrainte de la
        // base : `intervention` porte trois clés étrangères composites — vers
        // son client, son lieu et son agence de rattachement.
        //
        // **L'agence n'est pas choisie ici** : elle est reprise du site, comme
        // le fait le chemin de production. La choisir séparément ferait deux
        // lectures d'un même critère, et le seed finirait par démontrer autre
        // chose que ce que l'application fait.
        //
        // Les dates sont posées en UTC et jamais par un `Date` local : UTC+11
        // décale le jour d'un cran, et une intervention du 1er se rangerait au
        // 31 (I3 n'est pas seul à souffrir des fuseaux).
        const sitesEcrits = sites.map(({ site, clientId, ouvert }) => ({
          siteId: site.id,
          clientId,
          ouvert,
          agenceId: identifiantsAgences.get(site.agence_code),
        }));
        // **L'IDENTIFIANT EST DÉRIVÉ DE LA SOCIÉTÉ** *(10/09/2026)*. Il était
        // fixe : la première société prenait les six, la seconde les trouvait
        // écrites et s'abstenait — zéro sur six, à chaque exécution. Le rang
        // de la société ouvre à chacune une plage qui ne peut pas rencontrer
        // celle de sa voisine.
        //
        // **LES DATES SONT DE NOUVEAU RELATIVES, DEPUIS SEMIS-2 (21/09/2026)**
        // — `LUNDI_DEMONSTRATION` (`prisma/seed-data.ts`) est le lundi de la
        // semaine où CE semis tourne, dans le fuseau nommé de CODIMA-NC. Un
        // lundi ÉCRIT EN DUR l'a brièvement remplacé le même jour (SEMIS-1) ;
        // mesuré l'après-midi même sur sept semaines de production, un lundi
        // fixe se périme lui aussi, une fois pour toutes plutôt qu'à chaque
        // semis manqué. La décision, son revirement et sa limite assumée sont
        // documentés à la définition de `LUNDI_DEMONSTRATION`.
        const lundi = LUNDI_DEMONSTRATION;
        const interventions = INTERVENTIONS_DEMONSTRATION.map(
          (modele, index) => {
            const jour =
              modele.joursDepuisLundi === null
                ? null
                : jourSuivant(lundi, modele.joursDepuisLundi);
            return {
              ...modele,
              id: identifiantIntervention(rangSociete, modele.rang),
              lieu: sitesEcrits[index % sitesEcrits.length],
              date_planifiee: jourEnDate(jour),
              creneau_debut: instantDuCreneau(
                jour,
                modele.debutMinutes,
                societe.fuseau_horaire,
              ),
              creneau_fin: instantDuCreneau(
                jour,
                modele.debutMinutes === null || modele.dureeMin === null
                  ? null
                  : modele.debutMinutes + modele.dureeMin,
                societe.fuseau_horaire,
              ),
              // La disponibilité annoncée suit le lundi courant comme le
              // créneau : *une date écrite en dur vieillirait avec la
              // démonstration*, et la file paraîtrait en retard chaque semaine.
              piece_dispo_jour:
                modele.pieceDispoJoursDepuisLundi === undefined
                  ? null
                  : jourSuivant(lundi, modele.pieceDispoJoursDepuisLundi),
            };
          },
        ).filter((i) => i.lieu !== undefined && i.lieu.agenceId !== undefined);

        // **LE COMPTE EST CELUI DES LIGNES ÉCRITES, PAS DES LIGNES PRÉVUES**
        // *(mesuré le 09/09/2026)*. La ligne précédente annonçait
        // `interventions.length` AVANT la boucle : elle disait « 6 » pour
        // CODIMA-EU alors que **zéro** y était écrite, les identifiants de
        // `INTERVENTIONS_DEMONSTRATION` étant FIXES et déjà pris par CODIMA-NC.
        // Le journal du flux de migration l'imprimait ainsi à chaque exécution,
        // à côté de chiffres, eux, observés — *un chiffre qui ne peut pas
        // bouger sous la faute, présenté dans la colonne des observations*
        // (§9, 06/09).
        //
        // **La collision d'identifiants n'est PAS réparée ici**, et c'est écrit
        // plutôt que tu : décider ce que la démonstration doit montrer à la
        // seconde société appartient à l'exploitation. Ce qui est réparé est le
        // RAPPORT — désormais, l'écart se voit au lieu de se taire.
        let ecrites = 0;
        let dejaPresentes = 0;
        // LE CLIENT DE CHAQUE RANG — pour rattacher, plus bas, quelques
        // machines à quelques interventions SANS deviner un rang de machine
        // en dur : le client d'une intervention dépend du LIEU que la boucle
        // ci-dessus lui tire au sort (`sitesEcrits[index % ...]`), qui diffère
        // entre CODIMA-NC (4 sites) et CODIMA-EU (3 sites). Une valeur fixée
        // à la main pour l'une serait fausse pour l'autre (§9, 01/09).
        const clientIdParInterventionRang = new Map<number, string>();
        for (const intervention of interventions) {
          const lieu = intervention.lieu;
          if (lieu === undefined || lieu.agenceId === undefined) {
            continue;
          }
          clientIdParInterventionRang.set(intervention.rang, lieu.clientId);
          // **PAS D'`upsert` ICI, ET LA RAISON EST UN VERROU DE LA BASE.**
          // Deux lignes de démonstration sont `cloturee` et `annulee`, et
          // `intervention_cycle_de_vie` refuse toute modification de l'une
          // comme de l'autre (D84). Un `upsert` rejoué buterait dessus —
          // *mesuré, le seed a échoué en `23514` la première fois.*
          //
          // Ce n'est pas une gêne à contourner : c'est le verrou qui fait son
          // travail sur le premier chemin venu, y compris le nôtre. Le seed
          // reste donc idempotent d'une autre façon — **il ne réécrit pas, il
          // s'abstient** —, et c'est le bon sens de défaillance : une ligne
          // de démonstration déjà posée n'a aucune raison de changer.
          const deja = await tx.intervention.findUnique({
            where: { id: intervention.id },
            select: { id: true },
          });
          if (deja !== null) {
            dejaPresentes += 1;
            continue;
          }
          await tx.intervention.create({
            data: {
              id: intervention.id,
              societe_id: id,
              client_id: lieu.clientId,
              site_id: lieu.siteId,
              agence_id: lieu.agenceId,
              statut: intervention.statut,
              type: intervention.type,
              priorite: intervention.priorite,
              date_planifiee: intervention.date_planifiee,
              creneau_debut: intervention.creneau_debut,
              creneau_fin: intervention.creneau_fin,
              duree_estimee_min: intervention.dureeMin,
              temps_valide_min: intervention.temps_valide_min,
              // LA SUSPENSION (L2-10, RG-INT-06, D104). Les quatre colonnes
              // vont ensemble, et la base le refuse autrement — *le verrou fait
              // son travail sur le premier chemin venu, y compris le nôtre.*
              //
              // Le calcul vit dans `colonnesDeSuspension` et NULLE PART
              // AILLEURS : le replacement ci-dessous écrit les mêmes colonnes,
              // et les calculer deux fois serait deux lectures d'un même
              // critère (§9, 01/09).
              ...colonnesDeSuspension(
                intervention,
                intervention.creneau_debut,
                jourEnDate(intervention.piece_dispo_jour),
              ),
            },
          });
          ecrites += 1;
        }
        // **LE RAPPORT ROUGIT SI L'ÉCART N'EST PAS NUL** *(10/09/2026)*. Le
        // compte des lignes écrites face à celui des lignes prévues était
        // imprimé et rien de plus : « 0 écrite(s) sur 6 prévue(s) » a traversé
        // tous les journaux du flux de migration sans que personne ne s'y
        // arrête. *Un écart imprimé n'est pas un écart constaté* — c'est la
        // même faute que le §9 du 06/09, un chiffre juste dont le lecteur ne
        // peut pas tirer la conclusion qu'il faut.
        //
        // Le REJEU n'est pas un écart : à la seconde exécution, les six lignes
        // sont déjà là, `dejaPresentes` vaut six, et la somme retombe juste.
        etape(
          `${societe.code} — interventions de démonstration : ${ecrites} ` +
            `écrite(s), ${dejaPresentes} déjà présente(s), sur ` +
            `${interventions.length} prévue(s)`,
        );
        if (ecrites + dejaPresentes !== INTERVENTIONS_DEMONSTRATION.length) {
          throw new Error(
            `${societe.code} : ${ecrites + dejaPresentes} intervention(s) de ` +
              `démonstration sur ${INTERVENTIONS_DEMONSTRATION.length} — la ` +
              "démonstration du multi-société exige DEUX plannings garnis, et " +
              "un écran vide ne vend rien. Cause probable : la société n'a " +
              "aucun site auquel les rattacher, ou une collision " +
              "d'identifiants entre sociétés.",
          );
        }

        // ── L'AMORÇAGE DES HABILITATIONS (D60, L1-04) ───────────────────────
        //
        // Ce n'est PAS de la démonstration : les codes et libellés sont des
        // faits — NF C 18-510, recommandation R489. Ce qui est de la
        // démonstration, ailleurs dans ce seed, est dit comme tel ; ici, c'est
        // le point de départ que toute société reçoit à son ouverture, et
        // qu'elle peut ensuite compléter ou réduire.
        //
        // Les durées de validité restent NULLES : la périodicité de recyclage
        // est une pratique d'entreprise, pas une valeur que la norme chiffre.
        // L'inventer serait inventer une donnée métier (§8). `NULL` se lit
        // « n'expire pas » et ne bloque personne à tort.
        //
        // Idempotence par la clé unique `(societe_id, code)` et non par un
        // identifiant fixe : ces lignes existent une fois par société.
        etape(
          `${societe.code} — amorçage des habilitations : ${HABILITATIONS_AMORCAGE.length}`,
        );
        for (const habilitation of HABILITATIONS_AMORCAGE) {
          await tx.habilitation.upsert({
            where: {
              societe_id_code: { societe_id: id, code: habilitation.code },
            },
            update: { libelle: habilitation.libelle },
            create: {
              id: uuidv7(),
              societe_id: id,
              code: habilitation.code,
              libelle: habilitation.libelle,
            },
          });
        }

        // ── 6. LE PARC DE DÉMONSTRATION (R3-10) ─────────────────────────────
        //
        // **Le semis n'en posait aucune**, et deux écrans livrés se
        // photographiaient vides : `/parc` et `/vgp` affichaient « Aucune
        // machine n'est enregistrée pour cette société », **et ils disaient
        // vrai**. *Les captures sont le seul moyen pour l'arbitre du projet de
        // juger un écran* — il lit le dépôt, il n'atteint ni le site
        // authentifié ni un serveur local.
        //
        // L'ordre est une contrainte de la base : la famille, puis le modèle
        // qui la désigne, puis la machine qui désigne le modèle, le client et
        // le lieu — trois clés étrangères composites, comme l'intervention.
        //
        // **Les dates sont RELATIVES à aujourd'hui**, jamais absolues : *une
        // démonstration datée se périme sans jamais être vide* (§9, 21/08),
        // et une échéance de VGP écrite en dur finirait par dire n'importe
        // quoi. Le jour se lit dans le FUSEAU DE LA SOCIÉTÉ (L0-08).
        const aujourdHuiDate = jourEnDate(
          maintenant(societe.fuseau_horaire).local,
        ) as Date;

        etape(
          `${societe.code} — familles et modèles de matériel : ` +
            `${FAMILLES_MATERIEL_DEMONSTRATION.length} + ` +
            `${MODELES_MATERIEL_DEMONSTRATION.length}`,
        );
        const identifiantsFamilles = new Map<string, string>();
        for (const famille of FAMILLES_MATERIEL_DEMONSTRATION) {
          const familleId = identifiantParc(
            "famille",
            rangSociete,
            famille.rang,
          );
          identifiantsFamilles.set(famille.code, familleId);
          await tx.familleMateriel.upsert({
            where: { id: familleId },
            update: {
              libelle: famille.libelle,
              assujettissement_vgp: famille.assujettissement,
              vgp_periodicite_mois: famille.vgpPeriodiciteMois,
              vgp_reference_texte: famille.vgpReferenceTexte,
            },
            create: {
              id: familleId,
              societe_id: id,
              code: famille.code,
              libelle: famille.libelle,
              assujettissement_vgp: famille.assujettissement,
              vgp_periodicite_mois: famille.vgpPeriodiciteMois,
              vgp_reference_texte: famille.vgpReferenceTexte,
            },
          });
        }

        const identifiantsModeles = new Map<number, string>();
        for (const modele of MODELES_MATERIEL_DEMONSTRATION) {
          const familleId = identifiantsFamilles.get(modele.familleCode);
          if (familleId === undefined) {
            throw new Error(
              `Modèle ${modele.marque} ${modele.reference} : famille « ` +
                `${modele.familleCode} » absente du jeu de démonstration. Un ` +
                "modèle dépend d'une famille et d'une seule ; il n'y a pas de " +
                "valeur par défaut.",
            );
          }
          const modeleId = identifiantParc("modele", rangSociete, modele.rang);
          identifiantsModeles.set(modele.rang, modeleId);
          await tx.modeleMateriel.upsert({
            where: { id: modeleId },
            update: {
              famille_id: familleId,
              periodicite_jours: modele.periodiciteJours,
              vgp_periodicite_mois: modele.vgpPeriodiciteMois,
              vgp_reference_texte: modele.vgpReferenceTexte,
            },
            create: {
              id: modeleId,
              societe_id: id,
              famille_id: familleId,
              marque: modele.marque,
              reference: modele.reference,
              periodicite_jours: modele.periodiciteJours,
              vgp_periodicite_mois: modele.vgpPeriodiciteMois,
              vgp_reference_texte: modele.vgpReferenceTexte,
            },
          });
        }

        etape(
          `${societe.code} — machines de démonstration : ` +
            `${MACHINES_DEMONSTRATION.length}`,
        );
        // **LES MACHINES VONT SUR LES LIEUX OUVERTS, et c'est une image qui l'a
        // dit** *(13/09/2026)*. La première prise de vue montrait deux
        // compresseurs « En service » chez « Ancien client », sur « Ancien
        // chantier (démonstration, inactif) » : *c'est défendable dans la vraie
        // vie — un client parti garde ses machines — et illisible sur une
        // capture*, où l'arbitre du projet lit une contradiction avant de lire
        // un parc. Le jeu de démonstration doit se lire d'un coup d'œil.
        const lieuxOuverts = sitesEcrits.filter((lieu) => lieu.ouvert);
        const identifiantsMachines = new Map<number, string>();
        // LE CLIENT DE CHAQUE MACHINE, pour la même raison que
        // `clientIdParInterventionRang` ci-dessus. Le MODÈLE l'accompagne :
        // c'est ce qui permet, plus bas, de préférer des machines de modèles
        // DIFFÉRENTS pour le cas pluriel — deux exemplaires du même modèle
        // s'affichent sous le même libellé (`machinesAffichees` ne montre
        // jamais le numéro de série), et le cas pluriel se verrait mal s'il
        // montrait deux fois la même chose.
        const clientIdParMachineRang = new Map<number, string>();
        const modeleRangParMachineRang = new Map<number, number>();
        for (const machine of MACHINES_DEMONSTRATION) {
          const lieu = lieuxOuverts[machine.siteRang % lieuxOuverts.length];
          const modeleId = identifiantsModeles.get(machine.modeleRang);
          if (lieu === undefined || modeleId === undefined) {
            throw new Error(
              `Machine ${machine.numeroSerie} : lieu ou modèle absent du jeu ` +
                "de démonstration. Une machine porte QUATRE champs " +
                "obligatoires — modèle, client, site, numéro de série (D6).",
            );
          }
          const machineId = identifiantParc(
            "machine",
            rangSociete,
            machine.rang,
          );
          identifiantsMachines.set(machine.rang, machineId);
          clientIdParMachineRang.set(machine.rang, lieu.clientId);
          modeleRangParMachineRang.set(machine.rang, machine.modeleRang);
          const champsMachine = {
            modele_id: modeleId,
            client_id: lieu.clientId,
            site_id: lieu.siteId,
            reference_interne: machine.referenceInterne,
            localisation: machine.localisation,
            date_mise_en_service:
              machine.miseEnServiceMoisAvant === null
                ? null
                : ajouterMois(aujourdHuiDate, -machine.miseEnServiceMoisAvant),
            statut: machine.statut,
            criticite: machine.criticite,
            complet: machine.complet,
            vgp_exception: machine.vgpException ?? null,
            vgp_exception_motif: machine.vgpExceptionMotif ?? null,
          };
          await tx.machine.upsert({
            where: { id: machineId },
            update: champsMachine,
            create: {
              id: machineId,
              societe_id: id,
              numero_serie: machine.numeroSerie,
              // LE JETON EST TIRÉ AU SORT, et il n'est écrit qu'à la CRÉATION
              // (D71) : *un secret déterministe n'en est pas un*, et le
              // réécrire à chaque semis invaliderait les étiquettes déjà
              // collées sur les machines de la démonstration.
              qr_token: engendrerJetonQr(),
              source_creation: "back_office",
              ...champsMachine,
            },
          });
        }

        // ── QUELQUES INTERVENTIONS PORTENT LEUR MACHINE (audit du 19/09/2026) ──
        //
        // **Mesuré : `intervention_machine` était vide sur les dix-neuf
        // lignes de démonstration**, et la colonne « Machine » de
        // `/interventions` comme le nouveau bloc de sa fiche n'avaient donc
        // jamais été éprouvés avec une donnée non nulle — le tiret s'affichait
        // sur les dix-neuf lignes depuis qu'il existe.
        //
        // `INTERVENTIONS_AVEC_MACHINES_DEMONSTRATION` ne nomme QUE le rang de
        // l'intervention et le NOMBRE de machines à lui donner — jamais un
        // rang de machine en dur : le client d'un rang donné diffère entre
        // CODIMA-NC et CODIMA-EU (nombre de sites différent), et une machine
        // choisie à l'œil pour l'une serait, pour l'autre, celle d'un client
        // différent. Les deux tables ci-dessus donnent le client réel de
        // chaque rang ; celles-ci ne font que les croiser.
        //
        // **Le cas VIDE reste représenté** : la grande majorité des dix-neuf
        // lignes n'apparaît pas dans cette liste, exactement comme en
        // production où RG-INT-01 n'exige aucune machine pour démarrer. Et au
        // moins une entrée en demande PLUSIEURS, pour éprouver le pluriel que
        // `machinesAffichees` (`app/(back-office)/interventions/
        // presentation.ts`) sait déjà joindre par une virgule.
        let machinesRattachees = 0;
        // UN COMPTEUR SÉQUENTIEL, PAS UN CALCUL SUR LE RANG DE L'INTERVENTION
        // (§9, 01/09) : `identifiantParc` réserve cent identifiants par
        // société pour CHAQUE famille (voir sa note de tête), et un rang de
        // dix-neuf multiplié déborderait cette plage. Un simple rang de un à
        // N — la seule chose qui compte pour l'unicité — reste dans la plage
        // quel que soit le rang de l'intervention visée.
        let rangRattachement = 0;
        for (const rattachement of INTERVENTIONS_AVEC_MACHINES_DEMONSTRATION) {
          const interventionId = identifiantIntervention(
            rangSociete,
            rattachement.interventionRang,
          );
          const clientId = clientIdParInterventionRang.get(
            rattachement.interventionRang,
          );
          // L'intervention peut manquer pour CETTE société — même raison que
          // la collision d'identifiants documentée plus haut (§9, 10/09) :
          // rien à rattacher n'est alors PAS une erreur.
          if (clientId === undefined) {
            continue;
          }
          // LES MODÈLES DIFFÉRENTS D'ABORD — un exemplaire par modèle tant
          // qu'il en reste un de nouveau, les doublons de modèle ensuite :
          // sans ce tri, le cas pluriel pourrait montrer deux fois le même
          // libellé (`machinesAffichees` ne distingue pas deux exemplaires
          // d'un même modèle), ce qui se lirait comme une donnée dupliquée
          // plutôt que comme deux machines.
          const candidats = [...clientIdParMachineRang.entries()]
            .filter(([, idClient]) => idClient === clientId)
            .map(([rang]) => rang)
            .sort((a, b) => a - b);
          const modelesVus = new Set<number>();
          const modelesInedits: number[] = [];
          const modelesDejaVus: number[] = [];
          for (const rang of candidats) {
            const modeleRang = modeleRangParMachineRang.get(rang);
            if (modeleRang !== undefined && !modelesVus.has(modeleRang)) {
              modelesVus.add(modeleRang);
              modelesInedits.push(rang);
            } else {
              modelesDejaVus.push(rang);
            }
          }
          const rangsMachinesDuClient = [
            ...modelesInedits,
            ...modelesDejaVus,
          ].slice(0, rattachement.nombreMachines);
          for (const machineRang of rangsMachinesDuClient) {
            const machineId = identifiantsMachines.get(machineRang);
            if (machineId === undefined) {
              continue;
            }
            rangRattachement += 1;
            await tx.interventionMachine.upsert({
              where: {
                intervention_id_machine_id: {
                  intervention_id: interventionId,
                  machine_id: machineId,
                },
              },
              update: {},
              create: {
                id: identifiantParc(
                  "intervention_machine",
                  rangSociete,
                  rangRattachement,
                ),
                societe_id: id,
                intervention_id: interventionId,
                machine_id: machineId,
              },
            });
            machinesRattachees += 1;
          }
        }
        etape(
          `${societe.code} — machines rattachées à des interventions de ` +
            `démonstration : ${machinesRattachees}`,
        );

        etape(
          `${societe.code} — vérifications périodiques reçues : ` +
            `${VERIFICATIONS_VGP_DEMONSTRATION.length}`,
        );
        for (const recue of VERIFICATIONS_VGP_DEMONSTRATION) {
          const machineId = identifiantsMachines.get(recue.machineRang);
          if (machineId === undefined) {
            throw new Error(
              `Vérification ${recue.rang} : machine de rang ` +
                `${recue.machineRang} absente du jeu de démonstration.`,
            );
          }
          const verificationId = identifiantParc(
            "verification",
            rangSociete,
            recue.rang,
          );
          // LA DATE QUI COMPTE EST CELLE DE LA VÉRIFICATION, jamais celle de la
          // saisie (D114) : elle est donc REPLACÉE à chaque semis, comme les
          // créneaux du planning — une démonstration dont les VGP vieillissent
          // finirait par n'afficher que des retards.
          const dateVerification = ajouterMois(
            aujourdHuiDate,
            -recue.moisAvant,
          );
          await tx.vgpVerification.upsert({
            where: { id: verificationId },
            update: {
              machine_id: machineId,
              date_verification: dateVerification,
              organisme: recue.organisme,
              reference_rapport: recue.referenceRapport,
              origine: recue.origine,
            },
            create: {
              id: verificationId,
              societe_id: id,
              machine_id: machineId,
              date_verification: dateVerification,
              organisme: recue.organisme,
              reference_rapport: recue.referenceRapport,
              origine: recue.origine,
            },
          });
        }
      },
      DELAIS_SEED,
    );

    etape(`${societe.code} — transaction cloisonnée : validée`);
  }

  etape(
    `utilisateurs internes — ${pluriel(UTILISATEURS_INTERNES.length, "identité")}`,
  );
  for (const utilisateur of UTILISATEURS_INTERNES) {
    // ── L'IDENTITÉ EST OUVERTE PAR UN ADMINISTRATEUR (L1-02c) ──────────────
    //
    // `utilisateur` porte l'identité globale — pas de `societe_id`, RG-SOC-03 —
    // mais elle est cloisonnée EN BASE depuis L1-02c, et `FORCE ROW LEVEL
    // SECURITY` s'applique au PROPRIÉTAIRE, donc au seed. L'écriture sans
    // contexte était refusée : c'était attendu, pas un imprévu.
    //
    // Le seed fait donc ce que fera l'application — l'ouverture d'une identité
    // est un acte administratif, sous un contexte de société, par un rôle qui
    // administre (matrice §5.2, ligne « Administrer les utilisateurs » :
    // `admin_societe` seul). La société est celle de sa PREMIÈRE habilitation :
    // c'est bien elle qui ouvre le compte.
    //
    // Et l'identité et son habilitation voyagent dans la MÊME transaction : au
    // moment où l'identité est insérée, son habilitation n'existe pas encore —
    // c'est l'ordre des opérations, et c'est pourquoi l'expression d'écriture
    // ne dérive pas de l'expression de lecture.
    const premiere = utilisateur.habilitations[0];
    if (premiere === undefined) {
      throw new Error(
        `Le seed ne peut pas ouvrir l'identité ${utilisateur.email} : aucune ` +
          "habilitation ne dit quelle société l'ouvre. Une identité sans " +
          "habilitation n'a personne pour l'administrer.",
      );
    }
    const societeOuvrante = societeParCode(premiere.societe_code).id;

    const enregistrement = await avecSocieteEtRole(
      prisma,
      societeOuvrante,
      Role.admin_societe,
      (tx) =>
        tx.utilisateur.upsert({
          where: { email: utilisateur.email },
          update: { nom: utilisateur.nom },
          create: {
            id: uuidv7(),
            nom: utilisateur.nom,
            email: utilisateur.email,
          },
        }),
      DELAIS_SEED,
    );

    await poserLeMoyenDeConnexionAuRepos(prisma, enregistrement.id);

    for (const habilitation of utilisateur.habilitations) {
      const societeId = societeParCode(habilitation.societe_code).id;

      await avecSociete(
        prisma,
        societeId,
        (tx) =>
          tx.utilisateurSociete.upsert({
            where: {
              utilisateur_id_societe_id: {
                utilisateur_id: enregistrement.id,
                societe_id: societeId,
              },
            },
            update: { role: habilitation.role },
            create: {
              id: uuidv7(),
              utilisateur_id: enregistrement.id,
              societe_id: societeId,
              role: habilitation.role,
            },
          }),
        DELAIS_SEED,
      );
    }
  }

  etape(`comptes portail — ${pluriel(COMPTES_PORTAIL.length, "rattachement")}`);
  for (const compte of COMPTES_PORTAIL) {
    // Même acte administratif : un compte de portail est DÉLIVRÉ par la société
    // à son client, il ne s'auto-crée pas.
    const societeOuvrante = societeParCode(compte.societe_code).id;
    const utilisateur = await avecSocieteEtRole(
      prisma,
      societeOuvrante,
      Role.admin_societe,
      (tx) =>
        tx.utilisateur.upsert({
          where: { email: compte.email },
          update: { nom: compte.nom },
          create: { id: uuidv7(), nom: compte.nom, email: compte.email },
        }),
      DELAIS_SEED,
    );

    // Un compte portail a la même porte que les autres : celle qui n'existe
    // pas tant que personne n'a choisi de mot de passe.
    await poserLeMoyenDeConnexionAuRepos(prisma, utilisateur.id);

    const societeId = societeParCode(compte.societe_code).id;

    await avecSociete(
      prisma,
      societeId,
      (tx) =>
        tx.utilisateurClient.upsert({
          where: {
            utilisateur_id_client_id: {
              utilisateur_id: utilisateur.id,
              client_id: compte.client_id,
            },
          },
          // Le périmètre est une TABLE depuis L1-02b : il s'écrit ci-dessous,
          // pas ici. `perimetre_sites` n'existe plus — PostgreSQL 16 ne savait
          // pas contraindre les éléments d'un tableau, si bien que la colonne
          // acceptait un site inexistant ou d'une autre société.
          update: {},
          create: {
            id: uuidv7(),
            utilisateur_id: utilisateur.id,
            client_id: compte.client_id,
            societe_id: societeId,
          },
        }),
      DELAIS_SEED,
    );

    // Le périmètre, réécrit en entier à chaque amorçage : le seed est
    // idempotent, et un périmètre partiellement à jour serait un périmètre
    // ÉLARGI ou RÉTRÉCI sans que personne l'ait demandé. Deux allers-retours,
    // et le second ne part que s'il y a quelque chose à écrire.
    const habilitation = await avecSociete(
      prisma,
      societeId,
      (tx) =>
        tx.utilisateurClient.findUniqueOrThrow({
          where: {
            utilisateur_id_client_id: {
              utilisateur_id: utilisateur.id,
              client_id: compte.client_id,
            },
          },
          select: { id: true },
        }),
      DELAIS_SEED,
    );

    await avecSociete(
      prisma,
      societeId,
      (tx) =>
        tx.utilisateurClientSite.deleteMany({
          where: { utilisateur_client_id: habilitation.id },
        }),
      DELAIS_SEED,
    );

    if (compte.perimetre_sites.length > 0) {
      await avecSociete(
        prisma,
        societeId,
        (tx) =>
          tx.utilisateurClientSite.createMany({
            data: compte.perimetre_sites.map((site_id) => ({
              id: uuidv7(),
              societe_id: societeId,
              utilisateur_client_id: habilitation.id,
              site_id,
            })),
          }),
        DELAIS_SEED,
      );
    }
  }

  // ── 9. L'AFFECTATION DES INTERVENTIONS AUX TECHNICIENS (R2-12) ───────────
  //
  // **Pourquoi ici, et pas au moment où les interventions sont écrites.** Les
  // identités sont créées APRÈS les sociétés, donc après les interventions :
  // au moment où celles-ci sont posées, aucun technicien n'existe encore. Les
  // affecter demande une seconde passe, et la voici.
  //
  // **Ce que cette passe RATTRAPE.** Le semis s'abstient de réécrire une
  // intervention déjà présente — un verrou de cycle de vie refuse de toucher
  // une ligne close (D84) — donc la date et le créneau posés à la création ne
  // savent pas encore quel technicien affecter : les identités naissent après
  // les interventions. Cette passe recalcule la date depuis LA MÊME VALEUR de
  // `LUNDI_DEMONSTRATION` que la création a lue plus haut dans CETTE exécution
  // du semis (SEMIS-2) — le module n'est chargé qu'une fois, la constante est
  // donc figée pour tout le processus — et y ajoute le technicien. *Ce n'est
  // pas une seconde lecture d'« aujourd'hui » qui pourrait diverger de la
  // première* : les deux passes partagent le même lundi, calculé une seule
  // fois (voir `LUNDI_DEMONSTRATION`, `prisma/seed-data.ts`).
  //
  // La passe ne touche donc QUE les interventions non terminales — celles que
  // le verrou laisse modifier. Les closes gardent leur date, ce qui est juste :
  // une intervention clôturée l'a été un jour précis.
  etape("affectation des interventions aux techniciens");
  for (const [indexSociete, societe] of SOCIETES.entries()) {
    const rangSociete = indexSociete + 1;
    const societeId = societeParCode(societe.code).id;
    const lundi = LUNDI_DEMONSTRATION;

    // Les identités des techniciens, lues sous le contexte de la société. La
    // politique de `utilisateur` autorise cette lecture depuis L1-02c — sa
    // branche « rattachement » —, et c'est le même droit que l'écran emploie.
    const parCourriel = new Map<string, string>();
    for (const interne of UTILISATEURS_INTERNES) {
      const ligne = await avecDesignationAuth(prisma).utilisateur.findUnique({
        where: { email: interne.email },
        select: { id: true },
      });
      if (ligne !== null) parCourriel.set(interne.email, ligne.id);
    }

    const affectees = await avecSociete(
      prisma,
      societeId,
      async (tx) => {
        // **LE FILTRE SOCIÉTÉ EST EXPLICITE**, en plus du contexte RLS posé par
        // `avecSociete` — CLAUDE.md §5.6, et ce n'est pas une précaution
        // rituelle : *en local, le rôle de migration est superutilisateur et
        // CONTOURNE la RLS* (§9, 07/09). Mesuré à L3-01a, sur la base de test
        // qui porte aussi les fixtures d'isolation : cette lecture rendait
        // l'agence `SIEGE` d'une AUTRE société pendant le semis de la
        // première, et la clé étrangère de `technicien` l'a refusée. *Le
        // contexte ne filtrait rien, et rien ne le disait tant que le résultat
        // ne servait qu'à une table de correspondance.*
        const agences = await tx.agence.findMany({
          where: { societe_id: societeId },
          select: { id: true, code: true },
        });
        const codeParAgence = new Map(agences.map((a) => [a.id, a.code]));

        // LE RATTACHEMENT DES TECHNICIENS À LEUR AGENCE (L3-01a).
        //
        // `TECHNICIENS_PAR_AGENCE` portait ce fait **sans avoir où l'écrire** :
        // il servait à affecter les interventions, et disparaissait ensuite.
        // La table `technicien` lui donne enfin une maison — et c'est elle que
        // D12 et D13 lisent pour la majoration hors ouverture et pour le
        // calendrier de détection de conflit.
        //
        // *Le seed ne réécrit pas : il pose ce qui manque.* Une ligne déjà
        // présente a pu être changée à l'écran, et la ramener au défaut
        // effacerait une décision d'exploitation.
        for (const agence of agences) {
          for (const courriel of TECHNICIENS_PAR_AGENCE[agence.code] ?? []) {
            const utilisateurId = parCourriel.get(courriel);
            if (utilisateurId === undefined) continue;
            await tx.technicien.upsert({
              where: {
                societe_id_utilisateur_id: {
                  societe_id: societeId,
                  utilisateur_id: utilisateurId,
                },
              },
              create: {
                // `id` est une clé TECHNIQUE exigée par le journal d'audit
                // (I10) ; la clé métier reste le couple. Un UUID v7 ici comme
                // partout : il est ordonné dans le temps.
                id: uuidv7(),
                societe_id: societeId,
                utilisateur_id: utilisateurId,
                agence_id: agence.id,
              },
              update: {},
            });
          }
        }

        const rangParId = new Map(
          INTERVENTIONS_DEMONSTRATION.map((modele, index) => [
            identifiantIntervention(rangSociete, modele.rang),
            { modele, index },
          ]),
        );

        let compte = 0;
        const lignes = await tx.intervention.findMany({
          select: {
            id: true,
            statut: true,
            agence_id: true,
            // LES QUATRE COLONNES DE SUSPENSION — lues pour être PRÉSERVÉES
            // si la ligne est déjà suspendue en base. Voir le commentaire
            // au-dessus du replacement.
            motif_suspension: true,
            piece_attendue_ref: true,
            date_dispo_prevue: true,
            suspendue_le: true,
          },
        });
        for (const ligne of lignes) {
          const trouve = rangParId.get(ligne.id);
          if (trouve === undefined) continue;
          if (STATUTS_TERMINAUX.has(ligne.statut)) continue;

          const equipe =
            TECHNICIENS_PAR_AGENCE[codeParAgence.get(ligne.agence_id) ?? ""] ??
            [];
          // Une agence sans équipe garde ses interventions NON AFFECTÉES, et
          // la ligne « non affectées » reste ainsi démontrable : une
          // intervention arrive parfois avant qu'on sache qui ira.
          const courriel =
            equipe.length === 0
              ? undefined
              : equipe[trouve.index % equipe.length];
          const jour =
            trouve.modele.joursDepuisLundi === null
              ? null
              : jourSuivant(lundi, trouve.modele.joursDepuisLundi);

          await tx.intervention.update({
            where: { id: ligne.id },
            data: {
              technicien_id:
                courriel === undefined
                  ? null
                  : (parCourriel.get(courriel) ?? null),
              date_planifiee: jourEnDate(jour),
              creneau_debut: instantDuCreneau(
                jour,
                trouve.modele.debutMinutes,
                societe.fuseau_horaire,
              ),
              creneau_fin: instantDuCreneau(
                jour,
                trouve.modele.debutMinutes === null ||
                  trouve.modele.dureeMin === null
                  ? null
                  : trouve.modele.debutMinutes + trouve.modele.dureeMin,
                societe.fuseau_horaire,
              ),
              // ── LES QUATRE COLONNES DE SUSPENSION (D104) ─────────────────
              //
              // **Elles manquaient ici, et le semis échouait en `23514`**
              // *(mesuré le 12/09/2026, étape « Exécuter le seed »)*. Une
              // intervention `suspendue` créée par un semis d'AVANT L2-10 n'a
              // ni motif ni date — le semis s'abstient de réécrire une ligne
              // déjà présente —, et les contraintes `NOT VALID` de D104
              // n'exigent rien des lignes d'avant **mais tout de celles qu'on
              // TOUCHE**. Ce replacement les touchait sans les mettre en règle.
              //
              // *Ce n'était pas un défaut de D104 : c'était D104 qui
              // fonctionne.* Une écriture neuve doit respecter la règle.
              //
              // `suspendue_le` suit le créneau RECALCULÉ juste au-dessus, et
              // c'est voulu : la suspension est datée au début du créneau, et
              // un créneau qui se déplace déplace l'âge de l'attente avec lui.
              // **LE STATUT VIENT DE LA BASE, PAS DU MODÈLE** *(mesuré le
              // 13/09/2026)*. Le semis a échoué en `23514` sur
              // `intervention_piece_attendue_suppose_la_suspension` : la ligne
              // portait `a_planifier` en base — un écran l'avait reprise —
              // pendant que le modèle la dit `suspendue`, et le replacement
              // écrivait le motif et la référence de pièce SUR une ligne qui
              // n'est plus suspendue. *Deux sources pour un même fait, et la
              // contrainte a dit laquelle des deux la ligne porte.*
              //
              // Ce replacement ne touche jamais au statut — *le semis ne
              // réécrit pas, il pose ce qui manque* —, donc c'est le statut de
              // la BASE qui décide, et `null` dit « pas suspendue ».
              //
              // **ET QUAND LA BASE DIT « SUSPENDUE », CE SONT SES PROPRES
              // COLONNES QUI DÉCIDENT — PLUS LE MODÈLE** *(mesuré le
              // 16/09/2026, « DB migrate & seed » #62)*. La ligne de rang 14
              // (`…-000000000014`) porte `suspendue` en base — une main réelle
              // l'a suspendue depuis l'écran, motif compris — alors que le
              // modèle ne décrit plus cette ligne comme suspendue depuis
              // 69022fb (D109) : `trouve.modele.motifSuspension` vaut
              // `undefined`, et l'ancien replacement en tirait quatre `null`
              // sur une ligne que la base dit toujours suspendue. *Le motif
              // était réel, en base, et le replacement l'effaçait avec ce
              // qu'il ne sait pas.*
              //
              // Le principe du paragraphe ci-dessus va plus loin que le seul
              // statut : la base a déjà tout dit d'une ligne suspendue —
              // motif, référence de pièce, disponibilité, ET DATE DE
              // SUSPENSION —, et le modèle de démonstration n'a plus besoin
              // de les redire ni le DROIT de les corriger.
              //
              // **`suspendue_le` N'EST PLUS RECALCULÉ ICI** *(revu en revue,
              // #212)* : une première version le faisait suivre le créneau
              // RECALCULÉ juste au-dessus, au nom du commentaire du 13/09 sur
              // « un créneau qui se déplace déplace l'âge de l'attente avec
              // lui » — vrai pour la ligne de DÉMONSTRATION (rang 11), dont
              // le modèle DIT `suspendue` et dont l'âge n'a jamais d'autre
              // source que ce créneau. Faux pour une ligne suspendue DEPUIS
              // L'ÉCRAN : `suspendreIntervention` (lib/interventions/depot.ts)
              // pose `suspendue_le` à l'instant RÉEL de la suspension, sans
              // rapport avec le créneau, et c'est cette date que
              // `joursEcoules` lit pour l'alerte « en attente depuis > 30
              // jours » du chapitre 16.1. La faire suivre le créneau que le
              // replacement recalcule chaque semaine aurait remis l'attente à
              // zéro — ou à une date FUTURE — à chaque semis, et c'est
              // exactement la même faute que celle réparée pour les trois
              // autres colonnes : le modèle qui parle à la place de la base.
              ...(ligne.statut === "suspendue"
                ? {
                    motif_suspension: ligne.motif_suspension,
                    piece_attendue_ref: ligne.piece_attendue_ref,
                    date_dispo_prevue: ligne.date_dispo_prevue,
                    suspendue_le: ligne.suspendue_le,
                  }
                : colonnesDeSuspension(null, null, null)),
            },
          });
          compte += 1;
        }
        return compte;
      },
      DELAIS_SEED,
    );
    etape(`${societe.code} — interventions replacées : ${affectees}`);
  }

  // ── 10. LE FORFAIT ET LE LOT D'IMPORT DE DÉMONSTRATION (SEMIS-2, #266) ──
  //
  // Deux écrans n'avaient AUCUNE ligne au semis — `/parametres/forfaits/[id]`
  // et `/imports/[id]` — et `tests/e2e/tous-les-ecrans-rendent.spec.ts` les
  // `test.skip` faute de donnée. Une ligne minimale de chaque, sur CODIMA-NC
  // (la société du compte `admin_societe` que ce fichier ouvre), leur en
  // donne une. Voir `FORFAITS_DEMONSTRATION` et `LOTS_IMPORT_DEMONSTRATION`,
  // `prisma/seed-data.ts`, pour ce qu'elles portent et pourquoi elles ne
  // participent pas à la transaction cloisonnée ci-dessus.
  etape("forfait et lot d'import de démonstration");
  {
    const societeNC = societeParCode("CODIMA-NC");
    const rangSocieteNC =
      SOCIETES.findIndex((societe) => societe.code === "CODIMA-NC") + 1;

    for (const forfait of FORFAITS_DEMONSTRATION) {
      const forfaitId = identifiantParc("forfait", rangSocieteNC, forfait.rang);
      await avecSociete(
        prisma,
        societeNC.id,
        (tx) =>
          tx.forfait.upsert({
            where: { id: forfaitId },
            update: {
              code: forfait.code,
              libelle: forfait.libelle,
              type: forfait.type,
              rang: forfait.rangApplication,
              montant_mineur: forfait.montant_mineur,
              cumulable_temps: forfait.cumulable_temps,
            },
            create: {
              id: forfaitId,
              societe_id: societeNC.id,
              code: forfait.code,
              libelle: forfait.libelle,
              type: forfait.type,
              rang: forfait.rangApplication,
              montant_mineur: forfait.montant_mineur,
              devise_code: societeNC.devise_code,
              // SANS CONDITION D'APPLICATION — voir la note de tête de
              // `FORFAITS_DEMONSTRATION` : omis plutôt que `[]`, exactement
              // comme `lib/tarification/depot-forfaits.ts` le fait pour une
              // saisie sans zone ni type (la base refuse `'{}'`, `NULL` seul
              // est accepté).
              famille_id: null,
              cumulable_temps: forfait.cumulable_temps,
            },
          }),
        DELAIS_SEED,
      );
    }

    for (const lot of LOTS_IMPORT_DEMONSTRATION) {
      const importeur = await avecDesignationAuth(
        prisma,
      ).utilisateur.findUnique({
        where: { email: lot.utilisateur_email },
        select: { id: true },
      });
      if (importeur === null) {
        throw new Error(
          `Lot d'import de démonstration ${lot.rang} : identité ` +
            `${lot.utilisateur_email} introuvable — elle doit être ouverte ` +
            "par UTILISATEURS_INTERNES avant cette étape.",
        );
      }
      const lotId = identifiantParc("import_lot", rangSocieteNC, lot.rang);
      await avecSociete(
        prisma,
        societeNC.id,
        (tx) =>
          tx.importLot.upsert({
            where: { id: lotId },
            update: {
              type_import: lot.type_import,
              version_modele: lot.version_modele,
              nom_fichier: lot.nom_fichier,
              utilisateur_id: importeur.id,
            },
            create: {
              id: lotId,
              societe_id: societeNC.id,
              type_import: lot.type_import,
              version_modele: lot.version_modele,
              utilisateur_id: importeur.id,
              nom_fichier: lot.nom_fichier,
            },
          }),
        DELAIS_SEED,
      );
    }
  }

  etape("terminé");
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (erreur: unknown) => {
    await prisma.$disconnect();
    throw erreur;
  });
