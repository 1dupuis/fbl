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
            game: "/api/placeholder/300/200",
            category: "/api/placeholder/150/150",
            topGame: "/api/placeholder/50/50",
            userAvatar: "/api/placeholder/32/32"
        }
    }
};

// Initialize Firebase
let auth, database;
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(config.firebase);
    auth = firebase.auth();
    database = firebase.database();
} else {
    console.warn('Firebase is not available. Some features may not work.');
}

// Helper functions
function createElementWithClass(tag, className) {
    const element = document.createElement(tag);
    element.className = className;
    return element;
}

function createGameCard(game) {
    const card = createElementWithClass('div', 'game-card fade-in');
    card.innerHTML = `
        <img src="${game.image}" alt="${game.title}" loading="lazy">
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
}

function createCategoryItem(category) {
    const item = createElementWithClass('div', 'category-item fade-in');
    item.innerHTML = `
        <img src="${category.image}" alt="${category.name}" loading="lazy">
        <div class="category-item-content">
            <h3>${category.name}</h3>
        </div>
    `;
    return item;
}

function createTopGameItem(game) {
    const item = createElementWithClass('div', 'top-game-item fade-in');
    item.innerHTML = `
        <img src="${game.image}" alt="${game.title}" loading="lazy">
        <div>
            <h3>${game.title}</h3>
            <p class="downloads" data-game-id="${game.id}">Downloads: ${game.downloads || 0}</p>
        </div>
    `;
    return item;
}

// Firebase functions
function fetchGames() {
    return database.ref('games').once('value').then(snapshot => {
        const games = snapshot.val();
        return Object.keys(games).map(key => ({
            id: key,
            ...games[key]
        }));
    });
}

function fetchCategories() {
    return database.ref('categories').once('value').then(snapshot => {
        return snapshot.val() || [];
    });
}

function updateGameRating(gameId, newRating) {
    const gameRef = database.ref(`games/${gameId}`);
    return gameRef.transaction(game => {
        if (game) {
            game.totalRating = (game.totalRating || 0) + newRating;
            game.ratingCount = (game.ratingCount || 0) + 1;
            game.rating = game.totalRating / game.ratingCount;
        }
        return game;
    });
}

function incrementDownloads(gameId) {
    const gameRef = database.ref(`games/${gameId}`);
    return gameRef.transaction(game => {
        if (game) {
            game.downloads = (game.downloads || 0) + 1;
        }
        return game;
    });
}

// Dashboard population
function populateDashboard() {
    const gameCarousel = document.querySelector('.game-carousel');
    const categoryGrid = document.querySelector('.category-grid');
    const gameList = document.querySelector('.game-list');

    if (gameCarousel) gameCarousel.innerHTML = '';
    if (categoryGrid) categoryGrid.innerHTML = '';
    if (gameList) gameList.innerHTML = '';

    fetchGames().then(games => {
        const featuredGames = games.filter(game => game.featured);
        const topGames = games.sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 3);

        featuredGames.forEach(game => {
            if (gameCarousel) gameCarousel.appendChild(createGameCard(game));
        });

        topGames.forEach(game => {
            if (gameList) gameList.appendChild(createTopGameItem(game));
        });

        // Set up real-time listeners for ratings and downloads
        games.forEach(game => {
            const ratingElement = document.querySelector(`.rating[data-game-id="${game.id}"]`);
            const downloadsElement = document.querySelector(`.downloads[data-game-id="${game.id}"]`);

            if (ratingElement) {
                database.ref(`games/${game.id}/rating`).on('value', snapshot => {
                    ratingElement.textContent = `Rating: ${snapshot.val() ? snapshot.val().toFixed(1) : 'N/A'}/5`;
                });
            }

            if (downloadsElement) {
                database.ref(`games/${game.id}/downloads`).on('value', snapshot => {
                    downloadsElement.textContent = `Downloads: ${snapshot.val() || 0}`;
                });
            }
        });
    });

    fetchCategories().then(categories => {
        categories.forEach(category => {
            if (categoryGrid) categoryGrid.appendChild(createCategoryItem(category));
        });
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    populateDashboard();

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
    searchBar?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        fetchGames().then(games => {
            const filteredGames = games.filter(game => game.title.toLowerCase().includes(searchTerm));
            
            const gameCarousel = document.querySelector('.game-carousel');
            const gameList = document.querySelector('.game-list');
            
            if (gameCarousel) gameCarousel.innerHTML = '';
            if (gameList) gameList.innerHTML = '';
            
            filteredGames.forEach(game => {
                if (gameCarousel) gameCarousel.appendChild(createGameCard(game));
                if (gameList) gameList.appendChild(createTopGameItem(game));
            });
        });
    });

    // Logout functionality
    document.getElementById('logout-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (auth) {
            auth.signOut().then(() => {
                console.log('User signed out');
                window.location.href = 'fbl.dupuis.lol/account/signup';
            }).catch((error) => {
                console.error('Error signing out:', error);
            });
        } else {
            console.warn('Auth is not available');
        }
    });

    // Download functionality
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('download-btn')) {
            const gameId = e.target.getAttribute('data-game-id');
            if (auth && database) {
                const user = auth.currentUser;
                if (user) {
                    Promise.all([
                        incrementDownloads(gameId),
                        database.ref(`users/${user.uid}/downloads/${gameId}`).set(firebase.database.ServerValue.TIMESTAMP)
                    ]).then(() => {
                        console.log('Download recorded');
                        alert('Game downloaded successfully!');
                    }).catch((error) => {
                        console.error('Error recording download:', error);
                        alert('Error downloading game. Please try again.');
                    });
                } else {
                    alert('Please sign in to download games.');
                    window.location.href = 'fbl.dupuis.lol/account/signup';
                }
            } else {
                console.warn('Auth or database is not available');
                alert('Download feature is currently unavailable.');
            }
        }
    });

    // Rating functionality
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('rate-btn')) {
            const gameId = e.target.getAttribute('data-game-id');
            const ratingInput = e.target.previousElementSibling;
            const rating = parseFloat(ratingInput.value);

            if (isNaN(rating) || rating < 1 || rating > 5) {
                alert('Please enter a valid rating between 1 and 5.');
                return;
            }

            if (auth && database) {
                const user = auth.currentUser;
                if (user) {
                    updateGameRating(gameId, rating).then(() => {
                        console.log('Rating recorded');
                        alert('Thank you for rating the game!');
                        ratingInput.value = '';
                    }).catch((error) => {
                        console.error('Error recording rating:', error);
                        alert('Error rating game. Please try again.');
                    });
                } else {
                    alert('Please sign in to rate games.');
                    window.location.href = 'fbl.dupuis.lol/account/signup';
                }
            } else {
                console.warn('Auth or database is not available');
                alert('Rating feature is currently unavailable.');
            }
        }
    });

    // Profile management
    document.getElementById('profile-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (auth && database) {
            const user = auth.currentUser;
            if (user) {
                const userDownloadsRef = database.ref(`users/${user.uid}/downloads`);
                userDownloadsRef.once('value')
                    .then((snapshot) => {
                        const downloads = snapshot.val();
                        let downloadHistory = '';
                        for (let gameId in downloads) {
                            downloadHistory += `<p>Game ID: ${gameId} - Downloaded on ${new Date(downloads[gameId]).toLocaleString()}</p>`;
                        }
                        alert(`User Profile:\nEmail: ${user.email}\n\nDownload History:\n${downloadHistory}`);
                    })
                    .catch((error) => {
                        console.error('Error fetching download history:', error);
                        alert('Error fetching profile information. Please try again.');
                    });
            }
        } else {
            console.warn('Auth or database is not available');
            alert('Profile feature is currently unavailable.');
        }
    });
});

// User authentication
if (auth) {
    auth.onAuthStateChanged(user => {
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
} else {
    console.warn('Auth is not available');
}
