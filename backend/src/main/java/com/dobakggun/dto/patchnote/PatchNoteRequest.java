package com.dobakggun.dto.patchnote;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class PatchNoteRequest {

    @NotBlank(message = "버전을 입력해 주세요")
    @Size(max = 20)
    private String version;

    @NotBlank(message = "제목을 입력해 주세요")
    @Size(max = 200)
    private String title;

    @NotBlank(message = "내용을 입력해 주세요")
    private String content;

    @NotNull(message = "게임 카테고리를 선택해 주세요")
    private String game;
}
