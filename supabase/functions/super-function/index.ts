import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CHAT_SYSTEM = `คุณคือ “น้องชวนคิด” ผู้ช่วยการเรียนรู้สำหรับนักเรียนชั้นมัธยมศึกษาปีที่ 4 ในประเทศไทย
ขอบเขตคือความรู้เท่าทัน AI: ความหมายและข้อจำกัดของ AI, การเลือกใช้เครื่องมือ, การเขียนพรอมต์, การตรวจคำตอบและแหล่งข้อมูล, อคติ, Hallucination, ลิขสิทธิ์, ความซื่อสัตย์, ข้อมูลส่วนบุคคล, จริยธรรม และภารกิจในเว็บแอป
ตอบภาษาไทย สุภาพ เป็นกันเอง กระชับ ไม่เกิน 5 ประโยค ชวนคิดแบบโสเครติส และไม่เฉลยคำตอบข้อสอบตรง ๆ
หากคำถามนอกเรื่อง ให้ตอบสั้น ๆ ว่าช่วยได้เฉพาะเรื่องในบทเรียน AI แล้วชวนกลับมาถามเรื่องบทเรียน`;

const PROMPT_SYSTEM = `คุณคือครูผู้เชี่ยวชาญการสอนเขียนพรอมต์ AI ให้นักเรียนมัธยมศึกษาปีที่ 4 ชาวไทย
ประเมินตาม 4 ส่วน: ระบุบทบาท, งานชัดเจน, มีบริบทหรือรายละเอียด, และกำหนดรูปแบบผลลัพธ์
ตอบเป็น JSON ล้วนเท่านั้น รูปแบบ:
{"score":0,"good":["จุดเด่น"],"improve":["สิ่งที่ควรปรับ"],"better":"ตัวอย่างพรอมต์ที่ปรับแล้ว"}
score ต้องเป็นจำนวนเต็ม 0 ถึง 10; good และ improve อย่างละ 1 ถึง 3 ข้อ เป็นภาษาไทย`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function text(value: unknown, max = 2000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function askGemini(system: string, messages: Array<{ role: string; content: string }>, maxTokens: number, jsonMode = false) {
  // ANTHROPIC_API_KEY รองรับชั่วคราว เพื่อให้คีย์ Gemini ที่บันทึกไว้ก่อนหน้านี้ยังใช้ได้
  const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("Gemini_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Gemini API key has not been configured");
  const preferred = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const models = [...new Set([preferred, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"])];
  let response: Response | null = null;
  for (const model of models) {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.35,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
    if (response.ok || response.status !== 404) break;
  }
  if (!response || !response.ok) throw new Error(`Gemini API ${response ? response.status : "unavailable"}`);
  const data = await response.json();
  const answer = (data.candidates?.[0]?.content?.parts || [])
    .map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();
  if (!answer) throw new Error("Empty AI response");
  return answer;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await request.json();
    if (body.action === "chat") {
      const messages = Array.isArray(body.messages) ? body.messages.slice(-10).map((message: unknown) => {
        const item = message as { role?: string; content?: string };
        return {
          role: item.role === "assistant" ? "assistant" : "user",
          content: text(item.content, 900),
        };
      }).filter((message: { content: string }) => !!message.content) : [];
      if (!messages.length) return json({ error: "No message" }, 400);
      return json({ reply: await askGemini(CHAT_SYSTEM, messages, 500) });
    }

    if (body.action === "prompt_check") {
      const mission = text(body.mission, 700);
      const prompt = text(body.text, 2000);
      if (!prompt) return json({ error: "No prompt" }, 400);
      const answer = await askGemini(PROMPT_SYSTEM, [{
        role: "user",
        content: `โจทย์: ${mission}\n\nพรอมต์ของนักเรียน: """${prompt}"""`,
      }], 900, true);
      const clean = answer.replace(/```json|```/g, "").trim();
      const match = clean.match(/\{[\s\S]*\}/);
      const result = JSON.parse(match ? match[0] : clean);
      return json({ result });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message.slice(0, 120) : "Unknown error";
    return json({ error: "AI request failed", detail }, 502);
  }
});
