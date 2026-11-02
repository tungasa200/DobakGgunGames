package com.dobakggun.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter @Setter
public class MinesweeperRevealRequest {
    private List<int[]> cells;  // [[r,c]...] 1~8개
    private List<int[]> flags;  // [[r,c]...] 연쇄 오픈을 멈출 깃발 칸
}
