import { StructuredDocument } from './parser';

export interface DocumentAnalysis {
  difficultyScore: 'Beginner' | 'Intermediate' | 'Advanced';
  topicDensity: string;
  estimatedExamWeightage: number;
}

export interface DocumentEnhancements {
  learningObjectives?: string[] | null;
  summary?: string | null;
  examConcepts?: Array<{ concept: string; definition: string }> | null;
  commonMistakes?: Array<{ mistake: string; correction: string }> | null;
  mcqs?: Array<{ question: string; options: string[]; correctOption: string; explanation: string }> | null;
  interviewQuestions?: Array<{ question: string; answer: string }> | null;
}

function getDocumentText(doc: StructuredDocument): string {
  return doc.blocks
    .filter(b => b.type === 'heading' || b.type === 'paragraph' || b.type === 'list' || b.type === 'callout')
    .map(b => b.text || '')
    .join('\n')
    .substring(0, 40000);
}

export async function analyzeDocument(doc: StructuredDocument): Promise<DocumentAnalysis> {
  const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('[AI] API key missing. Using mock analysis.');
    return getMockAnalysis(doc);
  }

  const textContent = getDocumentText(doc);
  const prompt = `You are an expert educational curriculum assessor.
Analyze the following study guide notes text and provide a structural difficulty analysis:
1. Difficulty Score: Must be exactly one of: "Beginner", "Intermediate", or "Advanced".
2. Topic Density: A single-line comma-separated text string representing 3-5 main topic concepts and their density percentages (e.g. "Macroeconomics (45%), Monetary Policy (25%), Economic Planning (20%)").
3. Estimated Exam Weightage: A number from 0 to 100 representing the relevance and high-yield scoring potential of this document for a competitive test.

Return the response STRICTLY as a raw JSON object matching the following structure:
{
  "difficultyScore": "Intermediate",
  "topicDensity": "Topic A (40%), Topic B (30%)",
  "estimatedExamWeightage": 75
}

Do not wrap the JSON output in markdown formatting, backticks, or any conversational text.

Text Content:
${textContent}`;

  try {
    if (process.env.GROQ_API_KEY) {
      console.log('[AI] Querying Groq API for document analysis...');
      const url = 'https://api.groq.com/openai/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      });

      if (response.ok) {
        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(cleanJsonString(responseText));
        if (parsed.difficultyScore) return parsed as DocumentAnalysis;
      } else {
        console.warn(`Groq API returned error status: ${response.status} - ${await response.text()}`);
      }
    } else if (process.env.GEMINI_API_KEY) {
      console.log('[AI] Querying Gemini API for document analysis...');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(cleanJsonString(responseText));
        if (parsed.difficultyScore) return parsed as DocumentAnalysis;
      }
    } else if (process.env.OPENAI_API_KEY) {
      console.log('[AI] Querying OpenAI API for document analysis...');
      const url = 'https://api.openai.com/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      });

      if (response.ok) {
        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(cleanJsonString(responseText));
        if (parsed.difficultyScore) return parsed as DocumentAnalysis;
      }
    }
  } catch (err) {
    console.error('[AI Error] analyzeDocument failed:', err);
  }

  return getMockAnalysis(doc);
}

export async function enhanceDocument(
  doc: StructuredDocument,
  flags: {
    objectives: boolean;
    examConcepts: boolean;
    revisionNotes: boolean;
    mcqs: boolean;
  }
): Promise<DocumentEnhancements> {
  const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('[AI] API key missing. Using mock enhancements.');
    return getMockEnhancements(flags);
  }

  const textContent = getDocumentText(doc);
  const prompt = `You are an expert AI educator. Analyze the provided study material and generate custom educational additions based on these requested features:
1. objectives: (Generate if requested = ${flags.objectives}) A list of 3-4 clear educational learning objectives.
2. summary: (Generate if requested = ${flags.objectives}) A comprehensive 1-page educational summary.
3. examConcepts: (Generate if requested = ${flags.examConcepts}) A list of 3-5 important exam concepts/definitions.
4. commonMistakes: (Generate if requested = ${flags.revisionNotes}) A list of 3-4 typical errors, misconceptions, or traps students make on this topic and how to correct them.
5. mcqs: (Generate if requested = ${flags.mcqs}) A list of 3-4 high-quality multiple-choice questions (MCQs), each with: "question", "options" (array of 4 strings), "correctOption" (e.g. "A", "B", "C", "D"), and "explanation".
6. interviewQuestions: (Generate if requested = ${flags.mcqs}) A list of 3-4 expected interview, viva, or exam questions with model answers.

Return the response STRICTLY as a raw JSON object matching the following TypeScript schema:
{
  "learningObjectives": string[] | null,
  "summary": string | null,
  "examConcepts": Array<{ "concept": string, "definition": string }> | null,
  "commonMistakes": Array<{ "mistake": string, "correction": string }> | null,
  "mcqs": Array<{ "question": string, "options": string[], "correctOption": string, "explanation": string }> | null,
  "interviewQuestions": Array<{ "question": string, "answer": string }> | null
}

Only generate content for features that are true. Set all other fields to null.
Do not wrap the JSON output in markdown formatting or backticks.

Text Content:
${textContent}`;

  try {
    if (process.env.GROQ_API_KEY) {
      console.log('[AI] Querying Groq API for content enhancement...');
      const url = 'https://api.groq.com/openai/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.2
        })
      });

      if (response.ok) {
        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || '{}';
        return JSON.parse(cleanJsonString(responseText)) as DocumentEnhancements;
      } else {
        console.warn(`Groq API returned error status: ${response.status} - ${await response.text()}`);
      }
    } else if (process.env.GEMINI_API_KEY) {
      console.log('[AI] Querying Gemini API for content enhancement...');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return JSON.parse(cleanJsonString(responseText)) as DocumentEnhancements;
      }
    } else if (process.env.OPENAI_API_KEY) {
      console.log('[AI] Querying OpenAI API for content enhancement...');
      const url = 'https://api.openai.com/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.2
        })
      });

      if (response.ok) {
        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || '{}';
        return JSON.parse(cleanJsonString(responseText)) as DocumentEnhancements;
      }
    }
  } catch (err) {
    console.error('[AI Error] enhanceDocument failed:', err);
  }

  return getMockEnhancements(flags);
}

function cleanJsonString(str: string): string {
  return str.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
}

function getMockAnalysis(doc: StructuredDocument): DocumentAnalysis {
  const text = getDocumentText(doc);
  let score: 'Beginner' | 'Intermediate' | 'Advanced' = 'Intermediate';
  if (text.includes('advanced') || text.includes('theorem') || text.includes('econometric')) {
    score = 'Advanced';
  } else if (text.length < 2000) {
    score = 'Beginner';
  }

  const title = doc.title.toLowerCase();
  let density = 'Study Concepts (40%), General Overview (30%), Exam Notes (30%)';
  if (title.includes('economic')) {
    density = 'Economic Growth (45%), Structural Indicators (30%), Policy Tools (25%)';
  }

  return {
    difficultyScore: score,
    topicDensity: density,
    estimatedExamWeightage: Math.min(95, Math.max(50, Math.floor(Math.random() * 25) + 65))
  };
}

function getMockEnhancements(flags: any): DocumentEnhancements {
  const mock: DocumentEnhancements = {};

  if (flags.objectives) {
    mock.learningObjectives = [
      'Understand the core theoretical concepts and terminology of the study material.',
      'Analyze relevant structures, tables, and images inside the document.',
      'Synthesize key insights and apply them to competitive exam questions.'
    ];
    mock.summary = 'This document covers the fundamental principles of the selected study topic. It provides structured examples, definitions, and contextual analysis, focusing on key elements, quantitative parameters, and high-yield scoring sections.';
  }

  if (flags.examConcepts) {
    mock.examConcepts = [
      {
        concept: 'Conceptual Definition',
        definition: 'The base parameters representing structural models or methodologies designed to answer primary questions.'
      },
      {
        concept: 'Key Theoretical Formula',
        definition: 'Calculations mapping density factors, efficiency ratios, or comparative variables.'
      }
    ];
  }

  if (flags.revisionNotes) {
    mock.commonMistakes = [
      {
        mistake: 'Confusing primary correlations with absolute causation.',
        correction: 'Ensure you verify the underlying baseline indicators rather than purely mapping trend charts.'
      },
      {
        mistake: 'Neglecting the minor columns or footnotes in quantitative tables.',
        correction: 'Always check column headers, notes, and bounds as they are frequently tested in MCQs.'
      }
    ];
  }

  if (flags.mcqs) {
    mock.mcqs = [
      {
        question: 'Which of the following best describes the core operational methodology of the analyzed concept?',
        options: [
          'A) Fast deterministic rendering with structured overrides',
          'B) Complete statistical extrapolation without historical guides',
          'C) Purely qualitative description of the data inputs',
          'D) Layout partitioning using randomized margins'
        ],
        correctOption: 'A',
        explanation: 'A structured layout separation guarantees deterministic rendering and separates layout rules from the AI text overlays.'
      }
    ];
    mock.interviewQuestions = [
      {
        question: 'What is the primary constraint of this methodology and how is it addressed?',
        answer: 'The primary constraint is whitespace preservation and layout overflow, which is resolved by separating the text-enhancement logic (AI layer) from Chrome\'s deterministic column rendering rules.'
      }
    ];
  }

  return mock;
}
