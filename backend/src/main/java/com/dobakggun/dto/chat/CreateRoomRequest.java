package com.dobakggun.dto.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class CreateRoomRequest {

    @NotBlank(message = "방 이름을 입력해주세요.")
    @Size(max = 30, message = "방 이름은 30자를 넘을 수 없습니다.")
    private String name;
}
