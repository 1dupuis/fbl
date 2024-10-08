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
            hiddenLayers: [128,64,32], // Three layers for better pattern recognition
            learningRate: 0.001, // Slightly higher learning rate for faster convergence
            activation: 'leaky-relu', // Leaky ReLU for better gradient flow
            errorThresh: 0.005, // Slightly higher error threshold for faster training
            momentum: 0.9, // High momentum for stability
            dropout: 0.1, // Light dropout to prevent overfitting
            batchSize: 16, // Moderate batch size for balance of speed and stability
            inputSize: 40, // Increased input size for longer sequences
            outputSize: 40 // Matched output size
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
                    { input: "hi", output: "Hello! How can I assist you today?" },
                    { input: "hello", output: "Hi there! What can I help you with?" },
                    { input: "how are you", output: "I'm functioning well, thank you. How may I help you?" },
                    { input: "what can you do", output: "I can answer questions, provide information, and assist with various tasks. What do you need help with?" },
                    { input: "tell me a joke", output: "Sure! Here's one: Why don't scientists trust atoms? Because they make up everything!" },
                    { input: "that's funny", output: "I'm glad you enjoyed it! Would you like to hear another joke?" },
                    { input: "no thanks", output: "Alright. Is there anything else I can help you with?" },
                    { input: "what's the weather like", output: "I'm sorry, I don't have real-time weather data. Is there something else I can assist you with?" },
                    { input: "who created you", output: "I was created by a team of developers as an AI assistant. How can I help you today?" },
                    { input: "what's your name", output: "I'm an AI assistant without a specific name. You can just call me 'Assistant'. How can I help?" },
                    { input: "how old are you", output: "As an AI, I don't have an age in the traditional sense. I'm here to assist you. What can I help with?" },
                    { input: "what is artificial intelligence", output: "Artificial Intelligence (AI) refers to computer systems designed to perform tasks that typically require human intelligence, such as visual perception, speech recognition, decision-making, and language translation. Is there a specific aspect of AI you'd like to know more about?" },
                    { input: "explain machine learning", output: "Machine Learning is a subset of AI where systems learn from data to improve their performance on a specific task without being explicitly programmed. It's used in various applications like recommendation systems, image recognition, and natural language processing. Would you like to know more about a specific type of machine learning?" },
                    { input: "what is deep learning", output: "Deep Learning is a subset of Machine Learning that uses neural networks with multiple layers (deep neural networks) to analyze various factors of data. It's particularly effective for tasks like image and speech recognition, natural language processing, and playing complex games. Is there a specific application of deep learning you're curious about?" },
                    { input: "can you write code", output: "As an AI language model, I can provide examples of code and explain programming concepts, but I don't actively write or execute code. What specific programming help do you need?" },
                    { input: "what programming languages do you know", output: "I have knowledge about many programming languages including Python, JavaScript, Java, C++, and others. Which language are you interested in or working with?" },
                    { input: "explain object-oriented programming", output: "Object-Oriented Programming (OOP) is a programming paradigm based on the concept of 'objects', which can contain data and code. The main principles of OOP are encapsulation, inheritance, polymorphism, and abstraction. Would you like me to explain any of these principles in more detail?" },
                    { input: "what is a database", output: "A database is an organized collection of structured information or data, typically stored electronically in a computer system. Databases are managed using database management systems (DBMS). There are various types of databases, such as relational, NoSQL, and graph databases. Do you want to know more about a specific type of database?" },
                    { input: "explain SQL", output: "SQL (Structured Query Language) is a standard language for managing and manipulating relational databases. It's used for tasks like querying data, updating records, inserting new data, and creating and modifying database structures. Would you like an example of a SQL query?" },
                    { input: "what is cloud computing", output: "Cloud computing is the delivery of computing services—including servers, storage, databases, networking, software, analytics, and intelligence—over the Internet ('the cloud') to offer faster innovation, flexible resources, and economies of scale. Popular cloud providers include AWS, Google Cloud, and Microsoft Azure. Is there a specific aspect of cloud computing you'd like to explore?" }
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
    const totalIterations = 250;
    const batchSize = 100;
    const concurrentBatches = 5;
    const validationData = this.trainingData.slice(-100); // Use the last 100 samples for validation
    let bestValidationError = Infinity;
    let patienceCounter = 0;
    const maxPatience = 20;

    try {
        for (let i = 0; i < totalIterations; i += batchSize * concurrentBatches) {
            const trainingPromises = [];

            for (let j = 0; j < concurrentBatches; j++) {
                const startIteration = i + j * batchSize;
                const endIteration = Math.min(startIteration + batchSize, totalIterations);

                if (startIteration < totalIterations) {
                    trainingPromises.push(this.trainBatch(startIteration, endIteration, validationData));
                }
            }

            await Promise.all(trainingPromises);

            const validationError = await this.validateModel(validationData);
            this.updateStatus(`Training: Completed ${Math.min(i + batchSize * concurrentBatches, totalIterations)} / ${totalIterations} iterations, Validation Error: ${validationError.toFixed(4)}`, 'loading');

            if (validationError < bestValidationError) {
                bestValidationError = validationError;
                patienceCounter = 0;
            } else {
                patienceCounter++;
                if (patienceCounter >= maxPatience) {
                    this.updateStatus('Early stopping triggered. Training completed.', 'success');
                    break;
                }
            }
        }
    } catch (error) {
        console.error('Training error:', error);
        this.updateStatus('Error in training. Using fallback responses.', 'error');
    } finally {
        this.isTraining = false;
    }
}

async trainBatch(startIteration, endIteration, validationData) {
    return this.net.train(this.trainingData, {
        iterations: endIteration - startIteration,
        errorThresh: 0.005,
        log: false,
        logPeriod: 10,
        learningRate: 0.001,
        momentum: 0.9,
        callback: stats => {
            console.log(`Batch ${startIteration}-${endIteration}: Iteration ${stats.iterations}, Error ${stats.error.toFixed(4)}`);
        }
    });
}

async validateModel(validationData) {
    const validationError = await this.net.test(validationData, { log: false });
    return validationError.error;
}

    async getResponse(input) {
        return this.net.run(input);
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
