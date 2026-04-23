package com.dobakggun.exception;

import org.springframework.http.HttpStatus;

public enum BoardErrorCode {

    // 글 관련
    POST_NOT_FOUND(HttpStatus.NOT_FOUND, "글이 존재하지 않습니다"),
    NOT_POST_OWNER(HttpStatus.FORBIDDEN, "본인 글만 수정할 수 있습니다"),
    POST_TYPE_IMMUTABLE(HttpStatus.BAD_REQUEST, "글 양식은 변경할 수 없습니다"),
    INVALID_POST_TYPE(HttpStatus.BAD_REQUEST, "유효하지 않은 글 양식입니다"),
    TITLE_REQUIRED(HttpStatus.BAD_REQUEST, "제목을 입력해주세요"),
    CONTENT_EMPTY(HttpStatus.BAD_REQUEST, "본문 내용이 비어있습니다"),
    TOURNAMENT_FIELD_MISSING(HttpStatus.BAD_REQUEST, "대회기록 필수 항목이 누락되었습니다"),
    INVALID_GAME_KEY(HttpStatus.BAD_REQUEST, "유효하지 않은 게임입니다"),
    INVALID_DIFFICULTY_KEY(HttpStatus.BAD_REQUEST, "유효하지 않은 난이도입니다"),
    TOO_MANY_IMAGES(HttpStatus.BAD_REQUEST, "이미지는 최대 20장까지 삽입 가능합니다"),

    // 댓글 관련
    COMMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "댓글이 존재하지 않습니다"),
    COMMENT_POST_MISMATCH(HttpStatus.BAD_REQUEST, "해당 글의 댓글이 아닙니다"),
    COMMENT_CONTENT_EMPTY(HttpStatus.BAD_REQUEST, "댓글 내용을 입력해주세요"),
    COMMENT_TOO_LONG(HttpStatus.BAD_REQUEST, "댓글은 1000자 이하여야 합니다"),
    INVALID_CURSOR(HttpStatus.BAD_REQUEST, "유효하지 않은 커서 값입니다"),

    // 이미지 관련
    FILE_EMPTY(HttpStatus.BAD_REQUEST, "파일이 없습니다"),
    FILE_TOO_LARGE(HttpStatus.BAD_REQUEST, "파일 크기는 50MB 이하여야 합니다"),
    UNSUPPORTED_MIME(HttpStatus.BAD_REQUEST, "지원하지 않는 이미지 형식입니다"),
    UNSUPPORTED_EXTENSION(HttpStatus.BAD_REQUEST, "지원하지 않는 파일 확장자입니다"),
    MIME_EXTENSION_MISMATCH(HttpStatus.BAD_REQUEST, "파일 형식과 확장자가 일치하지 않습니다"),
    R2_UPLOAD_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "이미지 업로드에 실패했습니다");

    private final HttpStatus status;
    private final String message;

    BoardErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus getStatus() { return status; }
    public String getMessage() { return message; }
}
