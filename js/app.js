/**
 * GÓC LỜI CHÚC TƯƠNG TÁC - MAIN APPLICATION JAVASCRIPT
 * Full-featured interactive wish board connected to Node.js Express + MongoDB Backend.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // APP STATE & CONSTANTS
    // ==========================================================================
    const CACHE_STORAGE_KEY = 'socio_logic_wishes_cache_v2';
    const WISH_CARD_COLORS = ['#FFFFFF', '#FFF6C7', '#B5EAFF'];
    let currentEditorBgColor = '#FFFFFF';

    const CARD_THEME_CLASSES = ['card-theme-pink', 'card-theme-yellow', 'card-theme-white', 'card-theme-blue'];

    function getWishThemeClass(wish, index = 0) {
        if (!wish) return CARD_THEME_CLASSES[index % CARD_THEME_CLASSES.length];
        
        if (wish.themeClass && CARD_THEME_CLASSES.includes(wish.themeClass)) {
            return wish.themeClass;
        }
        
        if (wish.bgColor) {
            const bg = String(wish.bgColor).toUpperCase();
            if (bg === '#FDE8EF' || bg === '#FFD1DC' || bg === 'PINK') return 'card-theme-pink';
            if (bg === '#FEF9C3' || bg === '#FFF6C7' || bg === 'YELLOW') return 'card-theme-yellow';
            if (bg === '#E0F2FE' || bg === '#B5EAFF' || bg === 'BLUE') return 'card-theme-blue';
            if (bg === '#FFFFFF' || bg === 'WHITE') return 'card-theme-white';
        }
        
        // Deterministic hash based on wish.id (ensures exact same color everywhere)
        const seedStr = String(wish.id || index);
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = (hash * 31 + seedStr.charCodeAt(i)) & 0xFFFFFFFF;
        }
        const themeIdx = Math.abs(hash) % CARD_THEME_CLASSES.length;
        const themeClass = CARD_THEME_CLASSES[themeIdx];
        wish.themeClass = themeClass;
        return themeClass;
    }

    function getWishBgColor(wish, index = 0) {
        if (wish && wish.bgColor && WISH_CARD_COLORS.some(c => c.toUpperCase() === String(wish.bgColor).toUpperCase())) {
            return wish.bgColor;
        }
        const seed = wish ? (String(wish.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + index) : index;
        const color = WISH_CARD_COLORS[seed % WISH_CARD_COLORS.length];
        if (wish) wish.bgColor = color;
        return color;
    }
    
    let wishes = [];
    let pendingWishesMap = new Map(); // Protection against polling race conditions
    let isPostingWish = false;

    let activeTool = 'pen'; // 'pen', 'text', 'image', 'eraser'
    let activeColor = '#0260ED'; // Default Blue color
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let maxZIndex = 100;

    let isBackendOnline = false;

    // Track active dragged element in editor
    let activeDraggedElement = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    // Board Card Dragging State
    let draggedCard = null;
    let cardDragStartX = 0;
    let cardDragStartY = 0;
    let initialCardLeft = 0;
    let initialCardTop = 0;
    let cardDragDistance = 0;

    // ==========================================================================
    // DOM ELEMENTS
    // ==========================================================================
    const btnOpenEditor = document.getElementById('btn-open-editor');
    const btnCloseEditor = document.getElementById('btn-close-editor');
    const btnCancelEditor = document.getElementById('btn-cancel-editor');
    const btnPostWish = document.getElementById('btn-post-wish');
    const editorOverlay = document.getElementById('editor-overlay');
    const editorNameInput = document.getElementById('editor-name');
    
    const editorCanvasContainer = document.getElementById('editor-canvas-container');
    const drawingCanvas = document.getElementById('drawing-canvas');
    const eraserCursorRing = document.getElementById('eraser-cursor-ring');
    const elementsLayer = document.getElementById('editor-elements-layer');
    const ctx = drawingCanvas.getContext('2d');

    const toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
    const btnAddImage = document.getElementById('btn-add-image');
    const colorSwatches = document.querySelectorAll('.color-swatch');

    const wishBoard = document.getElementById('wish-board');
    const wishCountEl = document.getElementById('wish-count');
    const btnOpenGrid = document.getElementById('btn-open-grid');

    const readerOverlay = document.getElementById('reader-overlay');
    const btnCloseReader = document.getElementById('btn-close-reader');
    const readerCardContent = document.getElementById('reader-card-content');

    const gridOverlay = document.getElementById('grid-overlay');
    const btnCloseGrid = document.getElementById('btn-close-grid');
    const gridModalCardsContainer = document.getElementById('grid-modal-cards');

    // ==========================================================================
    // INITIALIZATION & INSTANT PRE-RENDER
    // ==========================================================================
    function init() {
        resizeCanvas();
        setupEventListeners();
        setupScrollRevealObserver();

        // 1. INSTANT 0MS PRE-RENDER: Load from local cache or starter samples immediately!
        loadInitialWishesInstantly();

        // 2. PARALLEL ASYNC BACKEND SYNC: Connect to MongoDB in background without blocking UI
        initBackendDatabase();
    }

    function setupScrollRevealObserver() {
        const yellowTargets = document.querySelectorAll('.yellow-highlight-target, .title-yellow-box, .sec6-yellow-box, .sec7-yellow-box, .highlight-script, .highlight-script-yellow');
        if (yellowTargets.length === 0) return;

        // Pre-process each target: split inner text into individual word spans
        yellowTargets.forEach(target => {
            const childScript = target.querySelector('.script-slide-inner, .script-reveal-text, .sec6-script-text, .sec7-script-text') || target;
            if (childScript && !childScript.dataset.wordsPrepared) {
                const textContent = childScript.textContent.trim();
                if (textContent.length > 0) {
                    const words = textContent.split(/\s+/).filter(w => w.length > 0);
                    childScript.innerHTML = '';
                    words.forEach((word, idx) => {
                        const span = document.createElement('span');
                        span.className = 'scroll-word-span';
                        span.textContent = word;
                        span.style.cssText = 'display: inline-block; white-space: nowrap; position: relative; will-change: clip-path, opacity; vertical-align: baseline; opacity: 0; clip-path: inset(-60px 100% -60px -30px); transform: none !important; transition: none !important; font-family: inherit !important; font-size: inherit !important; font-weight: inherit !important; font-style: inherit !important; color: inherit !important; overflow: visible !important; line-height: 1.4 !important;';
                        childScript.appendChild(span);
                        if (idx < words.length - 1) {
                            childScript.appendChild(document.createTextNode(' '));
                        }
                    });
                    childScript.dataset.wordsPrepared = 'true';
                }
            }
        });

        let ticking = false;

        const updateScrollProgress = () => {
            const windowHeight = window.innerHeight;
            const centerPoint = windowHeight * 0.5; // Top of element at 50% screen height = 100% revealed

            // Animate surrounding header text elements (dramatic 50px float up + fade in from bottom to upper center across all sections)
            const headers = document.querySelectorAll('.scroll-reveal-header, .sec6-header, .sec7-header, .header-title-container, .journey-header-container, .hero-center-titles');
            headers.forEach(header => {
                const rect = header.getBoundingClientRect();
                const isCompletelyOut = rect.bottom < 0 || rect.top > windowHeight;
                
                const surroundingElements = header.querySelectorAll('.title-main-text, .header-subtitle, .sec6-title-main, .sec7-title-main, .sec6-subtitle, .sec7-subtitle, .journey-title, .title-line-main, .journey-subtitle-text, .hero-main-title, .hero-title');
                const targetElements = surroundingElements.length > 0 ? surroundingElements : [header];

                if (isCompletelyOut) {
                    header.classList.remove('is-visible', 'is-center-visible');
                    targetElements.forEach(el => {
                        el.style.opacity = '0';
                        el.style.transform = 'translateY(50px)';
                    });
                } else {
                    header.classList.add('is-visible', 'is-center-visible');
                    
                    // Animation starts when header enters into viewport (85% height) and finishes at 35% height (upper center)
                    const startPoint = windowHeight * 0.85;
                    const endPoint = windowHeight * 0.35;
                    const totalDistance = startPoint - endPoint;
                    const scrolledDistance = startPoint - rect.top;
                    let hProgress = Math.min(Math.max(scrolledDistance / totalDistance, 0), 1);

                    targetElements.forEach((el, idx) => {
                        let isSubtitle = el.classList.contains('header-subtitle') || el.classList.contains('sec6-subtitle') || el.classList.contains('sec7-subtitle') || el.classList.contains('journey-subtitle-text');
                        let delayOffset = isSubtitle ? 0.18 : (idx * 0.08);
                        let progress = Math.min(Math.max((hProgress - delayOffset) / (1 - delayOffset), 0), 1);

                        if (progress === 1) {
                            el.style.opacity = '1';
                            el.style.transform = 'translateY(0)';
                        } else if (progress === 0) {
                            el.style.opacity = '0';
                            el.style.transform = 'translateY(50px)';
                        } else {
                            const opacity = progress.toFixed(2);
                            const translateY = ((1 - progress) * 50).toFixed(1);
                            el.style.opacity = opacity;
                            el.style.transform = `translateY(${translateY}px)`;
                        }
                    });
                }
            });

            yellowTargets.forEach(target => {
                const rect = target.getBoundingClientRect();
                const childScript = target.querySelector('.script-slide-inner, .script-reveal-text, .sec6-script-text, .sec7-script-text') || target;
                const parentHeader = target.closest('.scroll-reveal-header, .sec6-header, .sec7-header, .header-title-container');
                const wordSpans = childScript ? childScript.querySelectorAll('.scroll-word-span') : [];

                const isCompletelyOut = rect.bottom < 0 || rect.top > windowHeight;

                if (isCompletelyOut) {
                    target.classList.remove('is-center-visible', 'is-visible');
                    if (childScript) {
                        childScript.classList.remove('is-center-visible', 'is-visible');
                    }
                    if (wordSpans.length > 0) {
                        wordSpans.forEach(span => {
                            span.style.opacity = '0';
                            span.style.clipPath = 'inset(-60px 100% -60px -30px)';
                            span.style.transform = 'none';
                        });
                    }
                    return;
                }

                if (parentHeader) {
                    parentHeader.classList.add('is-visible', 'is-center-visible');
                }
                target.classList.add('is-visible', 'is-center-visible');
                if (childScript) {
                    childScript.classList.add('is-visible', 'is-center-visible');
                }

                // Progress: 0 at windowHeight (bottom), 1 at centerPoint (50% screen height)
                const startPoint = windowHeight;
                const totalDistance = startPoint - centerPoint;
                const scrolledDistance = startPoint - rect.top;

                let rawProgress = scrolledDistance / totalDistance;
                let progress = Math.min(Math.max(rawProgress, 0), 1);

                if (wordSpans.length > 0) {
                    const N = wordSpans.length;
                    wordSpans.forEach((span, idx) => {
                        const wordStart = idx / N;
                        const wordEnd = (idx + 1) / N;
                        let wP = (progress - wordStart) / (wordEnd - wordStart);
                        wP = Math.min(Math.max(wP, 0), 1);

                        span.style.transform = 'none';

                        if (wP === 1) {
                            span.style.opacity = '1';
                            span.style.clipPath = 'inset(-60px -30px -60px -30px)';
                        } else if (wP === 0) {
                            span.style.opacity = '0';
                            span.style.clipPath = 'inset(-60px 100% -60px -30px)';
                        } else {
                            const clipRight = ((1 - wP) * 100).toFixed(1);
                            span.style.opacity = wP.toFixed(2);
                            span.style.clipPath = `inset(-60px ${clipRight}% -60px -30px)`;
                        }
                    });
                }
            });

            ticking = false;
        };

        const requestTick = () => {
            if (!ticking) {
                requestAnimationFrame(updateScrollProgress);
                ticking = true;
            }
        };

        window.addEventListener('scroll', requestTick, { passive: true });
        window.addEventListener('resize', requestTick, { passive: true });

        // Initial calculation on page load
        updateScrollProgress();
    }

    function createSampleWishCanvasData(text, textColor, authorName) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 480;
        tempCanvas.height = 360;
        const tCtx = tempCanvas.getContext('2d');

        tCtx.fillStyle = '#FFFFFF';
        tCtx.fillRect(0, 0, 480, 360);

        // Grid lines pattern
        tCtx.strokeStyle = 'rgba(226, 232, 240, 0.6)';
        tCtx.lineWidth = 1;
        for (let x = 0; x < 480; x += 30) {
            tCtx.beginPath();
            tCtx.moveTo(x, 0);
            tCtx.lineTo(x, 360);
            tCtx.stroke();
        }
        for (let y = 0; y < 360; y += 30) {
            tCtx.beginPath();
            tCtx.moveTo(0, y);
            tCtx.lineTo(480, y);
            tCtx.stroke();
        }

        // Title / Wish Text
        tCtx.fillStyle = textColor;
        tCtx.font = 'bold 30px "Patrick Hand", "Plus Jakarta Sans", sans-serif';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';

        const words = text.split(' ');
        let line = '';
        let lines = [];
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = tCtx.measureText(testLine);
            if (metrics.width > 400 && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        const startY = 180 - ((lines.length - 1) * 22);
        lines.forEach((l, i) => {
            tCtx.fillText(l.trim(), 240, startY + (i * 42));
        });

        return tempCanvas.toDataURL('image/png');
    }

    function loadInitialWishesInstantly() {
        try {
            const cachedData = localStorage.getItem(CACHE_STORAGE_KEY);
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    wishes = parsed;
                    updateWishCount();
                    renderWishesView();
                    return;
                }
            }
        } catch (e) {
            console.warn('Cache read warning:', e);
        }

        // Fallback: Instant 4 starter wishes for first-time visitors matching reference design
        wishes = [
            {
                id: 'wish-starter-1',
                author: 'Cô Hoanh',
                imageData: createSampleWishCanvasData('Chúc mừng SocioLogic 2 Năm Kiến Tạo & Rực Rỡ! 🌟✨', '#0052FF', 'Cô Hoanh'),
                timestamp: Date.now() - 100000
            },
            {
                id: 'wish-starter-2',
                author: 'Người Bạn Bí Ẩn',
                text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
                imageData: createSampleWishCanvasData('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.', '#0052FF', 'Người Bạn Bí Ẩn'),
                timestamp: Date.now() - 50000
            },
            {
                id: 'wish-starter-3',
                author: 'Cô Hoanh',
                imageData: createSampleWishCanvasData('Học sinh tự tin tranh biện và tỏa sáng! 🚀❤️', '#0052FF', 'Cô Hoanh'),
                timestamp: Date.now() - 30000
            },
            {
                id: 'wish-starter-4',
                author: 'Rosy',
                imageData: createSampleWishCanvasData('Yêu SocioLogic nhiều! ❤️😊', '#EC4899', 'Rosy'),
                timestamp: Date.now() - 10000
            }
        ];

        updateWishCount();
        renderWishesView();
    }

    function saveWishesToCache() {
        try {
            if (wishes && wishes.length > 0) {
                localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(wishes));
            }
        } catch (e) {}
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

    async function initBackendDatabase() {
        // Parallel non-blocking fetch from backend
        fetchWishesFromMongoDB();

        // Polling for realtime updates across clients every 4 seconds
        setInterval(() => {
            fetchWishesFromMongoDB(true);
        }, 4000);
    }

    async function fetchWishesFromMongoDB(silent = false) {
        // Skip background polling update if tab is hidden, user is posting a wish, or actively dragging a card
        if (silent && (document.hidden || isPostingWish || draggedCard !== null)) return;

        const apiUrl = getApiUrl();
        try {
            const response = await fetch(`${apiUrl}/api/wishes`);
            if (!response.ok) throw new Error('GET wishes failed');

            const data = await response.json();

            if (Array.isArray(data)) {
                isBackendOnline = true;
                const incomingWishes = data.map(item => ({
                    id: String(item.id),
                    author: String(item.author),
                    imageData: String(item.imageData),
                    x: Number(item.x),
                    y: Number(item.y),
                    rotation: Number(item.rotation),
                    zIndex: Number(item.zIndex),
                    timestamp: Number(item.timestamp)
                }));

                // Clear items from pending map if present in incoming data from server
                incomingWishes.forEach(item => {
                    pendingWishesMap.delete(item.id);
                });

                // Merge any local pending wishes that haven't been written to DB yet
                const combinedWishes = [...incomingWishes];
                pendingWishesMap.forEach((pendingWish) => {
                    if (!combinedWishes.some(w => w.id === pendingWish.id)) {
                        combinedWishes.push(pendingWish);
                    }
                });

                if (silent) {
                    // SILENT POLLING PROTECTION:
                    // Preserve existing cards' local (x, y, zIndex) positions on screen so dragging/digging is NEVER reverted!
                    const currentWishesMap = new Map(wishes.map(w => [w.id, w]));
                    
                    let hasNewOrDeleted = false;
                    
                    // Check if any card was deleted or if any new card arrived
                    const incomingIds = new Set(combinedWishes.map(w => w.id));
                    for (let w of wishes) {
                        if (!incomingIds.has(w.id)) {
                            hasNewOrDeleted = true; // Card deleted by admin
                            break;
                        }
                    }
                    if (!hasNewOrDeleted) {
                        for (let w of combinedWishes) {
                            if (!currentWishesMap.has(w.id)) {
                                hasNewOrDeleted = true; // New card arrived
                                break;
                            }
                        }
                    }

                    // If no new cards arrived and no cards were deleted, DO NOTHING! Keep local board 100% untouched!
                    if (!hasNewOrDeleted) return;

                    // If new cards arrived or cards were deleted, preserve local coordinates for existing cards
                    combinedWishes.forEach((inc) => {
                        const localCard = currentWishesMap.get(inc.id);
                        if (localCard) {
                            inc.x = localCard.x;
                            inc.y = localCard.y;
                            inc.zIndex = Math.max(inc.zIndex || 1, localCard.zIndex || 1);
                            inc.isUserPositioned = localCard.isUserPositioned;
                        }
                    });
                }

                if (combinedWishes.length > 0) {
                    wishes = combinedWishes;
                    saveWishesToCache();
                    updateWishCount();
                    renderWishesView();
                }
            }
        } catch (err) {
            console.warn('MongoDB fetch notice (using instant pre-rendered cards):', err);
        }
    }



    async function saveWishes(newWish = null) {
        const apiUrl = getApiUrl();
        if (newWish) {
            saveWishesToCache();
            try {
                const response = await fetch(`${apiUrl}/api/wishes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newWish)
                });

                if (!response.ok) {
                    console.error('MongoDB POST failed:', response.status);
                } else {
                    console.log('✅ Wish saved to MongoDB Backend!');
                    // Trigger a silent sync after POST completion
                    setTimeout(() => fetchWishesFromMongoDB(true), 500);
                }
            } catch (err) {
                console.error('MongoDB POST exception:', err);
            }
        }
    }

    async function saveCardPosition(wishData) {
        saveWishesToCache();
        const apiUrl = getApiUrl();
        try {
            await fetch(`${apiUrl}/api/wishes/${wishData.id}/position`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    x: wishData.x,
                    y: wishData.y,
                    zIndex: wishData.zIndex
                })
            });
        } catch (e) {
            console.warn('Error saving position:', e);
        }
    }

    function updateWishCount() {
        if (wishCountEl) {
            wishCountEl.textContent = `${wishes.length} lời chúc`;
        }
    }

    // Helper: Find highest z-index across all cards in memory and on screen (excluding active dragging card)
    function getHighestCardZIndex() {
        let highest = 10;
        if (wishes && wishes.length > 0) {
            wishes.forEach(w => {
                const z = Number(w.zIndex) || 0;
                if (z > highest && z < 900000) highest = z;
            });
        }
        const allCards = wishBoard ? wishBoard.querySelectorAll('.wish-card:not(.dragging)') : [];
        allCards.forEach(c => {
            const z = parseInt(c.style.zIndex) || 0;
            if (z > highest && z < 900000) {
                highest = z;
            }
        });
        if (maxZIndex > highest && maxZIndex < 900000) {
            highest = maxZIndex;
        }
        return highest;
    }

    // ==========================================================================
    // CANVAS & EDITOR RESIZE & RENDERING
    // ==========================================================================
    function resizeCanvas() {
        const rect = editorCanvasContainer.getBoundingClientRect();
        const width = Math.round(rect.width) || 480;
        const height = Math.round(rect.height) || 360;

        if (drawingCanvas.width !== width || drawingCanvas.height !== height) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = drawingCanvas.width || width;
            tempCanvas.height = drawingCanvas.height || height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(drawingCanvas, 0, 0);

            drawingCanvas.width = width;
            drawingCanvas.height = height;

            ctx.drawImage(tempCanvas, 0, 0);
            updateCtxStyle();
        }
    }

    function updateCtxStyle() {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (activeTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = 4;
        } else if (activeTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 28;
        }
    }

    // ==========================================================================
    // EVENT LISTENERS & SETUP
    // ==========================================================================
    function setupEventListeners() {
        window.addEventListener('resize', () => {
            resizeCanvas();
        });

        // Tab visibility change auto-sync when returning to active tab
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && isBackendOnline) {
                fetchWishesFromMongoDB(true);
            }
        });

        // Touch Swipe Navigation for 2x2 Grid Carousel
        if (wishBoard) {
            let touchStartX = 0;
            wishBoard.addEventListener('touchstart', (e) => {
                if (e.touches && e.touches.length === 1) {
                    touchStartX = e.touches[0].clientX;
                }
            }, { passive: true });

            wishBoard.addEventListener('touchend', (e) => {
                if (e.changedTouches && e.changedTouches.length === 1) {
                    const touchEndX = e.changedTouches[0].clientX;
                    const diffX = touchEndX - touchStartX;
                    const totalPages = Math.max(1, Math.ceil(wishes.length / CARDS_PER_PAGE));

                    if (Math.abs(diffX) > 40) {
                        if (diffX < 0 && currentWishPage < totalPages - 1) {
                            currentWishPage++;
                            renderWishesView();
                        } else if (diffX > 0 && currentWishPage > 0) {
                            currentWishPage--;
                            renderWishesView();
                        }
                    }
                }
            }, { passive: true });
        }

        // Open/Close Editor
        if (btnOpenEditor) {
            btnOpenEditor.addEventListener('click', openEditor);
        }
        if (btnCloseEditor) {
            btnCloseEditor.addEventListener('click', closeEditor);
        }
        if (btnCancelEditor) {
            btnCancelEditor.addEventListener('click', closeEditor);
        }
        if (btnPostWish) {
            btnPostWish.addEventListener('click', postWish);
        }

        // Close Reader
        if (btnCloseReader) {
            btnCloseReader.addEventListener('click', closeReader);
        }
        if (readerOverlay) {
            readerOverlay.addEventListener('click', (e) => {
                if (!e.target.closest('.reader-modal-card') && !e.target.closest('#reader-card-content')) closeReader();
            });
        }

        // Open/Close Grid Modal
        if (btnOpenGrid) {
            btnOpenGrid.addEventListener('click', (e) => {
                openGridModal(e);
            });
        }
        if (btnCloseGrid) {
            btnCloseGrid.addEventListener('click', closeGridModal);
        }
        if (gridOverlay) {
            gridOverlay.addEventListener('click', (e) => {
                if (!e.target.closest('.grid-modal-container')) closeGridModal();
            });
        }

        // Tools switching
        toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTool = btn.dataset.tool;

                if (activeTool === 'text') {
                    addTextElement();
                    activeTool = 'pen';
                    toolBtns.forEach(b => b.classList.remove('active'));
                    document.querySelector('.tool-btn[data-tool="pen"]').classList.add('active');
                }

                updateCtxStyle();
                toggleEraserCursor();
            });
        });

        // Color swatches
        colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                colorSwatches.forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                activeColor = swatch.dataset.color;
                updateCtxStyle();
            });
        });

        // Add Image
        if (btnAddImage) {
            btnAddImage.addEventListener('change', handleImageUpload);
        }

        // Canvas Drawing Events
        drawingCanvas.addEventListener('mousedown', startDrawing);
        drawingCanvas.addEventListener('mousemove', draw);
        drawingCanvas.addEventListener('mouseup', stopDrawing);
        drawingCanvas.addEventListener('mouseleave', stopDrawing);

        drawingCanvas.addEventListener('touchstart', startDrawingTouch, { passive: false });
        drawingCanvas.addEventListener('touchmove', drawTouch, { passive: false });
        drawingCanvas.addEventListener('touchend', stopDrawing);

        // Eraser ring motion
        editorCanvasContainer.addEventListener('mousemove', updateEraserCursor);
        editorCanvasContainer.addEventListener('mouseleave', () => {
            eraserCursorRing.classList.add('hidden');
        });
    }

    // Helper: Lock / Unlock body scroll when modals pop up
    function updateModalBodyScrollLock() {
        const isAnyModalOpen = (gridOverlay && !gridOverlay.classList.contains('hidden')) ||
                               (readerOverlay && !readerOverlay.classList.contains('hidden')) ||
                               (editorOverlay && !editorOverlay.classList.contains('hidden'));
        if (isAnyModalOpen) {
            document.body.classList.add('modal-open');
            document.documentElement.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
            document.documentElement.classList.remove('modal-open');
        }
    }

    // Helper: Setup wheel / touchmove containment on modal overlays to prevent background scrolling
    function setupOverlayScrollContainment() {
        [gridOverlay, readerOverlay, editorOverlay].forEach(overlay => {
            if (!overlay) return;
            overlay.addEventListener('wheel', (e) => {
                const scrollable = e.target.closest('.grid-modal-scroll, .card-text-content, .editor-card-container');
                if (!scrollable) {
                    e.preventDefault();
                } else {
                    const { scrollTop, scrollHeight, clientHeight } = scrollable;
                    const delta = e.deltaY;
                    if ((delta < 0 && scrollTop <= 0) || (delta > 0 && scrollTop + clientHeight >= scrollHeight - 1)) {
                        e.preventDefault();
                    }
                }
            }, { passive: false });

            overlay.addEventListener('touchmove', (e) => {
                const scrollable = e.target.closest('.grid-modal-scroll, .card-text-content, .editor-card-container');
                if (!scrollable) {
                    e.preventDefault();
                }
            }, { passive: false });
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (readerOverlay && !readerOverlay.classList.contains('hidden')) {
                    closeReader();
                } else if (gridOverlay && !gridOverlay.classList.contains('hidden')) {
                    closeGridModal();
                } else if (editorOverlay && !editorOverlay.classList.contains('hidden')) {
                    closeEditor();
                }
            }
        });
    }

    // ==========================================================================
    // EDITOR MODAL LOGIC
    // ==========================================================================
    function openEditor() {
        currentEditorBgColor = WISH_CARD_COLORS[Math.floor(Math.random() * WISH_CARD_COLORS.length)];
        const editorCard = document.querySelector('.editor-card');
        if (editorCard) {
            editorCard.style.backgroundColor = currentEditorBgColor;
        }
        editorOverlay.classList.remove('hidden');
        updateModalBodyScrollLock();
        resetEditor();
        setTimeout(resizeCanvas, 50);
    }

    function closeEditor() {
        editorOverlay.classList.add('hidden');
        updateModalBodyScrollLock();
    }

    function resetEditor() {
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        elementsLayer.innerHTML = '';
        editorNameInput.value = '';
        activeTool = 'pen';
        toolBtns.forEach(b => b.classList.remove('active'));
        document.querySelector('.tool-btn[data-tool="pen"]').classList.add('active');
        updateCtxStyle();
        if (editorCanvasContainer) {
            editorCanvasContainer.style.backgroundColor = '#FFFFFF';
        }
        editorCanvasContainer.classList.remove('eraser-mode');
        drawingCanvas.classList.remove('eraser-mode');
        eraserCursorRing.classList.add('hidden');
    }

    function closeReader() {
        readerOverlay.classList.add('hidden');
        updateModalBodyScrollLock();
    }

    function openGridModal() {
        renderGridModalCards();
        if (gridOverlay) gridOverlay.classList.remove('hidden');
        updateModalBodyScrollLock();
    }

    function closeGridModal() {
        if (gridOverlay) gridOverlay.classList.add('hidden');
        updateModalBodyScrollLock();
    }

    function renderGridModalCards() {
        if (!gridModalCardsContainer) return;

        if (!wishes || wishes.length === 0) {
            gridModalCardsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #64748B;">
                    <i class="ph-bold ph-envelope-open" style="font-size: 48px; color: #94A3B8; display: block; margin-bottom: 12px;"></i>
                    <p style="font-size: 16px;">Chưa có lời chúc nào trên bảng.</p>
                </div>
            `;
            return;
        }

        gridModalCardsContainer.innerHTML = wishes.map((wish, index) => {
            const themeClass = getWishThemeClass(wish, index);
            const author = escapeHtml(wish.author || 'Người chúc ẩn danh');
            const hasText = wish.text && wish.text.length > 0;
            return `
                <div class="grid-wish-card ${themeClass}" data-id="${wish.id}">
                    <div class="grid-card-pin"></div>
                    <div class="grid-card-author">Từ ${author}</div>
                    <div class="grid-card-body">
                        ${hasText && !wish.imageData ?
                            `<div class="card-text-content">${escapeHtml(wish.text)}</div>` :
                            `<img class="grid-card-img" src="${wish.imageData}" alt="Lời chúc của ${author}" draggable="false">`
                        }
                    </div>
                </div>
            `;
        }).join('');

        // Attach click listener to each grid card to open detail reader modal
        const gridCards = gridModalCardsContainer.querySelectorAll('.grid-wish-card');
        gridCards.forEach(card => {
            card.addEventListener('click', () => {
                const wishId = card.dataset.id;
                openReaderModalByWishId(wishId);
            });
        });
    }

    function toggleEraserCursor() {
        if (activeTool === 'eraser') {
            editorCanvasContainer.classList.add('eraser-mode');
            drawingCanvas.classList.add('eraser-mode');
        } else {
            editorCanvasContainer.classList.remove('eraser-mode');
            drawingCanvas.classList.remove('eraser-mode');
            eraserCursorRing.classList.add('hidden');
        }
    }

    function updateEraserCursor(e) {
        if (activeTool !== 'eraser') {
            eraserCursorRing.classList.add('hidden');
            return;
        }
        const coords = getCanvasCoords(e);
        const rect = drawingCanvas.getBoundingClientRect();
        
        // Display position relative to container CSS pixels
        const displayX = (coords.x * rect.width) / drawingCanvas.width;
        const displayY = (coords.y * rect.height) / drawingCanvas.height;

        eraserCursorRing.style.left = `${displayX}px`;
        eraserCursorRing.style.top = `${displayY}px`;
        eraserCursorRing.classList.remove('hidden');
    }

    // ==========================================================================
    // DRAWING LOGIC (PRECISION SCALE-RATIO ALIGNED)
    // ==========================================================================
    function getCanvasCoords(e) {
        const rect = drawingCanvas.getBoundingClientRect();
        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        const scaleX = drawingCanvas.width / (rect.width || 1);
        const scaleY = drawingCanvas.height / (rect.height || 1);

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function startDrawing(e) {
        if (activeTool !== 'pen' && activeTool !== 'eraser') return;
        isDrawing = true;
        const coords = getCanvasCoords(e);
        lastX = coords.x;
        lastY = coords.y;
    }

    function draw(e) {
        if (!isDrawing) return;
        const coords = getCanvasCoords(e);
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        lastX = coords.x;
        lastY = coords.y;
    }

    function startDrawingTouch(e) {
        if (e.touches.length === 1 && (activeTool === 'pen' || activeTool === 'eraser')) {
            e.preventDefault();
            isDrawing = true;
            const coords = getCanvasCoords(e);
            lastX = coords.x;
            lastY = coords.y;
        }
    }

    function drawTouch(e) {
        if (!isDrawing || e.touches.length !== 1) return;
        e.preventDefault();
        const coords = getCanvasCoords(e);

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        lastX = coords.x;
        lastY = coords.y;
    }

    function stopDrawing() {
        isDrawing = false;
    }

    // ==========================================================================
    // INTERACTIVE ELEMENTS (TEXT & IMAGES LAYER)
    // ==========================================================================
    function addTextElement(initialText = '') {
        const textWrapper = document.createElement('div');
        textWrapper.className = 'card-element text-element';
        textWrapper.style.left = '24px';
        textWrapper.style.top = '20px';
        textWrapper.style.maxWidth = 'calc(100% - 40px)';
        textWrapper.style.boxSizing = 'border-box';

        const truncatedInitial = initialText ? initialText.substring(0, 50) : '';

        textWrapper.innerHTML = `
            <div class="element-drag-handle" title="Nhấp giữ để kéo di chuyển">
                <i class="ph-bold ph-dots-six-vertical"></i> Kéo di chuyển
                <span class="text-char-count">${truncatedInitial.length}/50</span>
            </div>
            <div class="card-element-text-content" contenteditable="true" data-placeholder="Nhập lời chúc (tối đa 50 ký tự)..." style="color: ${activeColor};">${escapeHtml(truncatedInitial)}</div>
            <button type="button" class="element-delete-btn" title="Xóa"><i class="ph-bold ph-x"></i></button>
        `;

        elementsLayer.appendChild(textWrapper);
        makeElementDraggable(textWrapper);

        const textContent = textWrapper.querySelector('.card-element-text-content');
        const charCounter = textWrapper.querySelector('.text-char-count');

        const updateCharCount = () => {
            let currentText = textContent.innerText || '';
            if (currentText.endsWith('\n')) currentText = currentText.slice(0, -1);

            if (currentText.length > 50) {
                currentText = currentText.substring(0, 50);
                textContent.innerText = currentText;
                placeCaretAtEnd(textContent);
            }

            if (charCounter) {
                charCounter.innerText = `${currentText.length}/50`;
                if (currentText.length >= 50) {
                    charCounter.classList.add('limit-reached');
                } else {
                    charCounter.classList.remove('limit-reached');
                }
            }
        };

        textContent.addEventListener('input', updateCharCount);
        textContent.addEventListener('keyup', updateCharCount);

        // Focus text element
        setTimeout(() => textContent.focus(), 50);

        // Delete element button
        textWrapper.querySelector('.element-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            textWrapper.remove();
        });
    }

    function placeCaretAtEnd(el) {
        el.focus();
        if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // 1. Check file size limit (Max 10MB)
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (file.size > MAX_FILE_SIZE) {
            alert('Dung lượng tệp ảnh quá lớn (> 10MB). Vui lòng chọn tệp ảnh có dung lượng nhỏ hơn!');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Downscale & compress uploaded image so it fits comfortably within card editor
                const compressCanvas = document.createElement('canvas');
                const maxDim = 320; // Maximum dimension in pixels
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDim) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

                compressCanvas.width = width;
                compressCanvas.height = height;
                const cCtx = compressCanvas.getContext('2d');

                if (!isPng) {
                    // For JPEGs, fill solid white background
                    cCtx.fillStyle = '#FFFFFF';
                    cCtx.fillRect(0, 0, width, height);
                } else {
                    // For PNGs, clear canvas to preserve 100% true alpha transparency!
                    cCtx.clearRect(0, 0, width, height);
                }

                cCtx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = isPng ? compressCanvas.toDataURL('image/png') : compressCanvas.toDataURL('image/jpeg', 0.85);

                const imgWrapper = document.createElement('div');
                imgWrapper.className = 'card-element image-element';
                imgWrapper.style.left = '40px';
                imgWrapper.style.top = '40px';
                imgWrapper.style.width = '160px';

                imgWrapper.innerHTML = `
                    <div class="element-drag-handle" title="Nhấp giữ để kéo di chuyển"><i class="ph-bold ph-dots-six-vertical"></i> Kéo di chuyển</div>
                    <img src="${compressedDataUrl}" class="card-element-image" alt="Uploaded element" draggable="false">
                    <button type="button" class="element-delete-btn" title="Xóa"><i class="ph-bold ph-x"></i></button>
                    <div class="element-resize-handle" title="Kéo góc để chỉnh kích thước"><i class="ph-bold ph-arrows-out-cardinal"></i></div>
                `;

                elementsLayer.appendChild(imgWrapper);
                makeElementDraggable(imgWrapper);
                makeElementResizable(imgWrapper);

                imgWrapper.querySelector('.element-delete-btn').addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    imgWrapper.remove();
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    function makeElementDraggable(el) {
        const onStart = (e) => {
            if (e.target.classList.contains('element-delete-btn') || 
                e.target.closest('.element-delete-btn') ||
                e.target.classList.contains('element-resize-handle') ||
                e.target.closest('.element-resize-handle')) return;

            // If user is currently editing text inside contenteditable div, allow text selection unless dragged from handle/border
            if (e.target.classList.contains('card-element-text-content') && document.activeElement === e.target && !e.target.closest('.element-drag-handle')) {
                return;
            }

            activeDraggedElement = el;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const rect = el.getBoundingClientRect();
            dragOffsetX = clientX - rect.left;
            dragOffsetY = clientY - rect.top;

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        };

        const onMove = (e) => {
            if (!activeDraggedElement) return;
            if (e.touches) e.preventDefault();

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const containerRect = editorCanvasContainer.getBoundingClientRect();
            let newX = clientX - containerRect.left - dragOffsetX;
            let newY = clientY - containerRect.top - dragOffsetY;

            // Bounds check - ensure element stays strictly within card paper canvas
            const elWidth = activeDraggedElement.offsetWidth || 80;
            const elHeight = activeDraggedElement.offsetHeight || 30;
            const maxX = Math.max(20, containerRect.width - elWidth - 16);
            const maxY = Math.max(16, containerRect.height - elHeight - 16);
            newX = Math.max(20, Math.min(maxX, newX));
            newY = Math.max(16, Math.min(maxY, newY));

            activeDraggedElement.style.left = `${newX}px`;
            activeDraggedElement.style.top = `${newY}px`;
        };

        const onEnd = () => {
            activeDraggedElement = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };

        el.addEventListener('mousedown', onStart);
        el.addEventListener('touchstart', onStart, { passive: false });
    }

    function makeElementResizable(el) {
        const resizeHandle = el.querySelector('.element-resize-handle');
        if (!resizeHandle) return;

        let startX = 0;
        let startW = 0;

        const onResizeStart = (e) => {
            e.stopPropagation();
            if (e.type === 'touchstart') e.preventDefault();

            startX = e.touches ? e.touches[0].clientX : e.clientX;
            startW = el.offsetWidth || 160;

            document.addEventListener('mousemove', onResizeMove);
            document.addEventListener('mouseup', onResizeEnd);
            document.addEventListener('touchmove', onResizeMove, { passive: false });
            document.addEventListener('touchend', onResizeEnd);
        };

        const onResizeMove = (e) => {
            if (e.touches) e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const deltaX = clientX - startX;
            const newW = Math.max(50, Math.min(420, startW + deltaX));
            el.style.width = `${newW}px`;
        };

        const onResizeEnd = () => {
            document.removeEventListener('mousemove', onResizeMove);
            document.removeEventListener('mouseup', onResizeEnd);
            document.removeEventListener('touchmove', onResizeMove);
            document.removeEventListener('touchend', onResizeEnd);
        };

        resizeHandle.addEventListener('mousedown', onResizeStart);
        resizeHandle.addEventListener('touchstart', onResizeStart, { passive: false });
    }

    // ==========================================================================
    // COMPOSITE & POST WISH FLOW (PERFECT FLICKER-FREE PROTECTION)
    // ==========================================================================
    async function postWish() {
        const name = editorNameInput.value.trim() || 'Người chúc ẩn danh';

        // Render merged card canvas image
        const mergedImageData = await generateMergedCardImage();

        // Calculate balanced zone coordinates across PC board width
        const boardRect = wishBoard.getBoundingClientRect();
        const isMobile = window.innerWidth <= 640;
        const cardWidth = isMobile ? 190 : 240;
        const cardHeight = isMobile ? 190 : 240;

        let targetX, targetY;

        if (!isMobile) {
            // Smart 3-zone distribution for PC (Left, Center, Right)
            const zoneIndex = wishes.length % 3;
            const zones = [
                0.06 + (Math.random() * 0.22), // Left section (6% - 28%)
                0.36 + (Math.random() * 0.24), // Center section (36% - 60%)
                0.66 + (Math.random() * 0.24)  // Right section (66% - 90%)
            ];
            targetX = Math.round(boardRect.width * zones[zoneIndex]);
            targetY = Math.round(30 + Math.random() * (boardRect.height - cardHeight - 60));
        } else {
            // Mobile screen bounds
            const margin = 15;
            const maxSpawnX = Math.max(margin, boardRect.width - cardWidth - margin);
            const maxSpawnY = Math.max(margin, boardRect.height - cardHeight - margin);
            targetX = Math.round(margin + Math.random() * (maxSpawnX - margin));
            targetY = Math.round(margin + Math.random() * (maxSpawnY - margin));
        }

        const targetRot = Math.floor(Math.random() * 24) - 12; // -12 to +12 deg
        
        const highestZ = getHighestCardZIndex() + 10;
        maxZIndex = highestZ;

        const chosenTheme = getWishThemeClass({ id: 'wish-' + Date.now(), bgColor: currentEditorBgColor }, wishes.length);
        const newWish = {
            id: 'wish-' + Date.now(),
            author: name,
            imageData: mergedImageData,
            x: targetX,
            y: targetY,
            rotation: targetRot,
            zIndex: highestZ,
            bgColor: currentEditorBgColor,
            themeClass: chosenTheme,
            timestamp: Date.now(),
            isUserPositioned: true
        };

        // Activate protection flags to prevent background polling from overriding local state
        isPostingWish = true;
        pendingWishesMap.set(newWish.id, newWish);

        // 1. Hide Overlay immediately
        editorOverlay.classList.add('hidden');

        // 2. Add to local state & render smoothly without innerHTML wipe
        wishes.push(newWish);
        saveWishesToCache();
        updateWishCount();
        renderWishesView();

        // 3. Save wish to MongoDB in background
        await saveWishes(newWish);
        isPostingWish = false;
    }

    async function generateMergedCardImage() {
        const renderCanvas = document.createElement('canvas');
        renderCanvas.width = 480;
        renderCanvas.height = 360;
        const rCtx = renderCanvas.getContext('2d');

        // Fill solid white opaque card background inside drawing preview
        rCtx.fillStyle = '#FFFFFF';
        rCtx.fillRect(0, 0, 480, 360);

        // Draw grid lines pattern
        rCtx.strokeStyle = 'rgba(226, 232, 240, 0.6)';
        rCtx.lineWidth = 1;
        for (let x = 0; x < 480; x += 30) {
            rCtx.beginPath();
            rCtx.moveTo(x, 0);
            rCtx.lineTo(x, 360);
            rCtx.stroke();
        }
        for (let y = 0; y < 360; y += 30) {
            rCtx.beginPath();
            rCtx.moveTo(0, y);
            rCtx.lineTo(480, y);
            rCtx.stroke();
        }

        // Draw 2D canvas drawing layer
        rCtx.drawImage(drawingCanvas, 0, 0, 480, 360);

        // Draw HTML Elements Layer (Text & Uploaded Images)
        const containerRect = editorCanvasContainer.getBoundingClientRect();
        const scaleX = 480 / containerRect.width;
        const scaleY = 360 / containerRect.height;

        const elements = elementsLayer.querySelectorAll('.card-element');
        for (const el of elements) {
            const elRect = el.getBoundingClientRect();
            const posX = (elRect.left - containerRect.left) * scaleX;
            const posY = (elRect.top - containerRect.top) * scaleY;

            if (el.classList.contains('text-element')) {
                const textContent = el.querySelector('.card-element-text-content');
                if (textContent && textContent.innerText.trim()) {
                    let text = textContent.innerText.trim();
                    if (text.length > 50) text = text.substring(0, 50);

                    const color = textContent.style.color || '#1E293B';
                    
                    rCtx.fillStyle = color;
                    rCtx.font = '300 24px "Playwrite GB S", "Playwrite IE", cursive, sans-serif';
                    rCtx.textAlign = 'left';
                    rCtx.textBaseline = 'top';

                    // Ensure generous left margin safe offset so cursive font flourishes/swashes (e.g. h, H, C) never clip on left canvas edge
                    const safeX = Math.max(32, posX + 16);
                    const safeY = Math.max(24, posY + 12);
                    // Match full editor container paper width so text line wrapping is 100% identical to what user typed in editor
                    const maxTextWidth = Math.max(260, 480 - safeX - 24);

                    // Automatic multiline word wrapping for canvas rendering
                    const lines = [];
                    const paragraphs = text.split('\n');
                    paragraphs.forEach((p) => {
                        const words = p.split(' ');
                        let currentLine = '';
                        words.forEach((w) => {
                            const testLine = currentLine ? currentLine + ' ' + w : w;
                            const metrics = rCtx.measureText(testLine);
                            if (metrics.width > maxTextWidth && currentLine !== '') {
                                lines.push(currentLine);
                                currentLine = w;
                            } else {
                                currentLine = testLine;
                            }
                        });
                        if (currentLine) lines.push(currentLine);
                    });

                    lines.forEach((l, idx) => {
                        rCtx.fillText(l, safeX, safeY + idx * 34);
                    });
                }
            } else if (el.classList.contains('image-element')) {
                const imgEl = el.querySelector('img');
                if (imgEl) {
                    const imgRect = imgEl.getBoundingClientRect();
                    const imgPosX = (imgRect.left - containerRect.left) * scaleX;
                    const imgPosY = (imgRect.top - containerRect.top) * scaleY;
                    const drawW = imgRect.width * scaleX;
                    const drawH = imgRect.height * scaleY;

                    await new Promise((resolve) => {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => {
                            rCtx.drawImage(img, imgPosX, imgPosY, drawW, drawH);
                            resolve();
                        };
                        img.onerror = () => resolve();
                        img.src = imgEl.src;
                    });
                }
            }
        }

        return renderCanvas.toDataURL('image/png');
    }

    function bindFloatingActionButtons() {
        const btnOpenEditorEl = document.getElementById('btn-open-editor');
        const btnOpenGridEl = document.getElementById('btn-open-grid');
        if (btnOpenEditorEl) {
            btnOpenEditorEl.onclick = openEditor;
        }
        if (btnOpenGridEl) {
            btnOpenGridEl.onclick = openGridModal;
        }
    }

    function bindCameraControls() {
        const btnZoomIn = document.getElementById('btn-zoom-in');
        const btnZoomOut = document.getElementById('btn-zoom-out');
        const btnZoomReset = document.getElementById('btn-zoom-reset');

        if (btnZoomIn) {
            btnZoomIn.onclick = () => {
                userZoomMultiplier = Math.min(3.5, userZoomMultiplier + 0.2);
                updateBoardCameraTransform();
            };
        }
        if (btnZoomOut) {
            btnZoomOut.onclick = () => {
                userZoomMultiplier = Math.max(0.3, userZoomMultiplier - 0.2);
                updateBoardCameraTransform();
            };
        }
        if (btnZoomReset) {
            btnZoomReset.onclick = () => {
                userZoomMultiplier = 1.0;
                boardPanX = 0;
                boardPanY = 0;
                updateBoardCameraTransform();
            };
        }

        if (wishBoard && !wishBoard.dataset.wheelBound) {
            wishBoard.dataset.wheelBound = "true";
            wishBoard.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.08 : -0.08;
                userZoomMultiplier = Math.max(0.3, Math.min(3.5, userZoomMultiplier + delta));
                updateBoardCameraTransform();
            }, { passive: false });
        }
    }

    // ==========================================================================
    // RENDER WISH CARDS ON THE BOARD (PC/MOBILE BALANCED DISTRIBUTION)
    // ==========================================================================
    function renderBoardCards() {
        if (!wishBoard) return;

        const cardsViewport = document.getElementById('wish-cards-viewport') || wishBoard;

        let floatingActions = wishBoard.querySelector('.board-floating-actions');
        if (!floatingActions) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'board-floating-actions';
            actionsDiv.innerHTML = `
                <button id="btn-open-editor" class="btn-board-action" type="button">
                    <i class="ph-bold ph-pencil-line"></i>
                    <span>Viết lời chúc của bạn</span>
                </button>

                <button id="btn-open-grid" class="btn-board-action btn-board-counter" type="button">
                    <i class="ph-bold ph-envelope"></i>
                    <span id="wish-count">${wishes ? wishes.length : 0} lời chúc</span>
                </button>
            `;
            wishBoard.appendChild(actionsDiv);
            bindFloatingActionButtons();
        } else {
            const countSpan = floatingActions.querySelector('#wish-count');
            if (countSpan) countSpan.textContent = `${wishes ? wishes.length : 0} lời chúc`;
        }

        if (!wishes || wishes.length === 0) {
            cardsViewport.style.transform = 'scale(1)';
            let emptyNotice = cardsViewport.querySelector('.empty-board-notice');
            if (!emptyNotice) {
                emptyNotice = document.createElement('div');
                emptyNotice.className = 'empty-board-notice';
                emptyNotice.innerHTML = `
                    <i class="ph-bold ph-cards"></i>
                    <p>Chưa có lời chúc nào. Hãy là người đầu tiên viết lời chúc nhé!</p>
                `;
                cardsViewport.appendChild(emptyNotice);
            }
            return;
        }

        const emptyNotice = cardsViewport.querySelector('.empty-board-notice');
        if (emptyNotice) {
            emptyNotice.remove();
        }

        cardsViewport.style.transform = 'scale(1)';

        const boardRect = wishBoard.getBoundingClientRect();
        const boardWidth = boardRect.width || window.innerWidth || 800;
        const boardHeight = boardRect.height || window.innerHeight || 600;

        const wishIds = new Set(wishes.map(w => w.id));

        // Remove DOM cards that were deleted
        const existingCards = cardsViewport.querySelectorAll('.wish-card');
        existingCards.forEach(cardEl => {
            const id = cardEl.dataset.id;
            if (!wishIds.has(id)) {
                cardEl.remove();
            }
        });

        const isMobile = window.innerWidth <= 640;
        const count = wishes.length;
        const cardThemes = ['card-theme-pink', 'card-theme-yellow', 'card-theme-white', 'card-theme-blue'];
        const cols = Math.max(3, Math.ceil(Math.sqrt(count * 1.5)));
        const rows = Math.max(2, Math.ceil(count / cols));
        const cellW = (boardWidth - 260) / Math.max(1, cols - 1);
        const cellH = (boardHeight - 260) / Math.max(1, rows - 1);

        // Sort wishes by zIndex before rendering so DOM child order matches zIndex 100%
        wishes.sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));

        // Reconcile and render each wish card
        wishes.forEach((wish, idx) => {
            let card = cardsViewport.querySelector(`.wish-card[data-id="${wish.id}"]`);

            let targetX = Number(wish.x);
            let targetY = Number(wish.y);

            if (!isMobile) {
                // PC Screen: Spreads cards evenly across calculated cols x rows grid
                if ((!targetX || targetX < boardWidth * 0.15) && !wish.isUserPositioned) {
                    const r = Math.floor(idx / cols);
                    const c = idx % cols;
                    const offsetX = Math.sin(idx * 7) * 20;
                    const offsetY = Math.cos(idx * 5) * 20;

                    targetX = Math.round(40 + (c * cellW) + offsetX);
                    targetY = Math.round(35 + (r * cellH) + offsetY);
                    
                    wish.x = targetX;
                    wish.y = targetY;
                }

                const maxAllowedX = Math.max(10, boardWidth - 260);
                const maxAllowedY = Math.max(10, boardHeight - 260);
                targetX = Math.max(20, Math.min(maxAllowedX, targetX));
                targetY = Math.max(20, Math.min(maxAllowedY, targetY));
            } else {
                // Mobile Phone screen bounds clamping
                const cardWidth = 190;
                const cardHeight = 190;
                const maxAllowedX = Math.max(10, boardWidth - cardWidth - 10);
                const maxAllowedY = Math.max(10, boardHeight - cardHeight - 10);

                targetX = Math.max(10, Math.min(maxAllowedX, targetX));
                targetY = Math.max(10, Math.min(maxAllowedY, targetY));
            }

            const activeZIndex = Number(wish.zIndex) || 1;
            const themeClass = getWishThemeClass(wish, idx);
            const author = escapeHtml(wish.author || 'Người chúc ẩn danh');
            const hasText = wish.text && wish.text.length > 0;

            if (!card) {
                card = document.createElement('div');
                card.className = `wish-card ${themeClass}`;
                card.dataset.id = wish.id;
                card.style.left = `${targetX}px`;
                card.style.top = `${targetY}px`;
                card.style.transform = `rotate(${wish.rotation || (Math.floor(Math.random() * 24) - 12)}deg)`;
                card.style.zIndex = activeZIndex;

                card.innerHTML = `
                    <div class="card-blue-pin"></div>
                    <div class="card-author-title">Từ ${author}</div>
                    <div class="card-content-box">
                        ${hasText && !wish.imageData ? 
                            `<div class="card-text-content">${escapeHtml(wish.text)}</div>` : 
                            `<img class="card-img-content" src="${wish.imageData}" alt="Lời chúc của ${author}" draggable="false">`
                        }
                    </div>
                `;

                cardsViewport.appendChild(card);
                makeCardDraggableAndClickable(card);
            } else {
                if (!card.classList.contains('dragging')) {
                    card.style.left = `${targetX}px`;
                    card.style.top = `${targetY}px`;
                    
                    const currentStyleZ = parseInt(card.style.zIndex) || 1;
                    const finalZ = Math.max(currentStyleZ, activeZIndex);
                    card.style.zIndex = finalZ;
                    wish.zIndex = finalZ;
                    cardsViewport.appendChild(card);
                }
            }
        });
    }

    let currentMobilePage = 0;
    let mobileTouchStartX = 0;
    let mobileTouchStartY = 0;
    let mobileTouchIsSwiping = false;

    function bindMobileActionButtons() {
        const btnOpenEditorMobile = document.getElementById('btn-open-editor-mobile');
        const btnOpenGridMobile = document.getElementById('btn-open-grid-mobile');
        if (btnOpenEditorMobile) {
            btnOpenEditorMobile.onclick = openEditor;
        }
        if (btnOpenGridMobile) {
            btnOpenGridMobile.onclick = null;
            btnOpenGridMobile.style.pointerEvents = 'none';
            btnOpenGridMobile.style.cursor = 'default';
        }
    }

    function renderMobileWishView() {
        const mobileContainer = document.getElementById('wishes-mobile-container');
        const mobileGrid = document.getElementById('mobile2x2Grid');
        const mobileDotsContainer = document.getElementById('mobilePaginationDots');
        const mobileCountSpan = document.getElementById('wish-count-mobile');

        if (!mobileContainer || !mobileGrid) return;

        bindMobileActionButtons();

        if (mobileCountSpan) {
            mobileCountSpan.textContent = `${wishes ? wishes.length : 0} lời chúc`;
        }

        if (!wishes || wishes.length === 0) {
            mobileGrid.innerHTML = `
                <div class="empty-board-notice" style="grid-column: 1 / -1; padding: 40px 10px;">
                    <i class="ph-bold ph-cards" style="font-size: 2rem; color: #94A3B8;"></i>
                    <p style="color: #64748B; margin-top: 8px;">Chưa có lời chúc nào. Hãy là người đầu tiên viết lời chúc nhé!</p>
                </div>
            `;
            if (mobileDotsContainer) mobileDotsContainer.innerHTML = '';
            return;
        }

        const itemsPerPage = 4;
        const totalPages = Math.max(1, Math.ceil(wishes.length / itemsPerPage));
        if (currentMobilePage >= totalPages) {
            currentMobilePage = totalPages - 1;
        }
        if (currentMobilePage < 0) {
            currentMobilePage = 0;
        }

        const pageWishes = wishes.slice(currentMobilePage * itemsPerPage, (currentMobilePage + 1) * itemsPerPage);
        mobileGrid.innerHTML = '';
        pageWishes.forEach((wish, idx) => {
            const cardEl = document.createElement('div');
            const themeClass = getWishThemeClass(wish, (currentMobilePage * 4 + idx));
            cardEl.className = `mobile-wish-card ${themeClass}`;
            cardEl.dataset.id = wish.id;

            const author = escapeHtml(wish.author || 'Người chúc ẩn danh');
            const hasText = wish.text && wish.text.length > 0;

            cardEl.innerHTML = `
                <div class="card-blue-pin"></div>
                <div class="card-author-title">Từ ${author}</div>
                <div class="card-content-box">
                    ${hasText && !wish.imageData ? 
                        `<div class="card-text-content">${escapeHtml(wish.text)}</div>` : 
                        `<img class="card-img-content" src="${wish.imageData}" alt="Lời chúc của ${author}">`
                    }
                </div>
            `;

            cardEl.onclick = (e) => {
                if (mobileTouchIsSwiping) {
                    mobileTouchIsSwiping = false;
                    return;
                }
                openReaderModalByWishId(wish.id);
            };

            mobileGrid.appendChild(cardEl);
        });

        // Render Pagination Dots
        if (mobileDotsContainer) {
            mobileDotsContainer.innerHTML = '';
            if (totalPages > 1) {
                // Dynamic sliding window (max 6 visible dots)
                const MAX_DOTS = 6;
                let startPage = 0;
                if (totalPages > MAX_DOTS) {
                    startPage = Math.max(0, Math.min(currentMobilePage - 2, totalPages - MAX_DOTS));
                }
                const endPage = Math.min(totalPages, startPage + MAX_DOTS);

                for (let i = startPage; i < endPage; i++) {
                    const dot = document.createElement('span');
                    const isActive = (i === currentMobilePage);
                    dot.className = `dot ${isActive ? 'active' : ''}`;
                    dot.setAttribute('title', `Trang ${i + 1}`);
                    dot.onclick = () => {
                        currentMobilePage = i;
                        renderMobileWishView();
                    };
                    mobileDotsContainer.appendChild(dot);
                }
            }
        }

        // Bind Touch & Swipe Gesture Navigation
        const gridWrapper = document.getElementById('mobileGridWrapper') || mobileContainer;
        if (gridWrapper && !gridWrapper.dataset.swipeBound) {
            gridWrapper.dataset.swipeBound = "true";

            let isHorizontalLock = false;

            const handleStart = (clientX, clientY) => {
                mobileTouchStartX = clientX;
                mobileTouchStartY = clientY;
                mobileTouchIsSwiping = false;
                isHorizontalLock = false;
            };

            const handleEnd = (clientX, clientY) => {
                const diffX = mobileTouchStartX - clientX;
                const diffY = mobileTouchStartY - clientY;

                // Horizontal swipe check: horizontal displacement > vertical displacement and > 25px
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 25) {
                    mobileTouchIsSwiping = true;
                    const totalPagesNow = Math.max(1, Math.ceil((wishes ? wishes.length : 0) / 4));

                    if (diffX > 0) {
                        // Swipe Left -> Next Page
                        if (currentMobilePage < totalPagesNow - 1) {
                            currentMobilePage++;
                            renderMobileWishView();
                        }
                    } else {
                        // Swipe Right -> Prev Page
                        if (currentMobilePage > 0) {
                            currentMobilePage--;
                            renderMobileWishView();
                        }
                    }
                }
            };

            // Touch events for mobile phones/tablets
            gridWrapper.addEventListener('touchstart', (e) => {
                if (e.touches && e.touches.length === 1) {
                    handleStart(e.touches[0].clientX, e.touches[0].clientY);
                }
            }, { passive: true });

            gridWrapper.addEventListener('touchmove', (e) => {
                if (e.touches && e.touches.length === 1) {
                    const currentX = e.touches[0].clientX;
                    const currentY = e.touches[0].clientY;
                    const diffX = Math.abs(currentX - mobileTouchStartX);
                    const diffY = Math.abs(currentY - mobileTouchStartY);

                    // If user moves finger horizontally more than vertically, lock vertical scrolling for this gesture
                    if (diffX > diffY && diffX > 6) {
                        isHorizontalLock = true;
                        if (e.cancelable) {
                            e.preventDefault();
                        }
                    }
                }
            }, { passive: false });

            gridWrapper.addEventListener('touchend', (e) => {
                if (e.changedTouches && e.changedTouches.length === 1) {
                    handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
                }
            }, { passive: true });

            // Mouse drag support for desktop mouse / devtools simulation
            let isMouseDown = false;
            gridWrapper.addEventListener('mousedown', (e) => {
                isMouseDown = true;
                handleStart(e.clientX, e.clientY);
            });

            gridWrapper.addEventListener('mouseup', (e) => {
                if (isMouseDown) {
                    isMouseDown = false;
                    handleEnd(e.clientX, e.clientY);
                }
            });

            gridWrapper.addEventListener('mouseleave', () => {
                isMouseDown = false;
            });
        }
    }

    function renderWishesView() {
        if (window.innerWidth <= 768) {
            renderMobileWishView();
        } else {
            renderBoardCards();
        }
    }

    function renderPaginationDots(totalPages) {
        const paginationEl = document.getElementById('wishes-pagination');
        const prevBtn = document.getElementById('wish-prev-btn');
        const nextBtn = document.getElementById('wish-next-btn');

        if (!paginationEl) return;

        // Hide Prev/Next arrow buttons
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';

        // Dynamic sliding window (max 6 visible dots)
        const MAX_DOTS = 6;
        let startPage = 0;
        if (totalPages > MAX_DOTS) {
            startPage = Math.max(0, Math.min(currentWishPage - 2, totalPages - MAX_DOTS));
        }
        const endPage = Math.min(totalPages, startPage + MAX_DOTS);

        let dotsHtml = '';
        for (let i = startPage; i < endPage; i++) {
            const isActive = (i === currentWishPage);
            dotsHtml += `
                <span class="dot-item ${isActive ? 'active' : ''}" 
                      data-dot-index="${i}" 
                      title="Trang ${i + 1}"></span>
            `;
        }

        paginationEl.innerHTML = dotsHtml;

        const dots = paginationEl.querySelectorAll('.dot-item');
        dots.forEach((dot) => {
            dot.onclick = () => {
                const targetPage = parseInt(dot.dataset.dotIndex) || 0;
                if (targetPage < totalPages) {
                    currentWishPage = targetPage;
                    renderWishesView();
                }
            };
        });
    }

    // Keyboard Arrow Keys (Left / Right) & Mouse Drag Swipe Navigation for PC & Mobile
    let boardDragStartX = 0;
    let isBoardMouseDown = false;

    if (wishBoard && !wishBoard.dataset.dragSwipeBound) {
        wishBoard.dataset.dragSwipeBound = "true";

        wishBoard.addEventListener('mousedown', (e) => {
            if (e.target.closest('.wish-card') || e.target.closest('.btn-board-action') || e.target.closest('.wish-nav-btn')) return;
            isBoardMouseDown = true;
            boardDragStartX = e.clientX;
        });

        wishBoard.addEventListener('mouseup', (e) => {
            if (!isBoardMouseDown) return;
            isBoardMouseDown = false;
            const diff = boardDragStartX - e.clientX;
            if (Math.abs(diff) > 40) {
                if (diff > 0) {
                    // Drag Left -> Next Page
                    const itemsPerPage = 8;
                    const totalPages = Math.max(1, Math.ceil((wishes ? wishes.length : 0) / itemsPerPage));
                    if (currentWishPage < totalPages - 1) {
                        currentWishPage++;
                        renderWishesView();
                    }
                } else {
                    // Drag Right -> Prev Page
                    if (currentWishPage > 0) {
                        currentWishPage--;
                        renderWishesView();
                    }
                }
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        if (editorOverlay && !editorOverlay.classList.contains('hidden')) return;

        if (e.key === 'ArrowLeft') {
            if (window.innerWidth <= 768) {
                if (currentMobilePage > 0) {
                    currentMobilePage--;
                    renderMobileWishView();
                }
            } else {
                if (currentWishPage > 0) {
                    currentWishPage--;
                    renderWishesView();
                }
            }
        } else if (e.key === 'ArrowRight') {
            if (window.innerWidth <= 768) {
                const itemsPerPage = 4;
                const totalPages = Math.max(1, Math.ceil((wishes ? wishes.length : 0) / itemsPerPage));
                if (currentMobilePage < totalPages - 1) {
                    currentMobilePage++;
                    renderMobileWishView();
                }
            } else {
                const itemsPerPage = 8;
                const totalPages = Math.max(1, Math.ceil((wishes ? wishes.length : 0) / itemsPerPage));
                if (currentWishPage < totalPages - 1) {
                    currentWishPage++;
                    renderWishesView();
                }
            }
        }
    });

    function bringCardToFront(cardEl, wishObj) {
        const topZ = getHighestCardZIndex() + 100;
        maxZIndex = topZ;
        cardEl.style.zIndex = topZ;
        
        const cardsVP = document.getElementById('wish-cards-viewport') || wishBoard;
        if (cardsVP && cardEl.parentElement === cardsVP) {
            cardsVP.appendChild(cardEl); // Bring card to absolute top of DOM stack immediately!
        }

        if (wishObj) {
            wishObj.zIndex = topZ;
            // Move wishObj to the end of wishes array so DOM order and memory order match
            const wIdx = wishes.findIndex(w => String(w.id) === String(wishObj.id));
            if (wIdx >= 0) {
                const [moved] = wishes.splice(wIdx, 1);
                wishes.push(moved);
            }
        }
    }

    // ==========================================================================
    // INTERACTIVE CARD PHYSICS (120 FPS HIGH PERFORMANCE DRAGGING)
    // ==========================================================================
    function makeCardDraggableAndClickable(cardEl) {
        let isDraggingThisCard = false;
        let cachedWishObj = null;
        let cachedBoardWidth = 800;
        let cachedBoardHeight = 600;
        let cachedCardWidth = 250;
        let cachedCardHeight = 250;
        let rAFId = null;

        const onStart = (e) => {
            // Only primary left mouse click or touch
            if (e.type === 'mousedown' && e.button !== 0) return;

            isDraggingThisCard = true;
            draggedCard = cardEl;

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            cardDragStartX = clientX;
            cardDragStartY = clientY;

            initialCardLeft = parseFloat(cardEl.style.left) || 0;
            initialCardTop = parseFloat(cardEl.style.top) || 0;
            cardDragDistance = 0;

            // Cache bounding dimensions once per drag start to avoid CPU reflows
            const bRect = wishBoard.getBoundingClientRect();
            const cRect = cardEl.getBoundingClientRect();
            cachedBoardWidth = bRect.width || window.innerWidth || 800;
            cachedBoardHeight = bRect.height || window.innerHeight || 600;
            cachedCardWidth = cRect.width || 240;
            cachedCardHeight = cRect.height || 240;

            const wishId = cardEl.dataset.id;
            cachedWishObj = wishes.find(w => String(w.id) === String(wishId)) || null;

            // Boost zIndex & DOM position to be higher than all cards on screen
            bringCardToFront(cardEl, cachedWishObj);

            cardEl.classList.add('dragging');

            window.addEventListener('mousemove', onMove, { passive: false });
            window.addEventListener('mouseup', onEnd);
            window.addEventListener('touchmove', onMove, { passive: false });
            window.addEventListener('touchend', onEnd);
            window.addEventListener('blur', onEnd);
        };

        const onMove = (e) => {
            if (!isDraggingThisCard || draggedCard !== cardEl) return;

            // Instant drop if mouse button is no longer held down
            if (e.type === 'mousemove' && e.buttons !== 1) {
                onEnd(e);
                return;
            }

            // Ensure dragging card stays at the absolute top of DOM child stack on every move frame
            const cardsVP = document.getElementById('wish-cards-viewport') || wishBoard;
            if (cardsVP && cardEl.parentElement === cardsVP && cardsVP.lastElementChild !== cardEl) {
                cardsVP.appendChild(cardEl);
            }

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const scale = 1.0;
            const deltaX = (clientX - cardDragStartX) / scale;
            const deltaY = (clientY - cardDragStartY) / scale;

            cardDragDistance = Math.hypot(clientX - cardDragStartX, clientY - cardDragStartY);

            if (cardDragDistance > 3) {
                e.preventDefault();
            }

            let newX = initialCardLeft + deltaX;
            let newY = initialCardTop + deltaY;

            newX = Math.max(-cachedCardWidth * 0.4, Math.min(cachedBoardWidth - cachedCardWidth * 0.6, newX));
            newY = Math.max(-cachedCardHeight * 0.4, Math.min(cachedBoardHeight - cachedCardHeight * 0.6, newY));

            // Sync visual movement via requestAnimationFrame matching display refresh rate
            if (rAFId) cancelAnimationFrame(rAFId);
            rAFId = requestAnimationFrame(() => {
                cardEl.style.left = `${newX}px`;
                cardEl.style.top = `${newY}px`;
            });

            if (cachedWishObj) {
                cachedWishObj.x = Math.round(newX);
                cachedWishObj.y = Math.round(newY);
                cachedWishObj.isUserPositioned = true;
            }
        };

        const onEnd = async (e) => {
            if (!isDraggingThisCard) return;
            isDraggingThisCard = false;

            if (rAFId) cancelAnimationFrame(rAFId);

            cardEl.classList.remove('dragging');

            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
            window.removeEventListener('blur', onEnd);

            draggedCard = null;

            // Ensure dropped card stays permanently on top of all other cards!
            bringCardToFront(cardEl, cachedWishObj);
            saveWishesToCache();

            if (cardDragDistance > 5) {
                if (cachedWishObj) {
                    await saveCardPosition(cachedWishObj);
                }
            } else {
                const wishId = cardEl.dataset.id;
                openReaderModalByWishId(wishId);
            }
        };

        cardEl.addEventListener('mousedown', onStart);
        cardEl.addEventListener('touchstart', onStart, { passive: false });

        // Dedicated click handler attached directly to cardEl for exact card ID modal opening
        cardEl.addEventListener('click', (e) => {
            if (cardDragDistance > 5) return; // Prevent opening modal if dragged
            const wishId = cardEl.dataset.id;
            openReaderModalByWishId(wishId);
        });
    }

    function openReaderModalByWishId(wishId) {
        const currentWish = wishes.find(w => String(w.id) === String(wishId));
        if (!currentWish) return;

        const wishIdx = wishes.findIndex(w => String(w.id) === String(wishId));
        const themeClass = getWishThemeClass(currentWish, wishIdx >= 0 ? wishIdx : 0);
        const author = escapeHtml(currentWish.author || 'Người chúc ẩn danh');
        const hasText = currentWish.text && currentWish.text.length > 0;

        readerCardContent.innerHTML = `
            <div class="reader-modal-card ${themeClass}">
                <div class="card-blue-pin"></div>
                <div class="card-author-title">Từ ${author}</div>
                <div class="card-content-box">
                    ${hasText && !currentWish.imageData ? 
                        `<div class="card-text-content">${escapeHtml(currentWish.text)}</div>` : 
                        `<img class="card-img-content" src="${currentWish.imageData}" alt="Lời chúc của ${author}" draggable="false">`
                    }
                </div>
            </div>
        `;
        readerOverlay.classList.remove('hidden');
        updateModalBodyScrollLock();
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

    window.addEventListener('resize', () => {
        renderWishesView();
    });

    // Run Initialization
    init();
});
