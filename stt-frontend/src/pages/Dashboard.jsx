import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import {
  uploadAudio,
  getHistory,
  deleteTranscript,
  generateSummary,
} from "../services/api";
import {
  exportTranscriptAsPdf,
  exportTranscriptAsDocx,
} from "../services/exportService";

export default function Dashboard() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    return () => {
      stopMediaTracks();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getHistory();
      setHistory(res.data);
    } catch {
      toast.error("Failed to load history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) validateAndSetFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  };

  const validateAndSetFile = (file) => {
    if (
      !file.name.match(/\.(mp3|wav|mp4|m4a|flac|ogg|webm)$/i) &&
      !file.type.startsWith("audio/")
    ) {
      toast.error("Invalid file type. Please upload a supported audio file.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large. Max size is 50MB.");
      return;
    }

    setSelectedFile(file);
    setTranscript("");
    setSummary("");
    toast.success(`File selected: ${file.name}`);
  };

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === "undefined") return "";

    const mimeTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];

    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "";
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Microphone recording is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalMimeType = mediaRecorder.mimeType || "audio/webm";
        const extension = finalMimeType.includes("mp4")
          ? "mp4"
          : finalMimeType.includes("ogg")
          ? "ogg"
          : "webm";

        const audioBlob = new Blob(chunksRef.current, { type: finalMimeType });
        const recordedFile = new File(
          [audioBlob],
          `recording-${Date.now()}.${extension}`,
          { type: finalMimeType }
        );

        setSelectedFile(recordedFile);
        setTranscript("");
        setSummary("");
        toast.success("Recording captured successfully.");
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      toast.success("Recording started.");
    } catch {
      toast.error("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      stopMediaTracks();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      toast.info("Recording stopped.");
    }
  };

  const stopMediaTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleGenerateSummary = async () => {
    if (!transcript) {
      toast.error("Generate or open a transcript first.");
      return;
    }

    setSummaryLoading(true);
    try {
      const res = await generateSummary({ transcript });
      setSummary(res.data.summary);
      toast.success("Summary generated.");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to generate summary.";
      toast.error(msg);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleExportPdf = () => {
    if (!transcript) {
      toast.error("No transcript available to export.");
      return;
    }
    exportTranscriptAsPdf("Speech Transcript", transcript);
  };

  const handleExportDocx = async () => {
    if (!transcript) {
      toast.error("No transcript available to export.");
      return;
    }
    await exportTranscriptAsDocx("Speech Transcript", transcript);
    toast.success("DOCX exported.");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select or record an audio file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setUploading(true);
    setTranscript("");
    setSummary("");

    try {
      toast.info("Transcribing... this may take some time.", { autoClose: 20000 });
      const res = await uploadAudio(formData);
      setTranscript(res.data.transcript);
      toast.dismiss();
      toast.success("Transcription complete!");
      fetchHistory();
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.dismiss();
      const msg = err.response?.data?.message || "Transcription failed.";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this transcription?")) return;

    try {
      await deleteTranscript(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast.success("Transcription deleted.");
    } catch {
      toast.error("Failed to delete transcription.");
    }
  };

  const handleCopy = async (text) => {
    try {
      if (!navigator.clipboard) {
        toast.error("Clipboard is not supported in this browser.");
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Failed to copy text.");
    }
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTime = (seconds) => {
    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <>
      <Navbar />

      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Speech to Text</h1>
          <p>Upload audio or record from your microphone</p>
        </div>

        <div className="card">
          <div className="card-title">Audio Input</div>

          <div
            className={`upload-zone ${dragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isRecording && fileInputRef.current?.click()}
          >
            <div className="upload-icon">{isRecording ? "🔴" : "🎵"}</div>
            <p>{isRecording ? "Recording in progress..." : "Drag & drop your audio file here"}</p>
            <p className="upload-hint">
              {isRecording
                ? `Recording time: ${formatTime(recordingTime)}`
                : "or click to browse — MP3, WAV, MP4, M4A, FLAC, OGG, WEBM"}
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "18px", flexWrap: "wrap" }}>
            {!isRecording ? (
              <button className="btn-secondary" onClick={startRecording}>
                🎙 Start Recording
              </button>
            ) : (
              <button className="btn-danger" onClick={stopRecording}>
                ⏹ Stop Recording
              </button>
            )}

            <button
              className="btn-primary"
              style={{ width: "auto", minWidth: "180px" }}
              onClick={handleUpload}
              disabled={uploading || !selectedFile || isRecording}
            >
              {uploading ? "Transcribing..." : "Transcribe Audio"}
            </button>
          </div>

          {selectedFile && (
            <div className="file-badge">
              🎧 {selectedFile.name}
              <span style={{ color: "var(--white-faint)", fontSize: "12px" }}>
                ({formatSize(selectedFile.size)})
              </span>
            </div>
          )}
        </div>

        {(transcript || uploading) && (
          <div className="card">
            <div className="card-title" style={{ justifyContent: "space-between" }}>
              <span>Transcript Result</span>
              {transcript && (
                <button
                  className="btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={() => handleCopy(transcript)}
                >
                  Copy
                </button>
              )}
            </div>

            <div className={`transcript-box ${!transcript ? "empty" : ""}`}>
              {uploading ? "Processing your audio..." : transcript}
            </div>

            {transcript && (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "16px" }}>
                <button
                  className="btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={handleExportPdf}
                >
                  Export PDF
                </button>

                <button
                  className="btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={handleExportDocx}
                >
                  Export DOCX
                </button>

                <button
                  className="btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={handleGenerateSummary}
                  disabled={summaryLoading}
                >
                  {summaryLoading ? "Generating Summary..." : "AI Summary"}
                </button>
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="card">
            <div className="card-title" style={{ justifyContent: "space-between" }}>
              <span>AI Summary</span>
              <button
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "12px" }}
                onClick={() => handleCopy(summary)}
              >
                Copy
              </button>
            </div>

            <div className="transcript-box">{summary}</div>
          </div>
        )}

        <div className="card">
          <div className="card-title">Transcription History</div>

          {historyLoading ? (
            <div className="empty-state">
              <p>Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🗂</div>
              <p>No transcription history available yet.</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <div className="history-item" key={item.id}>
                  <div style={{ flex: 1 }}>
                    <div
                      className="history-text"
                      style={
                        expandedId === item.id
                          ? { WebkitLineClamp: "unset", overflow: "visible" }
                          : {}
                      }
                    >
                      {item.transcript}
                    </div>

                    <div className="history-meta">
                      {item.audioFileName} · {item.createdAt}
                    </div>
                  </div>

                  <div className="history-actions">
                    <button
                      className="btn-secondary"
                      style={{ padding: "6px 10px", fontSize: "12px" }}
                      onClick={() =>
                        setExpandedId(expandedId === item.id ? null : item.id)
                      }
                    >
                      {expandedId === item.id ? "Less" : "More"}
                    </button>

                    <button
                      className="btn-secondary"
                      style={{ padding: "6px 10px", fontSize: "12px" }}
                      onClick={() => {
                        setTranscript(item.transcript || "");
                        setSummary("");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Use
                    </button>

                    <button
                      className="btn-secondary"
                      style={{ padding: "6px 10px", fontSize: "12px" }}
                      onClick={() => handleCopy(item.transcript)}
                    >
                      Copy
                    </button>

                    <button
                      className="btn-danger"
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}