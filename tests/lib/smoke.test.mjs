// A smoke test of tests/lib/stage.mjs on chapter nine's last mission (short, no fights): the save is placed, the
// mission begins, the loop is stepped, the lines are heard, a leg is walked with the stick, a prompt is pressed.
import { openStage } from './stage.mjs';

const CH9 = ['phoenix', 'deathroad', 'blackport', 'stolen', 'barehands', 'armory', 'portwar', 'wounded', 'comeback', 'blacktower', 'shadow', 'meltdown'];
const t = await openStage({ chapter: 9, done: CH9, first: 'together' });
const { check, S, G, until, talkThrough, said, interact, tp } = t;
let s = await S();
check('the save is placed and "together" begins', s.mission?.id === 'together', JSON.stringify(s.mission));
check('the start screen was read', /עשרה פרקים/.test(t.startScreen), t.startScreen.slice(0, 60));
s = await until((s) => !s.cutscene && s.mission?.step === 0 && !!s.objective, 30, 'the first goal');
check('a goal is on screen', !!s?.objective, s?.objective);
const stand = await G(() => window.__r.pt(window.__game.debug.world.places.safehouse.seats[0].stand));
const res = await tp(stand);
check('a leg walked with the stick into the house', res === 'ok', res);
check('the prompt to sit is pressed with the real button', await interact('לשבת עם החבורה', 8));
s = await talkThrough((s) => s.mission?.step >= 2, 90, 'the scene on the sofa');
check('the lines are heard word for word', said('אתם לא נפטרים ממני כל כך מהר.', 'נהוראי') && said('אחי, חשבתי שלא נראה אותך יותר.'), t.heard.slice(0, 3).join(' | '));
await t.finish();
