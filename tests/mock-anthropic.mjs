// שרת מדומה של Claude API לבדיקות: מזרים תשובה כמו ה-API האמיתי.
import http from 'node:http';

const LINES = [
  '```json',
  '{"name":"קוטג׳ 5%","match":"white_cheese","category":"dairy","qty":"גביע אחד","confidence":0.95,"shelf_days":6,"note":"פתוח"}',
  '{"name":"חלב 3%","match":"milk","category":"dairy","qty":"קרטון","confidence":0.9,"shelf_days":4,"note":""}',
  '{"name":"פלפל אדום","match":"pepper","category":"veg","qty":"2","confidence":0.88,"shelf_days":5,"note":""}',
  '{"name":"צנצנת מלפפונים חמוצים","match":null,"category":"other","qty":"צנצנת","confidence":0.7,"shelf_days":60,"note":""}',
  '{"name":"ביצים","match":"eggs","category":"protein","qty":"10 ביצים","confidence":0.97,"shelf_days":20,"note":""}',
  'not json',
  '```',
];

const RECIPES = {
  recipes: [{
    title: 'שקשוקה עם פלפל אדום', cuisine: 'israeli', time: 14, pans: 1, calories: 380, protein: 24,
    why: 'משתמש בביצים ובפלפל שיש לכם',
    ingredients: [{ name: 'ביצים', qty: '3', optional: false }, { name: 'פלפל אדום', qty: '1', optional: false }],
    steps: ['מטגנים את הפלפל', 'שוברים את הביצים ומכסים'],
  }],
};

export function startMock() {
  const state = { mode: 'ok', requests: [] };
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    if (req.method !== 'POST' || !req.url.startsWith('/v1/messages')) { res.writeHead(404); return res.end(); }
    const body = JSON.parse(raw);
    const content = body.messages?.[0]?.content;
    state.requests.push({
      url: req.url,
      beta: req.headers['anthropic-beta'] || '',
      apiKey: req.headers['x-api-key'],
      model: body.model,
      fallbacks: body.fallbacks,
      output_config: body.output_config,
      stream: Boolean(body.stream),
      images: Array.isArray(content) ? content.filter((b) => b.type === 'image').length : 0,
      text: Array.isArray(content) ? content.find((b) => b.type === 'text')?.text || '' : String(content || ''),
    });
    if (req.headers['x-api-key'] !== 'test-key') {
      res.writeHead(401, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
    }
    if (state.mode === 'error500') {
      res.writeHead(500, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } }));
    }
    if (state.mode === 'billing') {
      res.writeHead(400, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }));
    }
    const usage = { input_tokens: 9000, output_tokens: 4000 };
    if (!body.stream) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        id: 'msg_r', type: 'message', role: 'assistant', model: body.model,
        content: [{ type: 'text', text: JSON.stringify(RECIPES) }],
        stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1500, output_tokens: 1200 },
      }));
    }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    ev('message_start', { message: { id: 'msg_s', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: usage.input_tokens, output_tokens: 1 } } });
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    const lines = state.mode === 'notfridge' ? ['{"error": "בתמונה רואים חדר, לא מקרר"}'] : LINES;
    for (const line of lines) {
      if (res.destroyed) return;
      // חותכים כל שורה לשני חלקים כדי לוודא שהפענוח עובד גם על שורות שבורות
      const half = Math.floor(line.length / 2);
      ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: line.slice(0, half) } });
      await new Promise((r) => setTimeout(r, 40));
      ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: `${line.slice(half)}\n` } });
      await new Promise((r) => setTimeout(r, 40));
    }
    ev('content_block_stop', { index: 0 });
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: usage.output_tokens } });
    ev('message_stop', {});
    res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    resolve({ url: `http://127.0.0.1:${server.address().port}`, state, close: () => server.close() });
  }));
}
