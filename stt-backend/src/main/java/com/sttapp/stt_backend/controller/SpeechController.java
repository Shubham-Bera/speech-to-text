package com.sttapp.stt_backend.controller;

import com.sttapp.stt_backend.dto.TranscriptionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.sttapp.stt_backend.service.SpeechService;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.sttapp.stt_backend.dto.SummaryRequest;
import com.sttapp.stt_backend.dto.SummaryResponse;

@RestController
@RequestMapping("/api/speech")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class SpeechController {

    private final SpeechService speechService;

    // ─── POST /api/speech/upload ─────────────────────────
    // Accepts audio file, transcribes it, saves result
    @PostMapping("/upload")
    public ResponseEntity<TranscriptionResponse> uploadAudio(
            @RequestParam("file") MultipartFile file)
            throws IOException, InterruptedException {   // ✅ add InterruptedException

        TranscriptionResponse response = speechService.uploadAndTranscribe(file);
        return ResponseEntity.ok(response);
    }

    // ─── GET /api/speech/history ─────────────────────────
    // Returns all past transcriptions for the logged-in user
    @GetMapping("/history")
    public ResponseEntity<List<TranscriptionResponse>> getHistory() {
        return ResponseEntity.ok(speechService.getHistory());
    }

    // ─── GET /api/speech/{id} ────────────────────────────
    // Returns a single transcription by ID
    @GetMapping("/{id}")
    public ResponseEntity<TranscriptionResponse> getById(
            @PathVariable Long id) {
        return ResponseEntity.ok(speechService.getById(id));
    }

    // ─── DELETE /api/speech/{id} ─────────────────────────
// Deletes a transcription by ID
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteById(@PathVariable Long id) {
        speechService.deleteById(id);
        Map<String, String> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Transcription deleted successfully.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/summary")
    public ResponseEntity<SummaryResponse> generateSummary(
            @RequestBody SummaryRequest request) throws IOException, InterruptedException {
        return ResponseEntity.ok(speechService.generateSummary(request));
    }
}