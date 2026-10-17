"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import type { IssueSignature } from "@/lib/interventions/saisie";

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

function cleBrouillon(interventionId: string): string {
  return `codiplan.terrain.${interventionId}.brouillon`;
}

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

async function envoyerJson(
  url: string,
  corps: FormData,
): Promise<{ readonly ok: boolean; readonly motif: string | null } | null> {
  try {
    const reponseServeur = await fetch(url, {
      method: "POST",
      body: corps,
      headers: { Accept: "application/json" },
    });
    return (await reponseServeur.json()) as {
      readonly ok: boolean;
      readonly motif: string | null;
    };
  } catch {
    // Pas de réseau, ou la requête n'a pas atteint le serveur — c'est
    // exactement le cas que I4 demande de ne jamais faire échouer : le
    // brouillon local reste, et sera renvoyé (retour du réseau, ou prochain
    // « Terminer »).
    return null;
  }
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
  rapportInitial,
  prestations,
  prestationsInitiales,
  dejaSignee,
  afficherTerminer,
  sectionPhotos,
}: {
  readonly interventionId: string;
  readonly rapportInitial: {
    readonly commentaire_technicien: string | null;
    readonly suite_a_donner: string | null;
  };
  readonly prestations: readonly PrestationOption[];
  readonly prestationsInitiales: readonly string[];
  readonly dejaSignee: boolean;
  readonly afficherTerminer: boolean;
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

  async function envoyerRapport(): Promise<void> {
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
      return;
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
      return;
    }
    if (resultat.ok) {
      derniereRapportEnvoyeeRef.current = valeurs;
      setEtatRapport("enregistre");
    } else {
      setEtatRapport("echec");
    }
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

  async function envoyerPrestations(): Promise<void> {
    const voulues = prestationsRef.current;
    if (memeEnsemble(dernierePrestationsEnvoyeesRef.current, voulues)) {
      return;
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
      return;
    }
    if (resultat.ok) {
      dernierePrestationsEnvoyeesRef.current = new Set(voulues);
      setEtatPrestations("enregistre");
    } else {
      setEtatPrestations("echec");
    }
  }

  async function tenterEnvoiSignature(): Promise<void> {
    const issue = issueSignatureRef.current;
    if (issue === null) {
      return;
    }
    let champs: Record<string, string> | null = null;
    if (issue === "signee") {
      const image = imageSignatureRef.current;
      const nom = nomSignatureRef.current.trim();
      if (image === null || nom.length === 0) {
        return;
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
        return;
      }
      champs = { issue, motif };
    }
    const signature = JSON.stringify(champs);
    if (derniereSignatureEnvoyeeRef.current === signature) {
      return;
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
      return;
    }
    if (resultat.ok) {
      derniereSignatureEnvoyeeRef.current = signature;
      setEtatSignature("enregistre");
    } else {
      setEtatSignature("echec");
    }
  }

  async function flushTout(): Promise<void> {
    await envoyerRapport();
    await envoyerPrestations();
    await tenterEnvoiSignature();
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

  // LE RETOUR DU RÉSEAU RENVOIE CE QUI ATTENDAIT (point 2 du ticket) —
  // enregistré une seule fois : les fonctions lisent les refs, toujours à
  // jour, jamais un état figé au moment de l'écoute.
  useEffect(() => {
    function auRetourDuReseau(): void {
      void flushTout();
    }
    window.addEventListener("online", auRetourDuReseau);
    return () => window.removeEventListener("online", auRetourDuReseau);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `flushTout` lit des refs, jamais un état figé
  }, []);

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
    if (!navigator.onLine) {
      setMessageTerminer(t("terrain.terminer.hors_reseau"));
      return;
    }
    setEnEnvoiTerminer(true);
    setMessageTerminer(null);
    await flushTout();
    const resultat = await envoyerJson(
      `/api/terrain/${interventionId}/terminer`,
      new FormData(),
    );
    if (resultat === null) {
      setMessageTerminer(t("terrain.terminer.hors_reseau"));
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
    setMessageTerminer(
      estCleTraduction(resultat.motif ?? "")
        ? t(resultat.motif as Parameters<typeof t>[0])
        : (resultat.motif ?? ""),
    );
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

      {afficherTerminer ? (
        <section className="bg-app-surface border-app-bord flex flex-col gap-3 rounded-lg border px-4 py-3.5">
          <h2 className="text-app-encre-faible text-[12px] font-bold tracking-[0.6px] uppercase">
            {t("terrain.terminer.titre")}
          </h2>
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
        </section>
      ) : null}
    </>
  );
}
