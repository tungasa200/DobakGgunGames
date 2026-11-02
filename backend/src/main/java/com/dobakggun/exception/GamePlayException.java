package com.dobakggun.exception;

public class GamePlayException extends RuntimeException {

    private final GamePlayErrorCode errorCode;

    public GamePlayException(GamePlayErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public GamePlayErrorCode getErrorCode() {
        return errorCode;
    }
}
