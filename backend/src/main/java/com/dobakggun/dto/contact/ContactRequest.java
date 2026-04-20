package com.dobakggun.dto.contact;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ContactRequest {

    @NotBlank(message = "문의 유형을 선택해 주세요")
    private String category;

    @NotBlank(message = "제목을 입력해 주세요")
    @Size(max = 100, message = "제목은 100자 이하로 입력해 주세요")
    private String subject;

    @NotBlank(message = "내용을 입력해 주세요")
    @Size(max = 3000, message = "내용은 3000자 이하로 입력해 주세요")
    private String body;
}
