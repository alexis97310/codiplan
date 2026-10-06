"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { ActionPrimaire } from "@/components/ui/action-primaire";
import { Icone, type NomIcone } from "@/components/ui/icone";
import { peut } from "@/lib/auth/habilitations";
import type { Role } from "@/lib/auth/roles";
import { mot } from "@/lib/i18n/vocabulaire";
import { t, type CleTraduction } from "@/lib/i18n/fr";

/**
 * LE MENU « CRÉER » DU BANDEAU DU BUREAU (QE-3, 9DU-TP-NAV3-RECHERCHE-RAIL,
 * D171) — ne propose QUE les créations permises par les CAPACITÉS de la
 * session, jamais une capacité recopiée pour ce seul menu : les cinq lignes
 * ci-dessous lisent `lib/auth/habilitations.ts`, exactement la capacité qui
 * gouverne déjà la route de création qu'elles ouvrent (`/api/interventions/
 * creer`, `/api/absences/declarer`, `/api/machines/creer`, et le garde
 * `gerer_client_site` de `/clients/nouveau`, `/sites/nouveau`).
 *
 * **Pas de VGP ici** — le seul point d'entrée réel, `/vgp/enregistrer/[id]`,
 * exige une machine déjà choisie dans la liste `/vgp` : il n'y a aucune page
 * de création à offrir sans elle, et ce lot n'en invente pas une (§8).
 *
 * **La capacité décide QUI VOIT l'option, jamais si le geste est permis** —
 * même doctrine que `lib/navigation/entrees.ts` pour la barre : la route de
 * création reste le seul vrai contrôle.
 */

type OptionCreation = {
  readonly icone: NomIcone;
  readonly titre: CleTraduction;
  readonly aide: CleTraduction;
  readonly href: string;
  readonly capacite: Parameters<typeof peut>[1];
};

const OPTIONS: readonly OptionCreation[] = [
  {
    icone: "clipboard",
    titre: "creer.intervention",
    aide: "creer.intervention_aide",
    href: "/interventions/nouvelle",
    capacite: "creer_demande",
  },
  {
    icone: "user-off",
    titre: "creer.absence",
    aide: "creer.absence_aide",
    // OUVRE DIRECTEMENT LE VOLET DE DÉCLARATION (9EC-TP-UX3-E-ABSENCES) — une
    // seule ligne changée, D171 inchangée ailleurs : `/absences` nu reste une
    // adresse valide.
    href: "/absences?declarer=1",
    capacite: "modifier_planning",
  },
  {
    icone: "machine",
    titre: "creer.machine",
    aide: "creer.machine_aide",
    href: "/parc/nouvelle",
    capacite: "gerer_machine",
  },
  {
    icone: "building",
    titre: "creer.client",
    aide: "creer.client_aide",
    href: "/clients/nouveau",
    capacite: "gerer_client_site",
  },
  {
    icone: "pin",
    titre: "vocabulaire.site",
    aide: "creer.site_aide",
    href: "/sites/nouveau",
    capacite: "gerer_client_site",
  },
];

export function MenuCreer({ role }: Readonly<{ readonly role: Role | null }>) {
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ouvert) {
      return;
    }
    function surClicExterieur(evenement: MouseEvent): void {
      if (!conteneurRef.current?.contains(evenement.target as Node)) {
        setOuvert(false);
      }
    }
    function surTouche(evenement: KeyboardEvent): void {
      if (evenement.key === "Escape") {
        setOuvert(false);
      }
    }
    document.addEventListener("mousedown", surClicExterieur);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClicExterieur);
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  if (role === null) {
    return null;
  }
  const options = OPTIONS.filter((option) => peut(role, option.capacite));
  if (options.length === 0) {
    return null;
  }

  return (
    <div ref={conteneurRef} className="relative shrink-0">
      <ActionPrimaire
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="h-[38px] gap-2"
      >
        <Icone nom="plus" taille={16} />
        {t("nav.creer")}
      </ActionPrimaire>
      {!ouvert ? null : (
        <div
          role="menu"
          aria-label={t("nav.creer")}
          className="border-app-bord bg-app-surface absolute top-full right-0 z-40 mt-1.5 w-[260px] rounded-lg border p-1.5 shadow-xl"
        >
          {options.map((option) => (
            <Link
              key={option.href}
              role="menuitem"
              href={option.href}
              onClick={() => setOuvert(false)}
              className="hover:bg-app-fond flex items-start gap-2.5 rounded-md px-2.5 py-2 text-13 font-bold"
            >
              <Icone nom={option.icone} taille={18} />
              <span>
                {option.titre === "vocabulaire.site"
                  ? mot("site")
                  : t(option.titre)}
                <span className="text-app-encre-faible block text-12 font-bold">
                  {t(option.aide)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
