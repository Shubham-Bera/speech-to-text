package com.sttapp.stt_backend.config;


import jakarta.annotation.PostConstruct;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
@Getter
public class StorageConfig {

    @Value("${audio.upload.dir}")
    private String uploadDir;

    // Runs automatically when app starts
    // Creates the uploads/audio folder if it doesn't exist
    @PostConstruct
    public void init() throws Exception{
        Path uploadPath = Paths.get(uploadDir);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
            System.out.println("✅ Audio upload folder created at: "
                    + uploadPath.toAbsolutePath());
        }
    }
    public String getUploadDir() {
        return uploadDir;
    }
}
