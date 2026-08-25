# Lista V2 și V3 — Digital Signage

## V2 — Prioritate ridicată

| # | Feature | Status | Inspirat din | Site |
|---|---|---|---|---|
| 1 | Zero-touch deployment — mini PC se configurează singur după introducerea parolei WiFi | ⬜ | Kitcast | kitcast.tv |
| 2 | Offline playback — redă din cache dacă serverul cade | ✅ | NoviSign | novisign.com |
| 3 | Monitoring ecrane — dashboard arată TV online/offline în timp real | ✅ | Yodeck | yodeck.com |
| 4 | **Campanii (Scheduling complet)** — creare campanie cu dată start + dată stop, playlist propriu (video + imagini, orice ordine, repetabile), targeting per tip TV din denumire (ex: "Credit - TV Vitrina" → merge doar pe TV-urile vitrina). Activare automată la 00:01, dezactivare la 00:00. Validare: min 1 zi durată, nu se suprapun 2 campanii pe același tip TV. Push automat pe TV-uri la salvare/ștergere. TV-ul revine automat la playlistul grupului după expirare. **✅ IMPLEMENTAT aug 2026** | ✅ | Spectroo DMS | dms.getconnected.ro |
| 17 | Playlist default (Filler Content) — playlist care rulează mereu pe TV când nu e nicio campanie activă programată. Campania se afișează peste default când e activă, după care TV-ul revine la default. Evită ecranul negru. **✅ IMPLEMENTAT** (playlistul grupului e filler-ul implicit) | ✅ | Yodeck | yodeck.com |
| 18 | Hartă locații agenții — dashboard arată o hartă cu toate agențiile CEC și statusul fiecăreia (online/offline). Util când ai 10 agenții în orașe diferite — vezi dintr-o privire care TV are probleme. | Yodeck | yodeck.com |
| 19 | Web Pages — afișează o pagină web direct pe TV (ex: cec.ro/curs-valutar, sau orice URL). Alternativă simplă la scraping — browserul redă pagina live, fără cod suplimentar. | Yodeck | yodeck.com |
| 20 | Transition Options — efecte vizuale între fișierele din playlist (fade, slide, etc.). Se setează per playlist. | Yodeck | yodeck.com |
| 21 | Sync Playback — toate TV-urile din aceeași agenție redau același conținut sincronizat (același cadru în același moment). Util când ai 2 TV-uri față în față — par un singur ecran mare. | Yodeck | yodeck.com |
| 5 | Curs valutar CEC live — scraping automat de pe cec.ro/curs-valutar la fiecare 15 secunde (EUR, USD, GBP, CHF — Cumpărare/Vânzare). Trimite pe TV doar dacă cursul s-a schimbat față de ultima citire. Cursul CEC e diferit de BNR — mai relevant pentru clienții din agenție. | OptiSigns | optisigns.com |
| 6 | Proof of Play — log: ce fișier, pe ce TV, la ce oră, cât timp | DigitalSignage.com | digitalsignage.com |
| 7 | QR Code pe ecran — clientul scanează și ajunge pe o pagină web | DigitalSignage.com | digitalsignage.com |
| 8 | Ticker scrolling — text care defilează pe bara de jos în timp ce rulează video | NoviSign | novisign.com |
| 9 | Auto-expiring content — conținut care dispare automat după o dată setată | TelemetryTV | telemetrytv.com |
| 10 | Emergency alerts — mesaj urgent pe toate TV-urile simultan cu un singur click | ScreenCloud | screencloud.com |
| 11 | Approval Workflow — modificările din playlist necesită aprobare înainte să apară pe TV | OptiSigns | optisigns.com |
| 12 | Auto power on/off — TV pornește/oprește automat la ore fixe | OptiSigns | optisigns.com |
| 13 | Durată totală playlist — suma duratelor tuturor fișierelor | Spectroo DMS | dms.getconnected.ro |
| 14 | Export Excel — rapoarte conținut/TV-uri | Spectroo DMS | dms.getconnected.ro |
| 15 | Durată per item — cât timp stă fiecare imagine | Yodeck | yodeck.com |
| 16 | Redesign dashboard — fond alb, sidebar, cards statistici, verde/roșu status TV | Yodeck/OptiSigns/ScreenCloud | yodeck.com / optisigns.com / screencloud.com |

| 22 | **Tranziție campanie→grup autonomă (offline-safe)** — serverul trimite odată cu campania și playlistul de backup din grup + data expirării. Mini PC-ul setează un timer local și face schimbarea la miezul nopții indiferent dacă e WiFi sau nu. Modificări: `websocket.js` (adaugă `campaignEndDate` + `fallbackItems`) + `player/App.jsx` (timer local). Nu necesită acces fizic la mini PC — se deployează automat prin reload. | ⬜ | DisplayIQ | intern |

## V3 — Ulterior

| # | Feature | Inspirat din | Site |
|---|---|---|---|
| 1 | Layout editor — ecranul împărțit în zone (video + banner simultan) | Yodeck | yodeck.com |
| 2 | IoT × senzori — senzor PIR de mișcare: nimeni → screensaver; client aproape → reclamă activă | DigitalSignage.com | digitalsignage.com |
| 3 | Audit logs — jurnal complet: cine a schimbat ce și când | ScreenCloud | screencloud.com |
| 4 | AI video camera — detectează vârsta/genul clientului și schimbă reclama automat | NoviSign | novisign.com |
| 5 | Bluetooth provisioning — configurezi mini PC prin telefon via Bluetooth | Juuno | juuno.co |
| 6 | White-label — vinzi sistemul altor clienți sub brandul lor | Juuno | juuno.co |
