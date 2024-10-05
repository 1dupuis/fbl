// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
    getDatabase,
    ref, 
    set, 
    get, 
    push, 
    query, 
    orderByChild, 
    equalTo,
    onValue,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";
//import { resetInactivityTimer } from '/background/access.js';

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAToB2gXmzCK4t-1dW5urnGG87gbK6MxR8",
    authDomain: "dupuis-lol.firebaseapp.com",
    databaseURL: "https://dupuis-lol-default-rtdb.firebaseio.com",
    projectId: "dupuis-lol",
    storageBucket: "dupuis-lol.appspot.com",
    messagingSenderId: "807402660080",
    appId: "1:807402660080:web:545d4e1287f5803ebda235",
    measurementId: "G-TR8JMF5FRY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

class EnhancedChatbot {
    constructor() {
        this.net = new brain.recurrent.LSTM({
            hiddenLayers: [64, 32],
            learningRate: 0.008,
            activation: 'leaky-relu',
            errorThresh: 0.003
        });

        this.contextWindow = [];
        this.maxContextLength = 6;
        this.isTraining = false;
        this.isInitialized = false;
        this.userId = null;
        this.userProfile = null;

        this.elements = {
            userInput: null,
            sendBtn: null,
            chatWindow: null,
            typingIndicator: null,
            status: null,
            clearBtn: null,
        };

        // Delay initialization to ensure DOM is fully loaded
        window.addEventListener('DOMContentLoaded', () => {
            this.initializeElements();
            this.initialize().catch(this.handleError.bind(this));
        });
    }

    async initialize() {
        try {
            this.updateStatus('Initializing...', 'loading');
            await this.initializeFirebase();
            await this.loadUserProfile();
            await this.loadTrainingData();
            await this.trainNetwork();
            this.isInitialized = true;
            this.updateStatus('Ready to chat!', 'success');
            this.setInterfaceEnabled(true);
            this.setupEventListeners();
            this.loadPreviousConversation();
        } catch (error) {
            throw new Error('Initialization failed: ' + error.message);
        }
    }

    initializeElements() {
        this.elements = {
            userInput: document.getElementById('userInput'),
            sendBtn: document.getElementById('sendBtn'),
            chatWindow: document.getElementById('chatWindow'),
            typingIndicator: document.querySelector('.typing-indicator'),
            status: document.getElementById('status'),
            clearBtn: document.getElementById('clearBtn'),
        };

        // Check if all required elements are present
        const missingElements = Object.entries(this.elements)
            .filter(([key, value]) => !value)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
        }
    }

    async initializeFirebase() {
        return new Promise((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe(); // Unsubscribe to avoid memory leaks
                if (user) {
                    this.userId = user.uid;
                    resolve();
                } else {
                    //this.updateStatus('Please log in.', 'error');
                    //reject(new Error('User not authenticated'));
                }
            });
        });
    }

    async loadUserProfile() {
        if (!this.userId) throw new Error('User ID not set');
        const userProfileRef = ref(database, `users/${this.userId}/profile`);
        const snapshot = await get(userProfileRef);
        if (snapshot.exists()) {
            this.userProfile = snapshot.val();
        } else {
            // Initialize with default profile if none exists
            this.userProfile = { name: 'User', preferences: {} };
            await set(userProfileRef, this.userProfile);
        }
    }

    async loadTrainingData() {
        const trainingDataRef = ref(database, 'trainingData');
        try {
            const snapshot = await get(trainingDataRef);
            if (snapshot.exists()) {
                this.trainingData = snapshot.val();
            } else {
                // Initialize with default data if none exists
                this.trainingData = [
                    { input: "hello", output: "Hi! How can I help you?" },
                    { input: "how are you", output: "I'm here to assist you. What can I do for you today?" },
                    { input: "what can you do", output: "I can answer questions, provide information, and help with various tasks. What do you need help with?" },
                    { input: "bye", output: "Goodbye! Feel free to come back if you need any more assistance." },
                    { input: "thanks", output: "You're welcome! Is there anything else I can help you with?" }
                ];
                await set(trainingDataRef, this.trainingData);
            }
        } catch (error) {
            console.error('Error loading training data:', error);
            // Fallback to default data if loading fails
            this.trainingData = [
                { input: "hello", output: "Hi! How can I help you?" },
                { input: "how are you", output: "I'm here to assist you. What can I do for you today?" }
            ];
        }
    }

    async trainNetwork() {
        this.isTraining = true;
        try {
            await this.net.train(this.trainingData, {
                iterations: 500,
                errorThresh: 0.003,
                log: true,
                logPeriod: 100,
                callback: stats => {
                    this.updateStatus(`Training: Error ${stats.error.toFixed(4)}`, 'loading');
                }
            });
        } catch (error) {
            console.error('Training error:', error);
            this.updateStatus('Error in training. Using fallback responses.', 'error');
        } finally {
            this.isTraining = false;
        }
    }

    preprocessInput(text) {
        return text.toLowerCase()
            .replace(/[^\w\s?!.,]/g, '')
            .trim();
    }

    async getResponse(userInput) {
        const sanitizedInput = this.preprocessInput(userInput);
        
        // Add context to the input
        const contextualInput = [...this.contextWindow, sanitizedInput].join(' ');
        
        try {
            let response = await this.net.run(contextualInput);
            
            // If the response is empty or irrelevant, try without context
            if (!response || response === "I'm not quite sure how to respond to that.") {
                response = await this.net.run(sanitizedInput);
            }
            
            const finalResponse = response || "I'm not quite sure how to respond to that. Could you rephrase?";
            
            // Update context window
            this.contextWindow.push(sanitizedInput);
            this.contextWindow = this.contextWindow.slice(-this.maxContextLength);
            
            // Save conversation to Firebase
            await this.saveConversation(userInput, finalResponse);
            
            return finalResponse;
        } catch (error) {
            console.error('Response generation error:', error);
            return "I'm having trouble processing that. Could you try saying it differently?";
        }
    }

    async saveConversation(userInput, botResponse) {
        if (!this.userId) return;

        const conversationRef = ref(database, `users/${this.userId}/conversations`);
        const newConversationRef = push(conversationRef);
        try {
            await set(newConversationRef, {
                timestamp: Date.now(),
                userInput: userInput,
                botResponse: botResponse
            });
        } catch (error) {
            console.error('Error saving conversation:', error);
            // Optionally, notify the user that the conversation couldn't be saved
        }
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        
        const content = document.createElement('div');
        content.classList.add('message-content');
        content.textContent = text;
        
        const time = document.createElement('div');
        time.classList.add('message-time');
        time.textContent = this.formatTime();
        
        messageDiv.appendChild(content);
        messageDiv.appendChild(time);
        
        this.elements.chatWindow.appendChild(messageDiv);
        this.elements.chatWindow.scrollTop = this.elements.chatWindow.scrollHeight;
    }

    async clearChat() {
        while (this.elements.chatWindow.firstChild) {
            this.elements.chatWindow.removeChild(this.elements.chatWindow.firstChild);
        }
        this.addMessage("Chat cleared. How can I help you?", 'bot');
        
        // Clear conversation history in Firebase
        if (this.userId) {
            const conversationRef = ref(database, `users/${this.userId}/conversations`);
            try {
                await remove(conversationRef);
            } catch (error) {
                console.error('Error clearing conversation history:', error);
                this.updateStatus('Failed to clear conversation history.', 'error');
            }
        }
    }

    async handleUserInput() {
        const userInput = this.elements.userInput.value.trim();
        
        if (!userInput || !this.isInitialized || this.isTraining) return;

        this.elements.userInput.value = '';
        this.setInterfaceEnabled(false);
        
        this.addMessage(userInput, 'user');
        this.elements.typingIndicator.style.display = 'inline-flex';

        try {
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
            const response = await this.getResponse(userInput);
            this.addMessage(response, 'bot');
        } catch (error) {
            this.handleError('Failed to generate response. Please try again.');
            this.addMessage("I apologize, but I'm having trouble right now. Please try again.", 'bot');
        } finally {
            this.elements.typingIndicator.style.display = 'none';
            this.setInterfaceEnabled(true);
            this.elements.userInput.focus();
        }
    }

    setupEventListeners() {
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.handleUserInput());
        }

        if (this.elements.userInput) {
            this.elements.userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleUserInput();
                }
            });

            this.elements.userInput.addEventListener('focus', () => {
                if (this.elements.status && this.elements.status.classList.contains('error')) {
                    this.updateStatus('Ready to chat!', 'success');
                }
            });
        }

        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => this.clearChat());
        }

        window.addEventListener('online', () => {
            if (this.isInitialized) {
                this.updateStatus('Connection restored!', 'success');
                setTimeout(() => {
                    if (this.isInitialized) {
                        this.updateStatus('Ready to chat!', 'success');
                    }
                }, 2000);
            }
        });

        window.addEventListener('offline', () => {
            this.updateStatus('Connection lost. Please check your internet connection.', 'error');
        });

        window.addEventListener('beforeunload', (e) => {
            if (this.elements.userInput && this.elements.userInput.value.trim()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    updateStatus(message, type = '') {
        if (this.elements.status) {
            this.elements.status.textContent = message;
            this.elements.status.className = type;
        } else {
            console.warn('Status element not found. Status update:', message, type);
        }
    }

    setInterfaceEnabled(enabled) {
        if (this.elements.userInput) {
            this.elements.userInput.disabled = !enabled;
        }
        if (this.elements.sendBtn) {
            this.elements.sendBtn.disabled = !enabled;
        }
        if (enabled && this.elements.userInput) {
            this.elements.userInput.focus();
        }
    }

    handleError(error) {
        console.error('Chatbot error:', error);
        this.updateStatus(typeof error === 'string' ? error : 'An error occurred. Please refresh the page.', 'error');
        this.setInterfaceEnabled(false);
    }

    formatTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    async loadPreviousConversation() {
        if (!this.userId) return;

        const conversationRef = ref(database, `users/${this.userId}/conversations`);
        const recentConversationsQuery = query(conversationRef, orderByChild('timestamp'), limitToLast(10));

        try {
            const snapshot = await get(recentConversationsQuery);
            if (snapshot.exists()) {
                const conversations = [];
                snapshot.forEach((childSnapshot) => {
                    conversations.push(childSnapshot.val());
                });
                conversations.sort((a, b) => a.timestamp - b.timestamp);
                
                conversations.forEach(conv => {
                    this.addMessage(conv.userInput, 'user');
                    this.addMessage(conv.botResponse, 'bot');
                });
            }
        } catch (error) {
            console.error('Error loading previous conversations:', error);
            this.updateStatus('Failed to load previous conversations.', 'error');
        }
    }
}

// Initialize the chatbot when the page loads
window.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof brain === 'undefined') {
            throw new Error('Brain.js library not loaded');
        }
        window.chatbot = new EnhancedChatbot();
    } catch (error) {
        const status = document.getElementById('status');
        status.textContent = 'Error: Failed to initialize chatbot. Please refresh the page.';
        status.className = 'error';
        console.error('Initialization error:', error);
    }
});

const chatbot = new EnhancedChatbot();
