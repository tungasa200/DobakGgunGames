package com.dobakggun.config;

import com.dobakggun.exception.BoardException;
import com.dobakggun.exception.GameDisabledException;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.exc.InvalidDefinitionException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BoardException.class)
    public ResponseEntity<Map<String, String>> handleBoardException(BoardException e) {
        return ResponseEntity.status(e.getErrorCode().getStatus())
                .body(Map.of("error", e.getErrorCode().name(), "message", e.getMessage()));
    }

    @ExceptionHandler(GameDisabledException.class)
    public ResponseEntity<Map<String, String>> handleGameDisabled(GameDisabledException e) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", GameDisabledException.USER_MESSAGE, "code", GameDisabledException.CODE));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("error", e.getReason() != null ? e.getReason() : e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .orElse("입력값 오류");
        return ResponseEntity.badRequest().body(Map.of("error", msg));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleMessageNotReadable(HttpMessageNotReadableException e) {
        String msg = e.getMessage();
        if (msg != null && msg.contains("not one of the values accepted for Enum class")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid enum value in request body"));
        }
        return ResponseEntity.badRequest().body(Map.of("error", "요청 형식이 올바르지 않습니다"));
    }

    /**
     * 배열 자리에 문자열이 오면 Jackson이 InvalidDefinitionException을 던지고,
     * Spring은 이를 HttpMessageNotReadableException이 아닌 상위 타입으로 감싼다.
     * 응답 직렬화 실패와 요청 DTO 정의 결함도 같은 타입이므로
     * 요청을 읽던 중 배열에서 실패했을 때만 400으로 돌린다.
     */
    @ExceptionHandler(HttpMessageConversionException.class)
    public ResponseEntity<Map<String, String>> handleMessageConversion(HttpMessageConversionException e) {
        if (e.getCause() instanceof InvalidDefinitionException cause && cause.getProcessor() instanceof JsonParser
                && cause.getType() != null && cause.getType().isArrayType()) {
            log.warn("[MessageConversion] {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", "요청 형식이 올바르지 않습니다"));
        }
        return handleRuntime(e);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntime(RuntimeException e) {
        String msg = e.getMessage();
        if (msg != null && msg.startsWith("이메일 발송 실패")) {
            log.error("[EmailService] {}", msg, e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요"));
        }
        log.error("[RuntimeException] {}", msg, e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "서버 오류가 발생했습니다"));
    }
}
