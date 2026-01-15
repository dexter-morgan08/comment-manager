let comments = {};
let editingId = null;
const categoryColors = [
    '#ef4444', '#10b981', '#f59e0b', '#3b82f6', 
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
];

const categoryInput = document.getElementById('categoryInput');
const recommendations = document.getElementById('recommendations');
const loading = document.getElementById('loading');

// Wait for Firebase to initialize
window.addEventListener('load', function() {
    setTimeout(initializeApp, 500);
});

function initializeApp() {
    if (typeof window.firebaseDB === 'undefined') {
        alert('Firebase not configured! Please add your Firebase config to index.html');
        loading.style.display = 'none';
        return;
    }
    loadDataFromFirebase();
}

// Load data from Firebase
function loadDataFromFirebase() {
    const commentsRef = window.firebaseRef(window.firebaseDB, 'comments');
    
    window.firebaseOnValue(commentsRef, (snapshot) => {
        if (snapshot.exists()) {
            comments = snapshot.val();
        } else {
            comments = {};
        }
        loading.style.display = 'none';
        renderComments();
    });
}

// Save data to Firebase
function saveDataToFirebase() {
    const commentsRef = window.firebaseRef(window.firebaseDB, 'comments');
    window.firebaseSet(commentsRef, comments);
}

categoryInput.addEventListener('input', showRecommendations);
categoryInput.addEventListener('focus', showRecommendations);

document.addEventListener('click', function(e) {
    if (!e.target.closest('.category-input-wrapper')) {
        recommendations.classList.remove('show');
    }
});

function showRecommendations() {
    const input = categoryInput.value.toLowerCase().trim();
    const categories = Object.keys(comments);

    if (categories.length === 0) {
        recommendations.classList.remove('show');
        return;
    }

    const filtered = categories.filter(cat => 
        cat.toLowerCase().includes(input) || input === ''
    );

    if (filtered.length === 0) {
        recommendations.classList.remove('show');
        return;
    }

    const sorted = filtered.sort((a, b) => 
        comments[b].length - comments[a].length
    );

    recommendations.innerHTML = sorted.map(cat => `
        <div class="recommendation-item" onclick="selectCategory('${cat}')">
            <span>${cat}</span>
            <span class="recommendation-count">${comments[cat].length}</span>
        </div>
    `).join('');

    recommendations.classList.add('show');
}

function selectCategory(category) {
    categoryInput.value = category;
    recommendations.classList.remove('show');
    categoryInput.focus();
}

function getCategoryColor(category) {
    const categories = Object.keys(comments).sort();
    const index = categories.indexOf(category);
    return categoryColors[index % categoryColors.length];
}

function addComment() {
    const text = document.getElementById('commentText').value.trim();
    const category = categoryInput.value.trim();

    if (!text) {
        alert('Please enter a comment!');
        return;
    }

    if (!category) {
        alert('Please enter a category name!');
        return;
    }

    if (editingId !== null) {
        updateComment();
        return;
    }

    if (!comments[category]) {
        comments[category] = [];
    }

    const comment = {
        id: Date.now(),
        text: text,
        category: category
    };

    comments[category].push(comment);
    document.getElementById('commentText').value = '';
    categoryInput.value = '';
    
    saveDataToFirebase();
    renderComments();
}

function renderComments() {
    const container = document.getElementById('categoriesContainer');
    const categories = Object.keys(comments);

    if (categories.length === 0) {
        container.innerHTML = '<div class="no-categories">Create your first comment to get started! 🚀</div>';
        return;
    }

    container.innerHTML = categories.map(category => {
        const color = getCategoryColor(category);
        const categoryComments = comments[category] || [];

        return `
            <div class="category-card" style="border-top: 4px solid ${color}">
                <div class="category-header" style="border-color: ${color}">
                    <h2 class="category-title" style="color: ${color}">${category}</h2>
                    <div class="category-controls">
                        <span class="comment-count">${categoryComments.length}</span>
                        <button class="delete-category-btn" onclick="deleteCategory('${category}')">Delete Category</button>
                    </div>
                </div>
                <div class="comments-list">
                    ${categoryComments.length === 0 
                        ? '<p class="empty-state">No comments yet</p>'
                        : categoryComments.map(comment => `
                            <div class="comment-item" style="border-color: ${color}">
                                <div class="comment-text">${comment.text}</div>
                                <div class="comment-actions">
                                    <button class="btn btn-copy" onclick="copyComment(${comment.id}, '${category}')">Copy</button>
                                    <button class="btn btn-secondary" onclick="editComment(${comment.id}, '${category}')">Edit</button>
                                    <button class="btn btn-danger" onclick="deleteComment(${comment.id}, '${category}')">Delete</button>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        `;
    }).join('');
}

function copyComment(id, category) {
    const comment = comments[category].find(c => c.id === id);
    if (comment) {
        navigator.clipboard.writeText(comment.text).then(() => {
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            btn.style.background = '#10b981';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '#3b82f6';
            }, 2000);
        });
    }
}

function editComment(id, category) {
    const comment = comments[category].find(c => c.id === id);
    if (!comment) return;

    editingId = id;
    document.getElementById('commentText').value = comment.text;
    categoryInput.value = category;

    const addBtn = document.querySelector('.btn-primary');
    addBtn.textContent = 'Update Comment';
    addBtn.classList.remove('btn-primary');
    addBtn.classList.add('btn-success');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateComment() {
    const text = document.getElementById('commentText').value.trim();
    const newCategory = categoryInput.value.trim();

    if (!text) {
        alert('Please enter a comment!');
        return;
    }

    if (!newCategory) {
        alert('Please enter a category name!');
        return;
    }

    let oldCategory = null;
    for (const cat in comments) {
        const index = comments[cat].findIndex(c => c.id === editingId);
        if (index !== -1) {
            oldCategory = cat;
            comments[cat].splice(index, 1);
            if (comments[cat].length === 0 && oldCategory !== newCategory) {
                delete comments[oldCategory];
            }
            break;
        }
    }

    if (!comments[newCategory]) {
        comments[newCategory] = [];
    }

    comments[newCategory].push({
        id: editingId,
        text: text,
        category: newCategory
    });

    saveDataToFirebase();
    resetForm();
    renderComments();
}

function deleteComment(id, category) {
    if (confirm('Are you sure you want to delete this comment?')) {
        const index = comments[category].findIndex(c => c.id === id);
        if (index !== -1) {
            comments[category].splice(index, 1);
            if (comments[category].length === 0) {
                delete comments[category];
            }
            saveDataToFirebase();
            renderComments();
        }
    }
}

function deleteCategory(category) {
    if (confirm(`Are you sure you want to delete the entire "${category}" category and all its comments?`)) {
        delete comments[category];
        saveDataToFirebase();
        renderComments();
    }
}

function resetForm() {
    editingId = null;
    document.getElementById('commentText').value = '';
    categoryInput.value = '';
    
    const addBtn = document.querySelector('.btn-success, .btn-primary');
    addBtn.textContent = 'Add Comment';
    addBtn.classList.remove('btn-success');
    addBtn.classList.add('btn-primary');
}
