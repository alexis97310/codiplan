import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BarreDeFiltres } from "@/components/ui/barre-de-filtres";
import { Badge, type TonBadge } from "@/components/ui/badge";
import { Carte } from "@/components/ui/carte";
import { Kpi } from "@/components/ui/kpi";
import { Cellule, LignePleine, Tableau } from "@/components/ui/tableau";
import { Page } from "@/components/mise-en-page/page";
import { obtenirSession } from "@/lib/auth/session";
import { maintenant, schemaFuseau, dateCivile } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { t } from "@/lib/i18n/fr";
import { motDansUnePhrase } from "@/lib/i18n/vocabulaire";
import {
  listerLeParc,
  resumerLeParc,
  type LigneDeParc,
} from "@/lib/machines/depot";
import {
  COLONNES_PARC,
  KPI_PARC,
  type CleKpiParc,
} from "@/lib/machines/ecarts-maquette";
import { CLASSES_LIEN } from "@/lib/theme/apparence";
import { CLASSES_TON } from "@/lib/theme/statuts";

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
 * ## CE QU'IL NE FAIT PAS ENCORE
 *
 * La recherche est CÂBLÉE — un champ, un paramètre `q`, un bouton — et pas
 * REMPLIE : aucun dépôt ne le lit encore (AT-07). Ni export, ni pagination.
 * La borne d'affichage est dite à l'écran plutôt que tue : *un tableau
 * tronqué en silence fait croire à un parc plus petit qu'il n'est.*
 */

/**
 * Combien de fiches l'écran rend.
 *
 * **Ce n'est pas un cloisonnement** : celui-là est prononcé par la politique de
 * `machine`, de forme « parc ». C'est une borne d'AFFICHAGE, et elle existe
 * parce qu'un parc réel compte des milliers de lignes — *le fichier de
 * l'exploitation en porte 292 pour un seul client.*
 */
const LIGNES_AFFICHEES = 200;

const ABSENT = "—";

export default async function PageParc() {
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

  const lignes = await listerLeParc(contexte, LIGNES_AFFICHEES);
  const resume = resumerLeParc(lignes, aujourdHui);

  const colonnes = COLONNES_PARC.map((colonne) => ({
    cle: colonne.id,
    libelle: colonne.libelle(),
    largeur: colonne.largeur,
  }));

  // AUCUNE FICHE AFFICHÉE N'A ENCORE DE NUMÉRO SERVEUR — mesuré par le
  // directeur d'exploitation le 16/09/2026 : la mention se répétait sous les
  // 200 lignes sans plus rien distinguer. Un bandeau UNIQUE la remplace tant
  // que la synchronisation (lot 3) n'a attribué aucun numéro ; le jour où
  // elle en attribuera un premier, cette condition devient fausse d'elle-même
  // et la mention reprend sa forme par ligne, comme avant.
  const aucuneSynchronisee =
    lignes.length > 0 && lignes.every((ligne) => ligne.numero === null);

  return (
    <Page
      titre={t("parc.titre")}
      sousTitre={sousTitreDuParc()}
      actions={
        <p className="text-app-encre-faible text-[12.5px]">
          {decompte(resume.total, t("parc.total_un"), t("parc.total"))}
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
            detail={detailDuKpi(kpi.cle, resume)}
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

      <p className="text-app-encre-faible text-[11.5px]">{t("parc.borne")}</p>
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

/** Le détail d'un KPI, quand il en dit plus que sa seule valeur. */
function detailDuKpi(
  cle: CleKpiParc,
  resume: ReturnType<typeof resumerLeParc>,
): string | undefined {
  if (cle === "parc.kpi_actives") {
    return `${t("parc.kpi_sur")} ${decompte(resume.total, t("parc.total_un"), t("parc.total"))} ${t("parc.kpi_affichees")}`;
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

/** Un décompte et son unité, composés hors du JSX (L0-11). */
function decompte(nombre: number, un: string, plusieurs: string): string {
  // **« 1 fiches à compléter »** — mesuré le 13/09/2026 SUR UNE IMAGE, et par
  // aucune assertion : le libellé était au pluriel en dur, et le défaut ne
  // pouvait apparaître que le jour où le parc porterait EXACTEMENT une fiche
  // incomplète. *C'est le §9 du 09/09 — un défaut invisible à toute assertion
  // et évident sur une capture* : on n'écrit pas d'assertion sur un invariant
  // qu'on n'a pas encore vu.
  //
  // Le singulier est une CLÉ du dictionnaire, jamais un `s` retranché : le
  // français ne s'accorde pas par troncature, et une règle de morphologie
  // écrite dans un composant serait une chaîne visible en dur (L0-11).
  // **LES DEUX LIBELLÉS SONT RÉSOLUS PAR L'APPELANT**, et ce n'est pas un
  // détour : une CLÉ passée en argument depuis du JSX se lit comme une chaîne
  // visible écrite en dur, et le gardien de L0-11 l'a refusée — à raison, il ne
  // peut pas distinguer une clé d'un libellé.
  return `${nombre} ${nombre === 1 ? un : plusieurs}`;
}

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
