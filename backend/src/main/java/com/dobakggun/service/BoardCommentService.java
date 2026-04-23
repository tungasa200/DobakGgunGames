package com.dobakggun.service;

import com.dobakggun.dto.board.BoardCommentResponse;
import com.dobakggun.dto.board.CreateCommentRequest;
import com.dobakggun.entity.User;
import com.dobakggun.entity.board.BoardComment;
import com.dobakggun.entity.board.BoardPost;
import com.dobakggun.exception.BoardErrorCode;
import com.dobakggun.exception.BoardException;
import com.dobakggun.repository.BoardCommentRepository;
import com.dobakggun.repository.BoardPostRepository;
import com.dobakggun.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BoardCommentService {

    private final BoardCommentRepository boardCommentRepository;
    private final BoardPostRepository boardPostRepository;
    private final UserRepository userRepository;

    // ──────────────────────────────────────────────────────────────────────────
    // 댓글 추가 로드 (cursor 기반)
    // ──────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getComments(Long postId, String cursorStr, int size) {
        // post 존재 확인
        if (!boardPostRepository.existsById(postId)) {
            throw new BoardException(BoardErrorCode.POST_NOT_FOUND);
        }

        int safeSize = Math.min(size, 100);
        Long cursor;
        try {
            cursor = (cursorStr != null && !cursorStr.isBlank())
                    ? Long.parseLong(cursorStr) : 0L;
        } catch (NumberFormatException e) {
            throw new BoardException(BoardErrorCode.INVALID_CURSOR);
        }

        // size+1 개 조회 후 hasNext 판단
        List<BoardComment> comments = boardCommentRepository
                .findByPostIdAndIdGreaterThanOrderByIdAsc(
                        postId, cursor, PageRequest.of(0, safeSize + 1));

        boolean hasNext = comments.size() > safeSize;
        List<BoardComment> pageComments = hasNext
                ? comments.subList(0, safeSize) : comments;

        String nextCursor = (hasNext && !pageComments.isEmpty())
                ? String.valueOf(pageComments.get(pageComments.size() - 1).getId()) : null;

        List<BoardCommentResponse> content = pageComments.stream()
                .map(BoardCommentResponse::from)
                .collect(Collectors.toList());

        return Map.of(
                "content", content,
                "hasNext", hasNext,
                "nextCursor", nextCursor != null ? nextCursor : ""
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 댓글 작성
    // ──────────────────────────────────────────────────────────────────────────

    @Transactional
    public BoardCommentResponse createComment(Long postId, CreateCommentRequest req, Long authorId) {
        BoardPost post = boardPostRepository.findById(postId)
                .orElseThrow(() -> new BoardException(BoardErrorCode.POST_NOT_FOUND));

        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));

        String content = req.getContent();
        if (content == null || content.isBlank()) {
            throw new BoardException(BoardErrorCode.COMMENT_CONTENT_EMPTY);
        }
        if (content.length() > 1000) {
            throw new BoardException(BoardErrorCode.COMMENT_TOO_LONG);
        }

        BoardComment comment = BoardComment.builder()
                .post(post)
                .author(author)
                .content(content)
                .build();

        boardCommentRepository.save(comment);
        return BoardCommentResponse.from(comment);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 댓글 삭제 (본인 OR ADMIN)
    // ──────────────────────────────────────────────────────────────────────────

    @Transactional
    public void deleteComment(Long postId, Long commentId, Long currentUserId, User.Role currentRole) {
        // post 존재 확인
        if (!boardPostRepository.existsById(postId)) {
            throw new BoardException(BoardErrorCode.POST_NOT_FOUND);
        }

        BoardComment comment = boardCommentRepository.findByIdAndPostId(commentId, postId)
                .orElseThrow(() -> new BoardException(BoardErrorCode.COMMENT_NOT_FOUND));

        // postId 소속 확인은 findByIdAndPostId에서 이미 처리
        boolean isOwner = comment.getAuthor().getId().equals(currentUserId);
        boolean isAdmin = currentRole == User.Role.ADMIN;

        if (!isOwner && !isAdmin) {
            throw new BoardException(BoardErrorCode.COMMENT_NOT_FOUND); // 403이지만 존재 노출 방지
        }

        boardCommentRepository.delete(comment);
    }
}
