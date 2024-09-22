document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const luckyButton = document.querySelector('.lucky-button');
    const voiceSearchButton = document.querySelector('.voice-search-button');
    const appsMenu = document.getElementById('apps-menu');
    const appsDropdown = document.getElementById('apps-dropdown');
    const addShortcut = document.querySelector('.add-shortcut');
    const quickAccessContainer = document.querySelector('.quick-access');
    const themeToggle = document.getElementById('theme-toggle');

    function performSearch() {
        const query = searchInput.value.trim();
        if (query) {
            // Simulate search with loading animation
            searchButton.disabled = true;
            searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            setTimeout(() => {
                alert(`Searching for: ${query}`);
                searchButton.disabled = false;
                searchButton.textContent = 'Google Search';
            }, 1500);
        }
    }

    // Apps menu functionality
    const apps = [
        { name: 'Coming Soon...', icon: 'fa-calendar', url: '#calendar' }
    ];

    apps.forEach(app => {
        const appElement = document.createElement('a');
        appElement.href = app.url;
        appElement.className = 'app-icon';
        appElement.innerHTML = `
            <i class="fas ${app.icon}"></i>
            <span>${app.name}</span>
        `;
        appsDropdown.appendChild(appElement);
    });

    appsMenu.addEventListener('click', () => {
        appsDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!appsMenu.contains(e.target) && !appsDropdown.contains(e.target)) {
            appsDropdown.classList.remove('show');
        }
    });

    // Add shortcut functionality
    addShortcut.addEventListener('click', () => {
        const name = prompt("Enter shortcut name:");
        const url = prompt("Enter shortcut URL:");
        if (name && url) {
            const shortcut = createShortcut(name, url);
            quickAccessContainer.insertBefore(shortcut, addShortcut);
            saveShortcuts();
        }
    });

    function createShortcut(name, url) {
        const shortcut = document.createElement('a');
        shortcut.href = url;
        shortcut.className = 'quick-access-item';
        shortcut.innerHTML = `
            <i class="fas fa-globe quick-access-icon"></i>
            <span>${name}</span>
            <button class="remove-shortcut" aria-label="Remove shortcut">&times;</button>
        `;
        shortcut.querySelector('.remove-shortcut').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            quickAccessContainer.removeChild(shortcut);
            saveShortcuts();
        });
        return shortcut;
    }

    function saveShortcuts() {
        const shortcuts = Array.from(quickAccessContainer.querySelectorAll('.quick-access-item:not(.add-shortcut)'))
            .map(el => ({ name: el.querySelector('span').textContent, url: el.href }));
        localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
    }

    function loadShortcuts() {
        const shortcuts = JSON.parse(localStorage.getItem('shortcuts') || '[]');
        shortcuts.forEach(({ name, url }) => {
            const shortcut = createShortcut(name, url);
            quickAccessContainer.insertBefore(shortcut, addShortcut);
        });
    }

    loadShortcuts();

    // Animate logo on page load
    const logo = document.querySelector('.logo');
    logo.style.opacity = '0';
    logo.style.transform = 'translateY(-20px)';
    logo.style.transition = 'opacity 0.5s, transform 0.5s';

    setTimeout(() => {
        logo.style.opacity = '1';
        logo.style.transform = 'translateY(0)';
    }, 100);

    // Add hover effect to quick access items
    quickAccessContainer.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('quick-access-item')) {
            e.target.style.transform = 'scale(1.05)';
            e.target.style.transition = 'transform 0.3s';
        }
    });

    quickAccessContainer.addEventListener('mouseout', (e) => {
        if (e.target.classList.contains('quick-access-item')) {
            e.target.style.transform = 'scale(1)';
        }
    });

    // Theme toggle functionality
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    });

    // Load saved theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
    }

    // Weather widget
    function updateWeather() {
        // This is a mock function. In a real application, you'd call a weather API here.
        const weatherWidget = document.querySelector('.weather-widget');
        const temperatures = [20, 22, 19, 21, 23, 18, 24];
        const temp = temperatures[Math.floor(Math.random() * temperatures.length)];
        weatherWidget.textContent = `${temp}°C, Sunny`;
    }

    updateWeather();
    setInterval(updateWeather, 600000); // Update every 10 minutes

    // Notifications
    const notificationBell = document.querySelector('.notification-bell');
    const notificationDropdown = document.querySelector('.notification-dropdown');

    notificationBell.addEventListener('click', () => {
        notificationDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!notificationBell.contains(e.target) && !notificationDropdown.contains(e.target)) {
            notificationDropdown.classList.remove('show');
        }
    });
});
