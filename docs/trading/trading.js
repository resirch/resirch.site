let currentUser = null;

// Function to update the UI after user logs in
function updateUIForLoggedInUser() {
    const userInfo = document.getElementById('user-info');
    userInfo.innerHTML = `
        <img src="${getAvatarUrl(currentUser)}" alt="Avatar" class="avatar">
        <span>${currentUser.username}</span>
        <button id="logout-btn" class="styled-button">Logout</button>
    `;
    document.getElementById('discord-login').style.display = 'none';

    // Attach event listener for logout
    document.getElementById('logout-btn').addEventListener('click', logout);
}

// Event listener for the Discord login button
document.getElementById('discord-login').addEventListener('click', () => {
    const params = new URLSearchParams({
        client_id: '1306118587794063420',
        redirect_uri: 'https://resirch.site/auth/discord/callback',
        response_type: 'code',
        scope: 'identify'
    });
    window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`;
});

// Check if user is already logged in
window.onload = async () => {
    try {
        // Fetch user data from the server
        const response = await fetch('/auth/discord/user', {
            credentials: 'include',
        });
        if (response.ok) {
            currentUser = await response.json();
            updateUIForLoggedInUser();
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    } finally {
        // Initialize the page after currentUser is set
        init();
    }
};

// Function to fetch posts from the server
async function fetchPosts() {
    try {
        const response = await fetch('/api/getPosts', {
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        const posts = await response.json();
        return posts;
    } catch (error) {
        console.error('Error fetching posts:', error);
        alert('Error fetching posts.');
        return [];
    }
}

// Function to render posts
function renderPosts(posts) {
    const postsGrid = document.getElementById('posts-grid');
    postsGrid.innerHTML = '';

    posts.forEach(post => {
        const postDiv = document.createElement('div');
        postDiv.classList.add('post');
        postDiv.innerHTML = `
            <img src="${getAvatarUrl(post.user)}" alt="Avatar" class="avatar">
            <h3>${post.title}</h3>
            <p>by ${post.user.username}</p>
            ${currentUser && (currentUser.id === post.user.discordId || currentUser.isAdmin)
                ? `<button class="delete-post-btn styled-button" data-post-id="${post._id}">Delete</button>`
                : ''}
        `;

        // Attach event listener for delete button
        const deleteButton = postDiv.querySelector('.delete-post-btn');
        if (deleteButton) {
            deleteButton.addEventListener('click', async (event) => {
                event.stopPropagation();
                const postId = deleteButton.getAttribute('data-post-id');
                await deletePost(postId);
            });
        }

        // Attach event listener to open post modal
        postDiv.addEventListener('click', () => {
            openPostModal(post._id);
        });

        postsGrid.appendChild(postDiv);
    });
}

// Function to open the post modal
async function openPostModal(postId) {
    try {
        const response = await fetch(`/api/getPost?id=${postId}`);
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        const post = await response.json();

        // Populate the modal with post data
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = `
            <span class="close-btn" id="close-modal">&times;</span>
            <h2>${post.title}</h2>
            <p>${post.content}</p>
            <p>by ${post.user.username}</p>
            <div id="replies-container">
                <h3>Replies</h3>
                ${post.replies.map(reply => `
                    <div class="reply">
                        <p>${reply.content}</p>
                        <p>by ${reply.user.username}</p>
                        ${currentUser && (currentUser.id === reply.user.discordId || currentUser.isAdmin)
                            ? `<button class="delete-reply-btn" data-reply-id="${reply._id}" data-post-id="${post._id}">Delete</button>`
                            : ''}
                    </div>
                `).join('')}
            </div>
            <form id="reply-form">
                <textarea id="reply-content" placeholder="Add a reply..." required maxlength="500"></textarea>
                <button type="submit" class="styled-button">Submit Reply</button>
            </form>
        `;

        // Show the modal
        document.getElementById('post-modal').style.display = 'block';

        // Attach event listener to close button
        document.getElementById('close-modal').addEventListener('click', () => {
            document.getElementById('post-modal').style.display = 'none';
        });

        // Attach event listener for reply form submission
        document.getElementById('reply-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            await submitReply(postId);
            // Refresh the modal content
            openPostModal(postId);
        });

        // Event listener for reply deletion
        document.querySelectorAll('.delete-reply-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation();
                const replyId = button.getAttribute('data-reply-id');
                await deleteReply(postId, replyId);
                // Refresh the modal content
                openPostModal(postId);
            });
        });

    } catch (error) {
        console.error('Error fetching post:', error);
        alert('Error fetching post details.');
    }
}

// Function to initialize the page
async function init() {
    let posts = await fetchPosts();

    // Sort posts: pinned posts first, then by date posted
    posts.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.datePosted) - new Date(a.datePosted);
    });

    renderPosts(posts);

    // Search functionality
    document.getElementById('search-input').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filteredPosts = posts.filter(post => post.title.toLowerCase().includes(query));
        renderPosts(filteredPosts);
    });
}

// Helper function to get avatar URL
function getAvatarUrl(user) {
    const userId = user.discordId || user.id;
    if (user && user.avatar && userId) {
        return `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`;
    } else {
        console.error('Missing avatar or userId:', user);
        return '/media/default_avatar.png';
    }
}

// Other functions like deletePost, deleteReply, logout, etc.
// Ensure these functions are properly defined in your script

async function deletePost(postId) {
    if (confirm('Are you sure you want to delete this post?')) {
        try {
            const response = await fetch(`/api/deletePost/${postId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });

            const result = await response.json();

            if (result.success) {
                alert('Post deleted successfully!');
                // Refresh the posts
                init();
            } else {
                alert(result.error || 'An error occurred while deleting the post.');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            alert('An error occurred while deleting the post.');
        }
    }
}

async function deleteReply(postId, replyId) {
    if (confirm('Are you sure you want to delete this reply?')) {
        try {
            const response = await fetch(`/api/deleteReply/${postId}/${replyId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });

            const result = await response.json();

            if (result.success) {
                alert('Reply deleted successfully!');
                // Refresh the modal content
                openPostModal(postId);
            } else {
                alert(result.error || 'An error occurred while deleting the reply.');
            }
        } catch (error) {
            console.error('Error deleting reply:', error);
            alert('An error occurred while deleting the reply.');
        }
    }
}

// Event listener for the 'Create Post' button
document.getElementById('create-post-btn').addEventListener('click', openCreatePostModal);

function openCreatePostModal() {
    if (!currentUser) {
        alert('You need to be logged in to create a post.');
        return;
    }
    document.getElementById('create-post-modal').style.display = 'block';
}

// Event listener for closing the create post modal
document.getElementById('close-create-modal').addEventListener('click', () => {
    document.getElementById('create-post-modal').style.display = 'none';
});

// Event listener for submit event on create post form
document.getElementById('create-post-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitPost();
});

async function submitPost() {
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();

    if (!title || !content) {
        alert('Please fill out both the title and content.');
        return;
    }

    try {
        const response = await fetch('/api/createPost', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, content }),
            credentials: 'include',
        });

        const result = await response.json();

        if (result.success) {
            alert('Post created successfully!');
            // Close the modal
            document.getElementById('create-post-modal').style.display = 'none';
            // Refresh posts
            init();
        } else {
            alert(result.error || 'An error occurred while creating the post.');
        }
    } catch (error) {
        console.error('Error creating post:', error);
        alert('An error occurred while creating the post.');
    }
}

async function logout() {
    try {
        const response = await fetch('/auth/discord/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        });

        const result = await response.json();

        if (result.success) {
            // Remove current user info
            currentUser = null;
            // Update UI to reflect logged-out state
            document.getElementById('user-info').innerHTML = '';
            document.getElementById('discord-login').style.display = 'block';

            // Refresh posts
            init();
        } else {
            alert(result.error || 'An error occurred while logging out.');
        }
    } catch (error) {
        console.error('Error logging out:', error);
        alert('An error occurred while logging out.');
    }
}

// Function to submit a reply
async function submitReply(postId) {
    const content = document.getElementById('reply-content').value.trim();

    if (!content) {
        alert('Please enter a reply.');
        return;
    }

    try {
        const response = await fetch(`/api/createReply/${postId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
            credentials: 'include',
        });

        const result = await response.json();

        if (result.success) {
            // Clear the reply input
            document.getElementById('reply-content').value = '';
            // Optionally, close the modal or refresh the replies
            alert('Reply submitted successfully!');
        } else {
            alert(result.error || 'An error occurred while submitting the reply.');
        }
    } catch (error) {
        console.error('Error submitting reply:', error);
        alert('An error occurred while submitting the reply.');
    }
}