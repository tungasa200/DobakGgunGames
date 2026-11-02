package com.dobakggun.controller;

import com.dobakggun.dto.SessionStartRequest;
import com.dobakggun.dto.SudokuCompleteRequest;
import com.dobakggun.dto.SudokuCompleteResponse;
import com.dobakggun.dto.SudokuHintRequest;
import com.dobakggun.dto.SudokuHintResponse;
import com.dobakggun.dto.SudokuSessionStartResponse;
import com.dobakggun.service.SudokuService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 스도쿠 전용 컨트롤러.
 * "/api/sudoku/session/start" 리터럴 경로가
 * SessionController의 "/api/{game}/session/start" 보다 우선 매핑됨.
 */
@RestController
@RequiredArgsConstructor
public class SudokuController {

    private final SudokuService sudokuService;

    @PostMapping("/api/sudoku/session/start")
    public SudokuSessionStartResponse startSession(
            @Valid @RequestBody SessionStartRequest req,
            HttpServletRequest httpReq) {
        return sudokuService.createSession(req.getLevel(), httpReq);
    }

    @PostMapping("/api/sudoku/session/{sessionId}/hint")
    public SudokuHintResponse hint(
            @PathVariable String sessionId,
            @RequestBody SudokuHintRequest req,
            HttpServletRequest httpReq) {
        return sudokuService.hint(sessionId, req, httpReq);
    }

    @PostMapping("/api/sudoku/session/{sessionId}/complete")
    public SudokuCompleteResponse complete(
            @PathVariable String sessionId,
            @RequestBody SudokuCompleteRequest req,
            HttpServletRequest httpReq) {
        return sudokuService.complete(sessionId, req, httpReq);
    }
}
