package com.dobakggun.dto;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class SudokuCompleteRequest {
    private int[][] board;
}
