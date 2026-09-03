# Op de Lijst — prototype

Speelbaar prototype van een portier-game. Eén bestand, geen build-stap:
open `index.html` in een browser of zet het op een willekeurige statische host.

## De loop

Je staat naast de deur. De rij komt van links, de club dreunt rechts van je.

1. **De gast loopt naar je toe.** Wat je ziet — schoenen, outfit, pet, tas,
   het gezelschap achter hem, of iemand te veel op heeft — lees je van de
   figuur af.
2. **Beslissen of controleren.** Onder de 25 moet je om legitimatie vragen:
   houd de gast vast (of ArrowDown) en hij haalt zijn ID tevoorschijn. Dat
   kost seconden, en snelheid is geld. Ziet iemand er ouder uit, dan hoeft
   het niet en win je tijd.
3. **Slepen naar links of rechts.** Weggestuurd loopt hij de straat in,
   doorgelaten verdwijnt hij in het licht van de deur.
4. **Elk uur komt er een regel bij.** De wet gaat vóór het huisbeleid, maar
   zodra "gastenlijst gaat vóór" hangt, overrulet die het huisbeleid — dat is
   de geheugenval waar spelers op stuklopen.
5. **Na 12 gasten de bank-beslissing**: deur dicht en de pot veiligstellen, of
   nog een uur voor een hogere multiplier, met een extra regel en kortere
   bedenktijd. Drie fouten en de onbeveiligde pot is weg.

Moeilijkheid schaalt via geheugenbelasting en tijdsdruk, niet via reflexen.
Elke fout benoemt de regel die je overtrad — legibel falen is wat "nog één
potje" oplevert.

## De scène

Alles in het canvas is getekend, geen assets: natte straat, lantaarnpaal,
gevel aan de overkant, motregen, fluwelen koord, en een clubdeur waarvan het
licht op 124 BPM meepulseert met de bas. De rij achter de gast is de
resterende gasten van dit uur — je ziet hem letterlijk korter worden.

## Uitrusting

Uitbetaalde nachten gaan naar je rekening; daar koop je spullen van die
blijven:

| Upgrade | Prijs | Effect |
|---|---|---|
| ID-scanner | €400 | Controle duurt half zo lang |
| Fooienpot op de bar | €550 | Combobonus telt dubbel |
| Ervaren blik | €650 | Je twijfelt pas onder de 23 in plaats van 25 |
| Luifel boven de deur | €900 | Gasten wachten 25% langer |
| Tweede portier | €1300 | Eén extra fout toegestaan |
| Loonsverhoging | €1600 | +25% fooi per gast |

Verliezen kost je de fooienpot van die nacht, nooit je uitrusting.

## Bewust nog niet gebouwd

Dagelijkse gastenlijst met vaste seed, leaderboard, rewarded ads. Die horen
pas thuis nadat de kernloop bewezen leuk is.

## Regelontwerp

Alle regels gaan over kleding, spullen, leeftijd, nuchterheid, groepsgrootte,
lidmaatschap en de gastenlijst — nooit over wie iemand is. Dat is bewust en
zou zo moeten blijven als het spel wordt uitgebreid.

## Knoppen tijdens het spelen

| Actie | Aanraking | Toetsenbord |
|---|---|---|
| Wegsturen | sleep naar links | ← |
| Doorlaten | sleep naar rechts | → |
| Om ID vragen | houd de gast vast | ↓ vasthouden |
