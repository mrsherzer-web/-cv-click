// הפעלת קוד Premium על המכשיר.
import { route, json, readJson, deviceId, ipHash } from './_lib/http.js';
import { redeem, limitAttempts } from './_lib/quota.js';

export const POST = route(async (request) => {
  const device = deviceId(request);
  await limitAttempts(ipHash(request), 'redeem', 30);
  const body = await readJson(request, 2048);
  return json(await redeem(device, body?.code));
});
