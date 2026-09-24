"use client";

import { useRef, useState } from "react";

import { ActionPrimaire } from "@/components/ui/action-primaire";
import {
  SelecteurRecherche,
  type OptionRecherche,
} from "@/components/ui/selecteur-recherche";
import { estCleTraduction, t, type CleTraduction } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";
import {
  CRITICITES_MACHINE,
  STATUTS_MACHINE,
  type SaisieMachine,
} from "@/lib/machines/saisie";

/**
 * LE FORMULAIRE DE CRÉATION ET DE CORRECTION D'UNE MACHINE (18/09/2026).
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
    }
  | { readonly mode: "modification"; readonly lectureSeule: LectureSeule }
);

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
  const siteInitial = props.mode === "creation" ? props.siteInitial : undefined;

  async function envoyer(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (enVol.current) {
      return;
    }
    enVol.current = true;
    setEnvoiEnCours(true);
    const corps = new FormData(evenement.currentTarget);
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
          className="border-app-rouge-bord bg-app-rouge-fond text-app-rouge-encre rounded-md border px-3.5 py-2.5 text-[12.5px]"
        >
          {t(motif)}
        </p>
      )}

      {/* FAMILLE, MARQUE, RÉFÉRENCE, N° DE SÉRIE, ANNÉE DE VENTE — dans cet
          ordre (RG-PAR-07, D126). */}
      {props.mode === "modification" ? (
        <ChampsLectureSeule lectureSeule={props.lectureSeule} />
      ) : (
        <SelecteurRecherche
          nom="modele_id"
          url="/api/recherche/modeles"
          libelle={t("machine.champ.modele")}
          libelleAucunResultat={t("selecteur.aucun_resultat")}
          libelleVoirPlus={t("selecteur.voir_plus")}
          obligatoire
        />
      )}

      <Champ
        nom="numero_serie"
        libelle={t("machine.champ.numero_serie")}
        aide={t("machine.champ.numero_serie_aide")}
        valeurParDefaut={props.valeurs.numeroSerie}
        obligatoire
      />

      {props.mode === "creation" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SelecteurRecherche
            nom="client_id"
            url="/api/recherche/clients"
            libelle={t("machine.champ.client")}
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
            libelle={mot("site")}
            libelleAucunResultat={t("selecteur.aucun_resultat")}
            libelleVoirPlus={t("selecteur.voir_plus")}
            obligatoire
            disabled={clientChoisi === ""}
            valeurInitiale={siteInitial}
          />
        </div>
      ) : (
        <>
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
          <input
            type="hidden"
            name="site_id"
            value={props.lectureSeule.siteId}
          />
        </>
      )}

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
        <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
          {t("machine.champ.criticite")}
          <select
            name="criticite"
            defaultValue={props.valeurs.criticite}
            className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
          >
            {CRITICITES_MACHINE.map((valeur) => (
              <option key={valeur} value={valeur}>
                {t(`criticite_machine.${valeur}`)}
              </option>
            ))}
          </select>
        </label>
        {props.mode === "creation" ? (
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
            {t("machine.champ.statut")}
            <select
              name="statut"
              defaultValue="en_service"
              className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
            >
              {STATUTS_MACHINE.filter((valeur) => valeur !== "fusionnee").map(
                (valeur) => (
                  <option key={valeur} value={valeur}>
                    {t(`statut_machine.${valeur}`)}
                  </option>
                ),
              )}
            </select>
          </label>
        ) : null}
      </div>

      <div>
        <ActionPrimaire type="submit">
          {envoiEnCours
            ? t("machine.action.envoi_en_cours")
            : t("machine.action.enregistrer")}
        </ActionPrimaire>
      </div>
    </form>
  );
}

function ChampsLectureSeule({
  lectureSeule,
}: Readonly<{ lectureSeule: LectureSeule }>) {
  return (
    <div className="bg-app-fond rounded-md px-3.5 py-2.5">
      <p className="text-app-encre-faible mb-2 text-[11px] font-semibold uppercase">
        {t("machine.modifier.non_modifiable")}
      </p>
      <dl className="grid gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-2">
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

function Champ({
  nom,
  libelle,
  aide,
  type = "text",
  valeurParDefaut,
  obligatoire,
}: Readonly<{
  nom: string;
  libelle: string;
  aide?: string;
  type?: "text" | "date";
  valeurParDefaut?: string;
  obligatoire?: boolean;
}>) {
  return (
    <label className="flex flex-col gap-1 text-[12.5px] font-semibold">
      {libelle}
      <input
        name={nom}
        type={type}
        required={obligatoire === true}
        defaultValue={valeurParDefaut}
        className="border-app-bord rounded-md border px-3 py-1.5 text-[13px] font-normal"
      />
      {aide === undefined ? null : (
        <span className="text-app-encre-faible text-[11px] font-normal">
          {aide}
        </span>
      )}
    </label>
  );
}
