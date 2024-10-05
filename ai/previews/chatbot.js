// chatbot.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged,
    signOut,
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
        // Initialize Firebase
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        this.database = getDatabase(this.app);

        // Neural Network Configuration
        this.net = new brain.recurrent.LSTM({
            hiddenLayers: [128, 64, 32],
            learningRate: 0.01,
            activation: 'leaky-relu',
            errorThresh: 0.0025,
            momentum: 0.9,
            dropout: 0.1
        });

        // State Management
        this.state = {
            contextWindow: [],
            maxContextLength: 10,
            isTraining: false,
            isInitialized: false,
            userId: null,
            userProfile: null,
            conversationHistory: [],
            trainingProgress: 0,
            lastTrainingDate: null,
            modelMetrics: {
                accuracy: 0,
                loss: 0,
                trainingDuration: 0
            },
            typingSpeed: { min: 50, max: 100 }, // ms per character
            maxResponseTime: 3000 // ms
        };

        // UI Elements
        this.elements = {
            userInput: null,
            sendBtn: null,
            chatWindow: null,
            typingIndicator: null,
            status: null,
            clearBtn: null,
            feedbackBtns: null,
            modelInfo: null
        };

        // Bind methods
        this.handleUserInput = this.handleUserInput.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleFeedback = this.handleFeedback.bind(this);

        // Initialize on DOM load
        window.addEventListener('DOMContentLoaded', () => {
            this.initializeElements();
            this.initialize().catch(this.handleError.bind(this));
        });
    }

    async initialize() {
        try {
            this.updateStatus('Initializing system...', 'loading');
            await this.initializeAuth();
            await this.loadUserProfile();
            await this.loadTrainingData();
            await this.loadConversationHistory();
            await this.checkAndPerformTraining();
            
            this.setupEventListeners();
            this.setupPeriodicTraining();
            this.setupActivityMonitor();
            
            this.state.isInitialized = true;
            this.updateStatus('Ready to chat!', 'success');
            this.updateModelInfo();
            
            // Add welcome message
            this.addMessage({
                type: 'bot',
                content: 'Hello! I'm an AI assistant ready to help. How can I assist you today?',
                timestamp: Date.now()
            });
        } catch (error) {
            throw new Error('Initialization failed: ' + error.message);
        }
    }

    async initializeAuth() {
        return new Promise((resolve, reject) => {
            onAuthStateChanged(this.auth, async (user) => {
                if (user) {
                    this.state.userId = user.uid;
                    resolve();
                } else {
                    try {
                        // Sign in anonymously if no user
                        const userCredential = await signInAnonymously(this.auth);
                        this.state.userId = userCredential.user.uid;
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }
            });
        });
    }

    async loadUserProfile() {
        if (!this.state.userId) return;

        const profileRef = ref(this.database, `users/${this.state.userId}/profile`);
        const snapshot = await get(profileRef);
        
        if (snapshot.exists()) {
            this.state.userProfile = snapshot.val();
        } else {
            // Initialize default profile
            this.state.userProfile = {
                created: Date.now(),
                preferences: {
                    theme: 'light',
                    responseLength: 'medium',
                    language: 'en'
                },
                metrics: {
                    totalConversations: 0,
                    totalMessages: 0,
                    averageFeedbackScore: 0
                }
            };
            await set(profileRef, this.state.userProfile);
        }
    }

    async loadTrainingData() {
        const baseDataRef = ref(this.database, 'trainingData/base');
        const userDataRef = ref(this.database, `users/${this.state.userId}/trainingData`);
        
        try {
            // Load base training data
            const baseSnapshot = await get(baseDataRef);
            let baseData = baseSnapshot.exists() ? baseSnapshot.val() : this.getDefaultTrainingData();
            
            // Load user-specific training data
            const userSnapshot = await get(userDataRef);
            let userData = userSnapshot.exists() ? userSnapshot.val() : [];
            
            // Combine and deduplicate training data
            this.trainingData = this.deduplicateTrainingData([...baseData, ...userData]);
            
            // Save base data if it doesn't exist
            if (!baseSnapshot.exists()) {
                await set(baseDataRef, baseData);
            }
        } catch (error) {
            console.error('Error loading training data:', error);
            this.trainingData = this.getDefaultTrainingData();
        }
    }

    deduplicateTrainingData(data) {
        const seen = new Set();
        return data.filter(item => {
            const key = `${item.input}|${item.output}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    getDefaultTrainingData() {
        return [
            { 
                input: "hello", 
                output: "Hi! How can I help you today?",
                context: "greeting",
                confidence: 1.0
            },
            {
                input: "what can you do",
                output: "I can help with various tasks including answering questions, providing explanations, and engaging in conversations. What would you like to explore?",
                context: "capabilities",
                confidence: 1.0
            },
            // Add more sophisticated default training data...
        ];
    }

    async handleUserInput() {
        const input = this.elements.userInput.value.trim();
        
        if (!input || !this.state.isInitialized || this.state.isTraining) return;

        try {
            // Clear input and disable interface
            this.elements.userInput.value = '';
            this.setInterfaceEnabled(false);
            
            // Add user message
            this.addMessage({
                type: 'user',
                content: input,
                timestamp: Date.now()
            });

            // Show typing indicator
            this.showTypingIndicator();

            // Generate and display response
            const response = await this.getResponse(input);
            
            // Calculate realistic typing delay
            const delay = this.calculateTypingDelay(response);
            await new Promise(resolve => setTimeout(resolve, delay));

            // Hide typing indicator and add response
            this.hideTypingIndicator();
            this.addMessage({
                type: 'bot',
                content: response,
                timestamp: Date.now()
            });

            // Update metrics
            await this.updateConversationMetrics(input, response);
        } catch (error) {
            this.handleError(error);
        } finally {
            this.setInterfaceEnabled(true);
            this.elements.userInput.focus();
        }
    }

    calculateTypingDelay(text) {
        const { min, max } = this.state.typingSpeed;
        const baseDelay = text.length * (Math.random() * (max - min) + min);
        return Math.min(baseDelay, this.state.maxResponseTime);
    }

    async getResponse(userInput) {
        const sanitizedInput = this.preprocessInput(userInput);
        const contextualInput = this.buildContextualInput(sanitizedInput);
        
        try {
            // Get response from neural network
            let response = await this.net.run(contextualInput);
            
            // Validate and enhance response
            response = await this.validateAndEnhanceResponse(response, sanitizedInput);
            
            // Update conversation context
            await this.updateConversationContext(sanitizedInput, response);
            
            return response;
        } catch (error) {
            console.error('Response generation error:', error);
            return this.getFallbackResponse(sanitizedInput);
        }
    }

    async validateAndEnhanceResponse(response, input) {
        if (!this.isValidResponse(response)) {
            response = await this.net.run(input);
        }
        
        if (!this.isValidResponse(response)) {
            return this.getFallbackResponse(input);
        }

        // Enhance response with context awareness
        return this.enhanceResponse(response);
    }

    enhanceResponse(response) {
        // Add conversation markers if needed
        if (!response.endsWith('?') && !response.endsWith('.') && !response.endsWith('!')) {
            response += '.';
        }
        
        // Ensure proper capitalization
        return response.charAt(0).toUpperCase() + response.slice(1);
    }

    async trainNetwork() {
        this.state.isTraining = true;
        const startTime = Date.now();
        
        try {
            const trainingResult = await this.net.train(this.trainingData, {
                iterations: 1000,
                errorThresh: 0.0025,
                log: true,
                logPeriod: 10,
                callback: stats => {
                    this.trainingProgress = (stats.iterations / 1000) * 100;
                    this.updateStatus(`Training: ${Math.round(this.trainingProgress)}% complete`, 'loading');
                    this.updateModelInfo({
                        accuracy: (1 - stats.error) * 100,
                        loss: stats.error
                    });
                }
            });
    
            this.state.modelMetrics = {
                accuracy: (1 - trainingResult.error) * 100,
                loss: trainingResult.error,
                trainingDuration: Date.now() - startTime
            };
    
            await this.saveModelMetrics();
            this.state.lastTrainingDate = new Date();
            
        } catch (error) {
            console.error('Training error:', error);
            this.updateStatus('Training encountered an error. Using backup responses.', 'error');
        } finally {
            this.state.isTraining = false;
        }
    }
    
    setupEventListeners() {
        // Chat input handling
        this.elements.sendBtn.addEventListener('click', this.handleUserInput);
        this.elements.userInput.addEventListener('keypress', this.handleKeyPress);
        
        // Toolbar buttons
        this.elements.clearBtn.addEventListener('click', () => this.clearChat());
        document.getElementById('toggleTheme').addEventListener('click', () => this.toggleTheme());
        document.getElementById('exportChat').addEventListener('click', () => this.exportChat());
        
        // Feedback buttons
        this.elements.chatWindow.addEventListener('click', (e) => {
            if (e.target.classList.contains('feedback-btn')) {
                const messageEl = e.target.closest('.message');
                const value = e.target.dataset.value;
                if (messageEl && value) {
                    this.handleFeedback(messageEl.dataset.messageId, value);
                }
            }
        });
    
        // Window events
        window.addEventListener('online', () => this.handleConnectivityChange(true));
        window.addEventListener('offline', () => this.handleConnectivityChange(false));
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
}

async handleFeedback(messageId, value) {
    if (!this.state.userId || !messageId) return;

    try {
        const feedbackRef = ref(this.database, `users/${this.state.userId}/feedback/${messageId}`);
        await set(feedbackRef, {
            value,
            timestamp: Date.now()
        });

        // Update message UI
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            const buttons = messageEl.querySelectorAll('.feedback-btn');
            buttons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === value);
            });
        }

        // Use feedback for learning
        await this.processFeedback(messageId, value);
    } catch (error) {
        console.error('Error saving feedback:', error);
        this.updateStatus('Failed to save feedback', 'error');
    }
}

async processFeedback(messageId, value) {
    try {
        // Get message content
        const messageRef = ref(this.database, `users/${this.state.userId}/conversations/${messageId}`);
        const snapshot = await get(messageRef);
        
        if (snapshot.exists()) {
            const message = snapshot.val();
            
            // If positive feedback, add to training data
            if (value === 'positive') {
                await this.updateTrainingData([{
                    input: message.userInput,
                    output: message.botResponse,
                    context: message.context || 'general',
                    confidence: 1.0
                }]);
            }
            
            // Update metrics
            await this.updateUserMetrics(value);
        }
    } catch (error) {
        console.error('Error processing feedback:', error);
    }
}

async updateUserMetrics(feedbackValue) {
    if (!this.state.userId) return;
    
    const metricsRef = ref(this.database, `users/${this.state.userId}/metrics`);
    
    try {
        const snapshot = await get(metricsRef);
        const currentMetrics = snapshot.exists() ? snapshot.val() : {
            positiveCount: 0,
            negativeCount: 0,
            totalInteractions: 0,
            lastInteraction: null
        };

        const updates = {
            ...currentMetrics,
            totalInteractions: currentMetrics.totalInteractions + 1,
            lastInteraction: Date.now()
        };

        if (feedbackValue === 'positive') {
            updates.positiveCount = (currentMetrics.positiveCount || 0) + 1;
        } else if (feedbackValue === 'negative') {
            updates.negativeCount = (currentMetrics.negativeCount || 0) + 1;
        }

        updates.satisfactionRate = (updates.positiveCount / updates.totalInteractions) * 100;

        await set(metricsRef, updates);
        this.updateModelInfo({
            feedbackCount: updates.totalInteractions,
            satisfaction: Math.round(updates.satisfactionRate)
        });
    } catch (error) {
        console.error('Error updating user metrics:', error);
    }
}

updateModelInfo(metrics = {}) {
    const accuracyMetric = document.getElementById('accuracyMetric');
    const trainingStatus = document.getElementById('trainingStatus');
    const conversationCount = document.getElementById('conversationCount');

    if (metrics.accuracy !== undefined && accuracyMetric) {
        accuracyMetric.textContent = `${Math.round(metrics.accuracy)}%`;
    }

    if (metrics.status !== undefined && trainingStatus) {
        trainingStatus.textContent = metrics.status;
    }

    if (metrics.feedbackCount !== undefined && conversationCount) {
        conversationCount.textContent = metrics.feedbackCount;
    }
}

toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

async exportChat() {
    if (!this.userId) return;

    try {
        const conversationsRef = ref(this.database, `users/${this.userId}/conversations`);
        const snapshot = await get(conversationsRef);
        
        if (snapshot.exists()) {
            const conversations = [];
            snapshot.forEach(childSnapshot => {
                conversations.push(childSnapshot.val());
            });

            const exportData = {
                conversations,
                exportDate: new Date().toISOString(),
                userMetrics: this.state.modelMetrics
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat-export-${new Date().toISOString()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Error exporting chat:', error);
        this.updateStatus('Failed to export chat history', 'error');
    }
}

handleConnectivityChange(isOnline) {
    if (isOnline) {
        this.updateStatus('Connection restored!', 'success');
        setTimeout(() => {
            if (this.isInitialized) {
                this.updateStatus('Ready to chat!', 'success');
            }
        }, 2000);
    } else {
        this.updateStatus('Connection lost. Please check your internet connection.', 'error');
    }
}

handleBeforeUnload(e) {
    if (this.elements.userInput && this.elements.userInput.value.trim()) {
        e.preventDefault();
        e.returnValue = '';
    }
}
}

// Initialize chatbot
const chatbot = new EnhancedChatbot();
