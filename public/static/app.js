/* ========================================================
   Golf Settlement Pro — 최종 수정본 (전처리 강화)
   ======================================================== */

(function () {
  'use strict';

  const STATE = {
    players: ['플레이어1', '플레이어2', '플레이어3', '플레이어4'],
    amountPerStroke: 1000,
    inputMode: 'manual',
    isProcessing: false,
    ocrProgress: 0,
    scores: Array.from({ length: 18 }, (_, i) => ({
      hole: i + 1,
      par: [4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 5, 3, 4][i],
      scores: [0, 0, 0, 0],
      isDouble: false,
      nearest: false
    }))
  };

  // 이미지 전처리: 흑백 전환 및 고대비 적용 (나비 아이콘 노이즈 제거)
  async function preprocessImage(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          // Grayscale 변환
          const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // 고대비(Contrast) 적용 - 숫자를 검정색으로, 아이콘을 흐리게
          const contrast = 1.5; 
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          const newValue = factor * (avg - 128) + 128;
          data[i] = data[i+1] = data[i+2] = newValue;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  }

  async function processImageWithOCR(imageData) {
    STATE.isProcessing = true; STATE.ocrProgress = 10; render();
    try {
      const processed = await preprocessImage(imageData);
      STATE.ocrProgress = 30; render();

      const resp = await fetch('/api/ocr-scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: processed })
      });

      if (!resp.ok) throw new Error('서버 인식 실패');
      const result = await resp.json();

      if (result && result.holes) {
        STATE.players = result.players || STATE.players;
        // 18홀 데이터 매핑 (전/후반 통합 처리)
        result.holes.forEach((h, idx) => {
          if (idx < 18) {
            const par = h.par || STATE.scores[idx].par;
            STATE.scores[idx].par = par;
            STATE.scores[idx].scores = (h.diffs || [0,0,0,0]).map(d => par + (d || 0));
          }
        });
        updateDoubleStatus();
        STATE.inputMode = 'manual';
      }
    } catch (e) {
      alert("인식 중 오류 발생: " + e.message);
    } finally {
      STATE.isProcessing = false; render();
    }
  }

  function updateDoubleStatus() {
    STATE.scores.forEach(h => {
      const s = h.scores.filter(v => v > 0);
      h.isDouble = s.some(v => v <= h.par - 1) || // 버디 이상
                   (h.par >= 4 && s.some(v => v >= h.par + 3)) || // 트리플 이상
                   (h.par === 3 && s.some(v => v >= h.par + 2));   // 더블 이상
    });
  }

  // UI 렌더링 함수 등은 기존 로직을 유지하여 적용
  function render() { /* ... 기존 렌더링 코드 ... */ }
  window.render = render;
  document.addEventListener('DOMContentLoaded', render);
})();
