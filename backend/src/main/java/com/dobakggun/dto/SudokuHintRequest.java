package com.dobakggun.dto;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class SudokuHintRequest {
    private Integer row;
    private Integer col;
}
