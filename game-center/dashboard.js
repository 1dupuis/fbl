// dashboard.js

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getDatabase, ref, get, set, onValue, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

// Configuration
const config = {
    firebase: {
        apiKey: "AIzaSyAToB2gXmzCK4t-1dW5urnGG87gbK6MxR8",
        authDomain: "dupuis-lol.firebaseapp.com",
        databaseURL: "https://dupuis-lol-default-rtdb.firebaseio.com",
        projectId: "dupuis-lol",
        storageBucket: "dupuis-lol.appspot.com",
        messagingSenderId: "807402660080",
        appId: "1:807402660080:web:545d4e1287f5803ebda235",
        measurementId: "G-TR8JMF5FRY"
    },
    images: {
        placeholder: {
            game: "https://picsum.photos/200/300/?blur",
            category: "https://picsum.photos/200/300/?blur",
            topGame: "https://picsum.photos/200/300/?blur",
            userAvatar: "https://picsum.photos/200/300/?blur"
        }
    }
};

// Initialize Firebase
let auth, database;

function initializeFirebase() {
    const app = initializeApp(config.firebase);
    auth = getAuth(app);
    database = getDatabase(app);
    console.log('Firebase initialized successfully');
}

// Helper functions
const createElementWithClass = (tag, className) => {
    const element = document.createElement(tag);
    element.className = className;
    return element;
};

const createGameCard = (game) => {
    const card = createElementWithClass('div', 'game-card fade-in');
    card.innerHTML = `
        <img src="${game.image || config.images.placeholder.game}" alt="${game.title}" loading="lazy">
        <div class="game-card-content">
            <h3>${game.title}</h3>
            <p class="rating" data-game-id="${game.id}">Rating: ${game.rating ? game.rating.toFixed(1) : 'N/A'}/5</p>
            <p class="downloads" data-game-id="${game.id}">Downloads: ${game.downloads || 0}</p>
            <button class="download-btn" data-game-id="${game.id}">Download</button>
            <div class="rating-input">
                <input type="number" min="1" max="5" step="0.1" placeholder="Rate (1-5)">
                <button class="rate-btn" data-game-id="${game.id}">Rate</button>
            </div>
        </div>
    `;
    return card;
};

const createCategoryItem = (category) => {
    const item = createElementWithClass('div', 'category-item fade-in');
    item.innerHTML = `
        <img src="${category.image || config.images.placeholder.category}" alt="${category.name}" loading="lazy">
        <div class="category-item-content">
            <h3>${category.name}</h3>
        </div>
    `;
    return item;
};

const createTopGameItem = (game) => {
    const item = createElementWithClass('div', 'top-game-item fade-in');
    item.innerHTML = `
        <img src="${game.image || config.images.placeholder.topGame}" alt="${game.title}" loading="lazy">
        <div>
            <h3>${game.title}</h3>
            <p class="downloads" data-game-id="${game.id}">Downloads: ${game.downloads || 0}</p>
        </div>
    `;
    return item;
};

// Firebase functions
const fetchGames = () => {
    return get(ref(database, 'games'))
        .then(snapshot => {
            const games = snapshot.val();
            return games ? Object.keys(games).map(key => ({
                id: key,
                ...games[key]
            })) : [];
        });
};

const fetchCategories = () => {
    return get(ref(database, 'categories'))
        .then(snapshot => snapshot.val() || []);
};

const updateGameRating = (gameId, newRating) => {
    const gameRef = ref(database, `games/${gameId}`);
    return runTransaction(gameRef, (game) => {
        if (game) {
            game.totalRating = (game.totalRating || 0) + newRating;
            game.ratingCount = (game.ratingCount || 0) + 1;
            game.rating = game.totalRating / game.ratingCount;
        }
        return game;
    });
};

const incrementDownloads = (gameId) => {
    const gameRef = ref(database, `games/${gameId}`);
    return runTransaction(gameRef, (game) => {
        if (game) {
            game.downloads = (game.downloads || 0) + 1;
        }
        return game;
    });
};

// Dashboard population
const populateDashboard = async () => {
    const gameCarousel = document.querySelector('.game-carousel');
    const categoryGrid = document.querySelector('.category-grid');
    const gameList = document.querySelector('.game-list');

    try {
        const [games, categories] = await Promise.all([fetchGames(), fetchCategories()]);

        if (gameCarousel) gameCarousel.innerHTML = '';
        if (categoryGrid) categoryGrid.innerHTML = '';
        if (gameList) gameList.innerHTML = '';

        const featuredGames = games.filter(game => game.featured);
        const topGames = games.sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 3);

        featuredGames.forEach(game => {
            if (gameCarousel) gameCarousel.appendChild(createGameCard(game));
        });

        topGames.forEach(game => {
            if (gameList) gameList.appendChild(createTopGameItem(game));
        });

        categories.forEach(category => {
            if (categoryGrid) categoryGrid.appendChild(createCategoryItem(category));
        });

        // Set up real-time listeners for ratings and downloads
        games.forEach(game => {
            const ratingElement = document.querySelector(`.rating[data-game-id="${game.id}"]`);
            const downloadsElement = document.querySelector(`.downloads[data-game-id="${game.id}"]`);

            if (ratingElement) {
                onValue(ref(database, `games/${game.id}/rating`), snapshot => {
                    ratingElement.textContent = `Rating: ${snapshot.val() ? snapshot.val().toFixed(1) : 'N/A'}/5`;
                });
            }

            if (downloadsElement) {
                onValue(ref(database, `games/${game.id}/downloads`), snapshot => {
                    downloadsElement.textContent = `Downloads: ${snapshot.val() || 0}`;
                });
            }
        });
    } catch (error) {
        console.error('Error populating dashboard:', error);
    }
};

// Event listeners
const setupEventListeners = () => {
    // Smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href'))?.scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Search functionality
    const searchBar = document.querySelector('.search-bar input');
    searchBar?.addEventListener('input', debounce(handleSearch, 300));

    // Logout functionality
    document.getElementById('logout-link')?.addEventListener('click', handleLogout);

    // Download functionality
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('download-btn')) {
            const gameId = e.target.getAttribute('data-game-id');
            handleDownload(gameId);
        }
    });

    // Rating functionality
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('rate-btn')) {
            const gameId = e.target.getAttribute('data-game-id');
            const ratingInput = e.target.previousElementSibling;
            handleRating(gameId, ratingInput);
        }
    });

    // Profile management
    document.getElementById('profile-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        displayUserProfile();
    });
};

// Helper functions
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

const handleSearch = async (e) => {
    const searchTerm = e.target.value.toLowerCase();
    try {
        const games = await fetchGames();
        const filteredGames = games.filter(game => game.title.toLowerCase().includes(searchTerm));
        
        const gameCarousel = document.querySelector('.game-carousel');
        const gameList = document.querySelector('.game-list');
        
        if (gameCarousel) gameCarousel.innerHTML = '';
        if (gameList) gameList.innerHTML = '';
        
        filteredGames.forEach(game => {
            if (gameCarousel) gameCarousel.appendChild(createGameCard(game));
            if (gameList) gameList.appendChild(createTopGameItem(game));
        });
    } catch (error) {
        console.error('Error during search:', error);
    }
};

const handleLogout = async (e) => {
    e.preventDefault();
    try {
        await signOut(auth);
        console.log('User signed out');
        window.location.href = 'fbl.dupuis.lol/account/signup';
    } catch (error) {
        console.error('Error signing out:', error);
    }
};

const handleDownload = async (gameId) => {
    const user = auth.currentUser;
    if (!user) {
        alert('Please sign in to download games.');
        window.location.href = 'fbl.dupuis.lol/account/signup';
        return;
    }

    try {
        await Promise.all([
            incrementDownloads(gameId),
            set(ref(database, `users/${user.uid}/downloads/${gameId}`), serverTimestamp())
        ]);
        console.log('Download recorded');
        alert('Game downloaded successfully!');
    } catch (error) {
        console.error('Error recording download:', error);
        alert('Error downloading game. Please try again.');
    }
};

const handleRating = async (gameId, ratingInput) => {
    const rating = parseFloat(ratingInput.value);

    if (isNaN(rating) || rating < 1 || rating > 5) {
        alert('Please enter a valid rating between 1 and 5.');
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert('Please sign in to rate games.');
        window.location.href = 'fbl.dupuis.lol/account/signup';
        return;
    }

    try {
        await updateGameRating(gameId, rating);
        console.log('Rating recorded');
        alert('Thank you for rating the game!');
        ratingInput.value = '';
    } catch (error) {
        console.error('Error recording rating:', error);
        alert('Error rating game. Please try again.');
    }
};

const displayUserProfile = async () => {
    const user = auth.currentUser;
    if (!user) {
        alert('Please sign in to view your profile.');
        return;
    }

    try {
        const snapshot = await get(ref(database, `users/${user.uid}/downloads`));
        const downloads = snapshot.val();
        let downloadHistory = '';
        for (let gameId in downloads) {
            downloadHistory += `<p>Game ID: ${gameId} - Downloaded on ${new Date(downloads[gameId]).toLocaleString()}</p>`;
        }
        alert(`User Profile:\nEmail: ${user.email}\n\nDownload History:\n${downloadHistory}`);
    } catch (error) {
        console.error('Error fetching download history:', error);
        alert('Error fetching profile information. Please try again.');
    }
};

// User authentication
const setupAuthStateListener = () => {
    onAuthStateChanged(auth, user => {
        const userAvatar = document.getElementById('user-avatar');
        const profileLink = document.getElementById('profile-link');
        const logoutLink = document.getElementById('logout-link');
        
        if (user) {
            console.log('User is signed in:', user);
            if (userAvatar) userAvatar.src = user.photoURL || config.images.placeholder.userAvatar;
            if (profileLink) profileLink.style.display = 'block';
            if (logoutLink) logoutLink.style.display = 'block';
        } else {
            console.log('User is signed out');
            if (userAvatar) userAvatar.src = config.images.placeholder.userAvatar;
            if (profileLink) profileLink.style.display = 'none';
            if (logoutLink) logoutLink.style.display = 'none';
        }
    });
};

// Initialize the application
const init = async () => {
    try {
        initializeFirebase();
        setupEventListeners();
        setupAuthStateListener();
        await populateDashboard();
    } catch (error) {
        console.error('Error initializing application:', error);
    }
};

// Run the initialization when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
