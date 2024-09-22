import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

// Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const corkboard = document.getElementById('corkboard');
    const corkboardContainer = document.getElementById('corkboard-container');
    const addNoteBtn = document.getElementById('add-note');
    const noteTitle = document.getElementById('note-title');
    const noteContent = document.getElementById('note-content');
    const searchInput = document.getElementById('search');
    const searchButton = document.getElementById('search-button');
    const noteColor = document.getElementById('note-color');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const toggleThemeBtn = document.getElementById('toggle-theme');
    const logoutBtn = document.getElementById('logout-btn');
    const boardSelect = document.getElementById('board-select');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const resetZoomBtn = document.getElementById('reset-zoom');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    // State variables
    let currentUser = null;
    let currentBoard = 'general';
    let panzoomInstance = null;
    let notes = {};

    // UI helper functions
    function showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    function hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Authentication and initialization
    showLoading();

    onAuthStateChanged(auth, (user) => {
        hideLoading();
        if (user) {
            currentUser = user;
            showLoggedInUI(user.displayName || user.email);
            initializePanzoom();
            loadNotes();
        } else {
            window.location.href = 'https://fbl.dupuis.lol/account/signup';
        }
    });

    // Event listeners
    addNoteBtn.addEventListener('click', addNote);
    searchInput.addEventListener('input', debounce(searchNotes, 300));
    searchButton.addEventListener('click', searchNotes);
    toggleThemeBtn.addEventListener('click', toggleTheme);
    logoutBtn.addEventListener('click', logout);
    boardSelect.addEventListener('change', changeBoard);
    zoomInBtn.addEventListener('click', () => {
        if (panzoomInstance) panzoomInstance.zoomIn();
    });
    zoomOutBtn.addEventListener('click', () => {
        if (panzoomInstance) panzoomInstance.zoomOut();
    });
    resetZoomBtn.addEventListener('click', resetView);
    menuToggle.addEventListener('click', toggleSidebar);

    // User interface functions
    function showLoggedInUI(displayName) {
        userInfo.style.display = 'flex';
        userName.textContent = displayName;
    }

    function initializePanzoom() {
        if (typeof panzoom === 'undefined') {
            console.error('Panzoom library is not loaded. Make sure to include the script in your HTML.');
            return;
        }

        panzoomInstance = panzoom(corkboard, {
            maxZoom: 5,
            minZoom: 0.1,
            bounds: true,
            boundsPadding: 0.1
        });

        panzoomInstance.on('transform', (e) => {
            const currentScale = e.getTransform().scale;
            corkboard.style.setProperty('--scale', 1 / currentScale);
        });
    }

    function resetView() {
        if (panzoomInstance) {
            panzoomInstance.moveTo(0, 0);
            panzoomInstance.zoomAbs(0, 0, 1);
        }
    }

    function toggleSidebar() {
        sidebar.classList.toggle('sidebar-open');
    }

    // Note management functions
    function addNote() {
        const title = noteTitle.value.trim();
        const content = noteContent.value.trim();
        const color = noteColor.value;

        if (title && content && currentUser) {
            const notesRef = ref(database, `boards/${currentBoard}/notes`);
            const newNoteRef = push(notesRef);
            const newNote = {
                userId: currentUser.uid,
                author: currentUser.displayName || currentUser.email,
                title: title,
                content: content,
                color: color,
                timestamp: Date.now(),
                position: { x: 0, y: 0 }
            };

            set(newNoteRef, newNote)
                .then(() => {
                    noteTitle.value = '';
                    noteContent.value = '';
                    showToast('Note added successfully', 'success');
                    createNoteElement(newNoteRef.key, newNote);
                })
                .catch(error => {
                    showToast('Error adding note: ' + error.message, 'error');
                });
        } else {
            showToast('Please fill in both title and content', 'warning');
        }
    }

    function createNoteElement(id, note) {
        const noteElement = document.createElement('div');
        noteElement.classList.add('note');
        noteElement.id = id;
        noteElement.style.backgroundColor = note.color;
        noteElement.style.left = `${note.position.x}px`;
        noteElement.style.top = `${note.position.y}px`;
        
        noteElement.innerHTML = `
            <h3>${escapeHTML(note.title)}</h3>
            <p>${escapeHTML(note.content)}</p>
            <span class="author">By ${escapeHTML(note.author)}</span>
            <div class="actions">
                <button class="edit" title="Edit"><span class="material-icons">edit</span></button>
                <button class="delete" title="Delete"><span class="material-icons">delete</span></button>
            </div>
        `;

        noteElement.querySelector('.edit').addEventListener('click', () => editNote(id, note));
        noteElement.querySelector('.delete').addEventListener('click', () => deleteNote(id));

        makeNoteDraggable(noteElement, id);
        corkboard.appendChild(noteElement);
        notes[id] = note;
    }

    function loadNotes() {
        const notesRef = ref(database, `boards/${currentBoard}/notes`);
        onValue(notesRef, (snapshot) => {
            clearNotes();
            snapshot.forEach((childSnapshot) => {
                const id = childSnapshot.key;
                const note = childSnapshot.val();
                createNoteElement(id, note);
            });
        }, (error) => {
            showToast('Error loading notes: ' + error.message, 'error');
        });
    }

    function clearNotes() {
        while (corkboard.firstChild) {
            corkboard.removeChild(corkboard.firstChild);
        }
        notes = {};
    }

    function makeNoteDraggable(noteElement, id) {
        if (typeof interact === 'undefined') {
            console.error('Interact.js library is not loaded. Make sure to include the script in your HTML.');
            return;
        }

        interact(noteElement).draggable({
            inertia: true,
            modifiers: [
                interact.modifiers.restrictRect({
                    restriction: 'parent',
                    endOnly: true
                })
            ],
            autoScroll: true,
            listeners: {
                move(event) {
                    const target = event.target;
                    const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                    const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                    target.style.transform = `translate(${x}px, ${y}px)`;
                    target.setAttribute('data-x', x);
                    target.setAttribute('data-y', y);
                },
                end(event) {
                    const target = event.target;
                    const x = parseFloat(target.getAttribute('data-x')) || 0;
                    const y = parseFloat(target.getAttribute('data-y')) || 0;
                    updateNotePosition(id, x, y);
                }
            }
        });
    }

    function updateNotePosition(id, x, y) {
        update(ref(database, `boards/${currentBoard}/notes/${id}/position`), { x, y })
            .catch(error => {
                showToast('Error updating note position: ' + error.message, 'error');
            });
    }

    function editNote(id, note) {
        const newTitle = prompt('Edit note title:', note.title);
        const newContent = prompt('Edit note content:', note.content);
        if (newTitle !== null && newContent !== null) {
            update(ref(database, `boards/${currentBoard}/notes/${id}`), {
                title: newTitle.trim(),
                content: newContent.trim()
            }).then(() => {
                showToast('Note updated successfully', 'success');
                loadNotes(); // Reload notes to reflect changes
            }).catch(error => {
                showToast('Error updating note: ' + error.message, 'error');
            });
        }
    }

    function deleteNote(id) {
        if (confirm('Are you sure you want to delete this note?')) {
            remove(ref(database, `boards/${currentBoard}/notes/${id}`))
                .then(() => {
                    showToast('Note deleted successfully', 'success');
                    const noteElement = document.getElementById(id);
                    if (noteElement) noteElement.remove();
                    delete notes[id];
                })
                .catch(error => {
                    showToast('Error deleting note: ' + error.message, 'error');
                });
        }
    }

    function searchNotes() {
        const searchTerm = searchInput.value.toLowerCase();
        Object.entries(notes).forEach(([id, note]) => {
            const noteElement = document.getElementById(id);
            if (noteElement) {
                const isVisible = note.title.toLowerCase().includes(searchTerm) ||
                                  note.content.toLowerCase().includes(searchTerm) ||
                                  note.author.toLowerCase().includes(searchTerm);
                noteElement.style.display = isVisible ? 'block' : 'none';
            }
        });
    }

    function changeBoard() {
        currentBoard = boardSelect.value;
        loadNotes();
        resetView();
    }

    // Theme management
    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDarkTheme = document.body.classList.contains('dark-theme');
        toggleThemeBtn.innerHTML = isDarkTheme ? '<span class="material-icons">light_mode</span>' : '<span class="material-icons">dark_mode</span>';
        localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    }

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            toggleThemeBtn.innerHTML = '<span class="material-icons">light_mode</span>';
        }
    }

    // Authentication
    function logout() {
        signOut(auth).then(() => {
            window.location.href = 'https://fbl.dupuis.lol/account/signup';
        }).catch((error) => {
            showToast('Error signing out: ' + error.message, 'error');
        });
    }

    // Utility functions
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // Initialize
    loadTheme();
});
