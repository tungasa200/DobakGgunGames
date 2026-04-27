import type { Player, ChatMessage } from './types';

export const INITIAL_PLAYERS: Player[] = [
  { id: 'p0', name: '김민준', role: 'police',  alive: true, isMe: true,  seat: 0 },
  { id: 'p1', name: '이서연', role: 'mafia',   alive: true, isMe: false, seat: 1 },
  { id: 'p2', name: '박지호', role: 'doctor',  alive: true, isMe: false, seat: 2 },
  { id: 'p3', name: '최유나', role: 'citizen', alive: true, isMe: false, seat: 3 },
  { id: 'p4', name: '정도윤', role: 'mafia',   alive: true, isMe: false, seat: 4 },
  { id: 'p5', name: '강하은', role: 'citizen', alive: true, isMe: false, seat: 5 },
  { id: 'p6', name: '윤시우', role: 'citizen', alive: true, isMe: false, seat: 6 },
  { id: 'p7', name: '임채원', role: 'citizen', alive: true, isMe: false, seat: 7 },
];

export const MOCK_DAY_MESSAGES: ChatMessage[] = [
  { playerId: 'p1', text: '저 진짜 시민이에요. 왜 저를 의심하시는 거죠?', timestamp: 0, isMafia: false },
  { playerId: 'p3', text: '어젯밤에 p4가 수상하게 움직이는 걸 봤어요.', timestamp: 1, isMafia: false },
  { playerId: 'p4', text: '무슨 소리예요? 저는 아무것도 안 했는데요.', timestamp: 2, isMafia: false },
  { playerId: 'p2', text: '일단 냉정하게 생각해봅시다. 단서를 찾아야죠.', timestamp: 3, isMafia: false },
  { playerId: 'p5', text: '경찰 계신가요? 조사 결과 공유해주세요.', timestamp: 4, isMafia: false },
  { playerId: 'p6', text: '저는 p1이 계속 말을 돌리는 게 이상한 것 같아요.', timestamp: 5, isMafia: false },
  { playerId: 'p7', text: '다들 침착하게요. 섣불리 투표하면 안 됩니다.', timestamp: 6, isMafia: false },
  { playerId: 'p3', text: '그래도 누군가는 지목해야 하잖아요...', timestamp: 7, isMafia: false },
];

export const MOCK_NIGHT_MAFIA_MESSAGES: ChatMessage[] = [
  { playerId: 'p1', text: '오늘 밤 타겟은 p3으로 하죠.', timestamp: 0, isMafia: true },
  { playerId: 'p4', text: '맞아요. p3가 우리 의심하고 있어요.', timestamp: 1, isMafia: true },
  { playerId: 'p1', text: '조심해요. 경찰이 있을 수 있어요.', timestamp: 2, isMafia: true },
];
