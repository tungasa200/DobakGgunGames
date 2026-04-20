package com.dobakggun.dto.contact;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ContactReplyRequest {

    @NotBlank(message = "답변 내용을 입력해 주세요")
    @Size(max = 5000, message = "답변은 5000자 이하로 입력해 주세요")
    private String content;
}
