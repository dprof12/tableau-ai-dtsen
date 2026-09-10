import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { buildSystemPrompt, buildUserPrompt } from './prompts/dtsenPromptEngine.js';

/**
 * Serverless API Handler: Multi-Topic DTSEN Executive Insight Generator
 * Evaluates 5 Strategic Social Protection Perspectives (Overview, Desil, Wilayah, Integrasi, Anggaran)
 */
export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Please send a POST request.'
    });
  }

  try {
    const payload = req.body || {};
    const { language = 'id' } = payload;

    // 2. Read Environment Variables
    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();
    
    let apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      if (provider === 'openrouter') {
        apiKey = process.env.OPENROUTER_API_KEY;
      } else if (provider === 'openai') {
        apiKey = process.env.OPENAI_API_KEY;
      } else {
        apiKey = process.env.GEMINI_API_KEY;
      }
    }

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: `API Key untuk provider '${provider}' belum dikonfigurasi di Environment Variables.`
      });
    }

    // 3. Build Prompts
    const systemPrompt = buildSystemPrompt(language);
    const userPrompt = buildUserPrompt(payload);

    let rawJsonText = '';

    // 4. LLM Invocation
    if (provider === 'openrouter') {
      const modelName = process.env.AI_MODEL || 'openai/gpt-5.6-luna';
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://tableau-ai-dtsen.vercel.app',
          'X-Title': 'Tableau AI DTSEN Multi-Topic'
        }
      });

      const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      rawJsonText = completion.choices[0]?.message?.content || '{}';

    } else if (provider === 'openai') {
      const modelName = process.env.AI_MODEL || 'gpt-4o-mini';
      const openai = new OpenAI({ apiKey });

      const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      rawJsonText = completion.choices[0]?.message?.content || '{}';

    } else {
      // Default: Google Gemini Native SDK
      const modelName = process.env.AI_MODEL || 'gemini-2.5-flash';
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
      });

      const response = await result.response;
      rawJsonText = response.text();
    }

    // 5. Parse and Validate Multi-Topic JSON
    let parsedInsights = {};
    try {
      const cleanJson = rawJsonText.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
      parsedInsights = JSON.parse(cleanJson);
    } catch (parseError) {
      console.warn('[Tableau AI DTSEN] Failed to parse strict JSON from LLM, attempting fallback extraction:', parseError);
      parsedInsights = {
        overview: rawJsonText,
        desil: '*(Insight profil desil belum tersedia)*',
        wilayah: '*(Insight sebaran wilayah belum tersedia)*',
        integrasi: '*(Insight pola usia & multi-bansos belum tersedia)*',
        anggaran: '*(Insight alokasi anggaran belum tersedia)*',
        temuan: '*(Insight temuan & anomali belum tersedia)*'
      };
    }

    return res.status(200).json({
      success: true,
      insights: parsedInsights,
      meta: {
        provider,
        model: process.env.AI_MODEL || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Tableau AI DTSEN] Serverless handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Terjadi kesalahan pada backend serverless DTSEN.'
    });
  }
}
