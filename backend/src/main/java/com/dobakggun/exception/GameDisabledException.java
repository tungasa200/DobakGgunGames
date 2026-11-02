package com.dobakggun.exception;

/** 킬스위치로 꺼진 게임의 시작 요청. 응답은 GlobalExceptionHandler가 503 + GAME_DISABLED로 만든다. */
public class GameDisabledException extends RuntimeException {

    public static final String CODE = "GAME_DISABLED";
    public static final String USER_MESSAGE = "현재 이용할 수 없는 게임입니다.";

    public GameDisabledException(String gameKey) {
        super("Game disabled: " + gameKey);
    }
}
