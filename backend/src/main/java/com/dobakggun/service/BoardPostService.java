package com.dobakggun.service;

import com.dobakggun.dto.board.*;
import com.dobakggun.entity.User;
import com.dobakggun.entity.board.BoardComment;
import com.dobakggun.entity.board.BoardPost;
import com.dobakggun.exception.BoardErrorCode;
import com.dobakggun.exception.BoardException;
import com.dobakggun.repository.BoardCommentRepository;
import com.dobakggun.repository.BoardPostRepository;
import com.dobakggun.repository.UserRepository;
import com.dobakggun.util.HtmlSanitizer;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BoardPostService {

    /** gameKey → 허용 difficultyKey 목록 화이트리스트 (PRD 6.5) */
    private static final Map<String, Set<String>> GAME_DIFFICULTY_MAP = Map.of(
            "minesweeper",      Set.of("beginner", "intermediate", "expert"),
            "baseball",         Set.of("easy", "normal", "hard"),
            "blockfall",        Set.of("easy", "normal", "hard"),
            "blockfall-insane", Set.of("insane"),
            "solitaire",        Set.of("draw1", "draw3"),
            "apple",            Set.of("normal"),
            "sudoku",           Set.of("easy", "normal", "hard")
    );

    private static final int INITIAL_COMMENT_LIMIT = 50;
    private static final int MAX_IMAGES_PER_POST = 20;

    private final BoardPostRepository boardPostRepository;
    private final BoardCommentRepository boardCommentRepository;
    private final UserRepository userRepository;
    private final HtmlSanitizer htmlSanitizer;

    // ──────────────────────────────────────────────────────────────────────────
    // 글 목록
    // ──────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getPosts(BoardPost.PostType postType, int page, int size) {
        int safeSize = Math.min(size, 50);
        Pageable pageable = PageRequest.of(page, safeSize);

        Page<BoardPost> result = (postType == null)
                ? boardPostRepository.findAllByOrderByCreatedAtDesc(pageable)
                : boardPostRepository.findByPostTypeOrderByCreatedAtDesc(postType, pageable);

        List<Long> postIds = result.getContent().stream()
                .map(BoardPost::getId)
                .collect(Collectors.toList());
        Map<Long, Long> commentCountMap = boardCommentRepository.countByPostIdIn(postIds).stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> (Long) row[1]
                ));
        List<BoardPostSummaryResponse> content = result.getContent().stream()
                .map(post -> BoardPostSummaryResponse.of(post,
                        commentCountMap.getOrDefault(post.getId(), 0L)))
                .collect(Collectors.toList());

        return Map.of(
                "content", content,
                "hasNext", !result.isLast(),
                "totalCount", result.getTotalElements()
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 글 상세
    // ──────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public BoardPostDetailResponse getPostDetail(Long postId) {
        BoardPost post = findPost(postId);

        long totalCount = boardCommentRepository.countByPostId(postId);
        List<BoardComment> initialComments =
                boardCommentRepository.findTop50ByPostIdOrderByIdAsc(postId);

        boolean hasNext = totalCount > INITIAL_COMMENT_LIMIT;
        String nextCursor = null;
        if (hasNext && !initialComments.isEmpty()) {
            nextCursor = String.valueOf(initialComments.get(initialComments.size() - 1).getId());
        }

        List<BoardCommentResponse> commentResponses = initialComments.stream()
                .map(BoardCommentResponse::from)
                .collect(Collectors.toList());

        return BoardPostDetailResponse.of(post, commentResponses, totalCount, hasNext, nextCursor);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 글 작성
    // ──────────────────────────────────────────────────────────────────────────

    @Transactional
    public BoardPostDetailResponse createPost(CreatePostRequest req, Long authorId) {
        User author = findUser(authorId);
        String sanitizedHtml = buildAndSanitizeContent(req.getPostType(), req.getContentHtml());

        BoardPost post = BoardPost.builder()
                .postType(req.getPostType())
                .title(req.getTitle().trim())
                .contentHtml(sanitizedHtml)
                .author(author)
                .build();

        if (req.getPostType() == BoardPost.PostType.TOURNAMENT) {
            applyTournamentData(post, req.getTournamentData());
        }

        boardPostRepository.save(post);
        return buildDetailResponse(post);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 글 수정 (작성자 본인만)
    // ──────────────────────────────────────────────────────────────────────────

    @Transactional
    public BoardPostDetailResponse updatePost(Long postId, UpdatePostRequest req, Long currentUserId) {
        BoardPost post = findPost(postId);

        // 작성자 본인 확인 (ADMIN도 수정 불가 — PRD 5)
        if (!post.getAuthor().getId().equals(currentUserId)) {
            throw new BoardException(BoardErrorCode.NOT_POST_OWNER);
        }

        // post_type 변경 불가
        if (post.getPostType() != req.getPostType()) {
            throw new BoardException(BoardErrorCode.POST_TYPE_IMMUTABLE);
        }

        String sanitizedHtml = buildAndSanitizeContent(req.getPostType(), req.getContentHtml());

        post.setTitle(req.getTitle().trim());
        post.setContentHtml(sanitizedHtml);

        if (req.getPostType() == BoardPost.PostType.TOURNAMENT) {
            applyTournamentData(post, req.getTournamentData());
        }

        return buildDetailResponse(post);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 글 삭제 (작성자 본인 OR ADMIN)
    // ──────────────────────────────────────────────────────────────────────────

    @Transactional
    public void deletePost(Long postId, Long currentUserId, User.Role currentRole) {
        BoardPost post = findPost(postId);

        boolean isOwner = post.getAuthor().getId().equals(currentUserId);
        boolean isAdmin = currentRole == User.Role.ADMIN;

        if (!isOwner && !isAdmin) {
            throw new BoardException(BoardErrorCode.POST_NOT_FOUND); // 403이지만 존재 노출 방지
        }

        boardPostRepository.delete(post);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 내부 헬퍼
    // ──────────────────────────────────────────────────────────────────────────

    private String buildAndSanitizeContent(BoardPost.PostType postType, String rawHtml) {
        if (postType == BoardPost.PostType.TOURNAMENT) {
            // TOURNAMENT는 contentHtml 선택 사항
            if (rawHtml == null || rawHtml.isBlank()) return null;
        } else {
            // NOTICE / FREE는 contentHtml 필수
            if (rawHtml == null || rawHtml.isBlank()) {
                throw new BoardException(BoardErrorCode.CONTENT_EMPTY);
            }
        }

        String sanitized = htmlSanitizer.sanitize(rawHtml);

        if (postType != BoardPost.PostType.TOURNAMENT) {
            if (htmlSanitizer.isEffectivelyEmpty(sanitized)) {
                throw new BoardException(BoardErrorCode.CONTENT_EMPTY);
            }
        }

        // 이미지 개수 검증
        int imgCount = countOccurrences(sanitized, "<img");
        if (imgCount > MAX_IMAGES_PER_POST) {
            throw new BoardException(BoardErrorCode.TOO_MANY_IMAGES);
        }

        return sanitized;
    }

    private void applyTournamentData(BoardPost post, TournamentDataRequest data) {
        if (data == null) {
            throw new BoardException(BoardErrorCode.TOURNAMENT_FIELD_MISSING);
        }
        if (data.getTournamentDate() == null) {
            throw new BoardException(BoardErrorCode.TOURNAMENT_FIELD_MISSING);
        }
        if (data.getGameKey() == null || data.getGameKey().isBlank()) {
            throw new BoardException(BoardErrorCode.INVALID_GAME_KEY);
        }
        if (!GAME_DIFFICULTY_MAP.containsKey(data.getGameKey())) {
            throw new BoardException(BoardErrorCode.INVALID_GAME_KEY);
        }
        if (data.getDifficultyKey() == null || data.getDifficultyKey().isBlank()) {
            throw new BoardException(BoardErrorCode.INVALID_DIFFICULTY_KEY);
        }
        if (!GAME_DIFFICULTY_MAP.get(data.getGameKey()).contains(data.getDifficultyKey())) {
            throw new BoardException(BoardErrorCode.INVALID_DIFFICULTY_KEY);
        }
        if (data.getWinner() == null || data.getWinner().isBlank()) {
            throw new BoardException(BoardErrorCode.TOURNAMENT_FIELD_MISSING);
        }

        post.setTournamentDate(data.getTournamentDate());
        post.setGameKey(data.getGameKey());
        post.setDifficultyKey(data.getDifficultyKey());
        post.setWinner(data.getWinner().trim());
        post.setRunnerUp(data.getRunnerUp());
        post.setRanking(data.getRanking());
        post.setParticipantCount(data.getParticipantCount());
        post.setParticipants(data.getParticipants());
        post.setPrize(data.getPrize());
        post.setSponsor(data.getSponsor());
    }

    private BoardPostDetailResponse buildDetailResponse(BoardPost post) {
        long totalCount = boardCommentRepository.countByPostId(post.getId());
        List<BoardComment> initialComments =
                boardCommentRepository.findTop50ByPostIdOrderByIdAsc(post.getId());
        boolean hasNext = totalCount > INITIAL_COMMENT_LIMIT;
        String nextCursor = (hasNext && !initialComments.isEmpty())
                ? String.valueOf(initialComments.get(initialComments.size() - 1).getId()) : null;
        List<BoardCommentResponse> commentResponses = initialComments.stream()
                .map(BoardCommentResponse::from).collect(Collectors.toList());
        return BoardPostDetailResponse.of(post, commentResponses, totalCount, hasNext, nextCursor);
    }

    private BoardPost findPost(Long postId) {
        return boardPostRepository.findById(postId)
                .orElseThrow(() -> new BoardException(BoardErrorCode.POST_NOT_FOUND));
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));
    }

    private int countOccurrences(String text, String target) {
        if (text == null) return 0;
        int count = 0;
        int idx = 0;
        while ((idx = text.indexOf(target, idx)) != -1) {
            count++;
            idx += target.length();
        }
        return count;
    }
}
