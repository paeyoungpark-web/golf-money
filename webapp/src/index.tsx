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

// 헬퍼 함수: 배열 합계
const sum = (arr: (number | null)[]) => arr.reduce((a: number, b) => a + (b || 0), 0);

// 리더보드 및 검증 로직 (전달받은 로직 통합)
function computeLeaderboard(extracted: any) {
  const coursePars = extracted.courses.map((c: any) => c.pars);
  const parTotal = sum(coursePars[0]) + sum(coursePars[1]);

  const players = extracted.players.map((p: any) => {
    // 코스별 실제 타수 계산 (PAR + DIFF)
    const scoresByCourse = p.diffs.map((diffs: (number | null)[], ci: number) =>
      diffs.map((d, hi) => (d === null ? null : coursePars[ci][hi] + d))
    );

    // 코스별 합계 계산
    const totalsByCourse = scoresByCourse.map((scores: (number | null)[]) =>
      scores.includes(null) ? null : sum(scores)
    );

    const total = (totalsByCourse[0] === null || totalsByCourse[1] === null)
        ? null : totalsByCourse[0] + totalsByCourse[1];

    const overPar = total === null ? null : total - parTotal;

    // 카드에 적힌 합계(printed_totals)와 계산된 합계 비교
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

  // 순위 결정
  const ranked = [...players].sort((a, b) => {
    if (a.total === null && b.total === null) return 0;
    if (a.total === null) return 1;
    if (b.total === null) return -1;
    return a.total - b.total;
  });

  ranked.forEach((p, idx) => { p.rank = idx + 1; });
  return { par_total: parTotal, players: ranked };
}

// 1. JSON Schema 정의 (OpenAI Structured Outputs 용)
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

// 2. OCR API 엔드포인트
app.post('/api/ocr-scorecard', async (c) => {
  try {
    const apiKey = c.env.OPENAI_API_KEY;
    const model = c.env.OPENAI_MODEL || "gpt-4o-2024-08-06"; // 스키마 지원 모델 권장

    const body = await c.req.json<{ imageData: string }>();
    const { imageData } = body;

    const prompt = `너는 골프 스코어카드 OCR 파서다. 
    - 코스 이름, 홀별 PAR, 플레이어 이름, PAR 대비 DIFF(±)를 추출해라.
    - DIFF는 정수(예: -1, 0, 1)로 반환하고 못 읽으면 null로 두어라.
    - 카드에 적힌 합계(printed_totals)가 있으면 추출해라.`;

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

    // 합계 및 순위 자동 계산 로직 적용
    const computed = computeLeaderboard(extracted);

    return c.json({
      extracted,
      computed, // 계산된 타수와 불일치 검증 결과 포함
    });

  } catch (err: any) {
    return c.json({ error: "Server Error", message: err.message }, 500);
  }
});

app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

// 메인 페이지 서빙
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html><html>... (기존 HTML 코드) ...</html>`);
});

export default app
