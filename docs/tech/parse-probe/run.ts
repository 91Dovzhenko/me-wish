// Прогон пробы: локально (Mac) и через Edge Function.
// deno run -A run.ts <where: local|remote|both> <out.json> <requests.json>
// requests.json: [{ id, url, mode?, ua?, headers? }]
import { probe } from './probe.ts';

const [where, out, reqFile] = Deno.args;
const reqs = JSON.parse(await Deno.readTextFile(reqFile)) as Array<Record<string, unknown> & { id: string; url: string }>;
const FN = Deno.env.get('PROBE_URL')!;
const TOKEN = Deno.env.get('PROBE_TOKEN')!;

async function remote(r: Record<string, unknown>) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-probe-token': TOKEN },
    body: JSON.stringify(r),
  });
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { error: `edge ${res.status}: ${t.slice(0, 300)}` };
  }
}

const results: unknown[] = [];
for (const r of reqs) {
  const { id, ...opts } = r;
  const row: Record<string, unknown> = { id };
  if (where !== 'remote') row.local = await probe(r.url, opts).catch((e) => ({ error: String(e) }));
  if (where !== 'local') row.remote = await remote(opts);
  results.push(row);
  console.error('done', id);
}
await Deno.writeTextFile(out, JSON.stringify(results, null, 2));
