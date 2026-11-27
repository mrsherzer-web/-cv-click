# GEFEN 2: נכסים ל-Higgsfield

המסמך הזה מפרט כל נכס שעדיין לא נוצר ב-Higgsfield, עם פרומפט מוכן ושם הקובץ המדויק שהמשחק מחפש.
המשחק עובד גם בלי הנכסים האלה. כל קובץ שנכנס למקום הנכון מחליף אוטומטית את הגרסה המקומית.

## מצב נוכחי

- החיבור ל-Higgsfield פעיל בחשבון. יתרה בתחילת העבודה: 2497.25 קרדיטים.
- עד עכשיו נוצלו 2.75 קרדיטים על שתי בדיקות: תמונת רקע של האולם הריק (`d34ffdb1-5fec-4b9b-a994-305af7496539`, 2 קרדיטים) ואפקט של חבטה בפיר אוורור (`31b00b70-71c9-4504-a213-758debf9c655`, 0.75 קרדיט). שתיהן נשארו בחשבון Higgsfield. אף אחת מהן לא הורדה ולא נכנסה למשחק.
- מה שחסם: סביבת העבודה שבה נבנה המשחק (Default) לא מרשה גישה לשרתי הקבצים של Higgsfield, ולכן אי אפשר להעלות אליו את תמונות החברים ואי אפשר להוריד ממנו תוצאות.
- יש סביבה מוכנה בשם `-cv-click` שכבר מרשה את שלושת השרתים הדרושים:
  `upload.higgsfield.ai`, `d2ol7oe51mr4n9.cloudfront.net`, `d8j0ntlcm91z4.cloudfront.net`.

## איך ממשיכים

1. פותחים שיחה חדשה של Claude Code על המאגר הזה, ובוחרים בתפריט הסביבה את `-cv-click`.
2. כותבים: "המשך את נכסי Higgsfield לפי `gefen2/docs/HIGGSFIELD.md` בענף `claude/gefen-2-demon-returns`".
3. Claude מעלה את תמונות המקור, מייצר, מוריד, בודק כל קובץ בעין, ומריץ:

```bash
python3 gefen2/tools/build_assets.py          # קולט את assets/hf, assets/video, assets/audio
node gefen2/tools/shots_game.js /tmp/shots     # צילומי מסך לבדיקה בתוך המשחק
node gefen2/tools/test_nights.js nights=1,2,3,4,5,6 speed=10 limit=260
python3 gefen2/tools/package.py all            # קובץ יחיד, ZIP, רשימת קבצים לאופליין
```

כלל עבודה: לא מסמנים נכס כמוכן לפני שהקובץ ירד, נפתח ונבדק בתוך המשחק.

שורת הקרדיט "תמונות וסרטונים: Higgsfield" מופיעה במשחק רק כשנכס כזה באמת נמצא בו. הכלי `build_assets.py` מסמן את זה לבד.

## תמונות מקור (כבר במאגר)

| דמות | קובץ |
|---|---|
| גפן רגיל | `gefen2/assets/source/gefen_normal.jpg` |
| גפן מפחיד | `gefen2/assets/source/gefen_scary.jpg` |
| עידו | `gefen2/assets/source/ido.jpg` |
| דולב | `gefen2/assets/source/dolev.jpg` |
| יהלי | `gefen2/assets/source/yahali.jpg` |
| מעיין | `gefen2/assets/source/maayan.jpg` |
| בעל הבקבוק | `gefen2/assets/source/cap.jpg` |
| החייכן | `gefen2/assets/source/smiler.jpg` |

בכל יצירה מצרפים את תמונת המקור של הדמות כ-`image_references`. הפנים והזהות לא משתנים. האימה באה מהעיניים, מהתאורה, מההבעה ומהתנועה.

---

## א. דמויות (תמונות)

יעד: `gefen2/assets/hf/<דמות>_<תנוחה>.png`
דרישות: רקע שקוף, כל הגוף מהראש עד הנעליים, עומד מול המצלמה, כפות הרגליים נוגעות בתחתית התמונה, גובה 1536 פיקסלים לפחות, בלי טקסט ובלי חפצים שלא נכתבו.
מודל מומלץ: `seedream_5_5` (עריכת פנים על בסיס תמונה אמיתית, רקע שקוף). חלופה: `gpt_image_2_6` עם `background: transparent`.
עלות שנמדדה: 1 עד 2 קרדיטים לתמונה.
מפת זוהר לעיניים (`<דמות>_<תנוחה>_glow.png`) היא רשות. אם אין, הכלי מוצא את העיניים בתמונה ומייצר אותה לבד.

בסיס משותף לכל הפרומפטים:

```
Full-body photograph of the exact same young man from the reference photo, same face, same hair,
same identity, no beautification. Standing upright, facing the camera, whole figure visible from
head to shoes, feet at the bottom edge of the frame. Photorealistic, 85mm lens, neutral soft front
light with a slight cold tint so it can be relit in a dark game. Transparent background.
No text, no logo, no extra people, no props unless stated.
```

| קובץ | תוספת לפרומפט |
|---|---|
| `gefen_idle.png` | `Possessed version. Skin pale grey-green with dirt, dark veins on the neck, sunken black eye sockets, eyes fully black with small glowing red irises, a wide unnatural grin showing teeth. Dirty torn white oversized t-shirt with dark stains, grey knit trousers, hands clasped in front of the body, head tilted slightly.` |
| `gefen_final.png` | `Final demonic form, still clearly the same face. Taller posture, shoulders raised, cracks of glowing red light running across skin and clothes like cooling lava, thin black smoke rising from the shoulders and hands, eyes burning red, grin wider. Dark charred t-shirt.` |
| `gefen_normal.png` | `Normal, freed, exhausted. Natural skin, tired relieved expression, clean white oversized t-shirt, grey knit trousers, arms relaxed.` |
| `gefen_back.png` | `Seen from directly behind, back of the head and shoulders, standing still, arms hanging. White oversized t-shirt, grey knit trousers. Very dark, only a rim of warm light on the shoulders.` |
| `ido_idle.png` | `Possessed version. Pale grey skin, black eyes with small glowing amber irises, dark tears running from both eyes, blank quiet face, mouth closed. Thin, slightly hunched, arms hanging long. Dark olive t-shirt with a few dried blood stains, black trousers, dusty as if he crawled through air vents.` |
| `ido_normal.png` | `Normal, freed, frightened and tired. Natural skin and eyes. Dark olive t-shirt, black trousers.` |
| `ido_crawl.png` | `Possessed version, head and shoulders only, crawling straight towards the camera out of a square metal air vent, one hand gripping the edge, glowing amber eyes, dark tears, dust. Framed as a bust, fading to transparent at the bottom.` (גובה בעולם 0.66 מטר, לא צריך רגליים) |
| `dolev_idle.png` | `Possessed version. Pale grey-blue skin, black eyes with small glowing electric blue irises, dark blue veins on neck and arms like burn marks from electricity, head lowered looking up from under the brow. Black t-shirt, dark blue jeans, faint blue sparks around the fingertips.` |
| `dolev_normal.png` | `Normal, freed, pleading expression, natural skin and eyes. Black t-shirt, dark blue jeans.` |
| `yahali_idle.png` | `Normal friendly but tense young man. Black hoodie, dark trousers, holding a small flashlight pointed down.` |
| `maayan_idle.png` | `Normal, strong build, serious. Black t-shirt with a white print, grey trousers, a screwdriver in one hand.` |
| `cap_idle.png` | `Normal, wearing his beige cap with sunglasses on top, short beard. White t-shirt, light blue shorts, holding a red glass bottle with a label in his right hand.` |
| `smiler_idle.png` | `Normal, wide friendly smile that feels slightly too wide, short beard. White t-shirt with a small print, denim shorts.` |

פרצופי הפחדה (ריבועיים, 1024 על 1024):

| קובץ | פרומפט |
|---|---|
| `gefen2/assets/hf/face_gefen.png` | `Extreme close-up of the same face lunging at the camera, mouth open in a scream-grin, black eyes with burning red irises, veins, motion blur on the edges, black background.` |
| `gefen2/assets/hf/face_ido.png` | `Extreme close-up of the same face, completely silent and expressionless, a few centimetres from the lens, black eyes with glowing amber irises, black tears, dust, black background.` |
| `gefen2/assets/hf/face_dolev.png` | `Extreme close-up of the same face lit from below by blue electric light, black eyes with glowing blue irises, sparks, mouth open, black background.` |

---

## ב. סרטונים

יעד: `gefen2/assets/video/<מפתח>.mp4` (אפשר להוסיף גם `.webm`).
דרישות: 16:9, 720p ומעלה, בלי פסקול (המשחק מנגן את הקול בעצמו), בלי כתוביות ובלי טקסט.
מודלים ועלות שנמדדה לחמש שניות: `kling3_0` רגיל 10 קרדיטים, `seedance_2_5_flash` 720p 25 קרדיטים, `seedance_2_5` 720p 35 קרדיטים.
תמונת פתיחה (`start_image`): צילום מסך מהמשחק עצמו מאותו רגע, כדי שהמעבר יהיה חלק. מייצרים אותו עם `node gefen2/tools/shots_game.js`.
הפניית דמות: הספרייט המוכן מתוך `gefen2/assets/img/`.

| מפתח | אורך | איפה מתנגן | פרומפט |
|---|---|---|---|
| `op_turn` | 6 עד 9 שניות | פתיחה, כשהשחקן קורא לגפן | `First-person view inside a dark abandoned snooker hall, one hanging lamp over a green table. A young man in a white t-shirt stands with his back to the camera. He stops moving, then slowly turns his head and body towards the camera. His eyes begin to glow red and a wide grin spreads. Slow push-in, dust in the air, handheld.` |
| `op_grab` | 3 עד 4 שניות | מיד אחרי המשפט שלו | `Continuing: he lunges at the camera with both hands, grabs it, his face fills the frame, violent shake, light flickers.` |
| `js_gefen` | 2 שניות | הפחדה של גפן | `His grinning face with burning red eyes rushes from the dark straight into the lens, screaming, frame shakes, cut to black.` |
| `js_gefen_final` | 2 שניות | הפחדה של גפן בלילה 6 | `Same, in the final form with glowing red cracks and smoke.` |
| `js_ido` | 2 שניות | הפחדה של עידו | `From inside a square air vent seen from the office, a silent pale face with amber eyes slides out of the darkness extremely fast and stops a few centimetres from the lens. No scream, only a sudden stop.` |
| `js_dolev` | 2 שניות | הפחדה של דולב | `All lights go out, blue sparks, then a face lit by blue electric flashes appears in three strobing jumps closer and closer to the lens.` |
| `n3_stare` | 6 עד 9 שניות | סוף לילה 3, דרך מצלמת אבטחה | `Security camera footage from a high corner of a snooker hall, grainy, slightly green, timestamp-free. Gefen walks slowly to the camera and looks straight into the lens, grinning. Behind him two more young men stand motionless with glowing eyes, one amber, one blue. He raises a hand towards the lens and the image breaks into static.` |
| `n4_ido` | 6 עד 9 שניות | לילה 4, עידו נלחם בהשפעה | `Close shot in a dark corridor lit by a flashlight. The possessed young man with amber eyes freezes, the glow flickers and goes out, his eyes become human and terrified, his lips move as if begging for help, then the glow snaps back and his face goes blank.` |
| `n5_dolev` | 6 עד 9 שניות | לילה 5, דולב משתחרר לרגע | `Red emergency lighting. The young man with blue glowing eyes drops to his knees, the blue light drains from his eyes, he looks up human and pleading, speaks a short sentence, then sparks run over his arms and the blue returns.` |
| `n6_form` | 5 עד 8 שניות | לילה 6, הצורה הסופית | `Gefen stands at the cursed snooker table. All lamps burst one after another. Red cracks of light spread over his skin, black smoke pours from his shoulders, he grows taller, still the same face, and looks at the camera.` |
| `n6_exorcism` | 7 עד 10 שניות | לילה 6, הכנסת הכדור השחור | `A black snooker ball drops into a corner pocket. A shockwave. Black smoke is torn out of the mouths and eyes of three young men at once and is sucked into the pocket. Their eyes return to normal and they collapse to their knees. Dust settles, first grey daylight through a door.` |
| `ending` | 6 עד 10 שניות | סצנת הסיום | `Sunrise outside an old snooker club. Seven tired young men walk out of the glass door into warm morning light, helping each other, seen from behind. Calm, quiet, long shadows.` |

---

## ג. סאונד

יעד: `gefen2/assets/audio/<שם>.mp3`

| קובץ | מה זה | מודל | פרומפט |
|---|---|---|---|
| `music_menu.mp3` | מוזיקת תפריט בלולאה, 60 שניות | `elevenlabs_music_v2_5` | `Slow dark ambient horror theme, detuned piano notes over a low drone, distant metallic resonance, no drums, loopable, 60 bpm.` |
| `music_tension.mp3` | מתח בלולאה, העוצמה עולה עם הסכנה | `elevenlabs_music_v2_5` | `Tense horror underscore, heartbeat-like low pulse, dissonant high strings, rising and falling, no melody, loopable.` |
| `music_ending.mp3` | סיום וזריחה | `elevenlabs_music_v2_5` | `Fragile hopeful ambient piece after a long night, warm pads, single piano notes, a hint of unease at the end.` |
| `scare_gefen.mp3` | צליל הפחדה, 2 שניות | `mirelo_text_to_audio` | `Sudden distorted male scream with a deep demonic layer and a metallic hit.` |
| `scare_ido.mp3` | צליל הפחדה, 2 שניות | `mirelo_text_to_audio` | `Sudden sharp silence-breaking hit, a dry inhale right at the ear, metal vent clang.` |
| `scare_dolev.mp3` | צליל הפחדה, 2 שניות | `mirelo_text_to_audio` | `Loud electric arc, transformer buzz, a short choked scream, power failing.` |
| `vent.mp3` | זחילה בפיר אוורור, 3 שניות | `mirelo_text_to_audio` | `Someone crawling inside a thin sheet-metal air duct, hollow thumps and scraping, close.` |

עלות שנמדדה: מוזיקה של 45 שניות 6.54 קרדיטים, אפקט של 3 שניות 0.75 קרדיטים.

### דיבוב

יעד: `gefen2/assets/audio/v/<מזהה>.mp3`. כשהקובץ קיים המשחק מנגן אותו במקום הקול המובנה של הדפדפן.
מודל: `elevenlabs_v4`. קודם מייצרים שורה אחת לכל דמות ובודקים שהעברית נשמעת טבעית, ורק אחר כך את השאר.
קול לכל דמות: צעיר ישראלי, טבעי, לא קריין. לשד ולכריזה: אותו קול של גפן, נמוך ואיטי. המשחק מוסיף עיוות בעצמו.

השורות (85) נמצאות ב-`gefen2/src/story.js`. המזהה של כל שורה הוא שם הקובץ. לפי דמות:

- השחקן (16): `op_call`, `op_breath`, `n1_try`, `n1_after`, `n1_safe`, `n2_c1`, `n2_c4`, `n2_go`, `n3_a3`, `n4_key`, `n4_note`, `n5_s1`, `n5_end`, `n6_s3`, `n6_take`, `end_1`
- יהלי (15): `n2_c3`, `n2_knock`, `n2_six2`, `n3_s1`, `n3_look`, `n3_ido`, `n3_a1`, `n3_mid`, `n3_cams`, `n4_p2`, `n4_idoafter`, `n5_a2`, `n5_v1`, `n6_s2`, `n6_yahali`
- מעיין (14): `n2_c2`, `n2_in`, `n2_six1`, `n3_s2`, `n3_dolev`, `n3_a2`, `n3_mask`, `n4_p1`, `n5_a1`, `n5_s2`, `n5_v2`, `n6_s1`, `n6_light`, `n6_collapse`
- בעל הבקבוק (9): `n1_duo1`, `n1_duo4`, `n2_duo1`, `n2_duo4`, `n4_radio`, `n4_cap`, `n4_capsafe`, `n5_cap`, `n5_caphurt`
- החייכן (5): `n1_duo2`, `n2_duo2`, `n4_smiler`, `n4_smilersafe`, `n5_smiler`
- השד בקול של גפן (6): `op_turn`, `n1_duo3`, `n2_duo3`, `n3_stare`, `n4_ambush`, `n6_form`
- כריזה, אותו קול (7): `n1_laugh`, `n1_whisper`, `n5_pa`, `n5_unsafe`, `n6_v1`, `n6_v2`, `n6_v3`
- עידו (3): `n4_ido`, `n6_ido`, `n6_hold`
- דולב (2): `n5_dolev`, `n6_dolev`
- גפן אחרי השחרור (2): `n6_done`, `end_2`
- הודעות מערכת (6) נשארות כטקסט בלי קול: `op_arrive`, `op_sys`, `n1_pow`, `n1_bdone`, `n2_panel`, `n5_gen`

---

## סדר עבודה מומלץ ותקציב משוער

| שלב | מה | קרדיטים בערך |
|---|---|---|
| 1 | 13 דמויות ו-3 פרצופי הפחדה, כולל ניסיון שני לחלק מהן | 40 עד 60 |
| 2 | 4 סרטוני הפחדה קצרים ב-`kling3_0` | 40 עד 60 |
| 3 | 7 סרטוני סיפור ב-`seedance_2_5` | 250 עד 450 |
| 4 | 3 קטעי מוזיקה ו-4 אפקטים | 25 עד 35 |
| 5 | דיבוב של 79 שורות | תלוי במחיר לשורה, בודקים עם `estimate_audio_cost` לפני |

לפני כל שלב בודקים עלות עם כלי ההערכה של Higgsfield, ומדווחים כמה נוצל בפועל.
אם יצירה נכשלת או נתקעת, לא שולחים אותה שוב אוטומטית.
