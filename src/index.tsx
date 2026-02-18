import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = { OPENAI_API_KEY: string, OPENAI_MODEL: string }
const app = new Hono<{ Bindings: Bindings }>()
app.use('/api/*', cors())

app.post('/api/ocr-scorecard', async (c) => {
  try {
    const { imageData } = await c.req.json<{ imageData: string }>();
    const apiKey = c.env.OPENAI_API_KEY;

    const instructions = "너는 골프 스코어카드 데이터 추출 전문가야. 흑백 전처리된 이미지의 노이즈를 무시하고 숫자만 추출해.";
    const userText = `이 스코어카드 이미지에서 정보를 추출해서 JSON으로 응답해줘.

지침:
1. **노이즈 무시**: 숫자 주변의 나비, 꽃 모양 아이콘은 무시하고 배경의 '숫자'만 읽어.
2. **검증**: 카드 하단의 TOTAL 값과 각 홀 점수의 합계가 일치하도록 추론해서 보정해.
3. **형식**: 반드시 PAR 대비 차이(diffs) 값으로 변환해서 입력해. (버디=-1, 파=0, 보기=1)

구조:
{
  "players": ["이름1", "이름2", "이름3", "이름4"],
  "holes": [{ "hole": 1, "par": 4, "diffs": [0, 1, -1, 0] }, ...],
  "totals": [80, 85, 92, 88]
}`;

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: c.env.OPENAI_MODEL || 'gpt-4o',
        messages: [{ role: 'system', content: instructions }, { role: 'user', content: [{ type: 'text', text: userText }, { type: 'image_url', image_url: { url: imageData, detail: 'high' } }] }],
        response_format: { type: "json_object" }
      }),
    });

    const data: any = await openaiResp.json();
    return c.json(JSON.parse(data.choices[0].message.content));
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default app
