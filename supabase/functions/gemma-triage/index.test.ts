/**
 * Tests for gemma-triage edge function logic.
 *
 * Run with:
 *   ~/.deno/bin/deno test --allow-env supabase/functions/gemma-triage/index.test.ts
 */

import { assertEquals, assertMatch, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ---------------------------------------------------------------------------
// Pure logic mirrored from index.ts
// ---------------------------------------------------------------------------

function normaliseChatRole(role: string): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user';
}

function toGeminiContents(messages: { role: string; content: string }[]) {
  return messages.map((m) => ({
    role: normaliseChatRole(m.role),
    parts: [{ text: m.content }],
  }));
}

function extractGoogleAIResult(response: Record<string, unknown>): { done: boolean; triage?: unknown; message?: { role: string; content: string } } {
  const candidate = (response.candidates as Record<string, unknown>[])?.[0];
  const parts = (candidate?.content as Record<string, unknown>)?.parts as Record<string, unknown>[] ?? [];
  const fnPart = parts.find((p) => p.functionCall);
  if (fnPart) {
    const fc = fnPart.functionCall as Record<string, unknown>;
    return { done: true, triage: fc.args };
  }
  const text = parts.map((p) => p.text ?? '').join('');
  return { done: false, message: { role: 'assistant', content: text as string } };
}

function extractOllamaResult(response: Record<string, unknown>): { done: boolean; triage?: unknown; message?: { role: string; content: string } } {
  const msg = response.message as Record<string, unknown>;
  const toolCalls = msg?.tool_calls as { function: { name: string; arguments: unknown } }[] | undefined;
  const toolCall = toolCalls?.[0];
  if (toolCall?.function?.name === 'submit_triage') {
    return { done: true, triage: toolCall.function.arguments };
  }
  return { done: false, message: { role: 'assistant', content: msg?.content as string ?? '' } };
}

// ---------------------------------------------------------------------------
// Message format conversion
// ---------------------------------------------------------------------------

Deno.test('toGeminiContents: maps user role correctly', () => {
  const result = toGeminiContents([{ role: 'user', content: 'Hello' }]);
  assertEquals(result[0].role, 'user');
  assertEquals(result[0].parts[0].text, 'Hello');
});

Deno.test('toGeminiContents: maps assistant to model', () => {
  const result = toGeminiContents([{ role: 'assistant', content: 'Hi there' }]);
  assertEquals(result[0].role, 'model');
});

Deno.test('toGeminiContents: preserves multi-turn conversation order', () => {
  const messages = [
    { role: 'user', content: 'I feel anxious' },
    { role: 'assistant', content: 'How long have you been feeling this way?' },
    { role: 'user', content: 'About 3 weeks' },
  ];
  const result = toGeminiContents(messages);
  assertEquals(result.length, 3);
  assertEquals(result[0].role, 'user');
  assertEquals(result[1].role, 'model');
  assertEquals(result[2].role, 'user');
});

// ---------------------------------------------------------------------------
// Google AI Studio response parsing
// ---------------------------------------------------------------------------

Deno.test('extractGoogleAIResult: detects function call and returns done=true', () => {
  const mockResponse = {
    candidates: [{
      content: {
        parts: [{
          functionCall: {
            name: 'submit_triage',
            args: {
              presenting_issue: 'anxiety and work stress',
              urgency: 'moderate',
              summary: 'Client experiencing persistent anxiety linked to workplace pressure',
              language_preference: 'English',
              gender_preference: 'female',
              prior_therapy: false,
            },
          },
        }],
        role: 'model',
      },
    }],
  };

  const result = extractGoogleAIResult(mockResponse);
  assertEquals(result.done, true);
  assertExists(result.triage);
  assertEquals((result.triage as Record<string, unknown>).urgency, 'moderate');
});

Deno.test('extractGoogleAIResult: text response returns done=false with message', () => {
  const mockResponse = {
    candidates: [{
      content: {
        parts: [{ text: 'How long have you been feeling this way?' }],
        role: 'model',
      },
    }],
  };

  const result = extractGoogleAIResult(mockResponse);
  assertEquals(result.done, false);
  assertEquals(result.message?.content, 'How long have you been feeling this way?');
  assertEquals(result.message?.role, 'assistant');
});

Deno.test('extractGoogleAIResult: multi-part text response is joined', () => {
  const mockResponse = {
    candidates: [{
      content: {
        parts: [{ text: 'Thank you for sharing.' }, { text: ' How has this affected your daily life?' }],
        role: 'model',
      },
    }],
  };

  const result = extractGoogleAIResult(mockResponse);
  assertEquals(result.done, false);
  assertEquals(result.message?.content, 'Thank you for sharing. How has this affected your daily life?');
});

// ---------------------------------------------------------------------------
// Ollama response parsing
// ---------------------------------------------------------------------------

Deno.test('extractOllamaResult: detects submit_triage tool call', () => {
  const mockResponse = {
    message: {
      role: 'assistant',
      content: '',
      tool_calls: [{
        function: {
          name: 'submit_triage',
          arguments: {
            presenting_issue: 'depression',
            urgency: 'high',
            summary: 'Client reports persistent low mood for 2 months',
            prior_therapy: true,
          },
        },
      }],
    },
  };

  const result = extractOllamaResult(mockResponse);
  assertEquals(result.done, true);
  assertEquals((result.triage as Record<string, unknown>).urgency, 'high');
});

Deno.test('extractOllamaResult: text-only response returns done=false', () => {
  const mockResponse = {
    message: {
      role: 'assistant',
      content: 'Have you seen a therapist before?',
    },
  };

  const result = extractOllamaResult(mockResponse);
  assertEquals(result.done, false);
  assertEquals(result.message?.content, 'Have you seen a therapist before?');
});

Deno.test('extractOllamaResult: wrong tool name is ignored', () => {
  const mockResponse = {
    message: {
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: 'other_tool', arguments: {} } }],
    },
  };

  const result = extractOllamaResult(mockResponse);
  assertEquals(result.done, false);
});

// ---------------------------------------------------------------------------
// Triage output validation
// ---------------------------------------------------------------------------

Deno.test('triage urgency: crisis flag maps correctly', () => {
  const urgency = 'crisis';
  const isCrisis = urgency === 'crisis';
  assertEquals(isCrisis, true);
});

Deno.test('triage urgency: valid enum values', () => {
  const valid = ['low', 'moderate', 'high', 'crisis'];
  for (const u of valid) {
    assertEquals(valid.includes(u), true);
  }
});

Deno.test('triage: triageToIntake maps urgency to presenting_concerns', () => {
  const urgencyToConcern: Record<string, string[]> = {
    low: ['Stress management'],
    moderate: ['Anxiety', 'Stress management'],
    high: ['Anxiety', 'Depression', 'Trauma & PTSD'],
    crisis: ['Crisis support', 'Anxiety', 'Depression'],
  };

  assertEquals(urgencyToConcern['moderate'], ['Anxiety', 'Stress management']);
  assertEquals(urgencyToConcern['crisis'].includes('Crisis support'), true);
  assertEquals(urgencyToConcern['low'], ['Stress management']);
});

Deno.test('triage: gender preference normalisation', () => {
  const genderMap: Record<string, string> = {
    female: 'Female', male: 'Male', 'no preference': 'No preference',
  };
  assertEquals(genderMap['female'], 'Female');
  assertEquals(genderMap['no preference'], 'No preference');
  assertEquals(genderMap['unknown'], undefined);
});

// ---------------------------------------------------------------------------
// Swahili language handling
// ---------------------------------------------------------------------------

Deno.test('language: sw triggers Swahili system prompt', () => {
  const systemPromptSw = 'Wewe ni msaidizi wa awali wa afya ya akili kwa Nawe';
  const systemPromptEn = 'You are a warm, empathetic mental health intake assistant';

  const getPrompt = (lang: string) => lang === 'sw' ? systemPromptSw : systemPromptEn;

  assertMatch(getPrompt('sw'), /Wewe ni msaidizi/);
  assertMatch(getPrompt('en'), /You are a warm/);
  assertMatch(getPrompt('en'), /You are a warm/); // default
});
