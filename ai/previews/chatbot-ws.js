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
    remove,
    limitToLast
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

class EnhancedChatbot {
    constructor() {
        this.firebaseConfig = {
            apiKey: "YOUR_API_KEY",
            authDomain: "YOUR_AUTH_DOMAIN",
            databaseURL: "YOUR_DATABASE_URL",
            projectId: "YOUR_PROJECT_ID",
            storageBucket: "YOUR_STORAGE_BUCKET",
            messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
            appId: "YOUR_APP_ID"
        };

        // Enhanced model configuration
        this.model = new brain.recurrent.LSTM({
            hiddenLayers: [256, 128], // Increased layer size
            learningRate: 0.005,
            activation: 'leaky-relu',
            errorThresh: 0.001,
            momentum: 0.9,
            beta1: 0.9,
            beta2: 0.999
        });

        // Memory and context management
        this.conversationMemory = new Map();
        this.contextWindow = [];
        this.maxContextLength = 10;
        this.knowledgeBase = new Map();
        this.lastTrainingTime = null;
        this.trainingInterval = 1800000; // 30 minutes

        // Wikipedia API configuration
        this.wikiApiEndpoint = 'https://en.wikipedia.org/w/api.php';
        this.maxConcurrentRequests = 3;
        this.requestQueue = [];
        this.isProcessingQueue = false;

        // Initialize components
        this.initializeComponents();
    }

    async initializeComponents() {
        try {
            await this.initializeFirebase();
            await this.initializeUI();
            await this.loadKnowledgeBase();
            await this.initializeModel();
            this.setupEventListeners();
        } catch (error) {
            console.error('Initialization error:', error);
            this.handleError(error);
        }
    }

    async initializeFirebase() {
        const app = initializeApp(this.firebaseConfig);
        this.auth = getAuth(app);
        this.db = getDatabase(app);
        
        return new Promise((resolve, reject) => {
            onAuthStateChanged(this.auth, user => {
                this.userId = user?.uid;
                resolve();
            });
        });
    }

    async initializeUI() {
        this.ui = {
            chatWindow: document.getElementById('chatWindow'),
            userInput: document.getElementById('userInput'),
            sendButton: document.getElementById('sendBtn'),
            clearButton: document.getElementById('clearBtn'),
            statusIndicator: document.getElementById('status'),
            typingIndicator: document.querySelector('.typing-indicator')
        };

        if (!Object.values(this.ui).every(element => element)) {
            throw new Error('Missing UI elements');
        }
    }

    async loadKnowledgeBase() {
        if (!this.userId) return;

        const knowledgeRef = ref(this.db, `users/${this.userId}/knowledge`);
        const snapshot = await get(knowledgeRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.entries(data).forEach(([key, value]) => {
                this.knowledgeBase.set(key, value);
            });
        }
    }

    async initializeModel() {
        try {
            const trainingData = await this.generateTrainingData();
            await this.trainModel(trainingData);
            this.lastTrainingTime = Date.now();
        } catch (error) {
            console.error('Model initialization error:', error);
            throw error;
        }
    }

    async generateTrainingData() {
        const baseTrainingData = this.getDefaultTrainingData();
        const wikiTrainingData = await this.generateWikiTrainingData();
        const userTrainingData = Array.from(this.knowledgeBase.values());

        return [...baseTrainingData, ...wikiTrainingData, ...userTrainingData];
    }

    getDefaultTrainingData() {
        return [
            { input: "hello", output: "Hello! How can I assist you today?" },
            { input: "how are you", output: "I'm functioning well and ready to help! What can I do for you?" },
            { input: "bye", output: "Goodbye! Feel free to return if you need assistance." }
        ];
    }

    async generateWikiTrainingData() {
        const topics = ['artificial intelligence', 'machine learning', 'neural networks', 'deep learning'];
        const trainingData = [];

        for (const topic of topics) {
            const wikiData = await this.fetchWikipediaData(topic);
            if (wikiData) {
                trainingData.push({
                    input: `what is ${topic}?`,
                    output: wikiData.summary
                });

                // Generate additional training pairs from content
                const sentences = wikiData.content.split(/[.!?]+/).filter(s => s.trim());
                for (let i = 0; i < sentences.length - 1; i++) {
                    trainingData.push({
                        input: sentences[i].trim(),
                        output: sentences[i + 1].trim()
                    });
                }
            }
        }

        return trainingData;
    }

    async fetchWikipediaData(topic) {
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            prop: 'extracts',
            exintro: 'true',
            explaintext: 'true',
            titles: topic,
            origin: '*'
        });

        try {
            const response = await fetch(`${this.wikiApiEndpoint}?${params}`);
            const data = await response.json();
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            const extract = pages[pageId].extract;

            if (extract) {
                return {
                    summary: extract.split('\n')[0],
                    content: extract
                };
            }
        } catch (error) {
            console.error(`Error fetching Wikipedia data for ${topic}:`, error);
            return null;
        }
    }

    async trainModel(trainingData) {
        return new Promise((resolve, reject) => {
            try {
                let iteration = 0;
                const trainingConfig = {
                    iterations: 1000,
                    errorThresh: 0.001,
                    log: stats => {
                        iteration++;
                        if (iteration % 100 === 0) {
                            this.updateStatus(`Training: ${iteration}/1000 (Error: ${stats.error.toFixed(6)})`);
                        }
                    },
                    logPeriod: 100
                };

                this.model.train(trainingData, trainingConfig);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    async processUserInput(input) {
        const sanitizedInput = this.sanitizeInput(input);
        this.updateContext(sanitizedInput);

        try {
            // Generate response using the trained model
            const baseResponse = await this.model.run(sanitizedInput);
            
            // Enhance response with Wikipedia data if needed
            const enhancedResponse = await this.enhanceResponseWithWikiData(sanitizedInput, baseResponse);
            
            // Save conversation to Firebase
            await this.saveConversation(input, enhancedResponse);
            
            return enhancedResponse;
        } catch (error) {
            console.error('Error processing input:', error);
            return "I apologize, but I'm having trouble processing that request. Could you try rephrasing?";
        }
    }

    async enhanceResponseWithWikiData(input, baseResponse) {
        const keywords = this.extractKeywords(input);
        let enhancedResponse = baseResponse;

        for (const keyword of keywords) {
            const wikiData = await this.fetchWikipediaData(keyword);
            if (wikiData && wikiData.summary) {
                enhancedResponse += `\n\nAdditionally, regarding ${keyword}: ${wikiData.summary}`;
            }
        }

        return enhancedResponse;
    }

    extractKeywords(text) {
        const stopWords = new Set(['the', 'is', 'at', 'which', 'on']);
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        return words.filter(word => !stopWords.has(word) && word.length > 3);
    }

    sanitizeInput(input) {
        return input.toLowerCase()
            .replace(/[^\w\s?!.,]/g, '')
            .trim();
    }

    updateContext(input) {
        this.contextWindow.push(input);
        if (this.contextWindow.length > this.maxContextLength) {
            this.contextWindow.shift();
        }
    }

    async saveConversation(input, response) {
        if (!this.userId) return;

        const conversationRef = ref(this.db, `users/${this.userId}/conversations`);
        const newConversationRef = push(conversationRef);
        
        await set(newConversationRef, {
            timestamp: Date.now(),
            input,
            response,
            context: this.contextWindow.slice()
        });
    }

    setupEventListeners() {
        this.ui.sendButton.addEventListener('click', () => this.handleSend());
        this.ui.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });
        this.ui.clearButton.addEventListener('click', () => this.clearChat());
    }

    async handleSend() {
        const input = this.ui.userInput.value.trim();
        if (!input) return;

        this.ui.userInput.value = '';
        this.ui.userInput.disabled = true;
        this.ui.sendButton.disabled = true;
        this.ui.typingIndicator.style.display = 'block';

        try {
            this.addMessage(input, 'user');
            const response = await this.processUserInput(input);
            this.addMessage(response, 'bot');
        } catch (error) {
            console.error('Error handling input:', error);
            this.addMessage("I'm sorry, but I encountered an error. Please try again.", 'bot');
        } finally {
            this.ui.userInput.disabled = false;
            this.ui.sendButton.disabled = false;
            this.ui.typingIndicator.style.display = 'none';
            this.ui.userInput.focus();
        }
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const content = document.createElement('p');
        content.textContent = text;
        
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        messageDiv.appendChild(content);
        messageDiv.appendChild(timestamp);
        
        this.ui.chatWindow.appendChild(messageDiv);
        this.ui.chatWindow.scrollTop = this.ui.chatWindow.scrollHeight;
    }

    async clearChat() {
        while (this.ui.chatWindow.firstChild) {
            this.ui.chatWindow.removeChild(this.ui.chatWindow.firstChild);
        }
        
        this.contextWindow = [];
        this.addMessage("Chat cleared. How can I help you?", 'bot');
        
        if (this.userId) {
            const conversationRef = ref(this.db, `users/${this.userId}/conversations`);
            await remove(conversationRef);
        }
    }

    updateStatus(message, type = 'info') {
        this.ui.statusIndicator.textContent = message;
        this.ui.statusIndicator.className = `status ${type}`;
    }

    handleError(error) {
        console.error('Chatbot error:', error);
        this.updateStatus(error.message || 'An error occurred', 'error');
    }
}

// Initialize chatbot when the page loads
window.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof brain === 'undefined') {
            throw new Error('Brain.js library not loaded');
        }
        window.chatbot = new EnhancedChatbot();
    } catch (error) {
        console.error('Initialization error:', error);
        const status = document.getElementById('status');
        if (status) {
            status.textContent = 'Error: Failed to initialize chatbot';
            status.className = 'error';
        }
    }
});

export default EnhancedChatbot;
