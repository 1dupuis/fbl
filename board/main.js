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
    const corkboard = document.getElementById('corkboard');
    const addNoteBtn = document.getElementById('add-note');
    const noteTitle = document.getElementById('note-title');
    const noteContent = document.getElementById('note-content');
    const filterSubject = document.getElementById('filter-subject');
    const searchInput = document.getElementById('search');
    const noteSubject = document.getElementById('note-subject');
    const noteColor = document.getElementById('note-color');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const toggleViewBtn = document.getElementById('toggle-view');
    const toggleThemeBtn = document.getElementById('toggle-theme');
    const logoutBtn = document.getElementById('logout-btn');
    const boardSelect = document.getElementById('board-select');
    const addBoardBtn = document.getElementById('add-board-btn');

    let currentUser = null;
    let isListView = false;
    let currentBoard = 'general';
    let boards = [];

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

    showLoading();

    onAuthStateChanged(auth, (user) => {
        hideLoading();
        if (user) {
            currentUser = user;
            showLoggedInUI(user.email);
            loadBoards();
        } else {
            window.location.href = 'https://fbl.dupuis.lol/account/signup';
        }
    });

    // Event listeners
    addNoteBtn.addEventListener('click', addNote);
    filterSubject.addEventListener('change', filterNotes);
    searchInput.addEventListener('input', searchNotes);
    toggleViewBtn.addEventListener('click', toggleView);
    toggleThemeBtn.addEventListener('click', toggleTheme);
    logoutBtn.addEventListener('click', logout);
    boardSelect.addEventListener('change', changeBoard);
    addBoardBtn.addEventListener('click', addBoard);

    function showLoggedInUI(email) {
        userInfo.style.display = 'flex';
        userName.textContent = email;
    }

    function addNote() {
        const title = noteTitle.value.trim();
        const content = noteContent.value.trim();
        const subject = noteSubject.value;
        const color = noteColor.value;

        if (title && content && currentUser) {
            const notesRef = ref(database, `boards/${currentBoard}/notes`);
            const newNoteRef = push(notesRef);
            set(newNoteRef, {
                userId: currentUser.uid,
                title: title,
                content: content,
                subject: subject,
                color: color,
                timestamp: Date.now(),
                position: { x: Math.random() * 500, y: Math.random() * 300 }
            }).then(() => {
                noteTitle.value = '';
                noteContent.value = '';
                showToast('Note added successfully', 'success');
            }).catch(error => {
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
        noteElement.style.transform = `translate(${note.position.x}px, ${note.position.y}px)`;
        noteElement.innerHTML = `
            <h3>${note.title}</h3>
            <p>${note.content}</p>
            <span class="subject">${note.subject}</span>
            <div class="actions">
                <button class="edit"><i class="fas fa-edit"></i></button>
                <button class="delete"><i class="fas fa-trash"></i></button>
                <button class="share"><i class="fas fa-share"></i></button>
            </div>
        `;
        noteElement.querySelector('.edit').addEventListener('click', () => editNote(id, note));
        noteElement.querySelector('.delete').addEventListener('click', () => deleteNote(id));
        noteElement.querySelector('.share').addEventListener('click', () => shareNote(id, note));
        makeNoteDraggable(noteElement, id);
        return noteElement;
    }

    function loadNotes() {
        const notesRef = ref(database, `boards/${currentBoard}/notes`);
        onValue(notesRef, (snapshot) => {
            clearNotes();
            snapshot.forEach((childSnapshot) => {
                const id = childSnapshot.key;
                const note = childSnapshot.val();
                if (note.userId === currentUser.uid) {
                    const noteElement = createNoteElement(id, note);
                    corkboard.appendChild(noteElement);
                }
            });
            applyCurrentView();
        }, (error) => {
            showToast('Error loading notes: ' + error.message, 'error');
        });
    }

    function clearNotes() {
        while (corkboard.firstChild) {
            corkboard.removeChild(corkboard.firstChild);
        }
    }

    function makeNoteDraggable(noteElement, id) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        noteElement.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            noteElement.style.top = (noteElement.offsetTop - pos2) + "px";
            noteElement.style.left = (noteElement.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            updateNotePosition(id, noteElement.offsetLeft, noteElement.offsetTop);
        }
    }

    function updateNotePosition(id, x, y) {
        update(ref(database, `boards/${currentBoard}/notes/${id}/position`), { x, y });
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
                })
                .catch(error => {
                    showToast('Error deleting note: ' + error.message, 'error');
                });
        }
    }

    function shareNote(id, note) {
        const shareLink = `${window.location.origin}/share?board=${currentBoard}&note=${id}`;
        navigator.clipboard.writeText(shareLink).then(() => {
            showToast('Share link copied to clipboard!', 'success');
        }).catch(err => {
            showToast('Error copying share link: ' + err, 'error');
        });
    }

    function filterNotes() {
        const selectedSubject = filterSubject.value;
        const notes = corkboard.getElementsByClassName('note');
        for (const note of notes) {
            const noteSubject = note.querySelector('.subject').textContent;
            note.style.display = selectedSubject === '' || noteSubject === selectedSubject ? 'block' : 'none';
        }
    }

    function searchNotes() {
        const searchTerm = searchInput.value.toLowerCase();
        const notes = corkboard.getElementsByClassName('note');
        for (const note of notes) {
            const title = note.querySelector('h3').textContent.toLowerCase();
            const content = note.querySelector('p').textContent.toLowerCase();
            note.style.display = title.includes(searchTerm) || content.includes(searchTerm) ? 'block' : 'none';
        }
    }

    function toggleView() {
        isListView = !isListView;
        applyCurrentView();
        toggleViewBtn.innerHTML = isListView ? '<i class="fas fa-th-large"></i>' : '<i class="fas fa-list"></i>';
    }

    function applyCurrentView() {
        corkboard.classList.toggle('list-view', isListView);
        const notes = corkboard.getElementsByClassName('note');
        for (const note of notes) {
            if (isListView) {
                note.style.transform = 'none';
                note.style.position = 'static';
            } else {
                const x = parseFloat(note.getAttribute('data-x')) || 0;
                const y = parseFloat(note.getAttribute('data-y')) || 0;
                note.style.transform = `translate(${x}px, ${y}px)`;
                note.style.position = 'absolute';
            }
        }
    }

    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDarkTheme = document.body.classList.contains('dark-theme');
        toggleThemeBtn.innerHTML = isDarkTheme ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    }

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            toggleThemeBtn.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }

    function logout() {
        signOut(auth).then(() => {
            window.location.href = 'https://fbl.dupuis.lol/account/signup';
        }).catch((error) => {
            showToast('Error signing out: ' + error.message, 'error');
        });
    }

    function loadBoards() {
        const boardsRef = ref(database, `users/${currentUser.uid}/boards`);
        onValue(boardsRef, (snapshot) => {
            boards = snapshot.val() || { general: 'General Board' };
            updateBoardSelect();
            loadNotes();
        }, (error) => {
            showToast('Error loading boards: ' + error.message, 'error');
        });
    }

    function updateBoardSelect() {
        boardSelect.innerHTML = '';
        Object.entries(boards).forEach(([id, name]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            boardSelect.appendChild(option);
        });
    }

    function changeBoard() {
        currentBoard = boardSelect.value;
        loadNotes();
    }

    function addBoard() {
        const boardName = prompt('Enter new board name:');
        if (boardName && boardName.trim()) {
            const newBoardRef = push(ref(database, `users/${currentUser.uid}/boards`));
            set(newBoardRef, boardName.trim())
                .then(() => {
                    showToast('New board added successfully', 'success');
                    loadBoards();
                })
                .catch(error => {
                    showToast('Error adding new board: ' + error.message, 'error');
                });
        }
    }

    // Initialize
    loadTheme();
});
