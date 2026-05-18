// ── Block Crush — 폴리오미노 정의 (18종) ────────────────────
// PRD §4.3 기준 — 회전 변형 포함 사전 정의, 런타임 회전 없음
// 색상: designer 명세 도착 전 임시 배정 (--bcr-* CSS 변수로 교체 예정)

import type { Piece } from './types';

// Fisher-Yates 셔플 (in-place)
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const PIECES: Piece[] = [
  // 1셀
  {
    id: 'DOT_1',
    shape: [[0, 0]],
    color: '#6EE7B7', // 에메랄드 계열
  },

  // 2셀 가로
  {
    id: 'I_2_H',
    shape: [[0, 0], [0, 1]],
    color: '#60A5FA', // 파란 계열
  },

  // 2셀 세로
  {
    id: 'I_2_V',
    shape: [[0, 0], [1, 0]],
    color: '#60A5FA',
  },

  // 3셀 가로
  {
    id: 'I_3_H',
    shape: [[0, 0], [0, 1], [0, 2]],
    color: '#A78BFA', // 보라 계열
  },

  // 3셀 세로
  {
    id: 'I_3_V',
    shape: [[0, 0], [1, 0], [2, 0]],
    color: '#A78BFA',
  },

  // 4셀 가로
  {
    id: 'I_4_H',
    shape: [[0, 0], [0, 1], [0, 2], [0, 3]],
    color: '#F472B6', // 핑크 계열
  },

  // 4셀 세로
  {
    id: 'I_4_V',
    shape: [[0, 0], [1, 0], [2, 0], [3, 0]],
    color: '#F472B6',
  },

  // 5셀 가로
  {
    id: 'I_5_H',
    shape: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
    color: '#FB923C', // 오렌지 계열
  },

  // 5셀 세로
  {
    id: 'I_5_V',
    shape: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    color: '#FB923C',
  },

  // 2×2 정사각형
  {
    id: 'SQ_2',
    shape: [[0, 0], [0, 1], [1, 0], [1, 1]],
    color: '#FBBF24', // 황금 계열
  },

  // 3×3 정사각형 (9셀)
  {
    id: 'SQ_3',
    shape: [
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2],
      [2, 0], [2, 1], [2, 2],
    ],
    color: '#F87171', // 빨강 계열
  },

  // ┘ 좌상 꺾임 (L_TL)
  {
    id: 'L_TL',
    shape: [[0, 0], [1, 0], [1, 1]],
    color: '#34D399', // 초록 계열
  },

  // └ 우상 꺾임 (L_TR)
  {
    id: 'L_TR',
    shape: [[0, 1], [1, 0], [1, 1]],
    color: '#34D399',
  },

  // ┐ 좌하 꺾임 (L_BL)
  {
    id: 'L_BL',
    shape: [[0, 0], [0, 1], [1, 0]],
    color: '#34D399',
  },

  // ┌ 우하 꺾임 (L_BR)
  {
    id: 'L_BR',
    shape: [[0, 0], [0, 1], [1, 1]],
    color: '#34D399',
  },

  // T자 (4셀)
  {
    id: 'T_4',
    shape: [[0, 0], [0, 1], [0, 2], [1, 1]],
    color: '#818CF8', // 인디고 계열
  },

  // S자 (4셀)
  {
    id: 'S_4',
    shape: [[0, 1], [0, 2], [1, 0], [1, 1]],
    color: '#2DD4BF', // 시안 계열
  },

  // Z자 (4셀)
  {
    id: 'Z_4',
    shape: [[0, 0], [0, 1], [1, 1], [1, 2]],
    color: '#2DD4BF',
  },
];

/**
 * Fisher-Yates 셔플로 18종 중 중복 없이 count개 추출
 */
export function getRandomPieces(count: number): Piece[] {
  const shuffled = shuffleArray(PIECES);
  return shuffled.slice(0, count);
}
