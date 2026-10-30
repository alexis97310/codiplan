import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Page } from "@/components/mise-en-page/page";
import { FormulaireForfait } from "@/components/forfaits/formulaire";
import { FormulaireRegleFacturation } from "@/components/tarifs/formulaire-regle-facturation";
import { FormulaireTaux } from "@/components/taux-horaire/formulaire";
import { Badge } from "@/components/ui/badge";
import { Carte } from "@/components/ui/carte";
import { CarteEntite, GrilleCartesEntites } from "@/components/ui/carte-entite";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { RefusAcces } from "@/components/ui/refus-acces";
import { peut, peutPleinement } from "@/lib/auth/habilitations";
import { obtenirSession } from "@/lib/auth/session";
import {
  dateCivile,
  instantDuJour,
  jourDe,
  lireFuseau,
  maintenant,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { mot, motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import { montant } from "@/lib/money";
import { formatMoney } from "@/lib/money/format";
import { ZONES_GEOGRAPHIQUES, type ZoneGeographique } from "@/lib/sites/zones";
import { lireRegleArrondi } from "@/lib/societes/identite";
import {
  forfaitRetenu,
  TYPES_FORFAIT,
  type TypeForfait,
} from "@/lib/tarification/forfaits";
import {
  schemaSuccessionTaux,
  type SaisieSuccessionTaux,
} from "@/lib/tarification/succession-taux";
import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";

import {
  ABSENT,
  libelleType,
  resumeConditions,
} from "../forfaits/presentation";
import { statutDuTaux } from "../taux-horaire/presentation";

/**
 * UNE SEULE PAGE « TARIFS » (9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE, décisions
 * n° 97 et n° 98 d'Alexis, 13/10/2026, M:4478-4525) — remplace les deux
 * écrans `/parametres/taux-horaire` et `/parametres/forfaits` (catalogue),
 * rangés derrière UNE porte, à la lettre de la maquette.
 *
 * ## CE QUI NE CHANGE PAS
 *
 * Aucune valeur de prix, aucun calcul. Le taux en vigueur vient de
 * `tauxEnVigueur`, le forfait retenu par zone vient de `forfaitRetenu` —
 * les MÊMES fonctions que la valorisation d'une intervention
 * (`lib/interventions/depot.ts`). Cette page ne fait que choisir comment le
 * MONTRER (§9, 01/09 : une seconde lecture d'un même critère diverge en
 * silence).
 *
 * ## CE QUI CHANGE : LA DISPOSITION DU CATALOGUE DE FORFAITS
 *
 * Le tableau « une ligne par forfait » (rang, code, catégorie, conditions,
 * verdict) disparaît d'ICI. Decision n° 98 : D128 est LEVÉ pour ce tableau
 * — rang, code, catégorie, conditions et verdict restent sur la fiche d'un
 * forfait (`/parametres/forfaits/[id]`, gardée). Cette page montre, pour le
 * déplacement, UNE LIGNE PAR ZONE (les six de D23) — le forfait RETENU pour
 * cette zone, ou son absence —, et pour les trois autres natures, un bloc
 * « Autres forfaits » sans rang ni verdict (le calcul ne les sélectionne pas,
 * voir `verdict`/`forfaits/presentation.ts`).
 *
 * ## CHOIX DU PILOTE, ANNONCÉS À ALEXIS
 *
 * « Posé par » (aucun auteur ni date sur `TauxHoraire`), l'avertissement de
 * date d'effet passée (PA-12, non tranché) et « Historique » d'un forfait
 * (aucune date d'effet sur `Forfait`) sont OMIS. La case « Cumulable » est
 * RETIRÉE du formulaire (TP-ARG) ; la colonne `cumulable_temps` reste,
 * écrite à `false`.
 */

export const metadata = {
  title: t("tarifs.titre"),
};

type DeviseLue = { code: string; decimales: number; symbole: string | null };

type LigneTaux = {
  readonly id: string;
  readonly date_effet: Date;
  readonly montant_mineur: bigint;
  readonly devise_code: string;
};

type LigneForfait = {
  readonly id: string;
  readonly rang: number;
  readonly code: string;
  readonly libelle: string;
  readonly type: TypeForfait;
  readonly montant_mineur: bigint;
  readonly devise_code: string;
  // PRISMA NE DÉCLARE PAS UNE LISTE SCALAIRE NULLABLE (voir
  // `lib/tarification/forfaits.ts`) : `[]` lu, jamais `null`, pour « aucune
  // condition » — mêmes champs, même forme que `Ligne`, l'ancien type privé
  // de `forfaits/page.tsx`.
  readonly zone_geo: readonly string[];
  readonly famille_id: string | null;
  readonly type_intervention: readonly string[];
  readonly actif: boolean;
  readonly designations: number;
};

export default async function PageTarifs({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await obtenirSession(await headers());
  if (session === null) {
    redirect("/connexion");
  }
  const societeId = session.contexte.societeId;
  if (societeId === null) {
    redirect("/arrivee");
  }

  // LES TARIFS (TAUX HORAIRE ET FORFAITS) SONT OUVERTS AUX RÔLES QUI LES
  // PARAMÈTRENT (`parametrer_societe`) OU QUI EN ONT BESOIN POUR CHIFFRER
  // (`voir_montants_vente`), c'est-à-dire ADMS, DIR, RM, RS, ADV (QT-2, D152,
  // choix 6). Le technicien n'a ni l'une ni l'autre : refusé, nommé.
  const peutLire =
    session.contexte.role !== null &&
    (peut(session.contexte.role, "parametrer_societe") ||
      peut(session.contexte.role, "voir_montants_vente"));
  if (!peutLire) {
    return (
      <Page chemin="/parametres/tarifs" titre={t("tarifs.titre")}>
        <RefusAcces />
      </Page>
    );
  }
  // D153 (03/10/2026, TP-S3, PA-02) — le ○ de la direction sur
  // `parametrer_societe` lit, il n'écrit plus.
  const peutEcrire =
    session.contexte.role !== null &&
    peutPleinement(session.contexte.role, "parametrer_societe");

  const parametres = await searchParams;
  const motif = parametres.motif;
  const filtreSansForfait = parametres.vue === "sans-forfait";

  // LA RESOUMISSION APRÈS UN REFUS, préfixée `forfait_` (9BR-TP-A4b-MESSAGES,
  // PV-45) — même mécanique que l'ancien `/parametres/forfaits`.
  const champForfait = (nom: string): string | undefined =>
    typeof parametres[`forfait_${nom}`] === "string"
      ? (parametres[`forfait_${nom}`] as string)
      : undefined;
  const zoneForfaitDemandee =
    typeof parametres.zone_forfait === "string" &&
    (ZONES_GEOGRAPHIQUES as readonly string[]).includes(parametres.zone_forfait)
      ? parametres.zone_forfait
      : undefined;
  const defautsForfait =
    champForfait("code") === undefined &&
    champForfait("libelle") === undefined &&
    champForfait("type") === undefined &&
    champForfait("rang") === undefined &&
    champForfait("montant_mineur") === undefined &&
    champForfait("zone_geo") === undefined &&
    zoneForfaitDemandee === undefined
      ? undefined
      : {
          code: champForfait("code") ?? "",
          libelle: champForfait("libelle") ?? "",
          type: champForfait("type") ?? "",
          rang: Number(champForfait("rang") ?? "") || 0,
          montant_mineur: champForfait("montant_mineur") ?? "",
          zone_geo:
            champForfait("zone_geo") !== undefined
              ? [champForfait("zone_geo") as string]
              : zoneForfaitDemandee !== undefined
                ? [zoneForfaitDemandee]
                : [],
          actif: champForfait("actif") !== "0",
        };

  // LA CONFIRMATION D'UN NOUVEAU TAUX — reconstruite depuis les paramètres
  // d'URL que la route a posés, jamais depuis une saisie non revalidée.
  const brutTaux = {
    montant_mineur: Number(parametres.montant_mineur),
    date_effet: parametres.date_effet,
  };
  const analyseConfirmation =
    parametres.confirmer === "1"
      ? schemaSuccessionTaux.safeParse(brutTaux)
      : null;

  const { historiqueTaux, enVigueurDepuis, devise, catalogue, sitesParZone } =
    await avecContexteApplicatif(session.contexte, async (tx) => {
      const societeLue = await tx.societe.findUnique({
        where: { id: societeId },
        select: {
          fuseau_horaire: true,
          devise: { select: { code: true, decimales: true, symbole: true } },
        },
      });
      const [lignesTaux, forfaits, groupesSites] = await Promise.all([
        tx.tauxHoraire.findMany({
          select: {
            id: true,
            date_effet: true,
            montant_mineur: true,
            devise_code: true,
          },
          orderBy: { date_effet: "desc" },
        }),
        tx.forfait.findMany({
          select: {
            id: true,
            code: true,
            libelle: true,
            type: true,
            rang: true,
            montant_mineur: true,
            devise_code: true,
            zone_geo: true,
            famille_id: true,
            type_intervention: true,
            actif: true,
            _count: { select: { interventions: true } },
          },
          orderBy: [{ type: "asc" }, { rang: "asc" }],
        }),
        tx.site.groupBy({
          by: ["zone_geo"],
          where: { actif: true },
          _count: { _all: true },
        }),
      ]);
      // « Aujourd'hui » se lit dans le fuseau de la SOCIÉTÉ (L0-08) — même
      // lecture que l'ancien `/parametres/taux-horaire`.
      const actuel =
        societeLue === null
          ? null
          : await tauxEnVigueur(
              tx,
              instantDuJour(
                jourDe(maintenant(lireFuseau(societeLue.fuseau_horaire)).local),
              ),
            );
      return {
        historiqueTaux: lignesTaux,
        enVigueurDepuis: actuel?.dateEffet.getTime() ?? null,
        devise: societeLue?.devise ?? null,
        catalogue: forfaits.map((f) => ({
          ...f,
          designations: f._count.interventions,
        })),
        sitesParZone: new Map(
          groupesSites
            .filter((g) => g.zone_geo !== null)
            .map((g): [string, number] => [
              g.zone_geo as string,
              g._count._all,
            ]),
        ),
      };
    });

  // LA RÈGLE D'ARRONDI DU TEMPS FACTURÉ (9I8A1-REPRISE-9I8A, décision
  // d'Alexis du 29/10/2026) — réglage de société, lu à part : il ne dépend
  // d'aucune des requêtes ci-dessus et n'a pas sa place dans leur `tx`
  // commune, qui sert le taux et les forfaits.
  const regleArrondi = await lireRegleArrondi(session.contexte);

  const deplacementsActifs = catalogue.filter(
    (f) => f.type === "deplacement" && f.actif,
  );
  const retenuParZone = new Map<ZoneGeographique, LigneForfait | null>(
    ZONES_GEOGRAPHIQUES.map((zone): [ZoneGeographique, LigneForfait | null] => [
      zone,
      forfaitRetenu(deplacementsActifs, {
        zone,
        familleId: null,
        typeIntervention: null,
      }),
    ]),
  );
  const zonesAffichees = ZONES_GEOGRAPHIQUES.filter(
    (zone) => !filtreSansForfait || retenuParZone.get(zone) === null,
  );

  // UN FORFAIT DE DÉPLACEMENT NON RETENU — inactif, ou masqué par un rang
  // plus petit sur chaque zone où il s'appliquerait (9EWE1, point 1) — n'a
  // plus de ligne dans `BlocForfaitsDeplacement` ci-dessous, qui ne montre
  // QUE le retenu. Il reste atteignable ici, trié par rang croissant.
  const idsRetenus = new Set(
    Array.from(retenuParZone.values())
      .filter((f): f is LigneForfait => f !== null)
      .map((f) => f.id),
  );
  const deplacementsNonRetenus = catalogue
    .filter((f) => f.type === "deplacement" && !idsRetenus.has(f.id))
    .sort((a, b) => a.rang - b.rang);

  const autresForfaits = TYPES_FORFAIT.filter((type) => type !== "deplacement");

  return (
    <Page
      chemin="/parametres/tarifs"
      titre={t("tarifs.titre")}
      filAriane={[
        { libelle: t("nav.societes_tarifs"), href: "/parametres" },
        { libelle: t("tarifs.titre") },
      ]}
      sousTitre={t("tarifs.sous_titre")}
    >
      {typeof motif === "string" && estCleTraduction(motif) ? (
        <p
          role="status"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motif)}
        </p>
      ) : null}

      {!filtreSansForfait ? (
        <>
          <BlocTauxHoraire
            historique={historiqueTaux}
            enVigueurDepuis={enVigueurDepuis}
            devise={devise}
          />

          {peutEcrire ? (
            <Carte titre={t("taux_horaire.poser")}>
              {analyseConfirmation?.success === true && devise !== null ? (
                <ConfirmationTaux
                  saisie={analyseConfirmation.data}
                  devise={devise}
                />
              ) : (
                <FormulaireTaux
                  action="/api/parametres/taux-horaire/creer"
                  devise={devise}
                />
              )}
            </Carte>
          ) : null}

          {/*
            LA RÈGLE D'ARRONDI DU TEMPS FACTURÉ (9I8A1-REPRISE-9I8A, décision
            d'Alexis du 29/10/2026) — même garde que « Poser un nouveau taux »
            ci-dessus (admin_societe et direction seulement, §8 CLAUDE.md) ;
            visible même quand `afficher_montants` est désactivé (décision du
            29/10/2026, option A, 9I8-AFFICHAGE-DES-MONTANTS) : ce bloc
            paramètre un calcul, il n'affiche aucun montant d'intervention.
          */}
          {peutEcrire ? (
            <Carte titre={t("tarifs.regle_facturation.titre")}>
              <FormulaireRegleFacturation
                action="/api/parametres/tarifs/regle-facturation"
                regle={regleArrondi}
              />
            </Carte>
          ) : null}
        </>
      ) : (
        <p
          role="status"
          className="border-app-bleu-bord bg-app-bleu-fond text-app-bleu-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t("tarifs.filtre_sans_forfait_libelle")}
          {t("ponctuation.parenthese_ouvrante")}
          {zonesAffichees.length}
          {t("ponctuation.parenthese_fermante")}
          {t("ponctuation.separateur")}
          <Link href="/parametres/tarifs" className="underline">
            {t("tarifs.filtre_effacer")}
          </Link>
        </p>
      )}

      <BlocForfaitsDeplacement
        zones={zonesAffichees}
        retenuParZone={retenuParZone}
        sitesParZone={sitesParZone}
        devise={devise}
        peutEcrire={peutEcrire}
      />

      <BlocAutresForfaitsDeplacement forfaits={deplacementsNonRetenus} />

      {!filtreSansForfait &&
      autresForfaits.some(
        (type) => catalogue.filter((f) => f.type === type).length > 0,
      ) ? (
        <BlocAutresForfaits
          types={autresForfaits}
          catalogue={catalogue}
          devise={devise}
        />
      ) : null}

      {peutEcrire && !filtreSansForfait ? (
        <Carte id="tarifs-nouveau-forfait" titre={t("tarifs.forfaits_nouveau")}>
          <div className="flex flex-col gap-3 px-4 py-4">
            <FormulaireForfait
              action="/api/parametres/forfaits/creer"
              defauts={defautsForfait}
              devise={devise}
            />
            <p className="text-app-encre-faible text-12 font-bold">
              {t("forfaits.desactiver_explication")}
            </p>
          </div>
        </Carte>
      ) : null}
    </Page>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * BLOC « Taux horaire »
 * ──────────────────────────────────────────────────────────────────────── */

function BlocTauxHoraire({
  historique,
  enVigueurDepuis,
  devise,
}: {
  readonly historique: readonly LigneTaux[];
  readonly enVigueurDepuis: number | null;
  readonly devise: DeviseLue | null;
}) {
  const colonnes = [
    {
      cle: "date_effet",
      libelle: t("tarifs.taux_colonne_date"),
      largeur: "150px",
    },
    {
      cle: "montant",
      libelle: t("tarifs.taux_colonne_montant"),
      droite: true,
      largeur: "190px",
    },
    { cle: "etat", libelle: t("tarifs.taux_colonne_etat") },
  ];
  const statuts = statutDuTaux(historique, enVigueurDepuis);

  return (
    <Carte
      bloc="bloc-taux-horaire"
      // SOUS 900 PX, LA BORDURE SORT (audit du 21/10/2026, 9G9A) — voir la
      // même note sur `bloc-forfaits-deplacement` plus bas dans ce fichier.
      className="max-[900px]:rounded-none max-[900px]:border-0 max-[900px]:bg-transparent"
    >
      <h2 className="border-app-bord border-b px-4 py-3.5 text-[14px] font-bold max-[900px]:border-0 max-[900px]:px-0">
        {t("taux_horaire.titre")}
      </h2>
      <div data-bloc="historique-taux" className="max-[900px]:hidden">
        <Tableau colonnes={colonnes} minimum="560px">
          {historique.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("taux_horaire.vide")}
            </LignePleine>
          ) : null}
          {historique.map((ligne, index) => (
            <tr key={ligne.id}>
              <Cellule>{dateCivile(ligne.date_effet)}</Cellule>
              <Cellule droite fort>
                <span className="tabular-nums">
                  {montantAfficheTaux(ligne, devise)}
                </span>
              </Cellule>
              <Cellule>{badgeStatutTaux(statuts[index])}</Cellule>
            </tr>
          ))}
        </Tableau>
      </div>
      {/* SOUS 900 PX — des cartes plutôt qu'un tableau tronqué (9EWE1,
          point 3) : la même grille que les écrans de référentiel
          (`components/ui/carte-entite.tsx`), aucune ligne masquée. */}
      <div
        data-bloc="historique-taux-cartes"
        className="min-[901px]:hidden p-4"
      >
        {historique.length === 0 ? (
          <p className="text-app-encre-faible text-13 font-bold">
            {t("taux_horaire.vide")}
          </p>
        ) : (
          <GrilleCartesEntites>
            {historique.map((ligne, index) => (
              <CarteEntite
                key={ligne.id}
                titre={dateCivile(ligne.date_effet)}
                badge={badgeStatutTaux(statuts[index])}
                lignes={[
                  `${t("tarifs.taux_colonne_montant")}${t("ponctuation.deux_points")}${montantAfficheTaux(ligne, devise)}`,
                ]}
                compteurs={[]}
              />
            ))}
          </GrilleCartesEntites>
        )}
      </div>
    </Carte>
  );
}

function badgeStatutTaux(texte: string | null): ReactNode {
  if (texte === null) {
    return ABSENT;
  }
  const ton =
    texte === t("taux_horaire.en_vigueur")
      ? "vert"
      : texte.startsWith(t("taux_horaire.a_partir_du"))
        ? "bleu"
        : "gris";
  return <Badge ton={ton}>{texte}</Badge>;
}

function montantAfficheTaux(
  ligne: LigneTaux,
  devise: DeviseLue | null,
): string {
  if (devise === null || devise.code !== ligne.devise_code) {
    return ABSENT;
  }
  return formatMoney(
    { nature: "reel", valeur: ligne.montant_mineur, devise: ligne.devise_code },
    devise,
  );
}

/**
 * L'ÉCRAN DE CONFIRMATION — le montant RELU FORMATÉ, avant toute écriture
 * (TAUX-1). Formulaire à champs CACHÉS : rien n'est resaisi.
 */
function ConfirmationTaux({
  saisie,
  devise,
}: {
  readonly saisie: SaisieSuccessionTaux;
  readonly devise: DeviseLue;
}) {
  return (
    <Carte
      bloc="confirmer-taux"
      variante="imbriquee"
      className="flex flex-col gap-4 px-4 py-4"
    >
      <p className="text-[13px] font-bold">
        {t("taux_horaire.confirmer.explication")}
      </p>
      <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-[13px] font-bold">
        <dt className="text-app-encre-faible text-[12px] font-bold">
          {t("taux_horaire.confirmer.montant")}
        </dt>
        <dd className="font-semibold">
          {formatMoney(montant(saisie.montant_mineur, devise.code), devise)}
        </dd>
        <dt className="text-app-encre-faible text-[12px] font-bold">
          {t("taux_horaire.confirmer.date_effet")}
        </dt>
        <dd className="font-semibold">
          {dateCivile(new Date(`${saisie.date_effet}T00:00:00.000Z`))}
        </dd>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <form method="post" action="/api/parametres/taux-horaire/creer">
          <input
            type="hidden"
            name="montant_mineur"
            value={saisie.montant_mineur}
          />
          <input type="hidden" name="date_effet" value={saisie.date_effet} />
          <input type="hidden" name="confirme" value="oui" />
          <button
            type="submit"
            className="bg-app-marque text-app-marque-encre rounded-md px-4 py-1.5 text-[13px] font-bold"
          >
            {t("taux_horaire.confirmer.confirmer")}
          </button>
        </form>
        <Link
          href="/parametres/tarifs"
          className="border-app-bord rounded-md border px-4 py-1.5 text-[13px] font-bold"
        >
          {t("taux_horaire.confirmer.annuler")}
        </Link>
      </div>
    </Carte>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * BLOC « Forfaits » — une ligne par zone, le déplacement RETENU
 * ──────────────────────────────────────────────────────────────────────── */

function BlocForfaitsDeplacement({
  zones,
  retenuParZone,
  sitesParZone,
  devise,
  peutEcrire,
}: {
  readonly zones: readonly ZoneGeographique[];
  readonly retenuParZone: ReadonlyMap<ZoneGeographique, LigneForfait | null>;
  readonly sitesParZone: ReadonlyMap<string, number>;
  readonly devise: DeviseLue | null;
  readonly peutEcrire: boolean;
}) {
  const colonnes = [
    { cle: "forfait", libelle: t("tarifs.forfaits_colonne_forfait") },
    {
      cle: "applique_a",
      libelle: t("tarifs.forfaits_colonne_applique_a"),
    },
    {
      cle: "montant",
      libelle: t("forfaits.montant"),
      droite: true,
      largeur: "150px",
    },
    {
      cle: "designe_par",
      libelle: t("tarifs.forfaits_colonne_designe_par"),
      largeur: "150px",
    },
    { cle: "action", libelle: "", largeur: "120px" },
  ];

  return (
    <Carte
      bloc="bloc-forfaits-deplacement"
      // SOUS 900 PX, LA BORDURE SORT (audit du 21/10/2026, 9G9A) — en
      // dessous de ce seuil, le tableau cède la place à des `CarteEntite`
      // DÉJÀ bordées (GrilleCartesEntites, plus bas) : garder la bordure de
      // la section posait une carte dans une carte.
      className="max-[900px]:rounded-none max-[900px]:border-0 max-[900px]:bg-transparent"
    >
      <h2 className="border-app-bord border-b px-4 py-3.5 text-[14px] font-bold max-[900px]:border-0 max-[900px]:px-0">
        {t("tarifs.forfaits_titre")}
      </h2>
      <div className="max-[900px]:hidden">
        <Tableau colonnes={colonnes} minimum="900px">
          {zones.map((zone) => {
            const retenu = retenuParZone.get(zone) ?? null;
            const nS = sitesParZone.get(zone) ?? 0;
            const action = actionZoneForfait(zone, retenu, peutEcrire);
            return (
              <tr key={zone}>
                <Cellule>
                  <span className="font-bold">
                    {t("type_forfait.deplacement")}
                    {t("ponctuation.point_median")}
                    {libelleZoneAffichee(zone)}
                  </span>
                  {retenu === null ? (
                    <div className="text-app-orange-encre text-12 font-bold">
                      {t("tarifs.forfaits_aucun_forfait")}
                    </div>
                  ) : null}
                </Cellule>
                <Cellule>
                  {mot("site", true)} {t("tarifs.forfaits_de_la_zone")}{" "}
                  {libelleZoneAffichee(zone)}
                  <div className="text-app-encre-faible text-12 font-bold">
                    {nS} {motDansUnePhrase("site", nS > 1)}{" "}
                    {t("tarifs.forfaits_aujourdhui_suffixe")}
                  </div>
                </Cellule>
                <Cellule droite fort>
                  {retenu === null ? (
                    <span className="text-app-orange-encre text-13 font-bold">
                      {t("tarifs.forfaits_non_facture")}
                    </span>
                  ) : (
                    <span className="tabular-nums">
                      {montantAfficheForfait(retenu, devise)}
                    </span>
                  )}
                </Cellule>
                <Cellule>
                  {retenu === null
                    ? ABSENT
                    : libelleDesignations(retenu.designations)}
                </Cellule>
                <Cellule>{action}</Cellule>
              </tr>
            );
          })}
        </Tableau>
      </div>
      {/* SOUS 900 PX — mêmes données, en cartes (9EWE1, point 3). */}
      <div className="min-[901px]:hidden p-4">
        {zones.length === 0 ? null : (
          <GrilleCartesEntites>
            {zones.map((zone) => {
              const retenu = retenuParZone.get(zone) ?? null;
              const nS = sitesParZone.get(zone) ?? 0;
              const action = actionZoneForfait(zone, retenu, peutEcrire);
              return (
                <CarteEntite
                  key={zone}
                  titre={`${t("type_forfait.deplacement")}${t("ponctuation.point_median")}${libelleZoneAffichee(zone)}`}
                  lignes={[
                    `${mot("site", true)} ${t("tarifs.forfaits_de_la_zone")} ${libelleZoneAffichee(zone)}${t("ponctuation.point_median")}${nS} ${motDansUnePhrase("site", nS > 1)} ${t("tarifs.forfaits_aujourdhui_suffixe")}`,
                    retenu === null ? (
                      <span key="designe" className="text-app-orange-encre">
                        {t("tarifs.forfaits_aucun_forfait")}
                      </span>
                    ) : (
                      `${t("tarifs.forfaits_colonne_designe_par")}${t("ponctuation.deux_points")}${libelleDesignations(retenu.designations)}`
                    ),
                    <span key="action">{action}</span>,
                  ]}
                  compteurs={[
                    {
                      valeur:
                        retenu === null
                          ? t("tarifs.forfaits_non_facture")
                          : montantAfficheForfait(retenu, devise),
                      libelle: t("forfaits.montant"),
                    },
                  ]}
                />
              );
            })}
          </GrilleCartesEntites>
        )}
      </div>
      <p className="text-app-encre-faible border-app-bord border-t px-4 py-3 text-12 font-bold">
        {t("tarifs.forfaits_pied")}
      </p>
    </Carte>
  );
}

/** Le lien d'action d'une ligne de zone — « Modifier » ou « Créer » (table ET carte, 9EWE1 point 3). */
function actionZoneForfait(
  zone: ZoneGeographique,
  retenu: LigneForfait | null,
  peutEcrire: boolean,
): ReactNode {
  if (retenu !== null) {
    return (
      <Link
        href={`/parametres/forfaits/${retenu.id}`}
        className="border-app-bord rounded-md border px-2.5 py-1 text-[12px] font-bold"
      >
        {t("forfaits.modifier")}
      </Link>
    );
  }
  if (!peutEcrire) {
    return null;
  }
  return (
    <Link
      href={`/parametres/tarifs?zone_forfait=${zone}#tarifs-nouveau-forfait`}
      className="border-app-bord rounded-md border px-2.5 py-1 text-[12px] font-bold"
    >
      {t("tarifs.forfaits_creer")}
    </Link>
  );
}

/** « N intervention(s) », ou « aucune » — « Désigné par » (TARIFS-9EWE). */
function libelleDesignations(n: number): string {
  if (n === 0) {
    return t("tarifs.forfaits_aucune_intervention");
  }
  return `${n} ${n === 1 ? t("tarifs.forfaits_intervention_un") : t("tarifs.forfaits_intervention")}`;
}

function libelleZoneAffichee(zone: string): string {
  const cle = `zone.${zone}`;
  return estCleTraduction(cle) ? t(cle) : zone;
}

function montantAfficheForfait(
  forfait: LigneForfait,
  devise: DeviseLue | null,
): string {
  if (devise === null || devise.code !== forfait.devise_code) {
    return ABSENT;
  }
  return formatMoney(
    {
      nature: "reel",
      valeur: forfait.montant_mineur,
      devise: forfait.devise_code,
    },
    devise,
  );
}

/**
 * LES FORFAITS DE DÉPLACEMENT NON RETENUS — repliés, pour ne pas reproduire
 * sous les yeux le tableau « une ligne par zone » que D128/décision n° 98
 * retire d'ici (9EWE1-TARIFS-SOLDE, point 1). Un forfait inactif, ou masqué
 * par un rang plus petit sur chaque zone où il s'appliquerait, n'avait plus
 * aucun lien « Modifier » : cette liste le rend de nouveau atteignable,
 * SANS toucher au rang ni au montant qui décident du retenu.
 */
function BlocAutresForfaitsDeplacement({
  forfaits,
}: {
  readonly forfaits: readonly LigneForfait[];
}) {
  if (forfaits.length === 0) {
    return null;
  }
  const colonnes = [
    { cle: "forfait", libelle: t("tarifs.forfaits_colonne_forfait") },
    { cle: "rang", libelle: t("forfaits.rang"), largeur: "90px" },
    {
      cle: "etat",
      libelle: t("tarifs.taux_colonne_etat"),
      largeur: "120px",
    },
    { cle: "action", libelle: "", largeur: "120px" },
  ];
  return (
    <details data-bloc="autres-forfaits-deplacement">
      <summary className="text-[13px] font-bold">
        {t("tarifs.forfaits_autres_deplacement_titre")}
        {t("ponctuation.parenthese_ouvrante")}
        {forfaits.length}
        {t("ponctuation.parenthese_fermante")}
      </summary>
      <div className="mt-3">
        <Tableau colonnes={colonnes} minimum="560px">
          {forfaits.map((forfait) => (
            <tr key={forfait.id}>
              <Cellule>
                <span className="font-bold">{forfait.code}</span>
                <div className="text-app-encre-faible text-12 font-bold">
                  {forfait.libelle}
                </div>
              </Cellule>
              <Cellule>{forfait.rang}</Cellule>
              <Cellule>
                <Badge ton={forfait.actif ? "vert" : "gris"}>
                  {forfait.actif ? t("forfaits.actif") : t("forfaits.inactif")}
                </Badge>
              </Cellule>
              <Cellule>
                <Link
                  href={`/parametres/forfaits/${forfait.id}`}
                  className="border-app-bord rounded-md border px-2.5 py-1 text-[12px] font-bold"
                >
                  {t("forfaits.modifier")}
                </Link>
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </div>
    </details>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * BLOC « Autres forfaits » — mise en service, contrôle, prestation
 * ──────────────────────────────────────────────────────────────────────── */

function BlocAutresForfaits({
  types,
  catalogue,
  devise,
}: {
  readonly types: readonly TypeForfait[];
  readonly catalogue: readonly LigneForfait[];
  readonly devise: DeviseLue | null;
}) {
  const colonnes = [
    { cle: "forfait", libelle: t("tarifs.forfaits_colonne_forfait") },
    {
      cle: "applique_a",
      libelle: t("tarifs.forfaits_colonne_applique_a"),
    },
    {
      cle: "montant",
      libelle: t("forfaits.montant"),
      droite: true,
      largeur: "150px",
    },
    {
      cle: "designe_par",
      libelle: t("tarifs.forfaits_colonne_designe_par"),
      largeur: "150px",
    },
    { cle: "action", libelle: "", largeur: "120px" },
  ];
  const lignes = types.flatMap((type) =>
    catalogue.filter((f) => f.type === type),
  );
  if (lignes.length === 0) {
    return null;
  }

  return (
    <Carte
      bloc="bloc-autres-forfaits"
      // SOUS 900 PX, LA BORDURE SORT (audit du 21/10/2026, 9G9A) — voir la
      // même note sur `bloc-forfaits-deplacement` plus haut dans ce fichier.
      className="max-[900px]:rounded-none max-[900px]:border-0 max-[900px]:bg-transparent"
    >
      <h2 className="border-app-bord border-b px-4 py-3.5 text-[14px] font-bold max-[900px]:border-0 max-[900px]:px-0">
        {t("tarifs.autres_forfaits_titre")}
      </h2>
      <div className="max-[900px]:hidden">
        <Tableau colonnes={colonnes} minimum="900px">
          {lignes.map((forfait) => (
            <tr key={forfait.id}>
              <Cellule>
                <span className="font-bold">{forfait.libelle}</span>
                <div className="text-app-encre-faible text-12 font-bold">
                  {libelleType(forfait.type)}
                </div>
              </Cellule>
              <Cellule>{resumeConditionsAffichee(forfait)}</Cellule>
              <Cellule droite fort>
                <span className="tabular-nums">
                  {montantAfficheForfait(forfait, devise)}
                </span>
              </Cellule>
              <Cellule>{libelleDesignations(forfait.designations)}</Cellule>
              <Cellule>
                <Link
                  href={`/parametres/forfaits/${forfait.id}`}
                  className="border-app-bord rounded-md border px-2.5 py-1 text-[12px] font-bold"
                >
                  {t("forfaits.modifier")}
                </Link>
              </Cellule>
            </tr>
          ))}
        </Tableau>
      </div>
      {/* SOUS 900 PX — mêmes données, en cartes (9EWE1, point 3). */}
      <div className="min-[901px]:hidden p-4">
        <GrilleCartesEntites>
          {lignes.map((forfait) => (
            <CarteEntite
              key={forfait.id}
              titre={forfait.libelle}
              lignes={[
                libelleType(forfait.type),
                resumeConditionsAffichee(forfait),
                `${t("tarifs.forfaits_colonne_designe_par")}${t("ponctuation.deux_points")}${libelleDesignations(forfait.designations)}`,
                <Link
                  key="action"
                  href={`/parametres/forfaits/${forfait.id}`}
                  className="border-app-bord inline-block rounded-md border px-2.5 py-1 text-[12px] font-bold"
                >
                  {t("forfaits.modifier")}
                </Link>,
              ]}
              compteurs={[
                {
                  valeur: montantAfficheForfait(forfait, devise),
                  libelle: t("forfaits.montant"),
                },
              ]}
            />
          ))}
        </GrilleCartesEntites>
      </div>
    </Carte>
  );
}

function resumeConditionsAffichee(forfait: LigneForfait): string {
  return resumeConditions({
    zone_geo: forfait.zone_geo,
    famille_id: forfait.famille_id,
    type_intervention: forfait.type_intervention,
  });
}
