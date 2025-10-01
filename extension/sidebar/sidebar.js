// VOTP Sidebar JavaScript
// Handles all sidebar functionality including authentication and comments

(function() {
    'use strict';
    
    // State management
    let appState = {
        isAuthenticated: false,
        user: null,
        token: null,
        currentUrl: null,
        pageTitle: null,
        comments: [],
        isLoading: false
    };
    
    // DOM elements
    const elements = {
        // Loading
        loadingScreen: null,
        
        // Header
        closeBtn: null,
        
        // Auth section
        authSection: null,
        signinForm: null,
        passwordForm: null,
        signupForm: null,
        
        // Auth forms
        emailForm: null,
        emailInput: null,
        emailNextBtn: null,
        
        loginForm: null,
        loginEmail: null,
        passwordInput: null,
        loginBtn: null,
        backToEmailBtn: null,
        
        signupEmail: null,
        sendCodeBtn: null,
        backToEmailBtn2: null,
        signupStep1: null,
        signupStep2: null,
        
        verificationForm: null,
        verifyEmail: null,
        verificationCode: null,
        nameInput: null,
        newPasswordInput: null,
        completeSignupBtn: null,
        resendCodeBtn: null,
        
        // User section
        userSection: null,
        userAvatar: null,
        userName: null,
        userEmail: null,
        logoutBtn: null,
        
        // Page info
        pageTitle: null,
        pageUrl: null,
        
        // Comments
        newCommentForm: null,
        commentInput: null,
        charCount: null,
        postCommentBtn: null,
        refreshCommentsBtn: null,
        commentsList: null,
        commentsLoading: null,
        commentsEmpty: null,
        commentsError: null,
        
        // Toast container
        toastContainer: null,
        
        // Error banner
        errorBanner: null,
        errorMessage: null,
        dismissError: null
    };
    
    // Initialize the sidebar
    function initialize() {
        console.log('VOTP Sidebar: Initializing...');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeElements);
        } else {
            initializeElements();
        }
    }
    
    // Initialize DOM elements and event listeners
    function initializeElements() {
        // Get DOM elements
        cacheElements();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up parent window communication
        setupParentCommunication();
        
        // Check authentication status
        checkAuthStatus();
        
        // Hide loading screen
        hideLoadingScreen();
        
        console.log('VOTP Sidebar: Initialized successfully');
    }
    
    // Cache DOM elements
    function cacheElements() {
        // Loading
        elements.loadingScreen = document.getElementById('loading-screen');
        
        // Header
        elements.closeBtn = document.getElementById('close-btn');
        
        // Auth section
        elements.authSection = document.getElementById('auth-section');
        elements.signinForm = document.getElementById('signin-form');
        elements.passwordForm = document.getElementById('password-form');
        elements.signupForm = document.getElementById('signup-form');
        
        // Auth forms
        elements.emailForm = document.getElementById('email-form');
        elements.emailInput = document.getElementById('email-input');
        elements.emailNextBtn = document.getElementById('email-next-btn');
        
        elements.loginForm = document.getElementById('login-form');
        elements.loginEmail = document.getElementById('login-email');
        elements.passwordInput = document.getElementById('password-input');
        elements.loginBtn = document.getElementById('login-btn');
        elements.backToEmailBtn = document.getElementById('back-to-email-btn');
        
        elements.signupEmail = document.getElementById('signup-email');
        elements.sendCodeBtn = document.getElementById('send-code-btn');
        elements.backToEmailBtn2 = document.getElementById('back-to-email-btn-2');
        elements.signupStep1 = document.getElementById('signup-step-1');
        elements.signupStep2 = document.getElementById('signup-step-2');
        
        elements.verificationForm = document.getElementById('verification-form');
        elements.verifyEmail = document.getElementById('verify-email');
        elements.verificationCode = document.getElementById('verification-code');
        elements.nameInput = document.getElementById('name-input');
        elements.newPasswordInput = document.getElementById('new-password-input');
        elements.completeSignupBtn = document.getElementById('complete-signup-btn');
        elements.resendCodeBtn = document.getElementById('resend-code-btn');
        
        // User section
        elements.userSection = document.getElementById('user-section');
        elements.userAvatar = document.getElementById('user-avatar');
        elements.userName = document.getElementById('user-name');
        elements.userEmail = document.getElementById('user-email');
        elements.logoutBtn = document.getElementById('logout-btn');
        
        // Page info
        elements.pageTitle = document.getElementById('page-title');
        elements.pageUrl = document.getElementById('page-url');
        
        // Comments
        elements.newCommentForm = document.getElementById('new-comment-form');
        elements.commentInput = document.getElementById('comment-input');
        elements.charCount = document.getElementById('char-count');
        elements.postCommentBtn = document.getElementById('post-comment-btn');
        elements.refreshCommentsBtn = document.getElementById('refresh-comments-btn');
        elements.commentsList = document.getElementById('comments-list');
        elements.commentsLoading = document.getElementById('comments-loading');
        elements.commentsEmpty = document.getElementById('comments-empty');
        elements.commentsError = document.getElementById('comments-error');
        
        // Toast container
        elements.toastContainer = document.getElementById('toast-container');
        
        // Error banner
        elements.errorBanner = document.getElementById('error-banner');
        elements.errorMessage = document.getElementById('error-message');
        elements.dismissError = document.getElementById('dismiss-error');
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Header
        elements.closeBtn?.addEventListener('click', closeSidebar);
        
        // Auth forms
        elements.emailForm?.addEventListener('submit', handleEmailSubmit);
        elements.loginForm?.addEventListener('submit', handleLoginSubmit);
        elements.verificationForm?.addEventListener('submit', handleSignupSubmit);
        
        // Auth buttons
        elements.sendCodeBtn?.addEventListener('click', handleSendVerificationCode);
        elements.backToEmailBtn?.addEventListener('click', showEmailForm);
        elements.backToEmailBtn2?.addEventListener('click', showEmailForm);
        elements.resendCodeBtn?.addEventListener('click', handleSendVerificationCode);
        
        // User actions
        elements.logoutBtn?.addEventListener('click', handleLogout);
        
        // Comments
        elements.newCommentForm?.addEventListener('submit', handleCommentSubmit);
        elements.commentInput?.addEventListener('input', updateCharCount);
        elements.refreshCommentsBtn?.addEventListener('click', refreshComments);
        
        // Error handling
        elements.dismissError?.addEventListener('click', hideErrorBanner);
        
        // Retry button in comments error (dynamically added)
        elements.commentsList?.addEventListener('click', (e) => {
            if (e.target.classList.contains('retry-btn')) {
                refreshComments();
            }
        });
    }
    
    // Set up communication with parent window (content script)
    function setupParentCommunication() {
        window.addEventListener('message', (event) => {
            switch (event.data.type) {
                case 'SIDEBAR_VISIBLE':
                    handleSidebarVisible(event.data);
                    break;
                    
                case 'CURRENT_URL':
                    handleCurrentUrl(event.data);
                    break;
                    
                case 'API_RESPONSE':
                    handleApiResponse(event.data);
                    break;
                    
                case 'AUTH_RESPONSE':
                    handleAuthResponse(event.data);
                    break;
                    
                case 'STATE_UPDATE':
                    handleStateUpdate(event.data.data);
                    break;
                    
                case 'PAGE_VISIBILITY_CHANGED':
                    handlePageVisibilityChanged(event.data.visible);
                    break;
            }
        });
        
        // Request current URL when sidebar loads
        requestCurrentUrl();
    }
    
    // Hide loading screen
    function hideLoadingScreen() {
        if (elements.loadingScreen) {
            elements.loadingScreen.style.display = 'none';
        }
    }
    
    // Close sidebar
    function closeSidebar() {
        sendMessageToParent({ type: 'CLOSE_SIDEBAR' });
    }
    
    // Send message to parent window
    function sendMessageToParent(message) {
        window.parent.postMessage(message, '*');
    }
    
    // Request current URL
    function requestCurrentUrl() {
        sendMessageToParent({ type: 'GET_CURRENT_URL' });
    }
    
    // Handle sidebar visible event
    function handleSidebarVisible(data) {
        appState.currentUrl = data.url;
        appState.pageTitle = data.title;
        updatePageInfo();
        
        if (appState.isAuthenticated) {
            loadComments();
        }
    }
    
    // Handle current URL response
    function handleCurrentUrl(data) {
        appState.currentUrl = data.url;
        appState.pageTitle = data.title;
        updatePageInfo();
    }
    
    // Update page info display
    function updatePageInfo() {
        if (elements.pageTitle) {
            elements.pageTitle.textContent = appState.pageTitle || 'Current Page';
        }
        if (elements.pageUrl) {
            const url = appState.currentUrl || '';
            const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
            elements.pageUrl.textContent = displayUrl;
            elements.pageUrl.title = url;
        }
    }
    
    // Check authentication status
    function checkAuthStatus() {
        sendAuthRequest('GET_AUTH_STATUS', null, (response) => {
            if (response.error) {
                console.error('Error checking auth status:', response.error);
                showAuthSection();
            } else {
                if (response.isAuthenticated && response.user) {
                    appState.isAuthenticated = true;
                    appState.user = response.user;
                    appState.token = response.token;
                    showUserSection();
                } else {
                    showAuthSection();
                }
            }
        });
    }
    
    // Send authentication request
    function sendAuthRequest(authType, data, callback) {
        const requestId = Date.now().toString();
        
        // Store callback for response
        window[`authCallback_${requestId}`] = callback;
        
        sendMessageToParent({
            type: 'AUTH_REQUEST',
            authType: authType,
            data: data,
            requestId: requestId
        });
    }
    
    // Handle authentication response
    function handleAuthResponse(data) {
        const callback = window[`authCallback_${data.requestId}`];
        if (callback) {
            callback(data.data);
            delete window[`authCallback_${data.requestId}`];
        }
    }
    
    // Show authentication section
    function showAuthSection() {
        elements.authSection?.classList.remove('hidden');
        elements.userSection?.classList.add('hidden');
        showEmailForm();
    }
    
    // Show user section
    function showUserSection() {
        elements.authSection?.classList.add('hidden');
        elements.userSection?.classList.remove('hidden');
        updateUserDisplay();
        loadComments();
    }
    
    // Show email form
    function showEmailForm() {
        elements.signinForm?.classList.remove('hidden');
        elements.passwordForm?.classList.add('hidden');
        elements.signupForm?.classList.add('hidden');
        
        // Reset forms
        elements.emailInput?.focus();
        resetForm(elements.emailForm);
        resetForm(elements.loginForm);
        resetForm(elements.verificationForm);
    }
    
    // Show password form (login)
    function showPasswordForm(email) {
        elements.signinForm?.classList.add('hidden');
        elements.passwordForm?.classList.remove('hidden');
        elements.signupForm?.classList.add('hidden');
        
        if (elements.loginEmail) {
            elements.loginEmail.textContent = email;
        }
        elements.passwordInput?.focus();
    }
    
    // Show signup form
    function showSignupForm(email) {
        elements.signinForm?.classList.add('hidden');
        elements.passwordForm?.classList.add('hidden');
        elements.signupForm?.classList.remove('hidden');
        
        if (elements.signupEmail) {
            elements.signupEmail.textContent = email;
        }
        if (elements.verifyEmail) {
            elements.verifyEmail.textContent = email;
        }
        
        elements.signupStep1?.classList.remove('hidden');
        elements.signupStep2?.classList.add('hidden');
    }
    
    // Handle email form submission
    async function handleEmailSubmit(e) {
        e.preventDefault();
        
        const email = elements.emailInput?.value.trim();
        if (!email) return;
        
        setButtonLoading(elements.emailNextBtn, true);
        
        try {
            const response = await makeApiRequest({
                query: `
                    mutation CheckEmail($email: String!) {
                        checkEmail(email: $email)
                    }
                `,
                variables: { email }
            });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            const userExists = response.data?.data?.checkEmail;
            
            if (userExists) {
                showPasswordForm(email);
            } else {
                showSignupForm(email);
            }
            
        } catch (error) {
            console.error('Error checking email:', error);
            // Check if it's an extension context error
            if (isExtensionContextError(error)) {
                showToast('Extension was reloaded. Please refresh the page.', 'error');
            } else {
                showToast('Failed to check email. Please try again.', 'error');
            }
        } finally {
            setButtonLoading(elements.emailNextBtn, false);
        }
    }
    
    // Handle login form submission
    async function handleLoginSubmit(e) {
        e.preventDefault();
        
        const email = elements.loginEmail?.textContent;
        const password = elements.passwordInput?.value;
        
        if (!email || !password) return;
        
        setButtonLoading(elements.loginBtn, true);
        
        try {
            const response = await makeApiRequest({
                query: `
                    mutation Login($email: String!, $password: String!) {
                        login(email: $email, password: $password) {
                            token
                            user {
                                id
                                name
                                email
                                phoneNumber
                                bio
                                createdAt
                                updatedAt
                            }
                        }
                    }
                `,
                variables: { email, password }
            });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            const loginData = response.data?.data?.login;
            if (!loginData) {
                throw new Error('Invalid response from server');
            }
            
            // Store authentication data
            appState.isAuthenticated = true;
            appState.user = loginData.user;
            appState.token = loginData.token;
            
            // Store in extension storage
            sendAuthRequest('AUTHENTICATE', loginData, (response) => {
                if (response.error) {
                    console.error('Error storing auth data:', response.error);
                } else {
                    showUserSection();
                    showToast('Welcome back!', 'success');
                }
            });
            
        } catch (error) {
            console.error('Login error:', error);
            // Check if it's an extension context error
            if (error.message && (error.message.includes('Extension was reloaded') || error.message.includes('Extension error'))) {
                showToast('Extension was reloaded. Please refresh the page.', 'error');
            } else {
                showToast(error.message || 'Login failed. Please try again.', 'error');
            }
        } finally {
            setButtonLoading(elements.loginBtn, false);
        }
    }
    
    // Handle send verification code
    async function handleSendVerificationCode() {
        const email = elements.signupEmail?.textContent;
        if (!email) return;
        
        setButtonLoading(elements.sendCodeBtn, true);
        
        try {
            const response = await makeApiRequest({
                query: `
                    mutation SendVerificationCode($email: String!) {
                        sendVerificationCode(email: $email)
                    }
                `,
                variables: { email }
            });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            const success = response.data?.data?.sendVerificationCode;
            if (!success) {
                throw new Error('Failed to send verification code');
            }
            
            // Show step 2
            elements.signupStep1?.classList.add('hidden');
            elements.signupStep2?.classList.remove('hidden');
            elements.verificationCode?.focus();
            
            showToast('Verification code sent to your email!', 'success');
            
        } catch (error) {
            console.error('Error sending verification code:', error);
            showToast(error.message || 'Failed to send verification code. Please try again.', 'error');
        } finally {
            setButtonLoading(elements.sendCodeBtn, false);
        }
    }
    
    // Handle signup form submission
    async function handleSignupSubmit(e) {
        e.preventDefault();
        
        const email = elements.verifyEmail?.textContent;
        const code = elements.verificationCode?.value;
        const name = elements.nameInput?.value.trim();
        const password = elements.newPasswordInput?.value;
        
        if (!email || !code || !name || !password) return;
        
        if (code.length !== 6) {
            showToast('Please enter a 6-digit verification code', 'error');
            return;
        }
        
        if (password.length < 8) {
            showToast('Password must be at least 8 characters long', 'error');
            return;
        }
        
        setButtonLoading(elements.completeSignupBtn, true);
        
        try {
            const response = await makeApiRequest({
                query: `
                    mutation SignUp($email: String!, $password: String!, $verificationCode: String!, $name: String!) {
                        signUp(email: $email, password: $password, verificationCode: $verificationCode, name: $name) {
                            token
                            user {
                                id
                                name
                                email
                                phoneNumber
                                bio
                                createdAt
                                updatedAt
                            }
                        }
                    }
                `,
                variables: { email, password, verificationCode: code, name }
            });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            const signupData = response.data?.data?.signUp;
            if (!signupData) {
                throw new Error('Invalid response from server');
            }
            
            // Store authentication data
            appState.isAuthenticated = true;
            appState.user = signupData.user;
            appState.token = signupData.token;
            
            // Store in extension storage
            sendAuthRequest('AUTHENTICATE', signupData, (response) => {
                if (response.error) {
                    console.error('Error storing auth data:', response.error);
                } else {
                    showUserSection();
                    showToast(`Welcome to VOTP, ${name}!`, 'success');
                }
            });
            
        } catch (error) {
            console.error('Signup error:', error);
            showToast(error.message || 'Signup failed. Please try again.', 'error');
        } finally {
            setButtonLoading(elements.completeSignupBtn, false);
        }
    }
    
    // Handle logout
    function handleLogout() {
        sendAuthRequest('LOGOUT', null, (response) => {
            if (response.error) {
                console.error('Error during logout:', response.error);
            }
            
            // Clear local state
            appState.isAuthenticated = false;
            appState.user = null;
            appState.token = null;
            appState.comments = [];
            
            showAuthSection();
            showToast('You have been signed out', 'info');
        });
    }
    
    // Update user display
    function updateUserDisplay() {
        if (!appState.user) return;
        
        const { name, email } = appState.user;
        
        if (elements.userName) {
            elements.userName.textContent = name;
        }
        
        if (elements.userEmail) {
            elements.userEmail.textContent = email;
        }
        
        if (elements.userAvatar) {
            elements.userAvatar.textContent = name.charAt(0).toUpperCase();
        }
    }
    
    // Handle comment form submission
    async function handleCommentSubmit(e) {
        e.preventDefault();
        
        const content = elements.commentInput?.value.trim();
        if (!content) return;
        
        if (content.length > 5000) {
            showToast('Comment is too long (max 5000 characters)', 'error');
            return;
        }
        
        setButtonLoading(elements.postCommentBtn, true);
        
        try {
            // Check if user is authenticated before making request
            if (!appState.isAuthenticated || !appState.token) {
                throw new Error('You must be logged in to post comments');
            }
            
            if (!appState.currentUrl) {
                throw new Error('Current page URL is not available');
            }
            
            console.log('Posting comment:', { content, url: appState.currentUrl, authenticated: appState.isAuthenticated });
            
            const response = await makeApiRequest({
                query: `
                    mutation CreateComment($content: String!, $url: String!) {
                        createComment(content: $content, url: $url) {
                            id
                            content
                            url
                            normalizedUrl
                            userId
                            parentId
                            createdAt
                            updatedAt
                        }
                    }
                `,
                variables: { 
                    content, 
                    url: appState.currentUrl 
                },
                requireAuth: true
            });
            
            console.log('API response:', response);
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            // Check for GraphQL errors
            if (response.data?.errors && response.data.errors.length > 0) {
                const errorMessage = response.data.errors[0].message || 'GraphQL error occurred';
                throw new Error(errorMessage);
            }
            
            const newComment = response.data?.data?.createComment;
            if (!newComment) {
                console.error('No comment returned from API:', response.data);
                throw new Error('Failed to create comment - no comment data returned');
            }
            
            // Clear form
            elements.commentInput.value = '';
            updateCharCount();
            
            // Refresh comments
            await loadComments();
            
            showToast('Comment posted successfully!', 'success');
            
        } catch (error) {
            console.error('Error posting comment:', error);
            console.error('App state during error:', {
                isAuthenticated: appState.isAuthenticated,
                hasToken: !!appState.token,
                hasUrl: !!appState.currentUrl,
                currentUrl: appState.currentUrl
            });
            
            // Check if it's an extension context error
            if (isExtensionContextError(error)) {
                showToast('Extension was reloaded. Please refresh the page.', 'error');
            } else if (error.message.includes('logged in')) {
                showToast('Please log in to post comments.', 'error');
                // Show auth section if not authenticated
                showAuthSection();
            } else if (error.message.includes('Authentication required')) {
                showToast('Your session has expired. Please log in again.', 'error');
                // Clear auth state and show login
                appState.isAuthenticated = false;
                appState.token = null;
                appState.user = null;
                showAuthSection();
            } else {
                showToast(error.message || 'Failed to post comment. Please try again.', 'error');
            }
        } finally {
            setButtonLoading(elements.postCommentBtn, false);
        }
    }
    
    // Update character count
    function updateCharCount() {
        if (!elements.commentInput || !elements.charCount) return;
        
        const count = elements.commentInput.value.length;
        elements.charCount.textContent = count;
        
        if (count > 5000) {
            elements.charCount.style.color = '#dc3545';
        } else if (count > 4500) {
            elements.charCount.style.color = '#ffc107';
        } else {
            elements.charCount.style.color = '#666';
        }
    }
    
    // Load comments for current page
    async function loadComments() {
        if (!appState.currentUrl || !appState.isAuthenticated) return;
        
        showCommentsLoading(true);
        
        try {
            const response = await makeApiRequest({
                query: `
                    query CommentsForUrl($url: String!) {
                        commentsForUrl(url: $url) {
                            id
                            content
                            url
                            normalizedUrl
                            userId
                            parentId
                            createdAt
                            updatedAt
                        }
                    }
                `,
                variables: { url: appState.currentUrl },
                requireAuth: true
            });
            
            if (response.error) {
                // Check if it's an extension context error
                if (response.error.includes('Extension was reloaded') || response.error.includes('Extension error')) {
                    showExtensionContextError();
                    return;
                }
                throw new Error(response.error);
            }
            
            const comments = response.data?.data?.commentsForUrl || [];
            appState.comments = comments;
            
            displayComments(comments);
            
        } catch (error) {
            console.error('Error loading comments:', error);
            // Check if it's an extension context error
            if (isExtensionContextError(error)) {
                showExtensionContextError();
            } else {
                showCommentsError('Failed to load comments');
            }
        } finally {
            showCommentsLoading(false);
        }
    }
    
    // Refresh comments
    function refreshComments() {
        loadComments();
    }
    
    // Display comments
    function displayComments(comments) {
        if (!elements.commentsList) return;
        
        // Clear loading/error states
        showCommentsLoading(false);
        hideCommentsError();
        
        if (comments.length === 0) {
            showCommentsEmpty(true);
            return;
        }
        
        showCommentsEmpty(false);
        
        // Build comments HTML
        const commentsHtml = comments.map(comment => createCommentHtml(comment)).join('');
        
        // Find the container for actual comments (not loading/empty/error states)
        let commentsContainer = elements.commentsList.querySelector('.comments-container');
        if (!commentsContainer) {
            commentsContainer = document.createElement('div');
            commentsContainer.className = 'comments-container';
            elements.commentsList.appendChild(commentsContainer);
        }
        
        commentsContainer.innerHTML = commentsHtml;
    }
    
    // Create HTML for a single comment
    function createCommentHtml(comment) {
        const date = new Date(comment.createdAt);
        const timeAgo = getTimeAgo(date);
        
        // For now, we'll use the user ID as the author name since we don't have user lookup
        // In a real implementation, you'd want to fetch user details
        const authorName = `User ${comment.userId.substring(0, 8)}`;
        const authorInitial = authorName.charAt(0);
        
        return `
            <div class="comment-item" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <div class="comment-avatar">${authorInitial}</div>
                    <div class="comment-meta">
                        <div class="comment-author">${authorName}</div>
                        <div class="comment-time">${timeAgo}</div>
                    </div>
                    <div class="comment-actions">
                        ${comment.userId === appState.user?.id ? `
                            <button class="comment-action-btn" onclick="editComment('${comment.id}')" title="Edit">
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L10.5 8.207l-3-3L12.146.146zM11.207 9.207L13 7.414a.5.5 0 0 0-.207-.914l-7-2A.5.5 0 0 0 5.5 5.5v7a.5.5 0 0 0 .793.207l2-7z"/>
                                </svg>
                            </button>
                            <button class="comment-action-btn" onclick="deleteComment('${comment.id}')" title="Delete">
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="comment-content">${escapeHtml(comment.content)}</div>
            </div>
        `;
    }
    
    // Show/hide comments loading state
    function showCommentsLoading(loading) {
        if (elements.commentsLoading) {
            elements.commentsLoading.classList.toggle('hidden', !loading);
        }
    }
    
    // Show/hide comments empty state
    function showCommentsEmpty(empty) {
        if (elements.commentsEmpty) {
            elements.commentsEmpty.classList.toggle('hidden', !empty);
        }
    }
    
    // Show comments error
    function showCommentsError(message) {
        if (elements.commentsError) {
            elements.commentsError.classList.remove('hidden');
            const errorText = elements.commentsError.querySelector('p');
            if (errorText) {
                errorText.innerHTML = `${message} <button class="retry-btn">Try again</button>`;
            }
        }
    }
    
    // Show extension context error with specific messaging
    function showExtensionContextError() {
        if (elements.commentsError) {
            elements.commentsError.classList.remove('hidden');
            const errorText = elements.commentsError.querySelector('p');
            if (errorText) {
                errorText.innerHTML = `
                    <strong>Extension Reloaded</strong><br>
                    Please refresh this page to use VOTP comments.
                    <br><br>
                    <button class="retry-btn" onclick="window.location.reload()">Refresh Page</button>
                `;
            }
        }
    }
    
    // Hide comments error
    function hideCommentsError() {
        if (elements.commentsError) {
            elements.commentsError.classList.add('hidden');
        }
    }
    
    // Make API request through background script
    async function makeApiRequest(requestData) {
        return new Promise((resolve) => {
            const requestId = Date.now().toString();
            
            // Store callback for response
            window[`apiCallback_${requestId}`] = resolve;
            
            sendMessageToParent({
                type: 'API_REQUEST',
                data: requestData,
                requestId: requestId
            });
        });
    }
    
    // Handle API response
    function handleApiResponse(data) {
        const callback = window[`apiCallback_${data.requestId}`];
        if (callback) {
            callback(data.data);
            delete window[`apiCallback_${data.requestId}`];
        }
    }
    
    // Check if error is due to extension context invalidation
    function isExtensionContextError(error) {
        const message = error.message || error.toString();
        return message.includes('Extension was reloaded') || 
               message.includes('Extension error') || 
               message.includes('Extension context invalidated');
    }

    // Utility functions
    function setButtonLoading(button, loading) {
        if (!button) return;
        
        const spinner = button.querySelector('.btn-spinner');
        const text = button.querySelector('.btn-text');
        
        if (loading) {
            button.disabled = true;
            spinner?.classList.remove('hidden');
            text?.classList.add('loading');
        } else {
            button.disabled = false;
            spinner?.classList.add('hidden');
            text?.classList.remove('loading');
        }
    }
    
    function resetForm(form) {
        if (!form) return;
        form.reset();
        
        // Reset any loading states
        const buttons = form.querySelectorAll('.btn');
        buttons.forEach(button => setButtonLoading(button, false));
    }
    
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        elements.toastContainer?.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);
    }
    
    function showErrorBanner(message) {
        if (elements.errorMessage && elements.errorBanner) {
            elements.errorMessage.textContent = message;
            elements.errorBanner.classList.remove('hidden');
        }
    }
    
    function hideErrorBanner() {
        if (elements.errorBanner) {
            elements.errorBanner.classList.add('hidden');
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }
    
    function handleStateUpdate(stateData) {
        // Handle state updates from parent
        console.log('State update received:', stateData);
    }
    
    function handlePageVisibilityChanged(visible) {
        // Handle page visibility changes
        if (visible && appState.isAuthenticated) {
            // Refresh comments when page becomes visible again
            refreshComments();
        }
    }
    
    // Global functions for comment actions (called from HTML)
    window.editComment = function(commentId) {
        // TODO: Implement edit functionality
        showToast('Edit functionality coming soon!', 'info');
    };
    
    window.deleteComment = async function(commentId) {
        if (!confirm('Are you sure you want to delete this comment?')) {
            return;
        }
        
        try {
            const response = await makeApiRequest({
                query: `
                    mutation DeleteComment($id: UUID!) {
                        deleteComment(id: $id)
                    }
                `,
                variables: { id: commentId },
                requireAuth: true
            });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            const success = response.data?.data?.deleteComment;
            if (!success) {
                throw new Error('Failed to delete comment');
            }
            
            // Refresh comments
            await loadComments();
            showToast('Comment deleted successfully', 'success');
            
        } catch (error) {
            console.error('Error deleting comment:', error);
            showToast(error.message || 'Failed to delete comment', 'error');
        }
    };
    
    // Initialize when DOM is ready
    initialize();
    
})();