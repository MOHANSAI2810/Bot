let isResponsePending = false; // Track if a response is being displayed
let isSpeechConversationActive = false; // Track if speech conversation is active
let speechConversationRecognition = null; // Speech recognition for conversation mode
let audioContext = null;
let analyser = null;
let microphone = null;
let javascriptNode = null;
let isListening = false;

function appendMessage(content, sender, codeBlocks = [], isHistory = false) {
    const chatBox = document.getElementById("chat-box");

    // Create container for bot or user message
    const messageContainer = document.createElement("div");
    messageContainer.classList.add(sender === "bot-message" ? "bot-message-container" : "user-message-container");
    chatBox.appendChild(messageContainer);

    // Add icon for bot or user
    const icon = document.createElement("img");
    icon.classList.add("message-icon");
    if (sender === "bot-message") {
        icon.src = botIconPath; // Bot icon from HTML
        messageContainer.appendChild(icon); // Add icon before the message
    }

    // Create message box
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender);
    messageContainer.appendChild(messageDiv);

    if (sender === "user-message") {
        icon.src = userIconPath; // User icon from HTML
        messageContainer.appendChild(icon); // Add icon after the message
    }
    if (isHistory && content.includes("🔍 Found image for")) {
        const urlMatch = content.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
            const imageUrl = urlMatch[0];
            messageDiv.innerHTML = `
                <p>${content.split('\n')[0]}</p>
                <a href="${imageUrl}" target="_blank">${imageUrl}</a>
                <img src="${imageUrl}" style="max-width: 200px; margin-top: 10px;">
            `;
            return;
        }
    }
    let messageParts = content.split("[CODE_BLOCK]"); // Custom separator

    function typeText(index) {
        if (index >= messageParts.length) return; // Stop when all parts are processed

        const part = messageParts[index].trim();
        if (part) {
            const textSpan = document.createElement("span");
            textSpan.classList.add("text-message");
            messageDiv.appendChild(textSpan);

            let formattedPart = part
                .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
                .replace(/\n/g, "<br>");

            if (isHistory) {
                // If loading history, display all at once
                textSpan.innerHTML = formattedPart;
                if (index < codeBlocks.length) {
                    typeCode(index);
                } else {
                    typeText(index + 1);
                }
            } else {
                // If normal chat, display letter by letter
                let i = 0;
                function typeLetter() {
                    if (i < formattedPart.length) {
                        if (formattedPart.substring(i, i + 3) === "<b>") {
                            textSpan.innerHTML += "<b>";
                            i += 3;
                        } else if (formattedPart.substring(i, i + 4) === "</b>") {
                            textSpan.innerHTML += "</b>";
                            i += 4;
                        } else if (formattedPart.substring(i, i + 4) === "<br>") {
                            textSpan.innerHTML += "<br>";
                            i += 4;
                        } else {
                            textSpan.innerHTML += formattedPart[i];
                            i++;
                        }
                        setTimeout(typeLetter, 10);
                    } else {
                        if (index < codeBlocks.length) {
                            typeCode(index);
                        } else {
                            typeText(index + 1);
                        }
                    }
                }
                typeLetter();
            }
        } else if (index < codeBlocks.length) {
            typeCode(index);
        }
    }

    function typeCode(index) {
        const codeContainer = document.createElement("div");
        codeContainer.classList.add("code-box");

        const copyButton = document.createElement("button");
        copyButton.classList.add("copy-btn");
        copyButton.innerText = "Copy";

        const pre = document.createElement("pre");
        const codeElement = document.createElement("code");
        pre.appendChild(codeElement);
        codeContainer.appendChild(copyButton);
        codeContainer.appendChild(pre);
        messageDiv.appendChild(codeContainer);

        if (isHistory) {
            // Display full code instantly when loading history
            codeElement.innerHTML = codeBlocks[index];
            typeText(index + 1);
        } else {
            // Letter-by-letter display for normal chat
            let j = 0;
            function typeCodeLetter() {
                if (j < codeBlocks[index].length) {
                    codeElement.innerHTML += codeBlocks[index][j];
                    j++;
                    setTimeout(typeCodeLetter, 5);
                } else {
                    typeText(index + 1);
                }
            }
            typeCodeLetter();
        }

        copyButton.onclick = function () {
            navigator.clipboard.writeText(codeBlocks[index]).then(() => {
                copyButton.innerText = "Copied!";
                setTimeout(() => (copyButton.innerText = "Copy"), 1500);
            }).catch(err => console.error("Copy failed:", err));
        };
    }

    // Add copy and sound buttons for bot responses
    if (sender === "bot-message") {
        const actionButtons = document.createElement("div");
        actionButtons.classList.add("action-buttons");

        const copyButton = document.createElement("button");
        copyButton.innerHTML = '<i class="fas fa-copy"></i>'; // Copy icon
        copyButton.onclick = () => {
            navigator.clipboard.writeText(content).then(() => {
                copyButton.innerHTML = '<i class="fas fa-check"></i>'; // Checkmark icon
                setTimeout(() => (copyButton.innerHTML = '<i class="fas fa-copy"></i>'), 1500);
            }).catch(err => console.error("Copy failed:", err));
        };

        const soundButton = document.createElement("button");
        soundButton.innerHTML = '<i class="fas fa-volume-up"></i>'; // Sound icon
        soundButton.onclick = () => {
            speakText(content);
        };

        actionButtons.appendChild(copyButton);
        actionButtons.appendChild(soundButton);
        messageDiv.appendChild(actionButtons);
    }

    typeText(0);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Enable the send button and allow new requests once the message is fully displayed
    if (!isHistory) {
        isResponsePending = true;
        updateSendButton(); // Disable the send button and show the loading spinner

        const totalLength = content.length + codeBlocks.reduce((acc, code) => acc + code.length, 0);
        const delay = totalLength * 10; // Adjust delay based on message length
        setTimeout(() => {
            isResponsePending = false;
            updateSendButton(); // Re-enable the send button and restore the send icon
        }, delay);
    }
}

function updateSendButton() {
    const sendButton = document.querySelector(".input-container button"); // Select the send button
    if (isResponsePending) {
        sendButton.disabled = true;
        sendButton.innerHTML = '<div class="loading-box"></div>'; // Show loading box
    } else {
        sendButton.disabled = false;
        sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>'; // Show send icon
    }
}

// Speech-to-Speech Conversation Functions
function toggleSpeechConversation() {
    if (isSpeechConversationActive) {
        stopSpeechConversation();
    } else {
        startSpeechConversation();
    }
}

function startSpeechConversation() {
    isSpeechConversationActive = true;
    updateSpeechConversationButton();
    
    // Show the speech conversation modal
    const modal = document.getElementById('speech-conversation-modal');
    modal.style.display = 'flex';
    
    // Initialize audio context for visualization
    initializeAudioContext();
}

function stopSpeechConversation() {
    isSpeechConversationActive = false;
    isListening = false;
    updateSpeechConversationButton();
    
    // Hide the speech conversation modal
    const modal = document.getElementById('speech-conversation-modal');
    modal.style.display = 'none';
    
    // Stop speech recognition
    if (speechConversationRecognition) {
        speechConversationRecognition.stop();
    }
    
    // Stop audio analysis
    stopAudioAnalysis();
    
    // Reset UI
    resetVisualization();
    document.getElementById('speech-status').textContent = 'Click the mic to start speaking...';
    document.getElementById('speech-transcript').textContent = '';
}

function updateSpeechConversationButton() {
    const speechConvButton = document.getElementById("speech-conversation-button");
    if (isSpeechConversationActive) {
        speechConvButton.classList.add("active");
        speechConvButton.innerHTML = '<i class="fas fa-stop"></i>';
        speechConvButton.title = "Stop Speech Conversation";
    } else {
        speechConvButton.classList.remove("active");
        speechConvButton.innerHTML = '<i class="fas fa-comments"></i>';
        speechConvButton.title = "Speech Conversation";
    }
}

function initializeAudioContext() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
    } catch (e) {
        console.error('Audio Context not supported:', e);
    }
}

function startListening() {
    if (!isSpeechConversationActive) return;

    if (!speechConversationRecognition) {
        initializeSpeechConversationRecognition();
    }

    // Start audio visualization
    startAudioAnalysis();

    // Start speech recognition
    speechConversationRecognition.start();
    isListening = true;

    // Update UI
    document.getElementById('start-listening-btn').style.display = 'none';
    document.getElementById('stop-listening-btn').style.display = 'block';
    document.getElementById('speech-status').textContent = 'Listening... Speak now!';
    document.getElementById('speech-transcript').textContent = '';
}

function stopListening() {
    isListening = false;
    
    // Stop speech recognition
    if (speechConversationRecognition) {
        speechConversationRecognition.stop();
    }
    
    // Stop audio analysis
    stopAudioAnalysis();
    
    // Update UI
    document.getElementById('start-listening-btn').style.display = 'block';
    document.getElementById('stop-listening-btn').style.display = 'none';
    document.getElementById('speech-status').textContent = 'Click the mic to start speaking...';
    resetVisualization();
}

function startAudioAnalysis() {
    if (!audioContext || !analyser) return;

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(function(stream) {
            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);
            
            javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
            analyser.connect(javascriptNode);
            javascriptNode.connect(audioContext.destination);
            
            javascriptNode.onaudioprocess = function() {
                if (!isListening) return;
                
                const array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                
                let values = 0;
                const length = array.length;
                
                for (let i = 0; i < length; i++) {
                    values += array[i];
                }
                
                const average = values / length;
                updateVisualization(average);
            };
        })
        .catch(function(err) {
            console.error('Error accessing microphone:', err);
        });
}

function stopAudioAnalysis() {
    if (javascriptNode) {
        javascriptNode.disconnect();
        javascriptNode = null;
    }
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }
}

function updateVisualization(volume) {
    const lines = document.querySelectorAll('.voice-lines .line');
    const scale = Math.min(volume / 100, 1); // Normalize volume to 0-1
    
    lines.forEach((line, index) => {
        const height = 5 + (scale * 30 * (index + 1) / lines.length);
        line.style.height = `${height}px`;
        line.style.opacity = 0.3 + (scale * 0.7);
    });
}

function resetVisualization() {
    const lines = document.querySelectorAll('.voice-lines .line');
    lines.forEach(line => {
        line.style.height = '5px';
        line.style.opacity = '0.3';
    });
}

function initializeSpeechConversationRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Your browser does not support speech recognition. Please use Chrome or Edge.");
        return;
    }

    speechConversationRecognition = new SpeechRecognition();
    speechConversationRecognition.continuous = false;
    speechConversationRecognition.interimResults = true;
    speechConversationRecognition.lang = "en-US";

    speechConversationRecognition.onstart = function() {
        console.log("Speech conversation recognition started");
        document.getElementById('speech-status').textContent = 'Listening...';
    };

    speechConversationRecognition.onresult = async function(event) {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        // Update transcript display
        const transcriptElement = document.getElementById('speech-transcript');
        if (finalTranscript) {
            transcriptElement.textContent = finalTranscript;
        } else {
            transcriptElement.textContent = interimTranscript;
        }

        // If we have a final transcript, process it
        if (finalTranscript.trim().length > 2) {
            await processSpeechRequest(finalTranscript);
        }
    };

    speechConversationRecognition.onerror = function(event) {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
            // Restart listening if no speech detected
            if (isListening) {
                setTimeout(() => {
                    if (isListening && speechConversationRecognition) {
                        speechConversationRecognition.start();
                    }
                }, 1000);
            }
            return;
        }
        document.getElementById('speech-status').textContent = `Error: ${event.error}`;
    };

    speechConversationRecognition.onend = function() {
        console.log("Speech recognition ended");
        if (isListening) {
            // Restart recognition if still listening
            setTimeout(() => {
                if (isListening && speechConversationRecognition) {
                    speechConversationRecognition.start();
                }
            }, 500);
        }
    };
}

async function processSpeechRequest(transcript) {
    if (!transcript.trim()) return;

    // Add user message to chat
    appendMessage(transcript, "user-message");
    
    // Update status
    document.getElementById('speech-status').textContent = 'Processing your request...';
    
    try {
        // Get bot response
        const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: transcript }),
        });
        
        const data = await response.json();
        
        if (data.reply) {
            // Display bot response
            appendMessage(data.reply, "bot-message", data.code);
            
            // Speak the bot response
            speakText(data.reply);
            
            // Update status
            document.getElementById('speech-status').textContent = 'Response received! Click mic to speak again.';
        }
    } catch (error) {
        console.error("Error in speech conversation:", error);
        appendMessage("Sorry, I encountered an error.", "bot-message");
        document.getElementById('speech-status').textContent = 'Error processing request. Click mic to try again.';
    }
    
    // Clear transcript
    document.getElementById('speech-transcript').textContent = '';
}

function speakText(text) {
    // Clean the text for speech (remove code blocks, markdown, etc.)
    const cleanText = text.replace(/\[CODE_BLOCK\].*?\[CODE_BLOCK\]/g, '')
                         .replace(/\*\*(.*?)\*\*/g, '$1')
                         .replace(/`(.*?)`/g, '$1')
                         .replace(/\n/g, ' ');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    utterance.onstart = function() {
        document.getElementById('speech-status').textContent = 'Speaking response...';
    };
    
    utterance.onend = function() {
        document.getElementById('speech-status').textContent = 'Response complete! Click mic to speak again.';
        // Restart listening after speech ends
        if (isListening) {
            setTimeout(() => {
                if (isListening && speechConversationRecognition) {
                    speechConversationRecognition.start();
                }
            }, 1000);
        }
    };
    
    utterance.onerror = function(event) {
        console.error("Speech synthesis error:", event.error);
        document.getElementById('speech-status').textContent = 'Error speaking response. Click mic to try again.';
    };
    
    window.speechSynthesis.speak(utterance);
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('speech-conversation-modal');
    if (event.target === modal) {
        stopSpeechConversation();
    }
});

// Rest of your existing functions (sendMessage, file handling, etc.) remain the same...
let selectedFile = null; // Store the selected file

async function getWeather(city) {
    const response = await fetch("/get-weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city }),
    });
    const data = await response.json();
    return data;
}

async function getNews() {
    const response = await fetch("/get-news");
    const data = await response.json();
    return data;
}

async function translateText(text, targetLanguage) {
    const response = await fetch("/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target_language: targetLanguage }),
    });
    const data = await response.json();
    return data;
}

function sendMessage() {
    if (isResponsePending) return; // Prevent new requests if a response is pending

    const userInput = document.getElementById("user-input");
    const message = userInput.value.trim();

    if (message === "") return;

    // Display the user's message
    appendMessage(message, "user-message");

    // Check for YouTube URL first
    if (isYouTubeUrl(message)) {
        // Display "Bot is thinking..." message
        const botThinking = document.createElement("div");
        botThinking.classList.add("message", "bot-message");
        botThinking.innerHTML = "Analyzing YouTube video...";
        botThinking.id = "thinking-message";
        document.getElementById("chat-box").appendChild(botThinking);

        // Send to YouTube processing endpoint
        fetch("/process-youtube", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({ url: message })
        })
        .then(response => response.json())
        .then(data => {
        document.getElementById("thinking-message").remove();

        if (data.success) {
            // Successful response with transcript
            displayYouTubeResponse(data);
        } else if (data.message) {
            // No transcript available
            appendMessage(data.message, "bot-message");
        } else {
            // Other errors
            appendMessage(data.error || "Error processing YouTube video", "bot-message");
        }
        })
        .catch(error => {
        document.getElementById("thinking-message").remove();
        console.error("Error processing YouTube video:", error);
        appendMessage("Error processing YouTube video", "bot-message");
        });

        userInput.value = "";
        return;
    }
    // Check for custom responses first
    const customResponse = getCustomResponse(message);
    if (customResponse) {
        appendMessage(customResponse, "bot-message");
        userInput.value = ""; // Clear the input box
        return; // Exit the function after sending the custom response
    }

    // Check for weather requests
    const weatherMatch = message.match(/weather in (.+)/i);
    if (weatherMatch) {
        const city = weatherMatch[1];
        getWeather(city).then(data => {
            if (data.success) {
                appendMessage(data.message, "bot-message");
            } else {
                appendMessage("Sorry, I couldn't fetch the weather.", "bot-message");
            }
        });
        userInput.value = ""; // Clear the input box
        return;
    }

    // Check for news requests
    if (message.toLowerCase().includes("latest news")) {
        getNews().then(data => {
            if (data.success) {
                appendMessage(data.message, "bot-message");
            } else {
                appendMessage("Sorry, I couldn't fetch the news.", "bot-message");
            }
        });
        userInput.value = ""; // Clear the input box
        return;
    }

    // Check for translation requests
    const translationMatch = message.match(/translate (.+) to (\w+)/i);
    if (translationMatch) {
        const textToTranslate = translationMatch[1];
        const targetLanguage = translationMatch[2];

        translateText(textToTranslate, targetLanguage).then(data => {
            if (data.success) {
                appendMessage(data.translated_text, "bot-message");
            } else {
                appendMessage("Sorry, I couldn't translate that.", "bot-message");
            }
        });
        userInput.value = ""; // Clear the input box
        return;
    }

    // Check if the message is an image name (e.g., ends with .png, .jpg, etc.)
    const isImage = /\.(png|jpg|jpeg)$/i.test(message);

    // Check if the message is a file name (e.g., ends with .pdf, .docx, etc.)
    const isFile = /\.(pdf|docx|pptx)$/i.test(message);

    // Display "Bot is thinking..." message
    const botThinking = document.createElement("div");
    botThinking.classList.add("message", "bot-message");
    botThinking.innerHTML = "Bot is thinking...";
    botThinking.id = "thinking-message";
    document.getElementById("chat-box").appendChild(botThinking);

    if (isImage && selectedImageFile) {
        // Handle image upload
        const formData = new FormData();
        formData.append("image", selectedImageFile);

        fetch("/upload-image", {
            method: "POST",
            body: formData,
        })
            .then((response) => response.json())
            .then((data) => {
                // Remove the "Bot is thinking..." message
                document.getElementById("thinking-message").remove();

                if (data.success) {
                    // Display the paragraph generated by Gemini
                    appendMessage(data.paragraph, "bot-message");
                } else {
                    appendMessage("Failed to analyze image", "bot-message");
                }
            })
            .catch((error) => {
                // Remove the "Bot is thinking..." message
                document.getElementById("thinking-message").remove();
                console.error("Error uploading image:", error);
            });

        // Clear the input box and reset the selected image
        userInput.value = "";
        selectedImageFile = null;
    } else if (isFile && selectedFile) {
        // Handle file upload
        const formData = new FormData();
        formData.append("file", selectedFile);

        fetch("/upload-file", {
            method: "POST",
            body: formData,
        })
            .then((response) => response.json())
            .then((data) => {
                // Remove the "Bot is thinking..." message
                document.getElementById("thinking-message").remove();

                if (data.success) {
                    // Display the summary generated by Gemini
                    appendMessage(data.summary, "bot-message");
                } else {
                    appendMessage("Failed to process file", "bot-message");
                }
            })
            .catch((error) => {
                // Remove the "Bot is thinking..." message
                document.getElementById("thinking-message").remove();
                console.error("Error uploading file:", error);
            });

        // Clear the input box and reset the selected file
        userInput.value = "";
        selectedFile = null;
    } else {
        // Handle normal text message
        fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message }),
        })
            .then((response) => response.json())
            .then((data) => {
                document.getElementById("thinking-message").remove();
                appendMessage(data.reply, "bot-message", data.code);
            })
            .catch((error) => {
                document.getElementById("thinking-message").remove();
                console.log(error);
            });

        // Clear the input box
        userInput.value = "";
    }
}
// Handle file upload
document.getElementById("file-upload").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
        const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
        if (allowedTypes.includes(file.type)) {
            // Display the file name in the input box
            const userInput = document.getElementById("user-input");
            userInput.value = file.name;

            // Store the selected file
            selectedFile = file;
        } else {
            alert("Only PDF, DOCX, and PPTX files are allowed.");
        }
    }
});

// Handle image upload
document.getElementById("image-upload").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
        if (allowedTypes.includes(file.type)) {
            // Display the image name in the input box
            const userInput = document.getElementById("user-input");
            userInput.value = file.name;

            // Store the selected image file
            selectedImageFile = file;
        } else {
            alert("Only PNG, JPG, and JPEG images are allowed.");
        }
    }
});
// Add this to script.js
const toggleHistoryButton = document.getElementById("toggle-history");
const historyStore = document.getElementById("history-store");
const chatContainer = document.getElementById("chat-container");

let isHistoryVisible = true; // Track if history is visible

// Toggle history visibility
toggleHistoryButton.addEventListener("click", function () {
    isHistoryVisible = !isHistoryVisible;

    if (isHistoryVisible) {
        // Show history box
        document.body.classList.remove("history-hidden");
    } else {
        // Hide history box
        document.body.classList.add("history-hidden");
    }
});
// Handle Enter key press
document.getElementById("user-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function confirmLogout() {
    document.getElementById("logout-modal").style.display = "flex";
}

function closeModal() {
    document.getElementById("logout-modal").style.display = "none";
}

function logout() {
    window.location.href = "/logout"; // Redirect to logout route
}
document.addEventListener("DOMContentLoaded", function () {
    fetch("/get-username")  // Flask route to fetch username
        .then(response => response.json())
        .then(data => {
            document.getElementById("username").textContent = data.username;
        })
        .catch(error => console.error("Error fetching username:", error));
});

// Update the image upload handler
let selectedImageFile = null; // Store the selected image file

let isListeningOld = false; // Track if speech recognition is active
let recognition = null;  // Speech recognition object

// Initialize speech recognition
function initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Your browser does not support speech recognition. Please use Chrome or Edge.");
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop after one sentence
    recognition.interimResults = false; // Only final results
    recognition.lang = "en-US"; // Set language

    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript;
        const userInput = document.getElementById("user-input");
        userInput.value = transcript; // Display the recognized text in the input box
    };

    recognition.onerror = function (event) {
        console.error("Speech recognition error:", event.error);
        alert("Speech recognition error: " + event.error);
    };

    recognition.onend = function () {
        isListeningOld = false;
        updateMicButton(); // Update the mic button state
    };
}

// Toggle speech recognition
function toggleSpeechRecognition() {
    if (!recognition) {
        initializeSpeechRecognition();
    }

    if (isListeningOld) {
        recognition.stop(); // Stop speech recognition
    } else {
        recognition.start(); // Start speech recognition
    }
    isListeningOld = !isListeningOld;
    updateMicButton(); // Update the mic button state
}

// Update the mic button appearance
function updateMicButton() {
    const micButton = document.getElementById("mic-button");
    if (isListeningOld) {
        micButton.classList.add("active"); // Add a visual indicator (e.g., red mic)
    } else {
        micButton.classList.remove("active");
    }
}
// Health Assessment Variables
let healthAssessmentActive = false;
let healthAssessmentRecognition = null;
let currentSentenceIndex = 0;
let assessmentData = {
    sentences: [],
    results: [],
    overallEmotion: 'neutral',
    averageConfidence: 0,
    startTime: 0
};

// Predefined sentences for health assessment
const assessmentSentences = [
    "The sun shines brightly in the clear blue sky, bringing warmth and light to the world.",
    "I feel grateful for the small moments of peace and happiness in my daily life.",
    "Sometimes challenges feel overwhelming, but I know I have the strength to overcome them.",
    "Taking deep breaths helps me feel calm and centered when things get stressful.",
    "I appreciate the people in my life who support and care about me deeply."
];

// Emotion to health mapping
const healthRecommendations = {
    happy: [
        { icon: "💪", text: "Continue your positive routine and maintain social connections", type: "positive" },
        { icon: "🏃", text: "Regular exercise will help sustain your positive mood", type: "positive" },
        { icon: "🎯", text: "Set new goals to channel your positive energy productively", type: "positive" }
    ],
    sad: [
        { icon: "🤗", text: "Reach out to friends or family for emotional support", type: "warning" },
        { icon: "🌞", text: "Spend time in sunlight and nature to boost your mood", type: "warning" },
        { icon: "🎵", text: "Listen to uplifting music or engage in creative activities", type: "warning" },
        { icon: "📞", text: "Consider talking to a mental health professional if sadness persists", type: "important" }
    ],
    angry: [
        { icon: "🌊", text: "Practice deep breathing exercises when you feel anger building", type: "warning" },
        { icon: "🏃", text: "Physical activity can help release built-up tension", type: "warning" },
        { icon: "📝", text: "Write down your feelings to process them more clearly", type: "warning" },
        { icon: "⏰", text: "Take a timeout before responding to triggering situations", type: "important" }
    ],
    calm: [
        { icon: "🧘", text: "Continue your meditation or mindfulness practices", type: "positive" },
        { icon: "📚", text: "Maintain a consistent sleep schedule for optimal rest", type: "positive" },
        { icon: "🌿", text: "Incorporate nature walks into your weekly routine", type: "positive" }
    ],
    anxious: [
        { icon: "🌬️", text: "Practice 4-7-8 breathing technique: inhale 4s, hold 7s, exhale 8s", type: "warning" },
        { icon: "📅", text: "Create a structured daily routine to reduce uncertainty", type: "warning" },
        { icon: "🚫", text: "Limit caffeine and sugar intake which can increase anxiety", type: "important" },
        { icon: "💭", text: "Challenge negative thoughts with evidence-based thinking", type: "important" }
    ],
    tired: [
        { icon: "😴", text: "Aim for 7-9 hours of quality sleep each night", type: "warning" },
        { icon: "💧", text: "Stay hydrated and maintain balanced nutrition", type: "warning" },
        { icon: "🌅", text: "Establish a consistent sleep-wake cycle", type: "important" },
        { icon: "🏥", text: "Consult a healthcare provider if fatigue persists", type: "important" }
    ],
    neutral: [
        { icon: "🌟", text: "Try new activities to add variety to your routine", type: "positive" },
        { icon: "🎯", text: "Set small, achievable goals to build momentum", type: "positive" },
        { icon: "🤝", text: "Connect with others to enrich your social life", type: "positive" }
    ]
};

// Health Assessment Functions
function startHealthAssessment() {
    healthAssessmentActive = true;
    updateHealthAssessmentButton();
    
    // Initialize assessment data
    currentSentenceIndex = 0;
    assessmentData = {
        sentences: assessmentSentences.map(sentence => ({ text: sentence })),
        results: [],
        overallEmotion: 'neutral',
        averageConfidence: 0,
        startTime: Date.now()
    };
    
    // Show health assessment modal
    const modal = document.getElementById('health-assessment-modal');
    modal.style.display = 'flex';
    
    // Initialize audio context
    initializeAudioContext();
    
    // Load first sentence
    loadCurrentSentence();
}

function stopHealthAssessment() {
    healthAssessmentActive = false;
    updateHealthAssessmentButton();
    
    const modal = document.getElementById('health-assessment-modal');
    modal.style.display = 'none';
    
    if (healthAssessmentRecognition) {
        healthAssessmentRecognition.stop();
    }
    
    stopAudioAnalysis();
    resetAssessmentUI();
}

function updateHealthAssessmentButton() {
    const healthButton = document.getElementById("health-assessment-button");
    if (healthAssessmentActive) {
        healthButton.classList.add("active");
        healthButton.title = "Stop Health Assessment";
    } else {
        healthButton.classList.remove("active");
        healthButton.title = "Mental Health Assessment";
    }
}

function loadCurrentSentence() {
    const sentenceText = document.getElementById('sentence-text');
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    
    sentenceText.textContent = assessmentSentences[currentSentenceIndex];
    progressText.textContent = `Sentence ${currentSentenceIndex + 1} of ${assessmentSentences.length}`;
    progressFill.style.width = `${((currentSentenceIndex) / assessmentSentences.length) * 100}%`;
    
    // Reset UI for new sentence
    resetAssessmentUI();
}

function startAssessmentListening() {
    if (!healthAssessmentActive) return;

    if (!healthAssessmentRecognition) {
        initializeHealthAssessmentRecognition();
    }

    startAudioAnalysis();
    healthAssessmentRecognition.start();

    // Update UI
    document.getElementById('start-assessment-btn').style.display = 'none';
    document.getElementById('stop-assessment-btn').style.display = 'block';
    document.getElementById('health-emotion-text').textContent = 'Listening... Please read the sentence';
}

function stopAssessmentListening() {
    if (healthAssessmentRecognition) {
        healthAssessmentRecognition.stop();
    }
    
    stopAudioAnalysis();
    
    document.getElementById('start-assessment-btn').style.display = 'block';
    document.getElementById('stop-assessment-btn').style.display = 'none';
    
    // Show next button if we have results
    if (assessmentData.results.length > currentSentenceIndex) {
        document.getElementById('next-sentence-btn').style.display = 'block';
    }
}

function initializeHealthAssessmentRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Your browser does not support speech recognition. Please use Chrome or Edge.");
        return;
    }

    healthAssessmentRecognition = new SpeechRecognition();
    healthAssessmentRecognition.continuous = false;
    healthAssessmentRecognition.interimResults = true;
    healthAssessmentRecognition.lang = "en-US";

    let finalTranscript = '';
    let analysisStarted = false;

    healthAssessmentRecognition.onstart = function() {
        console.log("Health assessment recognition started");
        analysisStarted = true;
        assessmentData.startTime = Date.now();
    };

    healthAssessmentRecognition.onresult = async function(event) {
        let interimTranscript = '';
        finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        // Update transcript display
        const transcriptElement = document.getElementById('speech-transcript');
        if (finalTranscript) {
            transcriptElement.textContent = finalTranscript;
        } else {
            transcriptElement.textContent = interimTranscript;
        }

        // Analyze emotion from voice characteristics
        if (analysisStarted) {
            const currentEmotion = analyzeHealthEmotion();
            updateHealthEmotionDisplay(currentEmotion);
        }

        // If we have a final transcript, process it
        if (finalTranscript.trim()) {
            await processAssessmentSentence(finalTranscript);
        }
    };

    healthAssessmentRecognition.onerror = function(event) {
        console.error("Health assessment recognition error:", event.error);
        if (event.error === 'no-speech') {
            // If no speech detected, analyze what we have
            const currentEmotion = analyzeHealthEmotion();
            updateHealthEmotionDisplay(currentEmotion);
            processAssessmentSentence("");
        }
    };

    healthAssessmentRecognition.onend = function() {
        console.log("Health assessment recognition ended");
        analysisStarted = false;
        
        // Auto-stop analysis
        stopAssessmentListening();
    };
}

function analyzeHealthEmotion() {
    // Use the existing emotion detection logic but with health-specific weighting
    const features = getCurrentAudioFeatures();
    
    if (!features || features.intensity < 10) {
        return { emotion: 'neutral', confidence: 0.5 };
    }

    // Health-specific emotion detection
    let emotion = 'neutral';
    let confidence = 0.5;

    if (features.intensity > 70 && features.pitch > 180) {
        emotion = 'excited';
        confidence = 0.8;
    } else if (features.intensity > 60 && features.pitch > 150) {
        emotion = 'happy';
        confidence = 0.7;
    } else if (features.intensity > 70 && features.pitch < 120) {
        emotion = 'angry';
        confidence = 0.75;
    } else if (features.intensity < 30 && features.pitch < 100) {
        emotion = 'sad';
        confidence = 0.6;
    } else if (features.intensity < 40 && features.variability < 50) {
        emotion = 'calm';
        confidence = 0.65;
    } else if (features.intensity > 50 && features.variability > 150) {
        emotion = 'anxious';
        confidence = 0.7;
    } else if (features.intensity < 25 && features.pitch < 90) {
        emotion = 'tired';
        confidence = 0.6;
    }

    return { emotion, confidence };
}

function updateHealthEmotionDisplay(emotionData) {
    const emotionDisplay = document.getElementById('health-emotion-display');
    const emotionIcon = document.getElementById('health-emotion-icon');
    const emotionText = document.getElementById('health-emotion-text');
    const emotionConfidence = document.getElementById('health-emotion-confidence');

    const emotionInfo = emotionMap[emotionData.emotion] || emotionMap.neutral;
    
    emotionIcon.textContent = emotionInfo.icon;
    emotionIcon.className = `emotion-icon ${emotionInfo.color} emotion-pulse`;
    emotionText.textContent = `Detected: ${emotionInfo.description}`;
    emotionConfidence.textContent = `${Math.round(emotionData.confidence * 100)}% confidence`;

    emotionDisplay.style.display = 'flex';
}

async function processAssessmentSentence(transcript) {
    const emotionData = analyzeHealthEmotion();
    
    // Store results
    assessmentData.results[currentSentenceIndex] = {
        sentence: assessmentSentences[currentSentenceIndex],
        transcript: transcript,
        emotion: emotionData.emotion,
        confidence: emotionData.confidence,
        timestamp: Date.now()
    };

    // Mark sentence as completed
    document.getElementById('sentence-text').classList.add('completed-sentence');
    
    // Show next button
    document.getElementById('next-sentence-btn').style.display = 'block';
}

function nextSentence() {
    currentSentenceIndex++;
    
    if (currentSentenceIndex < assessmentSentences.length) {
        loadCurrentSentence();
        document.getElementById('next-sentence-btn').style.display = 'none';
    } else {
        // Assessment complete - show results
        showAssessmentResults();
    }
}

function showAssessmentResults() {
    // Calculate overall results
    const emotions = assessmentData.results.map(r => r.emotion);
    const confidences = assessmentData.results.map(r => r.confidence);
    
    // Find most common emotion
    const emotionCount = {};
    emotions.forEach(emotion => {
        emotionCount[emotion] = (emotionCount[emotion] || 0) + 1;
    });
    
    let overallEmotion = 'neutral';
    let maxCount = 0;
    for (const [emotion, count] of Object.entries(emotionCount)) {
        if (count > maxCount) {
            maxCount = count;
            overallEmotion = emotion;
        }
    }
    
    assessmentData.overallEmotion = overallEmotion;
    assessmentData.averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    // Update results modal
    updateResultsModal();
    
    // Hide assessment modal and show results
    document.getElementById('health-assessment-modal').style.display = 'none';
    document.getElementById('health-results-modal').style.display = 'flex';
}

function updateResultsModal() {
    const emotionIcon = document.getElementById('results-emotion-icon');
    const emotionText = document.getElementById('results-emotion-text');
    const confidenceText = document.getElementById('results-confidence');
    const recommendationsList = document.getElementById('recommendations-list');
    
    const emotionInfo = emotionMap[assessmentData.overallEmotion] || emotionMap.neutral;
    
    // Update emotion display
    emotionIcon.textContent = emotionInfo.icon;
    emotionIcon.className = `emotion-icon large ${emotionInfo.color} emotion-pulse`;
    emotionText.textContent = `Overall Emotional State: ${emotionInfo.description}`;
    confidenceText.textContent = `Confidence: ${Math.round(assessmentData.averageConfidence * 100)}%`;
    
    // Update recommendations
    recommendationsList.innerHTML = '';
    const recommendations = healthRecommendations[assessmentData.overallEmotion] || healthRecommendations.neutral;
    
    recommendations.forEach(rec => {
        const item = document.createElement('div');
        item.className = `recommendation-item ${rec.type}`;
        item.innerHTML = `
            <div class="recommendation-icon">${rec.icon}</div>
            <div class="recommendation-text">${rec.text}</div>
        `;
        recommendationsList.appendChild(item);
    });
    
    // Update stats
    document.getElementById('avg-pitch').textContent = getPitchDescription();
    document.getElementById('speech-consistency').textContent = getConsistencyDescription();
    document.getElementById('emotional-variability').textContent = getVariabilityDescription();
}

function getPitchDescription() {
    const pitches = assessmentData.results.map(r => {
        const features = getCurrentAudioFeatures();
        return features ? features.pitch : 150;
    });
    const avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    
    if (avgPitch > 180) return 'High';
    if (avgPitch > 120) return 'Medium';
    return 'Low';
}

function getConsistencyDescription() {
    const confidences = assessmentData.results.map(r => r.confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    
    if (avgConfidence > 0.7) return 'Excellent';
    if (avgConfidence > 0.5) return 'Good';
    return 'Variable';
}

function getVariabilityDescription() {
    const emotions = assessmentData.results.map(r => r.emotion);
    const uniqueEmotions = new Set(emotions).size;
    
    if (uniqueEmotions === 1) return 'Very Stable';
    if (uniqueEmotions <= 2) return 'Stable';
    if (uniqueEmotions <= 3) return 'Moderate';
    return 'High';
}

function closeHealthResults() {
    document.getElementById('health-results-modal').style.display = 'none';
    stopHealthAssessment();
}

function restartAssessment() {
    document.getElementById('health-results-modal').style.display = 'none';
    startHealthAssessment();
}

function resetAssessmentUI() {
    document.getElementById('sentence-text').classList.remove('completed-sentence');
    document.getElementById('health-emotion-display').style.display = 'none';
    document.getElementById('next-sentence-btn').style.display = 'none';
    
    // Reset analysis bars
    document.getElementById('health-pitch-fill').style.width = '50%';
    document.getElementById('health-intensity-fill').style.width = '50%';
    document.getElementById('health-rate-fill').style.width = '50%';
}

// Helper function to get current audio features (you'll need to implement this based on your existing audio analysis)
function getCurrentAudioFeatures() {
    // This should return the current audio features from your existing analysis
    // For now, returning a mock object - integrate with your actual audio analysis
    return {
        intensity: 50,
        pitch: 150,
        variability: 75
    };
}

// Update your existing emotion map to include health-specific emotions
const emotionMap = {
    happy: { icon: '😊', color: 'emotion-happy', description: 'Happy' },
    sad: { icon: '😢', color: 'emotion-sad', description: 'Sad' },
    angry: { icon: '😠', color: 'emotion-angry', description: 'Angry' },
    calm: { icon: '😌', color: 'emotion-calm', description: 'Calm' },
    excited: { icon: '😃', color: 'emotion-excited', description: 'Excited' },
    neutral: { icon: '😐', color: 'emotion-neutral', description: 'Neutral' },
    anxious: { icon: '😰', color: 'emotion-anxious', description: 'Anxious' },
    tired: { icon: '😴', color: 'emotion-tired', description: 'Tired' }
};
let currentSearchQuery = ""; // Store the current search query

// Function to search the entire chat history
function searchChat() {
    const searchQuery = document.getElementById("search-input").value.trim();
    if (!searchQuery) {
        return; // Exit if no search query is entered
    }

    currentSearchQuery = searchQuery; // Store the search query

    // Fetch all chat history from the server
    fetch('/get_history')
        .then(response => response.json())
        .then(data => {
            if (data.history) {
                let foundMatch = false;

                // Clear previous highlights in the history buttons
                const historyButtons = document.querySelectorAll(".history-button");
                historyButtons.forEach(button => button.classList.remove("highlight-button"));

                // Search through all chat history
                data.history.forEach(chat => {
                    const chatId = chat.chat_id;
                    fetch(`/load_chat_history/${chatId}`)
                        .then(response => response.json())
                        .then(chatData => {
                            if (chatData.chat_history) {
                                let hasMatch = false;

                                // Check if the search term exists in this chat
                                chatData.chat_history.forEach(entry => {
                                    if (entry.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        entry.bot.toLowerCase().includes(searchQuery.toLowerCase())) {
                                        hasMatch = true;
                                    }
                                });

                                // Highlight the history button if a match is found
                                if (hasMatch) {
                                    const historyButton = document.querySelector(`.history-button[data-chat-id="${chatId}"]`);
                                    if (historyButton) {
                                        historyButton.classList.add("highlight-button");
                                        foundMatch = true;
                                    }
                                }
                            }
                        })
                        .catch(error => console.error("Error loading chat history:", error));
                });

                
            }
        })
        .catch(error => console.error('Error fetching history:', error));
}

// Function to highlight the searched word in the chat messages
function highlightSearchQuery() {
    const chatBox = document.getElementById("chat-box");
    const messages = chatBox.querySelectorAll(".text-message");

    messages.forEach(message => {
        const originalHTML = message.innerHTML;
        const highlightedHTML = originalHTML.replace(
            new RegExp(currentSearchQuery, "gi"),
            (match) => `<span class="highlight">${match}</span>`
        );
        message.innerHTML = highlightedHTML;
    });
}

// Function to load chat history when a history button is clicked
function loadChatHistory(chatId) {
    fetch(`/load_chat_history/${chatId}`)
        .then((response) => response.json())
        .then((data) => {
            if (data.chat_history) {
                // Clear the current chat box
                const chatBox = document.getElementById("chat-box");
                chatBox.innerHTML = '';

                // Append the chat history messages
                data.chat_history.forEach((entry) => {
                    appendMessage(entry.user, "user-message", [], true); // isHistory = true
                    appendMessage(entry.bot, "bot-message", entry.code, true); // isHistory = true
                });

                // Highlight the searched word in the chat messages
                if (currentSearchQuery) {
                    highlightSearchQuery();
                }
            }
        })
        .catch((error) => console.error("Error loading chat history:", error));
}

// Attach the search function to the search button
document.getElementById("search-button").addEventListener("click", searchChat);

// Enable search on Enter key press
document.getElementById("search-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault(); // Prevent default behavior (e.g., form submission)
        searchChat(); // Trigger search
    }
});

// Update the history button creation to include a data attribute for chat ID
window.onload = function() {
    fetch('/get_history')
        .then(response => response.json())
        .then(data => {
            const historyBox = document.getElementById('history-box');
            if (data.history) {
                data.history.forEach(chat => {
                    const historyButton = document.createElement("button");
                    historyButton.classList.add("history-button");
                    historyButton.innerText = chat.date;  // Show the date of the chat
                    historyButton.setAttribute("data-chat-id", chat.chat_id); // Add chat ID as data attribute
                    historyButton.onclick = () => loadChatHistory(chat.chat_id); // On click, load history

                    // Insert the new history button at the top
                    historyBox.insertBefore(historyButton, historyBox.firstChild);
                });
            }
        })
        .catch(error => console.error('Error fetching history:', error));
};
// Define custom questions and answers
const customResponses = {
    "what is your name": "I am Mohan's Mini Chatbot, and I am here to help you!",
    "who are you": "I am Mohan's Mini Chatbot, and I am here to help you!",
    "who is your founder": "My boss is Mr. Mohan.",
    "who created you": "My boss is Mr. Mohan.",
    "who is your boss": "My boss is Mr. Mohan.",
    "what can you do": "I can help you with a variety of tasks, such as answering questions, analyzing files, and more!",
    "how are you": "I'm fine thankyou!",
    "what is your purpose": "My purpose is to assist you with your queries and make your life easier.",
};

// Function to check for custom responses
function getCustomResponse(userMessage) {
    const lowerCaseMessage = userMessage.toLowerCase().trim();
    for (const [question, answer] of Object.entries(customResponses)) {
        if (lowerCaseMessage.includes(question)) {
            return answer;
        }
    }
    return null; // Return null if no custom response is found
}

function isYouTubeUrl(message) {
    const patterns = [
        /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=/i,
        /^(https?:\/\/)?(www\.)?youtu\.be\//i,
        /^(https?:\/\/)?(www\.)?youtube\.com\/embed\//i
    ];
    return patterns.some(pattern => pattern.test(message.trim()));
}

function displayYouTubeResponse(data) {
    let message;
    
    if (data.error) {
        message = `Error: ${data.error}`;
    } 
    else if (data.success) {
        // Successful analysis with transcript
        message = data.summary;
    } 
    else {
        // Fallback analysis without transcript
        message = data.message || "Couldn't analyze this video";
    }
    
    // Simple text append without HTML
    appendMessage(message, "bot-message");
}

// Helper functions
function formatDuration(duration) {
    // Convert ISO 8601 duration to HH:MM:SS
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] ? match[1].slice(0, -1) : '0').padStart(2, '0');
    const mins = (match[2] ? match[2].slice(0, -1) : '0').padStart(2, '0');
    const secs = (match[3] ? match[3].slice(0, -1) : '0').padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}