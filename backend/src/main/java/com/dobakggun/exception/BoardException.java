package com.dobakggun.exception;

public class BoardException extends RuntimeException {

    private final BoardErrorCode errorCode;

    public BoardException(BoardErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public BoardErrorCode getErrorCode() {
        return errorCode;
    }
}
