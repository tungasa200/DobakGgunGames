package com.dobakggun.repository;

import com.dobakggun.entity.board.BoardPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BoardPostRepository extends JpaRepository<BoardPost, Long> {

    Page<BoardPost> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<BoardPost> findByPostTypeOrderByCreatedAtDesc(BoardPost.PostType postType, Pageable pageable);

    Optional<BoardPost> findById(Long id);
}
