// התוכנית והמכסה של המכשיר הזה.
import { route, json, deviceId } from './_lib/http.js';
import { planFor } from './_lib/quota.js';

export const GET = route(async (request) => json(await planFor(deviceId(request))));
