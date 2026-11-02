package com.dobakggun.config;

import com.dobakggun.exception.GamePlayException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * GlobalExceptionHandler의 RuntimeException 처리보다 먼저 잡아야 하므로 우선순위를 높인다.
 * 어드바이스끼리는 예외 타입의 구체성보다 순서가 먼저 적용된다.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice
public class GamePlayExceptionHandler {

    @ExceptionHandler(GamePlayException.class)
    public ResponseEntity<Map<String, String>> handle(GamePlayException e) {
        return ResponseEntity.status(e.getErrorCode().getStatus())
                .body(Map.of("error", e.getErrorCode().name(), "message", e.getMessage()));
    }
}
