const https = require('https');
const { BrowserWindow, ipcMain } = require('electron');
const { getSystemPrompt } = require('./prompts');
const storage = require('../storage');
const { getApiKey, getLicenseKey, setLicenseKey } = storage;
const licenseService = require('./license');

// Global state
let audioBuffer = Buffer.alloc(0);
let lastAudioTime = Date.now();
let isProcessing = false;
let speechDetectedInBuffer = false;
let currentSessionId = null;
let conversationHistory = [];
const MAX_HISTORY_TURNS = 6;

let currentProfile = 'interview';
let currentCustomPrompt = '';
let currentResumeContent = '';

let silenceThreshold = 350;
let silenceDuration = 1000; // Reduced from 1800ms to 1000ms
let maxBufferDuration = 15000;
let minAudioSamples = 24000 * 0.4; // Reduced from 0.5s to 0.4s

function sendToRenderer(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
    }
}

function initializeNewSession(profile = 'interview', customPrompt = '') {
    currentSessionId = Date.now().toString();
    conversationHistory = [];
    isProcessing = false;
    audioBuffer = Buffer.alloc(0);
    speechDetectedInBuffer = false;
    console.log('=== SESSION INITIALIZED (GROQ) ===');
}

function addWavHeader(pcmBuffer, sampleRate = 24000) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmBuffer.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcmBuffer.length, 40);
    return Buffer.concat([header, pcmBuffer]);
}

async function fetchWithRetry(options, bodyParts, isJson = false, retries = 2, delay = 1500) {
    return new Promise((resolve, reject) => {
        const attempt = (n) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 429 && n > 0) {
                        console.log(`[Groq] 429 Rate Limit. Retrying in ${delay}ms...`);
                        setTimeout(() => attempt(n - 1), delay);
                        return;
                    }
                    if (res.statusCode >= 400) {
                        return reject(new Error(`API Error ${res.statusCode}: ${data.substring(0, 100)}`));
                    }
                    try {
                        resolve(isJson ? JSON.parse(data) : data);
                    } catch (e) {
                        reject(new Error('JSON Parse Error'));
                    }
                });
            });

            req.on('error', (e) => {
                if (n > 0) {
                    setTimeout(() => attempt(n - 1), delay);
                } else {
                    reject(e);
                }
            });

            if (Array.isArray(bodyParts)) {
                for (const part of bodyParts) req.write(part);
            } else {
                req.write(bodyParts);
            }
            req.end();
        };
        attempt(retries);
    });
}

async function transcribeAudio(buffer) {
    const apiKey = process.env.GROQ_API_KEY;
    const wavBuffer = addWavHeader(buffer);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    const options = {
        hostname: 'api.groq.com',
        path: '/openai/v1/audio/transcriptions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`
        }
    };

    const bodyParts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`,
        wavBuffer,
        `\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n--${boundary}--\r\n`
    ];

    const result = await fetchWithRetry(options, bodyParts, true);
    return result.text || '';
}

async function getGroqChatResponse(text) {
    const apiKey = process.env.GROQ_API_KEY;
    const systemPrompt = getSystemPrompt(currentProfile, currentCustomPrompt, false, {}, currentResumeContent);
    const recentHistory = conversationHistory.slice(-MAX_HISTORY_TURNS);

    const messages = [
        { role: 'system', content: systemPrompt },
        ...recentHistory.flatMap(h => [
            { role: 'user', content: h.transcription },
            { role: 'assistant', content: h.ai_response }
        ]),
        { role: 'user', content: text }
    ];

    const postData = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.6,
        max_tokens: 1024,
        stream: true
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let fullText = '';
            let isFirstChunk = true;
            let partialLine = '';

            res.on('data', chunk => {
                const combined = partialLine + chunk.toString();
                const lines = combined.split('\n');
                partialLine = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(trimmed.slice(6));
                            const content = json.choices[0]?.delta?.content || '';
                            if (content) {
                                fullText += content;
                                sendToRenderer(isFirstChunk ? 'new-response' : 'update-response', fullText);
                                isFirstChunk = false;
                            }
                        } catch (e) { }
                    }
                }
            });

            res.on('end', () => {
                if (fullText) {
                    conversationHistory.push({ transcription: text, ai_response: fullText });
                }
                resolve(fullText);
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function processAudio() {
    if (isProcessing) return;
    if (audioBuffer.length < 500) {
        audioBuffer = Buffer.alloc(0);
        speechDetectedInBuffer = false;
        return;
    }

    if (!speechDetectedInBuffer) {
        console.log('[Groq] Triggered but no speech detected. Clearing buffer.');
        audioBuffer = Buffer.alloc(0);
        return;
    }

    isProcessing = true;
    const bufferToProcess = audioBuffer;
    audioBuffer = Buffer.alloc(0);
    speechDetectedInBuffer = false;

    try {
        console.log('[Groq] Processing audio sequence...');
        sendToRenderer('update-status', 'Analyzing...');

        const text = await transcribeAudio(bufferToProcess);
        if (text && text.trim().length > 3) {
            console.log('[Groq] Transcribed:', text);
            sendToRenderer('update-status', 'Thinking...');
            await getGroqChatResponse(text);
            licenseService.incrementUsageCount();
            sendToRenderer('update-status', 'Ready');
        } else {
            console.log('[Groq] No clear speech found in buffer.');
            sendToRenderer('update-status', 'Ready');
        }
    } catch (e) {
        console.error('[Groq] Error:', e.message);
        sendToRenderer('update-status', 'Ready');
    } finally {
        isProcessing = false;
    }
}

function handleAudioData(data) {
    const buffer = Buffer.from(data, 'base64');

    // Check amplitude
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 2) {
        sum += Math.abs(buffer.readInt16LE(i));
    }
    const avg = sum / (buffer.length / 2);

    audioBuffer = Buffer.concat([audioBuffer, buffer]);
    const now = Date.now();

    if (avg >= silenceThreshold) {
        lastAudioTime = now;
        speechDetectedInBuffer = true;
    }

    const durationMs = (audioBuffer.length / 2 / 24000) * 1000;

    if ((now - lastAudioTime > silenceDuration && durationMs > 400) || durationMs > maxBufferDuration) {
        processAudio();
    }
}

function setupGroqIpcHandlers() {
    ipcMain.handle('initialize-gemini', async (event, apiKey, customPrompt, profile = 'interview', language = 'en-US', options = {}, resumeContent = '') => {
        currentProfile = profile;
        currentCustomPrompt = customPrompt;
        currentResumeContent = resumeContent;

        // Sync with gemini.js for chatbox context
        try {
            const geminiUtils = require('./gemini');
            if (geminiUtils.updateSessionContext) {
                geminiUtils.updateSessionContext(profile, customPrompt, resumeContent);
            }
        } catch (e) {
            console.error('Error syncing context to gemini.js:', e);
        }

        initializeNewSession(profile, customPrompt);
        sendToRenderer('update-status', 'Ready');
        return { success: true };
    });

    ipcMain.handle('send-audio-content', async (event, { data }) => {
        handleAudioData(data);
        return { success: true };
    });

    ipcMain.handle('send-mic-audio-content', async (event, { data }) => {
        handleAudioData(data);
        return { success: true };
    });
}

module.exports = { setupGroqIpcHandlers, sendToRenderer };
