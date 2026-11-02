package com.dobakggun.dto;

public record SudokuHintResponse(int row, int col, int value, int hintsLeft) {}
