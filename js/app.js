/**
 * GÓC LỜI CHÚC TƯƠNG TÁC - MAIN APPLICATION JAVASCRIPT
 * Full-featured interactive wish board connected to Node.js Express + MongoDB Backend.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // APP STATE & CONSTANTS
    // ==========================================================================
    const CACHE_STORAGE_KEY = 'socio_logic_wishes_cache_v2';
    
    let wishes = [];
    let pendingWishesMap = new Map(); // Protection against polling race conditions
    let isPostingWish = false;

    let activeTool = 'pen'; // 'pen', 'text', 'image', 'eraser'
    let activeColor = '#1E293B'; // Default dark color
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

    const readerOverlay = document.getElementById('reader-overlay');
    const btnCloseReader = document.getElementById('btn-close-reader');
    const readerCardContent = document.getElementById('reader-card-content');

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
        const revealHeaders = document.querySelectorAll('.scroll-reveal-header');
        if (revealHeaders.length === 0) return;

        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -5% 0px',
            threshold: 0.15
        };

        const headerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                } else {
                    // Out of viewport: reset class so animation triggers ONLY when scrolled into view!
                    entry.target.classList.remove('is-visible');
                }
            });
        }, observerOptions);

        revealHeaders.forEach(header => {
            headerObserver.observe(header);
        });
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
                    renderBoardCards();
                    return;
                }
            }
        } catch (e) {
            console.warn('Cache read warning:', e);
        }

        // Fallback: Instant starter wishes for first-time visitors
        wishes = [
            {
                id: 'wish-starter-1',
                author: 'SocioLogic Team',
                imageData: createSampleWishCanvasData('Chúc mừng SocioLogic 2 Năm Kiến Tạo & Rực Rỡ! 🌟✨', '#0066FF', 'SocioLogic Team'),
                x: 100,
                y: 50,
                rotation: -4,
                zIndex: 10,
                timestamp: Date.now() - 100000
            },
            {
                id: 'wish-starter-2',
                author: 'Minh Anh',
                imageData: createSampleWishCanvasData('Chúc SocioLogic ngày càng phát triển, vươn xa hơn nữa! 🚀❤️', '#EC4899', 'Minh Anh'),
                x: 450,
                y: 110,
                rotation: 5,
                zIndex: 11,
                timestamp: Date.now() - 50000
            },
            {
                id: 'wish-starter-3',
                author: 'Thành Nam',
                imageData: createSampleWishCanvasData('Nghĩ sâu - Nói hay - Làm thật! Yêu SocioLogic nhiều! 🎓🔥', '#10B981', 'Thành Nam'),
                x: 780,
                y: 60,
                rotation: -3,
                zIndex: 12,
                timestamp: Date.now() - 20000
            }
        ];

        updateWishCount();
        renderBoardCards();
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
                    renderBoardCards();
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

    // Helper: Find highest z-index across all cards on screen
    function getHighestCardZIndex() {
        let highest = maxZIndex;
        const allCards = wishBoard.querySelectorAll('.wish-card');
        allCards.forEach(c => {
            const z = parseInt(c.style.zIndex) || 0;
            if (z > highest && z < 9000) {
                highest = z;
            }
        });
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
                if (e.target === readerOverlay) closeReader();
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

    // ==========================================================================
    // EDITOR MODAL LOGIC
    // ==========================================================================
    function openEditor() {
        editorOverlay.classList.remove('hidden');
        resetEditor();
        setTimeout(resizeCanvas, 50);
    }

    function closeEditor() {
        editorOverlay.classList.add('hidden');
    }

    function resetEditor() {
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        elementsLayer.innerHTML = '';
        editorNameInput.value = '';
        activeTool = 'pen';
        toolBtns.forEach(b => b.classList.remove('active'));
        document.querySelector('.tool-btn[data-tool="pen"]').classList.add('active');
        updateCtxStyle();
        editorCanvasContainer.classList.remove('eraser-mode');
        drawingCanvas.classList.remove('eraser-mode');
        eraserCursorRing.classList.add('hidden');
    }

    function closeReader() {
        readerOverlay.classList.add('hidden');
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
        textWrapper.style.left = '40px';
        textWrapper.style.top = '40px';

        const truncatedInitial = initialText ? initialText.substring(0, 150) : '';

        textWrapper.innerHTML = `
            <div class="element-drag-handle" title="Nhấp giữ để kéo di chuyển"><i class="ph-bold ph-dots-six-vertical"></i> Kéo di chuyển</div>
            <div class="card-element-text-content" contenteditable="true" data-placeholder="Nhập lời chúc..." style="color: ${activeColor};">${escapeHtml(truncatedInitial)}</div>
            <button type="button" class="element-delete-btn" title="Xóa"><i class="ph-bold ph-x"></i></button>
        `;

        elementsLayer.appendChild(textWrapper);
        makeElementDraggable(textWrapper);

        const textContent = textWrapper.querySelector('.card-element-text-content');

        // Character limit check (Max 150 chars)
        textContent.addEventListener('input', () => {
            if (textContent.innerText.length > 150) {
                textContent.innerText = textContent.innerText.substring(0, 150);
                placeCaretAtEnd(textContent);
            }
        });

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

                imgWrapper.innerHTML = `
                    <div class="element-drag-handle" title="Nhấp giữ để kéo di chuyển"><i class="ph-bold ph-dots-six-vertical"></i> Kéo di chuyển</div>
                    <img src="${compressedDataUrl}" class="card-element-image" alt="Uploaded element" draggable="false">
                    <button type="button" class="element-delete-btn" title="Xóa"><i class="ph-bold ph-x"></i></button>
                `;

                elementsLayer.appendChild(imgWrapper);
                makeElementDraggable(imgWrapper);

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
            if (e.target.classList.contains('element-delete-btn') || e.target.closest('.element-delete-btn')) return;

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

            // Bounds check
            newX = Math.max(-20, Math.min(containerRect.width - 40, newX));
            newY = Math.max(-20, Math.min(containerRect.height - 30, newY));

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
        
        maxZIndex = getHighestCardZIndex() + 1;

        const newWish = {
            id: 'wish-' + Date.now(),
            author: name,
            imageData: mergedImageData,
            x: targetX,
            y: targetY,
            rotation: targetRot,
            zIndex: maxZIndex,
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
        renderBoardCards();

        // 3. Save wish to MongoDB in background
        await saveWishes(newWish);
        isPostingWish = false;
    }

    async function generateMergedCardImage() {
        const renderCanvas = document.createElement('canvas');
        renderCanvas.width = 480;
        renderCanvas.height = 360;
        const rCtx = renderCanvas.getContext('2d');

        // Fill solid white opaque card background
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
                    const text = textContent.innerText.trim();
                    const color = textContent.style.color || '#1E293B';
                    
                    rCtx.fillStyle = color;
                    rCtx.font = 'bold 28px "Patrick Hand", "Plus Jakarta Sans", sans-serif';
                    rCtx.textAlign = 'left';
                    rCtx.textBaseline = 'top';

                    const lines = text.split('\n');
                    lines.forEach((l, idx) => {
                        rCtx.fillText(l, posX + 8, posY + 8 + idx * 34);
                    });
                }
            } else if (el.classList.contains('image-element')) {
                const imgEl = el.querySelector('img');
                if (imgEl) {
                    await new Promise((resolve) => {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => {
                            const drawW = elRect.width * scaleX;
                            const drawH = elRect.height * scaleY;
                            rCtx.drawImage(img, posX, posY, drawW, drawH);
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

    // ==========================================================================
    // RENDER WISH CARDS ON THE BOARD (PC/MOBILE BALANCED DISTRIBUTION)
    // ==========================================================================
    function renderBoardCards() {
        if (!wishes || wishes.length === 0) {
            wishBoard.innerHTML = `
                <div class="empty-board-notice">
                    <i class="ph-bold ph-cards"></i>
                    <p>Chưa có lời chúc nào. Hãy là người đầu tiên viết lời chúc nhé!</p>
                </div>
            `;
            return;
        }

        const emptyNotice = wishBoard.querySelector('.empty-board-notice');
        if (emptyNotice) {
            emptyNotice.remove();
        }

        const boardRect = wishBoard.getBoundingClientRect();
        const boardWidth = boardRect.width || window.innerWidth || 800;
        const boardHeight = boardRect.height || window.innerHeight || 600;

        const wishIds = new Set(wishes.map(w => w.id));

        // Remove DOM cards that were deleted
        const existingCards = wishBoard.querySelectorAll('.wish-card');
        existingCards.forEach(cardEl => {
            const id = cardEl.dataset.id;
            if (!wishIds.has(id)) {
                cardEl.remove();
            }
        });

        // Device check
        const isMobile = window.innerWidth <= 640;

        // Reconcile and render each wish card
        wishes.forEach((wish, idx) => {
            let card = wishBoard.querySelector(`.wish-card[data-id="${wish.id}"]`);

            let targetX = Number(wish.x);
            let targetY = Number(wish.y);

            if (!isMobile) {
                // PC Screen: If cards are gathered on the left edge (< 15% board width), distribute evenly across Left, Center, Right!
                if (targetX < boardWidth * 0.15 && !wish.isUserPositioned) {
                    const zones = [
                        0.06 + (Math.random() * 0.22), // Left section (6% - 28%)
                        0.36 + (Math.random() * 0.24), // Center section (36% - 60%)
                        0.66 + (Math.random() * 0.24)  // Right section (66% - 90%)
                    ];
                    const zoneIndex = idx % 3;
                    targetX = Math.round(boardWidth * zones[zoneIndex]);
                    targetY = Math.round(40 + (idx * 40) % (boardHeight - 280));
                    
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

            if (!card) {
                card = document.createElement('div');
                card.className = 'wish-card';
                card.dataset.id = wish.id;
                card.style.left = `${targetX}px`;
                card.style.top = `${targetY}px`;
                card.style.transform = `rotate(${wish.rotation || 0}deg)`;
                card.style.zIndex = activeZIndex;

                card.innerHTML = `
                    <div class="wish-card-header">
                        <i class="ph-bold ph-user-circle"></i>
                        <span class="wish-card-author">${escapeHtml(wish.author)}</span>
                    </div>
                    <div class="wish-card-body">
                        <img class="wish-card-canvas-preview" src="${wish.imageData}" alt="Lời chúc của ${escapeHtml(wish.author)}" draggable="false">
                    </div>
                `;

                wishBoard.appendChild(card);
                makeCardDraggableAndClickable(card);
            } else {
                if (!card.classList.contains('dragging')) {
                    card.style.left = `${targetX}px`;
                    card.style.top = `${targetY}px`;
                    
                    // Maintain highest z-index so released card stays permanently on top
                    const currentStyleZ = parseInt(card.style.zIndex) || 1;
                    const finalZ = Math.max(currentStyleZ, activeZIndex);
                    card.style.zIndex = finalZ;
                    wish.zIndex = finalZ;
                }
            }
        });
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

            // Boost zIndex to be higher than all cards on screen
            const nextZIndex = getHighestCardZIndex() + 5;
            maxZIndex = nextZIndex;
            cardEl.style.zIndex = nextZIndex;
            if (cachedWishObj) {
                cachedWishObj.zIndex = nextZIndex;
            }

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

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const deltaX = clientX - cardDragStartX;
            const deltaY = clientY - cardDragStartY;

            cardDragDistance = Math.hypot(deltaX, deltaY);

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
            const finalZIndex = getHighestCardZIndex() + 5;
            maxZIndex = finalZIndex;
            cardEl.style.zIndex = finalZIndex;

            if (cachedWishObj) {
                cachedWishObj.zIndex = finalZIndex;
            }

            if (cardDragDistance > 5) {
                if (cachedWishObj) {
                    await saveCardPosition(cachedWishObj);
                }
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

        readerCardContent.innerHTML = `
            <div class="reader-author-badge">
                <i class="ph-bold ph-heart"></i>
                <span>Lời chúc từ: ${escapeHtml(currentWish.author)}</span>
            </div>
            <div class="reader-card-wrapper">
                <img src="${currentWish.imageData}" style="width:100%; height:100%; object-fit:contain;" alt="Chi tiết lời chúc">
            </div>
        `;
        readerOverlay.classList.remove('hidden');
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
