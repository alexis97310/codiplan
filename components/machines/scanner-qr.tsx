"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import jsQR from "jsqr";

import { ActionPrimaire } from "@/components/ui/action-primaire";
import { Message } from "@/components/ui/message";
import { type CleTraduction, t } from "@/lib/i18n/fr";

import type { ResultatScanQr } from "./scan-qr-resultat";

/**
 * LE LECTEUR DE QR CODE DANS L'APPLICATION (9G10-SCANNER-QR-APPLI, D144
 * d'Alexis du 22/10/2026) — caméra arrière, décodage LOCAL, et un seul geste
 * réseau : résoudre le TEXTE lu, jamais l'image.
 *
 * ## `BarcodeDetector` quand il sait lire un QR, `jsqr` sinon
 *
 * Les deux moteurs lisent la MÊME image — un `<canvas>` recopié depuis la
 * vidéo à chaque image —, jamais une seconde capture : deux lectures de la
 * même trame divergeraient en silence si l'une voyait un cadre que l'autre a
 * manqué (§9, 01/09).
 *
 * ## LE JETON NE S'ÉCRIT JAMAIS EN CLAIR AILLEURS QUE DANS CE MODULE (D71)
 *
 * Il n'entre dans aucune URL de page (la résolution passe par une ACTION
 * SERVEUR, dont Next.js encode l'appel en corps de requête, jamais en URL),
 * dans aucun `console.*`, dans aucun message d'erreur affiché : un échec de
 * résolution rend un des TROIS refus de `ResultatScanQr`, jamais la valeur
 * lue.
 *
 * ## LA CAMÉRA S'ARRÊTE TROIS FOIS, ET C'EST UNE LISTE CLOSE
 *
 * Un code est lu ; l'écran est quitté (démontage) ; la page passe en arrière-
 * plan (`visibilitychange`). Dans les trois cas, les pistes de `MediaStream`
 * sont arrêtées explicitement (`track.stop()`) — une caméra arrière allumée
 * sans qu'on la regarde est le défaut qu'un technicien remarque le premier.
 */

type EtatLecteur =
  "demande" | "active" | "refusee" | "absente" | "non_securise";

/** Le résultat affiché peut porter un refus que le serveur ne connaît pas (le réseau lui-même). */
type IssueScan = ResultatScanQr | { readonly suite: "hors_ligne" };

/** Ce qui s'AFFICHE n'est jamais `rediriger` — ce cas-là quitte l'écran avant `setIssue` (voir `traiterCode`). */
type IssueAffichee = Exclude<IssueScan, { readonly suite: "rediriger" }>;

const CLE_PAR_ISSUE: Record<IssueAffichee["suite"], CleTraduction> = {
  introuvable: "machine.scanner.non_reconnu",
  hors_perimetre: "machine.scanner.hors_perimetre",
  hors_ligne: "machine.scanner.hors_ligne",
};

const CLE_PAR_ETAT: Record<Exclude<EtatLecteur, "active">, CleTraduction> = {
  demande: "machine.scanner.demande_autorisation",
  refusee: "machine.scanner.refusee",
  absente: "machine.scanner.absente",
  non_securise: "machine.scanner.non_securise",
};

/** `BarcodeDetector` n'est pas (encore) dans `lib.dom` — déclaré localement, au plus près de son seul usage. */
type DetecteurNatif = {
  detect: (
    source: CanvasImageSource,
  ) => Promise<
    ReadonlyArray<{ readonly rawValue: string; readonly format: string }>
  >;
};
type ConstructeurDetecteurNatif = new (options: {
  formats: readonly string[];
}) => DetecteurNatif;

function constructeurDetecteurNatif(): ConstructeurDetecteurNatif | null {
  const fenetre = window as unknown as {
    BarcodeDetector?: ConstructeurDetecteurNatif;
  };
  return fenetre.BarcodeDetector ?? null;
}

export function ScannerQr({
  resoudre,
}: Readonly<{
  /** L'action serveur qui résout un texte lu en destination — bureau ou terrain. */
  resoudre: (saisie: string) => Promise<ResultatScanQr>;
}>) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const brasRef = useRef<number | null>(null);
  const detectionNativeEnCours = useRef(false);
  const traitementEnCours = useRef(false);

  const [etatLecteur, setEtatLecteur] = useState<EtatLecteur>("demande");
  const [issue, setIssue] = useState<IssueAffichee | null>(null);
  const [enAttente, setEnAttente] = useState(false);
  const [saisieManuelle, setSaisieManuelle] = useState("");

  const arreterCamera = useCallback(() => {
    if (brasRef.current !== null) {
      cancelAnimationFrame(brasRef.current);
      brasRef.current = null;
    }
    fluxRef.current?.getTracks().forEach((piste) => piste.stop());
    fluxRef.current = null;
  }, []);

  const traiterCode = useCallback(
    (texte: string) => {
      if (traitementEnCours.current) return;
      traitementEnCours.current = true;
      arreterCamera();
      setEnAttente(true);
      void (async () => {
        const reponse: IssueScan = !navigator.onLine
          ? { suite: "hors_ligne" }
          : await resoudre(texte).catch((): IssueScan => ({
              suite: "hors_ligne",
            }));
        setEnAttente(false);
        if (reponse.suite === "rediriger") {
          router.push(reponse.url);
          return;
        }
        setIssue(reponse);
        traitementEnCours.current = false;
      })();
    },
    [arreterCamera, resoudre, router],
  );

  const demarrerDecodage = useCallback(() => {
    const Detecteur = constructeurDetecteurNatif();
    const detecteur = Detecteur
      ? new Detecteur({ formats: ["qr_code"] })
      : null;

    const etape = () => {
      if (traitementEnCours.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video === null || canvas === null || video.videoWidth === 0) {
        brasRef.current = requestAnimationFrame(etape);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx2d = canvas.getContext("2d");
      if (ctx2d === null) {
        brasRef.current = requestAnimationFrame(etape);
        return;
      }
      ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (detecteur !== null) {
        if (!detectionNativeEnCours.current) {
          detectionNativeEnCours.current = true;
          detecteur
            .detect(canvas)
            .then((codes) => {
              const trouve = codes.find((c) => c.format === "qr_code");
              if (trouve !== undefined) traiterCode(trouve.rawValue);
            })
            .catch(() => {})
            .finally(() => {
              detectionNativeEnCours.current = false;
            });
        }
      } else {
        const image = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
        const trouve = jsQR(image.data, image.width, image.height);
        if (trouve !== null) {
          traiterCode(trouve.data);
          return;
        }
      }
      brasRef.current = requestAnimationFrame(etape);
    };
    brasRef.current = requestAnimationFrame(etape);
  }, [traiterCode]);

  const demarrerCamera = useCallback(() => {
    if (!window.isSecureContext) {
      setEtatLecteur("non_securise");
      return;
    }
    if (navigator.mediaDevices?.getUserMedia === undefined) {
      setEtatLecteur("absente");
      return;
    }
    setEtatLecteur("demande");
    let annule = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((flux) => {
        if (annule) {
          flux.getTracks().forEach((piste) => piste.stop());
          return;
        }
        fluxRef.current = flux;
        if (videoRef.current !== null) {
          videoRef.current.srcObject = flux;
          void videoRef.current.play();
        }
        setEtatLecteur("active");
        demarrerDecodage();
      })
      .catch((erreur: unknown) => {
        if (annule) return;
        setEtatLecteur(
          erreur instanceof DOMException && erreur.name === "NotFoundError"
            ? "absente"
            : "refusee",
        );
      });
    return () => {
      annule = true;
    };
  }, [demarrerDecodage]);

  useEffect(() => {
    const annuler = demarrerCamera();
    return () => {
      annuler?.();
      arreterCamera();
    };
  }, [demarrerCamera, arreterCamera]);

  useEffect(() => {
    const gestionnaire = () => {
      if (document.visibilityState === "hidden") arreterCamera();
    };
    document.addEventListener("visibilitychange", gestionnaire);
    return () => document.removeEventListener("visibilitychange", gestionnaire);
  }, [arreterCamera]);

  const relancer = useCallback(() => {
    setIssue(null);
    demarrerCamera();
  }, [demarrerCamera]);

  const soumettreSaisieManuelle = useCallback(
    (evenement: React.FormEvent<HTMLFormElement>) => {
      evenement.preventDefault();
      const texte = saisieManuelle.trim();
      setSaisieManuelle("");
      if (texte.length === 0) return;
      traiterCode(texte);
    },
    [saisieManuelle, traiterCode],
  );

  return (
    <div className="flex flex-col gap-4">
      {issue !== null ? (
        <div className="flex flex-col gap-3">
          <Message ton="refus" titre={t(CLE_PAR_ISSUE[issue.suite])} />
          <button
            type="button"
            onClick={relancer}
            className="border-app-bord bg-app-surface inline-flex min-h-[40px] w-fit items-center justify-center rounded-md border px-4 py-2 text-[13px] font-bold"
          >
            {t("machine.scanner.relancer")}
          </button>
        </div>
      ) : (
        <div className="border-app-bord bg-app-surface relative overflow-hidden rounded-lg border">
          <video
            ref={videoRef}
            muted
            playsInline
            className="bg-app-encre aspect-square w-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          {etatLecteur === "active" ? (
            enAttente ? (
              <p
                role="status"
                className="bg-app-encre/80 text-app-surface absolute inset-x-0 bottom-0 p-2 text-center text-13 font-bold"
              >
                {t("machine.scanner.en_cours")}
              </p>
            ) : null
          ) : (
            <div
              role={etatLecteur === "refusee" ? "alert" : "status"}
              className="bg-app-encre/90 text-app-surface absolute inset-0 flex items-center justify-center p-4 text-center text-14 font-bold"
            >
              {t(CLE_PAR_ETAT[etatLecteur])}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={soumettreSaisieManuelle}
        className="border-app-bord bg-app-surface flex flex-col gap-2 rounded-lg border p-4"
      >
        <label
          htmlFor="scanner-qr-saisie-manuelle"
          className="text-13 font-bold"
        >
          {t("machine.scanner.saisie_label")}
        </label>
        <div className="flex gap-2">
          <input
            id="scanner-qr-saisie-manuelle"
            type="text"
            value={saisieManuelle}
            onChange={(evenement) => setSaisieManuelle(evenement.target.value)}
            placeholder={t("machine.scanner.saisie_placeholder")}
            className="border-app-bord min-h-[40px] flex-1 rounded-md border px-3 py-2 text-[13px] font-bold"
          />
          <ActionPrimaire type="submit">
            {t("machine.scanner.saisie_bouton")}
          </ActionPrimaire>
        </div>
      </form>
    </div>
  );
}
