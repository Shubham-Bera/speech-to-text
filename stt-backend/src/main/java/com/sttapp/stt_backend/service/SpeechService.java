package com.sttapp.stt_backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sttapp.stt_backend.config.StorageConfig;
import com.sttapp.stt_backend.dto.TranscriptionResponse;
import com.sttapp.stt_backend.model.Transcription;
import com.sttapp.stt_backend.model.User;
import com.sttapp.stt_backend.repository.TranscriptionRepository;
import com.sttapp.stt_backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import com.sttapp.stt_backend.dto.SummaryRequest;
import com.sttapp.stt_backend.dto.SummaryResponse;
import java.util.HashMap;
import java.util.Map;


import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.*;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SpeechService {

    private final StorageConfig storageConfig;
    private final TranscriptionRepository transcriptionRepository;
    private final UserRepository userRepository;

    @Value("${assemblyai.api.key}")
    private String assemblyApiKey;

    private static final String BASE_URL = "https://api.assemblyai.com";
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // ─── UPLOAD & TRANSCRIBE ─────────────────────────────
    public TranscriptionResponse uploadAndTranscribe(MultipartFile audioFile)
            throws IOException, InterruptedException {

        if (audioFile.isEmpty()) {
            return errorResponse("No file received. Please upload an audio file.");
        }

        String originalName = audioFile.getOriginalFilename();
        if (originalName == null || !isValidAudioFile(originalName)) {
            return errorResponse(
                    "Invalid file type. Supported: MP3, WAV, MP4, M4A, FLAC, OGG"
            );
        }

        // 1. Save file locally
        String uniqueFileName = UUID.randomUUID() + "_" + originalName;
        Path savePath = Paths.get(storageConfig.getUploadDir()).resolve(uniqueFileName);
        Files.copy(audioFile.getInputStream(), savePath, StandardCopyOption.REPLACE_EXISTING);
        System.out.println("✅ Audio file saved: " + savePath.toAbsolutePath());

        // 2. Transcribe via AssemblyAI HTTP API
        String transcript = transcribeWithAssemblyAI(savePath.toFile());

        // 3. Get logged-in user
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 4. Save to MySQL
        Transcription saved = transcriptionRepository.save(
                Transcription.builder()
                        .user(currentUser)
                        .audioFile(uniqueFileName)
                        .transcript(transcript)
                        .languageCode("en")
                        .build()
        );

        return buildResponse(saved, "success", "Transcription completed!");
    }

    // ─── STEP 1: Upload audio bytes to AssemblyAI CDN ────
    private String uploadFileToAssemblyAI(File audioFile)
            throws IOException, InterruptedException {

        System.out.println("📤 Uploading audio to AssemblyAI CDN...");

        byte[] fileBytes = Files.readAllBytes(audioFile.toPath());

        HttpRequest uploadRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/v2/upload"))
                // ✅ Authorization header — NO "Bearer" prefix for AssemblyAI
                .header("Authorization", assemblyApiKey)
                .header("Content-Type", "application/octet-stream")
                .POST(HttpRequest.BodyPublishers.ofByteArray(fileBytes))
                .build();

        HttpResponse<String> uploadResponse =
                httpClient.send(uploadRequest, HttpResponse.BodyHandlers.ofString());

        if (uploadResponse.statusCode() != 200) {
            throw new RuntimeException(
                    "AssemblyAI upload failed: " + uploadResponse.body()
            );
        }

        JsonNode uploadJson = objectMapper.readTree(uploadResponse.body());
        String uploadUrl = uploadJson.get("upload_url").asText();
        System.out.println("✅ File uploaded. CDN URL: " + uploadUrl);

        return uploadUrl;
    }

    // ─── STEP 2: Submit transcript job ───────────────────
    private String submitTranscriptJob(String audioUrl)
            throws IOException, InterruptedException {

        System.out.println("📝 Submitting transcription job...");

        // ✅ speech_models is REQUIRED — must be exact string values
        String requestBody = objectMapper.writeValueAsString(
                new java.util.HashMap<String, Object>() {{
                    put("audio_url", audioUrl);
                    put("speech_models", new String[]{"universal-2"});
                }}
        );

        HttpRequest submitRequest = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/v2/transcript"))
                .header("Authorization", assemblyApiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> submitResponse =
                httpClient.send(submitRequest, HttpResponse.BodyHandlers.ofString());

        if (submitResponse.statusCode() != 200) {
            throw new RuntimeException(
                    "AssemblyAI submit failed: " + submitResponse.body()
            );
        }

        JsonNode submitJson = objectMapper.readTree(submitResponse.body());
        String transcriptId = submitJson.get("id").asText();
        System.out.println("✅ Job submitted. Transcript ID: " + transcriptId);

        return transcriptId;
    }

    // ─── STEP 3: Poll until completed ────────────────────
    private String pollForResult(String transcriptId)
            throws IOException, InterruptedException {

        String pollingUrl = BASE_URL + "/v2/transcript/" + transcriptId;

        System.out.println("⏳ Polling for result...");

        while (true) {
            HttpRequest pollRequest = HttpRequest.newBuilder()
                    .uri(URI.create(pollingUrl))
                    .header("Authorization", assemblyApiKey)
                    .GET()
                    .build();

            HttpResponse<String> pollResponse =
                    httpClient.send(pollRequest, HttpResponse.BodyHandlers.ofString());

            JsonNode pollJson = objectMapper.readTree(pollResponse.body());
            String status = pollJson.get("status").asText();

            System.out.println("🔄 Status: " + status);

            if ("completed".equals(status)) {
                String text = pollJson.get("text").asText();
                System.out.println("✅ Transcription complete: " + text);
                return text;

            } else if ("error".equals(status)) {
                String error = pollJson.has("error")
                        ? pollJson.get("error").asText()
                        : "Unknown error";
                throw new RuntimeException("AssemblyAI transcription error: " + error);
            }

            // Still processing — wait 3 seconds before next poll
            Thread.sleep(3000);
        }
    }

    // ─── ORCHESTRATOR: Upload → Submit → Poll ────────────
    private String transcribeWithAssemblyAI(File audioFile)
            throws IOException, InterruptedException {

        String uploadUrl   = uploadFileToAssemblyAI(audioFile);
        String transcriptId = submitTranscriptJob(uploadUrl);
        return pollForResult(transcriptId);
    }

    // ─── GET HISTORY ─────────────────────────────────────
    public List<TranscriptionResponse> getHistory() {
        String email = SecurityContextHolder.getContext()
                .getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return transcriptionRepository
                .findByUserIdOrderByCreatedAtDesc(currentUser.getId())
                .stream()
                .map(t -> buildResponse(t, "success", ""))
                .collect(Collectors.toList());
    }

    // ─── GET SINGLE TRANSCRIPTION ─────────────────────────
    public TranscriptionResponse getById(Long id) {
        Transcription t = transcriptionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException(
                        "Transcription not found with id: " + id));
        return buildResponse(t, "success", "");
    }

    // ─── HELPER: Validate audio file extension ────────────
    private boolean isValidAudioFile(String fileName) {
        String lower = fileName.toLowerCase();
        return lower.endsWith(".mp3") || lower.endsWith(".wav")
                || lower.endsWith(".mp4") || lower.endsWith(".m4a")
                || lower.endsWith(".flac") || lower.endsWith(".ogg")
                || lower.endsWith(".webm");
    }

    // ─── HELPER: Build response DTO ───────────────────────
    private TranscriptionResponse buildResponse(
            Transcription t, String status, String message) {
        DateTimeFormatter fmt =
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        return new TranscriptionResponse(
                t.getId(),
                t.getAudioFile(),
                t.getTranscript(),
                t.getLanguageCode(),
                t.getCreatedAt() != null ? t.getCreatedAt().format(fmt) : "",
                status,
                message
        );
    }

    // ─── HELPER: Error response ───────────────────────────
    private TranscriptionResponse errorResponse(String message) {
        return new TranscriptionResponse(
                null, null, null, null, null, "error", message
        );
    }

    // ─── DELETE TRANSCRIPTION ─────────────────────────────
    public void deleteById(Long id) {
        if (!transcriptionRepository.existsById(id)) {
            throw new RuntimeException("Transcription not found with id: " + id);
        }
        transcriptionRepository.deleteById(id);
        System.out.println("🗑️ Transcription deleted. ID: " + id);
    }

    // ─── AI SUMMARY via AssemblyAI LLM Gateway ────────────
    public SummaryResponse generateSummary(SummaryRequest request)
            throws IOException, InterruptedException {

        if (request.getTranscript() == null || request.getTranscript().isBlank()) {
            throw new RuntimeException("Transcript text is required to generate a summary.");
        }

        // ── Build the prompt ──────────────────────────────
        String prompt = """
            - You are an expert at writing factual, useful summaries.
            - You focus on key details, leave out irrelevant information.
            - You do not add information not present in the transcript.
            - Your summaries are true, concise, and written in perfect English.
            - Make your summary follow the sequential order of events.
            - Respond with just the summary — no preamble or introduction.
            - Your summary should use the following format: Bullet points
            """;

        String userMessage = prompt + "\n\nTranscript: " + request.getTranscript();

        // ── Build request payload ─────────────────────────
        Map<String, Object> payload = new HashMap<>();
        payload.put("model", "claude-sonnet-4-5-20250929");
        payload.put("max_tokens", 1500);
        payload.put("messages", List.of(
                Map.of("role", "user", "content", userMessage)
        ));

        String requestBody = objectMapper.writeValueAsString(payload);

        // ── Call LLM Gateway ──────────────────────────────
        HttpRequest summaryRequest = HttpRequest.newBuilder()
                .uri(URI.create("https://llm-gateway.assemblyai.com/v1/chat/completions"))
                .header("Authorization", assemblyApiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response =
                httpClient.send(summaryRequest, HttpResponse.BodyHandlers.ofString());

        System.out.println("📝 Summary API status: " + response.statusCode());
        System.out.println("📝 Summary API body: " + response.body());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Summary generation failed: " + response.body());
        }

        // ── Parse response ────────────────────────────────
        JsonNode json = objectMapper.readTree(response.body());
        String summary = json
                .path("choices")
                .get(0)
                .path("message")
                .path("content")
                .asText();

        return new SummaryResponse(summary);
    }
}