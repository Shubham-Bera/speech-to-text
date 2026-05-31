package com.sttapp.stt_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TranscriptionResponse {

    private Long id;
    private String audioFileName;
    private String transcript;
    private String languageCode;
    private String createdAt;
    private String status;
    private String message;
}
