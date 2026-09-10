/* ==========================================================================
   SECTION MIX - REAL-TIME FREE FALL PHYSICS ENGINE & LOGO CONVERGENCE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const bubblesContainer = document.getElementById('bubblesContainer');
    const heroNumber2 = document.getElementById('heroNumber2');
    const letterBubbles = bubblesContainer ? Array.from(bubblesContainer.querySelectorAll('.bubble-item')) : [];
    const miniBubbleItems = Array.from(document.querySelectorAll('.mini-bubble-item, .img-doodle'));
    const allSection1Items = [...letterBubbles, ...miniBubbleItems];
    const section1 = document.getElementById('section1');

    let currentState = 'floor'; // 'floor' or 'converged'
    let physicsAnimationFrame = null;
    let spaceFloatAnimation = null;
    let spaceState = [];

    // 1. ULTRA-REALISTIC NATURAL PHYSICS DROP ANIMATION FOR ALL 18 ITEMS (LETTER BUBBLES + MINI ICONS)
    function applyPhysicsDrop() {
        if (!bubblesContainer || allSection1Items.length === 0) return;
        bubblesContainer.classList.add('faces-active');
        bubblesContainer.classList.remove('state-converging');

        if (physicsAnimationFrame) cancelAnimationFrame(physicsAnimationFrame);

        const isMobile = window.innerWidth <= 768;

        // Target ALL 18 items (letter bubbles + mini icons) for Section 1 drop physics
        const physicsState = allSection1Items.map((el, index) => {
            const style = getComputedStyle(el);
            const baseXStr = style.getPropertyValue('--base-x').trim() || '0px';
            const baseX = parseFloat(baseXStr) || 0;
            const baseYStr = style.getPropertyValue('--base-y').trim() || '0px';
            const baseY = parseFloat(baseYStr) || 0;
            const rotFinalStr = style.getPropertyValue('--rot-final').trim() || '0deg';
            const rotFinal = parseFloat(rotFinalStr) || 0;

            const dropDistance = isMobile ? (220 + Math.sin(index * 1.5) * 40) : (340 + Math.sin(index * 1.5) * 60);
            const startY = baseY - dropDistance;

            el.style.transition = 'none';
            el.style.opacity = '0';
            el.style.transform = `translate3d(${baseX}px, ${startY}px, 0) rotate(${rotFinal + (index % 2 === 0 ? 18 : -18)}deg) scale(0.92)`;

            return {
                el,
                baseX,
                baseY,
                rotFinal,
                dropDistance,
                currentX: baseX,
                currentY: startY,
                velocityX: (Math.sin(index * 2) * 20),
                velocityY: 0,
                swayPhase: index * 0.9,
                rotOffset: (index % 2 === 0 ? 18 : -18),
                scaleX: 0.92,
                scaleY: 1.08,
                bounceCount: 0,
                settled: false,
                started: false,
                startDelay: 30 + index * 40,
                airTime: 0
            };
        });

        bubblesContainer.offsetHeight;

        let startTime = null;
        let lastFrameTime = null;

        function physicsStep(timestamp) {
            if (!startTime) {
                startTime = timestamp;
                lastFrameTime = timestamp;
            }

            // High-precision adaptive delta-time capped at max 32ms (30fps min, 60-120fps smooth)
            const rawDt = (timestamp - lastFrameTime) / 1000;
            const dt = Math.min(Math.max(rawDt, 0.008), 0.032) || 0.016;
            lastFrameTime = timestamp;

            let allSettled = true;

            physicsState.forEach((state, index) => {
                if (state.settled) return;

                const elapsedMs = timestamp - startTime;
                if (!state.started) {
                    if (elapsedMs < state.startDelay) {
                        allSettled = false;
                        return;
                    }
                    state.started = true;
                    state.el.style.opacity = '1';
                }

                allSettled = false;
                state.airTime += dt;

                const gravity = 2400;
                const airDragY = 1.3;
                const airDragX = 2.0;

                state.velocityY += (gravity - state.velocityY * airDragY) * dt;
                state.currentY += state.velocityY * dt;

                const remainingDist = Math.max(0, state.baseY - state.currentY);
                const dampening = Math.min(1, remainingDist / 140);

                const swayForce = Math.sin(state.airTime * 7.5 + state.swayPhase) * 24 * dampening;
                state.velocityX += (swayForce - state.velocityX * airDragX) * dt;
                state.currentX = state.baseX + state.velocityX * 0.15;

                const targetRotOffset = (state.velocityX * 0.35) + Math.cos(state.airTime * 6 + index) * 10 * dampening;
                state.rotOffset += (targetRotOffset - state.rotOffset) * 0.12;

                state.scaleX += (1 - state.scaleX) * 0.18;
                state.scaleY += (1 - state.scaleY) * 0.18;

                if (state.currentY >= state.baseY) {
                    state.currentY = state.baseY;

                    if (Math.abs(state.velocityY) > 60 && state.bounceCount < 3) {
                        state.bounceCount++;

                        const impactFactor = Math.min(0.28, Math.abs(state.velocityY) / 2200);
                        state.scaleX = 1 + impactFactor * 1.3;
                        state.scaleY = 1 - impactFactor * 0.9;
                        state.rotOffset += (index % 2 === 0 ? 6 : -6) * (1 + impactFactor);

                        state.velocityY = -state.velocityY * (0.36 / (1 + state.bounceCount * 0.28));
                        state.velocityX *= 0.6;
                    } else {
                        state.currentY = state.baseY;
                        state.velocityY = 0;
                        state.velocityX = 0;
                        state.settled = true;
                        state.el.style.transform = '';
                        return;
                    }
                }

                // 60FPS Pure GPU Acceleration String Render
                state.el.style.transform = `translate3d(${state.currentX.toFixed(1)}px, ${state.currentY.toFixed(1)}px, 0) rotate(${(state.rotFinal + state.rotOffset).toFixed(1)}deg) scale(${state.scaleX.toFixed(2)}, ${state.scaleY.toFixed(2)})`;
            });

            if (!allSettled) {
                physicsAnimationFrame = requestAnimationFrame(physicsStep);
            } else {
                if (bubblesContainer) bubblesContainer.classList.add('faces-active');
                allSection1Items.forEach((el) => {
                    el.style.transition = '';
                    el.style.opacity = '';
                    el.style.transform = '';
                });
                window.dispatchEvent(new CustomEvent('section1DropCompleted'));
            }
        }

        physicsAnimationFrame = requestAnimationFrame(physicsStep);
    }

    applyPhysicsDrop();

    function getBubblesContainerScale() {
        const isMobilePortrait = window.innerWidth <= 600 || (window.innerWidth <= 768 && window.innerHeight > window.innerWidth);
        if (isMobilePortrait) return 1;
        const availableWidth = window.innerWidth * 0.68;
        const baseWidth = 1400;
        return Math.min(1, Math.max(0.32, availableWidth / baseWidth));
    }

    // 2. SLOW ZERO-GRAVITY SPACE FLOATING ANIMATION FOR ALL MINI ICONS IN SECTION 2
    function startSpaceFloating() {
        if (miniBubbleItems.length === 0) return;

        const sec2Hero = document.getElementById('sec2-hero') || document.getElementById('section1');
        if (!sec2Hero) return;

        sec2Hero.style.position = 'sticky';
        sec2Hero.style.overflow = 'hidden';

        const heroW = sec2Hero.clientWidth || window.innerWidth;
        const heroH = sec2Hero.clientHeight || window.innerHeight;

        spaceState = miniBubbleItems.map((el, idx) => {
            if (el.parentElement !== sec2Hero) {
                sec2Hero.appendChild(el);
            }

            // Remove any leftover CSS transform transitions to prevent scale distortion
            el.style.transition = 'none';
            el.style.position = 'absolute';
            el.style.left = '0px';
            el.style.top = '0px';
            el.style.zIndex = '5';
            el.style.pointerEvents = 'none';
            el.style.opacity = '0'; // Start invisible above the top edge

            const isMobile = (window.innerWidth <= 768 && window.innerHeight > window.innerWidth);
            const currentScale = getBubblesContainerScale();
            const iconSize = (isMobile ? 39 : 85) * currentScale;

            const targetX = 15 + ((idx * (heroW - iconSize - 30)) / Math.max(1, miniBubbleItems.length - 1));
            const targetY = (isMobile ? 30 : 60) + ((idx % 4) * (isMobile ? 45 : 85));
            const startY = -180 - (idx * 30); // Start high ABOVE the top edge of Section 2

            // 360-degree multi-directional zero-gravity initial velocity vectors
            const angle = (idx * (Math.PI * 2 / 8)) + (idx % 2 === 0 ? 0.3 : -0.3);
            const baseSpeed = isMobile ? (0.4 + (idx % 3) * 0.25) : (0.7 + (idx % 3) * 0.4);

            const scaleStr = currentScale !== 1 ? ` scale(${currentScale.toFixed(4)})` : '';
            el.style.transform = `translate3d(${targetX.toFixed(1)}px, ${startY.toFixed(1)}px, 0) rotate(${(idx * 45) % 360}deg)${scaleStr}`;

            return {
                el,
                x: targetX,
                y: startY,
                targetY: targetY,
                vx: Math.cos(angle) * baseSpeed,
                vy: Math.sin(angle) * baseSpeed,
                rot: (idx * 45) % 360,
                vRot: (idx % 2 === 0 ? 0.12 : -0.12) * (0.8 + (idx % 3) * 0.4),
                phase: idx * 0.85,
                falling: true
            };
        });

        function floatStep() {
            if (currentState !== 'converged') return;

            const containerW = sec2Hero.clientWidth || window.innerWidth;
            const containerH = sec2Hero.clientHeight || window.innerHeight;
            const isMobile = (window.innerWidth <= 768 && window.innerHeight > window.innerWidth);
            const currentScale = getBubblesContainerScale();
            const iconSize = (isMobile ? 39 : 85) * currentScale;

            const minX = 10;
            const maxX = Math.max(minX + 20, containerW - iconSize - 10);
            const minY = 20;
            const maxY = Math.max(minY + 20, containerH - iconSize - 20);

            const scaleStr = currentScale !== 1 ? ` scale(${currentScale.toFixed(4)})` : '';

            spaceState.forEach((item) => {
                if (item.falling) {
                    // Ultra-smooth initial drop down into Section 2 space
                    const distY = item.targetY - item.y;
                    item.y += distY * 0.08;

                    const dropProgress = Math.min(1, Math.max(0, (item.y + 180) / (item.targetY + 180)));
                    item.el.style.opacity = (dropProgress * 0.85).toFixed(2);

                    if (Math.abs(distY) < 2.0) {
                        item.y = item.targetY;
                        item.falling = false; // Hand off to continuous 360-degree zero-gravity space drift!
                        item.el.style.opacity = '0.85';
                    }
                } else {
                    // 360-degree zero-gravity space drifting across the entire bounds of Section 2
                    item.x += item.vx;
                    item.y += item.vy;
                    item.rot += item.vRot;

                    // Organic space drift perturbation force (subtle orbital weightless curve)
                    item.vx += Math.cos(Date.now() * 0.0008 + item.phase) * 0.012;
                    item.vy += Math.sin(Date.now() * 0.0010 + item.phase) * 0.012;

                    // Clamp speed within natural floating limits
                    const currentSpeed = Math.hypot(item.vx, item.vy);
                    const maxSpeed = isMobile ? 1.2 : 2.2;
                    const minSpeed = isMobile ? 0.35 : 0.6;
                    if (currentSpeed > maxSpeed) {
                        item.vx = (item.vx / currentSpeed) * maxSpeed;
                        item.vy = (item.vy / currentSpeed) * maxSpeed;
                    } else if (currentSpeed < minSpeed) {
                        item.vx = (item.vx / currentSpeed) * minSpeed;
                        item.vy = (item.vy / currentSpeed) * minSpeed;
                    }

                    // Soft bounce reflection at Section 2 boundaries
                    if (item.x < minX) {
                        item.x = minX;
                        item.vx = Math.abs(item.vx);
                    } else if (item.x > maxX) {
                        item.x = maxX;
                        item.vx = -Math.abs(item.vx);
                    }

                    if (item.y < minY) {
                        item.y = minY;
                        item.vy = Math.abs(item.vy);
                    } else if (item.y > maxY) {
                        item.y = maxY;
                        item.vy = -Math.abs(item.vy);
                    }
                }

                item.el.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0) rotate(${item.rot.toFixed(1)}deg)${scaleStr}`;
            });

            spaceFloatAnimation = requestAnimationFrame(floatStep);
        }

        if (spaceFloatAnimation) cancelAnimationFrame(spaceFloatAnimation);
        spaceFloatAnimation = requestAnimationFrame(floatStep);
    }

    function stopSpaceFloating() {
        if (spaceFloatAnimation) {
            cancelAnimationFrame(spaceFloatAnimation);
            spaceFloatAnimation = null;
        }

        if (spaceState.length > 0) {
            spaceState.forEach((item) => {
                if (item.el) {
                    item.el.style.position = '';
                    item.el.style.left = '';
                    item.el.style.top = '';
                    item.el.style.transform = '';
                    item.el.style.opacity = '';
                }
            });
        }

        if (!bubblesContainer) return;
        miniBubbleItems.forEach((el) => {
            if (el.parentElement !== bubblesContainer) {
                bubblesContainer.appendChild(el);
            }
            el.style.position = '';
            el.style.left = '';
            el.style.top = '';
            el.style.zIndex = '';
            el.style.pointerEvents = '';
            el.style.transform = '';
            el.style.opacity = '';
        });
    }

    // 3. CONVERGE LETTER BUBBLES FROM FLOOR INTO LOGO GRAPHIC
    function convergeToLogo() {
        if (currentState === 'converged') return;
        currentState = 'converged';
        if (physicsAnimationFrame) cancelAnimationFrame(physicsAnimationFrame);

        if (!bubblesContainer) return;
        bubblesContainer.classList.add('state-converging');

        // Reveal graphic Number 2 / Logo smoothly!
        if (heroNumber2) {
            heroNumber2.classList.remove('vanish');
            heroNumber2.style.opacity = '1';
            heroNumber2.style.visibility = 'visible';
        }

        const targetEl = heroNumber2 || section1;
        if (!targetEl) return;

        const targetRect = targetEl.getBoundingClientRect();
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;

        const isMobile = (window.innerWidth <= 768);

        // Container scale calculation on mobile
        let scaleFactor = 1;
        if (isMobile && bubblesContainer) {
            const containerWidth = 440;
            const containerHeight = 820;
            const scaleX = (window.innerWidth - 16) / containerWidth;
            const scaleY = (window.innerHeight - 90) / containerHeight;
            scaleFactor = Math.min(scaleX, scaleY);
            if (!scaleFactor || isNaN(scaleFactor) || scaleFactor <= 0) scaleFactor = 1;
        }

        function getTransformTranslate(el) {
            const style = window.getComputedStyle(el);
            const transform = style.transform || style.webkitTransform;
            if (!transform || transform === 'none') {
                return { tx: 0, ty: 0 };
            }
            try {
                const matrix = new DOMMatrix(transform);
                return { tx: matrix.e || matrix.m41 || 0, ty: matrix.f || matrix.m42 || 0 };
            } catch (err) {
                return { tx: 0, ty: 0 };
            }
        }

        letterBubbles.forEach((bubble) => {
            const bubbleRect = bubble.getBoundingClientRect();
            const bubbleCenterX = bubbleRect.left + bubbleRect.width / 2;
            const bubbleCenterY = bubbleRect.top + bubbleRect.height / 2;

            const deltaX = (targetCenterX - bubbleCenterX) / scaleFactor;
            const deltaY = (targetCenterY - bubbleCenterY) / scaleFactor;

            const { tx, ty } = getTransformTranslate(bubble);
            const finalTx = deltaX + tx;
            const finalTy = deltaY + ty;

            bubble.style.visibility = 'visible';
            bubble.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease';
            bubble.style.transform = `translate3d(${finalTx.toFixed(1)}px, ${finalTy.toFixed(1)}px, 0) scale(0.18)`;
            bubble.style.opacity = '0';
        });

        // Hide letter bubbles completely at the end of convergence animation (750ms)
        setTimeout(() => {
            if (currentState === 'converged') {
                letterBubbles.forEach((bubble) => {
                    bubble.style.visibility = 'hidden';
                });
            }
        }, 750);

        // Always start space floating animation for mini doodle icons on both mobile & desktop!
        startSpaceFloating();
    }

    // 4. DISPERSE BUBBLES BACK FROM LOGO TO FLOOR POSITIONS
    function disperseBackToFloor() {
        if (currentState === 'floor') return;
        currentState = 'floor';

        stopSpaceFloating();

        if (!bubblesContainer) return;
        bubblesContainer.classList.remove('state-converging');

        // Hide graphic Number 2 / Logo again
        if (heroNumber2) {
            heroNumber2.classList.add('vanish');
        }

        allSection1Items.forEach((bubble) => {
            const computedStyle = getComputedStyle(bubble);
            const baseXStr = computedStyle.getPropertyValue('--base-x').trim() || '0px';
            const baseYStr = computedStyle.getPropertyValue('--base-y').trim() || '0px';
            const targetRotStr = computedStyle.getPropertyValue('--rot-final').trim() || '0deg';

            bubble.style.position = '';
            bubble.style.left = '';
            bubble.style.top = '';
            bubble.style.zIndex = '';
            bubble.style.pointerEvents = '';
            bubble.style.visibility = 'visible';
            bubble.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease';
            bubble.style.transform = `translate3d(${baseXStr}, ${baseYStr}, 0) rotate(${targetRotStr})`;
            bubble.style.opacity = '1';
        });

        setTimeout(() => {
            if (currentState === 'floor') {
                bubblesContainer.classList.add('faces-active');
                allSection1Items.forEach((bubble) => {
                    bubble.style.visibility = 'visible';
                    bubble.style.transition = '';
                    bubble.style.transform = '';
                });
            }
        }, 750);
    }

    // 5. SCROLL OBSERVER & SCROLL LISTENER FOR STRICT SECTION 2 CONTAINMENT
    function checkSection2Scroll() {
        if (!section1) return;
        const rect = section1.getBoundingClientRect();
        const vh = window.innerHeight;

        if (rect.top <= vh * 0.5 && rect.bottom > 80) {
            // User is inside Section 2 -> Converge letters into Logo & start floating icons!
            convergeToLogo();
        } else if (rect.top > vh * 0.5) {
            // User scrolled back UP to Section 1 Banner -> Disperse back to floor!
            disperseBackToFloor();
        } else if (rect.bottom <= 80) {
            // User scrolled DOWN past Section 2 into Section 3 -> STOP FLOATING IMMEDIATELY & HIDE ICONS UNDER CLUSTER 2!
            stopSpaceFloating();
        }
    }

    window.addEventListener('scroll', checkSection2Scroll, { passive: true });
    let lastWindowWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        const currentWidth = window.innerWidth;
        if (currentWidth !== lastWindowWidth) {
            lastWindowWidth = currentWidth;
            if (currentWidth <= 768) {
                applyPhysicsDrop();
            }
        }
    });
    checkSection2Scroll();

    // 6. FIXED RIGHT-SIDE SCROLL INDICATOR MENU LOGIC
    const sideDashes = document.querySelectorAll('.side-indicator-dash');

    if (sideDashes.length > 0) {
        // Click to smooth scroll to section
        sideDashes.forEach((dash) => {
            dash.addEventListener('click', () => {
                const targetSelector = dash.getAttribute('data-target');
                const targetEl = document.querySelector(targetSelector);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        // Realtime scroll highlighting for active section (Reverse checking handles sticky overlap for all 10 sections!)
        function updateActiveSideNav() {
            const sectionItems = [
                { selector: '#sec1-banner', dash: sideDashes[0] },
                { selector: '#sec2-hero', dash: sideDashes[1] },
                { selector: '#sec3-loichuc', dash: sideDashes[2] },
                { selector: '#sec4-countup', dash: sideDashes[3] },
                { selector: '#sec5-video', dash: sideDashes[4] },
                { selector: '#sec6-5a', dash: sideDashes[5] },
                { selector: '#sec7-5b', dash: sideDashes[6] },
                { selector: '#sec8-6', dash: sideDashes[7] },
                { selector: '#sec9-7', dash: sideDashes[8] },
                { selector: '#sec10-footer', dash: sideDashes[9] }
            ];

            const vh = window.innerHeight;
            let activeIndex = -1;

            // Iterate from LAST section to FIRST section to handle sticky overlap correctly!
            for (let i = sectionItems.length - 1; i >= 0; i--) {
                const item = sectionItems[i];
                if (!item.dash) continue;

                const el = document.querySelector(item.selector);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.top <= vh * 0.55 && rect.bottom >= vh * 0.15) {
                        activeIndex = i;
                        break;
                    }
                }
            }

            if (activeIndex !== -1) {
                sideDashes.forEach((d, idx) => {
                    if (idx === activeIndex) {
                        d.classList.add('active');
                    } else {
                        d.classList.remove('active');
                    }
                });
            } else if (window.scrollY < 200 && sideDashes[0]) {
                sideDashes.forEach((d) => d.classList.remove('active'));
                sideDashes[0].classList.add('active');
            }
        }

        window.addEventListener('scroll', updateActiveSideNav, { passive: true });
        updateActiveSideNav();
    }

    // ==========================================================================
    // PROXIMITY-BASED EYE TRACKING
    // ==========================================================================
    const PROXIMITY_THRESHOLD = 340;
    const MAX_PUPIL_SHIFT = 11.0;

    let mouseX = -9999;
    let mouseY = -9999;
    let ticking = false;

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (!ticking) {
            requestAnimationFrame(updateEyes);
            ticking = true;
        }
    });

    function updateEyes() {
        ticking = false;

        const activeRows = document.querySelectorAll('.bubbles-row.faces-active');
        if (activeRows.length === 0) return;

        activeRows.forEach((row) => {
            const rowBubbles = row.querySelectorAll('.bubble-item');
            rowBubbles.forEach((bubble) => {
                const rect = bubble.getBoundingClientRect();
                const bubbleCenterX = rect.left + rect.width / 2;
                const bubbleCenterY = rect.top + rect.height / 2;

                const deltaX = mouseX - bubbleCenterX;
                const deltaY = mouseY - bubbleCenterY;
                const distance = Math.hypot(deltaX, deltaY);

                const pupils = bubble.querySelectorAll('.pupil');

                if (distance < PROXIMITY_THRESHOLD) {
                    bubble.classList.add('active-near');

                    pupils.forEach((pupil) => {
                        const pupilRect = pupil.getBoundingClientRect();
                        const pupilCenterX = pupilRect.left + pupilRect.width / 2;
                        const pupilCenterY = pupilRect.top + pupilRect.height / 2;

                        const angle = Math.atan2(mouseY - pupilCenterY, mouseX - pupilCenterX);
                        const proximityFactor = Math.pow(1 - (distance / PROXIMITY_THRESHOLD), 0.7);
                        const shift = Math.min(MAX_PUPIL_SHIFT, proximityFactor * MAX_PUPIL_SHIFT);

                        const shiftX = Math.cos(angle) * shift;
                        const shiftY = Math.sin(angle) * shift;

                        pupil.style.transform = `translate(${shiftX.toFixed(2)}px, ${shiftY.toFixed(2)}px)`;
                    });
                } else {
                    bubble.classList.remove('active-near');
                    pupils.forEach((pupil) => {
                        pupil.style.transform = 'translate(0px, 0px)';
                    });
                }
            });
        });
    }

    // Dynamic Container Auto-Fit Engine for 100% Enclosed Fit
    const bubblesViewport = document.querySelector('.bubbles-viewport');

    function fitBubblesToContainer() {
        if (!bubblesContainer) return;
        const isMobilePortrait = window.innerWidth <= 600 || (window.innerWidth <= 768 && window.innerHeight > window.innerWidth);
        if (isMobilePortrait) {
            bubblesContainer.style.transform = '';
            bubblesContainer.style.transformOrigin = '';
        } else {
            const scale = getBubblesContainerScale();
            bubblesContainer.style.transform = `scale(${scale.toFixed(4)})`;
            bubblesContainer.style.transformOrigin = 'bottom center';
        }
    }

    window.addEventListener('resize', fitBubblesToContainer);
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            fitBubblesToContainer();
            if (typeof checkSection2Scroll === 'function') checkSection2Scroll();
        }, 150);
    });
    setTimeout(fitBubblesToContainer, 50);

    document.addEventListener('mouseleave', () => {
        bubbleItems.forEach((bubble) => {
            bubble.classList.remove('active-near');
            const pupils = bubble.querySelectorAll('.pupil');
            pupils.forEach((pupil) => {
                pupil.style.transform = 'translate(0px, 0px)';
            });
        });
    });

    // ==========================================================================
    // MOBILE TWITTER/X STYLE SMART AUTO-HIDE NAVBAR ON SCROLL
    // ==========================================================================
    function setupSmartNavbarScroll() {
        const navbar = document.querySelector('.floating-navbar');
        if (!navbar) return;

        let lastScrollY = window.scrollY || window.pageYOffset || 0;
        let ticking = false;

        function updateNavbar() {
            const currentScrollY = window.scrollY || window.pageYOffset || 0;
            const scrollDelta = currentScrollY - lastScrollY;

            // Always reveal near top of page
            if (currentScrollY <= 40) {
                navbar.classList.remove('nav-hidden');
            } 
            // Hide on Scroll Down
            else if (scrollDelta > 8 && currentScrollY > 80) {
                navbar.classList.add('nav-hidden');
            } 
            // Reveal on Scroll Up
            else if (scrollDelta < -5) {
                navbar.classList.remove('nav-hidden');
            }

            lastScrollY = currentScrollY;
            ticking = false;
        }

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(updateNavbar);
                ticking = true;
            }
        }, { passive: true });
    }

    setupSmartNavbarScroll();

    // ==========================================================================
    // DYNAMIC NAVBAR THEME SWITCH EXCLUSIVELY FOR VIDEO SECTION
    // ==========================================================================
    function setupVideoNavbarMode() {
        const navbar = document.querySelector('.floating-navbar');
        if (!navbar) return;

        const videoSection = document.querySelector('#sec5-video, .fullscreen-video-section, #section-video');
        
        // If on standalone video page without other sections, activate video mode
        if (document.body.classList.contains('page-video-only') || window.location.pathname.includes('section_video.html')) {
            navbar.classList.add('nav-video-mode');
            return;
        }

        if (!videoSection) return;

        function updateVideoNavbarTheme() {
            const navRect = navbar.getBoundingClientRect();
            const videoRect = videoSection.getBoundingClientRect();

            // Pixel-perfect collision: Check if navbar center point physically overlaps video section bounds
            const navCenter = navRect.top + (navRect.height / 2);
            const isNavbarOverlappingVideo = (navCenter >= videoRect.top) && (navCenter <= videoRect.bottom);

            if (isNavbarOverlappingVideo) {
                navbar.classList.add('nav-video-mode');
            } else {
                navbar.classList.remove('nav-video-mode');
            }
        }

        window.addEventListener('scroll', updateVideoNavbarTheme, { passive: true });
        updateVideoNavbarTheme();
    }

    setupVideoNavbarMode();

    // Fullscreen Video Play/Pause & Overlay Management
    document.querySelectorAll('.fullscreen-video-section').forEach(section => {
        const video = section.querySelector('video');
        const overlay = section.querySelector('.video-play-btn-overlay');
        if (!video) return;

        // Click on big play button overlay triggers video play/pause
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                e.stopPropagation();
                if (video.paused) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            });
        }

        // Sync overlay visibility with native HTML5 video play/pause events
        video.addEventListener('play', () => {
            if (overlay) overlay.classList.add('is-playing');
        });

        video.addEventListener('pause', () => {
            if (overlay) overlay.classList.remove('is-playing');
        });
    });
});
