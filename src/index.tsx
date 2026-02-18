import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono<{ Bindings: { OPENAI_API_KEY: string } }>()
app.use('/api/*', cors())

app.post('/api/ocr-scorecard', async (c) => {
  const { imageData } = await c.req.json();
  
  const prompt = `너는 골프 스코어카드 분석 전문가야. 
  제공된 이미지는 흑백 처리된 스코어카드야. 다음 지침을 엄격히 따라줘:
  
  1. **아이콘 해석**: 숫자 위에 나비나 꽃 모양 아이콘이 있다면 그 값은 무조건 -1(버디)이야.
  2. **값 추출**: 각 칸에 적힌 숫자를 읽어. 0은 Par, 1은 보기, 2는 더블보기야. 
     (이미지에서 숫자가 마이너스(-)처럼 보여도 0 이상의 숫자인 경우가 많으니 주의해)
  3. **검증**: 카드 하단의 'TOTAL' 행에 적힌 숫자와 네가 읽은 각 홀 점수의 합계가 일치하는지 반드시 검산해. 일치하지 않으면 개별 홀 점수를 다시 판독해.
  4. **응답**: 반드시 아래 JSON 구조로 응답해. 'diffs'는 Par 대비 타수 차이야.
  
  {
    "players": ["이름1", "이름2", "이름3", "이름4"],
    "holes": [
      { "hole": 1, "par": 4, "diffs": [0, -1, 2, 2] },
      ... 18번홀까지
    ],
    "totals": [85, 83, 112, 102]
  }`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageData, detail: "high" } }] }],
      response_format: { type: "json_object" }
    })
  });

  const resData: any = await response.json();
  return c.json(JSON.parse(resData.choices[0].message.content));
});

export default app
