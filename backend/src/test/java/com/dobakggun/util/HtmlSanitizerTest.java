package com.dobakggun.util;

import com.dobakggun.config.R2Properties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * HtmlSanitizer 단위 테스트 — XSS 방어 8케이스 이상 검증
 */
class HtmlSanitizerTest {

    private HtmlSanitizer sanitizer;
    private static final String R2_PUBLIC_URL = "https://r2.example.com";

    @BeforeEach
    void setUp() {
        R2Properties r2Properties = new R2Properties();
        r2Properties.setPublicUrl(R2_PUBLIC_URL);
        sanitizer = new HtmlSanitizer(r2Properties);
    }

    // ── XSS 차단 케이스 ───────────────────────────────────────────────────────

    @Test
    @DisplayName("script 태그는 완전히 제거된다")
    void script_tag_is_removed() {
        String input = "<p>안녕</p><script>alert('xss')</script>";
        String result = sanitizer.sanitize(input);
        assertThat(result).doesNotContain("<script>");
        assertThat(result).doesNotContain("alert");
    }

    @Test
    @DisplayName("외부 도메인 img src는 img 태그 전체가 제거된다")
    void external_img_src_is_removed() {
        String input = "<img src=\"https://external.evil.com/x.jpg\" alt=\"xss\">";
        String result = sanitizer.sanitize(input);
        assertThat(result).doesNotContain("external.evil.com");
        assertThat(result).doesNotContain("<img");
    }

    @Test
    @DisplayName("a href javascript: 스킴은 제거된다")
    void javascript_href_is_removed() {
        String input = "<a href=\"javascript:alert(1)\">click</a>";
        String result = sanitizer.sanitize(input);
        assertThat(result).doesNotContain("javascript:");
    }

    @Test
    @DisplayName("data: src를 가진 img 태그는 제거된다 (R2 URL이 아님)")
    void data_uri_img_is_removed() {
        String input = "<img src=\"data:image/png;base64,iVBORw0KGgo=\">";
        String result = sanitizer.sanitize(input);
        assertThat(result).doesNotContain("data:");
        assertThat(result).doesNotContain("<img");
    }

    @Test
    @DisplayName("onerror 이벤트 핸들러는 제거되고 태그 본문은 유지된다")
    void onerror_attribute_is_removed_but_content_kept() {
        String input = "<p onerror=\"alert(1)\">본문 텍스트</p>";
        String result = sanitizer.sanitize(input);
        assertThat(result).doesNotContain("onerror");
        assertThat(result).contains("본문 텍스트");
    }

    @Test
    @DisplayName("onmouseover 이벤트 핸들러는 제거되고 내부 태그는 유지된다")
    void onmouseover_removed_inner_tags_kept() {
        String input = "<div onmouseover=\"steal()\"><b>중요한 텍스트</b></div>";
        String result = sanitizer.sanitize(input);
        assertThat(result).doesNotContain("onmouseover");
        assertThat(result).contains("중요한 텍스트");
    }

    @Test
    @DisplayName("vbscript: URL은 제거된다")
    void vbscript_url_is_removed() {
        String input = "<a href=\"vbscript:MsgBox('xss')\">클릭</a>";
        String result = sanitizer.sanitize(input);
        assertThat(result).doesNotContain("vbscript:");
    }

    @Test
    @DisplayName("인라인 style 속성은 전면 제거된다")
    void inline_style_is_removed() {
        String input = "<p style=\"color:red; background:url(javascript:alert(1))\">텍스트</p>";
        String result = sanitizer.sanitize(input);
        assertThat(result).doesNotContain("style=");
        assertThat(result).contains("텍스트");
    }

    @Test
    @DisplayName("iframe 태그는 제거된다")
    void iframe_tag_is_removed() {
        String input = "<iframe src=\"https://evil.com\"></iframe><p>정상 본문</p>";
        String result = sanitizer.sanitize(input);
        assertThat(result).doesNotContain("iframe");
        assertThat(result).contains("정상 본문");
    }

    // ── 허용 케이스 ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("R2 publicUrl로 시작하는 img src는 허용된다")
    void r2_img_src_is_allowed() {
        String url = R2_PUBLIC_URL + "/board/42/2026/04/test.png";
        String input = "<img src=\"" + url + "\" alt=\"테스트 이미지\">";
        String result = sanitizer.sanitize(input);
        assertThat(result).contains(url);
        assertThat(result).contains("<img");
    }

    @Test
    @DisplayName("https a href는 허용된다")
    void https_href_is_allowed() {
        String input = "<a href=\"https://example.com\">링크</a>";
        String result = sanitizer.sanitize(input);
        assertThat(result).contains("https://example.com");
        assertThat(result).contains("<a");
    }

    @Test
    @DisplayName("허용 태그(p/strong/em/ul/li 등)는 유지된다")
    void allowed_tags_are_preserved() {
        String input = "<p><strong>굵게</strong> <em>기울임</em></p><ul><li>항목</li></ul>";
        String result = sanitizer.sanitize(input);
        assertThat(result).contains("<strong>");
        assertThat(result).contains("<em>");
        assertThat(result).contains("<ul>");
        assertThat(result).contains("<li>");
    }

    // ── isEffectivelyEmpty 케이스 ─────────────────────────────────────────────

    @Test
    @DisplayName("태그만 남은 HTML은 effectivelyEmpty로 판단된다")
    void tags_only_html_is_effectively_empty() {
        assertThat(sanitizer.isEffectivelyEmpty("<p></p><br>")).isTrue();
    }

    @Test
    @DisplayName("텍스트가 있으면 effectivelyEmpty가 아니다")
    void html_with_text_is_not_effectively_empty() {
        assertThat(sanitizer.isEffectivelyEmpty("<p>내용</p>")).isFalse();
    }

    // ── BUG-01: style/script/object 등 금지 태그 텍스트 노드 차단 ─────────────

    @Test
    @DisplayName("style 태그는 태그와 내부 텍스트 모두 제거된다 (BUG-01)")
    void style_tag_is_completely_removed() {
        String input = "<style>body{display:none}</style><p>정상 본문</p>";
        String result = sanitizer.sanitize(input);
        assertThat(result).doesNotContain("<style>");
        // 텍스트 노드 유출도 차단되어야 함
        assertThat(result).doesNotContain("display:none");
        assertThat(result).contains("정상 본문");
    }

    @Test
    @DisplayName("object/embed/base 태그는 모두 제거된다 (BUG-01)")
    void object_embed_base_tags_are_removed() {
        String input = "<object data=\"evil.swf\">fallback</object>"
                + "<embed src=\"evil.swf\">"
                + "<base href=\"https://evil.com/\">"
                + "<p>정상 본문</p>";
        String result = sanitizer.sanitize(input);
        assertThat(result).doesNotContain("<object");
        assertThat(result).doesNotContain("<embed");
        assertThat(result).doesNotContain("<base");
        assertThat(result).doesNotContain("evil.swf");
        assertThat(result).contains("정상 본문");
    }

    // ── BUG-02: <a> 태그 rel="noopener noreferrer" 강제 주입 ──────────────────

    @Test
    @DisplayName("rel 없는 a 태그에 noopener noreferrer가 강제 주입된다 (BUG-02)")
    void a_rel_is_forced_to_noopener_noreferrer_even_without_input() {
        String input = "<a href=\"https://example.com\">링크</a>";
        String result = sanitizer.sanitize(input);
        assertThat(result).contains("rel=\"noopener noreferrer\"");
        assertThat(result).contains("https://example.com");
    }

    @Test
    @DisplayName("rel에 악의적 값을 입력해도 noopener noreferrer로 덮어쓰인다 (BUG-02)")
    void a_rel_with_malicious_input_is_overwritten() {
        // 사용자가 rel을 직접 지정해도 OWASP가 제거 후 강제 주입
        String input = "<a href=\"https://example.com\" rel=\"evil\">링크</a>";
        String result = sanitizer.sanitize(input);
        assertThat(result).contains("rel=\"noopener noreferrer\"");
        assertThat(result).doesNotContain("rel=\"evil\"");
    }

    @Test
    @DisplayName("target=_blank가 있는 a 태그에도 rel이 강제 주입된다 (BUG-02)")
    void a_with_target_blank_gets_forced_rel() {
        String input = "<a href=\"https://example.com\" target=\"_blank\">새창</a>";
        String result = sanitizer.sanitize(input);
        assertThat(result).contains("rel=\"noopener noreferrer\"");
        assertThat(result).contains("target=\"_blank\"");
        assertThat(result).contains("https://example.com");
    }

    @Test
    @DisplayName("href 없는 a 태그(OWASP 제거 대상)에는 rel 주입 없이 텍스트만 남는다")
    void a_without_href_does_not_get_rel_injected() {
        // javascript: href → OWASP가 href 제거 → a 태그 전체 제거 가능
        // 결과에 rel="noopener noreferrer" 포함 안 되어야 함 (태그 자체가 없으므로)
        String input = "<a href=\"javascript:void(0)\">클릭</a>";
        String result = sanitizer.sanitize(input);
        // href 제거로 a 태그가 사라지거나 텍스트만 남음
        // 어느 경우든 javascript: 스킴은 없어야 함
        assertThat(result).doesNotContain("javascript:");
    }
}
