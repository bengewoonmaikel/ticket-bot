# Op de Lijst — prototype

Speelbaar prototype van een portier-game. Eén bestand, geen build-stap:
open `index.html` in een browser of zet het op een willekeurige statische host.

## De loop

1. **Gast verschijnt** — veeg links (weigeren) of rechts (binnen). Ook met de
   knoppen, of met de pijltjestoetsen op desktop.
2. **Elk uur komt er een regel bij.** De wet (legitimatie, 18+) gaat altijd vóór
   het huisbeleid. Zodra "gastenlijst gaat vóór" hangt, overrulet die het
   huisbeleid — dat is de geheugenval waar spelers op stuklopen.
3. **Na 12 gasten de bank-beslissing**: deur dicht en de pot veiligstellen, of
   nog een uur voor een hogere multiplier, met een extra regel en kortere
   bedenktijd. Drie fouten en de onbeveiligde pot is weg.

Moeilijkheid schaalt via geheugenbelasting en bedenktijd, niet via reflexen.
Elke fout benoemt de regel die je overtrad — legibel falen is wat "nog één
potje" oplevert.

## Wat erin zit

- 2 wetten + 9 huisregels, willekeurig per nacht opgebouwd
- Gastengenerator die de stroom rond 50/50 accepteren/weigeren houdt, zodat
  blind één kant op vegen niet werkt
- Combo-bonus per goede beslissing, multiplier per doorgespeeld uur
- Records in `localStorage`, met near-miss-melding op het eindscherm
- Swipe met stempel-feedback, WebAudio-blips, haptiek, `prefers-reduced-motion`

## Bewust nog niet gebouwd

Clubupgrades, dagelijkse gastenlijst met vaste seed, leaderboard, rewarded ads.
Die horen pas thuis nadat de kernloop bewezen leuk is.

## Regelontwerp

Alle regels gaan over kleding, spullen, leeftijd, nuchterheid, groepsgrootte,
lidmaatschap en de gastenlijst — nooit over wie iemand is. Dat is bewust en zou
zo moeten blijven als het spel wordt uitgebreid.
