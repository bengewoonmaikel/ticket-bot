# IBDeals · lanceringsfilm · regie

**Concept: "Eén stroom."** Eén lichtpunt is één IB met zijn eigen volume. Alleen is het klein. Samen vormen de punten één sterke stroom, en die stroom zet het hele brokernetwerk in één keer aan. De film begint en eindigt met hetzelfde punt: eerst is het de punt achter "SAME TRAFFIC.", aan het eind klapt alles terug in één punt en wordt dat het IBDeals-logo.

Specificaties: 18,0 s, 2560 × 1440, 60 fps, H.264 met AAC. Alles is in code gemaakt (HTML, CSS, SVG, canvas en GSAP in HyperFrames). De soundtrack is volledig gesynthetiseerd met de Web Audio API (OfflineAudioContext naar WAV) en daarna gemuxt.

## Beatsheet (120 BPM, één maat = 2 s)

| Tijd | Beeld | Tekst in beeld | Geluid |
|---|---|---|---|
| 0,00 – 2,00 | Donker marineblauw met diepte. Eén lichtpunt ontbrandt (0,25) en is de punt achter de tekst. De letters lichten van rechts naar links op, alsof ze uit het punt komen. Langzame push-in. | SAME TRAFFIC. | Stilte, een glazen FM-bel voor het punt, per letter een piepklein belletje, en een hartslag. |
| 1,72 – 2,00 | Anticipatie: het punt trekt samen en de tekst verzacht. | | Omgekeerde zwelling. |
| 2,00 | Lancering: het punt schiet weg en de camera trekt terug. Rond het punt ontbranden steeds meer punten, als een kettingreactie. | | Zachte impact, whoosh. |
| 3,00 – 5,90 | Honderden punten, elk met een eigen grootte (volume), stromen als zijrivieren naar het midden. | BUILT FOR SERIOUS IBs / WHO WANT BETTER TERMS | Elke grote IB krijgt een pluck op het 8e-noten-grid. Dm, dan Bb, en de kick komt binnen. |
| 4,00 | Het eerste punt bereikt de hub, die gaat aan. | | Bel en lage puls. |
| 6,00 – 7,50 | De stromen smelten samen tot één sterke stroom. Tien naamloze brokerkaartjes verschijnen onverlicht in het donker. | | Gm, A; riser en snare roll. |
| 7,50 – 7,90 | Alles wordt de hub in gezogen. Een ring trekt samen en de camera duwt in. | | Zuigende swell, dan een ademstilte. |
| 8,00 | Drop: flits, schokgolf, tien verbindingen lichten na elkaar op en de kaartjes poppen aan. | HIGHER PAYOUTS. | Impact, D-majeur stab (de terts wordt groot: van mineur naar majeur), tien belletjes voor de tien verbindingen, en de groove begint. |
| 8,00 – 9,98 | Het netwerk draait langzaam, met pulsen van de hub naar elke broker op de maat. | | Groove, bas, arpeggio op de pulsen. |
| 10,00 | Whip pan met sluitervervaging. De kop vliegt eruit en het getal komt met de beweging mee binnen. | | Whoosh van rechts naar links. |
| 10,22 – 11,80 | Het netwerk staat onscherp rechts. Het getal telt op van 0 naar 38. | 38% · AVERAGE UPLIFT VS. GOING DIRECT | Een tik per stap, een stijgende toon en een "ding" op 38. |
| 11,80 – 12,05 | De camera duikt de hub in: een lichtflits als overgang. | | Swell naar het licht. |
| 12,05 – 13,60 | App, website en portal vouwen zich open als glazen panelen, alle drie met hetzelfde naamloze merkteken (white label = wit). | YOUR BRAND, NOT OURS | Gmaj9, lichte groove, drie "stempels" voor het merkteken. |
| 13,60 – 14,00 | Alles vouwt terug in het merkteken, tot één punt. Dat is dezelfde vorm als het punt uit de cold open. | | Omgekeerde swell. |
| 14,00 | Het punt flitst en wordt een lichtspleet. Het woordmerk IBDeals opent zich eruit. Het netwerk komt terug, met het logo als hub, net als op de site. | IBDeals | Merksting: bellen in D, shimmer, sub. |
| 15,00 – 15,60 | Het logo schuift omhoog. URL, knop en disclaimer komen erbij en het netwerk stapt terug. | ibdeals.com · Apply to be a partner · disclaimer | Zachte whoosh, twee noten "bevestiging". |
| 15,60 – 18,00 | De eindkaart staat 2,4 s volledig in beeld. Er is nog beweging: langzame push-in, lichtglans over de knop, drijvend licht. | | Akkoord klinkt uit tot stilte. |

## Keuzes

- **Tekst in beeld** komt uitsluitend uit de Engelse citaten in de briefing. De 38% staat nooit zonder "average uplift vs. going direct".
- **Groen** alleen voor het stijgende getal (38%). De knop gebruikt het blauwe verloop, volgens de filmregel "groen alleen voor stijgende cijfers".
- **Brokers** zijn tien naamloze glazen kaartjes, zonder namen of logo's. Het schildicoontje verwijst naar "gereguleerd".
- **Beweging:** alles met easing, anticipatie (terugtrekken voor lancering, whip en collapse) en overshoot (pops, tellen, knop). Er is nooit stilstand: de camera drijft, deeltjes ademen en de eindkaart duwt langzaam in.
- **Diepte:** een echte perspectiefcamera met scherptediepte (bokeh voor onscherpe punten, blur op kaartjes) en parallax tussen stof, stromen en kaartjes. Film grain tegen banding.
- **Overgangen** zijn allemaal gemotiveerd: het punt lanceert de camera, de flits van de drop onthult het netwerk, een whip pan met sluitervervaging, een duik in het licht van de hub, een collapse naar een match cut met het eerste punt, en een lichtspleet die het logo opent.

## Bestanden

- `index.html`, `js/film.js`: DOM-lagen en de GSAP-tijdlijn.
- `js/world.js`: canvaswereld (deeltjes, stroom, hub, netwerk, camera). Elke frame is een pure functie van de tijd.
- `js/score.js`: gedeelde timing voor beeld en geluid (beats, deeltjes, accenten, teller).
- `audio/synth.js`: de complete soundtrack (Web Audio API), plus `tools/render-audio.mjs` voor de offline render naar WAV.
- `tools/mux.sh`: muxt video en WAV tot de uiteindelijke MP4.

## Opnieuw renderen

```bash
npm install
export HYPERFRAMES_BROWSER_PATH=/pad/naar/chrome-headless-shell   # hier: /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
npx hyperframes render --fps 60 --quality high --crf 14 -o renders/video.mp4
PREGAIN=1.05 node tools/render-audio.mjs      # schrijft audio/soundtrack.wav (48 kHz, 24-bit)
tools/mux.sh renders/video.mp4 audio/soundtrack.wav renders/IBDeals-launch-film-2560x1440-60fps.mp4
tools/loudness.sh renders/IBDeals-launch-film-2560x1440-60fps.mp4   # verwacht: ongeveer -14 LUFS, true peak -1 dBFS
python3 tools/qa_motion.py renders/IBDeals-launch-film-2560x1440-60fps.mp4   # controle op stilstaande frames
tools/share.sh   # deelversie onder 30 MiB, zelfde 2560 x 1440 en 60 fps
```

## Eindbestand

`renders/IBDeals-launch-film-2560x1440-60fps.mp4`: H.264 High, 2560 × 1440, 60 fps (1080 frames), 18,000 s. Audio: AAC 48 kHz stereo 320 kbps. −13,9 LUFS integrated, true peak −1,0 dBFS. `hyperframes check`: 0 fouten, 27/27 teksten WCAG AA.
