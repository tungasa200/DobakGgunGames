package com.dobakggun.controller;

import com.dobakggun.config.GamePlayExceptionHandler;
import com.dobakggun.config.GlobalExceptionHandler;
import com.dobakggun.service.MinesweeperPlayService;
import com.dobakggun.service.MinesweeperSessionService;
import com.dobakggun.service.SudokuService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.InvalidDefinitionException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 배열 자리에 문자열이 오면 Jackson이 정의 오류로 실패하는데, 이것도 요청 형식 오류다. */
class PlayRequestFormatTest {

    private final MockMvc mvc = MockMvcBuilders
        .standaloneSetup(
            new SudokuController(mock(SudokuService.class)),
            new MinesweeperController(mock(MinesweeperSessionService.class), mock(MinesweeperPlayService.class)))
        .setControllerAdvice(new GlobalExceptionHandler(), new GamePlayExceptionHandler())
        .build();

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "/api/sudoku/session/s/complete    | {\"board\":\"x\"}",
        "/api/sudoku/session/s/complete    | {\"board\":[\"x\"]}",
        "/api/minesweeper/session/s/reveal | {\"cells\":[\"x\"]}",
        "/api/minesweeper/session/s/reveal | {\"cells\":[[0,0]],\"flags\":[\"x\"]}",
    })
    void 배열_자리의_문자열은_400이다(String url, String body) throws Exception {
        mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("요청 형식이 올바르지 않습니다"));
    }

    /** 구현 타입을 알 수 없는 요청 DTO. 클라이언트가 고칠 수 없는 서버 결함이다. */
    interface BrokenRequest {
    }

    @Test
    void 요청_DTO_정의_결함은_500이다() {
        InvalidDefinitionException cause = catchThrowableOfType(InvalidDefinitionException.class,
            () -> new ObjectMapper().readValue("{}", BrokenRequest.class));

        var response = new GlobalExceptionHandler()
            .handleMessageConversion(new HttpMessageConversionException("읽기 실패", cause));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
