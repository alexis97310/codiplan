"use client";

import Link from "next/link";
import { forwardRef, useEffect, useRef, useState } from "react";

import { BarreActionCollee } from "@/components/ui/action-primaire";
import { Button } from "@/components/ui/button";
import { Choix } from "@/components/ui/choix";
import { SectionFormulaire } from "@/components/ui/section-formulaire";
import {
  SelecteurRecherche,
  type OptionRecherche,
} from "@/components/ui/selecteur-recherche";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import {
  libelleChampFacultatif,
  libelleChampObligatoire,
} from "@/lib/i18n/obligatoire";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  CRITICITES_MACHINE,
  PREFIXE_SERIE_INCONNUE,
  type SaisieMachine,
} from "@/lib/machines/saisie";

/**
 * LE FORMULAIRE DE CRÉATION ET DE CORRECTION D'UNE MACHINE (18/09/2026 ;
 * création reconstruite au gabarit du 28/09, 9EK-TP-UX5-2-CREATIONS-2, D184).
 *
 * ## POURQUOI UN COMPOSANT CLIENT, ET PAS LE `<form method="post">` NU DE
 * L'ACTION DE LA FICHE INTERVENTION
 *
 * *« Un formulaire qui échoue le DIT : distingue enregistré, refusé par la
 * règle métier, erreur serveur, connexion interrompue. Un envoi répété est
 * bloqué pendant la demande. »* — la règle posée pour le glisser-déposer du
 * planning (D-06, `components/planning/pose.tsx`), étendue ici sur demande
 * explicite de l'exploitation. Un `<form method="post">` nu laisse le
 * navigateur décider de la page d'erreur d'une coupure réseau, et rien
 * n'empêche un double clic de partir en DEUX requêtes concurrentes.
 *
 * `interpreterReponseMachine` est PURE, pour la même raison qu'`interpreterReponseDepot` :
 * ce qui doit être mesuré — qu'un appel qui échoue ne rend jamais la branche
 * du succès — se mesure sans navigateur.
 *
 * ## LE MODÈLE, LE CLIENT, LE SITE ET LE STATUT NE SE CORRIGENT PAS EN MODE
 * « MODIFICATION »
 *
 * `modifierMachineDans` (`lib/machines/depot.ts`) ne les réécrit pas — le
 * modèle porte l'unicité de la fiche, et le client/site sont un déménagement,
 * un geste daté qu'aucun formulaire ne porte encore. Ce composant ne
 * contourne pas cette limite : en modification, les quatre champs
 * s'affichent en LECTURE SEULE, dans l'ordre de D126 (famille, marque,
 * référence), et ne sont jamais soumis comme des champs modifiables.
 *
 * ## DEUX ARBRES JSX, UN PAR MODE (D184)
 *
 * La modification rend EXACTEMENT ce qu'elle rendait avant ce lot — son
 * écran, « Corriger la fiche », n'est pas celui que ce ticket reconstruit.
 * Plutôt que de faire porter à un même arbre deux dispositions (sections
 * numérotées contre carte unique, `Choix` contre `<select>`), les deux modes
 * rendent chacun leur propre JSX : aucune branche conditionnelle au milieu
 * d'un même formulaire n'aurait pu garantir cette absence de régression.
 *
 * ## `tousLesResultats` A DISPARU (SELECTEURS-1, 24/09/2026)
 *
 * Le lot PARC-TER (21/09/2026) l'avait déplacée hors de ce fichier
 * `"use client"` vers `components/parc/pagination.ts`, NEUTRE, en expliquant
 * pourquoi une exportation d'un module client devient une référence client
 * même pour une fonction qui ne rend aucun JSX (panne mesurée deux fois).
 * **SELECTEURS-1 retire son seul appelant** : `app/(back-office)/parc/nouvelle/page.tsx`
 * ne charge plus le référentiel entier des clients/sites pour peupler ce
 * formulaire — les trois champs ci-dessous (client, site, modèle) cherchent
 * maintenant sur le SERVEUR par `SelecteurRecherche`
 * (`components/ui/selecteur-recherche.tsx`), 20 résultats à la fois. Sans
 * appelant nulle part, `tousLesResultats` et `components/parc/pagination.ts`
 * sont retirés plutôt que laissés sans raison d'être.
 */

/**
 * CE QUE LA ROUTE REND, INTERPRÉTÉ EN QUATRE ISSUES QUI NE SE CONFONDENT PAS
 * (D-06). Fonction pure : voir la note de tête.
 */
export type IssueEnvoiMachine =
  | { readonly issue: "enregistre"; readonly id: string }
  | { readonly issue: "refuse"; readonly cle: CleTraduction }
  | { readonly issue: "erreur_serveur" }
  | { readonly issue: "connexion_interrompue" };

export function interpreterReponseMachine(
  resultat: { readonly ok: boolean; readonly corps: unknown } | null,
): IssueEnvoiMachine {
  if (resultat === null) {
    // Le `fetch` a lui-même échoué : la réponse n'est jamais revenue. On ne
    // sait pas si l'écriture a été appliquée — regarder ailleurs qu'à
    // l'écran, pas réessayer à l'aveugle.
    return { issue: "connexion_interrompue" };
  }
  if (!resultat.ok) {
    return { issue: "erreur_serveur" };
  }
  const { corps } = resultat;
  if (corps === null || typeof corps !== "object" || !("accepte" in corps)) {
    return { issue: "erreur_serveur" };
  }
  if (corps.accepte === true) {
    const id = "id" in corps && typeof corps.id === "string" ? corps.id : null;
    if (id === null) {
      // Un « succès » HTTP sans identifiant n'est pas un succès exploitable :
      // rien à afficher, aucune fiche à rejoindre.
      return { issue: "erreur_serveur" };
    }
    return { issue: "enregistre", id };
  }
  const cleBrute = "cle" in corps ? corps.cle : null;
  return {
    issue: "refuse",
    cle:
      typeof cleBrute === "string" && estCleTraduction(cleBrute)
        ? cleBrute
        : "machine.refus.inconnue",
  };
}

type ValeursEditables = {
  readonly numeroSerie: string;
  readonly referenceInterne: string;
  readonly localisation: string;
  readonly factureOrigine: string;
  readonly dateMiseEnService: string;
  readonly dateVente: string;
  readonly garantieFin: string;
  readonly criticite: SaisieMachine["criticite"];
};

type LectureSeule = {
  readonly modeleId: string;
  readonly clientId: string;
  readonly siteId: string;
  readonly familleLibelle: string;
  readonly marque: string;
  readonly reference: string;
  readonly clientLibelle: string;
  readonly siteLibelle: string;
};

/** Une famille active, réduite à ce qu'un `<select>` en a besoin — jamais `LigneFamille`. */
export type OptionFamille = {
  readonly id: string;
  readonly libelle: string;
};

type Props = {
  readonly action: string;
  /**
   * La clé du motif à joindre à l'URL de retour, `/parc/{id}?motif={…}`
   * (D-06). **Une donnée, jamais une fonction** : `urlRetour` était une
   * fermeture passée telle quelle du composant serveur au composant client,
   * et React refuse de sérialiser une fonction à travers cette frontière —
   * mesuré (digests 547900095 et 1461852287, un par écran) : les deux DEVENAIENT
   * une 500 au premier rendu, avant même que `envoyer` ne s'exécute. Le test
   * de ce composant ne pouvait pas le voir : il rend `FormulaireMachine`
   * directement, sans jamais franchir la frontière serveur → client que Next.js
   * franchit, lui, à chaque requête réelle.
   */
  readonly motifSucces: CleTraduction;
  readonly motifInitial?: CleTraduction;
  readonly valeurs: ValeursEditables;
} & (
  | {
      readonly mode: "creation";
      /**
       * PRÉREMPLISSAGE PAR L'URL (FICHE-360-1, sur le modèle de LIENS-1) —
       * `app/(back-office)/parc/nouvelle/page.tsx` les résout SOUS LE
       * CONTEXTE cloisonné ; ce composant ne revalide rien, il amorce l'état.
       */
      readonly clientInitial?: OptionRecherche;
      readonly siteInitial?: OptionRecherche;
      /** Les familles ACTIVES, pour raccourcir la liste des modèles (D184). */
      readonly familles: readonly OptionFamille[];
    }
  | { readonly mode: "modification"; readonly lectureSeule: LectureSeule }
);

/** Les trois états offerts à la création (décision d'Alexis du 05/10/2026, n° 21, PV-27). */
const STATUTS_CREATION = ["en_service", "en_panne", "arretee"] as const;

export function FormulaireMachine(props: Props) {
  const [motif, setMotif] = useState<CleTraduction | null>(
    props.motifInitial ?? null,
  );
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  // Un GESTE RÉPÉTÉ NE PART PAS DEUX FOIS (D-06) : une `Ref`, pas seulement
  // l'état d'affichage — un second clic avant le premier rendu React ne doit
  // rien déclencher.
  const enVol = useRef(false);
  const [clientChoisi, setClientChoisi] = useState<string>(
    props.mode === "creation" ? (props.clientInitial?.id ?? "") : "",
  );
  const [familleChoisie, setFamilleChoisie] = useState("");
  const siteInitial = props.mode === "creation" ? props.siteInitial : undefined;
  const refNumeroSerie = useRef<HTMLInputElement>(null);
  const refReferenceInterne = useRef<HTMLInputElement>(null);
  const [aideReferenceVisible, setAideReferenceVisible] = useState(false);

  // LE REFUS DE DOUBLON SE PORTE SOUS LE CHAMP EN CAUSE, PAS DANS LE
  // BANDEAU (D184, S7) — et focalise ce champ, comme `Choix` le fait déjà
  // pour son propre refus.
  useEffect(() => {
    if (props.mode !== "creation") {
      return;
    }
    if (motif === "machine.refus.numero_serie_pris") {
      refNumeroSerie.current?.focus();
    } else if (motif === "machine.refus.reference_interne_prise") {
      refReferenceInterne.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `props.mode` ne change jamais pour une instance donnée.
  }, [motif]);

  function surIllisible() {
    const reference = refReferenceInterne.current?.value.trim() ?? "";
    if (reference.length === 0) {
      setAideReferenceVisible(true);
      refReferenceInterne.current?.focus();
      return;
    }
    setAideReferenceVisible(false);
    if (refNumeroSerie.current !== null) {
      refNumeroSerie.current.value = `${PREFIXE_SERIE_INCONNUE}${reference}`;
    }
  }

  async function envoyer(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (enVol.current) {
      return;
    }
    enVol.current = true;
    setEnvoiEnCours(true);
    const formulaire = evenement.currentTarget;
    // LE BOUTON QUI A DÉCLENCHÉ L'ENVOI (D184) — « Créer et en ajouter une
    // autre » (`name="ensuite" value="autre"`) n'est lu que sur LUI, jamais
    // sur un état React qui pourrait retarder d'un rendu derrière le clic.
    const declencheur = (evenement.nativeEvent as SubmitEvent).submitter;
    const corps = new FormData(formulaire);
    let issue: IssueEnvoiMachine;
    try {
      const reponse = await fetch(props.action, {
        method: "POST",
        body: corps,
        headers: { accept: "application/json" },
      });
      const rendu: unknown = await reponse.json().catch(() => null);
      issue = interpreterReponseMachine({ ok: reponse.ok, corps: rendu });
    } catch {
      // Le `fetch` a REJETÉ — coupure réseau, délai dépassé. Sans ce `catch`,
      // ce rejet partirait non intercepté et l'écran resterait tel quel.
      issue = { issue: "connexion_interrompue" };
    } finally {
      enVol.current = false;
      setEnvoiEnCours(false);
    }
    switch (issue.issue) {
      case "enregistre":
        if (
          props.mode === "creation" &&
          declencheur instanceof HTMLButtonElement &&
          declencheur.name === "ensuite" &&
          declencheur.value === "autre"
        ) {
          const clientId = String(corps.get("client_id") ?? "");
          const siteId = String(corps.get("site_id") ?? "");
          window.location.assign(
            `/parc/nouvelle?client=${encodeURIComponent(clientId)}&site=${encodeURIComponent(siteId)}&motif=${encodeURIComponent(props.motifSucces)}`,
          );
          return;
        }
        window.location.assign(
          `/parc/${issue.id}?motif=${encodeURIComponent(props.motifSucces)}`,
        );
        return;
      case "refuse":
        setMotif(issue.cle);
        return;
      case "erreur_serveur":
      case "connexion_interrompue":
        setMotif(`machine.refus.${issue.issue}`);
        return;
    }
  }

  if (props.mode === "modification") {
    return (
      <form
        onSubmit={(evenement) => {
          void envoyer(evenement);
        }}
        className="bg-app-surface border-app-bord flex flex-col gap-4 rounded-lg border px-4 py-4"
      >
        {motif === null ? null : (
          <p
            data-refus={motif}
            role="alert"
            className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
          >
            {t(motif)}
          </p>
        )}

        {/* FAMILLE, MARQUE, RÉFÉRENCE, N° DE SÉRIE — dans cet ordre
            (RG-PAR-07, D126). */}
        <ChampsLectureSeule lectureSeule={props.lectureSeule} />

        <Champ
          nom="numero_serie"
          libelle={t("machine.champ.numero_serie")}
          aide={t("machine.champ.numero_serie_aide")}
          valeurParDefaut={props.valeurs.numeroSerie}
          obligatoire
        />

        <input
          type="hidden"
          name="modele_id"
          value={props.lectureSeule.modeleId}
        />
        <input
          type="hidden"
          name="client_id"
          value={props.lectureSeule.clientId}
        />
        <input type="hidden" name="site_id" value={props.lectureSeule.siteId} />

        <div className="grid gap-4 md:grid-cols-2">
          <Champ
            nom="reference_interne"
            libelle={t("machine.champ.reference_interne")}
            valeurParDefaut={props.valeurs.referenceInterne}
          />
          <Champ
            nom="localisation"
            libelle={t("machine.champ.localisation")}
            valeurParDefaut={props.valeurs.localisation}
          />
          <Champ
            nom="facture_origine"
            libelle={t("machine.champ.facture_origine")}
            valeurParDefaut={props.valeurs.factureOrigine}
          />
          <Champ
            nom="date_mise_en_service"
            type="date"
            libelle={t("machine.champ.date_mise_en_service")}
            valeurParDefaut={props.valeurs.dateMiseEnService}
          />
          <Champ
            nom="date_vente"
            type="date"
            libelle={t("machine.champ.date_vente")}
            valeurParDefaut={props.valeurs.dateVente}
          />
          <Champ
            nom="garantie_fin"
            type="date"
            libelle={t("machine.champ.garantie_fin")}
            valeurParDefaut={props.valeurs.garantieFin}
          />
          <label className="flex flex-col gap-1 text-13 font-bold">
            {t("machine.champ.criticite")}
            <select
              name="criticite"
              defaultValue={props.valeurs.criticite}
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
            >
              {CRITICITES_MACHINE.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {t(`criticite_machine.${valeur}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <Button type="submit" disabled={envoiEnCours}>
            {envoiEnCours
              ? t("machine.action.envoi_en_cours")
              : t("machine.action.enregistrer")}
          </Button>
        </div>
      </form>
    );
  }

  // ── CRÉATION, AU GABARIT DU 28/09 (D184) ──────────────────────────────────
  const erreurNumeroSerie =
    motif === "machine.refus.numero_serie_pris" ? t(motif) : undefined;
  const erreurReferenceInterne =
    motif === "machine.refus.reference_interne_prise" ? t(motif) : undefined;
  const erreurStatut =
    motif === "machine.refus.statut_creation" ? t(motif) : undefined;
  // LE BANDEAU NE DOUBLE JAMAIS UN REFUS DÉJÀ PORTÉ SOUS UN CHAMP (D184, S7).
  const motifBanniere =
    erreurNumeroSerie !== undefined ||
    erreurReferenceInterne !== undefined ||
    erreurStatut !== undefined
      ? null
      : motif;

  return (
    <form
      onSubmit={(evenement) => {
        void envoyer(evenement);
      }}
      className="flex flex-col gap-5 pb-20 min-[901px]:pb-0"
    >
      {motifBanniere === null ? null : (
        <p
          data-refus={motifBanniere}
          role="alert"
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-13 font-bold"
        >
          {t(motifBanniere)}
        </p>
      )}

      <SectionFormulaire numero={1} titre={t("machine.nouvelle.section_ou")}>
        <div className="grid gap-4 md:grid-cols-2">
          <SelecteurRecherche
            nom="client_id"
            url="/api/recherche/clients"
            libelle={libelleChampObligatoire(t("machine.champ.client"))}
            libelleAucunResultat={t("selecteur.aucun_resultat")}
            libelleVoirPlus={t("selecteur.voir_plus")}
            obligatoire
            valeurInitiale={props.clientInitial}
            onChoix={(option) => setClientChoisi(option?.id ?? "")}
          />
          {/* REMONTÉ (`key`) À CHAQUE CHANGEMENT DE CLIENT — un sélecteur de
              site qui garderait sa sélection après un changement de client
              afficherait le site d'un AUTRE client (voir la note de
              `SelecteurRecherche` sur `parametres`). */}
          <SelecteurRecherche
            key={clientChoisi}
            nom="site_id"
            url="/api/recherche/sites"
            parametres={{ client: clientChoisi }}
            libelle={libelleChampObligatoire(mot("site"))}
            libelleAucunResultat={t("selecteur.aucun_resultat")}
            libelleVoirPlus={t("selecteur.voir_plus")}
            obligatoire
            disabled={clientChoisi === ""}
            valeurInitiale={siteInitial}
          />
        </div>
      </SectionFormulaire>

      <SectionFormulaire
        numero={2}
        titre={t("machine.nouvelle.section_quelle")}
      >
        <label
          data-champ="famille"
          className="flex flex-col gap-1 text-13 font-bold"
        >
          {t("machine.champ.famille")}
          <select
            value={familleChoisie}
            onChange={(evenement) => setFamilleChoisie(evenement.target.value)}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
          >
            <option value="" />
            {props.familles.map((famille) => (
              <option key={famille.id} value={famille.id}>
                {famille.libelle}
              </option>
            ))}
          </select>
          <span className="text-app-encre-faible text-12 font-bold">
            {t("machine.champ.famille_aide")}
          </span>
        </label>

        {/* REMONTÉ (`key`) À CHAQUE CHANGEMENT DE FAMILLE — même raison que
            le sélecteur de site ci-dessus. Sans famille choisie, la
            recherche porte sur tous les modèles, comme avant ce lot. */}
        <SelecteurRecherche
          key={familleChoisie}
          nom="modele_id"
          url="/api/recherche/modeles"
          parametres={
            familleChoisie === "" ? undefined : { famille: familleChoisie }
          }
          libelle={libelleChampObligatoire(t("machine.champ.modele"))}
          libelleAucunResultat={t("selecteur.aucun_resultat")}
          libelleVoirPlus={t("selecteur.voir_plus")}
          obligatoire
        />

        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-13 font-bold">
            {libelleChampObligatoire(t("machine.champ.numero_serie"))}
            <input
              ref={refNumeroSerie}
              name="numero_serie"
              type="text"
              required
              defaultValue={props.valeurs.numeroSerie}
              aria-invalid={
                erreurNumeroSerie === undefined ? undefined : "true"
              }
              aria-describedby={
                erreurNumeroSerie === undefined
                  ? undefined
                  : "numero_serie-erreur"
              }
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="text-app-encre-faible text-12 font-bold">
              {t("machine.champ.illisible_question")}
            </span>
            <button
              type="button"
              onClick={surIllisible}
              className="text-app-encre-faible text-12 font-bold underline"
            >
              {t("machine.action.illisible")}
            </button>
          </div>
          {erreurNumeroSerie === undefined ? null : (
            <p
              id="numero_serie-erreur"
              role="alert"
              className="text-app-rouge-encre text-12 font-bold"
            >
              {erreurNumeroSerie}
            </p>
          )}
        </div>

        <Champ
          nom="date_vente"
          type="date"
          libelle={libelleChampFacultatif(t("machine.champ.date_vente"))}
          valeurParDefaut={props.valeurs.dateVente}
        />

        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-13 font-bold">
            {libelleChampFacultatif(t("machine.champ.reference_interne"))}
            <input
              ref={refReferenceInterne}
              name="reference_interne"
              type="text"
              defaultValue={props.valeurs.referenceInterne}
              aria-invalid={
                erreurReferenceInterne === undefined ? undefined : "true"
              }
              aria-describedby={
                erreurReferenceInterne === undefined
                  ? undefined
                  : "reference_interne-erreur"
              }
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
            />
          </label>
          {!aideReferenceVisible ? null : (
            <span className="text-app-encre-faible text-12 font-bold">
              {t("machine.champ.numero_serie_aide")}
            </span>
          )}
          {erreurReferenceInterne === undefined ? null : (
            <p
              id="reference_interne-erreur"
              role="alert"
              className="text-app-rouge-encre text-12 font-bold"
            >
              {erreurReferenceInterne}
            </p>
          )}
        </div>
      </SectionFormulaire>

      <SectionFormulaire
        numero={3}
        titre={t("machine.nouvelle.section_facultatif")}
      >
        <Choix
          nom="statut"
          legende={t("machine.champ.etat_creation")}
          options={STATUTS_CREATION.map((valeur) => ({
            valeur,
            libelle: t(`statut_machine.${valeur}`),
          }))}
          aide={t("machine.aide.etat_creation_defaut")}
          erreur={erreurStatut}
        />
        <Choix
          nom="criticite"
          legende={t("machine.champ.criticite")}
          options={CRITICITES_MACHINE.map((valeur) => ({
            valeur,
            libelle: t(`criticite_machine.${valeur}`),
          }))}
          aide={t("machine.aide.criticite_defaut")}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Champ
            nom="date_mise_en_service"
            type="date"
            libelle={libelleChampFacultatif(
              t("machine.champ.date_mise_en_service"),
            )}
            valeurParDefaut={props.valeurs.dateMiseEnService}
          />
          <Champ
            nom="garantie_fin"
            type="date"
            libelle={libelleChampFacultatif(t("machine.champ.garantie_fin"))}
            valeurParDefaut={props.valeurs.garantieFin}
          />
          <Champ
            nom="localisation"
            libelle={libelleChampFacultatif(t("machine.champ.localisation"))}
            valeurParDefaut={props.valeurs.localisation}
          />
          <Champ
            nom="facture_origine"
            libelle={libelleChampFacultatif(t("machine.champ.facture_origine"))}
            valeurParDefaut={props.valeurs.factureOrigine}
          />
        </div>
      </SectionFormulaire>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/parc" className="text-app-encre-faible text-13 font-bold">
          {t("machine.nouvelle.annuler")}
        </Link>
        <div className="flex items-center gap-3">
          <BarreActionCollee>
            <Button type="submit" disabled={envoiEnCours}>
              {envoiEnCours
                ? t("machine.action.envoi_en_cours")
                : t("machine.action.creer_la_machine")}
            </Button>
          </BarreActionCollee>
          <Button
            type="submit"
            name="ensuite"
            value="autre"
            variant="outline"
            className="order-first"
            disabled={envoiEnCours}
          >
            {t("machine.action.creer_et_ajouter")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function ChampsLectureSeule({
  lectureSeule,
}: Readonly<{ lectureSeule: LectureSeule }>) {
  return (
    <div className="bg-app-fond rounded-md px-3.5 py-2.5">
      <p className="text-app-encre-faible mb-2 text-12 font-bold uppercase">
        {t("machine.modifier.non_modifiable")}
      </p>
      <dl className="grid gap-x-4 gap-y-1 text-13 font-bold sm:grid-cols-2">
        <LigneLectureSeule
          dt={t("machine.champ.famille")}
          dd={lectureSeule.familleLibelle}
        />
        <LigneLectureSeule
          dt={t("machine.champ.marque")}
          dd={lectureSeule.marque}
        />
        <LigneLectureSeule
          dt={t("machine.champ.reference")}
          dd={lectureSeule.reference}
        />
        <LigneLectureSeule
          dt={t("machine.champ.client")}
          dd={lectureSeule.clientLibelle}
        />
        <LigneLectureSeule dt={mot("site")} dd={lectureSeule.siteLibelle} />
      </dl>
    </div>
  );
}

function LigneLectureSeule({ dt, dd }: Readonly<{ dt: string; dd: string }>) {
  return (
    <>
      <dt className="text-app-encre-faible">{dt}</dt>
      <dd className="font-semibold">{dd}</dd>
    </>
  );
}

type PropsChamp = Readonly<{
  nom: string;
  libelle: string;
  aide?: string;
  type?: "text" | "date";
  valeurParDefaut?: string;
  obligatoire?: boolean;
}>;

/** Un champ simple — modification ET création, quand ni `ref` ni `erreur` ne sont nécessaires. */
const Champ = forwardRef<HTMLInputElement, PropsChamp>(function Champ(
  { nom, libelle, aide, type = "text", valeurParDefaut, obligatoire },
  ref,
) {
  return (
    <label className="flex flex-col gap-1 text-13 font-bold">
      {obligatoire === true ? libelleChampObligatoire(libelle) : libelle}
      <input
        ref={ref}
        name={nom}
        type={type}
        required={obligatoire === true}
        defaultValue={valeurParDefaut}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-bold"
      />
      {aide === undefined ? null : (
        <span className="text-app-encre-faible text-12 font-bold">{aide}</span>
      )}
    </label>
  );
});
