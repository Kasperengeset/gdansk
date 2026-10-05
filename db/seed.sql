-- Startinnhold fra rebuslop_gdansk.pdf. Kjøres bare når posts-tabellen er tom.
-- Koordinatene står tomme: plasser hver post på kartet i adminpanelet.
-- Chiffervalgene er forslag – endre dem fritt i adminpanelet.

insert into settings (key, value) values
  ('organizer_name', 'Kasper'),
  ('organizer_phone', '')
on conflict (key) do nothing;

insert into posts (position, title, clue_text, cipher_type, cipher_key, key_hint, task_text, radius_m, proof_type, emergency_text, active, is_finale, admin_note) values
(1, 'Sykkeletappe: Brzeźno → Jelitkowo',
 'Tråkk langs havet mot øst, til den gamle fiskerlandsbyen som ble badestrand.',
 'none', '', '',
 E'Tidskonkurranse på Strava-segment langs den separerte sykkelstien ved stranda.\nAlle sykler samme sykkeltype (enten alle elsykkel eller alle vanlig sykkel).\nStrava tar opp i flymodus og lastes opp etter løpet. Arrangør tar i tillegg tid med stoppeklokke ved start og mål.\n\nTrykk «Fullført» når hele laget er i mål.',
 100, 'none', 'Jelitkowo, slutten av sykkelstien mot Sopot.', true, false,
 'Sykle strekningen selv før løpet og lag/velg segment. Legg ALLTID sykkelen før alkohol (promillegrense 0,2 i Polen, også for syklister). Bonus: 1./2./3. plass gir −15/−10/−5 min.'),

(2, 'Falowiec',
 'Finn bølgen av betong der tusenvis bor under samme tak.',
 'caesar', '3', 'Hver bokstav er flyttet 3 plasser fram i alfabetet. Alfabetet har 29 bokstaver: A–Z, Æ, Ø, Å.',
 E'Hele laget løper langs hele blokka (ca. 860 m).\nTa bilde av laget ved hver ende. Tiden mellom bildene teller.\n\nHusk tallet: løpetiden i minutter får dere bruk for senere.',
 250, 'photo', 'Falowiec, ul. Obrońców Wybrzeża, Przymorze.', true, false,
 'Blokka ligger like innenfor stranda ved Jelitkowo, gangavstand fra sykkelmålet. Radius er stor fordi blokka er lang.'),

(3, 'Muralene i Zaspa',
 'Der flyene en gang landet, står nå betongblokker med malte ansikter. En elektriker med bart bodde her.',
 'atbash', '', 'Speilalfabet: A↔Å, B↔Ø, C↔Æ, D↔Z …',
 E'Finn en mural med Solidarność-motiv og gjenskap den med kroppene.\nBonus: finn ut av en lokal hvilken blokk Wałęsa bodde i.',
 400, 'photo_text', 'Osiedle Zaspa, bygget på den gamle flyplassen.', true, false,
 'Kartki kan vinnes her for beste gjenskaping. Muralene er spredt utover bydelen, derfor stor radius.'),

(4, 'Kebab Meister – Lokal na Morenie',
 'Isen trakk seg tilbake og etterlot seg åser. Der, i gata oppkalt etter en fransk havneby, venter mesteren med spyddet.',
 'a1z26', '', 'Tallene er bokstavens plass i alfabetet: A=1, B=2 … Æ=27, Ø=28, Å=29.',
 E'Bestill ÉN kebab på polsk: «Poproszę jednego dużego kebaba, na miejscu».\nKebaben sendes rundt i ring, én bit per person, til den er borte.\nKun den som holder kebaben får bruke hendene.\nStraffetid hvis noe er igjen i papiret.\n\nBevis: lagbilde med siste bit.',
 50, 'photo', 'Morena (bydel), ul. Bułońska 10E.', true, false,
 'Ring på forhånd og si at flere lag kommer. Sjekk åpningstid. +5 min hvis noe er igjen i papiret.'),

(5, 'Muralen i Wajdeloty-gata',
 'Et ansikt på en husvegg, i gata oppkalt etter en hedensk prest-poet.',
 'reverse', '', 'Les baklengs.',
 E'Ta lagbilde i kostyme foran muralen.\nSpør en lokal hvem Wajdelota var, og skriv svaret her.',
 75, 'photo_text', 'ul. Wajdeloty, Wrzeszcz.', true, false,
 'Muralen er av Guido van Helten. Wrzeszcz er studentbydelen, mange unge som snakker engelsk.'),

(6, 'AleBrowar Wajdeloty',
 'Tørst? Bryggeriet ligger i samme gate. Finn det uten å gå mer enn 200 meter.',
 'morse', '', 'Morse. Bruk morsetabellen dere fikk ved start.',
 E'Laget velger øl basert på tallet de fant på Falowiec-posten (løpetid i minutter = antall smaksprøver, maks 4).\nBlindtest: én på laget skal gjette hvilket øl som er hvilket.\n\nBevis: bilde av glassene og kvitteringen.',
 60, 'photo', 'AleBrowar, ul. Wajdeloty.', true, false,
 'Ha alkoholfritt alternativ klart. Husk å skrive ut morsetabell (med Æ Ø Å) til lagene.'),

(7, 'Góra Gradowa',
 'Klatre til korset som vokter byen om natten, rett over jernbanestasjonen.',
 'caesar', '9', 'Hver bokstav er flyttet fram like mange plasser som det er bokstaver i navnet på prest-poeten fra post 5.',
 E'Transport fra Wrzeszcz: finn ut av lokale hvilket tog (SKM) eller hvilken trikk som går til Gdańsk Główny, og kjøp billett uten app.\nTa lagbilde ved korset med verftskranene i bakgrunnen.\n\nBevis: bildet og et bilde av billetten.',
 100, 'photo', 'Góra Gradowa, ved Gdańsk Główny.', true, false,
 'Kartki kan vinnes her (f.eks. raskeste lag opp). WAJDELOTA = 9 bokstaver.'),

(8, 'Brama nr 2 og Sala BHP',
 'Port nummer to. I august 1980 hang det blomster og et bilde av paven her. Finn også salen der de skrev under.',
 'none', '', '',
 E'Ta lagbilde foran porten med knyttet neve i været.\nFå en lokal til å fortelle hva som skjedde i august 1980, og skriv ned én setning her.',
 100, 'photo_text', 'Brama nr 2 Stoczni Gdańskiej og Sala BHP.', true, false,
 'Turistbussen stopper trolig ved Solidaritetssenteret, men sjelden ved selve salen.'),

(9, 'Bar Osiemdziesiątka',
 'Den siste baren på verftet. Klokkene stoppet på 80-tallet.',
 'atbash', '', 'Speilalfabet igjen.',
 E'Drikke kan KUN kjøpes med kartki. Lag uten kort må først «bytte» til seg ett fra et annet lag.\nKøoppgave: still dere i kø og ta bilde (klassisk PRL-opplevelse).\n\nBevis: bilde og innleverte kartki.',
 60, 'photo', 'Bar 80-tka, ved ul. Elektryków på verftsområdet.', true, false,
 'VIKTIG: sjekk om baren fortsatt er åpen (innlegg tyder på at den kan ha flyttet/stengt). Backup: Pijalnia Wódki i Piwa, Długi Targ.'),

(10, 'Józef K',
 'Kafkas mann venter i ølgaten, bak en dør du ikke legger merke til.',
 'none', '', '',
 E'Bestill honningøl (eller alkoholfritt).\nFinn en bok i taket på et språk ingen på laget kan lese, og ta bilde.',
 60, 'photo', 'Józef K, ul. Piwna 1/2.', true, false,
 'Inngangen er svært anonym, det er poenget. Innendørs kan GPS bomme – lås opp manuelt ved behov.'),

(11, 'FINALE: No To Cyk',
 'Skål som i Folkerepublikken. Brødbakernes gate, nummer to.',
 'none', '', '',
 E'Klokka har stoppet – dere er i mål!\n\nBildefremvisning fra alle lag.\nPropagandaplakat for lagets «parti» henges opp.\nFremfør polsk drikkesang lært av en fremmed (bonus).\nPremieutdeling. Husets nalewki (fruktlikør) til vinnerlaget.',
 60, 'none', 'No To Cyk, ul. Chlebnicka 2.', true, true,
 'Reserver bord/plass på forhånd. Bonuser: beste kostyme −15, drikkesang −10, beste propagandaplakat −10.'),

(101, 'Reserve: Uphagen-huset (Dom Uphagena)',
 'Et kjøpmannshjem fra 1700-tallet står bevart – finn bakgården.',
 'none', '', '',
 'Ta lagbilde i bakgården.',
 60, 'photo', 'Dom Uphagena, ul. Długa 12.', false, false,
 'Reservepost. Sjekk museets åpningstid.'),

(102, 'Reserve: Dolne Miasto',
 'Den gamle hagebyen under byfornyelse, der veggene har fått farger.',
 'none', '', '',
 'Gjenskap den rareste gatekunsten dere finner.',
 300, 'photo', 'Dolne Miasto.', false, false,
 'Reservepost.'),

(103, 'Reserve: Bar mleczny Lisia Chatka',
 'Melkebaren med røtter i PRL-tiden.',
 'none', '', '',
 'Bestill noe på polsk og ta lagbilde med maten.',
 60, 'photo', 'Bar mleczny Lisia Chatka, ul. Hołdu Pruskiego 3.', false, false,
 'Reservepost.'),

(104, 'Reserve: Labeerynt',
 'Bar i studentmiljøet i Wrzeszcz.',
 'none', '', '',
 'Ta lagbilde i baren.',
 60, 'photo', 'Labeerynt, Wrzeszcz.', false, false,
 'Reservepost.');
