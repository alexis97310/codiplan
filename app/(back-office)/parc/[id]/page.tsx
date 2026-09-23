import type { Metadata } from "next";

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { Page } from "@/components/mise-en-page/page";
import { ActionsQrMachine } from "@/components/machines/actions-qr";
import { Badge, type TonBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CarteEnTete,
  DetailBody,
  Kv,
  KvLigne,
} from "@/components/ui/maitre-detail";
import { QrCode } from "@/components/ui/qr-code";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  documentsDeLaMachine,
  type DocumentDeMachine,
} from "@/lib/documents/depot";
import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import { estFige } from "@/lib/interventions/cycle-de-vie";
import { type LigneIntervention } from "@/lib/interventions/depot";
import { personnesANommer, quiTravaille } from "@/lib/interventions/personnes";
import { lireMachine, type FicheMachine } from "@/lib/machines/depot";
import { historiqueDeLaMachine } from "@/lib/machines/historique";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_STATUT } from "@/lib/theme/statuts";
import { libelleEcheance } from "@/lib/vgp/libelles";
import { informationDeLaMachine } from "@/lib/vgp/registre";

import { referenceAffichee } from "../../interventions/presentation";

/**
 * LA FICHE MACHINE, À L'IDENTIQUE DE `machinePage()` (N-11, D125, D126).
 *
 * ## CE QUE D125 GOUVERNE ICI, ET CE QUE D126 Y AJOUTE
 *
 * D125 fait foi sur la DISPOSITION — deux colonnes, la bannière, le bandeau
 * d'alerte conditionnel, les deux cartes de gauche, la carte QR collante à
 * droite. **D126 (18/09/2026, rendu par Alexis pendant ce ticket) fait foi sur
 * ce que le `dl.kv` d'identité PORTE en tête** : famille, marque, référence du
 * modèle, numéro de série, année de vente — avant les six champs que la
 * maquette dessine déjà. Les deux décisions ne se contredisent pas : l'une dit
 * où, l'autre dit quoi. Voir `docs/arbitrages.md`, D125 et D126.
 *
 * ## TROIS DÉFAUTS MESURÉS SUR LE SITE, RÉPARÉS ICI
 *
 * 1. Un numéro de série illisible (`SN-INCONNU-…`) s'affichait comme un vrai
 *    numéro. `numeroDeSerieAffiche` applique la même règle que `/parc`
 *    (`machine.complet`) : signe d'absence, plus une pastille.
 * 2. Le statut s'affichait énuméré brut (`en_service`). Il passe par le
 *    dictionnaire et par une pastille, comme `/parc`.
 * 3. Une commune identique au libellé du site se répétait
 *    (« Ducos, Ducos »). `lieuAffiche` applique la même déduplication que
 *    `/parc`.
 *
 * Les trois règles sont RECOPIÉES depuis `app/(back-office)/parc/page.tsx`,
 * jamais importées : c'est la même retenue que `referenceMachine` assume déjà
 * dans ce dépôt — partager la FORME d'un petit calcul de présentation ne vaut
 * pas le détour, et `/parc` n'est pas retouché par ce ticket.
 *
 * ## LE BANDEAU D'ALERTE NE DIT RIEN QU'IL NE SACHE
 *
 * Si aucune intervention de l'historique n'est dans un état FIGÉ
 * (`estFige` — ni `annulee` ni `cloturee`), le bandeau porte son bouton et sa
 * ligne de contexte, composée de FAITS RÉELS (référence, type, statut) —
 * jamais la phrase invariable de la maquette. Sinon, il dit le statut et rien
 * de plus (N-11, §0).
 *
 * ## LE QR ENCODE LE JETON ; RIEN D'AUTRE NE L'AFFICHE (D71)
 *
 * `machine.qr_token` n'entre que dans `<QrCode valeur={...} />`. Toute
 * l'étiquette lisible — la ligne mono de la bannière, la ligne
 * « CODIPLAN:<référence> » sous le QR — montre la RÉFÉRENCE, jamais le jeton.
 */

const ABSENT = "—";

/**
 * MÉMOÏSÉE PAR REQUÊTE (VISUEL-1, 23/09/2026) — voir le même commentaire sur
 * `lireClientCache` dans `app/(back-office)/clients/[id]/page.tsx`.
 */
const lireMachineCache = cache(lireMachine);

/** MÊME MÉMOÏSATION, POUR LA SESSION — voir `clients/[id]/page.tsx`. */
const sessionCache = cache(async () => obtenirSession(await headers()));

/**
 * LE TITRE D'ONGLET PORTE LE NOM DE LA MACHINE (VISUEL-1) — `bannerTitre`,
 * plus bas dans ce fichier, est la MÊME fonction que la bannière de l'écran
 * affiche déjà (marque + référence du modèle) : aucune seconde forme de nom
 * n'est inventée pour l'onglet.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await sessionCache();
  if (session === null || session.contexte.societeId === null) {
    return { title: t("machine.fiche.titre") };
  }
  const { id } = await params;
  const machine = await lireMachineCache(session.contexte, id);
  return { title: machine === null ? t("machine.fiche.titre") : bannerTitre(machine) };
}

export default async function PageMachine({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await sessionCache();
  if (session === null) {
    redirect("/connexion");
  }
  if (session.contexte.societeId === null) {
    redirect("/arrivee");
  }
  const contexte = session.contexte;

  const { id } = await params;
  const machine = await lireMachineCache(contexte, id);
  if (machine === null) {
    notFound();
  }

  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  // LA CIVILE, JAMAIS L'INSTANT (DATES-1) : `informationDeLaMachine` compare
  // à `date_verification`, une `@db.Date` posée à minuit UTC.
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));

  const historique = await historiqueDeLaMachine(contexte, machine.id);
  const annuaire = await avecContexteApplicatif(contexte, (tx) =>
    annuaireDesPersonnes(tx, personnesANommer(historique, [])),
  );
  const information = await informationDeLaMachine(
    contexte,
    machine.id,
    aujourdHui,
  );
  const documents = await documentsDeLaMachine(contexte, id);
  const lignesDocuments = documents ?? [];

  // LA SEULE INTERVENTION QUE LE BANDEAU CITE — la plus récente qui ne soit
  // pas FIGÉE (ni `annulee` ni `cloturee`). `historique` est déjà trié du
  // plus récent au plus ancien (`historiqueDeLaMachine`) : le premier trouvé
  // est le bon.
  const interventionOuverte =
    machine.statut === "en_service"
      ? undefined
      : historique.find((ligne) => !estFige(ligne.statut));

  const colonnesDocuments = [
    { cle: "libelle", libelle: t("machine.documents.colonne_libelle") },
    {
      cle: "origine",
      libelle: t("machine.documents.colonne_origine"),
      largeur: "150px",
    },
    {
      cle: "classe",
      libelle: t("machine.documents.colonne_classe"),
      largeur: "120px",
    },
    { cle: "fichier", libelle: t("machine.documents.colonne_fichier") },
  ];

  const colonnesHistorique = [
    { cle: "date", libelle: t("machine.fiche.historique_colonne_date") },
    {
      cle: "intervention",
      libelle: t("machine.fiche.historique_colonne_intervention"),
    },
    { cle: "type", libelle: t("machine.fiche.historique_colonne_type") },
    {
      cle: "technicien",
      libelle: t("machine.fiche.historique_colonne_technicien"),
    },
    {
      cle: "resultat",
      libelle: t("machine.fiche.historique_colonne_resultat"),
    },
  ];

  return (
    <Page
      chemin="/parc"
      titre={t("machine.fiche.titre")}
      sousTitre={sousTitreFiche(machine)}
      actions={
        <>
          <Link href="/parc" className="text-app-encre-faible text-[12.5px]">
            {t("machine.retour")}
          </Link>
          {/* « Modifier » — GAP COMBLÉ (AT-07 bis, 18/09/2026) : la route
              d'édition existe désormais, voir
              app/(back-office)/parc/[id]/modifier/page.tsx et
              lib/machines/ecarts-maquette.ts. */}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/parc/${machine.id}/modifier`}>
              {t("machine.action.modifier")}
            </Link>
          </Button>
        </>
      }
    >
      <div
        data-bloc="machine-page"
        className="grid grid-cols-1 gap-4 min-[1181px]:grid-cols-[minmax(0,1.4fr)_minmax(310px,.6fr)]"
      >
        <div className="flex flex-col gap-4">
          <section
            data-bloc="machine-banner"
            className="bg-app-surface border-app-bord flex items-start gap-4 rounded-lg border p-[22px] max-[600px]:flex-col"
          >
            <div className="bg-app-bleu-fond text-app-marque grid h-[58px] w-[58px] flex-none place-items-center rounded-lg text-[26px] font-black">
              {t("parc.symbole_machine")}
            </div>
            <div className="flex-1">
              <div className="text-app-encre-faible font-mono text-[12px]">
                {referenceMachine(machine)}
              </div>
              <h2 className="mt-[3px] mb-[7px] text-[22px] font-extrabold">
                {bannerTitre(machine)}
              </h2>
              <div className="flex flex-wrap items-center gap-[9px]">
                <Badge ton={TONS_STATUT[machine.statut]}>
                  {statutAffiche(machine.statut)}
                </Badge>
                <Badge ton="bleu">{machine.modele.famille.libelle}</Badge>
              </div>
            </div>
          </section>

          {machine.statut === "en_service" ? null : (
            <div
              data-bloc="alert-strip"
              className="bg-app-orange-fond text-app-orange-encre grid grid-cols-[auto_1fr_auto] items-center gap-[12px] rounded-[12px] p-[15px]"
            >
              <span
                data-bloc="alert-num"
                className="bg-app-surface grid h-[38px] w-[38px] place-items-center rounded-full font-black"
              >
                {t("machine.alerte.symbole")}
              </span>
              <div>
                <b className="font-bold">{statutAffiche(machine.statut)}</b>
                {interventionOuverte === undefined ? null : (
                  <div className="text-[12px]">
                    {contexteAlerteMachine(interventionOuverte)}
                  </div>
                )}
              </div>
              {interventionOuverte === undefined ? null : (
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/interventions/${interventionOuverte.id}?depuis=machine&depuis_id=${machine.id}`}
                  >
                    {t("machine.alerte.voir_intervention")}
                  </Link>
                </Button>
              )}
            </div>
          )}

          <CarteEnTete
            titre={t("machine.fiche.identite_titre")}
            bloc="carte-identite"
          >
            <DetailBody>
              <Kv bloc="identite-kv">
                <KvLigne
                  dt={t("machine.fiche.kv_famille")}
                  dd={machine.modele.famille.libelle}
                />
                <KvLigne
                  dt={t("machine.fiche.kv_marque")}
                  dd={machine.modele.marque}
                />
                <KvLigne
                  dt={t("machine.fiche.kv_reference")}
                  dd={machine.modele.reference}
                />
                <KvLigne
                  dt={t("machine.fiche.kv_serie")}
                  dd={numeroDeSerieAffiche(machine)}
                />
                <KvLigne
                  dt={t("machine.fiche.kv_annee_vente")}
                  dd={anneeDeVenteAffichee(machine)}
                />
                {/* LE CLIENT ET LE SITE MÈNENT À LEUR FICHE (LIENS-1) — les
                    deux identifiants voyagent déjà sur `machine` (CHAMPS_PARC
                    pour `client_id`, CHAMPS_FICHE pour `site_id`). */}
                <KvLigne
                  dt={t("machine.fiche.kv_client")}
                  dd={
                    <Link
                      href={`/clients/${machine.client_id}`}
                      className={CLASSES_LIEN}
                    >
                      {machine.client.raison_sociale}
                    </Link>
                  }
                />
                <KvLigne
                  dt={`${mot("site")} ${t("machine.fiche.kv_site_suffixe")}`}
                  dd={
                    <Link
                      href={`/sites/${machine.site_id}`}
                      className={CLASSES_LIEN}
                    >
                      {lieuAffiche(machine)}
                    </Link>
                  }
                />
                <KvLigne
                  dt={`${mot("agence")} ${t("machine.fiche.kv_agence_suffixe")}`}
                  dd={machine.site.agence.libelle}
                />
                <KvLigne
                  dt={t("machine.fiche.kv_mise_en_service")}
                  dd={dateAffichee(machine.date_mise_en_service)}
                />
                {/* « Contrat » — écart nommé (lib/machines/ecarts-maquette.
                    ts, ECARTS_MAQUETTE_APERCU_PARC, même motif) : aucune
                    table de contrat n'existe (lot 4). */}
                <KvLigne
                  dt={t("machine.fiche.kv_contrat")}
                  dd={texteAbsent()}
                />
                <KvLigne
                  dt={t("machine.fiche.kv_vgp")}
                  dd={prochaineVgpAffichee(information)}
                />
              </Kv>
            </DetailBody>
          </CarteEnTete>

          <CarteEnTete
            bloc="carte-historique"
            titre={t("machine.fiche.historique_titre")}
            action={
              <Button variant="outline" size="sm" asChild>
                {/* LE SITE ET LA MACHINE ARRIVENT PRÉREMPLIS (LIENS-1) —
                    `/interventions/nouvelle` les lit et les présélectionne ;
                    un paramètre hors périmètre y est ignoré en silence. */}
                <Link
                  href={`/interventions/nouvelle?site=${machine.site_id}&machine=${machine.id}`}
                  data-bloc="historique-ajouter"
                >
                  {t("machine.fiche.historique_ajouter")}
                </Link>
              </Button>
            }
          >
            <div data-bloc="historique-table">
              <Tableau colonnes={colonnesHistorique} minimum="640px">
                {historique.length === 0 ? (
                  <LignePleine colonnes={colonnesHistorique.length}>
                    {t("machine.fiche.historique_vide")}
                  </LignePleine>
                ) : null}
                {historique.map((ligne) => (
                  <LigneHistorique
                    key={ligne.id}
                    ligne={ligne}
                    annuaire={annuaire}
                    machineId={machine.id}
                  />
                ))}
              </Tableau>
            </div>
          </CarteEnTete>

          {/* « Documents » — écart dans l'autre sens, gardé (lib/machines/
              ecarts-maquette.ts, ECARTS_MAQUETTE_AJOUTS_FICHE) : porte L8-02,
              machinePage() ne le dessine pas. Habillée comme les deux cartes
              voisines depuis N-12 (18/09/2026) — un titre et un sous-titre
              qui flottaient directement sur le fond gris, mesuré sur
              docs/propositions/n-11/fiche-en-panne-apres.png : CarteEnTete,
              jamais un <section> nu. */}
          <CarteEnTete
            bloc="carte-documents"
            titre={t("machine.documents.titre")}
            sousTitre={t("machine.documents.sous_titre")}
          >
            <div data-bloc="documents-table">
              <Tableau colonnes={colonnesDocuments} minimum="720px">
                {lignesDocuments.length === 0 ? (
                  <LignePleine colonnes={colonnesDocuments.length}>
                    {t("machine.documents.vide")}
                  </LignePleine>
                ) : null}
                {lignesDocuments.map((document) => (
                  <LigneDocument key={document.id} document={document} />
                ))}
              </Tableau>
            </div>
            <p className="text-app-encre-faible px-[18px] py-[12px] text-[11.5px]">
              {t("machine.documents.sans_octets")}
            </p>
          </CarteEnTete>
        </div>

        <aside
          data-bloc="qr-card"
          className="bg-app-surface border-app-bord zone-impression-qr rounded-lg border p-[20px] text-center min-[1181px]:sticky min-[1181px]:top-[88px]"
        >
          <div className="text-app-marque mb-[4px] text-[12px] font-extrabold tracking-[0.09em] uppercase">
            {t("machine.qr.eyebrow")}
          </div>
          <h2 className="mt-[4px] mb-[4px] text-[18px] font-extrabold">
            {t("machine.qr.titre")}
          </h2>
          <p className="text-app-encre-faible text-[12px]">
            {t("machine.qr.description")}
          </p>
          <div className="my-[12px]">
            <QrCode
              valeur={machine.qr_token}
              taille={220}
              titre={ariaLabelQr(machine)}
            />
          </div>
          <div className="font-mono font-black">
            {referenceMachine(machine)}
          </div>
          <div className="text-app-encre-faible text-[12px]">
            {ligneCodiplanAffichee(machine)}
          </div>
          <ActionsQrMachine identifiant={referenceMachine(machine)} />
        </aside>
      </div>
    </Page>
  );
}

function LigneDocument({ document }: { readonly document: DocumentDeMachine }) {
  return (
    <tr>
      <Cellule>{document.libelle}</Cellule>
      <Cellule>{t(`machine.documents.origine.${document.origine}`)}</Cellule>
      <Cellule>{t(`machine.documents.classe.${document.classe}`)}</Cellule>
      <Cellule mono>{document.nom_fichier}</Cellule>
    </tr>
  );
}

function LigneHistorique({
  ligne,
  annuaire,
  machineId,
}: {
  readonly ligne: LigneIntervention;
  readonly annuaire: Annuaire;
  /** Pour le retour de la fiche ouverte (FICHE-INTERVENTION-1) — `?depuis_id`. */
  readonly machineId: string;
}) {
  return (
    <tr>
      <Cellule>{dateAffichee(ligne.date_planifiee)}</Cellule>
      <Cellule mono>
        <Link
          href={`/interventions/${ligne.id}?depuis=machine&depuis_id=${machineId}`}
          className={CLASSES_LIEN}
        >
          {referenceAffichee(ligne)}
        </Link>
      </Cellule>
      <Cellule>{t(`type_intervention.${ligne.type}`)}</Cellule>
      <Cellule>{technicienAffiche(ligne, annuaire)}</Cellule>
      <Cellule>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASSES_STATUT[ligne.statut]}`}
        >
          {t(`statut.${ligne.statut}`)}
        </span>
      </Cellule>
    </tr>
  );
}

/**
 * LE TECHNICIEN AFFECTÉ — recopié de `app/(back-office)/interventions/
 * page.tsx` (même raison que `referenceMachine` : partager la FORME d'un
 * petit calcul de présentation ne vaut pas le détour). `quiTravaille`
 * distingue déjà le refus légitime du cloisonnement de l'oubli de l'écran ;
 * seul le cas SANS AFFECTATION change de libellé ici, pour la même raison
 * que là-bas — le pluriel d'un regroupement n'a pas de sens ligne à ligne
 * dans un historique où chaque ligne est une seule intervention.
 */
function technicienAffiche(
  ligne: LigneIntervention,
  annuaire: Annuaire,
): string {
  return ligne.technicien_id === null
    ? t("intervention.aucun_technicien")
    : quiTravaille(ligne.technicien_id, annuaire);
}

/**
 * LE CONTEXTE DE L'ALERTE — composé de FAITS RÉELS, jamais de la phrase
 * invariable de la maquette (« Une intervention curative est ouverte… »),
 * qui inventerait un type et un statut que la machine sélectionnée ne porte
 * peut-être pas.
 */
function contexteAlerteMachine(ligne: LigneIntervention): string {
  return `${referenceAffichee(ligne)} · ${t(`type_intervention.${ligne.type}`)} · ${t(`statut.${ligne.statut}`)}`;
}

/** L'en-tête de la bannière — `<marque> <référence du modèle>` (D126, point 3). */
function bannerTitre(machine: FicheMachine): string {
  return `${machine.modele.marque} ${machine.modele.reference}`;
}

/** Le sous-titre de l'en-tête — `<client> · <site>` (machinePage()). */
function sousTitreFiche(machine: FicheMachine): string {
  return `${machine.client.raison_sociale} ${t("machine.fiche.sous_titre_separateur")} ${lieuAffiche(machine)}`;
}

/** `aria-label` du QR — la RÉFÉRENCE, jamais l'`id` technique ni le jeton (I10, D71). */
function ariaLabelQr(machine: FicheMachine): string {
  return `${t("machine.qr.aria_prefixe")} ${referenceMachine(machine)}`;
}

/** La ligne « CODIPLAN:<référence> » sous le QR — la RÉFÉRENCE, jamais le jeton (D71). */
function ligneCodiplanAffichee(machine: FicheMachine): string {
  return `${t("machine.qr.jeton_prefixe")}${referenceMachine(machine)}`;
}

/**
 * L'ANNÉE DE VENTE, sur quatre chiffres (D126) — jamais la date complète,
 * jamais la mise en service à sa place. `date_vente` est une colonne
 * `@db.Date` : aucun fuseau ne s'y applique, comme `date_planifiee`
 * ailleurs dans ce dépôt.
 */
function anneeDeVenteAffichee(machine: FicheMachine): string {
  return machine.date_vente === null
    ? texteAbsent()
    : String(machine.date_vente.getUTCFullYear());
}

/**
 * LA PROCHAINE VGP — `libelleEcheance` rend déjà la phrase complète
 * (« Prochaine échéance — … », « Échéance dépassée — … », « Aucun rythme
 * déclaré ») pour les machines soumises et renseignées ; `null` couvre les
 * deux autres états (hors registre, sans information), que N-11 rend par
 * « à déterminer » plutôt que par le tiret des autres écrans — la fiche parle
 * d'une DÉCISION à prendre, pas d'une absence de champ.
 */
function prochaineVgpAffichee(
  information: Awaited<ReturnType<typeof informationDeLaMachine>>,
): string {
  if (information === null) {
    return t("machine.fiche.vgp_a_determiner");
  }
  return libelleEcheance(information) ?? t("machine.fiche.vgp_a_determiner");
}

/** Le signe d'absence, résolu par un APPEL plutôt que par la constante nue (L0-11). */
function texteAbsent(): string {
  return ABSENT;
}

/** `null` s'écrit « — », jamais une date vide qui se lirait comme une donnée. */
function dateAffichee(date: Date | null): string {
  return date === null ? texteAbsent() : dateCivile(date);
}

/**
 * LA RÉFÉRENCE AFFICHÉE — `numero`, ou `Local-<6 caractères>` (I10). Recopiée
 * de `app/(back-office)/parc/page.tsx`, comme cette dernière l'était déjà de
 * `app/(back-office)/interventions/presentation.ts` — la même forme, jamais
 * la même règle partagée.
 */
function referenceMachine(machine: {
  id: string;
  numero: number | null;
}): string {
  if (machine.numero !== null) {
    return `MAC-${String(machine.numero).padStart(6, "0")}`;
  }
  return `Local-${machine.id.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

/**
 * LES TONS DE LA PASTILLE DE STATUT — recopiés de `/parc` (même dérivation de
 * la maquette : En service → vert, En panne → rouge, Arrêtée → orange, les
 * trois statuts terminaux au gris neutre).
 */
const TONS_STATUT: Record<FicheMachine["statut"], TonBadge> = {
  en_service: "vert",
  en_panne: "rouge",
  arretee: "orange",
  remplacee: "gris",
  ferraillee: "gris",
  fusionnee: "gris",
};

function statutAffiche(statut: FicheMachine["statut"]): string {
  return t(`statut_machine.${statut}`);
}

/**
 * LE NUMÉRO DE SÉRIE AFFICHÉ — recopié de `/parc` (défaut n°1 de N-11, §5) :
 * un numéro illisible (`SN-INCONNU-…`) ne s'affiche jamais comme un vrai
 * numéro de série, il s'affiche comme ce qu'il est — une fiche à compléter.
 */
function numeroDeSerieAffiche(machine: FicheMachine): React.ReactNode {
  if (machine.complet) {
    return machine.numero_serie;
  }
  return (
    <>
      {texteAbsent()}
      <span className="mt-[3px] block font-sans">
        <Badge ton="orange">{t("machine.fiche.a_completer")}</Badge>
      </span>
    </>
  );
}

/**
 * LE LIEU AFFICHÉ — recopié de `/parc` (défaut n°3 de N-11, §5) : la commune
 * ne se répète pas quand elle vaut déjà le libellé du site.
 */
function lieuAffiche(machine: FicheMachine): string {
  const commune = machine.site.commune;
  const libelle = machine.site.libelle;
  return commune === null || commune === libelle
    ? libelle
    : `${libelle} — ${commune}`;
}
