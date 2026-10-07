import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { BarreActionCollee } from "@/components/ui/action-primaire";
import { Badge } from "@/components/ui/badge";
import { BoutonAvecConfirmation } from "@/components/ui/bouton-confirmation";
import { Button } from "@/components/ui/button";
import { Choix } from "@/components/ui/choix";
import { peut } from "@/lib/auth/habilitations";
import { RefusAcces } from "@/components/ui/refus-acces";
import { Role } from "@/lib/auth/roles";
import { obtenirSession } from "@/lib/auth/session";
import { destinataireClient } from "@/lib/avertissements/planification";
import {
  fuseauDeLAgence,
  chargerCalendrierAgence,
} from "@/lib/calendar/agence";
import {
  dateCivile,
  lireFuseau,
  maintenant,
  versLocal,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { etatAccuse, type EtatAccuse } from "@/lib/demandes/accuse";
import {
  peutAccuser,
  peutCloreSansSuite,
  peutQualifier,
  peutTransformer,
  type Verdict,
} from "@/lib/demandes/cycle-de-vie";
import { CHAMPS_DEMANDE } from "@/lib/demandes/depot";
import { MOTIFS_CLOTURE, type StatutDemande } from "@/lib/demandes/saisie";
import { estUuid } from "@/lib/identifiant";
import { libelleChampObligatoire } from "@/lib/i18n/obligatoire";
import type { LigneIntervention } from "@/lib/interventions/depot";
import {
  MODES_VALORISATION,
  PRIORITES,
  TYPES_INTERVENTION,
} from "@/lib/interventions/saisie";
import type { StatutIntervention } from "@/lib/interventions/saisie";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  donneesMaterielDesMachines,
  machinesDesSites,
  type DonneesMateriel,
} from "@/lib/machines/depot";
import { teteDeLHistorique } from "@/lib/machines/historique";
import { libelleMaterielComplet } from "@/lib/machines/presentation";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { tonDePriorite } from "@/lib/theme/priorites";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import {
  deduiteDuSite,
  referenceAffichee,
} from "../../interventions/presentation";
import { ChampDureePrevue } from "../../interventions/nouvelle/champ-duree";
import {
  cleEtatAccuse,
  instantLisible,
  sansMachineSurLeSite,
  sousTitreReception,
  surtitreFiche,
  titreFiche,
  tonDuStatutDemande,
} from "../presentation";

export const metadata: Metadata = { title: t("demande.titre") };

/** Les lignes montrées (décision d'Alexis du 05/10/2026, n°26) — « Tout voir » rejoint le reste. */
const LIGNES_INTERVENTIONS_MACHINE = 4;

/**
 * LA FICHE D'UNE DEMANDE, AU GABARIT DE LA MAQUETTE DU 28/09 (QE-9, QE-13a ;
 * D176 ; 9ED-TP-UX3-D2-DEMANDES).
 *
 * ## Aucune lecture-par-id n'existait dans `lib/demandes/depot.ts`
 *
 * `demandesOuvertes` ne rend QUE les demandes `nouvelle` ou `qualifiee` — une
 * demande `transformee` ou `close_sans_suite` doit rester consultable, et
 * cette fonction-là la cacherait. Le dépôt n'expose donc aucune lecture par
 * identifiant seul : cette fiche lit `demande` directement, avec
 * `CHAMPS_DEMANDE` — la sélection que le dépôt EXPORTE déjà —, exactement
 * comme `tableau-de-bord/page.tsx` et `interventions/nouvelle/page.tsx` lisent
 * `site` ou `societe` sans détour par un module dédié.
 *
 * ## LE REFUS PREND LA PLACE DE L'ACTION, AVEC SA RAISON — même consigne que
 * la fiche d'intervention (`../../interventions/[id]/page.tsx`)
 *
 * Et il ne se contourne pas par une requête forgée : `demande_cycle_de_vie`
 * tient le même refus en base (voir `tests/isolation/demande.test.ts`). Cet
 * écran DIT ce que la base ferait ; il ne le décide pas.
 *
 * ## DÉCISION 14 D'ALEXIS DU 05/10/2026 — UN SEUL GESTE
 *
 * « Créer l'intervention » crée l'intervention ET passe la demande
 * « Transformée », dans la MÊME transaction (`creerIntervention`,
 * `lib/interventions/depot.ts`) : il n'y a plus de « Marquer comme
 * transformée » séparé à jouer APRÈS une création normale. Ce geste reste
 * offert pour les interventions nées AVANT cette décision — créées sans
 * passer par cette route, ou avant que `creerIntervention` ne pose le
 * statut — tant que la demande est encore `qualifiee` et qu'au moins une
 * intervention en est déjà issue.
 *
 * ## LE BLOC « TRANSFORMER EN INTERVENTION » CONSOLIDE QUALIFIER ET CLORE
 *
 * La maquette (`:3151-3171`) montre un seul bloc qui change de forme selon le
 * statut — refus + Qualifier + Clore quand `nouvelle`, le formulaire de
 * création quand `qualifiee`, « Suite donnée » une fois figée. `data-bloc=
 * "demande-actions"` reste posé sur ce bloc (demandes.spec.ts) : toutes ses
 * actions disparaissent avec lui une fois la demande figée.
 *
 * **« Clore sans suite » et « Créer l'intervention » restent deux
 * formulaires DISTINCTS, jamais imbriqués** (un `<form>` dans un `<form>` est
 * invalide) : celui de Clore vit dans un `<details>`, replié sous son bouton
 * — l'échappatoire que ce ticket nomme explicitement quand un dialogue ne
 * peut pas porter un `<select>`.
 */
export default async function PageDemande({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }

  // FERMÉ AU TECHNICIEN (QT-2, D152) — même garde que `/demandes`.
  if (session.contexte.role === Role.technicien) {
    return (
      <Page chemin="/demandes" titre={t("demande.titre")}>
        <RefusAcces />
      </Page>
    );
  }

  const contexte = session.contexte;
  const { id } = await params;
  const motif = (await searchParams).motif;

  // UN IDENTIFIANT MAL FORMÉ EST UN REFUS, JAMAIS UNE PANNE
  // (9EJ-CORRECTIFS-AUDIT-TUILES-ID) — même garde que `clients/[id]`.
  if (!estUuid(id)) {
    notFound();
  }

  const demande = await avecContexteApplicatif(contexte, (tx) =>
    tx.demande.findFirst({ where: { id }, select: CHAMPS_DEMANDE }),
  );
  if (demande === null) {
    // Hors périmètre et inexistante rendent LA MÊME chose : les distinguer
    // ferait un oracle (D35, D50).
    notFound();
  }
  const statut = demande.statut as StatutDemande;

  const [client, site, agence, contact, societe, contactsPourCourriel] =
    await avecContexteApplicatif(contexte, (tx) =>
      Promise.all([
        tx.client.findFirst({
          where: { id: demande.client_id },
          select: { raison_sociale: true },
        }),
        tx.site.findFirst({
          where: { id: demande.site_id },
          select: { libelle: true, commune: true },
        }),
        tx.agence.findFirst({
          where: { id: demande.agence_id },
          select: {
            libelle: true,
            fuseau_horaire: true,
            societe: { select: { fuseau_horaire: true } },
          },
        }),
        demande.contact_id === null
          ? Promise.resolve(null)
          : tx.contact.findFirst({
              where: { id: demande.contact_id },
              select: { nom: true },
            }),
        tx.societe.findFirst({
          where: { id: contexte.societeId as string },
          select: { fuseau_horaire: true },
        }),
        // LE DONNEUR D'ORDRE (QE-9, D176) — les contacts du CLIENT, dont
        // `destinataireClient` (RÉUTILISÉE, `lib/avertissements/
        // planification.ts`) retient celui du site ou, à défaut, celui du
        // client (même ordre que `sites/[id]/page.tsx`).
        tx.contact.findMany({
          where: { client_id: demande.client_id },
          select: {
            id: true,
            nom: true,
            email: true,
            actif: true,
            roles: true,
            site_id: true,
          },
        }),
      ]),
    );
  // LIRE, PAS LE DÉPÔT NESTÉ DANS LA TRANSACTION CI-DESSUS — `donneesMaterielDesMachines`
  // et `machinesDesSites` ouvrent leur PROPRE contexte applicatif (§9, 01/09 :
  // une seconde transaction ouverte à l'intérieur d'une autre n'est pas la
  // même chose qu'une jointure).
  const [materielDeLaMachine, machinesDuSite, historiqueMachine] =
    await Promise.all([
      demande.machine_id === null
        ? Promise.resolve<ReadonlyMap<string, DonneesMateriel>>(new Map())
        : donneesMaterielDesMachines(contexte, [demande.machine_id]),
      machinesDesSites(contexte, [demande.site_id]),
      demande.machine_id === null
        ? Promise.resolve<readonly LigneIntervention[]>([])
        : teteDeLHistorique(
            contexte,
            demande.machine_id,
            LIGNES_INTERVENTIONS_MACHINE,
          ),
    ]);
  const fuseauSociete = lireFuseau(societe?.fuseau_horaire);
  const destinataireCourriel = destinataireClient(
    contactsPourCourriel,
    demande.site_id,
  );

  // LES INTERVENTIONS ISSUES DE CETTE DEMANDE (68-DEMANDES-2) — lues SOUS LE
  // MÊME CONTEXTE CLOISONNÉ : la forme « parc » d'`intervention` filtre déjà,
  // rien à recomparer ici.
  const interventionsIssues = await avecContexteApplicatif(contexte, (tx) =>
    tx.intervention.findMany({
      where: { demande_id: demande.id },
      select: { id: true, numero: true, statut: true },
      orderBy: { cree_le: "asc" },
    }),
  );

  // L'ÉTAT DE L'ACCUSÉ DE RÉCEPTION (D13) — la fenêtre couvre exactement le
  // temps déjà écoulé, du dépôt à maintenant : ni plus (2028 n'a que faire
  // d'ici), ni moins (une demande peut attendre plusieurs jours).
  let etatAccuseDeCetteDemande: EtatAccuse | null = null;
  if (agence !== null) {
    const fuseauAgence = fuseauDeLAgence(agence);
    const instantCourant = maintenant(fuseauAgence).instant;
    const calendrier = await avecContexteApplicatif(contexte, (tx) =>
      chargerCalendrierAgence(tx, {
        societeId: contexte.societeId as string,
        agenceId: demande.agence_id,
        fenetre: {
          du: versLocal(demande.depose_le, "UTC"),
          au: versLocal(instantCourant, "UTC"),
        },
      }),
    );
    if (calendrier !== null) {
      etatAccuseDeCetteDemande = etatAccuse(calendrier, {
        compteurDepart: demande.compteur_accuse_le,
        accuseLe: demande.accuse_le,
        maintenant: instantCourant,
      });
    }
  }

  // LA CAPACITÉ RETENUE EST `qualifier_affecter` (décision du 03/10/2026,
  // point 3 ; D151) — voir `app/api/demandes/[id]/accuser/route.ts`. REVIENT
  // sur le choix d'origine de ce ticket (`creer_demande`) : les quatre
  // actions d'une demande relèvent de « Qualifier / affecter » (CDC §5.2),
  // jamais de la création. Un rôle qui ne l'a pas voit le refus À LA PLACE de
  // chaque action, jamais un formulaire qu'il ne peut pas soumettre.
  const peutAgir =
    session.contexte.role !== null &&
    peut(session.contexte.role, "qualifier_affecter");
  const refusCapacite: Verdict = {
    refuse: true,
    cle: "demande.refus.capacite_requise",
  };
  // MÊME VERDICT pour le formulaire de création et pour « Marquer comme
  // transformée » — un seul calcul, jamais deux lectures d'un même critère
  // qui pourraient diverger en silence (§9).
  const verdictTransformer: Verdict = peutAgir
    ? peutTransformer(statut)
    : refusCapacite;

  // L'`id` DE L'INTERVENTION À NAÎTRE — tiré UNE FOIS AU RENDU, comme
  // `/interventions/nouvelle` (55-FORMULAIRES-1) : la route relit cet `id`
  // sous le contexte cloisonné avant d'écrire, un double clic ne crée donc
  // jamais deux interventions.
  const idIntervention = uuidv7();

  return (
    <Page
      chemin="/demandes"
      surtitre={surtitreFiche(demande.numero)}
      titre={
        <span className="inline-flex flex-wrap items-center gap-3">
          <span>{titreFiche(client, site)}</span>
          <Badge ton={tonDuStatutDemande(statut)}>
            {t(`demande.statut.${statut}`)}
          </Badge>
          <Badge ton={tonDePriorite(demande.urgence)}>
            {t(`priorite.${demande.urgence}`)}
          </Badge>
        </span>
      }
      // FIL D'ARIANE (9DR-TP-NAV2-RETOURS-FIL, D168) — remplace l'ancien
      // retour nu `demandes.retour`.
      filAriane={[
        { libelle: t("nav.demandes"), href: "/demandes" },
        { libelle: titreFiche(client, site) },
      ]}
      sousTitre={sousTitreReception(
        demande.depose_le,
        fuseauSociete,
        t(`demande.source.${demande.source}`),
      )}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
            <h2 className="text-[13px] font-bold">
              {t("demande.ce_qui_est_demande.titre")}
            </h2>
            <blockquote className="border-app-bord text-app-encre-faible border-l-2 pl-3 text-13 font-bold italic">
              {demande.description}
            </blockquote>
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2.5 text-[13px] font-bold">
              <Ligne
                libelle={t("intervention.client")}
                valeur={client?.raison_sociale ?? TIRET}
                lien={`/clients/${demande.client_id}`}
              />
              <Ligne
                libelle={mot("site")}
                valeur={
                  site === null
                    ? TIRET
                    : site.commune === null
                      ? site.libelle
                      : `${site.libelle}${t("ponctuation.point_median")}${site.commune}`
                }
                lien={`/sites/${demande.site_id}`}
              />
              {demande.machine_id === null ? null : (
                <Ligne
                  libelle={t("intervention.machine")}
                  valeur={
                    materielDeLaMachine.has(demande.machine_id)
                      ? libelleMaterielComplet(
                          materielDeLaMachine.get(demande.machine_id)!,
                        )
                      : TIRET
                  }
                  lien={`/parc/${demande.machine_id}`}
                />
              )}
              <Ligne
                libelle={t("contact.role.donneur_ordre")}
                valeur={destinataireCourriel?.nom ?? TIRET}
              />
            </dl>
            <hr className="border-app-bord" />
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2.5 text-[13px] font-bold">
              <Ligne
                libelle={mot("agence")}
                valeur={agence?.libelle ?? TIRET}
                note={deduiteDuSite()}
              />
              <Ligne
                libelle={t("demande.source")}
                valeur={t(`demande.source.${demande.source}`)}
              />
              {demande.machine_arretee ? (
                <Ligne
                  libelle={t("demande.machine_arretee")}
                  valeur={t("demande.machine_arretee_oui")}
                />
              ) : null}
              {demande.date_souhaitee === null ? null : (
                <Ligne
                  libelle={t("demande.date_souhaitee")}
                  valeur={dateCivile(demande.date_souhaitee)}
                />
              )}
              <Ligne
                libelle={t("demande.contact")}
                valeur={contact?.nom ?? t("demande.sans_interlocuteur")}
              />
              <Ligne
                libelle={t("demande.colonne_deposee_le")}
                valeur={instantLisible(demande.depose_le, fuseauSociete)}
              />
              {statut === "close_sans_suite" &&
              demande.motif_cloture !== null ? (
                <Ligne
                  libelle={t("demande.cloture.motif")}
                  valeur={t(`demande.motif.${demande.motif_cloture}`)}
                />
              ) : null}
            </dl>
          </section>

          <section
            data-bloc="demande-actions"
            className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5"
          >
            <h2 className="text-[13px] font-bold">
              {t("demande.transformer.titre")}
            </h2>

            {statut === "nouvelle" ? (
              <>
                {verdictTransformer.refuse ? (
                  <p className="text-app-rouge-encre text-13 font-bold">
                    {estCleTraduction(verdictTransformer.cle)
                      ? t(verdictTransformer.cle)
                      : ""}
                  </p>
                ) : null}
                {peutAgir ? (
                  <>
                    <Action
                      titre={t("demande.action.qualifier")}
                      verdict={peutQualifier(statut)}
                      action={`/api/demandes/${demande.id}/qualifier`}
                    />
                    <ClotureDisclosure
                      demandeId={demande.id}
                      verdict={peutCloreSansSuite(statut)}
                    />
                  </>
                ) : null}
              </>
            ) : null}

            {statut === "qualifiee" ? (
              verdictTransformer.refuse ? (
                <p className="text-app-rouge-encre text-13 font-bold">
                  {estCleTraduction(verdictTransformer.cle)
                    ? t(verdictTransformer.cle)
                    : ""}
                </p>
              ) : (
                <>
                  <form
                    action="/api/interventions/creer"
                    method="post"
                    className="flex flex-col gap-4"
                  >
                    <input type="hidden" name="id" value={idIntervention} />
                    <input type="hidden" name="demande_id" value={demande.id} />
                    <input
                      type="hidden"
                      name="site"
                      value={`${demande.client_id}:${demande.site_id}`}
                    />
                    <input
                      type="hidden"
                      name="contact_id"
                      value={demande.contact_id ?? ""}
                    />

                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      {libelleChampObligatoire(t("intervention.type"))}
                      <select
                        name="type"
                        required
                        defaultValue=""
                        className="border-input bg-background rounded-md border px-3 py-2 font-normal"
                      >
                        <option value="" disabled>
                          {t("intervention.creation.choisir_nature")}
                        </option>
                        {TYPES_INTERVENTION.map((valeur) => (
                          <option key={valeur} value={valeur}>
                            {t(`type_intervention.${valeur}`)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <Choix
                      nom="priorite"
                      legende={t("intervention.priorite")}
                      options={PRIORITES.map((valeur) => ({
                        valeur,
                        libelle: t(`priorite.${valeur}`),
                      }))}
                      valeurInitiale={demande.urgence}
                      obligatoire
                    />

                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      {t("intervention.machine")}
                      <select
                        name="machine_ids"
                        defaultValue={demande.machine_id ?? ""}
                        className="border-input bg-background rounded-md border px-3 py-2 font-normal"
                      >
                        <option value="">{sansMachineSurLeSite()}</option>
                        {machinesDuSite.map((machine) => (
                          <option key={machine.id} value={machine.id}>
                            {machine.libelle}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      {t("intervention.mode_valorisation")}
                      <select
                        name="mode_valorisation"
                        defaultValue="temps_passe"
                        className="border-input bg-background rounded-md border px-3 py-2 font-normal"
                      >
                        {MODES_VALORISATION.map((valeur) => (
                          <option key={valeur} value={valeur}>
                            {t(`mode_valorisation.${valeur}`)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <ChampDureePrevue />

                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      {libelleChampObligatoire(
                        t("demande.transformer.description"),
                      )}
                      <textarea
                        name="description"
                        required
                        aria-required="true"
                        rows={4}
                        defaultValue={demande.description}
                        className="bg-background border-input rounded-md border px-3 py-2 font-normal"
                      />
                    </label>

                    <div className="flex justify-end">
                      <BarreActionCollee>
                        <Button type="submit">
                          {t("intervention.action.creer")}
                        </Button>
                      </BarreActionCollee>
                    </div>
                  </form>

                  <ClotureDisclosure
                    demandeId={demande.id}
                    verdict={peutCloreSansSuite(statut)}
                  />

                  {/* « MARQUER COMME TRANSFORMÉE » RESTE OFFERTE SANS
                      CONDITION SUR LES INTERVENTIONS ISSUES (99Q-GR2-DEMANDE ;
                      demandes.spec.ts, demandes-marquer-transformee.spec.ts) —
                      le filet pour une demande qualifiée dont la création n'est
                      pas passée par ce formulaire (decision 14 ne vaut que pour
                      LUI). Seule la confirmation varie : elle ne s'affiche que
                      si AUCUNE intervention n'est encore issue. */}
                  <Action
                    titre={t("demande.action.marquer_transformee")}
                    verdict={verdictTransformer}
                    action={`/api/demandes/${demande.id}/transformer`}
                    note={t("demande.transformer.note")}
                    boutonPersonnalise={
                      interventionsIssues.length === 0 ? (
                        <BoutonAvecConfirmation
                          libelle={t("demande.action.marquer_transformee")}
                          variant="outline"
                          texteConfirmation={t(
                            "demande.transformer.confirmation",
                          )}
                          boutonConfirmer={t("demande.transformer.confirmer")}
                          boutonRevenir={t("demande.transformer.revenir")}
                        />
                      ) : undefined
                    }
                  />
                </>
              )
            ) : null}

            {statut === "transformee" ? (
              <p className="text-13 font-bold">
                {t("demande.refus.deja_transformee")}
              </p>
            ) : null}

            {statut === "close_sans_suite" ? (
              <p className="text-13 font-bold">
                {t("demande.cloture.suite_prefixe")}
                {t("ponctuation.deux_points")}
                {demande.motif_cloture === null
                  ? t("demande.sans_valeur")
                  : t(`demande.motif.${demande.motif_cloture}`)}
              </p>
            ) : null}
          </section>

          <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
            <h2 className="text-[13px] font-bold">
              {t("demande.interventions_issues.titre")}
            </h2>
            {interventionsIssues.length === 0 ? (
              <p className="text-app-encre-faible text-13 font-bold">
                {t("demande.interventions_issues.aucune")}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {interventionsIssues.map((intervention) => (
                  <li
                    key={intervention.id}
                    data-intervention-issue={intervention.id}
                    className="flex items-center gap-2 text-[13px] font-bold"
                  >
                    <Link
                      href={`/interventions/${intervention.id}?depuis=demande&depuis_id=${demande.id}`}
                      className={CLASSES_LIEN}
                    >
                      {referenceAffichee(intervention)}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-12 font-bold ${
                        CLASSES_STATUT[
                          intervention.statut as StatutIntervention
                        ]
                      }`}
                    >
                      {t(`statut.${intervention.statut}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
            <h2 className="text-[13px] font-bold">
              {t("demande.accuse.titre")}
            </h2>
            <p className="text-app-encre-faible text-12 font-bold">
              {t("demande.accuse.explication")}
            </p>
            <p className="text-[13px] font-bold">
              {etatAccuseDeCetteDemande === null
                ? t("demande.sans_valeur")
                : t(cleEtatAccuse(etatAccuseDeCetteDemande))}
            </p>
            <Action
              titre={t("demande.action.accuser")}
              verdict={
                peutAgir
                  ? peutAccuser(statut, demande.accuse_le)
                  : refusCapacite
              }
              action={`/api/demandes/${demande.id}/accuser`}
            />
          </section>

          {demande.machine_id === null ? null : (
            <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
              <h2 className="text-[13px] font-bold">
                {t("demande.interventions_machine.titre")}
              </h2>
              {historiqueMachine.length === 0 ? (
                <p className="text-app-encre-faible text-13 font-bold">
                  {t("demande.interventions_machine.vide")}
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {historiqueMachine.map((ligne) => (
                    <li
                      key={ligne.id}
                      className="flex flex-col gap-0.5 text-[13px] font-bold"
                    >
                      <Link
                        href={`/interventions/${ligne.id}`}
                        className={CLASSES_LIEN}
                      >
                        {ligne.date_planifiee === null
                          ? t("demande.sans_valeur")
                          : dateCivile(ligne.date_planifiee)}
                        {t("ponctuation.separateur")}
                        {t(`type_intervention.${ligne.type}`)}
                      </Link>
                      <span className="text-app-encre-faible text-12 font-bold">
                        {referenceAffichee(ligne)}
                        {t("ponctuation.point_median")}
                        {t(`statut.${ligne.statut}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={`/parc/${demande.machine_id}`}
                className={CLASSES_LIEN}
              >
                {t("demande.interventions_machine.tout_voir")}
              </Link>
            </section>
          )}
        </aside>
      </div>
    </Page>
  );
}

/** Ce qu'on affiche à la place d'une valeur qu'on n'a pas — jamais un vide. */
const TIRET = "—";

function Ligne({
  libelle,
  valeur,
  note,
  lien,
}: {
  libelle: string;
  valeur: React.ReactNode;
  note?: string;
  lien?: string;
}) {
  return (
    <>
      <dt className="text-app-encre-faible text-[12px] font-bold">{libelle}</dt>
      <dd className="font-semibold break-all">
        {lien === undefined ? (
          valeur
        ) : (
          <Link href={lien} className={CLASSES_LIEN}>
            {valeur}
          </Link>
        )}
        {note === undefined ? null : (
          <span className="text-app-encre-faible block text-12 font-bold">
            {note}
          </span>
        )}
      </dd>
    </>
  );
}

/**
 * UNE ACTION, OU SON REFUS — même consigne que `../../interventions/[id]/page.tsx`
 * : le refus s'affiche à la place, en oxyde, avec sa raison écrite.
 */
function Action({
  titre,
  verdict,
  action,
  note,
  children,
  boutonPersonnalise,
}: {
  titre: string;
  verdict: Verdict;
  action: string;
  note?: string;
  children?: React.ReactNode;
  /** Remplace le bouton de soumission par défaut — pour une confirmation
   * préalable (voir « Marquer comme transformée », 99Q-GR2-DEMANDE). */
  boutonPersonnalise?: React.ReactNode;
}) {
  if (verdict.refuse) {
    return (
      <section className="border-app-rouge-bord bg-app-rouge-fond flex flex-col gap-1 rounded-lg border px-4 py-3">
        <h2 className="text-[13px] font-bold">{titre}</h2>
        <p className="text-app-rouge-encre text-13 font-bold">
          {estCleTraduction(verdict.cle) ? t(verdict.cle) : ""}
        </p>
      </section>
    );
  }
  return (
    <form
      action={action}
      method="post"
      className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3"
    >
      <h2 className="text-[13px] font-bold">{titre}</h2>
      {note === undefined ? null : (
        <p className="text-app-encre-faible text-12 font-bold">{note}</p>
      )}
      {children}
      {boutonPersonnalise ?? (
        <Button type="submit" variant="outline" size="sm">
          {titre}
        </Button>
      )}
    </form>
  );
}

/**
 * « CLORE SANS SUITE », REPLIÉ SOUS SON BOUTON (QE-9, D176) — l'échappatoire
 * nommée par ce ticket : un dialogue de confirmation ne peut pas porter un
 * `<select>` (`BoutonAvecConfirmation` n'enrobe qu'un texte), et ce
 * formulaire ne doit JAMAIS être imbriqué dans celui de création, son voisin
 * dans le bloc « Transformer en intervention ». `<details>` replie le motif
 * sous le bouton sans une ligne de JavaScript.
 */
function ClotureDisclosure({
  demandeId,
  verdict,
}: {
  demandeId: string;
  verdict: Verdict;
}) {
  if (verdict.refuse) {
    return null;
  }
  return (
    <details>
      <summary className="text-app-encre-faible inline-block cursor-pointer text-13 font-bold underline underline-offset-2">
        {t("demande.action.clore")}
      </summary>
      <form
        action={`/api/demandes/${demandeId}/clore`}
        method="post"
        className="mt-2 flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("demande.cloture.motif")}
          <select
            name="motif"
            required
            defaultValue=""
            className="border-input bg-background rounded-md border px-3 py-2 font-normal"
          >
            {/* IN-44 — aucun motif n'est choisi d'avance (D164) : cette
                option est affichée mais jamais valide pour `schemaCloture`
                (`z.enum(MOTIFS_CLOTURE)`), donc un envoi sans sélection
                retombe sur le refus `demande.cloture.motif_requis`. */}
            <option value="" disabled>
              {t("demande.cloture.motif.choisir")}
            </option>
            {MOTIFS_CLOTURE.map((motifCloture) => (
              <option key={motifCloture} value={motifCloture}>
                {t(`demande.motif.${motifCloture}`)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-app-encre-faible text-12 font-bold">
          {t("demande.cloture.explication")}
        </p>
        <Button type="submit" variant="outline" size="sm">
          {t("demande.action.clore")}
        </Button>
      </form>
    </details>
  );
}
