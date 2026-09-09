import { Prisma, PrismaClient } from "@prisma/client";

import { Role } from "../lib/auth/roles";
import { cleJour, instantAMinutes, maintenant } from "../lib/calendar";
import { avecSociete, avecSocieteEtRole } from "../lib/db/rls";
import { uuidv7 } from "../lib/db/uuid";
import {
  DELAIS_SEED,
  DUREE_MAXIMALE_MS,
  allersRetoursTransaction,
} from "./seed-delais";
import {
  COMPTES_PORTAIL,
  DEVISES,
  HABILITATION_EXIGEE_DEMONSTRATION,
  HABILITATIONS_AMORCAGE,
  PARITES,
  PLANNING_DEMONSTRATION,
  SOCIETES,
  TECHNICIENS_DEMONSTRATION,
  TEMPS_DEMONSTRATION,
  UTILISATEURS_INTERNES,
  anneeDeDepartFeries,
  ecartsDeLAgence,
  feriesDuTerritoire,
  anneesFeries,
  societeParCode,
} from "./seed-data";

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
 * Le drapeau qui fait sauter les identités de démonstration.
 *
 * Il sert UN ordre et un seul, et cet ordre est écrit au README :
 *
 *     pnpm db:migrate
 *     SEED_SANS_IDENTITES=oui pnpm db:seed     # sociétés, référentiels, parc
 *     …amorçage du premier compte (geste d'exploitation, D65)…
 *     pnpm db:seed                             # les identités et le planning
 *
 * Sans lui, la base neuve n'a aucun compte connectable et la porte d'amorçage
 * est déjà refermée. Voir le bloc explicatif à l'endroit où il agit.
 */
export const VARIABLE_SANS_IDENTITES = "SEED_SANS_IDENTITES";

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

  for (const societe of SOCIETES) {
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
          client.sites.map((site) => ({ site, clientId: client.id })),
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
      },
      DELAIS_SEED,
    );

    etape(`${societe.code} — transaction cloisonnée : validée`);
  }

  if (process.env[VARIABLE_SANS_IDENTITES] === "oui") {
    // ── LA PORTE D'AMORÇAGE, ET POURQUOI CE DRAPEAU EXISTE ────────────────
    //
    // **Mesuré le 11/09/2026 : un `pnpm db:seed` sur une base neuve laisse une
    // base sans AUCUN compte connectable.** Les identités de démonstration
    // sont écrites — quatre `utilisateur`, cinq `utilisateur_societe` — mais
    // aucune ne porte de moyen de connexion : ouvrir un compte est un acte
    // administratif (D65), pas une ligne de seed. Et leur seule présence
    // REFERME la porte : `ouvrirPremierCompte` refuse dès qu'une société porte
    // une habilitation, ce qui est exactement le cliquet voulu.
    //
    // Les deux règles sont justes ; c'est leur RENCONTRE qui bloque, et elle ne
    // se voit qu'en essayant de se connecter. Le drapeau ouvre l'ordre qui
    // manquait — semer, amorcer, re-semer — **sans toucher au cliquet et sans
    // qu'aucun compte ne s'ouvre ici** : ouvrir un compte reste un geste qui
    // appartient à l'exploitation.
    etape(`identités de démonstration : PASSÉES (${VARIABLE_SANS_IDENTITES})`);
    etape("terminé");
    return;
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

  // ── LE PLANNING DE DÉMONSTRATION (L2-11) ───────────────────────────────
  //
  // Il vient EN DERNIER, et l'ordre est une contrainte de la base :
  // `technicien` porte une clé étrangère composite vers `utilisateur_societe`,
  // et `intervention` en porte cinq — client, site, agence, technicien,
  // forfait. Rien de tout cela n'existe avant les sections ci-dessus.
  //
  // **Les heures sont relatives à AUJOURD'HUI**, dans le fuseau de la société.
  // Une date figée rendrait l'écran vide dès le lendemain — et personne ne le
  // verrait avant de l'ouvrir. C'est la leçon de D46 appliquée à un jeu
  // d'essai : *une donnée datée se périme en silence.*
  await semerLePlanning();

  etape("terminé");
}

/**
 * Techniciens, exigence de site et interventions du jour, pour la société XPF.
 *
 * **Ce jeu existe pour que l'écran PROUVE quelque chose**, pas pour qu'il soit
 * rempli : les cinq natures de bloc y sont, dont le refus d'affectation, qui
 * est ce que le planning doit savoir faire de plus difficile (D73).
 */
async function semerLePlanning(): Promise<void> {
  const societe = societeParCode("CODIMA-NC");
  const fuseau = societe.fuseau_horaire;
  const jour = maintenant(fuseau).local;

  etape(
    `planning de démonstration — ${pluriel(PLANNING_DEMONSTRATION.length, "intervention")}`,
  );

  const identifiants = new Map<string, string>();

  for (const technicien of TECHNICIENS_DEMONSTRATION) {
    const enregistre = await avecSociete(
      prisma,
      societe.id,
      async (tx) => {
        const membre = await tx.utilisateur.findUnique({
          where: { email: technicien.email },
          select: { id: true },
        });
        if (membre === null) {
          return null;
        }
        const agence = await tx.agence.findFirst({
          where: { code: technicien.agence_code },
          select: { id: true, calendrier_id: true },
        });
        if (agence === null) {
          return null;
        }
        return { utilisateurId: membre.id, agence };
      },
      DELAIS_SEED,
    );

    if (enregistre === null) {
      continue;
    }

    // L'EXCEPTION d'horaires de D72 : le second technicien reçoit le
    // calendrier de l'AUTRE agence, ce qui suffit à rendre la surcharge
    // visible à l'écran sans inventer un troisième calendrier.
    const calendrierPropre = technicien.calendrier_propre
      ? await avecSociete(
          prisma,
          societe.id,
          (tx) =>
            tx.calendrier.findFirst({
              where: { id: { not: enregistre.agence.calendrier_id ?? "" } },
              select: { id: true },
            }),
          DELAIS_SEED,
        )
      : null;

    await avecSociete(
      prisma,
      societe.id,
      (tx) =>
        tx.technicien.upsert({
          where: { id: technicien.id },
          update: {
            agence_id: enregistre.agence.id,
            calendrier_id: calendrierPropre?.id ?? null,
          },
          create: {
            id: technicien.id,
            societe_id: societe.id,
            utilisateur_id: enregistre.utilisateurId,
            agence_id: enregistre.agence.id,
            calendrier_id: calendrierPropre?.id ?? null,
          },
        }),
      DELAIS_SEED,
    );
    identifiants.set(technicien.email, technicien.id);
  }

  if (identifiants.size === 0) {
    return;
  }

  // L'EXIGENCE qui fait le refus. Elle est posée sur le site de l'atelier, et
  // le second technicien ne détient pas cette habilitation : l'affectation est
  // BLOQUÉE (RG-PLA-04), et l'écran l'affiche à sa place avec sa raison.
  await avecSociete(
    prisma,
    societe.id,
    async (tx) => {
      const habilitation = await tx.habilitation.findFirst({
        where: { code: HABILITATION_EXIGEE_DEMONSTRATION },
        select: { id: true },
      });
      if (habilitation === null) {
        return;
      }
      await tx.siteHabilitationRequise.upsert({
        where: {
          societe_id_site_id_habilitation_id: {
            societe_id: societe.id,
            site_id: PLANNING_DEMONSTRATION[3].site_id,
            habilitation_id: habilitation.id,
          },
        },
        update: { bloquant: true },
        create: {
          id: uuidv7(),
          societe_id: societe.id,
          site_id: PLANNING_DEMONSTRATION[3].site_id,
          habilitation_id: habilitation.id,
          bloquant: true,
        },
      });
    },
    DELAIS_SEED,
  );

  for (const bloc of PLANNING_DEMONSTRATION) {
    const technicienId =
      identifiants.get(TECHNICIENS_DEMONSTRATION[bloc.technicien].email) ??
      null;
    if (technicienId === null) {
      continue;
    }

    const debut = instantAMinutes(jour, bloc.debut_minutes, fuseau);
    const fin = new Date(debut.getTime() + bloc.duree_minutes * 60_000);

    await avecSociete(
      prisma,
      societe.id,
      async (tx) => {
        const site = await tx.site.findFirst({
          where: { id: bloc.site_id },
          select: { agence_id: true },
        });
        if (site === null) {
          return;
        }
        const champs = {
          client_id: bloc.client_id,
          site_id: bloc.site_id,
          agence_id: site.agence_id,
          type: bloc.type,
          libelle: bloc.libelle,
          date_planifiee: new Date(`${cleJour(jour)}T00:00:00.000Z`),
          creneau_debut: debut,
          creneau_fin: fin,
          duree_estimee_min: bloc.duree_minutes,
          technicien_referent_id: technicienId,
          mode_valorisation: bloc.mode_valorisation,
          statut_facturation: bloc.statut_facturation,
          statut: "planifiee" as const,
          devise_code: societe.devise_code,
        };
        await tx.intervention.upsert({
          where: { id: bloc.id },
          update: champs,
          create: { id: bloc.id, societe_id: societe.id, ...champs },
        });
      },
      DELAIS_SEED,
    );
  }

  // LE TEMPS POINTÉ. Il vient après les interventions — `intervention_temps`
  // est la table FILLE, et sa politique de forme « filiation » exige que le
  // parent soit visible pour que la ligne le soit (D82).
  //
  // Le TAUX HORAIRE est figé sur l'intervention au moment où le temps est
  // pointé (RG-TAR-04) : c'est ce geste-là qui rend la fiche lisible, et le
  // rappeler à la lecture donnerait une facture qui change avec le tarif.
  const taux = await avecSociete(
    prisma,
    societe.id,
    (tx) =>
      tx.tauxHoraire.findFirst({
        orderBy: { date_effet: "desc" },
        select: { montant_mineur: true },
      }),
    DELAIS_SEED,
  );

  for (const temps of TEMPS_DEMONSTRATION) {
    const bloc = PLANNING_DEMONSTRATION[temps.bloc];
    const technicienId = TECHNICIENS_DEMONSTRATION[bloc.technicien].id;
    const debutBloc = instantAMinutes(jour, bloc.debut_minutes, fuseau);
    const debut = new Date(
      debutBloc.getTime() + temps.decalage_minutes * 60_000,
    );
    const fin = new Date(debut.getTime() + temps.duree_minutes * 60_000);

    await avecSociete(
      prisma,
      societe.id,
      async (tx) => {
        const champs = {
          intervention_id: bloc.id,
          technicien_id: technicienId,
          type: temps.type,
          debut,
          fin,
          duree_min: temps.duree_minutes,
          facturable: temps.facturable,
        };
        await tx.interventionTemps.upsert({
          where: { id: temps.id },
          update: champs,
          create: { id: temps.id, societe_id: societe.id, ...champs },
        });
        if (taux !== null) {
          await tx.intervention.update({
            where: { id: bloc.id },
            data: { taux_horaire_applique: taux.montant_mineur },
          });
        }
      },
      DELAIS_SEED,
    );
  }
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (erreur: unknown) => {
    await prisma.$disconnect();
    throw erreur;
  });
