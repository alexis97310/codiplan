import type { Metadata } from "next";

import Link from "next/link";
import { Page } from "@/components/mise-en-page/page";
import { OptionsAgence } from "@/components/agences/options";
import {
  ActionPrimaire,
  BarreActionCollee,
  LienPrimaire,
} from "@/components/ui/action-primaire";
import { BlocATraiter, type LigneATraiter } from "@/components/ui/a-traiter";
import { BandeauMotif } from "@/components/ui/bandeau-motif";
import { BandeauEtat } from "@/components/ui/bandeau-etat";
import { Badge, type TonBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColonneContexte } from "@/components/ui/colonne-contexte";
import { EnTeteFiche, type FaitFiche } from "@/components/ui/entete-fiche";
import { RefusAcces } from "@/components/ui/refus-acces";
import { Cellule, Tableau } from "@/components/ui/tableau";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { z } from "zod";

import { agencesProposables } from "@/lib/agences/proposables";
import type { ContexteSession } from "@/lib/auth/contexte";
import { peut } from "@/lib/auth/habilitations";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { destinataireClient } from "@/lib/avertissements/planification";
import { contactsDuClient, contactsDuSite } from "@/lib/contacts/depot";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  exigencesDuSite,
  listerHabilitations,
  type LigneExigence,
} from "@/lib/habilitations/depot";
import { formatAdresseSite } from "@/lib/interventions/bon";
import { estUuid } from "@/lib/identifiant";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  dernieresInterventionsDuSite,
  derniereInterventionDuSite,
  interventionsATraiterDuSite,
  interventionsOuvertesDuSite,
  type LigneIntervention,
  type LignePlanning,
} from "@/lib/interventions/depot";
import {
  donneesMaterielDesMachines,
  equipementsActifsDuSite,
  EQUIPEMENTS_PAR_PAGE_SITE,
  type LigneEquipementSite,
} from "@/lib/machines/depot";
import { libelleMaterielComplet } from "@/lib/machines/presentation";
import {
  lireCatalogueTrajets,
  libellesDesSites,
  lireSite,
} from "@/lib/sites/depot";
import { resoudreTempsTrajet } from "@/lib/sites/trajet-zone";
import { ZONES_GEOGRAPHIQUES } from "@/lib/sites/zones";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT } from "@/lib/theme/statuts";
import { libelleEcheance, libelleEtatCourt, tonEtat } from "@/lib/vgp/libelles";
import {
  enregistrementPropose,
  lignesVgpSoumisesDuSite,
  prochaineEcheanceDuSite,
  type LigneDeRegistre,
  type SyntheseVgpSite,
} from "@/lib/vgp/registre";

import { Pagination } from "@/components/ui/pagination";

import {
  BlocContacts,
  saisieContactGardeeDepuis,
} from "../../contacts/presentation";
import {
  decompte,
  hrefDeLaPage,
  libellePage,
  libelleDestinataireCourriels,
  ouTiret,
} from "../../presentation";
import {
  machinesIdentifiees,
  referenceAffichee,
} from "../../interventions/presentation";
import {
  alerteClientInactifDuSite,
  horairesAffiches,
  libelleBadgeSousContrat,
  libelleRattachement,
  libelleSiteCree,
  libelleZone,
  titreMachinesDuSite,
  titreVgpDuSite,
  videContactsSite,
  videEquipementsSite,
  videInterventionsSite,
} from "../presentation";

/**
 * LA FICHE D'UN LIEU D'INTERVENTION, AU GABARIT DU 28/09 (9EF-TP-UX4-2-
 * FICHES-1, D191) — en-tête à faits, consignes en bandeau, deux colonnes,
 * formulaire derrière « Modifier » (`?edition=site`).
 *
 * ## CE QUI N'A PAS CHANGÉ
 *
 * Aucune règle de gestion, aucun droit, aucune route POST. Le refus de D56
 * (rattachement changé sans revoir le trajet) reste rendu par le même
 * formulaire, désormais derrière `?edition=site` plutôt que toujours ouvert.
 * `lireSite` lit sous le contexte cloisonné (D35, D50). Les exigences
 * d'habilitation (ÉQUIPE-2), les interlocuteurs du SEUL site (CONTACTS-1) et
 * l'historique borné à douze (HISTORIQUE-SITE-1) sont inchangés.
 */

/** Combien d'interventions la fiche montre. Une borne d'affichage, jamais un cloisonnement. */
const INTERVENTIONS_MONTREES = 12;
/** La borne du bloc « À traiter » (décision 26 d'Alexis, 05/10/2026 — même borne que la fiche client). */
const BORNE_A_TRAITER = 5;
/** La borne des lignes VGP du site (décision validée par Alexis le 10/10/2026 — même borne que les autres listes de la fiche). */
const BORNE_VGP = 5;

/** `page` du bloc « Machines du site » (FICHE-360-1), la seule pagination de cette fiche. */
const schemaPage = z.coerce.number().int().min(1).catch(1);

/**
 * MÉMOÏSÉE PAR REQUÊTE (VISUEL-1, 23/09/2026) — voir le même commentaire sur
 * `lireClientCache` dans `app/(back-office)/clients/[id]/page.tsx`.
 */
const lireSiteCache = cache((contexte: ContexteSession, id: string) =>
  lireSite(contexte, id),
);

/** MÊME MÉMOÏSATION, POUR LA SESSION — voir `clients/[id]/page.tsx`. */
const sessionCache = cache(async () => obtenirSession(await headers()));

/** LE TITRE D'ONGLET PORTE LE NOM DU LIEU (VISUEL-1) — voir `clients/[id]`. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await sessionCache();
  if (session === null || session.contexte.societeId === null) {
    return { title: t("vocabulaire.site.pluriel") };
  }
  const { id } = await params;
  if (!estUuid(id)) {
    return { title: t("vocabulaire.site.pluriel") };
  }
  const site = await lireSiteCache(session.contexte, id);
  return { title: site?.libelle ?? t("vocabulaire.site.pluriel") };
}

export default async function PageSite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await sessionCache();
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  // LA FICHE SITE EST FERMÉE AU TECHNICIEN (QT-2, D152, choix 1) — il lit
  // client et site depuis la fiche de SES interventions, déjà restreinte,
  // jamais depuis `/sites`.
  if (session.contexte.role === Role.technicien) {
    return (
      <Page chemin="/sites" titre={t("vocabulaire.site.pluriel")}>
        <RefusAcces />
      </Page>
    );
  }

  const { id } = await params;
  // UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE
  // (9EJ-CORRECTIFS-AUDIT-TUILES-ID) — même garde que `clients/[id]`.
  if (!estUuid(id)) {
    notFound();
  }
  const paramsResolus = await searchParams;
  const motif = paramsResolus.motif;
  const saisieContactGardee = saisieContactGardeeDepuis(paramsResolus);
  const site = await lireSiteCache(session.contexte, id);
  if (site === null) {
    notFound();
  }
  // `page` — LE BLOC « MACHINES DU SITE » (FICHE-360-1), la seule
  // pagination de cette fiche.
  const page = schemaPage.parse(
    typeof paramsResolus.page === "string" ? paramsResolus.page : undefined,
  );
  const enEdition = paramsResolus.edition === "site";

  const libelles = await libellesDesSites(session.contexte, [site]);
  // Les agences de la société, pour que le rattachement soit MODIFIABLE : sans
  // cela, l'exigence de D56 serait vraie et inatteignable depuis cet écran.
  // AGENCE-ACTIVE (9AY-AA-1) — `garder` protège le rattachement DÉJÀ posé.
  const agences = await avecContexteApplicatif(session.contexte, (tx) =>
    agencesProposables(tx, { garder: site.agence_id }),
  );
  const agenceDuSite = agences.find((agence) => agence.id === site.agence_id);
  const exigences = await exigencesDuSite(session.contexte, site.id);
  const habilitations = (await listerHabilitations(session.contexte)).filter(
    (habilitation) => habilitation.actif,
  );
  const contacts = await contactsDuSite(session.contexte, site.id);
  // LE DESTINATAIRE DES COURRIELS DE PLANIFICATION (CS45, QT-16, D165) — le
  // donneur d'ordre DE CE SITE, à défaut celui du client.
  const contactsPourCourriel = await contactsDuClient(
    session.contexte,
    site.client_id,
  );
  const destinataireCourriels = destinataireClient(
    contactsPourCourriel,
    site.id,
  );
  const interventions = await dernieresInterventionsDuSite(
    session.contexte,
    site.id,
    INTERVENTIONS_MONTREES,
  );
  const aTraiter = await interventionsATraiterDuSite(
    session.contexte,
    site.id,
    BORNE_A_TRAITER,
  );
  const donneesMaterielATraiter = await donneesMaterielDesMachines(
    session.contexte,
    aTraiter.flatMap((ligne) => ligne.machines.map((m) => m.machine_id)),
  );
  const libellesMachinesATraiter = new Map(
    [...donneesMaterielATraiter].map(([machineId, donnees]) => [
      machineId,
      libelleMaterielComplet(donnees),
    ]),
  );

  // LE FUSEAU EST UNE DONNÉE, JAMAIS UN LITTÉRAL (L0-08) — même lecture que
  // `/vgp`.
  const societe = await avecContexteApplicatif(session.contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: session.contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));
  const interventionsOuvertes = await interventionsOuvertesDuSite(
    session.contexte,
    site.id,
  );
  const derniereIntervention = await derniereInterventionDuSite(
    session.contexte,
    site.id,
  );
  const [syntheseVgp, lignesVgp, catalogueTrajets] = await Promise.all([
    prochaineEcheanceDuSite(session.contexte, site.id, aujourdHui),
    lignesVgpSoumisesDuSite(session.contexte, site.id, aujourdHui, BORNE_VGP),
    lireCatalogueTrajets(session.contexte),
  ]);
  const trajet = resoudreTempsTrajet(site, catalogueTrajets);

  const equipements = await equipementsActifsDuSite(
    session.contexte,
    site.id,
    page,
  );

  // CONTRAT-SITE-1 — la MÊME capacité que le reste de la modification du site.
  const peutModifierSite =
    session.contexte.role !== null &&
    peut(session.contexte.role, "gerer_client_site");
  // LES ACTIONS EN CONTEXTE (FICHE-360-1).
  const peutCreerIntervention =
    session.contexte.role !== null &&
    peut(session.contexte.role, "creer_demande");
  const peutGererMachine =
    session.contexte.role !== null &&
    peut(session.contexte.role, "gerer_machine");

  const clientLibelle = libelles.clients.get(site.client_id) ?? "";
  const clientActif = libelles.clientsActifs.get(site.client_id) !== false;

  const faitsFiche: readonly FaitFiche[] = [
    {
      cle: "client",
      icone: "building",
      libelle: t("site.client"),
      valeur: (
        <Link href={`/clients/${site.client_id}`} className={CLASSES_LIEN}>
          {clientLibelle}
        </Link>
      ),
    },
    {
      cle: "adresse",
      icone: "map",
      libelle: t("sites.fiche.fait_adresse"),
      valeur: ouTiret(formatAdresseSite(site.adresse, site.commune)),
    },
    {
      cle: "horaires",
      icone: "clock",
      libelle: t("sites.fiche.fait_horaires"),
      valeur: <HorairesAffiches horaires={site.horaires} />,
    },
    {
      cle: "trajet",
      icone: "route",
      libelle: t("sites.fiche.fait_trajet"),
      valeur: trajet.minutes === null ? ouTiret(null) : `${trajet.minutes} min`,
    },
    {
      cle: "zone",
      icone: "pin",
      libelle: t("sites.fiche.fait_zone"),
      valeur: `${libelleZone(site.zone_geo)}${t("ponctuation.point_median")}${
        agenceDuSite === undefined ? ouTiret(null) : agenceDuSite.libelle
      }`,
    },
  ];

  const lignesATraiter: readonly LigneATraiter[] = aTraiter.map((ligne) => ({
    id: ligne.id,
    ton: "avertissement",
    titre: `${t(`type_intervention.${ligne.type}`)}${t("ponctuation.point_median")}${machinesEnTexte(ligne, libellesMachinesATraiter)}`,
    detail: `${referenceAffichee(ligne)}${t("ponctuation.point_median")}${
      ligne.date_planifiee === null
        ? t("statut.a_planifier")
        : dateCivile(ligne.date_planifiee)
    }`,
    href: `/interventions/${ligne.id}?depuis=site`,
  }));

  return (
    <Page
      chemin="/sites"
      surtitre={`${mot("site")}${t("ponctuation.point_median")}${clientLibelle}`}
      titre={site.libelle}
      pastilles={
        <>
          {site.sous_contrat ? (
            <Badge ton="bleu">{libelleBadgeSousContrat()}</Badge>
          ) : null}
          {site.actif ? null : <Badge ton="gris">{t("sites.inactif")}</Badge>}
          {clientActif ? null : (
            <Badge ton="gris">{t("sites.fiche.client_inactif_pastille")}</Badge>
          )}
        </>
      }
      faits={<EnTeteFiche faits={faitsFiche} />}
      // FIL D'ARIANE (FICHE-360-1 ; corrigé 9DR-TP-NAV2-RETOURS-FIL, D168) —
      // `Sites › <client> › <site>`, inchangé par ce lot (écart nommé, D191).
      filAriane={[
        { libelle: mot("site", true), href: "/sites" },
        {
          libelle: clientLibelle,
          href: `/clients/${site.client_id}`,
        },
        { libelle: site.libelle },
      ]}
      className="max-[900px]:pb-[170px]"
      actions={
        <>
          {peutGererMachine ? (
            <Button asChild variant="outline" className="max-[900px]:hidden">
              <Link
                href={`/parc/nouvelle?client=${site.client_id}&site=${site.id}`}
              >
                {t("sites.action.ajouter_machine")}
              </Link>
            </Button>
          ) : null}
          {peutCreerIntervention ? (
            <BarreActionCollee>
              <LienPrimaire
                href={`/interventions/nouvelle?site=${site.id}`}
                className="w-full min-[901px]:w-fit"
              >
                {t("sites.action.ajouter_intervention")}
              </LienPrimaire>
            </BarreActionCollee>
          ) : null}
          {peutModifierSite && !enEdition ? (
            <Link
              href={`/sites/${site.id}?edition=site`}
              className={CLASSES_LIEN}
            >
              {t("sites.fiche.modifier")}
            </Link>
          ) : null}
        </>
      }
    >
      {/* « sites.cree » (GR12c) — le SEUL motif de cet écran dont le
          libellé porte le mot imposé ; il ne peut donc pas s'écrire en clair
          au dictionnaire (§3, D5/D47) et se compose ici. */}
      {motif === "sites.cree" ? (
        <BandeauMotif motif={motif}>{libelleSiteCree()}</BandeauMotif>
      ) : typeof motif === "string" && estCleTraduction(motif) ? (
        <BandeauMotif motif={motif}>{t(motif)}</BandeauMotif>
      ) : null}

      {clientActif ? null : (
        <BandeauEtat ton="avertissement" titre={alerteClientInactifDuSite()} />
      )}

      {site.consignes_acces === null ||
      site.consignes_acces.trim() === "" ? null : (
        <BandeauEtat
          ton="information"
          titre={t("sites.fiche.consignes_titre")}
          texte={site.consignes_acces}
        />
      )}

      {peutModifierSite && enEdition ? (
        <form
          method="post"
          action={`/api/sites/${site.id}/modifier`}
          className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-4"
        >
          <Champ
            nom="libelle"
            libelle={t("site.libelle")}
            valeur={site.libelle}
          />
          <Champ
            nom="commune"
            libelle={t("site.commune")}
            valeur={site.commune ?? ""}
          />

          <label className="flex flex-col gap-1 text-13 font-bold">
            {t("site.zone_geo")}
            <select
              name="zone_geo"
              defaultValue={site.zone_geo ?? ""}
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
            >
              <option value="" />
              {ZONES_GEOGRAPHIQUES.map((zone) => (
                <option key={zone} value={zone}>
                  {t(`site.zone.${zone}`)}
                </option>
              ))}
            </select>
          </label>

          {/*
          LE RATTACHEMENT ET LE TEMPS DE TRAJET SONT CÔTE À CÔTE (D56).
        */}
          <div className="border-app-bord grid gap-4 rounded-md border px-3.5 py-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-13 font-bold md:col-span-2">
              {libelleRattachement()}
              <select
                name="agence_id"
                defaultValue={site.agence_id}
                className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
              >
                <OptionsAgence agences={agences} />
              </select>
            </label>
            <Champ
              nom="temps_trajet_min"
              libelle={t("site.temps_trajet_min")}
              valeur={
                site.temps_trajet_min === null
                  ? ""
                  : String(site.temps_trajet_min)
              }
              aide={t("site.temps_trajet_min.aide")}
            />
          </div>

          <Champ
            nom="consignes_acces"
            libelle={t("site.consignes_acces")}
            valeur={site.consignes_acces ?? ""}
          />

          <label className="flex items-center gap-1.5 text-13 font-bold">
            {/* LA SENTINELLE DÉCOCHÉE */}
            <input type="hidden" name="sous_contrat" value="0" />
            <input
              type="checkbox"
              name="sous_contrat"
              value="1"
              defaultChecked={site.sous_contrat}
            />
            {t("site.sous_contrat")}
          </label>

          <div className="flex gap-3">
            <ActionPrimaire>{t("sites.action.modifier")}</ActionPrimaire>
            <Link
              href={`/sites/${site.id}`}
              className="text-app-encre-faible text-13 font-bold"
            >
              {t("sites.fiche.annuler")}
            </Link>
          </div>
        </form>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-4">
            {lignesATraiter.length === 0 ? null : (
              <BlocATraiter
                titre={t("sites.fiche.a_traiter_titre")}
                lignes={lignesATraiter}
              />
            )}

            <BlocMachines
              equipements={equipements.lignes}
              total={equipements.total}
              page={page}
              siteId={site.id}
              peutCreerIntervention={peutCreerIntervention}
            />

            <BlocInterventions
              interventions={interventions}
              borne={INTERVENTIONS_MONTREES}
              interventionsOuvertes={interventionsOuvertes}
              derniereIntervention={derniereIntervention}
            />
          </div>

          <ColonneContexte>
            <BlocVgp
              lignes={lignesVgp}
              synthese={syntheseVgp}
              siteId={site.id}
            />

            <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
              <h2 className="text-[13px] font-bold">
                {t("sites.fiche.qui_sera_prevenu")}
              </h2>
              <p
                data-aide="destinataire-courriels"
                className="text-13 font-bold"
              >
                {libelleDestinataireCourriels(destinataireCourriels)}
              </p>
              <p className="text-app-encre-faible text-12 font-bold">
                {t("sites.fiche.donneur_ordre_role")}
              </p>
            </section>

            <BlocExigences
              siteId={site.id}
              exigences={exigences}
              habilitations={habilitations}
              peutEcrire={peutModifierSite}
            />

            <BlocContacts
              bloc="contacts-site"
              titre={t("sites.fiche.contacts")}
              texteVide={videContactsSite()}
              contacts={contacts}
              clientId={site.client_id}
              retour={`/sites/${site.id}`}
              siteOptions={null}
              siteFixe={site.id}
              montrerRattachement={false}
              saisieGardee={saisieContactGardee}
              peutEcrire={peutModifierSite}
            />
          </ColonneContexte>
        </div>
      )}
    </Page>
  );
}

/**
 * LA OU LES MACHINES D'UNE LIGNE « À TRAITER », EN TEXTE (9EF-TP-UX4-2-
 * FICHES-1) — `BlocATraiter` ne rend que du texte, jamais un second lien
 * dans sa ligne (un seul lien par ligne, D140 l'exige déjà ailleurs).
 */
function machinesEnTexte(
  ligne: LignePlanning,
  libelles: ReadonlyMap<string, string>,
): string {
  const machines = machinesIdentifiees(ligne, libelles);
  if (machines.length === 0) {
    return ouTiret(null);
  }
  return machines.map((machine) => machine.libelle ?? ouTiret(null)).join(", ");
}

function Champ({
  nom,
  libelle,
  valeur,
  aide,
}: Readonly<{
  nom: string;
  libelle: string;
  valeur: string;
  aide?: string;
}>) {
  return (
    <label className="flex flex-col gap-1 text-13 font-bold">
      {libelle}
      <input
        name={nom}
        defaultValue={valeur}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
      />
      {aide === undefined ? null : (
        <span className="text-app-encre-faible text-12 font-bold">{aide}</span>
      )}
    </label>
  );
}

/**
 * LES HORAIRES D'ACCÈS, EN FAIT D'EN-TÊTE (9EF-TP-UX4-2-FICHES-1) —
 * `horairesAffiches` REUTILISÉE telle quelle (9EE-2), jamais un second
 * formateur. `null` → absence ; `[]` → fermé.
 */
function HorairesAffiches({ horaires }: Readonly<{ horaires: unknown }>) {
  const plages = horairesAffiches(horaires);
  if (plages === null) {
    return <>{t("parc.non_renseigne")}</>;
  }
  if (plages.length === 0) {
    return <>{t("site.horaires.aucune_plage")}</>;
  }
  return (
    <>
      {plages.map((plage, index) => (
        <span key={index} className="block">
          {plage.jours} {plage.heures}
        </span>
      ))}
    </>
  );
}

/**
 * LES TONS DE STATUT D'UNE MACHINE — recopiés de `TONS_STATUT`
 * (`app/(back-office)/parc/[id]/page.tsx`), jamais une seconde palette : les
 * trois statuts ACTIFS gardent le même ton qu'ailleurs dans le parc.
 */
const TON_STATUT_MACHINE: Record<string, TonBadge> = {
  en_service: "vert",
  en_panne: "rouge",
  arretee: "orange",
  remplacee: "gris",
  ferraillee: "gris",
  fusionnee: "gris",
};

/** Recopié de `statutAffiche` (`/parc`) — même dictionnaire, même repli. */
function statutMachineAffiche(statut: string): string {
  const cle = `statut_machine.${statut}`;
  return estCleTraduction(cle) ? t(cle) : statut;
}

/**
 * LES MACHINES DU SITE (FICHE-360-1, titre composé par `titreMachinesDuSite`,
 * 9EF-1) — seules les machines ACTIVES ; une ligne mène à sa fiche et
 * propose « + Intervention », déjà préremplie SITE ET MACHINE (LIENS-1).
 */
function BlocMachines({
  equipements,
  total,
  page,
  siteId,
  peutCreerIntervention,
}: Readonly<{
  equipements: readonly LigneEquipementSite[];
  total: number;
  page: number;
  siteId: string;
  peutCreerIntervention: boolean;
}>) {
  const colonnes = [
    { cle: "famille", libelle: t("sites.fiche.equipements.colonne_famille") },
    {
      cle: "materiel",
      libelle: t("sites.fiche.equipements.colonne_materiel"),
    },
    { cle: "serie", libelle: t("sites.fiche.equipements.colonne_serie") },
    { cle: "statut", libelle: t("sites.fiche.equipements.colonne_statut") },
    { cle: "action", libelle: t("sites.fiche.equipements.colonne_action") },
  ];
  const totalPages = Math.max(1, Math.ceil(total / EQUIPEMENTS_PAR_PAGE_SITE));
  return (
    <section
      data-bloc="equipements-site"
      className="bg-app-surface border-app-bord overflow-hidden rounded-lg border"
    >
      <h2
        data-compteur="equipements"
        className="border-app-bord border-b px-4 py-3 text-[14px] font-bold"
      >
        {titreMachinesDuSite(total)}
      </h2>
      {equipements.length === 0 ? (
        <p className="text-app-encre-faible px-4 py-3 text-13 font-bold">
          {videEquipementsSite()}
        </p>
      ) : (
        <Tableau colonnes={colonnes} minimum="720px">
          {equipements.map((machine) => (
            <tr key={machine.id}>
              <Cellule>{machine.familleLibelle}</Cellule>
              <Cellule fort>
                <Link href={`/parc/${machine.id}`} className={CLASSES_LIEN}>
                  {machine.marque} {machine.reference}
                </Link>
              </Cellule>
              <Cellule mono>{machine.numeroSerie}</Cellule>
              <Cellule>
                <Badge ton={TON_STATUT_MACHINE[machine.statut] ?? "gris"}>
                  {statutMachineAffiche(machine.statut)}
                </Badge>
              </Cellule>
              <Cellule>
                {peutCreerIntervention ? (
                  <Link
                    href={`/interventions/nouvelle?site=${siteId}&machine=${machine.id}`}
                    className={CLASSES_LIEN}
                  >
                    {t("sites.action.ajouter_intervention")}
                  </Link>
                ) : null}
              </Cellule>
            </tr>
          ))}
        </Tableau>
      )}
      {total === 0 ? null : (
        <div className="border-app-bord border-t px-4 py-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            libelleResultats={decompte(
              total,
              t("sites.fiche.equipement_resultat_un"),
              t("sites.fiche.equipement_resultat"),
            )}
            libellePage={libellePage(page, totalPages)}
            libellePrecedent={t("pagination.precedent")}
            libelleSuivant={t("pagination.suivant")}
            hrefPage={(p) => hrefDeLaPage(`/sites/${siteId}`, {}, p)}
          />
        </div>
      )}
    </section>
  );
}

/**
 * LES EXIGENCES D'HABILITATION DE CE SITE (ÉQUIPE-2).
 */
function BlocExigences({
  siteId,
  exigences,
  habilitations,
  peutEcrire,
}: {
  readonly siteId: string;
  readonly exigences: readonly LigneExigence[];
  readonly habilitations: readonly {
    readonly id: string;
    readonly code: string;
    readonly libelle: string;
  }[];
  readonly peutEcrire: boolean;
}) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[14px] font-bold">{t("habilitations.site.titre")}</h2>

      {exigences.length === 0 ? (
        <p className="text-app-encre-faible text-13 font-bold">
          {t("habilitations.site.aucune")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {exigences.map((exigence) => (
            <li
              key={exigence.id}
              className="flex flex-wrap items-center gap-2 text-13 font-bold"
            >
              <span className="font-mono font-bold">{exigence.code}</span>
              <span className="text-app-encre-faible">{exigence.libelle}</span>
              <span
                className={
                  exigence.bloquant
                    ? "text-app-rouge-encre font-semibold"
                    : "text-app-encre-faible"
                }
              >
                {exigence.bloquant
                  ? t("habilitations.site.bloquant")
                  : t("habilitations.site.avertissement")}
              </span>
              {peutEcrire ? (
                <form
                  action={`/api/habilitations/exigences/${exigence.id}/retirer`}
                  method="post"
                >
                  <input type="hidden" name="site_id" value={siteId} />
                  <Button type="submit" variant="outline" size="sm">
                    {t("habilitations.retirer")}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!peutEcrire ? null : habilitations.length === 0 ? (
        <p className="text-app-encre-faible text-[12px] font-bold">
          {t("habilitations.site.rien_a_exiger")}
        </p>
      ) : (
        <form
          action="/api/habilitations/exigences/creer"
          method="post"
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="site_id" value={siteId} />
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${siteId}-habilitation`}
              className="text-app-encre-faible text-12 font-bold"
            >
              {t("habilitations.site.exiger")}
            </label>
            <select
              id={`${siteId}-habilitation`}
              name="habilitation_id"
              required
              defaultValue=""
              className="border-app-bord bg-app-surface min-w-44 rounded-md border px-2 py-1 text-13 font-bold"
            >
              <option value="" disabled>
                {t("habilitations.site.choisir")}
              </option>
              {habilitations.map((habilitation) => (
                <option key={habilitation.id} value={habilitation.id}>
                  {habilitation.code}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 pb-1 text-13 font-bold">
            <input type="checkbox" name="bloquant" defaultChecked />
            {t("habilitations.site.bloquant_case")}
          </label>
          <Button type="submit" variant="outline" size="sm">
            {t("habilitations.site.exiger_action")}
          </Button>
        </form>
      )}
    </section>
  );
}

/**
 * LES DERNIÈRES INTERVENTIONS DE CE SITE (HISTORIQUE-SITE-1) — inchangé par
 * ce ticket.
 */
function BlocInterventions({
  interventions,
  borne,
  interventionsOuvertes,
  derniereIntervention,
}: {
  readonly interventions: readonly LigneIntervention[];
  readonly borne: number;
  readonly interventionsOuvertes: number;
  readonly derniereIntervention: LigneIntervention | null;
}) {
  const colonnes = [
    {
      cle: "reference",
      libelle: t("intervention.reference"),
      largeur: "160px",
    },
    { cle: "date", libelle: t("intervention.date"), largeur: "140px" },
    { cle: "type", libelle: t("intervention.type") },
    { cle: "statut", libelle: t("intervention.statut"), largeur: "170px" },
  ];
  return (
    <section
      id="historique-site"
      data-bloc="historique-site"
      className="bg-app-surface border-app-bord overflow-hidden rounded-lg border"
    >
      <div className="border-app-bord flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[14px] font-bold">
            {t("sites.fiche.interventions")}
          </h2>
          {interventions.length === 0 ? null : (
            <p className="text-app-encre-faible text-[12px] font-bold">
              {borneEcrite(borne)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-12 font-bold">
          <span data-compteur="interventions-ouvertes">
            <b className="text-app-encre font-bold">{interventionsOuvertes}</b>{" "}
            <span className="text-app-encre-faible">
              {t("sites.fiche.synthese.interventions_ouvertes")}
            </span>
          </span>
          <span data-compteur="derniere-intervention">
            <span className="text-app-encre-faible">
              {t("sites.fiche.synthese.derniere_intervention")}
            </span>{" "}
            <b className="font-bold">
              {derniereIntervention === null ? (
                ouTiret(null)
              ) : (
                <Link
                  href={`/interventions/${derniereIntervention.id}?depuis=site`}
                  className={CLASSES_LIEN}
                >
                  {derniereIntervention.date_planifiee === null
                    ? ouTiret(null)
                    : dateCivile(derniereIntervention.date_planifiee)}
                </Link>
              )}
            </b>
          </span>
        </div>
      </div>
      {interventions.length === 0 ? (
        <p className="text-app-encre-faible px-4 py-3 text-13 font-bold">
          {videInterventionsSite()}
        </p>
      ) : (
        <Tableau colonnes={colonnes} minimum="640px">
          {interventions.map((ligne) => (
            <tr key={ligne.id}>
              <Cellule mono>
                <Link
                  href={`/interventions/${ligne.id}?depuis=site`}
                  className={CLASSES_LIEN}
                >
                  {referenceAffichee(ligne)}
                </Link>
              </Cellule>
              <Cellule>
                {ligne.date_planifiee === null
                  ? ouTiret(null)
                  : dateCivile(ligne.date_planifiee)}
              </Cellule>
              <Cellule>{t(`type_intervention.${ligne.type}`)}</Cellule>
              <Cellule>
                <span
                  className={`${CLASSES_STATUT[ligne.statut]} rounded px-1.5 py-0.5 text-12 font-bold`}
                >
                  {t(`statut.${ligne.statut}`)}
                </span>
              </Cellule>
            </tr>
          ))}
        </Tableau>
      )}
    </section>
  );
}

/** « Au plus 12 interventions, … » — le nombre est composé par l'écran, jamais écrit dans le dictionnaire. */
function borneEcrite(borne: number): string {
  return `${t("sites.fiche.interventions_borne_prefixe")} ${borne} ${t("sites.fiche.interventions_borne_suffixe")}`;
}

/**
 * « VGP DU SITE » (9EF-TP-UX4-2-FICHES-1) — la synthèse retenue (`synthese`,
 * À CÔTÉ de `lignes`, jamais à sa place : `prochaineEcheanceDuSite` continue
 * de répondre à la même question qu'avant ce ticket) PUIS une ligne par
 * machine soumise. `data-compteur="vgp-prochaine"` GARDÉE — même prise, même
 * contenu qu'avant ce ticket (`vgp-affichage-tpa2.spec.ts`).
 */
function BlocVgp({
  lignes,
  synthese,
  siteId,
}: Readonly<{
  lignes: readonly LigneDeRegistre[];
  synthese: SyntheseVgpSite;
  siteId: string;
}>) {
  return (
    <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <h2 className="text-[13px] font-bold">
        {titreVgpDuSite(synthese.soumises)}
      </h2>
      <div data-compteur="vgp-prochaine">
        {synthese.retenue !== null ? (
          <>
            <span className="mt-[1px] block">
              <Badge ton={tonEtat(synthese.retenue)}>
                {libelleEtatCourt(synthese.retenue)}
              </Badge>
            </span>
            <span className="text-app-encre-faible mt-[3px] block text-12 font-bold break-words">
              {libelleEcheance(synthese.retenue)}
            </span>
          </>
        ) : synthese.sansInformation > 0 ? (
          <b className="block text-[16px] font-bold">
            {sansInformationAffichee(synthese.sansInformation)}
          </b>
        ) : (
          <b className="block text-[16px] font-bold">{ouTiret(null)}</b>
        )}
      </div>
      {lignes.length === 0 ? null : (
        <ul className="border-app-bord flex flex-col gap-2 border-t pt-3">
          {lignes.map((ligne) => (
            <li
              key={ligne.id}
              className="flex flex-wrap items-center justify-between gap-2 text-13 font-bold"
            >
              <span className="min-w-0">
                <Link href={`/parc/${ligne.id}`} className={CLASSES_LIEN}>
                  {ligne.numero_serie}
                </Link>
                <span className="text-app-encre-faible block text-12 font-bold">
                  {ligne.marque} {ligne.modele}
                </span>
              </span>
              <Badge ton={tonEtat(ligne.information)}>
                {libelleEtatCourt(ligne.information)}
              </Badge>
              <ActionEnregistrer ligne={ligne} />
            </li>
          ))}
        </ul>
      )}
      <Link href={`/vgp?site=${siteId}`} className={CLASSES_LIEN}>
        {t("sites.fiche.vgp_registre")}
      </Link>
    </section>
  );
}

/**
 * « N sans information » — composée HORS du JSX (L0-11).
 */
function sansInformationAffichee(n: number): string {
  return `${n} ${t("sites.fiche.synthese.vgp_sans_information")}`;
}

/**
 * L'ACTION « ENREGISTRER », SELON LE RÉGIME — MÊME FORME que `/vgp/page.tsx`
 * (`ActionEnregistrer`), jamais une seconde écriture : `enregistrementPropose`
 * (`lib/vgp/registre.ts`) décide seule, la route `/vgp/enregistrer/[id]`
 * juge elle-même la capacité (`enregistrer_vgp`).
 */
function ActionEnregistrer({ ligne }: { readonly ligne: LigneDeRegistre }) {
  const decision = enregistrementPropose(ligne);
  if (decision === "masque") {
    return null;
  }
  return (
    <Link
      href={`/vgp/enregistrer/${ligne.id}`}
      className="border-app-bord rounded-md border px-2.5 py-1 text-[12px] font-bold whitespace-nowrap"
    >
      {t("vgp.action_enregistrer")}
    </Link>
  );
}
