import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OLLAMA_BASE_URL = Deno.env.get('OLLAMA_BASE_URL') ?? 'http://localhost:11434';
const OLLAMA_MODEL = Deno.env.get('OLLAMA_MODEL') ?? 'gemma4:4b';
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

const TRIAGE_TOOL = {
  type: 'function',
  function: {
    name: 'submit_triage',
    description: 'Submit the completed triage assessment once you have gathered enough information.',
    parameters: {
      type: 'object',
      required: ['presenting_issue', 'urgency', 'summary'],
      properties: {
        presenting_issue: {
          type: 'string',
          description: 'Brief description of the main concern, e.g. "anxiety and work stress"',
        },
        urgency: {
          type: 'string',
          enum: ['low', 'moderate', 'high', 'crisis'],
          description: 'low = mild and manageable, moderate = affecting daily life, high = significantly impairing, crisis = immediate risk',
        },
        language_preference: {
          type: 'string',
          description: 'Language the user prefers for therapy, e.g. "Swahili", "English"',
        },
        therapist_type: {
          type: 'string',
          description: 'Preferred therapeutic approach, e.g. "CBT", "talk therapy", "any"',
        },
        gender_preference: {
          type: 'string',
          description: 'Preferred therapist gender, e.g. "female", "male", "no preference"',
        },
        prior_therapy: {
          type: 'boolean',
          description: 'Whether the user has had therapy before',
        },
        summary: {
          type: 'string',
          description: 'One or two sentence clinical summary for therapist matching, in English',
        },
      },
    },
  },
};

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[];
}

interface RequestPayload {
  messages: OllamaMessage[];
  language?: 'en' | 'sw';
  user_id?: string;
}

async function callOllama(messages: OllamaMessage[], language: 'en' | 'sw') {
  const systemPrompt = language === 'sw' ? SYSTEM_PROMPT_SW : SYSTEM_PROMPT_EN;
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  const resp = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: fullMessages,
      tools: [TRIAGE_TOOL],
      stream: false,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Ollama error: ${resp.status} ${await resp.text()}`);
  }
  return await resp.json();
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
    const ollamaResp = await callOllama(messages, language);
    const assistantMessage: OllamaMessage = ollamaResp.message;

    // Check if Gemma called submit_triage
    const toolCall = assistantMessage.tool_calls?.[0];
    if (toolCall?.function?.name === 'submit_triage') {
      const triageData = toolCall.function.arguments;

      // Persist to Supabase if user is logged in
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

    // Conversation continues — return the assistant message
    return new Response(
      JSON.stringify({ done: false, message: assistantMessage }),
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
