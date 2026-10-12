// מתכונים ממה שיש בבית. השרת בונה את הפרומפט בעצמו – הלקוח שולח רק נתונים.
import { route, json, readJson, deviceId, ipHash, HttpError } from './_lib/http.js';
import { take, planFor, recordUsage, recordError } from './_lib/quota.js';
import { recipes, mapError } from './_lib/claude.js';
import { recipeInput } from '../js/prompts.js';

export const POST = route(async (request) => {
  const device = deviceId(request);
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError('not_configured', 503);
  const input = recipeInput(await readJson(request, 64 * 1024));
  if (!input.pantry.length) throw new HttpError('bad_request', 400, { reason: 'pantry' });

  const { refund } = await take(device, ipHash(request), 'rcp');
  let result;
  try {
    result = await recipes(input, request.signal);
  } catch (e) {
    const err = mapError(e);
    if (err.code !== 'cancelled') await recordError(err.code, e?.message);
    await refund(true);
    throw err;
  }
  await recordUsage(result.usage);
  if (!result.recipes.length) {
    await refund(true);
    throw new HttpError('upstream_error', 502);
  }
  return json({ recipes: result.recipes, plan: await planFor(device) });
});
