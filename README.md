# Katzir FC · קציר אף סי

משחק כדורגל בדפדפן עם החבר'ה של קציר. ליאם שבת הוא הגואט.

A browser football game starring the Katzir FC squad: FC-style player cards, pack openings with walkouts, a playable 8-a-side match with a broadcast camera, the Katzir Cup and a penalty shootout. Everything is static HTML/CSS/JS, no build step.

## מה יש במשחק

- **משחק מהיר**: 8 נגד 8 עם מצלמת שידור, קהל, שלטי פרסום, פרצופים של השחקנים על הדמויות, שוערים שקופצים, קרנות, חוצים, מחצית וסיום.
- **גביע קציר**: רבע גמר, חצי גמר וגמר. תיקו בגביע נגמר בפנדלים.
- **חבילות**: חבילות זהב, כוכבים ו־וואמוס, עם אנימציית walkout (דגל, עמדה, סמל, שחקן). חבילת הפתיחה מביאה את **ליאם שבת · הגואט · 100**, הקלף היחיד במשחק עם 100.
- **הסגל**: 16 שחקנים. שבעת שחקני קציר המקוריים (ליאם שבת, יפתח צימט, יהונתן שרצר, ארז פור, עידו, גפן אלמקייס, ספיקו כהן) ועוד 9 שחקנים חדשים שהומצאו לקבוצה. עורכים הרכב 2-3-2 בלחיצה.
- **פנדלים**: בוחרים פינה, השוער מנחש. בהגנה בוחרים לאן השוער יזנק.
- **קריינות בעברית**: קטעים מוקלטים של ElevenLabs לגול של ליאם, הגול של עידו, ליאם עם הכדור, וגול ליריבה. שאר השורות נקראות בקול עברי של המכשיר (אם יש) ותמיד מופיעות ככתוביות.

## שליטה

| | מחשב | טלפון (לרוחב) |
|---|---|---|
| תנועה | WASD או חיצים | ג'ויסטיק משמאל |
| מסירה | J (החזיקו ללוב) | כפתור כחול |
| בעיטה | K או רווח (החזיקו לעוצמה) | כפתור אדום |
| תיקול בהגנה | K או רווח | כפתור אדום |
| החלפת שחקן | Q, או J בהגנה | כפתור כחול בהגנה |
| ספרינט | Shift | כפתור זהב |
| השהיה | Esc | כפתור בפינה |

## הרצה מקומית

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

The game must be served over HTTP (not opened as a `file://` URL) because audio is loaded with `fetch`.

## Structure

```
index.html        page shell
css/app.css       visual system (cards, screens, HUD)
js/data.js        squad, stats, editions, rival clubs, formations, commentary lines
js/store.js       profile in localStorage (coins, collection, lineup, settings)
js/audio.js       WebAudio SFX + loops, voice clips, Hebrew speech fallback
js/cards.js       FC-style card component
js/match.js       match engine: physics, AI, keepers, restarts, 2.5D renderer, input
js/ui.js          screens, packs and walkouts, cup, penalties, match HUD
js/main.js        boot and first-run welcome pack
assets/players    card art (background removed)
assets/heads      sprite heads used on the pitch
assets/action     action photos used for goal celebrations
assets/brand      crest and stadium backdrop
assets/audio      commentary clips and stadium sound effects
```

## Credits

- Player photos and FC-style cards of the seven Katzir players: supplied by the squad. Backgrounds (including all third-party logos) were removed with BiRefNet; action photos are cropped above the advertising boards.
- Portraits of the nine new squad players, the club crest and the stadium backdrop: generated with Figma AI (the backup keeper with Canva AI), upscaled 4x with EDSR.
- Hebrew commentary: ElevenLabs (voice "Itai"). Stadium sound effects: synthesised offline (crowd, roar, whistles, kick, net, post).
- Fonts: Barlow Condensed, Karantina, Heebo (Google Fonts).

Katzir FC is a fan-made game. It is not affiliated with EA Sports, FC 26 or any real football club.
