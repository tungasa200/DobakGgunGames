package com.dobakggun.exception;

import org.springframework.http.HttpStatus;

/** 서버 판정 게임(스도쿠·지뢰찾기) API 오류. 응답은 { error: 코드, message } 형식이다. */
public enum GamePlayErrorCode {

    SESSION_INVALID(HttpStatus.BAD_REQUEST, "유효하지 않은 세션입니다"),
    INVALID_CELL(HttpStatus.BAD_REQUEST, "유효하지 않은 입력입니다"),
    SESSION_NOT_CLEARED(HttpStatus.BAD_REQUEST, "클리어하지 않은 세션입니다"),
    GAME_ENDED(HttpStatus.CONFLICT, "이미 종료된 게임입니다"),
    HINT_EXHAUSTED(HttpStatus.CONFLICT, "힌트를 모두 사용했습니다"),
    SESSION_EXPIRED(HttpStatus.GONE, "세션이 만료되었습니다"),
    BOARD_INCORRECT(HttpStatus.UNPROCESSABLE_ENTITY, "정답이 아닙니다");

    private final HttpStatus status;
    private final String message;

    GamePlayErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getMessage() {
        return message;
    }
}
