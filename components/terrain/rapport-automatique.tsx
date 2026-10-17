"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import type { IssueSignature } from "@/lib/interventions/saisie";
import { cleBrouillon } from "@/lib/terrain/brouillon";
import {
  ajouterSaisie,
  EVENEMENT_FILE_MODIFIEE,
  listerFilePourIntervention,
} from "@/lib/terrain/file-saisies";

/**
 * LE RAPPORT DE TERRAIN, ENTIÈREMENT AUTOMATIQUE (9F4-TERRAIN-ENREGISTREMENT-
 * AUTO, décision d'Alexis n° 95) — commentaire, suite à donner, prestations
 * et signature s'enregistrent SEULS en arrière-plan ; plus aucun bouton
 * « Enregistrer » par bloc. Un seul geste reste manuel : « Terminer
 * l'intervention », en bas.
 *
 * ## UN SEUL COMPOSANT POUR POUVOIR TOUT ENVOYER AVANT DE TERMINER
 *
 * `flushTout` doit pouvoir atteindre l'état COURANT des quatre blocs pour
 * les envoyer avant le `POST terminer` — rapport, prestations et signature
 * vivent donc dans le MÊME composant que le bouton, plutôt que dans des
 * composants frères qu'il faudrait coordonner par un contexte. Les photos
 * restent un composant indépendant (`PhotosTerrain`, 9EWB) : la page les
 * passe en `sectionPhotos` pour garder l'ordre visuel d'origine sans sortir
 * de ce fichier le tracé qui les concerne.
 *
 * ## LE BROUILLON LOCAL — RIEN NE SE PERD (I4)
 *
 * Toute saisie est écrite dans `localStorage`, sous l'intervention, AVANT
 * même la tentative d'envoi réseau. Au montage, un brouillon trouvé prend le
 * pas sur les valeurs du serveur : c'est forcément lui le plus récent,
 * puisqu'il n'existe que si une saisie locale a eu lieu depuis le dernier
 * envoi réussi. Il n'est effacé qu'après un « Terminer » accepté.
 *
 * **Limite acceptée** : le TRACÉ de la signature n'est pas redessiné sur le
 * canevas après un rechargement — seule l'image déjà capturée (le PNG) est
 * conservée dans le brouillon et renvoyée. Redessiner un tracé reconstruit
 * depuis ses pixels aurait ajouté une complexité que la donnée elle-même ne
 * justifie pas : rien n'est perdu, seul l'aperçu visuel du trait l'est.
 */

type Etat =
  "repos" | "attente" | "envoi" | "enregistre" | "echec" | "hors_ligne";

export type PrestationOption = {
  readonly id: string;
  readonly libelle: string;
};

type SignatureBrouillon =
  | {
      readonly issue: "signee";
      readonly nom: string;
      readonly qualite: string;
      readonly image: string;
    }
  | {
      readonly issue: "client_absent" | "refus_signature";
      readonly motif: string;
    };

type Brouillon = {
  readonly commentaire: string;
  readonly suite: string;
  readonly prestationIds: readonly string[];
  readonly signature: SignatureBrouillon | null;
};

function lireBrouillon(interventionId: string): Brouillon | null {
  try {
    const brut = window.localStorage.getItem(cleBrouillon(interventionId));
    return brut === null ? null : (JSON.parse(brut) as Brouillon);
  } catch {
    return null;
  }
}

function effacerBrouillon(interventionId: string): void {
  try {
    window.localStorage.removeItem(cleBrouillon(interventionId));
  } catch {
    // Le stockage peut être indisponible (navigation privée) — le filet
    // qu'il offre disparaît alors avec lui, sans faire échouer la saisie.
  }
}

const DELAI_MAXIMAL_ENVOI_MS = 15_000;

async function envoyerJson(
  url: string,
  corps: FormData,
): Promise<{ readonly ok: boolean; readonly motif: string | null } | null> {
  const limite = new AbortController();
  const minuteurAbandon = setTimeout(
    () => limite.abort(),
    DELAI_MAXIMAL_ENVOI_MS,
  );
  try {
    const reponseServeur = await fetch(url, {
      method: "POST",
      body: corps,
      headers: { Accept: "application/json" },
      signal: limite.signal,
    });
    return (await reponseServeur.json()) as {
      readonly ok: boolean;
      readonly motif: string | null;
    };
  } catch {
    // Pas de réseau, requête abandonnée après `DELAI_MAXIMAL_ENVOI_MS`, ou la
    // requête n'a pas atteint le serveur — c'est exactement le cas que I4
    // demande de ne jamais faire échouer : le brouillon local reste, et sera
    // renvoyé (retour du réseau, ou prochain « Terminer »).
    return null;
  } finally {
    clearTimeout(minuteurAbandon);
  }
}

/**
 * LE VERDICT D'UN BLOC (point 1, 9F4A-TERMINER-SANS-PERTE) — « Terminer »
 * doit distinguer trois issues, jamais les réduire à un booléen : accepté
 * par le serveur (ou rien à envoyer), refusé AVEC SON MOTIF, ou jamais
 * parti faute de réseau. Sans ce détail, `onClickTerminer` ne peut pas
 * nommer, sous le bouton, ce qui bloque encore.
 */
type VerdictBloc =
  | { readonly etat: "accepte" }
  | { readonly etat: "hors_ligne" }
  | { readonly etat: "echec"; readonly motifCle: string | null };

function texteDuMotif(motifCle: string | null): string {
  if (motifCle === null) {
    return "";
  }
  return estCleTraduction(motifCle) ? t(motifCle) : motifCle;
}

function memeEnsemble(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const valeur of a) {
    if (!b.has(valeur)) {
      return false;
    }
  }
  return true;
}

/**
 * UNE FONCTION, JAMAIS UN `const` AU TEXTE CALCULÉ PAR TERNAIRE — le gardien
 * L0-11 (`constantesLitterales`, `tests/unit/outils/rendu-visible.ts`) résout
 * la valeur d'un `const` affecté par ternaire avec un contexte VIDE, pour
 * éviter une dépendance circulaire ; un appel `t("...")` niché dans cette
 * ternaire n'y est alors plus reconnu comme un accès au dictionnaire, et la
 * CLÉ elle-même est signalée comme une chaîne écrite en dur. Une fonction
 * n'est pas une `VariableDeclaration` à littéraux : ce piège ne s'applique
 * pas à elle.
 */
function texteIndicatif(etat: Etat, texteReussite: string): string {
  if (etat === "enregistre") {
    return texteReussite;
  }
  if (etat === "hors_ligne") {
    return t("terrain.auto.hors_ligne");
  }
  if (etat === "echec") {
    return t("terrain.rapport.refus");
  }
  return t("terrain.auto.enregistrement");
}

function classeIndicatif(etat: Etat): string {
  if (etat === "enregistre") {
    return "text-app-vert-encre";
  }
  if (etat === "echec") {
    return "text-app-rouge-encre";
  }
  return "text-app-encre-faible";
}

function Indicateur({
  etat,
  texteReussite,
}: {
  readonly etat: Etat;
  readonly texteReussite: string;
}) {
  if (etat === "repos") {
    return null;
  }
  return (
    <p role="status" className={`text-16 font-bold ${classeIndicatif(etat)}`}>
      {texteIndicatif(etat, texteReussite)}
    </p>
  );
}

export function RapportTerrainAutomatique({
  interventionId,
  utilisateurId,
  societeId,
  rapportInitial,
  prestations,
  prestationsInitiales,
  dejaSignee,
  afficherTerminer,
  verdictTerminerRefuseCle,
  sectionPhotos,
}: {
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
  readonly rapportInitial: {
    readonly commentaire_technicien: string | null;
    readonly suite_a_donner: string | null;
  };
  readonly prestations: readonly PrestationOption[];
  readonly prestationsInitiales: readonly string[];
  readonly dejaSignee: boolean;
  readonly afficherTerminer: boolean;
  /**
   * LE REFUS SERVEUR DE « TERMINER » (9F4H3-HORS-RESEAU-ENVOYER) — `null` si
   * permis. Rendu ICI, jamais par la page : un « démarrer » mis en file
   * APRÈS ce rendu (donc inconnu du serveur) doit pouvoir faire TAIRE ce
   * refus sans jamais redemander `peutTerminer` au serveur — seul ce
   * composant connaît `enCoursLocalement`.
   */
  readonly verdictTerminerRefuseCle: string | null;
  readonly sectionPhotos: ReactNode;
}) {
  const router = useRouter();

  const [commentaire, setCommentaire] = useState(
    rapportInitial.commentaire_technicien ?? "",
  );
  const [suite, setSuite] = useState(rapportInitial.suite_a_donner ?? "");
  const [prestationsChoisies, setPrestationsChoisies] = useState<
    ReadonlySet<string>
  >(new Set(prestationsInitiales));
  const [issueSignature, setIssueSignature] = useState<IssueSignature | null>(
    null,
  );
  const [nomSignataire, setNomSignataire] = useState("");
  const [qualiteSignataire, setQualiteSignataire] = useState("");
  const [motifSignature, setMotifSignature] = useState("");
  const [aTrace, setATrace] = useState(false);

  const [etatRapport, setEtatRapport] = useState<Etat>("repos");
  const [etatPrestations, setEtatPrestations] = useState<Etat>("repos");
  const [etatSignature, setEtatSignature] = useState<Etat>("repos");
  const [enEnvoiTerminer, setEnEnvoiTerminer] = useState(false);
  const [messageTerminer, setMessageTerminer] = useState<string | null>(null);
  // « TERMINER » MIS EN FILE HORS RÉSEAU (9F4H3-HORS-RESEAU-ENVOYER, point 1,
  // décision n° 108) — cette fiche a déjà envoyé « terminer » à la file ;
  // l'écran le dit à la place du bouton tant que « Envoyer » n'a pas réussi.
  const [termineLocalement, setTermineLocalement] = useState(false);
  // UN « DÉMARRER » MIS EN FILE HORS RÉSEAU, SANS QUE LE SERVEUR LE SACHE
  // ENCORE (point 1) — `afficherTerminer` est la vérité SERVEUR au moment du
  // RENDU de cette page ; si le compteur a été démarré hors réseau DEPUIS,
  // la section « Terminer » doit apparaître quand même, sinon « démarrer
  // puis terminer, tout hors réseau » (le parcours même que décrit le point
  // 4) resterait impossible : rien ne redemande `afficherTerminer` au
  // serveur avant le retour du réseau.
  const [enCoursLocalement, setEnCoursLocalement] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const traceEnCoursRef = useRef(false);
  const minuteurRapportRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // VALEURS COURANTES, LUES PAR LES ENVOIS — jamais une fermeture périmée
  // d'un rendu antérieur (le minuteur du rapport ou l'écoute « online »
  // capturent ce composant une seule fois ; ces refs, elles, restent à jour).
  const commentaireRef = useRef(commentaire);
  const suiteRef = useRef(suite);
  const prestationsRef = useRef(prestationsChoisies);
  const issueSignatureRef = useRef(issueSignature);
  const nomSignatureRef = useRef(nomSignataire);
  const qualiteSignatureRef = useRef(qualiteSignataire);
  const motifSignatureRef = useRef(motifSignature);
  const imageSignatureRef = useRef<string | null>(null);

  const derniereRapportEnvoyeeRef = useRef({
    commentaire: rapportInitial.commentaire_technicien ?? "",
    suite: rapportInitial.suite_a_donner ?? "",
  });
  const dernierePrestationsEnvoyeesRef = useRef<ReadonlySet<string>>(
    new Set(prestationsInitiales),
  );
  const derniereSignatureEnvoyeeRef = useRef<string | null>(null);

  function ecrireBrouillonCourant(): void {
    const signature: SignatureBrouillon | null =
      issueSignatureRef.current === "signee"
        ? imageSignatureRef.current === null
          ? null
          : {
              issue: "signee",
              nom: nomSignatureRef.current,
              qualite: qualiteSignatureRef.current,
              image: imageSignatureRef.current,
            }
        : issueSignatureRef.current === "client_absent" ||
            issueSignatureRef.current === "refus_signature"
          ? {
              issue: issueSignatureRef.current,
              motif: motifSignatureRef.current,
            }
          : null;
    const brouillon: Brouillon = {
      commentaire: commentaireRef.current,
      suite: suiteRef.current,
      prestationIds: [...prestationsRef.current],
      signature,
    };
    try {
      window.localStorage.setItem(
        cleBrouillon(interventionId),
        JSON.stringify(brouillon),
      );
    } catch {
      // voir `effacerBrouillon` — le brouillon local n'est qu'un filet.
    }
  }

  async function envoyerRapport(): Promise<VerdictBloc> {
    if (minuteurRapportRef.current !== null) {
      clearTimeout(minuteurRapportRef.current);
      minuteurRapportRef.current = null;
    }
    const valeurs = {
      commentaire: commentaireRef.current,
      suite: suiteRef.current,
    };
    if (
      derniereRapportEnvoyeeRef.current.commentaire === valeurs.commentaire &&
      derniereRapportEnvoyeeRef.current.suite === valeurs.suite
    ) {
      return { etat: "accepte" };
    }
    setEtatRapport("envoi");
    const corps = new FormData();
    corps.set("commentaire_technicien", valeurs.commentaire);
    corps.set("suite_a_donner", valeurs.suite);
    const resultat = await envoyerJson(
      `/api/terrain/${interventionId}/rapport`,
      corps,
    );
    if (resultat === null) {
      setEtatRapport("hors_ligne");
      await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: { type: "rapport", ...valeurs },
      });
      return { etat: "hors_ligne" };
    }
    if (resultat.ok) {
      derniereRapportEnvoyeeRef.current = valeurs;
      setEtatRapport("enregistre");
      return { etat: "accepte" };
    }
    setEtatRapport("echec");
    return { etat: "echec", motifCle: resultat.motif };
  }

  function demarrerMinuteurRapport(): void {
    if (minuteurRapportRef.current !== null) {
      clearTimeout(minuteurRapportRef.current);
    }
    setEtatRapport("attente");
    minuteurRapportRef.current = setTimeout(() => {
      void envoyerRapport();
    }, 1500);
  }

  async function envoyerPrestations(): Promise<VerdictBloc> {
    const voulues = prestationsRef.current;
    if (memeEnsemble(dernierePrestationsEnvoyeesRef.current, voulues)) {
      return { etat: "accepte" };
    }
    setEtatPrestations("envoi");
    const corps = new FormData();
    for (const id of voulues) {
      corps.append("prestation_id", id);
    }
    const resultat = await envoyerJson(
      `/api/terrain/${interventionId}/prestations`,
      corps,
    );
    if (resultat === null) {
      setEtatPrestations("hors_ligne");
      await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: { type: "prestations", prestationIds: [...voulues] },
      });
      return { etat: "hors_ligne" };
    }
    if (resultat.ok) {
      dernierePrestationsEnvoyeesRef.current = new Set(voulues);
      setEtatPrestations("enregistre");
      return { etat: "accepte" };
    }
    setEtatPrestations("echec");
    return { etat: "echec", motifCle: resultat.motif };
  }

  async function tenterEnvoiSignature(): Promise<VerdictBloc> {
    const issue = issueSignatureRef.current;
    if (issue === null) {
      return { etat: "accepte" };
    }
    let champs: Record<string, string> | null = null;
    if (issue === "signee") {
      const image = imageSignatureRef.current;
      const nom = nomSignatureRef.current.trim();
      if (image === null || nom.length === 0) {
        return { etat: "accepte" };
      }
      champs = {
        issue,
        image_base64: image,
        signataire_nom: nom,
        signataire_qualite: qualiteSignatureRef.current.trim(),
      };
    } else {
      const motif = motifSignatureRef.current.trim();
      if (motif.length === 0) {
        return { etat: "accepte" };
      }
      champs = { issue, motif };
    }
    const signature = JSON.stringify(champs);
    if (derniereSignatureEnvoyeeRef.current === signature) {
      return { etat: "accepte" };
    }
    setEtatSignature("envoi");
    const donnees = new FormData();
    for (const [cle, valeur] of Object.entries(champs)) {
      donnees.set(cle, valeur);
    }
    const resultat = await envoyerJson(
      `/api/terrain/${interventionId}/signature`,
      donnees,
    );
    if (resultat === null) {
      setEtatSignature("hors_ligne");
      await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: { type: "signature", champs },
      });
      return { etat: "hors_ligne" };
    }
    if (resultat.ok) {
      derniereSignatureEnvoyeeRef.current = signature;
      setEtatSignature("enregistre");
      return { etat: "accepte" };
    }
    setEtatSignature("echec");
    return { etat: "echec", motifCle: resultat.motif };
  }

  /**
   * TOUT ENVOYER, ET RENDRE LE VERDICT DE CHAQUE BLOC (point 1,
   * 9F4A-TERMINER-SANS-PERTE) — `onClickTerminer` ne peut décider d'appeler
   * `/terminer` qu'en connaissant l'issue exacte des trois blocs, jamais sur
   * la seule foi que l'attente s'est terminée sans lever d'exception.
   */
  async function flushTout(): Promise<{
    readonly rapport: VerdictBloc;
    readonly prestations: VerdictBloc;
    readonly signature: VerdictBloc;
  }> {
    const rapport = await envoyerRapport();
    const prestations = await envoyerPrestations();
    const signature = await tenterEnvoiSignature();
    return { rapport, prestations, signature };
  }

  // LE BROUILLON LOCAL, REPRIS AU MONTAGE — voir l'en-tête du fichier.
  useEffect(() => {
    const brouillon = lireBrouillon(interventionId);
    if (brouillon === null) {
      return;
    }
    commentaireRef.current = brouillon.commentaire;
    setCommentaire(brouillon.commentaire);
    suiteRef.current = brouillon.suite;
    setSuite(brouillon.suite);
    const ensemble = new Set(brouillon.prestationIds);
    prestationsRef.current = ensemble;
    setPrestationsChoisies(ensemble);
    if (brouillon.signature !== null) {
      issueSignatureRef.current = brouillon.signature.issue;
      setIssueSignature(brouillon.signature.issue);
      if (brouillon.signature.issue === "signee") {
        nomSignatureRef.current = brouillon.signature.nom;
        setNomSignataire(brouillon.signature.nom);
        qualiteSignatureRef.current = brouillon.signature.qualite;
        setQualiteSignataire(brouillon.signature.qualite);
        imageSignatureRef.current = brouillon.signature.image;
        setATrace(true);
      } else {
        motifSignatureRef.current = brouillon.signature.motif;
        setMotifSignature(brouillon.signature.motif);
      }
    }
    void flushTout();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois au montage, par intervention
  }, [interventionId]);

  // UN « TERMINER » DÉJÀ MIS EN FILE (9F4H3, point 1) — relu au montage ET
  // à chaque modification de la file : un « démarrer » mis en file par
  // `BoutonCompteurTerrain` (un AUTRE composant, voir l'en-tête de
  // `lib/terrain/file-saisies.ts`) doit faire apparaître la section
  // « Terminer » sans attendre un rechargement de la page.
  useEffect(() => {
    function relire(): void {
      void listerFilePourIntervention(interventionId, {
        utilisateurId,
        societeId,
      }).then((entrees) => {
        setTermineLocalement(entrees.some((e) => e.geste.type === "terminer"));
        // AU MOINS UN « DÉMARRER », ET PAS SEULEMENT LE DERNIER GESTE —
        // démarrer PASSE l'intervention en cours UNE FOIS ; la mettre en
        // pause ensuite ne l'en fait pas ressortir (même règle que
        // `arreterLeCompteur`, qui ne touche jamais `intervention.statut`).
        setEnCoursLocalement(
          entrees.some(
            (e) => e.geste.type === "compteur" && e.geste.action === "demarrer",
          ),
        );
      });
    }
    relire();
    window.addEventListener(EVENEMENT_FILE_MODIFIEE, relire);
    return () => window.removeEventListener(EVENEMENT_FILE_MODIFIEE, relire);
  }, [interventionId, utilisateurId, societeId]);

  // AUCUN ENVOI AUTOMATIQUE AU RETOUR DU RÉSEAU (9F4H3-HORS-RESEAU-ENVOYER,
  // décision n° 105 d'Alexis) — REMPLACE l'ancien écouteur `online` qui
  // relançait `flushTout()` : une saisie faite hors réseau est désormais
  // gardée dans la file (voir les branches `hors_ligne` ci-dessus) et ne
  // repart qu'au clic explicite sur « Envoyer » (`components/terrain/
  // bouton-envoyer.tsx`), jamais seule.

  function onChangeCommentaire(valeur: string): void {
    commentaireRef.current = valeur;
    setCommentaire(valeur);
    ecrireBrouillonCourant();
    demarrerMinuteurRapport();
  }

  function onChangeSuite(valeur: string): void {
    suiteRef.current = valeur;
    setSuite(valeur);
    ecrireBrouillonCourant();
    demarrerMinuteurRapport();
  }

  function basculerPrestation(id: string, cochee: boolean): void {
    const suivant = new Set(prestationsRef.current);
    if (cochee) {
      suivant.add(id);
    } else {
      suivant.delete(id);
    }
    prestationsRef.current = suivant;
    setPrestationsChoisies(suivant);
    ecrireBrouillonCourant();
    void envoyerPrestations();
  }

  function choisirIssue(valeur: IssueSignature): void {
    issueSignatureRef.current = valeur;
    setIssueSignature(valeur);
    ecrireBrouillonCourant();
  }

  function position(evenement: React.PointerEvent<HTMLCanvasElement>): {
    x: number;
    y: number;
  } {
    const rectangle = evenement.currentTarget.getBoundingClientRect();
    return {
      x: evenement.clientX - rectangle.left,
      y: evenement.clientY - rectangle.top,
    };
  }

  function demarrerTrace(
    evenement: React.PointerEvent<HTMLCanvasElement>,
  ): void {
    const contexte = canvasRef.current?.getContext("2d");
    if (contexte === null || contexte === undefined) {
      return;
    }
    traceEnCoursRef.current = true;
    const { x, y } = position(evenement);
    contexte.beginPath();
    contexte.moveTo(x, y);
  }

  function tracer(evenement: React.PointerEvent<HTMLCanvasElement>): void {
    if (!traceEnCoursRef.current) {
      return;
    }
    const contexte = canvasRef.current?.getContext("2d");
    if (contexte === null || contexte === undefined) {
      return;
    }
    const { x, y } = position(evenement);
    contexte.lineTo(x, y);
    contexte.stroke();
    setATrace(true);
  }

  function arreterTrace(): void {
    if (!traceEnCoursRef.current) {
      return;
    }
    traceEnCoursRef.current = false;
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    imageSignatureRef.current = canvas.toDataURL("image/png");
    ecrireBrouillonCourant();
    void tenterEnvoiSignature();
  }

  function effacerTrace(): void {
    const canvas = canvasRef.current;
    const contexte = canvas?.getContext("2d");
    if (
      canvas === null ||
      canvas === undefined ||
      contexte === null ||
      contexte === undefined
    ) {
      return;
    }
    contexte.clearRect(0, 0, canvas.width, canvas.height);
    setATrace(false);
    imageSignatureRef.current = null;
    ecrireBrouillonCourant();
  }

  async function onClickTerminer(): Promise<void> {
    setEnEnvoiTerminer(true);
    setMessageTerminer(null);
    const verdict = await flushTout();

    // TERMINER HORS RÉSEAU (9F4H3-HORS-RESEAU-ENVOYER, point 1, décision
    // n° 108 d'Alexis) — ACCEPTÉ LOCALEMENT, signature comprise, plutôt que
    // refusé comme avant ce lot. Rapport, prestations et signature viennent
    // d'être mis en file par leurs propres branches `hors_ligne` ci-dessus ;
    // « terminer » les y rejoint. `peutTerminer` (temps mesuré compris)
    // N'EST PAS rejugé ici : le serveur reste l'arbitre final, à l'envoi
    // réel par « Envoyer » — un refus là-bas remet l'entrée en file avec son
    // motif (point 3 : rien ne se perd, rien n'est non plus accepté à tort).
    //
    // **GARDÉ SUR `!navigator.onLine` SEUL** (9F4A, revue) — un bloc qui
    // échoue alors que l'APPAREIL se croit en ligne (une route interceptée
    // par une épreuve, un aller-retour qui échoue une fois) reste le cas que
    // 9F4A traitait déjà : un refus clair, rejouable par un second clic, le
    // brouillon gardé — PAS une mise en file silencieuse que l'utilisateur
    // ne saurait pas distinguer d'un « Terminer » qui aurait réellement
    // réussi. Seul le mode avion RÉEL (ci-dessous) déclenche la décision 108.
    if (!navigator.onLine) {
      if (issueSignatureRef.current === null) {
        setEnEnvoiTerminer(false);
        setMessageTerminer(
          t("terrain.terminer.signature_non_enregistree") +
            texteDuMotif("intervention.refus.signature_manquante"),
        );
        return;
      }
      await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: { type: "terminer" },
      });
      setTermineLocalement(true);
      setEnEnvoiTerminer(false);
      setMessageTerminer(t("terrain.terminer.en_attente_envoi"));
      return;
    }
    if (
      verdict.rapport.etat === "hors_ligne" ||
      verdict.prestations.etat === "hors_ligne" ||
      verdict.signature.etat === "hors_ligne"
    ) {
      setEnEnvoiTerminer(false);
      setMessageTerminer(t("terrain.terminer.sans_reseau"));
      return;
    }
    if (verdict.rapport.etat === "echec") {
      setEnEnvoiTerminer(false);
      setMessageTerminer(
        t("terrain.terminer.rapport_non_enregistre") +
          texteDuMotif(verdict.rapport.motifCle),
      );
      return;
    }
    if (verdict.prestations.etat === "echec") {
      setEnEnvoiTerminer(false);
      setMessageTerminer(
        t("terrain.terminer.prestations_non_enregistrees") +
          texteDuMotif(verdict.prestations.motifCle),
      );
      return;
    }
    if (verdict.signature.etat === "echec") {
      setEnEnvoiTerminer(false);
      setMessageTerminer(
        t("terrain.terminer.signature_non_enregistree") +
          texteDuMotif(verdict.signature.motifCle),
      );
      return;
    }

    const resultat = await envoyerJson(
      `/api/terrain/${interventionId}/terminer`,
      new FormData(),
    );
    if (resultat === null) {
      setMessageTerminer(t("terrain.terminer.sans_reseau"));
      setEnEnvoiTerminer(false);
      return;
    }
    if (resultat.ok) {
      effacerBrouillon(interventionId);
      const suffixe =
        resultat.motif === null
          ? ""
          : `?motif=${encodeURIComponent(resultat.motif)}`;
      router.push(`/terrain/${interventionId}${suffixe}`);
      router.refresh();
      return;
    }
    setEnEnvoiTerminer(false);
    setMessageTerminer(texteDuMotif(resultat.motif));
  }

  return (
    <>
      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.rapport.titre")}
        </h2>
        <label className="flex flex-col gap-1">
          <span className="text-16 font-bold">
            {t("terrain.rapport.commentaire_libelle")}
          </span>
          <textarea
            name="commentaire_technicien"
            rows={3}
            value={commentaire}
            onChange={(e) => onChangeCommentaire(e.target.value)}
            onBlur={() => void envoyerRapport()}
            placeholder={t("terrain.rapport.commentaire_placeholder")}
            className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-16 font-bold">
            {t("terrain.rapport.suite_libelle")}
          </span>
          <textarea
            name="suite_a_donner"
            rows={2}
            value={suite}
            onChange={(e) => onChangeSuite(e.target.value)}
            onBlur={() => void envoyerRapport()}
            placeholder={t("terrain.rapport.suite_placeholder")}
            className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
          />
        </label>
        <Indicateur
          etat={etatRapport}
          texteReussite={t("terrain.rapport.enregistre")}
        />
      </section>

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.prestations.titre")}
        </h2>
        {prestations.length === 0 ? (
          <p className="text-app-encre-faible text-16 font-bold">
            {t("terrain.prestations.aucune")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {prestations.map((prestation) => (
              <label
                key={prestation.id}
                className="flex items-center gap-2 text-16 font-bold"
              >
                <input
                  type="checkbox"
                  checked={prestationsChoisies.has(prestation.id)}
                  onChange={(e) =>
                    basculerPrestation(prestation.id, e.target.checked)
                  }
                />
                {prestation.libelle}
              </label>
            ))}
          </div>
        )}
        <Indicateur
          etat={etatPrestations}
          texteReussite={t("terrain.prestations.enregistre")}
        />
      </section>

      {sectionPhotos}

      <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
        <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
          {t("terrain.signature.titre")}
        </h2>
        {dejaSignee ? (
          <p className="text-app-orange-encre bg-app-orange-fond border-app-orange-bord rounded-md border px-3 py-2 text-16 font-bold">
            {t("terrain.signature.deja_signee")}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            variant={issueSignature === "signee" ? "default" : "outline"}
            className="text-16"
            onClick={() => choisirIssue("signee")}
          >
            {t("terrain.signature.option_signee")}
          </Button>
          <Button
            type="button"
            size="lg"
            variant={issueSignature === "client_absent" ? "default" : "outline"}
            className="text-16"
            onClick={() => choisirIssue("client_absent")}
          >
            {t("terrain.signature.option_absent")}
          </Button>
          <Button
            type="button"
            size="lg"
            variant={
              issueSignature === "refus_signature" ? "default" : "outline"
            }
            className="text-16"
            onClick={() => choisirIssue("refus_signature")}
          >
            {t("terrain.signature.option_refus")}
          </Button>
        </div>

        {issueSignature === "signee" ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-16 font-bold">
                {t("terrain.signature.nom_libelle")}
              </span>
              <input
                type="text"
                value={nomSignataire}
                onChange={(e) => {
                  nomSignatureRef.current = e.target.value;
                  setNomSignataire(e.target.value);
                  ecrireBrouillonCourant();
                }}
                onBlur={() => void tenterEnvoiSignature()}
                maxLength={120}
                className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-16 font-bold">
                {t("terrain.signature.qualite_libelle")}
              </span>
              <input
                type="text"
                value={qualiteSignataire}
                onChange={(e) => {
                  qualiteSignatureRef.current = e.target.value;
                  setQualiteSignataire(e.target.value);
                  ecrireBrouillonCourant();
                }}
                onBlur={() => void tenterEnvoiSignature()}
                maxLength={80}
                className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
              />
            </label>
            <canvas
              ref={canvasRef}
              width={320}
              height={140}
              className="border-app-bord bg-app-surface touch-none rounded-md border"
              onPointerDown={demarrerTrace}
              onPointerMove={tracer}
              onPointerUp={arreterTrace}
              onPointerLeave={arreterTrace}
            />
            {aTrace ? null : (
              <p className="text-app-encre-faible text-16 font-bold">
                {t("terrain.signature.vide")}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="self-start text-16"
              onClick={effacerTrace}
            >
              {t("terrain.signature.effacer")}
            </Button>
          </>
        ) : null}

        {issueSignature === "client_absent" ||
        issueSignature === "refus_signature" ? (
          <label className="flex flex-col gap-1">
            <span className="text-16 font-bold">
              {t("terrain.signature.motif_libelle")}
            </span>
            <textarea
              rows={3}
              value={motifSignature}
              onChange={(e) => {
                motifSignatureRef.current = e.target.value;
                setMotifSignature(e.target.value);
                ecrireBrouillonCourant();
              }}
              onBlur={() => void tenterEnvoiSignature()}
              placeholder={t("terrain.signature.motif_placeholder")}
              className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
            />
          </label>
        ) : null}

        <Indicateur
          etat={etatSignature}
          texteReussite={t("terrain.signature.enregistre")}
        />
      </section>

      {afficherTerminer || enCoursLocalement ? (
        <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("terrain.terminer.titre")}
          </h2>
          {termineLocalement ? (
            // TERMINÉ LOCALEMENT, EN ATTENTE D'ENVOI (point 1, décision
            // n° 108) — plus de bouton tant que « Envoyer » n'a pas confirmé
            // auprès du serveur.
            <p
              role="status"
              className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold"
            >
              {t("terrain.terminer.en_attente_envoi")}
            </p>
          ) : (
            <>
              <Button
                type="button"
                size="lg"
                className="w-full text-16"
                disabled={enEnvoiTerminer}
                onClick={() => void onClickTerminer()}
              >
                {t("terrain.terminer.bouton")}
              </Button>
              {messageTerminer === null ? null : (
                <p
                  role="status"
                  className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold"
                >
                  {messageTerminer}
                </p>
              )}
            </>
          )}
        </section>
      ) : verdictTerminerRefuseCle === null ? null : (
        // LE REFUS SERVEUR DE « TERMINER » (voir la docstring du prop) —
        // affiché seulement si aucune saisie locale ne l'a rendu caduc.
        <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("terrain.terminer.titre")}
          </h2>
          <p className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold">
            {texteDuMotif(verdictTerminerRefuseCle)}
          </p>
        </section>
      )}
    </>
  );
}
