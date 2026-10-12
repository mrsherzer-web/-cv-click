// הקריאות ל-Claude API מהשרת, עם המפתח של בעל האפליקציה (ANTHROPIC_API_KEY).
import Anthropic from '@anthropic-ai/sdk';
import { HttpError } from './http.js';
import { detectPrompt, recipePrompt, recipesFrom, RECIPE_SCHEMA } from '../../js/prompts.js';

export const model = () => process.env.CLAUDE_MODEL || 'claude-opus-5-5';

let client = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError('not_configured', 503);
  client ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  return client;
}

// מודלים שתומכים ב-effort, ומודלים שתומכים במעבר אוטומטי למודל גיבוי אם הבקשה נדחית
const supportsEffort = (m) => /^claude-(opus-4-[678]|opus-5|sonnet-4-6|sonnet-5|haiku-5|fable|mythos)/.test(m);
const FALLBACK_MODELS = ['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5'];

function base(m, effort, extraOutput = {}) {
  return {
    model: m,
    ...(FALLBACK_MODELS.includes(m) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    output_config: { ...(supportsEffort(m) ? { effort } : {}), ...extraOutput },
  };
}

/** מתרגם שגיאת API לקוד שהאפליקציה מבינה */
export function mapError(e) {
  if (e instanceof HttpError) return e;
  if (e instanceof Anthropic.APIUserAbortError || e?.name === 'AbortError') return new HttpError('cancelled', 499);
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return new HttpError('not_configured', 503, { reason: 'invalid_api_key' });
  }
  const message = String(e?.error?.error?.message || e?.message || '');
  if (/credit balance|billing|spend limit|usage limit/i.test(message)) return new HttpError('billing', 503);
  if (e instanceof Anthropic.RateLimitError || e?.status === 529 || e?.status === 503) return new HttpError('upstream_busy', 503);
  if (e instanceof Anthropic.APIConnectionError) return new HttpError('upstream_error', 502);
  return new HttpError('upstream_error', 502);
}

/**
 * סריקת מקרר: שולח את התמונות ומעביר את הטקסט ל-onText ברגע שהוא נכתב.
 * images: [{ type: 'image/jpeg', data: base64 }]
 */
export async function scan({ images, signal, onText }) {
  const m = model();
  const stream = anthropic().beta.messages.stream({
    ...base(m, process.env.SCAN_EFFORT || 'high'),
    max_tokens: 16000,
    messages: [{
      role: 'user',
      content: [
        ...images.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.type, data: im.data } })),
        { type: 'text', text: detectPrompt(images.length) },
      ],
    }],
  }, { signal });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') onText(event.delta.text);
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') throw new HttpError('refused', 422);
  return final;
}

/** מתכונים ממה שיש בבית – JSON מובנה ומאומת */
export async function recipes(input, signal) {
  const m = model();
  const msg = await anthropic().beta.messages.create({
    ...base(m, process.env.RECIPE_EFFORT || 'low', { format: { type: 'json_schema', schema: RECIPE_SCHEMA } }),
    max_tokens: 8000,
    messages: [{ role: 'user', content: recipePrompt(input) }],
  }, { signal });
  if (msg.stop_reason === 'refusal') throw new HttpError('refused', 422);
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let out;
  try {
    out = JSON.parse(text);
  } catch {
    throw new HttpError('upstream_error', 502);
  }
  return { recipes: recipesFrom(out), usage: msg.usage };
}
