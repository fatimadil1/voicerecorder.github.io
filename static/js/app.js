/**
 * Voice Recorder Pro - Main Application JavaScript
 * Handles recording, uploading, and audio processing
 */

class VoiceRecorderApp {
    constructor() {
        // State
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.isRecording = false;
        this.isPaused = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.currentFilename = null;
        this.processedFiles = [];
        this.selectedFormat = 'mp3';

        // DOM Elements
        this.initElements();
        
        // Initialize
        this.init();
    }

    initElements() {
        // Tab elements
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.tabPanes = document.querySelectorAll('.tab-pane');

        // Record tab elements
        this.visualizer = document.getElementById('visualizer');
        this.visualizerCtx = this.visualizer.getContext('2d');
        this.recordingIndicator = document.getElementById('recording-indicator');
        this.recordingTime = document.getElementById('recording-time');
        this.recordBtn = document.getElementById('record-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.audioPlayer = document.getElementById('audio-player');
        this.audioElement = document.getElementById('audio-element');
        this.recordingInfo = document.getElementById('recording-info');

        // Upload tab elements
        this.uploadArea = document.getElementById('upload-area');
        this.fileInput = document.getElementById('file-input');
        this.uploadProgress = document.getElementById('upload-progress');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        this.fileInfo = document.getElementById('file-info');
        this.processUploadedBtn = document.getElementById('process-uploaded-btn');

        // Process tab elements
        this.currentFileCard = document.getElementById('current-file-card');
        this.currentFilenameEl = document.getElementById('current-filename');
        this.previewAudio = document.getElementById('preview-audio');
        this.noiseStrengthSlider = document.getElementById('noise-strength');
        this.strengthValue = document.getElementById('strength-value');
        this.removeClicksCheckbox = document.getElementById('remove-clicks');
        this.reduceEchoCheckbox = document.getElementById('reduce-echo');
        this.removeSilenceCheckbox = document.getElementById('remove-silence');
        this.normalizeCheckbox = document.getElementById('normalize');
        this.applyNoiseReductionBtn = document.getElementById('apply-noise-reduction');
        this.formatBtns = document.querySelectorAll('.format-btn');
        this.bitrateSelect = document.getElementById('bitrate-select');
        this.samplerateSelect = document.getElementById('samplerate-select');
        this.bitrateGroup = document.getElementById('bitrate-group');
        this.convertBtn = document.getElementById('convert-btn');
        this.analyzeBtn = document.getElementById('analyze-btn');
        this.analysisResults = document.getElementById('analysis-results');
        this.downloadSection = document.getElementById('download-section');
        this.downloadList = document.getElementById('download-list');

        // Utility elements
        this.statusMessage = document.getElementById('status-message');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingText = document.getElementById('loading-text');
    }

    init() {
        this.setupEventListeners();
        this.setupVisualizer();
        this.updateStatus('Ready to record or upload audio');
    }

    setupEventListeners() {
        // Tab navigation
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Record controls
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.stopBtn.addEventListener('click', () => this.stopRecording());

        // Upload area
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', () => this.handleDragLeave());
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.processUploadedBtn.addEventListener('click', () => this.goToProcessTab());

        // Processing controls
        this.noiseStrengthSlider.addEventListener('input', (e) => {
            this.strengthValue.textContent = `${e.target.value}%`;
        });

        this.formatBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectFormat(btn));
        });

        this.applyNoiseReductionBtn.addEventListener('click', () => this.applyNoiseReduction());
        this.convertBtn.addEventListener('click', () => this.convertAudio());
        this.analyzeBtn.addEventListener('click', () => this.analyzeAudio());
    }

    // Tab Management
    switchTab(tabName) {
        this.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        this.tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });
    }

    // Visualizer Setup
    setupVisualizer() {
        this.resizeVisualizer();
        window.addEventListener('resize', () => this.resizeVisualizer());
        this.drawIdleVisualizer();
    }

    resizeVisualizer() {
        const rect = this.visualizer.getBoundingClientRect();
        this.visualizer.width = rect.width;
        this.visualizer.height = rect.height;
    }

    drawIdleVisualizer() {
        const ctx = this.visualizerCtx;
        const width = this.visualizer.width;
        const height = this.visualizer.height;
        
        ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
        ctx.fillRect(0, 0, width, height);
        
        // Draw idle wave
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = 2;
        
        for (let x = 0; x < width; x++) {
            const y = height / 2 + Math.sin(x * 0.02 + Date.now() * 0.002) * 20;
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        if (!this.isRecording) {
            requestAnimationFrame(() => this.drawIdleVisualizer());
        }
    }

    drawRecordingVisualizer() {
        if (!this.analyser || !this.isRecording) return;

        const ctx = this.visualizerCtx;
        const width = this.visualizer.width;
        const height = this.visualizer.height;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
        ctx.fillRect(0, 0, width, height);

        // Draw waveform
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#6366f1';
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * height / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Draw glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#6366f1';
        ctx.stroke();
        ctx.shadowBlur = 0;

        requestAnimationFrame(() => this.drawRecordingVisualizer());
    }

    // Recording Functions
    async toggleRecording() {
        if (this.isRecording) {
            return;
        }
        await this.startRecording();
    }

    async startRecording() {
        try {
            this.recordingStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Setup audio context and analyser
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            const source = this.audioContext.createMediaStreamSource(this.recordingStream);
            source.connect(this.analyser);
            this.analyser.fftSize = 2048;

            // Setup media recorder
            this.mediaRecorder = new MediaRecorder(this.recordingStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };

            this.mediaRecorder.onstop = () => this.handleRecordingComplete();

            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // Update UI
            this.recordBtn.classList.add('recording');
            this.recordBtn.innerHTML = '<i class="fas fa-circle"></i>';
            this.pauseBtn.disabled = false;
            this.stopBtn.disabled = false;
            this.recordingIndicator.classList.add('active');
            this.audioPlayer.classList.add('hidden');
            this.recordingInfo.classList.add('hidden');

            // Start timer and visualizer
            this.startTimer();
            this.drawRecordingVisualizer();
            
            this.updateStatus('Recording...', 'info');

        } catch (error) {
            console.error('Recording error:', error);
            this.updateStatus('Error accessing microphone. Please allow microphone access.', 'error');
        }
    }

    togglePause() {
        if (!this.mediaRecorder) return;

        if (this.isPaused) {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            this.startTimer();
            this.updateStatus('Recording resumed', 'info');
        } else {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            this.stopTimer();
            this.updateStatus('Recording paused', 'info');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.recordingStream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.isPaused = false;

            // Update UI
            this.recordBtn.classList.remove('recording');
            this.recordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            this.pauseBtn.disabled = true;
            this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            this.stopBtn.disabled = true;
            this.recordingIndicator.classList.remove('active');

            this.stopTimer();
        }
    }

    async handleRecordingComplete() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Show audio player
        this.audioElement.src = audioUrl;
        this.audioPlayer.classList.remove('hidden');

        // Show recording info
        const duration = (Date.now() - this.recordingStartTime) / 1000;
        document.getElementById('info-duration').textContent = this.formatTime(duration);
        document.getElementById('info-size').textContent = this.formatFileSize(audioBlob.size);
        this.recordingInfo.classList.remove('hidden');

        // Upload recording
        await this.uploadRecording(audioBlob);
        
        // Draw idle visualizer
        this.drawIdleVisualizer();
    }

    async uploadRecording(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        try {
            this.showLoading('Saving recording...');
            
            const response = await fetch('/api/record', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.currentFilename = data.filename;
                this.updateCurrentFile();
                this.updateStatus('Recording saved successfully!', 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.updateStatus('Error saving recording', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // Timer Functions
    startTimer() {
        this.recordingTimer = setInterval(() => {
            const elapsed = (Date.now() - this.recordingStartTime) / 1000;
            this.recordingTime.textContent = this.formatTime(elapsed);
        }, 100);
    }

    stopTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    // Upload Functions
    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave() {
        this.uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.uploadFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.uploadFile(files[0]);
        }
    }

    async uploadFile(file) {
        // Validate file type
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/webm', 'audio/aac', 'audio/x-m4a'];
        if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac|webm)$/i)) {
            this.updateStatus('Invalid file type. Please upload an audio file.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('audio', file);

        try {
            this.uploadProgress.classList.remove('hidden');
            this.fileInfo.classList.add('hidden');
            this.progressFill.style.width = '0%';
            
            const xhr = new XMLHttpRequest();
            
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = (e.loaded / e.total) * 100;
                    this.progressFill.style.width = `${percent}%`;
                    this.progressText.textContent = `Uploading... ${Math.round(percent)}%`;
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        this.handleUploadSuccess(data, file.name);
                    } else {
                        throw new Error(data.error);
                    }
                } else {
                    throw new Error('Upload failed');
                }
            };

            xhr.onerror = () => {
                this.updateStatus('Upload failed. Please try again.', 'error');
                this.uploadProgress.classList.add('hidden');
            };

            xhr.open('POST', '/api/upload');
            xhr.send(formData);

        } catch (error) {
            console.error('Upload error:', error);
            this.updateStatus('Error uploading file', 'error');
            this.uploadProgress.classList.add('hidden');
        }
    }

    handleUploadSuccess(data, originalName) {
        this.currentFilename = data.filename;
        
        // Update file info display
        document.getElementById('upload-filename').textContent = originalName;
        document.getElementById('upload-duration').textContent = 
            data.info.duration ? this.formatTime(data.info.duration) : '--';
        document.getElementById('upload-samplerate').textContent = 
            data.info.sample_rate ? `${data.info.sample_rate} Hz` : '--';
        document.getElementById('upload-channels').textContent = 
            data.info.channels === 2 ? 'Stereo' : 'Mono';

        this.uploadProgress.classList.add('hidden');
        this.fileInfo.classList.remove('hidden');
        this.updateCurrentFile();
        this.updateStatus('File uploaded successfully!', 'success');
    }

    goToProcessTab() {
        this.switchTab('process');
    }

    updateCurrentFile() {
        if (this.currentFilename) {
            this.currentFilenameEl.textContent = this.currentFilename;
            this.previewAudio.src = `/api/download/${this.currentFilename}`;
            this.previewAudio.classList.remove('hidden');
        }
    }

    // Processing Functions
    selectFormat(btn) {
        this.formatBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedFormat = btn.dataset.format;

        // Show/hide bitrate option based on format
        const showBitrate = ['mp3', 'ogg', 'm4a', 'aac'].includes(this.selectedFormat);
        this.bitrateGroup.style.display = showBitrate ? 'block' : 'none';
    }

    async applyNoiseReduction() {
        if (!this.currentFilename) {
            this.updateStatus('Please record or upload an audio file first', 'error');
            return;
        }

        const options = {
            filename: this.currentFilename,
            strength: this.noiseStrengthSlider.value / 100,
            remove_clicks: this.removeClicksCheckbox.checked,
            reduce_echo: this.reduceEchoCheckbox.checked,
            remove_silence: this.removeSilenceCheckbox.checked,
            normalize: this.normalizeCheckbox.checked
        };

        try {
            this.showLoading('Applying noise reduction...');

            const response = await fetch('/api/reduce-noise', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(options)
            });

            const data = await response.json();

            if (data.success) {
                this.addProcessedFile(data.filename, 'Noise Reduced', data.download_url);
                this.updateStatus('Noise reduction applied successfully!', 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Noise reduction error:', error);
            this.updateStatus('Error applying noise reduction', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async convertAudio() {
        if (!this.currentFilename) {
            this.updateStatus('Please record or upload an audio file first', 'error');
            return;
        }

        const options = {
            filename: this.currentFilename,
            format: this.selectedFormat,
            bitrate: this.bitrateSelect.value,
            sample_rate: parseInt(this.samplerateSelect.value)
        };

        try {
            this.showLoading(`Converting to ${this.selectedFormat.toUpperCase()}...`);

            const response = await fetch('/api/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(options)
            });

            const data = await response.json();

            if (data.success) {
                this.addProcessedFile(data.filename, this.selectedFormat.toUpperCase(), data.download_url);
                this.updateStatus(`Converted to ${this.selectedFormat.toUpperCase()} successfully!`, 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Conversion error:', error);
            this.updateStatus('Error converting audio', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async analyzeAudio() {
        if (!this.currentFilename) {
            this.updateStatus('Please record or upload an audio file first', 'error');
            return;
        }

        try {
            this.showLoading('Analyzing audio...');

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: this.currentFilename })
            });

            const data = await response.json();

            if (data.success) {
                this.displayAnalysisResults(data.analysis);
                this.updateStatus('Analysis complete!', 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.updateStatus('Error analyzing audio', 'error');
        } finally {
            this.hideLoading();
        }
    }

    displayAnalysisResults(analysis) {
        const qualityCircle = document.getElementById('quality-circle');
        const qualityScore = document.getElementById('quality-score');
        const qualityLabel = document.getElementById('quality-label');
        const analysisDetails = document.getElementById('analysis-details');

        // Quality score
        if (analysis.quality_assessment) {
            qualityScore.textContent = analysis.quality_assessment.score;
            qualityLabel.textContent = analysis.quality_assessment.rating;
            
            // Color based on score
            const score = analysis.quality_assessment.score;
            if (score >= 80) {
                qualityCircle.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            } else if (score >= 60) {
                qualityCircle.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
            } else {
                qualityCircle.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            }
        }

        // Details
        analysisDetails.innerHTML = `
            <div class="analysis-item">
                <span class="label">Duration</span>
                <span class="value">${this.formatTime(analysis.duration_seconds)}</span>
            </div>
            <div class="analysis-item">
                <span class="label">Sample Rate</span>
                <span class="value">${analysis.sample_rate} Hz</span>
            </div>
            <div class="analysis-item">
                <span class="label">Peak Level</span>
                <span class="value">${analysis.peak_db} dB</span>
            </div>
            <div class="analysis-item">
                <span class="label">Average Level</span>
                <span class="value">${analysis.average_rms_db} dB</span>
            </div>
            <div class="analysis-item">
                <span class="label">Noise Floor</span>
                <span class="value">${analysis.estimated_noise_floor_db} dB</span>
            </div>
            <div class="analysis-item">
                <span class="label">Est. SNR</span>
                <span class="value">${analysis.estimated_snr_db} dB</span>
            </div>
            <div class="analysis-item">
                <span class="label">Silence</span>
                <span class="value">${analysis.silence_percentage}%</span>
            </div>
            <div class="analysis-item">
                <span class="label">Issues</span>
                <span class="value">${analysis.quality_assessment?.issues?.join(', ') || 'None'}</span>
            </div>
        `;

        this.analysisResults.classList.remove('hidden');
    }

    addProcessedFile(filename, type, downloadUrl) {
        this.processedFiles.push({ filename, type, downloadUrl });
        this.updateDownloadSection();
    }

    updateDownloadSection() {
        if (this.processedFiles.length === 0) {
            this.downloadSection.classList.add('hidden');
            return;
        }

        this.downloadSection.classList.remove('hidden');
        this.downloadList.innerHTML = this.processedFiles.map(file => `
            <div class="download-item">
                <div class="download-item-info">
                    <i class="fas fa-file-audio"></i>
                    <div class="download-item-details">
                        <div class="download-item-name">${file.filename}</div>
                        <div class="download-item-type">${file.type}</div>
                    </div>
                </div>
                <button class="download-btn" onclick="window.location.href='${file.downloadUrl}'">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
        `).join('');
    }

    // Utility Functions
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    updateStatus(message, type = 'info') {
        const icon = type === 'success' ? 'check-circle' : 
                     type === 'error' ? 'exclamation-circle' : 'info-circle';
        
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
    }

    showLoading(text = 'Processing...') {
        this.loadingText.textContent = text;
        this.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new VoiceRecorderApp();
});
