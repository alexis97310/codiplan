import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Page } from "@/components/mise-en-page/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { peut } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
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
import type { StatutIntervention } from "@/lib/interventions/saisie";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { libellesDesMachines } from "@/lib/machines/depot";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT } from "@/lib/theme/statuts";

import { referenceAffichee } from "../../interventions/presentation";
import {
  cleEtatAccuse,
  instantLisible,
  tonDuStatutDemande,
} from "../presentation";

export const metadata: Metadata = { title: t("demande.titre") };

/**
 * LA FICHE D'UNE DEMANDE (DEMANDES-1) — et les quatre actions.
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
 * ## « TRANSFORMER » NE CRÉE PAS L'INTERVENTION
 *
 * `marquerTransformee` le dit dans son propre en-tête : cette action pose
 * SEULEMENT le statut et son verrou ; le geste de planifier reste séparé, sur
 * `/interventions/nouvelle?demande=<id>` — un lien y mène, la note le dit.
 *
 * ## LE LIEN GARDÉ (68-DEMANDES-2, SAV-11)
 *
 * `intervention.demande_id` existe depuis ce lot : le lien ci-dessus
 * préremplit l'écran de création, et la liste « Interventions issues de
 * cette demande » ci-dessous lit ce que `creerIntervention` y a écrit — lue
 * directement ici, comme `client`/`site`/`agence`/`contact` plus haut, une
 * lecture par `demande_id` seul n'ayant sa place dans aucun dépôt existant.
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
  const contexte = session.contexte;
  const { id } = await params;
  const motif = (await searchParams).motif;

  const demande = await avecContexteApplicatif(contexte, (tx) =>
    tx.demande.findFirst({ where: { id }, select: CHAMPS_DEMANDE }),
  );
  if (demande === null) {
    // Hors périmètre et inexistante rendent LA MÊME chose : les distinguer
    // ferait un oracle (D35, D50).
    notFound();
  }
  const statut = demande.statut as StatutDemande;

  const [client, site, agence, contact, societe] = await avecContexteApplicatif(
    contexte,
    (tx) =>
      Promise.all([
        tx.client.findFirst({
          where: { id: demande.client_id },
          select: { raison_sociale: true },
        }),
        tx.site.findFirst({
          where: { id: demande.site_id },
          select: { libelle: true },
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
      ]),
  );
  // LIRE, PAS LE DÉPÔT NESTÉ DANS LA TRANSACTION CI-DESSUS — `libellesDesMachines`
  // ouvre son PROPRE contexte applicatif (§9, 01/09 : une seconde transaction
  // ouverte à l'intérieur d'une autre n'est pas la même chose qu'une jointure).
  const libellesMachines =
    demande.machine_id === null
      ? new Map<string, string>()
      : await libellesDesMachines(contexte, [demande.machine_id]);
  const fuseauSociete = lireFuseau(societe?.fuseau_horaire);

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

  // LA CAPACITÉ RETENUE EST `creer_demande` — la même que la création d'une
  // intervention (voir `app/api/demandes/[id]/accuser/route.ts`) : un rôle qui
  // ne l'a pas voit le refus À LA PLACE de chaque action, jamais un formulaire
  // qu'il ne peut pas soumettre.
  const peutAgir =
    session.contexte.role !== null &&
    peut(session.contexte.role, "creer_demande");
  const refusCapacite: Verdict = {
    refuse: true,
    cle: "demande.refus.capacite_requise",
  };

  return (
    <Page
      chemin="/demandes"
      titre={
        <span className="inline-flex flex-wrap items-center gap-3">
          <span>{t("demande.titre")}</span>
          <Badge ton={tonDuStatutDemande(statut)}>
            {t(`demande.statut.${statut}`)}
          </Badge>
        </span>
      }
      sousTitre={demande.numero === null ? t("demande.sans_numero") : undefined}
      actions={
        <Link href="/demandes" className="text-app-encre-faible text-[12.5px]">
          {t("demandes.retour")}
        </Link>
      }
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <section className="bg-app-surface border-app-bord rounded-lg border px-4 py-3.5">
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
              <Ligne
                libelle={t("intervention.client")}
                valeur={client?.raison_sociale ?? TIRET}
                lien={`/clients/${demande.client_id}`}
              />
              <Ligne
                libelle={mot("site")}
                valeur={site?.libelle ?? TIRET}
                lien={`/sites/${demande.site_id}`}
              />
              <Ligne
                libelle={mot("agence")}
                valeur={agence?.libelle ?? TIRET}
                note={t("intervention.deduit_du_lieu")}
              />
              {demande.machine_id === null ? null : (
                <Ligne
                  libelle={t("intervention.machine")}
                  valeur={libellesMachines.get(demande.machine_id) ?? TIRET}
                />
              )}
              <Ligne
                libelle={t("demande.source")}
                valeur={t(`demande.source.${demande.source}`)}
              />
              <Ligne
                libelle={t("demande.urgence")}
                valeur={t(`priorite.${demande.urgence}`)}
              />
              <Ligne
                libelle={t("demande.description")}
                valeur={demande.description}
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

          <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
            <h2 className="text-[13px] font-bold">
              {t("demande.accuse.titre")}
            </h2>
            <p className="text-app-encre-faible text-[11.5px]">
              {t("demande.accuse.explication")}
            </p>
            <p className="text-[13px] font-semibold">
              {etatAccuseDeCetteDemande === null
                ? t("demande.sans_valeur")
                : t(cleEtatAccuse(etatAccuseDeCetteDemande))}
            </p>
          </section>

          <section className="bg-app-surface border-app-bord flex flex-col gap-2 rounded-lg border px-4 py-3.5">
            <h2 className="text-[13px] font-bold">
              {t("demande.interventions_issues.titre")}
            </h2>
            {interventionsIssues.length === 0 ? (
              <p className="text-app-encre-faible text-[12.5px]">
                {t("demande.interventions_issues.aucune")}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {interventionsIssues.map((intervention) => (
                  <li
                    key={intervention.id}
                    data-intervention-issue={intervention.id}
                    className="flex items-center gap-2 text-[13px]"
                  >
                    <Link
                      href={`/interventions/${intervention.id}`}
                      className={CLASSES_LIEN}
                    >
                      {referenceAffichee(intervention)}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
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

        <aside data-bloc="demande-actions" className="flex flex-col gap-4">
          <Action
            titre={t("demande.action.accuser")}
            verdict={
              peutAgir ? peutAccuser(statut, demande.accuse_le) : refusCapacite
            }
            action={`/api/demandes/${demande.id}/accuser`}
          />

          <Action
            titre={t("demande.action.qualifier")}
            verdict={peutAgir ? peutQualifier(statut) : refusCapacite}
            action={`/api/demandes/${demande.id}/qualifier`}
          />

          <Action
            titre={t("demande.action.transformer")}
            verdict={peutAgir ? peutTransformer(statut) : refusCapacite}
            action={`/api/demandes/${demande.id}/transformer`}
            note={t("demande.transformer.note")}
          >
            <Link
              href={`/interventions/nouvelle?demande=${demande.id}`}
              className={CLASSES_LIEN}
            >
              {t("demande.transformer.creer_intervention")}
            </Link>
          </Action>

          <Action
            titre={t("demande.action.clore")}
            verdict={peutAgir ? peutCloreSansSuite(statut) : refusCapacite}
            action={`/api/demandes/${demande.id}/clore`}
            note={t("demande.cloture.explication")}
          >
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("demande.cloture.motif")}
              <select
                name="motif"
                required
                className="border-input bg-background rounded-md border px-3 py-2 font-normal"
              >
                {MOTIFS_CLOTURE.map((motifCloture) => (
                  <option key={motifCloture} value={motifCloture}>
                    {t(`demande.motif.${motifCloture}`)}
                  </option>
                ))}
              </select>
            </label>
          </Action>
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
  valeur: string;
  note?: string;
  lien?: string;
}) {
  return (
    <>
      <dt className="text-app-encre-faible text-[12px]">{libelle}</dt>
      <dd className="font-semibold break-all">
        {lien === undefined ? (
          valeur
        ) : (
          <Link href={lien} className={CLASSES_LIEN}>
            {valeur}
          </Link>
        )}
        {note === undefined ? null : (
          <span className="text-app-encre-faible block text-[11.5px] font-normal">
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
}: {
  titre: string;
  verdict: Verdict;
  action: string;
  note?: string;
  children?: React.ReactNode;
}) {
  if (verdict.refuse) {
    return (
      <section className="border-app-rouge-bord bg-app-rouge-fond flex flex-col gap-1 rounded-lg border px-4 py-3">
        <h2 className="text-[13px] font-bold">{titre}</h2>
        <p className="text-app-rouge-encre text-[12.5px]">
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
        <p className="text-app-encre-faible text-[11.5px]">{note}</p>
      )}
      {children}
      <Button type="submit" variant="outline" size="sm">
        {titre}
      </Button>
    </form>
  );
}
