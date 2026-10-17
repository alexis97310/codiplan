"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { estCleTraduction, t } from "@/lib/i18n/fr";
import { ajouterSaisie } from "@/lib/terrain/file-saisies";

/**
 * LA PHOTO, RÉDUITE SUR LE TÉLÉPHONE AVANT L'ENVOI (9EWB-PHOTOS-EN-BASE,
 * D96) — gardée en base, et la base plafonne à 1 Mo
 * (`document_octets_plafond`) ce qu'une photo brute dépasse presque
 * toujours.
 *
 * **À LA SÉLECTION**, pas à la soumission : la réduction démarre dès le
 * `change` du champ fichier (`createImageBitmap` → `<canvas>` ≤ 1600 px de
 * plus grand côté → JPEG qualité ~0,8), et son aperçu s'affiche pendant que
 * le technicien renseigne encore une légende facultative. La soumission
 * attend cette réduction si elle n'est pas encore terminée — un clic
 * immédiatement après la sélection ne doit jamais envoyer le fichier brut.
 *
 * **SANS JAVASCRIPT, LE FORMULAIRE NATIF RESTE** : `action`/`method`/
 * `encType` sont posés comme un formulaire ordinaire ; seul `onSubmit`
 * l'intercepte. Si `createImageBitmap` échoue ou si JavaScript est absent,
 * le fichier part tel quel, et la route refuse simplement au-delà de 1 Mo,
 * avec un message lisible.
 */

const COTE_MAX = 1600;
const QUALITE_JPEG = 0.8;

type Etat = "repos" | "envoi" | "enregistree" | "echec" | "en_attente";

type PhotoReduite = {
  readonly blob: Blob;
  readonly nomFichier: string;
};

async function reduire(fichier: File): Promise<PhotoReduite> {
  const image = await createImageBitmap(fichier, {
    imageOrientation: "from-image",
  });
  const ratio = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const canevas = document.createElement("canvas");
  canevas.width = Math.max(1, Math.round(image.width * ratio));
  canevas.height = Math.max(1, Math.round(image.height * ratio));
  const contexte = canevas.getContext("2d");
  if (contexte === null) {
    throw new Error("contexte-2d-indisponible");
  }
  contexte.drawImage(image, 0, 0, canevas.width, canevas.height);
  const blob = await new Promise<Blob | null>((resoudre) => {
    canevas.toBlob(resoudre, "image/jpeg", QUALITE_JPEG);
  });
  if (blob === null) {
    throw new Error("reduction-impossible");
  }
  return { blob, nomFichier: fichier.name };
}

export function PhotosTerrain({
  action,
  libelleAjouter,
  interventionId,
  utilisateurId,
  societeId,
}: {
  readonly action: string;
  readonly libelleAjouter: string;
  /** Pour ranger la photo dans la file hors réseau (9F4H3, point 1) si l'envoi échoue. */
  readonly interventionId: string;
  readonly utilisateurId: string;
  readonly societeId: string;
}) {
  const router = useRouter();
  const libelleRef = useRef<HTMLInputElement>(null);
  const reduiteRef = useRef<PhotoReduite | null>(null);
  const enCoursRef = useRef<Promise<void> | null>(null);
  const [etat, setEtat] = useState<Etat>("repos");
  const [motif, setMotif] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);

  function remplacerApercu(suivant: string | null): void {
    setApercu((precedent) => {
      if (precedent !== null) {
        URL.revokeObjectURL(precedent);
      }
      return suivant;
    });
  }

  function selectionner(evenement: React.ChangeEvent<HTMLInputElement>): void {
    const fichier = evenement.currentTarget.files?.[0];
    reduiteRef.current = null;
    setEtat("repos");
    setMotif(null);
    remplacerApercu(null);
    if (fichier === undefined) {
      return;
    }
    enCoursRef.current = reduire(fichier)
      .then((reduite) => {
        reduiteRef.current = reduite;
        remplacerApercu(URL.createObjectURL(reduite.blob));
      })
      .catch(() => {
        setEtat("echec");
        setMotif("terrain.photos.reduction_impossible");
      });
  }

  async function soumettre(
    evenement: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    evenement.preventDefault();
    const formulaire = evenement.currentTarget;
    await enCoursRef.current;
    const reduite = reduiteRef.current;
    if (reduite === null) {
      return;
    }
    setEtat("envoi");
    setMotif(null);
    try {
      const donnees = new FormData();
      donnees.set("fichier", reduite.blob, reduite.nomFichier);
      const libelle = libelleRef.current?.value.trim() ?? "";
      if (libelle.length > 0) {
        donnees.set("libelle", libelle);
      }
      const reponseServeur = await fetch(action, {
        method: "POST",
        body: donnees,
        headers: { Accept: "application/json" },
      });
      const resultat = (await reponseServeur.json()) as {
        readonly ok: boolean;
        readonly motif: string | null;
      };
      if (resultat.ok) {
        setEtat("enregistree");
        reduiteRef.current = null;
        remplacerApercu(null);
        formulaire.reset();
        router.refresh();
      } else {
        setEtat("echec");
        setMotif(resultat.motif);
      }
    } catch {
      // PAS DE RÉSEAU (9F4H3-HORS-RESEAU-ENVOYER, point 1) — la photo
      // réduite est gardée dans la file plutôt que perdue dans l'état
      // mémoire de ce composant ; elle part avec « Envoyer ».
      await ajouterSaisie({
        interventionId,
        utilisateurId,
        societeId,
        geste: {
          type: "photo",
          blob: reduite.blob,
          nomFichier: reduite.nomFichier,
          libelle: libelleRef.current?.value.trim() ?? "",
        },
      });
      setEtat("en_attente");
      reduiteRef.current = null;
      remplacerApercu(null);
      formulaire.reset();
    }
  }

  return (
    <form
      action={action}
      method="post"
      encType="multipart/form-data"
      onSubmit={soumettre}
      className="flex flex-col gap-2"
    >
      <input
        type="file"
        name="fichier"
        accept="image/*"
        capture="environment"
        required
        onChange={selectionner}
        className="text-16 font-bold"
      />
      <input
        ref={libelleRef}
        type="text"
        name="libelle"
        placeholder={t("terrain.photos.libelle_placeholder")}
        className="border-app-bord bg-app-surface rounded-md border px-2 py-1.5 text-16 font-bold"
      />
      {apercu === null ? null : (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu local (URL.createObjectURL), jamais servi par une route applicative
        <img
          src={apercu}
          alt={t("terrain.photos.apercu")}
          className="border-app-bord aspect-square w-24 rounded border object-cover"
        />
      )}
      <Button type="submit" size="lg" className="self-start text-16">
        {libelleAjouter}
      </Button>
      {etat === "envoi" ? (
        <p role="status" className="text-app-encre-faible text-16 font-bold">
          {t("terrain.photos.envoi")}
        </p>
      ) : null}
      {etat === "enregistree" ? (
        <p role="status" className="text-app-vert-encre text-16 font-bold">
          {t("terrain.photos.enregistree")}
        </p>
      ) : null}
      {etat === "echec" ? (
        <p role="status" className="text-app-rouge-encre text-16 font-bold">
          {motif !== null && estCleTraduction(motif)
            ? t(motif)
            : t("terrain.photos.echec")}
        </p>
      ) : null}
      {etat === "en_attente" ? (
        <p
          role="status"
          className="border-app-orange-bord bg-app-orange-fond text-app-orange-encre rounded-md border px-3 py-2 text-16 font-bold"
        >
          {t("terrain.auto.hors_ligne")}
        </p>
      ) : null}
    </form>
  );
}
