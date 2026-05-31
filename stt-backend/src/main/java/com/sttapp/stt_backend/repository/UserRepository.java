package com.sttapp.stt_backend.repository;

import com.sttapp.stt_backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // Find user by email (used in login)
    Optional<User> findByEmail(String email);

    // Check if email already exists (used in registration)
    boolean existsByEmail(String email);
}
