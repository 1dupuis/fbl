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
    remove,
    limitToLast
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

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

class EnhancedChatbot {
    constructor() {
        // Enhanced LSTM configuration
        this.net = new brain.recurrent.LSTM({
            hiddenLayers: [128, 64],
            learningRate: 0.01,
            activation: 'leaky-relu',
            errorThresh: 0.0025,
            momentum: 0.9,
            beta1: 0.9,
            beta2: 0.999
        });

        this.contextWindow = [];
        this.maxContextLength = 8;
        this.isTraining = false;
        this.isInitialized = false;
        this.userId = null;
        this.userProfile = null;
        this.webData = new Map();
        this.lastScrapingTime = null;
        this.scrapingInterval = 3600000; // 1 hour

        this.elements = {
            userInput: null,
            sendBtn: null,
            chatWindow: null,
            typingIndicator: null,
            status: null,
            clearBtn: null,
        };

        this.initializeApp();
    }

    async initializeApp() {
        const app = initializeApp(firebaseConfig);
        this.auth = getAuth(app);
        this.database = getDatabase(app);
        
        window.addEventListener('DOMContentLoaded', () => {
            this.initializeElements();
            this.initialize().catch(this.handleError.bind(this));
        });
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

        const missingElements = Object.entries(this.elements)
            .filter(([key, value]) => !value)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
        }
    }

    async initialize() {
        try {
            this.updateStatus('Initializing...', 'loading');
            await this.initializeFirebase();
            await this.loadUserProfile();
            await this.loadTrainingData();
            await this.enhancedTraining();
            await this.initialWebScrape();
            this.isInitialized = true;
            this.updateStatus('Ready to chat!', 'success');
            this.setInterfaceEnabled(true);
            this.setupEventListeners();
            this.loadPreviousConversation();
        } catch (error) {
            throw new Error('Initialization failed: ' + error.message);
        }
    }

    async initializeFirebase() {
        return new Promise((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(this.auth, (user) => {
                unsubscribe();
                if (user) {
                    this.userId = user.uid;
                    resolve();
                } else {
                    resolve(); // Allow anonymous use
                }
            });
        });
    }

    async loadUserProfile() {
        if (!this.userId) return;
        
        const userProfileRef = ref(this.database, `users/${this.userId}/profile`);
        const snapshot = await get(userProfileRef);
        
        if (snapshot.exists()) {
            this.userProfile = snapshot.val();
        } else {
            this.userProfile = { name: 'User', preferences: {} };
            await set(userProfileRef, this.userProfile);
        }
    }

    async loadTrainingData() {
        const trainingDataRef = ref(this.database, 'trainingData');
        try {
            const snapshot = await get(trainingDataRef);
            if (snapshot.exists()) {
                this.trainingData = snapshot.val();
            } else {
                this.trainingData = this.getDefaultTrainingData();
                await set(trainingDataRef, this.trainingData);
            }
        } catch (error) {
            console.error('Error loading training data:', error);
            this.trainingData = this.getDefaultTrainingData();
        }
    }

    getDefaultTrainingData() {
        return [
            { input: "hello", output: "Hi! How can I help you?" },
            { input: "how are you", output: "I'm doing well and ready to help! What can I do for you?" },
            { input: "what can you do", output: "I can help with various tasks, answer questions, and learn from our conversations. What would you like to know?" },
            { input: "bye", output: "Goodbye! Feel free to return if you need more help." },
            { input: "thanks", output: "You're welcome! Let me know if you need anything else." }
        ];
    }

    async initialWebScrape() {
        const initialTopics = ['artificial intelligence', 'machine learning', 'neural networks'];
        for (const topic of initialTopics) {
            await this.scrapeWebContent(topic);
        }
    }

    async scrapeWebContent(query) {
        try {
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const searchUrl = encodeURIComponent(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&titles=${query}`);
            
            const response = await fetch(proxyUrl + searchUrl);
            if (!response.ok) throw new Error('Scraping failed');
            
            const data = await response.json();
            const content = this.processScrapedContent(data);
            
            this.webData.set(query, {
                content,
                timestamp: Date.now()
            });
            
            return content;
        } catch (error) {
            console.error('Scraping error:', error);
            return null;
        }
    }

    processScrapedContent(data) {
        // Extract the actual content from Wikipedia API response
        const pages = data.query?.pages || {};
        const pageId = Object.keys(pages)[0];
        const extract = pages[pageId]?.extract || '';

        // Clean the HTML content
        const cleanText = extract
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        return {
            summary: this.generateSummary(cleanText),
            keywords: this.extractKeywords(cleanText),
            fullText: cleanText
        };
    }

    generateSummary(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        return sentences.slice(0, 2).join('. ') + '.';
    }

    extractKeywords(text) {
        const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'of', 'for']);
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        
        return words
            .filter(word => !stopWords.has(word) && word.length > 3)
            .reduce((acc, word) => {
                acc[word] = (acc[word] || 0) + 1;
                return acc;
            }, {});
    }

    async enhancedTraining() {
        this.isTraining = true;
        try {
            const combinedData = [
                ...this.trainingData,
                ...this.generateWebDataTrainingPairs()
            ];

            await this.net.train(combinedData, {
                iterations: 250,
                errorThresh: 0.0025,
                log: true,
                logPeriod: 10,
                learningRate: 0.01,
                momentum: 0.9,
                callback: stats => {
                    this.updateStatus(`Training: Error ${stats.error.toFixed(4)}`, 'loading');
                    if (stats.error < 0.01) return true;
                }
            });
        } catch (error) {
            console.error('Training error:', error);
            this.updateStatus('Error in training. Using fallback responses.', 'error');
        } finally {
            this.isTraining = false;
        }
    }

    generateWebDataTrainingPairs() {
        const pairs = [];
        this.webData.forEach((data, topic) => {
            const { summary, keywords } = data.content;
            pairs.push({
                input: `what is ${topic}`,
                output: summary
            });
            
            // Generate additional training pairs from keywords
            Object.keys(keywords).forEach(keyword => {
                if (summary.includes(keyword)) {
                    pairs.push({
                        input: `tell me about ${keyword}`,
                        output: summary
                    });
                }
            });
        });
        return pairs;
    }

    async getResponse(userInput) {
        const sanitizedInput = this.preprocessInput(userInput);
        const context = [...this.contextWindow, sanitizedInput].join(' ');
        
        try {
            let response = await this.net.run(context);
            const confidence = this.getResponseConfidence(response);
            
            if (confidence < 0.7) {
                const webInfo = await this.getRelevantWebInfo(sanitizedInput);
                if (webInfo) {
                    response = this.enhanceResponseWithWebInfo(response, webInfo);
                }
            }
            
            this.updateContext(sanitizedInput, response);
            await this.saveConversation(userInput, response);
            
            return response || "I'm not quite sure about that. Could you rephrase?";
        } catch (error) {
            console.error('Response generation error:', error);
            return "I'm having trouble processing that. Could you try again?";
        }
    }

    getResponseConfidence(response) {
        if (!response) return 0;
        
        const wordCount = response.split(/\s+/).length;
        const hasKeyPhrases = /\b(because|therefore|however|specifically)\b/i.test(response);
        const hasNumbers = /\d+/.test(response);
        const hasTechnicalTerms = /\b(algorithm|process|system|method)\b/i.test(response);
        
        return Math.min(
            1,
            (wordCount / 20) * 0.4 +
            (hasKeyPhrases ? 0.2 : 0) +
            (hasNumbers ? 0.2 : 0) +
            (hasTechnicalTerms ? 0.1 : 0) +
            0.1 // Base confidence
        );
    }

    async getRelevantWebInfo(query) {
        const keywords = this.extractKeywords(query);
        const relevantData = [];
        
        for (const [topic, data] of this.webData.entries()) {
            const overlap = this.calculateKeywordOverlap(keywords, data.content.keywords);
            if (overlap > 0.3) {
                relevantData.push(data.content);
            }
        }
        
        if (relevantData.length === 0) {
            const newData = await this.scrapeWebContent(query);
            if (newData) relevantData.push(newData);
        }
        
        return relevantData;
    }

    calculateKeywordOverlap(keywords1, keywords2) {
        const set1 = new Set(Object.keys(keywords1));
        const set2 = new Set(Object.keys(keywords2));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        return intersection.size / Math.max(set1.size, set2.size);
    }

    enhanceResponseWithWebInfo(baseResponse, webInfo) {
        if (!webInfo || webInfo.length === 0) return baseResponse;
        
        const webSummaries = webInfo
            .map(info => info.summary)
            .join(' ');
            
        return baseResponse ? 
            `${baseResponse} Additionally, ${webSummaries}` :
            webSummaries;
    }

    preprocessInput(text) {
        return text.toLowerCase()
            .replace(/[^\w\s?!.,]/g, '')
            .trim();
    }

    updateContext(input, response) {
        this.contextWindow.push(input, response);
        this.contextWindow = this.contextWindow.slice(-this.maxContextLength);
    }

    async saveConversation(userInput, botResponse) {
        if (!this.userId) return;

        const conversationRef = ref(this.database, `users/${this.userId}/conversations`);
        const newConversationRef = push(conversationRef);
        
        try {
            await set(newConversationRef, {
                timestamp: Date.now(),
                userInput: userInput,
                botResponse: botResponse
            });
        } catch (error) {
            console.error('Error saving conversation:', error);
        }
    }

    async loadPreviousConversation() {
        if (!this.userId) return;

        const conversationRef = ref(this.database, `users/${this.userId}/conversations`);
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

    async handleUserInput() {
        const userInput = this.elements.userInput.value.trim();
        
        if (!userInput || !this.isInitialized || this.isTraining) return;

        this.elements.userInput.value = '';
        this.setInterfaceEnabled(false);
        
        this.addMessage(userInput, 'user');
        this.elements.typingIndicator.style.display = 'inline-flex';

        try {
            // Add artificial delay for more natural conversation flow
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
            
            const response = await this.getResponse(userInput);
            this.addMessage(response, 'bot');
            
            // Trigger background web scraping for continuous learning
            this.backgroundScrape(userInput).catch(console.error);
            
        } catch (error) {
            this.handleError('Failed to generate response. Please try again.');
            this.addMessage("I apologize, but I'm having trouble right now. Please try again.", 'bot');
        } finally {
            this.elements.typingIndicator.style.display = 'none';
            this.setInterfaceEnabled(true);
            this.elements.userInput.focus();
        }
    }

    async backgroundScrape(userInput) {
        // Extract potential topics for background scraping
        const keywords = this.extractKeywords(userInput);
        const topKeywords = Object.entries(keywords)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([word]) => word);

        // Scrape in the background without blocking the conversation
        for (const keyword of topKeywords) {
            if (!this.webData.has(keyword) || 
                Date.now() - this.webData.get(keyword).timestamp > this.scrapingInterval) {
                this.scrapeWebContent(keyword).catch(console.error);
            }
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
        
        this.contextWindow = []; // Clear context window
        this.addMessage("Chat cleared. How can I help you?", 'bot');
        
        if (this.userId) {
            const conversationRef = ref(this.database, `users/${this.userId}/conversations`);
            try {
                await remove(conversationRef);
            } catch (error) {
                console.error('Error clearing conversation history:', error);
                this.updateStatus('Failed to clear conversation history.', 'error');
            }
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
                if (this.elements.status.classList.contains('error')) {
                    this.updateStatus('Ready to chat!', 'success');
                }
            });
        }

        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => this.clearChat());
        }

        // Network status monitoring
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

        // Prevent accidental navigation when typing
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
        if (status) {
            status.textContent = 'Error: Failed to initialize chatbot. Please refresh the page.';
            status.className = 'error';
        }
        console.error('Initialization error:', error);
    }
});

export default EnhancedChatbot;
