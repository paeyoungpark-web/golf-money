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

// 1. JSON Schema 정의 (OpenAI Structured Outputs 용)
// AI가 반드시 이 구조로만 대답하도록 강제하는 '데이터 틀'입니다. 
const GOLF_SCHEMA = {
  name: "golf_scorecard",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      meta: {
        type: "object",
        additionalProperties: false,
        properties: {
          venue: { anyOf: [{ type: "string" }, { type: "null" }] },
          date: { anyOf: [{ type: "string" }, { type: "null" }] },
          tee_off: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["venue", "date", "tee_off"],
      },
      courses: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            pars: { type: "array", items: { type: "integer" } },
          },
          required: ["name", "pars"],
        },
      },
      players: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            diffs: {
              type: "array",
              items: {
                type: "array",
                items: { anyOf: [{ type: "integer" }, { type: "null" }] },
              },
            },
            printed_totals: {
              anyOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    front: { anyOf: [{ type: "integer" }, { type: "null" }] },
                    back: { anyOf: [{ type: "integer" }, { type: "null" }] },
                    total: { anyOf: [{ type: "integer" }, { type: "null" }] },
                  },
                  required: ["front", "back", "total"],
                },
                { type: "null" }
              ]
            }
          },
          required: ["name", "diffs", "printed_totals"],
        },
      },
    },
    required: ["meta", "courses", "players"],
  }
};

// 헬퍼 함수: 배열 합계 계산 
const sum = (arr: (number | null)[]) => arr.reduce((a: number, b) => a + (b || 0), 0);

// 리더보드 및 검증 로직 통합 
function computeLeaderboard(extracted: any) {
  const coursePars = extracted.courses.map((c: any) => c.pars);
  const parTotal = sum(coursePars[0]) + sum(coursePars[1]);

  const players = extracted.players.map((p: any) => {
    // 실제 타수 복원 (PAR + DIFF) 
    const scoresByCourse = p.diffs.map((diffs: (number | null)[], ci: number) =>
      diffs.map((d, hi) => (d === null ? null : coursePars[ci][hi] + d))
    );

    const totalsByCourse = scoresByCourse.map((scores: (number | null)[]) =>
      scores.includes(null) ? null : sum(scores)
    );

    const total = (totalsByCourse[0] === null || totalsByCourse[1] === null)
        ? null : totalsByCourse[0] + totalsByCourse[1];

    const overPar = total === null ? null : total - parTotal;

    // 카드 합계와 계산 합계 비교 
    const printed = p.printed_totals || { front: null, back: null, total: null };
    const mismatch = {
      front: printed.front !== null && totalsByCourse[0] !== null ? printed.front !== totalsByCourse[0] : null,
      back: printed.back !== null && totalsByCourse[1] !== null ? printed.back !== totalsByCourse[1] : null,
      total: printed.total !== null && total !== null ? printed.total !== total : null,
    };

    return {
      name: p.name,
      scores_by_course: scoresByCourse,
      totals_by_course: totalsByCourse,
      total,
      over_par: overPar,
      printed_totals: printed,
      mismatch,
    };
  });

  return { par_total: parTotal, players };
}

// 2. OCR API 엔드포인트
app.post('/api/ocr-scorecard', async (c) => {
  try {
    const apiKey = c.env.OPENAI_API_KEY;
    const model = "gpt-4o-2024-08-06"; // 스키마 기능을 완벽히 지원하는 최신 모델 고정 

    const body = await c.req.json<{ imageData: string }>();
    const { imageData } = body;

    const prompt = `너는 골프 스코어카드 OCR 전문가다. 
    1. 이미지에서 코스 정보, 홀별 PAR, 플레이어 이름, 그리고 스코어를 추출해라.
    2. 스코어는 반드시 PAR 대비 차이값(diff)으로 변환하여 정수(-1, 0, 1 등)로 입력해라. 
    3. 실제 타수가 적혀있다면 (타수 - PAR)를 계산해서 넣어라.
    4. 못 읽으면 null로 두어라.`.trim();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageData } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: GOLF_SCHEMA
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return c.json({ error: "OpenAI 호출 실패", detail: errorData }, 502);
    }

    const result: any = await response.json();
    const extracted = JSON.parse(result.choices[0].message.content);

    // 합계 및 불일치 검증 로직 적용 
    const computed = computeLeaderboard(extracted);

    return c.json({ extracted, computed });

  } catch (err: any) {
    return c.json({ error: "Server Error", message: err.message }, 500);
  }
});

app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

// 메인 HTML 페이지 서빙
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Golf Settlement Pro</title>
  <link href="/static/styles.css" rel="stylesheet">
</head>
<body>
  <div id="app"></div>
  <script src="/static/app.js"></script>
</body>
</html>`);
});

export default app
