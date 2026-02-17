import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  OPENAI_API_KEY: string
  OPENAI_MODEL: string
  APP_AUTH_TOKEN: string
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 설정
app.use('/api/*', cors())

// Health check
app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }))

// OCR proxy endpoint
app.post('/api/ocr-scorecard', async (c) => {
  try {
    // 1. 인증 토큰 확인 (설정된 경우)
    const configured = c.env.APP_AUTH_TOKEN
    if (configured) {
      const token = c.req.header('x-app-token')
      if (!token || token !== configured) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    }

    // 2. 요청 바디 데이터 확인
    const body = await c.req.json<{ imageData: string }>()
    const { imageData } = body || {}

    if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
      return c.json({ error: '유효한 이미지 데이터 URL이 필요합니다.' }, 400)
    }

    const base64 = imageData.split(',')[1] || ''
    if (base64.length < 100) {
      return c.json({ error: '이미지 데이터가 너무 작습니다.' }, 400)
    }
    if (base64.length > 6_000_000) {
      return c.json({ error: '이미지 용량은 최대 6MB까지 가능합니다.' }, 400)
    }

    // 3. API 키 확인
    const apiKey = c.env.OPENAI_API_KEY
    if (!apiKey) {
      return c.json({ error: 'Server missing OPENAI_API_KEY' }, 500)
    }

    // 4. OpenAI 페이로드 설정
    const instructions = '너는 골프 스코어카드 데이터 추출 전문가야. 이미지에서 정확하게 스코어를 읽어서 JSON 형식으로만 반환해.'
    const userText = `이미지에서 골프 스코어카드의 정보를 추출해줘.

중요: 이 스코어카드는 실제 타수가 아니라 PAR 대비 차이값(diffs)을 표시합니다.
- 빈칸(숫자 없음)=null
- 0=파
- 1=보기
- 2=더블보기
- 3=트리플보기
- -1 또는 버디 아이콘/하이라이트 = 버디
- -2 또는 이글 아이콘 = 이글

반드시 아래 JSON 구조로만 출력해:
{
  "players": ["이름1", "이름2", "이름3", "이름4"],
  "holes": [{"hole":1,"par":4,"diffs":[0,0,2,2]}, ... 18홀까지],
  "totals": [합계1, 합계2, 합계3, 합계4]
}`

    const model = c.env.OPENAI_MODEL || 'gpt-4o'

    // 5. OpenAI API 호출 (Chat Completions 표준 방식)
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: instructions },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: imageData } }
            ],
          },
        ],
        max_tokens: 2000,
        response_format: { type: "json_object" } // JSON 출력 강제
      }),
    })

    if (!openaiResp.ok) {
      const err = await openaiResp.text()
      return c.json({ error: 'OpenAI 요청 실패', detail: err.slice(0, 2000) }, 502)
    }

    const data: any = await openaiResp.json()
    
    // 6. 응답 데이터 추출 (choices 구조 사용)
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    if (!content) {
      return c.json({ error: 'AI로부터 응답 텍스트를 받지 못했습니다.', debug: JSON.stringify(data).slice(0, 2000) }, 502)
    }

    // 7. JSON 파싱
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      // 마크다운 코드 블록이 포함된 경우 정규식으로 정제
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return c.json({ error: 'JSON 파싱 실패', raw: content.slice(0, 1000) }, 500)
      }
      parsed = JSON.parse(jsonMatch[0])
    }

    return c.json(parsed)

  } catch (e: any) {
    return c.json({ error: '서버 에러 발생', detail: String(e?.message || e) }, 500)
  }
})

// 메인 HTML 페이지 서빙
app.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#0a2e1a">
  <title>Golf Settlement Pro</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link href="/static/styles.css" rel="stylesheet">
</head>
<body>
  <div id="app"></div>
  <script src="/static/app.js"></script>
</body>
</html>`
  return c.html(html)
})

export default app
