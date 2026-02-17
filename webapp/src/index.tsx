import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  OPENAI_API_KEY: string
  OPENAI_MODEL: string
  APP_AUTH_TOKEN: string
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS
app.use('/api/*', cors())

// Health check
app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }))

// OCR proxy endpoint
app.post('/api/ocr-scorecard', async (c) => {
  try {
    // Optional token auth
    const configured = c.env.APP_AUTH_TOKEN
    if (configured) {
      const token = c.req.header('x-app-token')
      if (!token || token !== configured) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    }

    const body = await c.req.json<{ imageData: string }>()
    const { imageData } = body || {}

    // Validate image data URL
    if (typeof imageData !== 'string') {
      return c.json({ error: 'imageData must be a string' }, 400)
    }
    if (!imageData.startsWith('data:image/')) {
      return c.json({ error: 'Only data:image/* data URLs allowed' }, 400)
    }
    const m = imageData.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i)
    if (!m) {
      return c.json({ error: 'Only png/jpeg/webp base64 data URLs allowed' }, 400)
    }
    const base64 = imageData.split(',')[1] || ''
    if (base64.length < 100) {
      return c.json({ error: 'Image payload too small' }, 400)
    }
    if (base64.length > 6_000_000) {
      return c.json({ error: 'Image payload too large (max 6MB)' }, 400)
    }

    const apiKey = c.env.OPENAI_API_KEY
    if (!apiKey) {
      return c.json({ error: 'Server missing OPENAI_API_KEY' }, 500)
    }

    const instructions =
      '너는 골프 스코어카드 데이터 추출 전문가야. 이미지에서 정확하게 스코어를 읽어서 JSON 형식으로만 반환해.'

    const userText = `이미지에서 골프 스코어카드의 정보를 추출해줘.

중요: 이 스코어카드는 실제 타수가 아니라 PAR 대비 차이값(diffs)을 표시합니다.
- 빈칸(숫자 없음)=null
- 0=파
- 1=보기
- 2=더블보기
- 3=트리플보기
- -1 또는 버디 아이콘/하이라이트 = 버디
- -2 또는 이글 아이콘 = 이글

반드시 아래 JSON만 출력:
{
  "players": ["...", "...", "...", "..."],
  "holes": [{"hole":1,"par":4,"diffs":[0,0,2,2]}, ... 18홀],
  "totals": [..4명..]
}`

    const model = c.env.OPENAI_MODEL || 'gpt-4o'

    const openaiResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: userText },
              { type: 'input_image', image_url: imageData },
            ],
          },
        ],
        max_output_tokens: 2000,
      }),
    })

    if (!openaiResp.ok) {
      const err = await openaiResp.text()
      return c.json({ error: 'OpenAI request failed', detail: err.slice(0, 2000) }, 502)
    }

    const data: any = await openaiResp.json()

    // Extract output_text (recursive walk)
    const texts: string[] = []
    const walk = (node: any): void => {
      if (!node) return
      if (node.type === 'message' && Array.isArray(node.content)) {
        for (const ct of node.content) {
          if (ct?.type === 'output_text' && typeof ct.text === 'string') texts.push(ct.text)
          if (ct?.type === 'refusal' && typeof ct.refusal === 'string') texts.push(`[REFUSAL] ${ct.refusal}`)
        }
      }
      if (node.type === 'output_text' && typeof node.text === 'string') texts.push(node.text)
      if (Array.isArray(node)) for (const x of node) walk(x)
      else if (typeof node === 'object') for (const k of Object.keys(node)) walk(node[k])
    }
    walk(data.output)

    const content = texts.join('\n').trim()
    if (!content) {
      return c.json({ error: 'No output_text from model', debug: JSON.stringify(data, null, 2).slice(0, 8000) }, 502)
    }

    // Parse JSON (handle code blocks)
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return c.json({ error: 'JSON parse failed', raw: content.slice(0, 2000) }, 500)
      }
      parsed = JSON.parse(jsonMatch[0])
    }

    return c.json(parsed)
  } catch (e: any) {
    return c.json({ error: 'Server error', detail: String(e?.message || e) }, 500)
  }
})

// Serve main page
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
