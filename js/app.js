/**
 * GÓC LỜI CHÚC TƯƠNG TÁC - MAIN APPLICATION JAVASCRIPT
 * Full-featured interactive wish board connected to Node.js Express + MongoDB Backend.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // APP STATE & CONSTANTS
    // ==========================================================================
    const STORAGE_KEY = 'socio_logic_wishes_v1';
    
    // Clear legacy localStorage cache to prevent old sample cards from appearing
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}

    let wishes = [];
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
    // INITIALIZATION & BACKEND API CONNECTION
    // ==========================================================================
    function init() {
        resizeCanvas();
        setupEventListeners();
        initBackendDatabase();
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
        const apiUrl = getApiUrl();
        try {
            const res = await fetch(`${apiUrl}/api/health`);
            if (res.ok) {
                isBackendOnline = true;
                console.log('🍃 Connected to Node.js + MongoDB Backend API!');
                await fetchWishesFromMongoDB();

                // Polling for realtime updates across clients every 2 seconds
                setInterval(() => {
                    fetchWishesFromMongoDB(true);
                }, 2000);
                return;
            }
        } catch (e) {
            console.warn('Backend server not online (MongoDB offline mode):', e);
        }

        wishes = [];
        updateWishCount();
        renderBoardCards();
    }

    async function fetchWishesFromMongoDB(silent = false) {
        const apiUrl = getApiUrl();
        try {
            const response = await fetch(`${apiUrl}/api/wishes`);
            if (!response.ok) throw new Error('GET wishes failed');

            const data = await response.json();

            if (Array.isArray(data)) {
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

                // Check if card IDs and positions are identical to avoid unnecessary renders
                if (silent && wishes.length === incomingWishes.length) {
                    const wishesMap = new Map(incomingWishes.map(w => [w.id, w]));
                    let changed = false;
                    for (let w of wishes) {
                        const inc = wishesMap.get(w.id);
                        if (!inc || inc.x !== w.x || inc.y !== w.y) {
                            changed = true;
                            break;
                        }
                    }
                    if (!changed) return;
                }

                wishes = incomingWishes;
                updateWishCount();
                renderBoardCards();
            }
        } catch (err) {
            console.error('MongoDB fetch error:', err);
            if (!silent) {
                wishes = [];
                updateWishCount();
                renderBoardCards();
            }
        }
    }

    async function saveWishes(newWish = null) {
        const apiUrl = getApiUrl();
        if (newWish) {
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
                }
            } catch (err) {
                console.error('MongoDB POST exception:', err);
            }
        }
    }

    async function saveCardPosition(wishData) {
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
        textWrapper.style.left = '50px';
        textWrapper.style.top = '50px';

        const truncatedInitial = initialText ? initialText.substring(0, 150) : '';

        textWrapper.innerHTML = `
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

        const reader = new FileReader();
        reader.onload = (event) => {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'card-element image-element';
            imgWrapper.style.left = '60px';
            imgWrapper.style.top = '60px';

            imgWrapper.innerHTML = `
                <img src="${event.target.result}" alt="Uploaded element" draggable="false">
                <button type="button" class="element-delete-btn" title="Xóa"><i class="ph-bold ph-x"></i></button>
            `;

            elementsLayer.appendChild(imgWrapper);
            makeElementDraggable(imgWrapper);

            imgWrapper.querySelector('.element-delete-btn').addEventListener('click', (ev) => {
                ev.stopPropagation();
                imgWrapper.remove();
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    function makeElementDraggable(el) {
        const onStart = (e) => {
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

        el.addEventListener('mousedown', (e) => {
            if (!e.target.classList.contains('card-element-text-content') && !e.target.classList.contains('element-delete-btn')) {
                onStart(e);
            }
        });
        el.addEventListener('touchstart', (e) => {
            if (!e.target.classList.contains('card-element-text-content') && !e.target.classList.contains('element-delete-btn')) {
                onStart(e);
            }
        }, { passive: false });
    }

    // ==========================================================================
    // COMPOSITE & POST WISH FLOW (SMOOTH FLICKER-FREE RENDERING)
    // ==========================================================================
    async function postWish() {
        const name = editorNameInput.value.trim() || 'Người chúc ẩn danh';

        // Render merged card canvas image
        const mergedImageData = await generateMergedCardImage();

        // Calculate random coordinates anywhere across the entire visible board area
        const boardRect = wishBoard.getBoundingClientRect();
        const cardWidth = window.innerWidth <= 640 ? 190 : 240;
        const cardHeight = window.innerWidth <= 640 ? 190 : 240;

        const margin = 20;
        const maxSpawnX = Math.max(margin, boardRect.width - cardWidth - margin);
        const maxSpawnY = Math.max(margin, boardRect.height - cardHeight - margin);

        // Random coordinates anywhere across the board
        const targetX = Math.round(margin + Math.random() * (maxSpawnX - margin));
        const targetY = Math.round(margin + Math.random() * (maxSpawnY - margin));

        const targetRot = Math.floor(Math.random() * 24) - 12; // -12 to +12 deg
        
        maxZIndex++;

        const newWish = {
            id: 'wish-' + Date.now(),
            author: name,
            imageData: mergedImageData,
            x: targetX,
            y: targetY,
            rotation: targetRot,
            zIndex: maxZIndex,
            timestamp: Date.now()
        };

        // 1. Hide Overlay immediately
        editorOverlay.classList.add('hidden');

        // 2. Add to local state & render smoothly without innerHTML wipe
        wishes.push(newWish);
        updateWishCount();
        renderBoardCards();

        // 3. Save wish to MongoDB in background
        saveWishes(newWish);
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
    // RENDER WISH CARDS ON THE BOARD (SMOOTH DOM RECONCILIATION)
    // ==========================================================================
    function renderBoardCards() {
        if (wishes.length === 0) {
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

        // Reconcile and render each wish card
        wishes.forEach((wish) => {
            let card = wishBoard.querySelector(`.wish-card[data-id="${wish.id}"]`);

            const cardWidth = window.innerWidth <= 640 ? 190 : 240;
            const cardHeight = window.innerWidth <= 640 ? 190 : 240;

            const maxAllowedX = Math.max(10, boardWidth - cardWidth - 10);
            const maxAllowedY = Math.max(10, boardHeight - cardHeight - 10);

            let clampedX = Number(wish.x);
            let clampedY = Number(wish.y);

            clampedX = Math.max(10, Math.min(maxAllowedX, clampedX));
            clampedY = Math.max(10, Math.min(maxAllowedY, clampedY));

            if (!card) {
                card = document.createElement('div');
                card.className = 'wish-card';
                card.dataset.id = wish.id;
                card.style.left = `${clampedX}px`;
                card.style.top = `${clampedY}px`;
                card.style.transform = `rotate(${wish.rotation || 0}deg)`;
                card.style.zIndex = wish.zIndex || 1;

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
                makeCardDraggableAndClickable(card, wish);
            } else {
                if (!card.classList.contains('dragging')) {
                    card.style.left = `${clampedX}px`;
                    card.style.top = `${clampedY}px`;
                    card.style.zIndex = wish.zIndex || card.style.zIndex;
                }
            }
        });
    }

    // ==========================================================================
    // INTERACTIVE CARD PHYSICS & POSITION PERSISTENCE
    // ==========================================================================
    function makeCardDraggableAndClickable(cardEl, wishData) {
        const onStart = (e) => {
            draggedCard = cardEl;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            cardDragStartX = clientX;
            cardDragStartY = clientY;

            initialCardLeft = parseFloat(cardEl.style.left) || 0;
            initialCardTop = parseFloat(cardEl.style.top) || 0;
            cardDragDistance = 0;

            maxZIndex++;
            cardEl.style.zIndex = maxZIndex;
            wishData.zIndex = maxZIndex;

            cardEl.classList.add('dragging');

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        };

        const onMove = (e) => {
            if (!draggedCard) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            const deltaX = clientX - cardDragStartX;
            const deltaY = clientY - cardDragStartY;

            cardDragDistance = Math.hypot(deltaX, deltaY);

            if (e.touches && cardDragDistance > 5) {
                e.preventDefault();
            }

            const boardRect = wishBoard.getBoundingClientRect();
            const cardRect = cardEl.getBoundingClientRect();

            let newX = initialCardLeft + deltaX;
            let newY = initialCardTop + deltaY;

            newX = Math.max(-cardRect.width * 0.4, Math.min(boardRect.width - cardRect.width * 0.6, newX));
            newY = Math.max(-cardRect.height * 0.4, Math.min(boardRect.height - cardRect.height * 0.6, newY));

            cardEl.style.left = `${newX}px`;
            cardEl.style.top = `${newY}px`;

            wishData.x = Math.round(newX);
            wishData.y = Math.round(newY);
        };

        const onEnd = async () => {
            if (draggedCard) {
                draggedCard.classList.remove('dragging');
                if (cardDragDistance > 5) {
                    await saveCardPosition(wishData);
                }
            }

            if (cardDragDistance < 6) {
                openReaderModal(wishData);
            }

            draggedCard = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };

        cardEl.addEventListener('mousedown', onStart);
        cardEl.addEventListener('touchstart', onStart, { passive: false });
    }

    function openReaderModal(wish) {
        readerCardContent.innerHTML = `
            <div class="reader-author-badge">
                <i class="ph-bold ph-heart"></i>
                <span>Lời chúc từ: ${escapeHtml(wish.author)}</span>
            </div>
            <div class="reader-card-wrapper">
                <img src="${wish.imageData}" style="width:100%; height:100%; object-fit:contain;" alt="Chi tiết lời chúc">
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
