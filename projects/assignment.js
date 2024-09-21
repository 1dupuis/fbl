import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

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

// State variables
let currentUser = null;
let currentAssignment = null;
let currentClass = null;
let currentMode = '3d';
let currentSpread = 0;
let spreads = [{ left: '', right: '' }];
let isEditing = false;

// Three.js variables
let scene, camera, renderer, book, leftPage, rightPage, pen;
let raycaster, mouse;
let writing = false;
let currentPageTexture;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const assignmentId = urlParams.get('id');
    const classCode = urlParams.get('class');

    if (!assignmentId || !classCode) {
        showNotification('Invalid assignment or class.', 'error');
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadAssignment(assignmentId, classCode).then(() => {
                document.getElementById('loadingIndicator').style.display = 'none';
                document.getElementById('content').style.display = 'block';
                init3DScene();
                setupEventListeners();
            });
        } else {
            window.location.href = '/account/login';
        }
    });
});

// Function to load assignment details
async function loadAssignment(assignmentId, classCode) {
    try {
        const assignmentRef = ref(database, `classes/${classCode}/assignments/${assignmentId}`);
        const assignmentSnapshot = await get(assignmentRef);
        
        if (assignmentSnapshot.exists()) {
            currentAssignment = assignmentSnapshot.val();
            currentAssignment.id = assignmentId;
            currentClass = classCode;
            displayAssignmentDetails();
            await loadSubmission();
        } else {
            showNotification('Assignment not found.', 'error');
        }
    } catch (error) {
        console.error('Error loading assignment:', error);
        showNotification('Failed to load assignment. Please try again.', 'error');
    }
}

// Function to display assignment details
function displayAssignmentDetails() {
    document.getElementById('assignmentTitle').textContent = currentAssignment.title;
    document.getElementById('assignmentDescription').textContent = currentAssignment.description;
    document.getElementById('assignmentDueDate').textContent = `Due: ${new Date(currentAssignment.dueDate).toLocaleString()}`;
}

// Function to load user's submission
async function loadSubmission() {
    try {
        const submissionRef = ref(database, `submissions/${currentClass}/${currentAssignment.id}/${currentUser.uid}`);
        const submissionSnapshot = await get(submissionRef);
        
        if (submissionSnapshot.exists()) {
            const submission = submissionSnapshot.val();
            spreads = submission.spreads || [{ left: '', right: '' }];
        } else {
            spreads = [{ left: '', right: '' }];
        }
        updateBookContent();
    } catch (error) {
        console.error('Error loading submission:', error);
        showNotification('Failed to load submission. Please try again.', 'error');
    }
}

// Function to initialize the 3D scene
function init3DScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xE8F0FE, 1);
    document.getElementById('bookContainer').appendChild(renderer.domElement);

    // Create book
    const bookGeometry = new THREE.BoxGeometry(10, 7, 0.5);
    const bookMaterial = new THREE.MeshPhongMaterial({
        color: 0x1E88E5,
        specular: 0x111111,
        shininess: 50
    });
    book = new THREE.Mesh(bookGeometry, bookMaterial);
    scene.add(book);

    // Create pages
    const pageGeometry = new THREE.PlaneGeometry(4.9, 6.9);
    const pageMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
    leftPage = new THREE.Mesh(pageGeometry, pageMaterial.clone());
    rightPage = new THREE.Mesh(pageGeometry, pageMaterial.clone());
    
    leftPage.position.set(-2.55, 0, 0.26);
    rightPage.position.set(2.55, 0, 0.26);
    
    book.add(leftPage);
    book.add(rightPage);

    // Lighting
    const light = new THREE.PointLight(0xFFFFFF, 1, 100);
    light.position.set(0, 0, 10);
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    camera.position.z = 10;

    // Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;

    // Raycaster for writing
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Pen
    const penGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 32);
    const penMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    pen = new THREE.Mesh(penGeometry, penMaterial);
    pen.rotation.x = Math.PI / 2;
    scene.add(pen);

    animate();
    updateBookContent();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Function to update book content
function updateBookContent() {
    const leftCanvas = createPageCanvas(spreads[currentSpread].left);
    const rightCanvas = createPageCanvas(spreads[currentSpread].right);
    
    leftPage.material.map = new THREE.CanvasTexture(leftCanvas);
    rightPage.material.map = new THREE.CanvasTexture(rightCanvas);
    
    leftPage.material.needsUpdate = true;
    rightPage.material.needsUpdate = true;

    currentPageTexture = rightPage.material.map;
    updatePageNumber();
}

// Function to create a canvas with text content
function createPageCanvas(content) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.font = '24px Arial';
    
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        ctx.fillText(line, 20, 40 + (index * 30));
    });
    
    return canvas;
}

// Function to handle writing on the book
function write(event) {
    if (!writing || !isEditing) return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([leftPage, rightPage]);
    
    if (intersects.length > 0) {
        const intersect = intersects[0];
        const uv = intersect.uv;
        const x = Math.floor(uv.x * 512);
        const y = Math.floor((1 - uv.y) * 512);
        
        const canvas = intersect.object === leftPage ? leftPage.material.map.image : rightPage.material.map.image;
        const context = canvas.getContext('2d');
        context.fillStyle = document.getElementById('penColor').value;
        context.beginPath();
        context.arc(x, y, document.getElementById('penSize').value, 0, 2 * Math.PI);
        context.fill();
        
        intersect.object.material.map.needsUpdate = true;
    }
}

// Function to navigate between spreads
function navigateSpread(direction) {
    if (direction === 'prev' && currentSpread > 0) {
        currentSpread--;
    } else if (direction === 'next' && currentSpread < spreads.length - 1) {
        currentSpread++;
    }
    updateBookContent();
    animatePageTurn(direction);
}

// Function to animate page turn
function animatePageTurn(direction) {
    const duration = 1000;
    const start = performance.now();
    
    function update(time) {
        const elapsed = time - start;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
        
        if (direction === 'next') {
            book.rotation.y = Math.PI / 4 * (1 - ease);
        } else {
            book.rotation.y = Math.PI / 4 * ease;
        }
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Function to add a new spread
function addSpread() {
    spreads.push({ left: '', right: '' });
    currentSpread = spreads.length - 1;
    updateBookContent();
}

// Function to delete the current spread
function deleteSpread() {
    if (spreads.length > 1) {
        spreads.splice(currentSpread, 1);
        if (currentSpread >= spreads.length) {
            currentSpread = spreads.length - 1;
        }
        updateBookContent();
    } else {
        showNotification('Cannot delete the only spread.', 'error');
    }
}

// Function to save the book
async function saveBook() {
    try {
        const submissionRef = ref(database, `submissions/${currentClass}/${currentAssignment.id}/${currentUser.uid}`);
        await set(submissionRef, {
            spreads: spreads,
            lastUpdated: new Date().toISOString()
        });
        showNotification('Book saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving book:', error);
        showNotification('Failed to save book. Please try again.', 'error');
    }
}

// Function to toggle edit mode
function toggleEditMode() {
    isEditing = !isEditing;
    document.getElementById('toggleEdit').textContent = isEditing ? 'View Mode' : 'Edit Mode';
    document.getElementById('toolbox').style.display = isEditing ? 'block' : 'none';
    document.getElementById('submissionContent').readOnly = !isEditing;
    updateBookContent();
}

// Function to export the book to PDF
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    spreads.forEach((spread, index) => {
        if (index > 0) {
            doc.addPage();
        }
        doc.setFontSize(12);
        doc.text(`Spread ${index + 1}`, 10, 10);
        doc.text("Left Page:", 10, 20);
        doc.text(spread.left, 10, 30);
        doc.text("Right Page:", 10, 120);
        doc.text(spread.right, 10, 130);
    });
    
    doc.save(`${currentAssignment.title}.pdf`);
}

// Function to clear the current page
function clearPage() {
    const canvas = currentPageTexture.image;
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    currentPageTexture.needsUpdate = true;
    updateBookContent();
}

// Function to update the page number display
function updatePageNumber() {
    document.getElementById('pageNumber').textContent = `Spread ${currentSpread + 1} of ${spreads.length}`;
}

// Function to show notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Function to set up event listeners
function setupEventListeners() {
    window.addEventListener('resize', onWindowResize, false);
    document.getElementById('prevPage').addEventListener('click', () => navigateSpread('prev'));
    document.getElementById('nextPage').addEventListener('click', () => navigateSpread('next'));
    document.getElementById('addPage').addEventListener('click', addSpread);
    document.getElementById('deletePage').addEventListener('click', deleteSpread);
    document.getElementById('saveBook').addEventListener('click', saveBook);
    document.getElementById('toggleEdit').addEventListener('click', toggleEditMode);
    document.getElementById('exportPDF').addEventListener('click', exportToPDF);
    document.getElementById('clearPage').addEventListener('click', clearPage);
    document.getElementById('toggleViewMode').addEventListener('click', toggleViewMode);
    document.getElementById('signOut').addEventListener('click', signOutUser);

    const bookContainer = document.getElementById('bookContainer');
    bookContainer.addEventListener('mousedown', onMouseDown);
    bookContainer.addEventListener('mousemove', onMouseMove);
    bookContainer.addEventListener('mouseup', onMouseUp);
    bookContainer.addEventListener('touchstart', onTouchStart, { passive: false });
    bookContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    bookContainer.addEventListener('touchend', onTouchEnd);

    document.addEventListener('keydown', handleKeyPress);
}

// Function to handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Mouse and touch event handlers
function onMouseDown(event) {
    event.preventDefault();
    writing = true;
    updateMousePosition(event);
}

function onMouseMove(event) {
    event.preventDefault();
    updateMousePosition(event);
    write(event);
}

function onMouseUp(event) {
    event.preventDefault();
    writing = false;
}

function onTouchStart(event) {
    event.preventDefault();
    writing = true;
    updateTouchPosition(event.touches[0]);
}

function onTouchMove(event) {
    event.preventDefault();
    updateTouchPosition(event.touches[0]);
    write(event.touches[0]);
}

function onTouchEnd(event) {
    event.preventDefault();
    writing = false;
}

function updateMousePosition(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function updateTouchPosition(touch) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
}

// Function to toggle between 2D and 3D view
function toggleViewMode() {
    currentMode = currentMode === '3d' ? '2d' : '3d';
    document.getElementById('bookContainer').style.display = currentMode === '3d' ? 'block' : 'none';
    document.getElementById('2dView').style.display = currentMode === '2d' ? 'block' : 'none';
    if (currentMode === '2d') {
        update2DView();
    }
}

// Function to update 2D view
function update2DView() {
    const content = spreads.map((spread, index) => 
        `Spread ${index + 1}:\nLeft Page: ${spread.left}\nRight Page: ${spread.right}\n\n`
    ).join('');
    document.getElementById('submissionContent').value = content;
}

// Function to handle key presses
function handleKeyPress(event) {
    if (event.key === 'ArrowLeft') {
        navigateSpread('prev');
    } else if (event.key === 'ArrowRight') {
        navigateSpread('next');
    }
}

// Function to sign out user
function signOutUser() {
    signOut(auth).then(() => {
        window.location.href = '/account/login';
    }).catch((error) => {
        console.error('Error signing out:', error);
        showNotification('Failed to sign out. Please try again.', 'error');
    });
}

// Initialize the application
init3DScene();
setupEventListeners();
