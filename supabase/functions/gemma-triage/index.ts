import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google AI Studio takes priority; Ollama is the fallback for local dev
const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY') ?? '';
const googleModel = Deno.env.get('GEMMA_MODEL') ?? 'gemma-4-31b-it';
const ollamaBaseUrl = Deno.env.get('OLLAMA_BASE_URL') ?? 'http://localhost:11434';
const ollamaModel = Deno.env.get('OLLAMA_MODEL') ?? 'gemma4:4b';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SYSTEM_PROMPT_EN = `You are a warm, empathetic mental health intake assistant for Nawe, a digital mental health platform serving East Africa. Your role is to conduct a gentle, conversational assessment to help match the person with the right therapist.

Conduct a warm conversation of 4–5 exchanges. In each exchange, ask about ONE thing — keep questions brief and compassionate:
1. What brings them to seek support today
2. How long they have been experiencing this, and how much it is affecting their day-to-day life (this determines urgency)
3. Whether they have seen a therapist or counsellor before
4. Their preferences: therapist gender, language, or therapeutic approach (e.g. CBT, talk therapy)

Tone: warm, non-clinical, non-judgmental. Use simple language. Do not ask multiple questions at once. If the user writes in Swahili, respond in Swahili.

Once you have gathered enough information (after 4–5 exchanges), call the submit_triage function with your structured assessment. Do not ask more questions after that.`;

const SYSTEM_PROMPT_SW = `Wewe ni msaidizi wa awali wa afya ya akili kwa Nawe, jukwaa la afya ya akili la Afrika Mashariki. Kazi yako ni kufanya mazungumzo ya upole ili kukusaidia kupata mtaalamu anayekufaa.

Fanya mazungumzo ya kubadilishana 4–5. Kila mara, uliza kuhusu KITU KIMOJA tu — maswali mafupi na yenye huruma:
1. Nini kimekufanya utafute msaada leo
2. Kwa muda gani umekuwa na hali hii, na inakuathiri vipi maishani (hii inaonyesha kiwango cha dharura)
3. Je, umewahi kuona daktari wa afya ya akili au mshauri kabla
4. Mapendeleo yako: jinsia ya mtaalamu, lugha, au njia ya tiba (k.m. CBT, mazungumzo)

Mwisho wa mazungumzo (baada ya ubadilishano 4–5), piga simu ya submit_triage na muhtasari wako. Usiulize maswali zaidi baada ya hapo.`;

const TRIAGE_FUNCTION_DECL = {
  name: 'submit_triage',
  description: 'Submit the completed triage assessment once you have gathered enough information.',
  parameters: {
    type: 'object',
    required: ['presenting_issue', 'urgency', 'summary'],
    properties: {
      presenting_issue: { type: 'string', description: 'Brief description of the main concern' },
      urgency: {
        type: 'string',
        enum: ['low', 'moderate', 'high', 'crisis'],
        description: 'low = mild and manageable, moderate = affecting daily life, high = significantly impairing, crisis = immediate risk',
      },
      language_preference: { type: 'string', description: 'Language the user prefers for therapy' },
      therapist_type: { type: 'string', description: 'Preferred therapeutic approach' },
      gender_preference: { type: 'string', description: 'Preferred therapist gender' },
      prior_therapy: { type: 'boolean', description: 'Whether the user has had therapy before' },
      summary: { type: 'string', description: 'One or two sentence clinical summary for therapist matching, in English' },
    },
  },
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestPayload {
  messages: ChatMessage[];
  language?: 'en' | 'sw';
  user_id?: string;
}

// ---- Google AI Studio ----

async function callGoogleAI(messages: ChatMessage[], language: 'en' | 'sw') {
  const systemPrompt = language === 'sw' ? SYSTEM_PROMPT_SW : SYSTEM_PROMPT_EN;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: [{ function_declarations: [TRIAGE_FUNCTION_DECL] }],
  };

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${googleApiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );

  if (!resp.ok) throw new Error(`Google AI error (${resp.status}): ${await resp.text()}`);
  const json = await resp.json();

  const candidate = json.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  const fnCall = parts.find((p: Record<string, unknown>) => p.functionCall);
  if (fnCall) {
    return {
      done: true,
      triage: fnCall.functionCall.args,
    };
  }

  // Filter out thinking parts (thought: true) — only show the actual reply
  const text = parts
    .filter((p: Record<string, unknown>) => !p.thought)
    .map((p: Record<string, unknown>) => p.text ?? '')
    .join('');
  return { done: false, message: { role: 'assistant', content: text } };
}

// ---- Ollama (local dev fallback) ----

async function callOllama(messages: ChatMessage[], language: 'en' | 'sw') {
  const systemPrompt = language === 'sw' ? SYSTEM_PROMPT_SW : SYSTEM_PROMPT_EN;
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  ];

  const resp = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      messages: fullMessages,
      tools: [{ type: 'function', function: TRIAGE_FUNCTION_DECL }],
      stream: false,
    }),
  });

  if (!resp.ok) throw new Error(`Ollama error: ${resp.status} ${await resp.text()}`);
  const json = await resp.json();
  const assistantMessage = json.message;
  const toolCall = assistantMessage?.tool_calls?.[0];

  if (toolCall?.function?.name === 'submit_triage') {
    return { done: true, triage: toolCall.function.arguments };
  }

  return { done: false, message: { role: 'assistant', content: assistantMessage?.content ?? '' } };
}

async function callGemma(messages: ChatMessage[], language: 'en' | 'sw') {
  if (googleApiKey) return callGoogleAI(messages, language);
  return callOllama(messages, language);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: RequestPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { messages, language = 'en', user_id } = payload;
  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'messages array is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await callGemma(messages, language);

    if (result.done) {
      const triageData = result.triage;
      let savedId: string | null = null;

      if (user_id) {
        const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: row } = await adminClient
          .from('triage_results')
          .insert({
            user_id,
            presenting_issue: triageData.presenting_issue as string ?? null,
            urgency: triageData.urgency as string ?? null,
            language_preference: triageData.language_preference as string ?? null,
            therapist_type: triageData.therapist_type as string ?? null,
            gender_preference: triageData.gender_preference as string ?? null,
            prior_therapy: triageData.prior_therapy as boolean ?? null,
            summary: triageData.summary as string ?? null,
            raw_output: triageData,
          })
          .select('id')
          .single();
        savedId = row?.id ?? null;
      }

      return new Response(
        JSON.stringify({ done: true, triage: triageData, triage_id: savedId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ done: false, message: result.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('gemma-triage error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
