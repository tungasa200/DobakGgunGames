package com.dobakggun.repository;

import com.dobakggun.entity.board.BoardComment;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BoardCommentRepository extends JpaRepository<BoardComment, Long> {

    /** 초기 상세 로드: postId의 댓글을 id 오름차순, 최대 50개 */
    List<BoardComment> findTop50ByPostIdOrderByIdAsc(Long postId);

    /** cursor 기반 추가 로드: id > cursor, id 오름차순 */
    List<BoardComment> findByPostIdAndIdGreaterThanOrderByIdAsc(Long postId, Long cursor, Pageable pageable);

    /** 댓글 총 개수 */
    long countByPostId(Long postId);

    /** postId에 속하는 단건 조회 (소유권 검증용) */
    java.util.Optional<BoardComment> findByIdAndPostId(Long id, Long postId);
}
