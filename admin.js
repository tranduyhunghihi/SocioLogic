/**
 * SOCIO LOGIC ADMIN DASHBOARD - MAIN JAVASCRIPT
 * Handles Admin authentication, realtime MongoDB backend wish moderation, and instant card deletion.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // ADMIN CONFIGURATION & STATE
    // ==========================================================================
    const DEFAULT_ADMIN_PIN = "sociologic2026"; // Easy PIN for moderation team
    const AUTH_SESSION_KEY = "socio_logic_admin_authed_v1";
    const LOCAL_STORAGE_KEY = "socio_logic_wishes_v1";

    // Clear legacy localStorage cache
    try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {}

    let wishes = [];
    let isBackendOnline = false;

    // ==========================================================================
    // DOM ELEMENTS
    // ==========================================================================
    const loginOverlay = document.getElementById('login-overlay');
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminPinInput = document.getElementById('admin-pin-input');
    const loginError = document.getElementById('login-error');

    const adminDashboard = document.getElementById('admin-dashboard');
    const wishesAdminGrid = document.getElementById('wishes-admin-grid');
    const statTotalWishes = document.getElementById('stat-total-wishes');
    const searchInput = document.getElementById('search-input');

    const btnRefresh = document.getElementById('btn-refresh');
    const btnLogout = document.getElementById('btn-logout');

    // ==========================================================================
    // INITIALIZATION & AUTH CHECK
    // ==========================================================================
    function init() {
        setupEventListeners();
        checkAuthSession();
    }

    function checkAuthSession() {
        const isAuthed = sessionStorage.getItem(AUTH_SESSION_KEY) === "true";
        if (isAuthed) {
            showDashboard();
        } else {
            showLogin();
        }
    }

    function showLogin() {
        loginOverlay.classList.remove('hidden');
        adminDashboard.classList.add('hidden');
        adminPinInput.value = '';
        loginError.classList.add('hidden');
        setTimeout(() => adminPinInput.focus(), 100);
    }

    function showDashboard() {
        loginOverlay.classList.add('hidden');
        adminDashboard.classList.remove('hidden');
        initBackend();
    }

    function getApiUrl() {
        if (window.BACKEND_CONFIG && window.BACKEND_CONFIG.apiUrl) {
            return window.BACKEND_CONFIG.apiUrl.replace(/\/$/, '');
        }
        return 'http://localhost:5000';
    }

    // ==========================================================================
    // AUTHENTICATION LOGIC
    // ==========================================================================
    function setupEventListeners() {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const enteredPin = adminPinInput.value.trim();
            
            if (enteredPin === DEFAULT_ADMIN_PIN) {
                sessionStorage.setItem(AUTH_SESSION_KEY, "true");
                showDashboard();
            } else {
                loginError.classList.remove('hidden');
                adminPinInput.select();
            }
        });

        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                sessionStorage.removeItem(AUTH_SESSION_KEY);
                showLogin();
            });
        }

        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                if (isBackendOnline) {
                    btnRefresh.querySelector('i').classList.add('ph-spin');
                    fetchWishesFromMongoDB().then(() => {
                        setTimeout(() => btnRefresh.querySelector('i').classList.remove('ph-spin'), 400);
                    });
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                renderAdminGrid();
            });
        }
    }

    // ==========================================================================
    // MONGODB BACKEND API CALLS
    // ==========================================================================
    async function initBackend() {
        const apiUrl = getApiUrl();
        try {
            const res = await fetch(`${apiUrl}/api/health`);
            if (res.ok) {
                isBackendOnline = true;
                console.log('⚡ Admin connected to Node.js + MongoDB API!');
                await fetchWishesFromMongoDB();

                // Auto polling refresh in admin panel every 2 seconds
                setInterval(() => {
                    fetchWishesFromMongoDB(true);
                }, 2000);
                return;
            }
        } catch (e) {
            console.warn('Backend server notice in admin:', e);
        }

        wishes = [];
        updateStats();
        renderAdminGrid();
    }

    async function fetchWishesFromMongoDB(silent = false) {
        const apiUrl = getApiUrl();
        try {
            const response = await fetch(`${apiUrl}/api/wishes`);
            if (!response.ok) throw new Error('GET wishes failed');

            const data = await response.json();
            
            wishes = (data || []).map(item => ({
                id: String(item.id),
                author: String(item.author),
                imageData: String(item.imageData),
                x: Number(item.x),
                y: Number(item.y),
                rotation: Number(item.rotation),
                zIndex: Number(item.zIndex),
                timestamp: Number(item.timestamp)
            }));

            // Reverse order so newest wishes appear first in admin grid
            wishes.sort((a, b) => b.timestamp - a.timestamp);

            updateStats();
            renderAdminGrid();
        } catch (e) {
            console.error('MongoDB fetch error in admin:', e);
            if (!silent) {
                wishes = [];
                updateStats();
                renderAdminGrid();
            }
        }
    }

    function updateStats() {
        if (statTotalWishes) {
            statTotalWishes.textContent = wishes.length;
        }
    }

    // ==========================================================================
    // RENDER ADMIN WISHES GRID
    // ==========================================================================
    function renderAdminGrid() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        
        const filtered = wishes.filter(w => {
            if (!query) return true;
            return (w.author && w.author.toLowerCase().includes(query));
        });

        wishesAdminGrid.innerHTML = '';

        if (filtered.length === 0) {
            wishesAdminGrid.innerHTML = `
                <div class="admin-empty-state">
                    <i class="ph-bold ph-cards"></i>
                    <p>Không tìm thấy lời chúc nào ${query ? 'phù hợp với từ khóa search' : 'trong hệ thống MongoDB'}.</p>
                </div>
            `;
            return;
        }

        filtered.forEach(wish => {
            const cardEl = document.createElement('div');
            cardEl.className = 'admin-wish-card';
            
            const timeStr = wish.timestamp ? new Date(Number(wish.timestamp)).toLocaleString('vi-VN') : 'Mới đây';

            cardEl.innerHTML = `
                <div class="card-preview-area">
                    <img src="${wish.imageData}" alt="Thiệp chúc của ${escapeHtml(wish.author)}" loading="lazy">
                </div>
                <div class="card-meta-area">
                    <div class="author-info">
                        <i class="ph-bold ph-user-circle"></i>
                        <span>${escapeHtml(wish.author || 'Người chúc ẩn danh')}</span>
                    </div>
                    <div class="time-stamp">
                        <i class="ph-bold ph-clock"></i>
                        <span>${timeStr}</span>
                    </div>
                    <button class="btn-delete-wish" data-id="${wish.id}">
                        <i class="ph-bold ph-trash"></i>
                        <span>Xóa Lời Chúc Này</span>
                    </button>
                </div>
            `;

            wishesAdminGrid.appendChild(cardEl);

            // Bind Delete Button Action
            const btnDelete = cardEl.querySelector('.btn-delete-wish');
            btnDelete.addEventListener('click', () => {
                deleteWish(wish);
            });
        });
    }

    // ==========================================================================
    // DELETE WISH MODERATION ACTION
    // ==========================================================================
    async function deleteWish(wish) {
        const apiUrl = getApiUrl();
        const authorName = wish.author || 'Người chúc ẩn danh';
        const confirmMsg = `⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA LỜI CHÚC CỦA "${authorName}" KHÔNG?\n\nHành động này sẽ lập tức gỡ bỏ card này khỏi trang chủ của tất cả mọi người!`;

        if (confirm(confirmMsg)) {
            if (isBackendOnline) {
                try {
                    const response = await fetch(`${apiUrl}/api/wishes/${wish.id}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        console.error('Error deleting wish from MongoDB API:', response.status);
                    } else {
                        console.log(`Successfully deleted wish ID ${wish.id} from MongoDB!`);
                        await fetchWishesFromMongoDB(true);
                    }
                } catch (err) {
                    console.error('Error deleting wish from MongoDB API:', err);
                }
            }
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Run Initialization
    init();
});
