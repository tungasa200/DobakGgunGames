package com.dobakggun.util;

import com.dobakggun.config.R2Properties;
import lombok.RequiredArgsConstructor;
import org.owasp.html.AttributePolicy;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * OWASP Java HTML Sanitizer 기반 HTML 정화 유틸.
 *
 * 화이트리스트:
 *   태그: p, br, h2~h4, strong, b, em, i, u, s, ul, ol, li,
 *         blockquote, pre, code, hr, a, img, span, div
 *   a[href]: http/https 스킴만 허용
 *   a[rel]: 입력값 무시 — 후처리에서 "noopener noreferrer" 강제 주입 (BUG-02)
 *   img[src]: R2 publicUrl prefix로 시작하는 URL만 허용
 *   인라인 style 전면 제거, on* 이벤트 핸들러 전면 차단
 *   script/style/object/embed/base 등 금지 태그 텍스트 노드도 차단 (BUG-01)
 */
@Component
@RequiredArgsConstructor
public class HtmlSanitizer {

    private static final Pattern TIPTAP_CLASS =
            Pattern.compile("(ProseMirror-|tiptap-).*");

    private static final Pattern DIMENSION_VALUE =
            Pattern.compile("[0-9]+(px|%)?");

    private static final Pattern BLANK_TARGET =
            Pattern.compile("_blank");

    /**
     * 모든 <a> 태그에 rel="noopener noreferrer" 강제 삽입 (BUG-02).
     * - rel 속성이 없는 경우: 추가
     * - rel 속성이 이미 있는 경우: 덮어쓰기
     * target="_blank" 유무와 무관하게 적용 (방어 심화 원칙).
     */
    private static final Pattern A_TAG_WITHOUT_REL =
            Pattern.compile("<a\\b([^>]*?)(?:\\s+rel=\"[^\"]*\"|\\s+rel='[^']*')?(.*?)>",
                    Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private final R2Properties r2Properties;

    /**
     * HTML 문자열을 정화하여 반환한다.
     * null 또는 blank 입력은 그대로 반환.
     */
    public String sanitize(String rawHtml) {
        if (rawHtml == null || rawHtml.isBlank()) {
            return rawHtml;
        }

        final String r2PublicUrl = r2Properties.getPublicUrl();

        // img src: R2 URL 전용 AttributePolicy (null 반환 시 속성 제거)
        AttributePolicy imgSrcPolicy = new AttributePolicy() {
            @Override
            public String apply(String elementName, String attributeName, String value) {
                if (value == null) return null;
                String trimmed = value.trim();
                if (r2PublicUrl == null || r2PublicUrl.isBlank()) return null;
                return trimmed.startsWith(r2PublicUrl) ? trimmed : null;
            }
        };

        // a href: http/https만 허용 AttributePolicy
        AttributePolicy hrefPolicy = new AttributePolicy() {
            @Override
            public String apply(String elementName, String attributeName, String value) {
                if (value == null) return null;
                String lower = value.trim().toLowerCase();
                if (lower.startsWith("http://") || lower.startsWith("https://")) {
                    return value.trim();
                }
                return null;
            }
        };

        PolicyFactory policy = new HtmlPolicyBuilder()
                // URL 스킴 허용 (img src, a href 공통)
                .allowUrlProtocols("http", "https")
                // ── script/style 등 금지 태그의 텍스트 노드 차단 (BUG-01) ──
                // OWASP는 미허용 태그의 텍스트 콘텐츠를 기본 출력한다.
                // disallowTextIn으로 해당 태그 내부 텍스트도 제거.
                .disallowTextIn("script", "style", "noscript",
                        "object", "embed", "applet", "base",
                        "math", "xml", "svg")
                // ── 속성 없는 태그 ──────────────────────────────────────────
                .allowElements("p", "br", "h2", "h3", "h4",
                        "strong", "b", "em", "i", "u", "s",
                        "ul", "ol", "li",
                        "blockquote", "pre", "code", "hr",
                        "span", "div")
                // ── a 태그: href (http/https만), target ───────────────────
                // rel은 허용하지 않음 — 후처리에서 강제 삽입 (BUG-02)
                .allowElements("a")
                .allowAttributes("href").matching(hrefPolicy).onElements("a")
                .allowAttributes("target").matching(BLANK_TARGET).onElements("a")
                // ── img 태그: src (R2 URL만), alt, width, height ───────────
                .allowElements("img")
                .allowWithoutAttributes("img")
                .allowAttributes("src").matching(imgSrcPolicy).onElements("img")
                .allowAttributes("alt").onElements("img")
                .allowAttributes("width").matching(DIMENSION_VALUE).onElements("img")
                .allowAttributes("height").matching(DIMENSION_VALUE).onElements("img")
                // ── class (TipTap 생성 클래스만) ──────────────────────────
                .allowAttributes("class").matching(TIPTAP_CLASS).globally()
                .toFactory();

        String sanitized = policy.sanitize(rawHtml);

        // ── 후처리 1: src 없는 img 태그 제거 ─────────────────────────────
        // OWASP는 src 속성 차단 시 <img> 태그 자체는 남긴다.
        sanitized = sanitized.replaceAll("<img(?![^>]*\\bsrc=)[^>]*/?>", "");

        // ── 후처리 2: 모든 <a> 태그에 rel="noopener noreferrer" 강제 삽입 (BUG-02) ──
        // 입력자가 rel을 넣었어도 OWASP가 이미 제거했으므로, 여기서 무조건 추가.
        sanitized = sanitized.replaceAll(
                "(<a\\b[^>]*?)(/?>)",
                "$1 rel=\"noopener noreferrer\"$2"
        );

        return sanitized;
    }

    /**
     * sanitize 후 실제 텍스트 내용이 있는지 확인 (공백/태그만 남은 경우 empty 처리).
     */
    public boolean isEffectivelyEmpty(String sanitizedHtml) {
        if (sanitizedHtml == null || sanitizedHtml.isBlank()) return true;
        String textOnly = sanitizedHtml.replaceAll("<[^>]+>", "").trim();
        return textOnly.isEmpty();
    }
}
