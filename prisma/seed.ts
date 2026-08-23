import { PrismaClient } from "@prisma/client";

import { avecSociete } from "../lib/db/rls";
import { uuidv7 } from "../lib/db/uuid";
import {
  COMPTES_PORTAIL,
  DEVISES,
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
 */
const prisma = new PrismaClient();

async function seed(): Promise<void> {
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
    const { id, agences, calendriers, ...champsSociete } = societe;

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

    for (const territoire of territoires) {
      for (const annee of anneesFeries(anneeDeDepart)) {
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
    await avecSociete(prisma, id, async (tx) => {
      await tx.societe.upsert({
        where: { id },
        update: champsSociete,
        create: { id, ...champsSociete },
      });

      // Les calendriers AVANT les agences : `agence.calendrier_id` les
      // référence, et la clé étrangère posée par la migration L0-08 refuserait
      // l'ordre inverse. Un calendrier ne porte que des HEURES — le territoire
      // et les écarts appartiennent à l'agence (D46, compléments 1 et 2).
      const identifiants = new Map<string, string>();

      for (const calendrier of calendriers) {
        const enregistre = await tx.calendrier.upsert({
          where: { societe_id_code: { societe_id: id, code: calendrier.code } },
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

          await tx.calendrierFerie.upsert({
            where: {
              agence_id_date: { agence_id: enregistree.id, date },
            },
            update: {
              travaille: ecart.travaille,
              motif: ecart.motif,
              jour_ferie_id: ferie?.id ?? null,
            },
            create: {
              id: uuidv7(),
              societe_id: id,
              agence_id: enregistree.id,
              date,
              jour_ferie_id: ferie?.id ?? null,
              travaille: ecart.travaille,
              motif: ecart.motif,
            },
          });
        }
      }
    });
  }

  for (const utilisateur of UTILISATEURS_INTERNES) {
    // `utilisateur` porte l'identité globale : pas de `societe_id`, pas de
    // cloisonnement (sa visibilité relève de l'authentification, L0-06).
    const enregistrement = await prisma.utilisateur.upsert({
      where: { email: utilisateur.email },
      update: { nom: utilisateur.nom },
      create: { id: uuidv7(), nom: utilisateur.nom, email: utilisateur.email },
    });

    for (const habilitation of utilisateur.habilitations) {
      const societeId = societeParCode(habilitation.societe_code).id;

      await avecSociete(prisma, societeId, (tx) =>
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
      );
    }
  }

  for (const compte of COMPTES_PORTAIL) {
    const utilisateur = await prisma.utilisateur.upsert({
      where: { email: compte.email },
      update: { nom: compte.nom },
      create: { id: uuidv7(), nom: compte.nom, email: compte.email },
    });

    const societeId = societeParCode(compte.societe_code).id;

    await avecSociete(prisma, societeId, (tx) =>
      tx.utilisateurClient.upsert({
        where: {
          utilisateur_id_client_id: {
            utilisateur_id: utilisateur.id,
            client_id: compte.client_id,
          },
        },
        update: { perimetre_sites: compte.perimetre_sites },
        create: {
          id: uuidv7(),
          utilisateur_id: utilisateur.id,
          client_id: compte.client_id,
          societe_id: societeId,
          perimetre_sites: compte.perimetre_sites,
        },
      }),
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
