package com.dobakggun.controller;

import com.dobakggun.dto.SessionStartRequest;
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
}
