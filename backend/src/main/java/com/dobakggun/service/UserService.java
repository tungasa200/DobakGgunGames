package com.dobakggun.service;

import com.dobakggun.config.R2Properties;
import com.dobakggun.dto.user.NicknameUpdateRequest;
import com.dobakggun.dto.user.UserProfileResponse;
import com.dobakggun.entity.User;
import com.dobakggun.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final int PROFILE_IMAGE_SIZE = 256;
    private static final String PROFILE_IMAGE_PREFIX = "profiles/";

    private final UserRepository userRepository;
    private final S3Client s3Client;
    private final R2Properties r2Properties;

    // 내 정보 조회
    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(Long userId) {
        User user = findUser(userId);
        return UserProfileResponse.from(user);
    }

    // 닉네임 변경
    @Transactional
    public UserProfileResponse updateNickname(Long userId, NicknameUpdateRequest req) {
        User user = findUser(userId);
        String newNickname = req.getNickname();

        if (!newNickname.equals(user.getNickname()) && userRepository.existsByNickname(newNickname)) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다");
        }
        validateNickname(newNickname);

        user.setNickname(newNickname);
        return UserProfileResponse.from(user);
    }

    // 프로필 사진 업로드
    @Transactional
    public UserProfileResponse uploadProfileImage(Long userId, MultipartFile file) throws IOException {
        validateImageFile(file);
        User user = findUser(userId);

        // 기존 사진 삭제
        deleteExistingProfileImage(user);

        // 256×256 리사이징 후 R2 업로드
        byte[] resized = resizeImage(file);
        String key = PROFILE_IMAGE_PREFIX + userId + "/" + UUID.randomUUID() + ".jpg";

        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(r2Properties.getBucket())
                        .key(key)
                        .contentType("image/jpeg")
                        .contentLength((long) resized.length)
                        .build(),
                RequestBody.fromBytes(resized)
        );

        String publicUrl = r2Properties.getPublicUrl();
        if (publicUrl == null || publicUrl.isBlank()) {
            throw new IllegalStateException("R2_PUBLIC_URL 환경변수가 설정되지 않았습니다");
        }
        String imageUrl = publicUrl + "/" + key;
        user.setProfileImage(imageUrl);
        return UserProfileResponse.from(user);
    }

    // 프로필 사진 삭제
    @Transactional
    public UserProfileResponse deleteProfileImage(Long userId) {
        User user = findUser(userId);
        deleteExistingProfileImage(user);
        user.setProfileImage(null);
        return UserProfileResponse.from(user);
    }

    private void deleteExistingProfileImage(User user) {
        if (user.getProfileImage() == null) return;
        String publicUrl = r2Properties.getPublicUrl();
        if (publicUrl != null && !publicUrl.isEmpty() && user.getProfileImage().startsWith(publicUrl)) {
            String key = user.getProfileImage().substring(publicUrl.length() + 1);
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(r2Properties.getBucket())
                    .key(key)
                    .build());
        }
    }

    private byte[] resizeImage(MultipartFile file) throws IOException {
        BufferedImage original = ImageIO.read(file.getInputStream());
        if (original == null) throw new IllegalArgumentException("이미지를 읽을 수 없습니다");

        BufferedImage resized = new BufferedImage(PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = resized.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(original, 0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE, null);
        g.dispose();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(resized, "jpg", out);
        return out.toByteArray();
    }

    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("파일이 없습니다");
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("이미지 파일만 업로드 가능합니다");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("파일 크기는 5MB 이하여야 합니다");
        }
    }

    private void validateNickname(String nickname) {
        String[] forbidden = {"admin", "관리자", "운영자", "시발", "씨발", "병신", "개새끼", "좆"};
        String lower = nickname.toLowerCase();
        for (String word : forbidden) {
            if (lower.contains(word)) throw new IllegalArgumentException("사용할 수 없는 닉네임입니다");
        }
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));
    }
}
