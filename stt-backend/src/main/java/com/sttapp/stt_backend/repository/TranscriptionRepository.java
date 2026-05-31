package com.sttapp.stt_backend.repository;

import com.sttapp.stt_backend.model.Transcription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TranscriptionRepository extends JpaRepository<Transcription, Long> {
    // Get all transcriptions for a specific user
    List<Transcription> findByUserIdOrderByCreatedAtDesc(Long userId);
}
