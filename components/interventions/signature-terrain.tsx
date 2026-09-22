"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/fr";

/**
 * LA SIGNATURE CLIENT, TRACÉE AU DOIGT OU À LA SOURIS (ticket 17-BON-2).
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
  const enCours = useRef(false);
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

  function soumettre(evenement: React.FormEvent<HTMLFormElement>): void {
    const canvas = canvasRef.current;
    if (!aTrace || canvas === null) {
      evenement.preventDefault();
      setErreur(t("terrain.signature.vide"));
      return;
    }
    const champ = evenement.currentTarget.elements.namedItem("image_base64");
    if (champ instanceof HTMLInputElement) {
      champ.value = canvas.toDataURL("image/png");
    }
  }

  return (
    <form
      action={action}
      method="post"
      onSubmit={soumettre}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="image_base64" />
      {dejaSignee ? (
        <p className="text-app-orange-encre bg-app-orange-fond border-app-orange-bord rounded-md border px-3 py-2 text-[12.5px]">
          {t("terrain.signature.deja_signee")}
        </p>
      ) : null}
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
      {erreur === null ? null : (
        <p role="status" className="text-app-rouge-encre text-[12px]">
          {erreur}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={effacer}>
          {t("terrain.signature.effacer")}
        </Button>
        <Button type="submit" size="sm">
          {t("terrain.signature.enregistrer")}
        </Button>
      </div>
    </form>
  );
}
