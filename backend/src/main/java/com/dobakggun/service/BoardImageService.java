package com.dobakggun.service;

import com.dobakggun.config.R2Properties;
import com.dobakggun.exception.BoardErrorCode;
import com.dobakggun.exception.BoardException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BoardImageService {

    private static final long MAX_FILE_SIZE = 50L * 1024 * 1024; // 50MB

    /** MIME → 허용 확장자 목록 매핑 (교차 검증용) */
    private static final Map<String, Set<String>> MIME_TO_EXTENSIONS = Map.of(
            "image/jpeg", Set.of("jpg", "jpeg"),
            "image/png",  Set.of("png"),
            "image/gif",  Set.of("gif"),
            "image/webp", Set.of("webp")
    );

    private final S3Client s3Client;
    private final R2Properties r2Properties;

    /**
     * 이미지를 R2에 업로드하고 공개 URL을 반환한다.
     *
     * @param file    업로드할 파일
     * @param userId  현재 로그인 사용자 ID
     * @return R2 공개 URL
     */
    public String upload(MultipartFile file, Long userId) {
        validateBoardImage(file);

        String originalFilename = file.getOriginalFilename() != null
                ? file.getOriginalFilename() : "";
        String ext = extractExtension(originalFilename);
        LocalDate now = LocalDate.now();
        String key = String.format("board/%d/%d/%02d/%s.%s",
                userId, now.getYear(), now.getMonthValue(), UUID.randomUUID(), ext);

        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(r2Properties.getBucket())
                            .key(key)
                            .contentType(file.getContentType())
                            .contentLength(file.getSize())
                            .build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize())
            );
        } catch (IOException e) {
            throw new BoardException(BoardErrorCode.R2_UPLOAD_FAILED);
        } catch (Exception e) {
            throw new BoardException(BoardErrorCode.R2_UPLOAD_FAILED);
        }

        String publicUrl = r2Properties.getPublicUrl();
        if (publicUrl == null || publicUrl.isBlank()) {
            throw new IllegalStateException("R2_PUBLIC_URL 환경변수가 설정되지 않았습니다");
        }
        return publicUrl + "/" + key;
    }

    /**
     * 게시판 이미지 유효성 검사.
     * - null/empty 차단
     * - 50MB 이하
     * - MIME 화이트리스트 (jpeg/png/gif/webp)
     * - 확장자 화이트리스트
     * - MIME-확장자 교차 검증
     */
    public void validateBoardImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BoardException(BoardErrorCode.FILE_EMPTY);
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BoardException(BoardErrorCode.FILE_TOO_LARGE);
        }

        String mime = file.getContentType();
        if (mime == null || !MIME_TO_EXTENSIONS.containsKey(mime)) {
            throw new BoardException(BoardErrorCode.UNSUPPORTED_MIME);
        }

        String originalFilename = file.getOriginalFilename() != null
                ? file.getOriginalFilename() : "";
        String ext = extractExtension(originalFilename);
        boolean extAllowed = MIME_TO_EXTENSIONS.values().stream()
                .anyMatch(exts -> exts.contains(ext));
        if (!extAllowed) {
            throw new BoardException(BoardErrorCode.UNSUPPORTED_EXTENSION);
        }

        Set<String> allowedExtsForMime = MIME_TO_EXTENSIONS.get(mime);
        if (!allowedExtsForMime.contains(ext)) {
            throw new BoardException(BoardErrorCode.MIME_EXTENSION_MISMATCH);
        }
    }

    private String extractExtension(String filename) {
        int dotIdx = filename.lastIndexOf('.');
        if (dotIdx < 0 || dotIdx == filename.length() - 1) return "";
        return filename.substring(dotIdx + 1).toLowerCase();
    }
}
