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
    const elements = {
        corkboard: document.getElementById('corkboard'),
        corkboardContainer: document.getElementById('corkboard-container'),
        addNoteBtn: document.getElementById('add-note'),
        noteTitle: document.getElementById('note-title'),
        noteContent: document.getElementById('note-content'),
        searchInput: document.getElementById('search'),
        searchButton: document.getElementById('search-button'),
        noteColor: document.getElementById('note-color'),
        userInfo: document.getElementById('user-info'),
        userName: document.getElementById('user-name'),
        toggleThemeBtn: document.getElementById('toggle-theme'),
        logoutBtn: document.getElementById('logout-btn'),
        boardSelect: document.getElementById('board-select'),
        zoomInBtn: document.getElementById('zoom-in'),
        zoomOutBtn: document.getElementById('zoom-out'),
        resetZoomBtn: document.getElementById('reset-zoom'),
        menuToggle: document.getElementById('menu-toggle'),
        sidebar: document.getElementById('sidebar')
    };

    // State variables
    let currentUser = null;
    let currentBoard = 'general';
    let panzoomInstance = null;
    let notes = {};

    // UI helper functions
    const ui = {
        showLoading: () => {
            const loading = document.getElementById('loading');
            if (loading) loading.style.display = 'flex';
        },
        hideLoading: () => {
            const loading = document.getElementById('loading');
            if (loading) loading.style.display = 'none';
        },
        showToast: (message, type = 'info') => {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }
    };

    // Authentication and initialization
    ui.showLoading();

    onAuthStateChanged(auth, (user) => {
        ui.hideLoading();
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
    if (elements.addNoteBtn) elements.addNoteBtn.addEventListener('click', addNote);
    if (elements.searchInput) elements.searchInput.addEventListener('input', debounce(searchNotes, 300));
    if (elements.searchButton) elements.searchButton.addEventListener('click', searchNotes);
    if (elements.toggleThemeBtn) elements.toggleThemeBtn.addEventListener('click', toggleTheme);
    if (elements.logoutBtn) elements.logoutBtn.addEventListener('click', logout);
    if (elements.boardSelect) elements.boardSelect.addEventListener('change', changeBoard);
    if (elements.zoomInBtn) elements.zoomInBtn.addEventListener('click', () => {
        if (panzoomInstance) panzoomInstance.zoomIn();
    });
    if (elements.zoomOutBtn) elements.zoomOutBtn.addEventListener('click', () => {
        if (panzoomInstance) panzoomInstance.zoomOut();
    });
    if (elements.resetZoomBtn) elements.resetZoomBtn.addEventListener('click', resetView);
    if (elements.menuToggle) elements.menuToggle.addEventListener('click', toggleSidebar);

    // User interface functions
    function showLoggedInUI(displayName) {
        if (elements.userInfo) elements.userInfo.style.display = 'flex';
        if (elements.userName) elements.userName.textContent = displayName;
    }

    function initializePanzoom() {
        if (typeof panzoom === 'undefined') {
            console.error('Panzoom library is not loaded. Make sure to include the script in your HTML.');
            return;
        }

        if (!elements.corkboard) {
            console.error('Corkboard element not found');
            return;
        }

        panzoomInstance = panzoom(elements.corkboard, {
            maxZoom: 5,
            minZoom: 0.1,
            bounds: true,
            boundsPadding: 0.1
        });

        panzoomInstance.on('transform', (e) => {
            const currentScale = e.getTransform().scale;
            elements.corkboard.style.setProperty('--scale', 1 / currentScale);
        });

        // Disable panzoom when interacting with notes
        elements.corkboard.addEventListener('mousedown', (e) => {
            if (e.target.closest('.note')) {
                panzoomInstance.pause();
            }
        });

        document.addEventListener('mouseup', () => {
            panzoomInstance.resume();
        });
    }

    function resetView() {
        if (panzoomInstance) {
            panzoomInstance.moveTo(0, 0);
            panzoomInstance.zoomAbs(0, 0, 1);
        }
    }

    function toggleSidebar() {
        if (elements.sidebar) elements.sidebar.classList.toggle('sidebar-open');
    }

    // Note management functions
    function addNote() {
        const title = elements.noteTitle ? elements.noteTitle.value.trim() : '';
        const content = elements.noteContent ? elements.noteContent.value.trim() : '';
        const color = elements.noteColor ? elements.noteColor.value : '#ffffff';

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
                    if (elements.noteTitle) elements.noteTitle.value = '';
                    if (elements.noteContent) elements.noteContent.value = '';
                    ui.showToast('Note added successfully', 'success');
                    createNoteElement(newNoteRef.key, newNote);
                })
                .catch(error => {
                    ui.showToast('Error adding note: ' + error.message, 'error');
                });
        } else {
            ui.showToast('Please fill in both title and content', 'warning');
        }
    }

    function createNoteElement(id, note) {
        if (!note || typeof note !== 'object') {
            console.error('Invalid note data:', note);
            return;
        }

        const noteElement = document.createElement('div');
        noteElement.classList.add('note');
        noteElement.id = id;
        noteElement.style.backgroundColor = note.color || '#ffffff';
        noteElement.style.left = `${note.position?.x || 0}px`;
        noteElement.style.top = `${note.position?.y || 0}px`;
        
        noteElement.innerHTML = `
            <h3>${escapeHTML(note.title || '')}</h3>
            <p>${escapeHTML(note.content || '')}</p>
            <span class="author">By ${escapeHTML(note.author || 'Unknown')}</span>
            <div class="actions">
                <button class="edit" title="Edit"><span class="material-icons">edit</span></button>
                <button class="delete" title="Delete"><span class="material-icons">delete</span></button>
            </div>
        `;

        const editBtn = noteElement.querySelector('.edit');
        const deleteBtn = noteElement.querySelector('.delete');
        if (editBtn) editBtn.addEventListener('click', () => editNote(id, note));
        if (deleteBtn) deleteBtn.addEventListener('click', () => deleteNote(id));

        makeNoteDraggable(noteElement, id);
        if (elements.corkboard) elements.corkboard.appendChild(noteElement);
        notes[id] = note;
    }

    function loadNotes() {
        const notesRef = ref(database, `boards/${currentBoard}/notes`);
        onValue(notesRef, (snapshot) => {
            clearNotes();
            snapshot.forEach((childSnapshot) => {
                const id = childSnapshot.key;
                const note = childSnapshot.val();
                if (id && note) {
                    createNoteElement(id, note);
                }
            });
        }, (error) => {
            ui.showToast('Error loading notes: ' + error.message, 'error');
        });
    }

    function clearNotes() {
        if (elements.corkboard) {
            while (elements.corkboard.firstChild) {
                elements.corkboard.removeChild(elements.corkboard.firstChild);
            }
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
                start() {
                    // Disable panzoom when starting to drag a note
                    if (panzoomInstance) panzoomInstance.pause();
                },
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

                    // Re-enable panzoom after dragging ends
                    if (panzoomInstance) panzoomInstance.resume();
                }
            }
        });
    }

    function updateNotePosition(id, x, y) {
        update(ref(database, `boards/${currentBoard}/notes/${id}/position`), { x, y })
            .catch(error => {
                ui.showToast('Error updating note position: ' + error.message, 'error');
            });
    }

    function editNote(id, note) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Edit Note</h2>
                <input type="text" id="edit-title" value="${escapeHTML(note.title)}">
                <textarea id="edit-content">${escapeHTML(note.content)}</textarea>
                <input type="color" id="edit-color" value="${note.color}">
                <div class="modal-actions">
                    <button id="save-edit">Save</button>
                    <button id="cancel-edit">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const saveBtn = modal.querySelector('#save-edit');
        const cancelBtn = modal.querySelector('#cancel-edit');
        const titleInput = modal.querySelector('#edit-title');
        const contentInput = modal.querySelector('#edit-content');
        const colorInput = modal.querySelector('#edit-color');

        saveBtn.addEventListener('click', () => {
            const newTitle = titleInput.value.trim();
            const newContent = contentInput.value.trim();
            const newColor = colorInput.value;

            if (newTitle && newContent) {
                update(ref(database, `boards/${currentBoard}/notes/${id}`), {
                    title: newTitle,
                    content: newContent,
                    color: newColor
                }).then(() => {
                    ui.showToast('Note updated successfully', 'success');
                    loadNotes(); // Reload notes to reflect changes
                    modal.remove();
                }).catch(error => {
                    ui.showToast('Error updating note: ' + error.message, 'error');
                });
            } else {
                ui.showToast('Please fill in both title and content', 'warning');
            }
        });

        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });
    }

    function deleteNote(id) {
        if (confirm('Are you sure you want to delete this note?')) {
            remove(ref(database, `boards/${currentBoard}/notes/${id}`))
                .then(() => {
                    ui.showToast('Note deleted successfully', 'success');
                    const noteElement = document.getElementById(id);
                    if (noteElement) noteElement.remove();
                    delete notes[id];
                })
                .catch(error => {
                    ui.showToast('Error deleting note: ' + error.message, 'error');
                });
        }
    }

    function searchNotes() {
        const searchTerm = elements.searchInput ? elements.searchInput.value.toLowerCase() : '';
        Object.entries(notes).forEach(([id, note]) => {
            const noteElement = document.getElementById(id);
            if (noteElement) {
                const isVisible = (note.title || '').toLowerCase().includes(searchTerm) ||
                                  (note.content || '').toLowerCase().includes(searchTerm) ||
                                  (note.author || '').toLowerCase().includes(searchTerm);
                noteElement.style.display = isVisible ? 'block' : 'none';
            }
        });
    }

    function changeBoard() {
        if (elements.boardSelect) {
            currentBoard = elements.boardSelect.value;
            loadNotes();
            resetView();
            ui.showToast(`Switched to ${currentBoard} board`, 'info');
        }
    }

    // Theme management
    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDarkTheme = document.body.classList.contains('dark-theme');
        if (elements.toggleThemeBtn) {
            elements.toggleThemeBtn.innerHTML = isDarkTheme ? '<span class="material-icons">light_mode</span>' : '<span class="material-icons">dark_mode</span>';
        }
        localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
        ui.showToast(`Switched to ${isDarkTheme ? 'dark' : 'light'} theme`, 'info');
    }

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            if (elements.toggleThemeBtn) {
                elements.toggleThemeBtn.innerHTML = '<span class="material-icons">light_mode</span>';
            }
        }
    }

    // Authentication
    function logout() {
        signOut(auth).then(() => {
            window.location.href = 'https://fbl.dupuis.lol/account/signup';
        }).catch((error) => {
            ui.showToast('Error signing out: ' + error.message, 'error');
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
        if (typeof str !== 'string') {
            return '';
        }
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

    // New feature: Keyboard shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'n':
                        e.preventDefault();
                        addNote();
                        break;
                    case 'f':
                        e.preventDefault();
                        elements.searchInput.focus();
                        break;
                    case '0':
                        e.preventDefault();
                        resetView();
                        break;
                }
            }
        });
    }

    // New feature: Auto-save draft notes
    let noteDraft = {
        title: '',
        content: '',
        color: '#fef9b0'
    };

    function setupAutosave() {
        if (elements.noteTitle) {
            elements.noteTitle.addEventListener('input', saveDraft);
        }
        if (elements.noteContent) {
            elements.noteContent.addEventListener('input', saveDraft);
        }
        if (elements.noteColor) {
            elements.noteColor.addEventListener('change', saveDraft);
        }

        // Load draft on page load
        loadDraft();
    }

    function saveDraft() {
        noteDraft = {
            title: elements.noteTitle ? elements.noteTitle.value : '',
            content: elements.noteContent ? elements.noteContent.value : '',
            color: elements.noteColor ? elements.noteColor.value : '#fef9b0'
        };
        localStorage.setItem('noteDraft', JSON.stringify(noteDraft));
    }

    function loadDraft() {
        const savedDraft = localStorage.getItem('noteDraft');
        if (savedDraft) {
            noteDraft = JSON.parse(savedDraft);
            if (elements.noteTitle) elements.noteTitle.value = noteDraft.title;
            if (elements.noteContent) elements.noteContent.value = noteDraft.content;
            if (elements.noteColor) elements.noteColor.value = noteDraft.color;
        }
    }

    // New feature: Note statistics
    function updateNoteStatistics() {
        const totalNotes = Object.keys(notes).length;
        const colorCounts = {};
        Object.values(notes).forEach(note => {
            colorCounts[note.color] = (colorCounts[note.color] || 0) + 1;
        });

        const statsElement = document.createElement('div');
        statsElement.className = 'note-statistics';
        statsElement.innerHTML = `
            <h3>Board Statistics</h3>
            <p>Total Notes: ${totalNotes}</p>
            <h4>Notes by Color:</h4>
            <ul>
                ${Object.entries(colorCounts).map(([color, count]) => `
                    <li style="color: ${color}">
                        ${color}: ${count} note${count !== 1 ? 's' : ''}
                    </li>
                `).join('')}
            </ul>
        `;

        const existingStats = document.querySelector('.note-statistics');
        if (existingStats) {
            existingStats.replaceWith(statsElement);
        } else if (elements.sidebar) {
            elements.sidebar.appendChild(statsElement);
        }
    }

    // Initialize
    loadTheme();
    setupKeyboardShortcuts();
    setupAutosave();

    // Update note statistics whenever notes change
    const notesRef = ref(database, `boards/${currentBoard}/notes`);
    onValue(notesRef, updateNoteStatistics);
});
