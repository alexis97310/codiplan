"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/fr";
import type { IssueSignature } from "@/lib/interventions/saisie";

/**
 * LA SIGNATURE CLIENT, À TROIS ISSUES (ticket 17-BON-2 ; 9DE-TP-CY1, décision
 * du 03/10/2026 point 11) : signée (tracée au doigt ou à la souris),
 * client absent, ou refus de signer — chacune avec son propre champ
 * obligatoire (le tracé et le nom, ou un motif).
 *
 * **Aucune issue choisie d'avance** — le technicien doit activement en
 * choisir une ; rien n'est pré-sélectionné.
 *
 * **Un canevas, jamais un fichier** : voir le modèle `InterventionSignature`.
 * Aucune dépendance neuve — CLAUDE.md §2 interdit toute librairie d'interface
 * hors composant calendrier, et un tracé sur `<canvas>` tient en une centaine
 * de lignes plutôt que d'en ajouter deux cents en dépendance.
 *
 * Le tracé est sérialisé en PNG (`toDataURL`) au moment de la soumission,
 * dans un champ caché : le formulaire reste un `POST` ordinaire, et
 * `app/api/terrain/[id]/signature` ne reçoit jamais qu'une chaîne de texte.
 */
export function SignatureTerrain({
  action,
  dejaSignee,
}: {
  readonly action: string;
  readonly dejaSignee: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nomRef = useRef<HTMLInputElement>(null);
  const motifRef = useRef<HTMLTextAreaElement>(null);
  const enCours = useRef(false);
  const [issue, setIssue] = useState<IssueSignature | null>(null);
  const [aTrace, setATrace] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

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

  function demarrer(evenement: React.PointerEvent<HTMLCanvasElement>): void {
    const contexte = canvasRef.current?.getContext("2d");
    if (contexte === null || contexte === undefined) {
      return;
    }
    enCours.current = true;
    const { x, y } = position(evenement);
    contexte.beginPath();
    contexte.moveTo(x, y);
  }

  function tracer(evenement: React.PointerEvent<HTMLCanvasElement>): void {
    if (!enCours.current) {
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

  function arreter(): void {
    enCours.current = false;
  }

  function effacer(): void {
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
    setErreur(null);
  }

  function choisir(valeur: IssueSignature): void {
    setIssue(valeur);
    setErreur(null);
  }

  function soumettre(evenement: React.FormEvent<HTMLFormElement>): void {
    if (issue === null) {
      evenement.preventDefault();
      setErreur(t("terrain.signature.option_manquante"));
      return;
    }
    if (issue === "signee") {
      const canvas = canvasRef.current;
      if (!aTrace || canvas === null) {
        evenement.preventDefault();
        setErreur(t("terrain.signature.vide"));
        return;
      }
      if ((nomRef.current?.value ?? "").trim().length === 0) {
        evenement.preventDefault();
        setErreur(t("terrain.signature.nom_manquant"));
        return;
      }
      const champ = evenement.currentTarget.elements.namedItem("image_base64");
      if (champ instanceof HTMLInputElement) {
        champ.value = canvas.toDataURL("image/png");
      }
      return;
    }
    if ((motifRef.current?.value ?? "").trim().length === 0) {
      evenement.preventDefault();
      setErreur(t("terrain.signature.motif_manquant"));
    }
  }

  return (
    <form
      action={action}
      method="post"
      onSubmit={soumettre}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="issue" value={issue ?? ""} />
      <input type="hidden" name="image_base64" />
      {dejaSignee ? (
        <p className="text-app-orange-encre bg-app-orange-fond border-app-orange-bord rounded-md border px-3 py-2 text-16 font-bold">
          {t("terrain.signature.deja_signee")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          variant={issue === "signee" ? "default" : "outline"}
          className="text-16"
          onClick={() => choisir("signee")}
        >
          {t("terrain.signature.option_signee")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant={issue === "client_absent" ? "default" : "outline"}
          className="text-16"
          onClick={() => choisir("client_absent")}
        >
          {t("terrain.signature.option_absent")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant={issue === "refus_signature" ? "default" : "outline"}
          className="text-16"
          onClick={() => choisir("refus_signature")}
        >
          {t("terrain.signature.option_refus")}
        </Button>
      </div>

      {issue === "signee" ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-16 font-bold">
              {t("terrain.signature.nom_libelle")}
            </span>
            <input
              ref={nomRef}
              type="text"
              name="signataire_nom"
              required
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
              name="signataire_qualite"
              maxLength={80}
              className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
            />
          </label>
          <canvas
            ref={canvasRef}
            width={320}
            height={140}
            className="border-app-bord bg-app-surface touch-none rounded-md border"
            onPointerDown={demarrer}
            onPointerMove={tracer}
            onPointerUp={arreter}
            onPointerLeave={arreter}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="text-16"
              onClick={effacer}
            >
              {t("terrain.signature.effacer")}
            </Button>
            <Button type="submit" size="lg" className="text-16">
              {t("terrain.signature.enregistrer")}
            </Button>
          </div>
        </>
      ) : null}

      {issue === "client_absent" || issue === "refus_signature" ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-16 font-bold">
              {t("terrain.signature.motif_libelle")}
            </span>
            <textarea
              ref={motifRef}
              name="motif"
              rows={3}
              required
              placeholder={t("terrain.signature.motif_placeholder")}
              className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
            />
          </label>
          <Button type="submit" size="lg" className="self-start text-16">
            {t("terrain.signature.enregistrer")}
          </Button>
        </>
      ) : null}

      {erreur === null ? null : (
        <p role="status" className="text-app-rouge-encre text-16 font-bold">
          {erreur}
        </p>
      )}
    </form>
  );
}
