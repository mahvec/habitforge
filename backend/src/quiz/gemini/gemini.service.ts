import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class GeminiService {
  private apiKey: string | undefined;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
  }

  async generateQuiz(passageContent: string): Promise<{ q: string; options: string[]; correct: number }[]> {
    if (!this.apiKey || this.apiKey === 'placeholder') {
      throw new InternalServerErrorException('OpenRouter API key not configured');
    }

    const prompt = `Act as a Hostile Evaluator for a habit-enforcing reading app.
Your goal is to generate 3 multiple-choice questions that prove the user has read and comprehended the following text.
The questions must be specific to details in the text, not general knowledge.

Text: "${passageContent}"

Return ONLY valid JSON — no markdown, no code fences. Use this exact format:
[
  {
    "q": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }
]
The "correct" field should be the index of the correct option in the "options" array.
Return exactly 3 questions.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenRouter API Error:', response.status, error);
        throw new Error(`OpenRouter returned ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from OpenRouter');
      }

      const parsed = JSON.parse(content);
      // Handle both { questions: [...] } and direct array formats
      const questions = Array.isArray(parsed) ? parsed : parsed.questions;

      if (!Array.isArray(questions) || questions.length !== 3) {
        throw new Error('Invalid quiz format: expected 3 questions');
      }

      return questions;
    } catch (error) {
      console.error('Quiz Generation Error:', error);
      throw new InternalServerErrorException('Failed to generate quiz');
    }
  }
}
