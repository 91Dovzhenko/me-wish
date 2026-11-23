// Временная Edge Function для исследования (ТЗ 002). После исследования удаляется из облака.
import { probe, type ProbeOpts } from './probe.ts';

Deno.serve(async (req) => {
  const token = Deno.env.get('PROBE_TOKEN');
  if (!token || req.headers.get('x-probe-token') !== token) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const { url, ...opts } = (await req.json()) as { url: string } & ProbeOpts;
    const result = await probe(url, opts);
    return Response.json({ where: 'supabase', region: Deno.env.get('SB_REGION') ?? null, ...result });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
