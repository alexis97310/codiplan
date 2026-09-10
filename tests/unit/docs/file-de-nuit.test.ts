/**
 * LA FILE DE NUIT EST-ELLE LISIBLE À LA MACHINE ?
 *
 * `docs/backlog.md` est la file que lit la session nocturne. « Le premier
 * travail non bloqué » doit être une LECTURE, jamais une interprétation : tout
 * ticket porte donc un marqueur d'état, et un `BLOQUÉ` porte son motif.
 *
 * LA POPULATION EST DÉRIVÉE DU DOCUMENT et non tenue à la main : un ticket
 * écrit demain entre dans la file ce jour-là et réclame son marqueur, sans
 * qu'aucune liste soit à compléter. C'est le renversement de D41 et de D55.
 *
 * LE PIÈGE DE LA POPULATION, VU AVANT D'Y TOMBER (§9, 31/08). La façon naturelle
 * d'écrire ce gardien est « pour chaque ticket QUI PORTE un marqueur, vérifier
 * qu'il est bien formé » — et cette sélection exclut exactement les tickets
 * fautifs, ceux qui n'en portent aucun. Le manque de marqueur est donc une
 * ASSERTION, jamais un critère de sélection.
 */

import { describe, expect, it } from 'vitest'

import {
  defautsDeLaFile,
  lireLaFile,
  premierTravailLibre,
  type TicketDeFile,
} from '../../../scripts/lib/file-de-nuit.js'

const tickets = lireLaFile()

describe('la file de nuit', () => {
  it('lit une population non vide — témoin de non-vacuité', () => {
    // Zéro ticket lu ressemble à s'y méprendre à une file saine. Le plancher
    // n'est pas le décompte du jour : c'est la borne en dessous de laquelle
    // l'observation est certainement creuse.
    expect(tickets.length).toBeGreaterThan(40)
  })

  it('donne un état à CHAQUE ticket, et un motif à chaque blocage', () => {
    const ecarts = defautsDeLaFile(tickets)
    expect(
      ecarts.map((e) => `docs/backlog.md:${e.ticket.ligne} ${e.ticket.identifiant} — ${e.raison}`),
    ).toEqual([])
  })

  it('nomme un premier travail non bloqué, ou une file épuisée — jamais un silence', () => {
    const premier = premierTravailLibre(tickets)
    if (premier === null) {
      expect(tickets.every((t) => t.etat !== 'LIBRE')).toBe(true)
      return
    }
    expect(premier.identifiant).toMatch(/^[LR]\d+-\d+[a-z]?$/)
    // Ce que la nuit prendra est le PREMIER dans l'ordre du document : tout ce
    // qui le précède est écarté, et pour une raison lisible.
    const avant = tickets.slice(0, tickets.indexOf(premier))
    expect(avant.every((t) => t.etat === 'LIVRÉ' || t.etat === 'BLOQUÉ')).toBe(true)
  })
})

/**
 * LES DEUX DIRECTIONS DU PRÉDICAT (§9, 11/09/2026).
 *
 * Une mise en échec n'éprouve qu'un sens : « il rougit quand il doit ». Le sens
 * qui ne produit jamais de signal est l'autre — « il ne reste vert que quand il
 * le doit » —, et il s'éprouve par un cas qui DOIT passer et qui pourrait
 * passer pour une mauvaise raison.
 *
 * Les épreuves ci-dessous portent sur les DEUX graphies de titre réellement
 * présentes dans le document — `**L0-01 — …**` et `**L2-01** …` —, jamais sur
 * une graphie fabriquée : un motif éprouvé sur la seule forme canonique de la
 * faute laisse passer celle qu'un auteur écrirait vraiment (§9, 21/08 et 26/08).
 */
describe("les deux directions du gardien, éprouvées sur les graphies réelles", () => {
  const graphies = [
    ['tiret dans le gras', '**L0-01 — Initialiser le dépôt.**'],
    ['gras fermé après le code', "**L2-01** Fiche machine. **[D6]**"],
  ] as const

  describe.each(graphies)('graphie « %s »', (_nom, titre) => {
    it('ROUGIT quand le marqueur manque', () => {
      const lus = lireLaFile(`${titre}\nUne ligne de prose, et aucun marqueur.\n`)
      expect(lus).toHaveLength(1)
      expect(lus[0].etat).toBeNull()
      expect(defautsDeLaFile(lus)).toHaveLength(1)
    })

    it('ROUGIT sur un BLOQUÉ sans motif — le sens qu’on oublie', () => {
      const lus = lireLaFile(`${titre}\n*File :* BLOQUÉ\n`)
      expect(lus[0].etat).toBe('BLOQUÉ')
      expect(defautsDeLaFile(lus)[0]?.raison).toContain('sans motif')
    })

    it('RESTE VERT sur un BLOQUÉ motivé — et pour SA PROPRE raison', () => {
      const lus = lireLaFile(`${titre}\n*File :* BLOQUÉ — attend le choix du fournisseur de stockage\n`)
      expect(defautsDeLaFile(lus)).toEqual([])
      // Le vert ne vient pas d'un ticket non lu : la ligne a bien été
      // analysée, et son motif est celui qu'on a écrit.
      expect(lus[0].motif).toBe('attend le choix du fournisseur de stockage')
      expect(lus[0].etat).toBe('BLOQUÉ')
    })

    it('RESTE VERT sur LIBRE et sur LIVRÉ, sans les confondre', () => {
      const libre = lireLaFile(`${titre}\n*File :* LIBRE\n`)
      const livre = lireLaFile(`${titre}\n*File :* LIVRÉ\n`)
      expect(defautsDeLaFile([...libre, ...livre])).toEqual([])
      expect(premierTravailLibre([...livre, ...libre])).toBe(libre[0])
      // Le voisin qui pourrait passer pour lui : un LIVRÉ n'est jamais rendu
      // comme travail à prendre.
      expect(premierTravailLibre(livre)).toBeNull()
    })
  })

  it("ne prend PAS un marqueur qui ne suit pas immédiatement son titre", () => {
    // Un marqueur posé deux lignes plus bas se rattacherait au mauvais ticket,
    // ou à aucun — et le ticket qu'il croyait marquer resterait muet.
    const lus: TicketDeFile[] = lireLaFile(
      '**L9-99** Un ticket.\nUne ligne de prose intercalée.\n*File :* LIBRE\n',
    )
    expect(lus[0].etat).toBeNull()
  })
})

/**
 * UN TICKET QUE LE MOTIF NE RECONNAÎT PAS N'ENTRE PAS DANS LA FILE — et il est
 * alors invisible au gardien ET à la nuit, ce qui est le pire des deux mondes :
 * aucun rouge, et aucun travail. Mesuré le 10/09/2026 en écrivant `R1-01`.
 *
 * C'est la direction PERMISSIVE du prédicat (§9, 11/09) : elle ne produit
 * jamais de signal, et ne s'éprouve donc que par un cas qui DOIT être vu.
 */
describe("les tickets de revue entrent dans la file comme les autres", () => {
  it("lit un titre `R…` autant qu'un titre `L…`", () => {
    const lus = lireLaFile("**R1-01 — Un ticket de revue.**\n*File :* LIBRE\n")
    expect(lus.map((t) => t.identifiant)).toEqual(["R1-01"])
    expect(defautsDeLaFile(lus)).toEqual([])
  })

  it("les tickets `R…` du document réel portent bien leur marqueur", () => {
    const revue = tickets.filter((t) => t.identifiant.startsWith("R"))
    // Témoin : zéro ticket de revue observé rendrait l'assertion suivante
    // vraie sans rien avoir regardé.
    expect(revue.length).toBeGreaterThan(0)
    expect(revue.filter((t) => t.etat === null)).toEqual([])
  })
})
