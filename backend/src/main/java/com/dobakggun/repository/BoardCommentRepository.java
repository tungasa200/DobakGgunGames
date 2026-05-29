package com.dobakggun.repository;

import com.dobakggun.entity.board.BoardComment;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BoardCommentRepository extends JpaRepository<BoardComment, Long> {

    /** 초기 상세 로드: postId의 댓글을 id 오름차순, 최대 50개 (author FETCH JOIN으로 N+1 방지) */
    @EntityGraph(attributePaths = {"author"})
    List<BoardComment> findTop50ByPostIdOrderByIdAsc(Long postId);

    /** cursor 기반 추가 로드: id > cursor, id 오름차순 (author FETCH JOIN으로 N+1 방지) */
    @EntityGraph(attributePaths = {"author"})
    List<BoardComment> findByPostIdAndIdGreaterThanOrderByIdAsc(Long postId, Long cursor, Pageable pageable);

    /** 댓글 총 개수 */
    long countByPostId(Long postId);

    /** 다수 postId에 대한 댓글 수 배치 조회 — 목록 페이지 N+1 방지 */
    @Query("SELECT c.post.id, COUNT(c) FROM BoardComment c WHERE c.post.id IN :postIds GROUP BY c.post.id")
    List<Object[]> countByPostIdIn(@Param("postIds") List<Long> postIds);

    /** postId에 속하는 단건 조회 (소유권 검증용) */
    java.util.Optional<BoardComment> findByIdAndPostId(Long id, Long postId);
}
