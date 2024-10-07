import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged,
    signInAnonymously
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
            apiKey: "AIzaSyAToB2gXmzCK4t-1dW5urnGG87gbK6MxR8",
            authDomain: "dupuis-lol.firebaseapp.com",
            databaseURL: "https://dupuis-lol-default-rtdb.firebaseio.com",
            projectId: "dupuis-lol",
            storageBucket: "dupuis-lol.appspot.com",
            messagingSenderId: "807402660080",
            appId: "1:807402660080:web:545d4e1287f5803ebda235",
            measurementId: "G-TR8JMF5FRY"
        };

        this.net = new brain.recurrent.LSTM({
            hiddenLayers: [512, 256, 128],
            learningRate: 0.003,
            activation: 'leaky-relu',
            errorThresh: 0.0005
        });

        this.isInitialized = false;
        this.isTraining = false;
        this.userId = null;
        this.userProfile = null;
        this.contextWindow = [];
        this.maxContextLength = 15;
        this.conversationMemory = new Map();
        this.knowledgeBase = new Map();

        this.elements = {};
        this.initializeApp();
    }

    async initializeApp() {
        try {
            const app = initializeApp(this.firebaseConfig);
            this.auth = getAuth(app);
            this.database = getDatabase(app);
            
            await this.initializeAuth();
            this.initializeElements();
            await this.initialize();
        } catch (error) {
            console.error('Initialization error:', error);
            this.handleError(error);
        }
    }

    async initializeAuth() {
        return new Promise((resolve, reject) => {
            onAuthStateChanged(this.auth, (user) => {
                if (user) {
                    this.userId = user.uid;
                    resolve(user);
                } else {
                    signInAnonymously(this.auth)
                        .then((userCredential) => {
                            this.userId = userCredential.user.uid;
                            resolve(userCredential.user);
                        })
                        .catch((error) => reject(error));
                }
            });
        });
    }

    initializeElements() {
        const elements = [
            'userInput', 'sendBtn', 'chatWindow', 'status', 'clearBtn', 'trainBtn'
        ];
        elements.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
        this.elements.typingIndicator = document.querySelector('.typing-indicator');
    }

    async initialize() {
        try {
            this.updateStatus('Initializing...', 'loading');
            
            await Promise.all([
                this.loadUserProfile(),
                this.loadTrainingData(),
                this.loadConversationHistory(),
                this.loadKnowledgeBase()
            ]);

            await this.trainModel();
            
            this.isInitialized = true;
            this.updateStatus('Ready to chat!', 'success');
            this.setInterfaceEnabled(true);
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Initialization failed:', error);
            this.updateStatus('Initialization failed. Please refresh the page.', 'error');
        }
    }

    async loadUserProfile() {
        if (!this.userId) {
            throw new Error('User ID not set');
        }
        
        const userProfileRef = ref(this.database, `users/${this.userId}/profile`);
        const snapshot = await get(userProfileRef);
        
        if (snapshot.exists()) {
            this.userProfile = snapshot.val();
        } else {
            this.userProfile = this.createInitialProfile();
            await set(userProfileRef, this.userProfile);
        }
    }

    createInitialProfile() {
        return {
            createdAt: Date.now(),
            conversations: 0,
            lastActive: Date.now(),
            preferences: {
                theme: 'light',
                language: 'en'
            }
        };
    }

    async loadTrainingData() {
        const trainingDataRef = ref(this.database, 'trainingData');
        const snapshot = await get(trainingDataRef);
        
        if (snapshot.exists()) {
            this.trainingData = snapshot.val();
        } else {
            this.trainingData = this.createInitialTrainingData();
            await set(trainingDataRef, this.trainingData);
        }
    }

    createInitialTrainingData() {
        return [
            { input: "Hello", output: "Hi there! How can I help you today?" },
            { input: "How are you?", output: "I'm functioning well, thank you for asking. How can I assist you?" },
            { input: "What's your name?", output: "I'm an AI assistant created by Anthropic. You can call me Claude." },
            { input: "Goodbye", output: "Goodbye! It was nice chatting with you. Feel free to return if you have any more questions." }
        ];
    }

    async loadConversationHistory() {
        const historyRef = ref(this.database, `users/${this.userId}/conversations`);
        const snapshot = await get(query(historyRef, limitToLast(50)));
        
        if (snapshot.exists()) {
            const history = snapshot.val();
            this.conversationMemory = new Map(Object.entries(history));
        }
    }

    async loadKnowledgeBase() {
        const knowledgeBaseRef = ref(this.database, 'knowledgeBase');
        const snapshot = await get(knowledgeBaseRef);
        
        if (snapshot.exists()) {
            const knowledgeBase = snapshot.val();
            this.knowledgeBase = new Map(Object.entries(knowledgeBase));
        } else {
            // Initialize with some default knowledge
            this.knowledgeBase.set('greeting', ['Hello', 'Hi', 'Hey']);
            this.knowledgeBase.set('farewell', ['Goodbye', 'Bye', 'See you later']);
            await set(knowledgeBaseRef, Object.fromEntries(this.knowledgeBase));
        }
    }

    async trainModel() {
        this.isTraining = true;
        this.updateStatus('Training the model...', 'loading');

        const trainingData = [...this.trainingData, ...this.getConversationTrainingData()];

        try {
            await this.net.train(trainingData, {
                iterations: 1000,
                errorThresh: 0.0005,
                log: true,
                logPeriod: 100
            });
            this.isTraining = false;
            this.updateStatus('Model trained successfully!', 'success');
        } catch (error) {
            console.error('Training error:', error);
            this.updateStatus('Model training failed. Using fallback responses.', 'error');
        }
    }

    getConversationTrainingData() {
        return Array.from(this.conversationMemory.values())
            .flatMap(conversation => 
                conversation.messages.map((message, index, array) => ({
                    input: message.text,
                    output: array[index + 1]?.text || ''
                }))
            )
            .filter(pair => pair.output !== '');
    }

    setupEventListeners() {
        this.elements.sendBtn.addEventListener('click', () => this.handleSendMessage());
        this.elements.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });
        this.elements.clearBtn.addEventListener('click', () => this.clearChat());
        this.elements.trainBtn.addEventListener('click', () => this.handleManualTraining());
    }

    async handleSendMessage() {
        const userInput = this.elements.userInput.value.trim();
        if (!userInput) return;

        this.addMessageToChat('user', userInput);
        this.elements.userInput.value = '';
        this.setInterfaceEnabled(false);
        this.showTypingIndicator();

        try {
            const response = await this.getResponse(userInput);
            this.addMessageToChat('bot', response);
            await this.saveConversation(userInput, response);
        } catch (error) {
            console.error('Error getting response:', error);
            this.addMessageToChat('bot', "I'm sorry, I encountered an error. Please try again.");
        }

        this.hideTypingIndicator();
        this.setInterfaceEnabled(true);
        this.elements.userInput.focus();
    }

    async getResponse(userInput) {
        this.contextWindow.push(userInput);
        if (this.contextWindow.length > this.maxContextLength) {
            this.contextWindow.shift();
        }

        let response;
        try {
            response = await this.net.run(this.contextWindow.join(' '));
            
            if (!response || response.trim() === '') {
                response = this.getFallbackResponse(userInput);
            }

            response = this.enhanceResponseWithKnowledgeBase(response, userInput);
        } catch (error) {
            console.error('Neural network error:', error);
            response = this.getFallbackResponse(userInput);
        }

        this.contextWindow.push(response);
        if (this.contextWindow.length > this.maxContextLength) {
            this.contextWindow.shift();
        }

        return response;
    }

    getFallbackResponse(userInput) {
        const fallbackResponses = [
            "I'm not sure how to respond to that. Could you rephrase your question?",
            "I didn't quite catch that. Can you elaborate?",
            "I'm having trouble understanding. Could you try asking in a different way?",
            "I'm not certain about that. Can you provide more context?"
        ];
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }

    enhanceResponseWithKnowledgeBase(response, userInput) {
        for (const [key, values] of this.knowledgeBase.entries()) {
            if (userInput.toLowerCase().includes(key.toLowerCase())) {
                const randomValue = values[Math.floor(Math.random() * values.length)];
                response = `${randomValue} ${response}`;
                break;
            }
        }
        return response;
    }

    async saveConversation(userInput, botResponse) {
        const conversationRef = ref(this.database, `users/${this.userId}/conversations`);
        const newConversationRef = push(conversationRef);
        
        await set(newConversationRef, {
            timestamp: Date.now(),
            messages: [
                { sender: 'user', text: userInput },
                { sender: 'bot', text: botResponse }
            ]
        });

        // Update user profile
        const userProfileRef = ref(this.database, `users/${this.userId}/profile`);
        await update(userProfileRef, {
            conversations: this.userProfile.conversations + 1,
            lastActive: Date.now()
        });

        // Update local user profile
        this.userProfile.conversations += 1;
        this.userProfile.lastActive = Date.now();
    }

    addMessageToChat(sender, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        
        const contentElement = document.createElement('div');
        contentElement.classList.add('message-content');
        contentElement.textContent = text;
        
        const timeElement = document.createElement('div');
        timeElement.classList.add('message-time');
        timeElement.textContent = new Date().toLocaleTimeString();
        
        messageElement.appendChild(contentElement);
        messageElement.appendChild(timeElement);
        
        this.elements.chatWindow.appendChild(messageElement);
        this.elements.chatWindow.scrollTop = this.elements.chatWindow.scrollHeight;
    }

    setInterfaceEnabled(enabled) {
        this.elements.userInput.disabled = !enabled;
        this.elements.sendBtn.disabled = !enabled;
        this.elements.clearBtn.disabled = !enabled;
        this.elements.trainBtn.disabled = !enabled;
    }

    showTypingIndicator() {
        this.elements.typingIndicator.style.display = 'flex';
    }

    hideTypingIndicator() {
        this.elements.typingIndicator.style.display = 'none';
    }

    updateStatus(message, type) {
        this.elements.status.textContent = message;
        this.elements.status.className = `status ${type}`;
    }

    clearChat() {
        this.elements.chatWindow.innerHTML = '';
        this.contextWindow = [];
    }

    handleError(error) {
        console.error('Error:', error);
        this.updateStatus(`An error occurred: ${error.message}`, 'error');
    }

    async handleManualTraining() {
        this.updateStatus('Starting manual training...', 'loading');
        this.setInterfaceEnabled(false);

        try {
            await this.loadTrainingData();
            await this.trainModel();
            this.updateStatus('Manual training completed successfully!', 'success');
        } catch (error) {
            console.error('Manual training error:', error);
            this.updateStatus('Manual training failed. Please try again.', 'error');
        }

        this.setInterfaceEnabled(true);
    }

    async scrapeWebContent(url) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Extract relevant content (e.g., paragraphs, headings, lists)
            const elements = Array.from(doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol'));
            const extractedContent = elements.map(el => ({
                type: el.tagName.toLowerCase(),
                content: el.textContent.trim()
            }));
            
            // Process and add to knowledge base
            for (const item of extractedContent) {
                const keywords = this.extractKeywords(item.content);
                for (const keyword of keywords) {
                    if (!this.knowledgeBase.has(keyword)) {
                        this.knowledgeBase.set(keyword, []);
                    }
                    this.knowledgeBase.get(keyword).push({
                        type: item.type,
                        content: item.content
                    });
                }
            }

            // Save updated knowledge base to Firebase
            const knowledgeBaseRef = ref(this.database, 'knowledgeBase');
            await set(knowledgeBaseRef, Object.fromEntries(this.knowledgeBase));

            console.log(`Successfully scraped and processed content from ${url}`);
            this.updateStatus(`Content scraped from ${url}`, 'success');
        } catch (error) {
            console.error('Error scraping web content:', error);
            this.updateStatus(`Failed to scrape content from ${url}`, 'error');
        }
    }

    extractKeywords(text) {
        // Simple keyword extraction (you can replace this with a more sophisticated algorithm)
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
        return words.filter(word => word.length > 3 && !stopWords.has(word));
    }

    async handleWebScraping(url) {
        this.updateStatus('Starting web scraping...', 'loading');
        this.setInterfaceEnabled(false);

        try {
            await this.scrapeWebContent(url);
            this.updateStatus('Web scraping completed successfully!', 'success');
        } catch (error) {
            console.error('Web scraping error:', error);
            this.updateStatus('Web scraping failed. Please try again.', 'error');
        }

        this.setInterfaceEnabled(true);
    }

    enhanceResponseWithKnowledgeBase(response, userInput) {
        const userKeywords = this.extractKeywords(userInput);
        let relevantContent = [];

        for (const keyword of userKeywords) {
            if (this.knowledgeBase.has(keyword)) {
                relevantContent = relevantContent.concat(this.knowledgeBase.get(keyword));
            }
        }

        if (relevantContent.length > 0) {
            // Select a random piece of relevant content
            const selectedContent = relevantContent[Math.floor(Math.random() * relevantContent.length)];
            
            // Incorporate the content into the response
            response = `Based on my knowledge: "${selectedContent.content}" ${response}`;
        }

        return response;
    }

    setupEventListeners() {
        // ... (previous event listeners)
        this.elements.scrapeBtn = document.getElementById('scrapeBtn');
        this.elements.scrapeUrlInput = document.getElementById('scrapeUrlInput');
        this.elements.scrapeBtn.addEventListener('click', () => this.handleWebScraping(this.elements.scrapeUrlInput.value));
    }

    async initialize() {
        try {
            this.updateStatus('Initializing...', 'loading');
            
            await Promise.all([
                this.loadUserProfile(),
                this.loadTrainingData(),
                this.loadConversationHistory(),
                this.loadKnowledgeBase()
            ]);

            await this.trainModel();
            
            this.isInitialized = true;
            this.updateStatus('Ready to chat!', 'success');
            this.setInterfaceEnabled(true);
            this.setupEventListeners();
            
            // Perform initial web scraping
            const initialUrls = [
                'https://en.wikipedia.org/wiki/Artificial_intelligence',
                'https://en.wikipedia.org/wiki/Machine_learning',
                'https://en.wikipedia.org/wiki/Natural_language_processing'
            ];
            for (const url of initialUrls) {
                await this.scrapeWebContent(url);
            }
            
        } catch (error) {
            console.error('Initialization failed:', error);
            this.updateStatus('Initialization failed. Please refresh the page.', 'error');
        }
    }
}

// Initialize the chatbot
const chatbot = new EnhancedChatbot();
