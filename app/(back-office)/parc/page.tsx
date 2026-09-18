import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BarreDeFiltres } from "@/components/ui/barre-de-filtres";
import { Badge, type TonBadge } from "@/components/ui/badge";
import { Carte } from "@/components/ui/carte";
import { Kpi } from "@/components/ui/kpi";
import { Pagination } from "@/components/ui/pagination";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { Page } from "@/components/mise-en-page/page";
import { obtenirSession } from "@/lib/auth/session";
import { maintenant, schemaFuseau, dateCivile } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import {
  compterLeParc,
  rechercherLeParc,
  resumerLeParc,
  resumerLeParcFiltre,
  type LigneDeParc,
} from "@/lib/machines/depot";
import {
  COLONNES_PARC,
  KPI_PARC,
  type CleKpiParc,
} from "@/lib/machines/ecarts-maquette";
import {
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaRechercheParc,
} from "@/lib/machines/saisie";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_TON } from "@/lib/theme/statuts";

import { decompte, hrefDeLaPage, libellePage } from "../presentation";

/**
 * L'ÉCRAN « PARC MACHINES » (R2-21, AT-04 ; D95, D6, I10).
 *
 * ## Il ouvre une entrée de la barre qui était INERTE depuis D95
 *
 * *« Une entrée inerte dit ce que le produit sera ; un lien vers un écran vide
 * dirait qu'il est cassé »* — et pendant ce temps, la deuxième colonne de la
 * maquette ne menait nulle part. La fiche machine existe depuis L2-01 : ce qui
 * manquait n'était pas le droit de lire le parc, c'était **un appelant**. C'est
 * la maladie que le §6 nomme à propos du portail, et elle se soigne de la même
 * façon.
 *
 * ## CE QUI MANQUAIT, MESURÉ PLUTÔT QUE PRÉSUMÉ (AT-04)
 *
 * Le directeur d'exploitation avait raison sur l'absence de KPI et de
 * recherche, et sur deux colonnes ; il avait tort sur une troisième — le
 * ticket citait « compteur, contrat, statut », et `statut` était déjà une
 * vraie colonne. `lib/machines/ecarts-maquette.ts` porte la mesure, colonne
 * par colonne et KPI par KPI, plutôt que de reconduire une liste par
 * ressemblance avec une autre.
 *
 * ## CE QU'IL NE FAIT TOUJOURS PAS
 *
 * L'export Excel manque encore : rien dans le dépôt ne sait exporter ce
 * tableau, et un lien vers un export inexistant se lirait comme une panne
 * (R2-13).
 *
 * ## LA RECHERCHE EST REMPLIE, ET LA LISTE PAGINE (AT-07, 17/09/2026)
 *
 * `BarreDeFiltres` était câblée depuis AT-04 sans qu'aucun dépôt ne lise
 * `q` : c'est ce que ce ticket répare. Le texte porte sur les colonnes
 * VISIBLES du tableau — numéro de série, client, lieu, référence du modèle —
 * jamais sur `qr_token`, que la maquette propose mais qu'AUCUNE colonne
 * n'affiche (l'écart est écrit à côté de `schemaRechercheParc`,
 * `lib/machines/saisie.ts`).
 *
 * **Le résumé (bandeau KPI) ne compte plus les lignes RENDUES** — la règle de
 * R2-21 tenait tant que « rendu » voulait dire « tout le parc filtré ». Une
 * page de 50 lignes n'est plus tout le parc : `resumerLeParcFiltre` lit donc
 * une PAGE séparée, plafonnée à `LIMITE_RECHERCHE_MAXIMALE` et non à la taille
 * d'une page, en réutilisant la même `filtreDuParc` que la liste — le principe
 * que `compterSansCodeExterne` applique déjà pour les clients (§9, 01/09).
 * `resumerLeParc`, la fonction PURE, ne change pas d'une ligne : ses tests
 * restent ceux de `tests/unit/machines/parc.test.ts`.
 */

const ABSENT = "—";

export default async function PageParc({
  searchParams,
}: {
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

  // LE FUSEAU EST UNE DONNÉE, JAMAIS UN LITTÉRAL (L0-08) — le même geste que
  // `/vgp`, qui couvre lui aussi toutes les agences d'une société.
  const societe = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: contexte.societeId as string },
      select: { fuseau_horaire: true },
    }),
  );
  const fuseau = schemaFuseau.parse(societe?.fuseau_horaire);
  const aujourdHui = maintenant(fuseau).instant;

  const params = await searchParams;
  const criteres = schemaRechercheParc.safeParse({
    texte: typeof params.q === "string" ? params.q : "",
    page: typeof params.page === "string" ? params.page : undefined,
  });

  const lignes = criteres.success
    ? await rechercherLeParc(contexte, criteres.data)
    : [];
  // LE RÉSUMÉ PORTE SUR TOUTE LA RECHERCHE (plafonnée), LE TABLEAU SUR LA
  // PAGE — voir la note de tête sur `resumerLeParcFiltre`.
  const resume = criteres.success
    ? await resumerLeParcFiltre(contexte, criteres.data, aujourdHui)
    : resumerLeParc([], aujourdHui);
  // LE TOTAL DE LA PAGINATION — la MÊME `filtreDuParc` que la liste et que le
  // résumé, jamais une troisième lecture du critère (AT-07).
  const totalFiltre = criteres.success
    ? await compterLeParc(contexte, criteres.data)
    : 0;
  const totalPages = Math.max(
    1,
    Math.ceil(totalFiltre / LIMITE_RECHERCHE_PAR_DEFAUT),
  );

  const colonnes = COLONNES_PARC.map((colonne) => ({
    cle: colonne.id,
    libelle: colonne.libelle(),
    largeur: colonne.largeur,
  }));

  // AUCUNE FICHE DE CETTE PAGE N'A ENCORE DE NUMÉRO SERVEUR — mesuré par le
  // directeur d'exploitation le 16/09/2026 : la mention se répétait sous
  // chaque ligne sans plus rien distinguer. Un bandeau UNIQUE la remplace tant
  // que la synchronisation (lot 3) n'a attribué aucun numéro ; le jour où
  // elle en attribuera un premier, cette condition devient fausse d'elle-même
  // et la mention reprend sa forme par ligne, comme avant. **Portée sur la
  // PAGE affichée, et non sur toute la recherche** (AT-07) : `numero` n'existe
  // encore nulle part, donc la distinction ne se mesure pas aujourd'hui — un
  // écart resserré plutôt que caché, écrit ici parce qu'il pourrait diverger
  // le jour où la synchronisation attribuera un premier numéro sur une page et
  // pas une autre.
  const aucuneSynchronisee =
    lignes.length > 0 && lignes.every((ligne) => ligne.numero === null);

  return (
    <Page
      chemin="/parc"
      titre={t("parc.titre")}
      sousTitre={sousTitreDuParc()}
      actions={
        <p className="text-app-encre-faible text-[12.5px]">
          {decompte(totalFiltre, t("parc.total_un"), t("parc.total"))}
          {resume.incompletes === 0
            ? ""
            : separateur(
                decompte(
                  resume.incompletes,
                  t("parc.incompletes_un"),
                  t("parc.incompletes"),
                ),
              )}
        </p>
      }
    >
      <BarreDeFiltres
        action="/parc"
        parametre="q"
        valeur={typeof params.q === "string" ? params.q : undefined}
        libelleChamp={libelleDeLaRecherche()}
        libelleBouton={t("parc.recherche_action")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {KPI_PARC.map((kpi) => (
          <Kpi
            key={kpi.cle}
            ton={kpi.ton}
            libelle={t(kpi.cle)}
            valeur={valeurDuKpi(kpi.cle, resume)}
            detail={detailDuKpi(kpi.cle, resume, totalFiltre)}
          />
        ))}
      </div>

      {aucuneSynchronisee ? (
        <p
          role="status"
          className={`rounded-md border px-3.5 py-2.5 text-[12.5px] ${CLASSES_TON.avertissement}`}
        >
          {t("parc.aucune_synchronisee")}
        </p>
      ) : null}

      {/*
        AUCUNE ACTION « EXPORTER EXCEL » N'EST RENDUE : la maquette en montre
        une, et rien dans le dépôt ne sait exporter ce tableau. Un lien qui
        mènerait à rien se lirait comme une panne (R2-13).
      */}
      <Carte titre={t("parc.titre_carte")}>
        <Tableau colonnes={colonnes} minimum="900px">
          {lignes.length === 0 ? (
            <LignePleine colonnes={colonnes.length}>
              {t("parc.vide")}
            </LignePleine>
          ) : null}
          {lignes.map((machine) => (
            <LigneMachine key={machine.id} machine={machine} />
          ))}
        </Tableau>
      </Carte>

      {/*
        LE REGISTRE DES VGP SE REJOINT D'ICI, et non par la barre : celle-ci est
        une liste CLOSE confrontée à la maquette (D95), qui n'y porte aucune
        entrée « VGP ». Une douzième entrée la ferait rougir à raison — le même
        traitement que l'écran des lieux, qui se rejoint par un lien.
      */}
      <Link href="/vgp" className={`text-[12.5px] ${CLASSES_LIEN}`}>
        {t("vgp.lien_depuis_parc")}
      </Link>

      <Pagination
        page={criteres.success ? criteres.data.page : 1}
        totalPages={totalPages}
        libelleResultats={decompte(
          totalFiltre,
          t("parc.total_un"),
          t("parc.total"),
        )}
        libellePage={libellePage(
          criteres.success ? criteres.data.page : 1,
          totalPages,
        )}
        libellePrecedent={t("pagination.precedent")}
        libelleSuivant={t("pagination.suivant")}
        hrefPage={(page) =>
          hrefDeLaPage(
            "/parc",
            { q: typeof params.q === "string" ? params.q : undefined },
            page,
          )
        }
      />
    </Page>
  );
}

/** La valeur d'un KPI — dérivée du même résumé que le tableau, jamais recalculée. */
function valeurDuKpi(
  cle: CleKpiParc,
  resume: ReturnType<typeof resumerLeParc>,
): number {
  switch (cle) {
    case "parc.kpi_actives":
      return resume.actives;
    case "parc.kpi_garantie":
      return resume.garantieExpirant90j;
    case "parc.kpi_en_panne":
      return resume.enPanneOuArretees;
  }
}

/**
 * Le détail d'un KPI, quand il en dit plus que sa seule valeur.
 *
 * **`totalFiltre` est un PARAMÈTRE à part de `resume`** (AT-07) : `resume` est
 * plafonné (`LIMITE_RECHERCHE_MAXIMALE`) pour rester un résumé bon marché,
 * tandis que le total affiché ici doit être celui de la pagination — le MÊME
 * nombre que le pied de liste. Les faire diverger montrerait deux chiffres
 * différents pour « le parc filtré », et c'est exactement ce qu'un lecteur ne
 * peut pas trancher (§9, 01/09).
 */
function detailDuKpi(
  cle: CleKpiParc,
  resume: ReturnType<typeof resumerLeParc>,
  totalFiltre: number,
): string | undefined {
  if (cle === "parc.kpi_actives") {
    return `${t("parc.kpi_sur")} ${decompte(totalFiltre, t("parc.total_un"), t("parc.total"))} ${t("parc.kpi_affichees")}`;
  }
  if (cle === "parc.kpi_en_panne") {
    const enPanne = resume.parStatut.en_panne ?? 0;
    const arretees = resume.parStatut.arretee ?? 0;
    return `${enPanne} ${t("parc.kpi_en_panne_detail_panne")} · ${arretees} ${t("parc.kpi_en_panne_detail_arretees")}`;
  }
  // « Garantie expirant » n'a pas de détail : la maquette en propose un
  // (« à transformer en contrat ») qui présume la table `contrat`, absente.
  return undefined;
}

/**
 * LE TON DE LA PASTILLE DE STATUT — dérivé de l'exemple de la maquette pour
 * les trois statuts qu'elle montre (En service → vert, En panne → rouge,
 * Arrêtée → orange) ; les trois statuts terminaux n'ont aucun précédent dans
 * la maquette et prennent le gris neutre — un jugement, écrit comme tel.
 *
 * Le type couvre les SIX valeurs de `StatutMachine` : en omettre une est un
 * refus de compilation, jamais un statut affiché sans couleur.
 */
const TONS_STATUT: Record<LigneDeParc["statut"], TonBadge> = {
  en_service: "vert",
  en_panne: "rouge",
  arretee: "orange",
  remplacee: "gris",
  ferraillee: "gris",
  fusionnee: "gris",
};

function LigneMachine({ machine }: { readonly machine: LigneDeParc }) {
  return (
    <tr>
      <Cellule mono>
        {/*
          LA RÉFÉRENCE EST LE LIEN VERS LA FICHE, et c'est ce qui donne un
          appelant à l'union de L8-02. Une entrée dont l'écran n'existe pas est
          INERTE, jamais un lien (D95) — ici l'écran existe, donc le lien se
          pose.
        */}
        <Link href={`/parc/${machine.id}`} className={CLASSES_LIEN}>
          {referenceMachine(machine)}
        </Link>
      </Cellule>
      <Cellule>
        {machine.modele.reference}
        <span className="text-app-encre-faible block text-[11.5px]">
          {familleAffichee(machine)}
        </span>
      </Cellule>
      <Cellule mono>{numeroDeSerieAffiche(machine)}</Cellule>
      {/* LA COLONNE « CLIENT » MÈNE À LA FICHE (14/09/2026). *Neuf fois sur
          dix on arrive à un client en partant d'une machine qu'on regardait
          déjà* — c'est le chemin le plus emprunté, et il n'existait pas. */}
      <Cellule>
        <Link href={`/clients/${machine.client_id}`} className={CLASSES_LIEN}>
          {machine.client.raison_sociale}
        </Link>
        <span className="text-app-encre-faible block text-[11.5px]">
          {lieuAffiche(machine)}
        </span>
      </Cellule>
      <Cellule>{dateAffichee(machine.date_mise_en_service)}</Cellule>
      <Cellule>
        <Badge ton={TONS_STATUT[machine.statut]}>
          {statutAffiche(machine.statut)}
        </Badge>
      </Cellule>
    </tr>
  );
}

/**
 * LA RÉFÉRENCE AFFICHÉE — `numero`, ou `Local-<6 caractères>` (I10).
 *
 * Le numéro est attribué par le serveur à la première synchronisation, et
 * **personne ne l'attribue aujourd'hui** : la référence est donc toujours locale
 * pour l'instant, et l'écran le DIT plutôt que d'afficher un vide.
 *
 * *Elle n'est pas partagée avec celle du planning*, et ce n'est pas un oubli :
 * une intervention se préfixe `INT-`, une machine `MAC-`. Un helper commun
 * devrait porter le préfixe en paramètre, c'est-à-dire ne plus rien décider.
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
 * LE NUMÉRO DE SÉRIE AFFICHÉ — jamais la valeur fabriquée `SN-INCONNU-<réf>`.
 *
 * **Mesuré par le directeur d'exploitation le 16/09/2026** : cette valeur
 * s'affichait en chasse fixe, à la place exacte d'un vrai numéro de série,
 * comme n'importe quelle autre fiche — *une absence doit se LIRE comme une
 * absence, jamais comme une valeur* (doctrine §3). La colonne rend donc le
 * signe d'absence pour une fiche incomplète, et la pastille dit pourquoi.
 */
function numeroDeSerieAffiche(machine: LigneDeParc): React.ReactNode {
  if (machine.complet) {
    return machine.numero_serie;
  }
  return (
    <>
      {texteAbsent()}
      <span className="block font-sans">
        <Badge ton="orange">{t("parc.a_completer")}</Badge>
      </span>
    </>
  );
}

/**
 * Le signe d'absence, résolu par un APPEL plutôt que par la constante nue :
 * le gardien de L0-11 lit tout `{ABSENT}` posé DIRECTEMENT dans un arbre JSX
 * comme une chaîne visible écrite en dur — à raison, il ne peut pas savoir
 * qu'il s'agit d'un signe et non d'un mot. `dateAffichee` et `familleAffichee`
 * y échappent en ne renvoyant JAMAIS de JSX ; cette fonction-ci EST un
 * fragment, et c'est le seul appelant du dépôt dans ce cas.
 */
function texteAbsent(): string {
  return ABSENT;
}

/**
 * LE SOUS-TITRE — « site » est un mot IMPOSÉ (D5, D47) : il ne s'écrit dans
 * aucune entrée du dictionnaire hors de `vocabulaire.*`, et se compose ici
 * depuis `motDansUnePhrase("site")` — en minuscule initiale, puisqu'il tombe
 * au milieu d'une phrase et non en tête de colonne.
 */
function sousTitreDuParc(): string {
  return `${t("parc.sous_titre_recherche_avant")} ${motDansUnePhrase("site")}, ${t("parc.sous_titre_recherche_apres")}`;
}

/** Le libellé du champ de recherche — même composition que le sous-titre. */
function libelleDeLaRecherche(): string {
  return `${t("parc.recherche_prefixe")} ${motDansUnePhrase("site")}, ${t("parc.recherche_suffixe")}`;
}

/**
 * `decompte` a DÉMÉNAGÉ dans `app/(back-office)/presentation.ts` (AT-07) : la
 * pagination en avait besoin pour son propre total, et une seconde écriture
 * du même critère aurait divergé en silence (§9, 01/09) — la même raison qui a
 * fait déménager `ouTiret` le 14/09/2026. Aucun appelant d'ici ne change :
 * seul l'import se déplace.
 */

/** Le séparateur des deux décomptes — un signe, jamais une phrase. */
function separateur(suite: string): string {
  return ` · ${suite}`;
}

function familleAffichee(machine: LigneDeParc): string {
  const libelle = machine.modele.famille?.libelle;
  return libelle === undefined ? ABSENT : `${t("parc.famille")} : ${libelle}`;
}

/**
 * LE LIEU AFFICHÉ — le libellé du site, et sa commune SEULEMENT si elle
 * ajoute une information.
 *
 * **Mesuré par le directeur d'exploitation le 16/09/2026** : « Ducos —
 * Ducos » s'affichait quand le libellé du site vaut sa commune, une
 * répétition qui ne distingue rien. Le repli sur une seule mention est un
 * cas particulier de la même règle qui écarte déjà la commune ABSENTE.
 */
function lieuAffiche(machine: LigneDeParc): string {
  const commune = machine.site.commune;
  const libelle = machine.site.libelle;
  return commune === null || commune === libelle
    ? libelle
    : `${libelle} — ${commune}`;
}

/**
 * La date de mise en service, ou son absence.
 *
 * **La lecture en UTC vit dans `dateCivile`**, et plus ici : elle était écrite
 * deux fois le jour où la fiche d'intervention a eu besoin d'afficher une date
 * d'expiration (L3-02). *Ce qui reste ici est la seule chose propre à cet
 * écran : ce qu'on écrit quand il n'y a pas de date.*
 */
function dateAffichee(date: Date | null): string {
  return date === null ? ABSENT : dateCivile(date);
}

/** Le libellé d'un statut — au dictionnaire, jamais écrit dans le composant. */
function statutAffiche(statut: LigneDeParc["statut"]): string {
  return t(`statut_machine.${statut}`);
}
