import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface IncomingResult {
  testRunId: string;
  testCaseCode: string;
  status: 'Pass' | 'Fail' | 'Blocked' | 'Not Run' | 'Flaky' | 'Infrastructure Error';
  actualResult: string;
  commitSha: string;
  durationMs: number;
  retryCount: number;
  evidence?: Array<{ type: string; fileName: string; checksum: string; storagePath: string }>;
  metadata?: Record<string, unknown>;
}

serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase service credentials are not configured' }, 500);
  }

  const payload = (await request.json()) as { results: IncomingResult[] };
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const ingested: string[] = [];

  for (const result of payload.results) {
    const { data: runCase, error: runCaseError } = await supabase
      .from('test_run_cases')
      .select('id, test_runs!inner(status), test_cases!inner(code)')
      .eq('test_run_id', result.testRunId)
      .eq('test_cases.code', result.testCaseCode)
      .single();

    if (runCaseError || !runCase) {
      return json({ error: `No run case found for ${result.testCaseCode}`, detail: runCaseError?.message }, 422);
    }

    if ((runCase.test_runs as { status: string }).status === 'Locked') {
      return json({ error: `Test run is locked for ${result.testCaseCode}` }, 409);
    }

    const { data: inserted, error: resultError } = await supabase
      .from('test_results')
      .insert({
        test_run_case_id: runCase.id,
        status: result.status,
        actual_result: result.actualResult,
        runner_type: 'automation',
        commit_sha: result.commitSha,
        duration_ms: result.durationMs,
        retry_count: result.retryCount,
        metadata: result.metadata ?? {}
      })
      .select('id')
      .single();

    if (resultError || !inserted) {
      return json({ error: `Cannot insert result for ${result.testCaseCode}`, detail: resultError?.message }, 500);
    }

    if (result.evidence?.length) {
      const { error: evidenceError } = await supabase.from('evidence').insert(
        result.evidence.map((item) => ({
          test_result_id: inserted.id,
          evidence_type: item.type,
          file_name: item.fileName,
          checksum: item.checksum,
          storage_path: item.storagePath
        }))
      );

      if (evidenceError) {
        return json({ error: `Cannot insert evidence for ${result.testCaseCode}`, detail: evidenceError.message }, 500);
      }
    }

    ingested.push(inserted.id);
  }

  return json({ ingested });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
