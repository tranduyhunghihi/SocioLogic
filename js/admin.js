/**
 * SOCIO LOGIC ADMIN DASHBOARD - MAIN JAVASCRIPT
 * Handles Admin authentication, realtime MongoDB wish moderation, and parent registrations management.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // ADMIN CONFIGURATION & STATE
    // ==========================================================================
    const AUTH_SESSION_KEY = "socio_logic_admin_authed_v1";

    let wishes = [];
    let parentRegistrations = [];
    let activeTab = 'wishes';
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
    const registrationsAdminContainer = document.getElementById('registrations-admin-container');
    
    const tabBtnWishes = document.getElementById('tab-btn-wishes');
    const tabBtnRegistrations = document.getElementById('tab-btn-registrations');
    const badgeTotalWishes = document.getElementById('badge-total-wishes');
    const badgeTotalRegistrations = document.getElementById('badge-total-registrations');
    const statTotalWishes = document.getElementById('stat-total-wishes');
    const statTotalRegistrations = document.getElementById('stat-total-registrations');
    
    const viewWishes = document.getElementById('view-wishes');
    const viewRegistrations = document.getElementById('view-registrations');
    
    const panelTitle = document.getElementById('panel-title');
    const panelDesc = document.getElementById('panel-desc');
    const searchInput = document.getElementById('search-input');
    const btnExportCSV = document.getElementById('btn-export-csv');

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
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.protocol.startsWith('http')) {
            return window.location.origin;
        }
        return (window.location.protocol === 'https:' ? 'https://' : 'http://') + window.location.hostname + ':5000';
    }

    // ==========================================================================
    // EVENT LISTENERS & TAB SWITCHING
    // ==========================================================================
    function setupEventListeners() {
        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const enteredPin = adminPinInput.value.trim();
            const apiUrl = getApiUrl();

            try {
                const response = await fetch(`${apiUrl}/api/admin/verify-pin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: enteredPin })
                });

                if (response.ok) {
                    sessionStorage.setItem(AUTH_SESSION_KEY, "true");
                    showDashboard();
                } else {
                    loginError.classList.remove('hidden');
                    adminPinInput.select();
                }
            } catch (err) {
                if (enteredPin === 'sociologic2026') {
                    sessionStorage.setItem(AUTH_SESSION_KEY, "true");
                    showDashboard();
                } else {
                    loginError.classList.remove('hidden');
                    adminPinInput.select();
                }
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
                    Promise.all([
                        fetchWishesFromMongoDB(true),
                        fetchRegistrationsFromMongoDB(true)
                    ]).then(() => {
                        setTimeout(() => btnRefresh.querySelector('i').classList.remove('ph-spin'), 400);
                    });
                }
            });
        }

        if (tabBtnWishes) {
            tabBtnWishes.addEventListener('click', () => switchTab('wishes'));
        }

        if (tabBtnRegistrations) {
            tabBtnRegistrations.addEventListener('click', () => switchTab('registrations'));
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                if (activeTab === 'wishes') {
                    renderAdminGrid();
                } else {
                    renderRegistrationsTable();
                }
            });
        }

        if (btnExportCSV) {
            btnExportCSV.addEventListener('click', exportRegistrationsToCSV);
        }
    }

    function switchTab(tab) {
        activeTab = tab;
        if (tab === 'wishes') {
            tabBtnWishes.classList.add('active');
            tabBtnRegistrations.classList.remove('active');
            viewWishes.classList.remove('hidden');
            viewRegistrations.classList.add('hidden');
            btnExportCSV.classList.add('hidden');

            if (panelTitle) panelTitle.textContent = "Kiểm Duyệt & Quản Lý Lời Chúc";
            if (panelDesc) panelDesc.textContent = "Theo dõi tất cả lời chúc của khách ghé thăm và xóa các nội dung vi phạm.";
            if (searchInput) searchInput.placeholder = "Tìm kiếm theo tên người chúc...";
        } else {
            tabBtnWishes.classList.remove('active');
            tabBtnRegistrations.classList.add('active');
            viewWishes.classList.add('hidden');
            viewRegistrations.classList.remove('hidden');
            btnExportCSV.classList.remove('hidden');

            if (panelTitle) panelTitle.textContent = "Danh Sách Phụ Huynh Đăng Ký Tiệc";
            if (panelDesc) panelDesc.textContent = "Quản lý thông tin đăng ký tham dự sinh nhật 2 tuổi của Ba Mẹ và các bé.";
            if (searchInput) searchInput.placeholder = "Tìm kiếm theo tên phụ huynh hoặc số điện thoại...";
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
                await Promise.all([
                    fetchWishesFromMongoDB(),
                    fetchRegistrationsFromMongoDB()
                ]);

                // Auto polling refresh every 3 seconds
                setInterval(() => {
                    fetchWishesFromMongoDB(true);
                    fetchRegistrationsFromMongoDB(true);
                }, 3000);
                return;
            }
        } catch (e) {
            console.warn('Backend server notice in admin:', e);
        }

        wishes = [];
        parentRegistrations = [];
        updateStats();
        renderAdminGrid();
        renderRegistrationsTable();
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

            wishes.sort((a, b) => b.timestamp - a.timestamp);

            updateStats();
            renderAdminGrid();
        } catch (e) {
            if (!silent) console.error('MongoDB fetch wishes error in admin:', e);
        }
    }

    async function fetchRegistrationsFromMongoDB(silent = false) {
        const apiUrl = getApiUrl();
        try {
            const response = await fetch(`${apiUrl}/api/parent-registrations`);
            if (!response.ok) throw new Error('GET parent-registrations failed');

            const data = await response.json();
            
            parentRegistrations = (data || []).map(item => ({
                id: String(item._id || item.id),
                parentName: String(item.parentName || ''),
                phone: String(item.phone || ''),
                timestamp: Number(item.timestamp || Date.now())
            }));

            parentRegistrations.sort((a, b) => b.timestamp - a.timestamp);

            updateStats();
            renderRegistrationsTable();
        } catch (e) {
            if (!silent) console.error('MongoDB fetch registrations error in admin:', e);
        }
    }

    function updateStats() {
        if (statTotalWishes) statTotalWishes.textContent = wishes.length;
        if (badgeTotalWishes) badgeTotalWishes.textContent = wishes.length;

        if (statTotalRegistrations) statTotalRegistrations.textContent = parentRegistrations.length;
        if (badgeTotalRegistrations) badgeTotalRegistrations.textContent = parentRegistrations.length;
    }

    // ==========================================================================
    // RENDER ADMIN WISHES GRID
    // ==========================================================================
    function renderAdminGrid() {
        if (!wishesAdminGrid) return;
        const query = searchInput && activeTab === 'wishes' ? searchInput.value.trim().toLowerCase() : '';
        
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
                        <span>${escapeHtml(wish.author || 'Người chúc ẩn danh')}</span>
                    </div>
                    <div class="time-stamp">
                        <i class="ph-bold ph-clock"></i>
                        <span>${timeStr}</span>
                    </div>
                    <button class="btn-delete-wish" data-id="${wish.id}">
                        <i class="ph-bold ph-trash"></i>
                        <span>Xóa LỜI CHÚC NÀY</span>
                    </button>
                </div>
            `;

            wishesAdminGrid.appendChild(cardEl);

            const btnDelete = cardEl.querySelector('.btn-delete-wish');
            btnDelete.addEventListener('click', () => deleteWish(wish));
        });
    }

    // ==========================================================================
    // RENDER PARENT REGISTRATIONS TABLE
    // ==========================================================================
    function renderRegistrationsTable() {
        if (!registrationsAdminContainer) return;
        const query = searchInput && activeTab === 'registrations' ? searchInput.value.trim().toLowerCase() : '';

        const filtered = parentRegistrations.filter(r => {
            if (!query) return true;
            return (r.parentName.toLowerCase().includes(query) || r.phone.toLowerCase().includes(query));
        });

        registrationsAdminContainer.innerHTML = '';

        if (filtered.length === 0) {
            registrationsAdminContainer.innerHTML = `
                <div class="admin-empty-state">
                    <i class="ph-bold ph-user-list"></i>
                    <p>Chưa có thông tin đăng ký phụ huynh nào ${query ? 'phù hợp với từ khóa tìm kiếm' : 'trên hệ thống'}.</p>
                </div>
            `;
            return;
        }

        let tableHtml = `
            <div class="registrations-table-wrapper">
                <table class="registrations-table">
                    <thead>
                        <tr>
                            <th style="width: 60px;">STT</th>
                            <th>Họ và Tên Phụ Huynh</th>
                            <th>Số Điện Thoại</th>
                            <th>Thời Gian Đăng Ký</th>
                            <th style="width: 130px; text-align: center;">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        filtered.forEach((reg, index) => {
            const timeStr = reg.timestamp ? new Date(Number(reg.timestamp)).toLocaleString('vi-VN') : '—';
            tableHtml += `
                <tr>
                    <td class="col-stt">${index + 1}</td>
                    <td class="col-name">
                        <div class="parent-name-meta">
                            <i class="ph-bold ph-user-circle"></i>
                            <span>${escapeHtml(reg.parentName)}</span>
                        </div>
                    </td>
                    <td class="col-phone">
                        <a href="tel:${escapeHtml(reg.phone)}" class="reg-phone-link">
                            <i class="ph-bold ph-phone-call"></i>
                            <span>${escapeHtml(reg.phone)}</span>
                        </a>
                    </td>
                    <td class="col-time">
                        <i class="ph-bold ph-clock"></i>
                        <span>${timeStr}</span>
                    </td>
                    <td class="col-actions">
                        <button class="btn-delete-reg" data-id="${reg.id}" title="Xóa đăng ký này">
                            <i class="ph-bold ph-trash"></i>
                            <span>Xóa</span>
                        </button>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;

        registrationsAdminContainer.innerHTML = tableHtml;

        // Bind delete action listeners
        const deleteBtns = registrationsAdminContainer.querySelectorAll('.btn-delete-reg');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const regId = btn.getAttribute('data-id');
                const reg = parentRegistrations.find(r => r.id === regId);
                if (reg) {
                    deleteRegistration(reg);
                }
            });
        });
    }

    // ==========================================================================
    // EXPORT REGISTRATIONS TO CSV / EXCEL
    // ==========================================================================
    function exportRegistrationsToCSV() {
        if (parentRegistrations.length === 0) {
            alert('Chưa có dữ liệu đăng ký phụ huynh để xuất file!');
            return;
        }

        let csvContent = "\uFEFF"; // UTF-8 BOM for Excel Vietnamese accents support
        csvContent += "STT,Họ và Tên Phụ Huynh,Số Điện Thoại,Thời Gian Đăng Ký\n";

        parentRegistrations.forEach((reg, i) => {
            const timeStr = reg.timestamp ? new Date(Number(reg.timestamp)).toLocaleString('vi-VN').replace(/,/g, '') : '';
            const nameEscaped = `"${reg.parentName.replace(/"/g, '""')}"`;
            const phoneEscaped = `"${reg.phone.replace(/"/g, '""')}"`;
            csvContent += `${i + 1},${nameEscaped},${phoneEscaped},"${timeStr}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `Danh_Sach_Phu_Huynh_Sociologic_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ==========================================================================
    // DELETE ACTIONS
    // ==========================================================================
    async function deleteWish(wish) {
        const apiUrl = getApiUrl();
        const authorName = wish.author || 'Người chúc ẩn danh';
        const confirmMsg = `⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA LỜI CHÚC CỦA "${authorName}" KHÔNG?\n\nHành động này sẽ lập tức gỡ bỏ card này khỏi trang chủ!`;

        if (confirm(confirmMsg)) {
            if (isBackendOnline) {
                try {
                    const response = await fetch(`${apiUrl}/api/wishes/${wish.id}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        console.log(`Successfully deleted wish ID ${wish.id} from MongoDB!`);
                        await fetchWishesFromMongoDB(true);
                    }
                } catch (err) {
                    console.error('Error deleting wish from MongoDB API:', err);
                }
            }
        }
    }

    async function deleteRegistration(reg) {
        const apiUrl = getApiUrl();
        const confirmMsg = `⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA ĐĂNG KÝ CỦA PHỤ HUYNH "${reg.parentName}" (${reg.phone}) KHÔNG?`;

        if (confirm(confirmMsg)) {
            if (isBackendOnline) {
                try {
                    const response = await fetch(`${apiUrl}/api/parent-registrations/${reg.id}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        console.log(`Successfully deleted parent registration ${reg.id}!`);
                        await fetchRegistrationsFromMongoDB(true);
                    }
                } catch (err) {
                    console.error('Error deleting parent registration from API:', err);
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
