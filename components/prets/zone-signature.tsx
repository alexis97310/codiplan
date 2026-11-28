"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * LA ZONE DE SIGNATURE TACTILE DU BON DE PRÊT (9L62-PRET-3-BON-SIGNE) — UN
 * CANEVAS BRUT, pointeur par pointeur, exactement le même principe que
 * `components/terrain/rapport-automatique.tsx` (`preparerTraitSignature`,
 * `position`) : la RÉSOLUTION INTERNE du canevas est posée à sa taille
 * affichée × `devicePixelRatio`, et l'épaisseur du trait est recalculée à
 * chaque début de tracé — redimensionner un canevas réinitialise
 * `lineWidth` avec lui.
 *
 * **Un champ caché porte le résultat** (`data:image/png;base64,...`), posé
 * UNIQUEMENT à la fin d'un tracé (`onPointerUp`/`onPointerLeave`) : le
 * formulaire qui contient ce composant reste un `<form action method="post">`
 * natif (9L61), AUCUNE soumission par `fetch` — le même principe que le reste
 * du module.
 */

const LARGEUR_TRAIT_CSS_PX = 2;

function position(
  evenement: React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): { readonly x: number; readonly y: number } {
  const rectangle = canvas.getBoundingClientRect();
  return {
    x: ((evenement.clientX - rectangle.left) * canvas.width) / rectangle.width,
    y: ((evenement.clientY - rectangle.top) * canvas.height) / rectangle.height,
  };
}

export function ZoneSignature({
  nomChamp,
  libelleEffacer,
}: {
  readonly nomChamp: string;
  readonly libelleEffacer: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const traceEnCours = useRef(false);
  const [donnees, setDonnees] = useState("");

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const rectangle = canvas.getBoundingClientRect();
    const echelle = window.devicePixelRatio || 1;
    canvas.width = rectangle.width * echelle;
    canvas.height = rectangle.height * echelle;
  }, []);

  function demarrerTrace(
    evenement: React.PointerEvent<HTMLCanvasElement>,
  ): void {
    const canvas = canvasRef.current;
    const contexte = canvas?.getContext("2d");
    if (canvas === null || contexte === null || contexte === undefined) {
      return;
    }
    traceEnCours.current = true;
    const rectangle = canvas.getBoundingClientRect();
    const echelle = rectangle.width === 0 ? 1 : canvas.width / rectangle.width;
    contexte.lineWidth = LARGEUR_TRAIT_CSS_PX * echelle;
    contexte.lineCap = "round";
    contexte.lineJoin = "round";
    // AUCUNE COULEUR POSÉE (L0-09, point 5) — même choix que le canevas de
    // signature terrain (`components/terrain/rapport-automatique.tsx`), qui
    // ne pose pas non plus `strokeStyle` : le noir par défaut du canevas
    // suffit à un tracé, et ce composant n'a pas à écrire une couleur en dur.
    const point = position(evenement, canvas);
    contexte.beginPath();
    contexte.moveTo(point.x, point.y);
  }

  function tracer(evenement: React.PointerEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    const contexte = canvas?.getContext("2d");
    if (
      !traceEnCours.current ||
      canvas === null ||
      contexte === null ||
      contexte === undefined
    ) {
      return;
    }
    const point = position(evenement, canvas);
    contexte.lineTo(point.x, point.y);
    contexte.stroke();
  }

  function arreterTrace(): void {
    if (!traceEnCours.current) {
      return;
    }
    traceEnCours.current = false;
    const canvas = canvasRef.current;
    if (canvas !== null) {
      setDonnees(canvas.toDataURL("image/png"));
    }
  }

  function effacer(): void {
    const canvas = canvasRef.current;
    const contexte = canvas?.getContext("2d");
    if (canvas !== null && contexte !== null && contexte !== undefined) {
      contexte.clearRect(0, 0, canvas.width, canvas.height);
    }
    setDonnees("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <canvas
        ref={canvasRef}
        className="h-[150px] w-full touch-none rounded-md border border-input bg-background"
        onPointerDown={demarrerTrace}
        onPointerMove={tracer}
        onPointerUp={arreterTrace}
        onPointerLeave={arreterTrace}
      />
      <input type="hidden" name={nomChamp} value={donnees} />
      <Button type="button" variant="outline" size="sm" onClick={effacer}>
        {libelleEffacer}
      </Button>
    </div>
  );
}
