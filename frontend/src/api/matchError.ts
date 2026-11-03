const MATCH_ERROR_MESSAGES: Record<string, string> = {
  MATCH_UNAVAILABLE: '일시적으로 매칭을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  ROOM_NOT_FOUND: '해당 방을 찾을 수 없습니다.',
  ROOM_FULL_OR_STARTED: '방이 가득 찼거나 이미 게임이 시작되었습니다.',
};

/** 매칭 API의 error에는 코드값과 한글 문구가 섞여 온다. 코드값은 그대로 보이지 않게 바꾼다. */
export function getMatchErrorMessage(error: string) {
  if (!/^[A-Z_]+$/.test(error)) return error;
  return MATCH_ERROR_MESSAGES[error] ?? '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}
