// הגדרות ציבוריות לאפליקציה: האם השרת מוכן, מכסות, מחיר וקישור רכישה.
import { json, envNum } from './_lib/http.js';
import { storageKind } from './_lib/store.js';
import { limits } from './_lib/quota.js';

export function GET() {
  const L = limits();
  return json({
    server: true,
    ready: Boolean(process.env.ANTHROPIC_API_KEY),
    storage: storageKind,
    freeScans: L.freeScans,
    freeRecipes: L.freeRecipes,
    maxImages: Math.min(6, Math.max(1, envNum('MAX_IMAGES', 5))),
    priceText: process.env.PREMIUM_PRICE_TEXT || '',
    checkoutUrl: process.env.CHECKOUT_URL || '',
    supportEmail: process.env.SUPPORT_EMAIL || '',
  });
}
