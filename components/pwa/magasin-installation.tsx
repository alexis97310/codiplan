"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

import {
  detecterEtatInstallation,
  type EtatInstallation,
} from "@/lib/pwa/installation";

type EvenementInvitation = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type ContexteInstallation = {
  etat: EtatInstallation;
  /** `null` tant qu'aucune invitation Android n'a été captée — le bouton ne l'appelle jamais dans ce cas. */
  installer: (() => Promise<void>) | null;
};

const Contexte = createContext<ContexteInstallation | null>(null);

function etatInitial(): EtatInstallation {
  if (typeof window === "undefined") {
    return "autre";
  }
  return detecterEtatInstallation({
    modeAutonome: estModeAutonome(),
    invitationAndroidDisponible: false,
    userAgent: navigator.userAgent,
  });
}

function estModeAutonome(): boolean {
  const naviga = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    naviga.standalone === true
  );
}

/**
 * CAPTE `beforeinstallprompt` UNE SEULE FOIS, AU PLUS HAUT NIVEAU (racine de
 * `app/layout.tsx`, à côté de `EnregistrementServiceWorker`) — l'évènement
 * ne se déclenche qu'une fois par chargement de page ; un composant posé sur
 * `/terrain` seul le perdrait en changeant d'écran vers `/terrain/profil`.
 */
export function FournisseurInstallationPwa({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const invitationRef = useRef<EvenementInvitation | null>(null);
  const [etat, setEtat] = useState<EtatInstallation>(etatInitial);

  useEffect(() => {
    const surInvitation = (evenement: Event) => {
      evenement.preventDefault();
      invitationRef.current = evenement as EvenementInvitation;
      setEtat("android_chrome");
    };
    const surInstalle = () => {
      invitationRef.current = null;
      setEtat("deja_installee");
    };
    window.addEventListener("beforeinstallprompt", surInvitation);
    window.addEventListener("appinstalled", surInstalle);
    return () => {
      window.removeEventListener("beforeinstallprompt", surInvitation);
      window.removeEventListener("appinstalled", surInstalle);
    };
  }, []);

  const installer =
    invitationRef.current === null
      ? null
      : async () => {
          const invitation = invitationRef.current;
          if (invitation === null) {
            return;
          }
          await invitation.prompt();
          const choix = await invitation.userChoice;
          if (choix.outcome === "accepted") {
            invitationRef.current = null;
            setEtat("deja_installee");
          }
        };

  return (
    <Contexte.Provider value={{ etat, installer }}>
      {children}
    </Contexte.Provider>
  );
}

export function useInstallationPwa(): ContexteInstallation {
  const contexte = useContext(Contexte);
  if (contexte === null) {
    throw new Error(
      "useInstallationPwa appelé hors de FournisseurInstallationPwa",
    );
  }
  return contexte;
}
