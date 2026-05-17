export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TriageResult {
  presenting_issue: string;
  urgency: 'low' | 'moderate' | 'high' | 'crisis';
  language_preference?: string;
  therapist_type?: string;
  gender_preference?: string;
  prior_therapy?: boolean;
  summary: string;
}

export const TRIAGE_DRAFT_KEY = 'nawe_triage_draft';

export function saveTriage(triage: TriageResult) {
  localStorage.setItem(TRIAGE_DRAFT_KEY, JSON.stringify(triage));
}

export function loadTriage(): TriageResult | null {
  try {
    const raw = localStorage.getItem(TRIAGE_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as TriageResult) : null;
  } catch {
    return null;
  }
}

// Map Gemma triage output to the IntakeResponse shape used by the matching algorithm
export function triageToIntake(t: TriageResult) {
  const genderMap: Record<string, string> = {
    female: 'Female', male: 'Male', 'no preference': 'No preference',
  };

  const urgencyToConcern: Record<string, string[]> = {
    low: ['Stress management'],
    moderate: ['Anxiety', 'Stress management'],
    high: ['Anxiety', 'Depression', 'Trauma & PTSD'],
    crisis: ['Crisis support', 'Anxiety', 'Depression'],
  };

  return {
    id: '',
    user_id: '',
    age_range: '',
    gender_identity: '',
    presenting_concerns: urgencyToConcern[t.urgency] ?? [],
    session_format_preference: [],
    language_preference: t.language_preference ?? 'English',
    session_time_preference: '',
    frequency_preference: '',
    therapist_gender_preference: genderMap[t.gender_preference?.toLowerCase() ?? ''] ?? 'No preference',
    cultural_background_important: false,
    cultural_background: '',
    experience_level_preference: '',
    specialisation_importance: 3,
    budget_range: '',
    insurance_coverage: '',
    sliding_scale_needed: false,
    additional_notes: t.summary,
    previous_therapy: t.prior_therapy ?? null,
    crisis_flag: t.urgency === 'crisis',
    completed: true,
    created_at: '',
    updated_at: '',
  };
}
