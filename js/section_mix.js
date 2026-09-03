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

    // 1. ULTRA-REALISTIC NATURAL PHYSICS DROP ANIMATION
    function applyPhysicsDrop() {
        if (!bubblesContainer || allSection1Items.length === 0) return;
        bubblesContainer.classList.add('faces-active');
        bubblesContainer.classList.remove('state-converging');

        const physicsState = allSection1Items.map((el, index) => {
            const style = getComputedStyle(el);
            const baseXStr = style.getPropertyValue('--base-x').trim() || '0px';
            const baseX = parseFloat(baseXStr) || 0;
            const baseYStr = style.getPropertyValue('--base-y').trim() || '0px';
            const baseY = parseFloat(baseYStr) || 0;
            const rotFinalStr = style.getPropertyValue('--rot-final').trim() || '0deg';
            const rotFinal = parseFloat(rotFinalStr) || 0;

            const dropDistance = 320 + Math.sin(index * 1.5) * 50;
            const startY = baseY - dropDistance;

            el.style.transition = 'none';
            el.style.opacity = '0';
            el.style.transform = `translate3d(${baseX}px, ${startY}px, 0) rotate(${rotFinal + (index % 2 === 0 ? 18 : -18)}deg) scale(0.9)`;

            return {
                el,
                baseX,
                baseY,
                rotFinal,
                dropDistance,
                currentX: baseX,
                currentY: startY,
                velocityX: (Math.sin(index * 2) * 20),
                velocityY: 280 + (index % 4) * 90,
                scaleX: 0.9,
                scaleY: 1.1,
                rotOffset: (index % 2 === 0 ? 18 : -18),
                settled: false,
                bounceCount: 0
            };
        });

        const startTime = performance.now();

        function physicsStep(now) {
            let allSettled = true;

            physicsState.forEach((state, index) => {
                if (state.settled) return;
                allSettled = false;

                const dt = 0.016;

                state.velocityY += 1800 * dt;
                state.currentY += state.velocityY * dt;

                state.currentX += state.velocityX * dt;
                state.velocityX *= 0.96;

                state.rotOffset *= 0.92;
                state.scaleX += (1 - state.scaleX) * 0.15;
                state.scaleY += (1 - state.scaleY) * 0.15;

                if (state.currentY >= state.baseY) {
                    if (Math.abs(state.velocityY) > 80 && state.bounceCount < 3) {
                        state.currentY = state.baseY;
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

                const renderX = state.currentX;
                const renderY = state.currentY;
                const renderRot = state.rotFinal + state.rotOffset;
                state.el.style.transform = `translate3d(${renderX.toFixed(2)}px, ${renderY.toFixed(2)}px, 0) rotate(${renderRot.toFixed(2)}deg) scale(${state.scaleX.toFixed(3)}, ${state.scaleY.toFixed(3)})`;
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
            }
        }

        physicsAnimationFrame = requestAnimationFrame(physicsStep);
    }

    applyPhysicsDrop();

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

            el.style.position = 'absolute';
            el.style.zIndex = '5';
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.85';

            const startX = 40 + ((idx * (heroW - 160)) / Math.max(1, miniBubbleItems.length - 1));
            const startY = 30 + ((idx % 3) * 50);

            return {
                el,
                x: startX,
                y: startY,
                vx: (Math.sin(idx * 1.8) * 0.25) + (Math.random() - 0.5) * 0.15,
                vy: 3.5 + (idx % 3) * 0.8, // Natural gravity fall momentum down into Section 2
                rot: (idx * 45) % 360,
                vRot: (idx % 2 === 0 ? 0.08 : -0.08),
                phase: idx * 0.85,
                falling: true
            };
        });

        function floatStep() {
            if (currentState !== 'converged') return;

            const containerW = sec2Hero.clientWidth || window.innerWidth;
            const containerH = sec2Hero.clientHeight || window.innerHeight;

            spaceState.forEach((item) => {
                if (item.falling) {
                    item.y += item.vy;
                    item.vy *= 0.972;
                    if (item.vy <= 0.25) {
                        item.vy = 0.18 + Math.random() * 0.22;
                        item.falling = false; // Decelerated into zero-g space float!
                    }
                } else {
                    item.x += item.vx;
                    item.y += item.vy;
                    item.vx += Math.sin(Date.now() * 0.0004 + item.phase) * 0.008;
                }

                item.rot += item.vRot;

                if (item.x < 40) { item.x = 40; item.vx = Math.abs(item.vx) * 0.6 + 0.05; }
                if (item.x > containerW - 130) { 
                    item.x = containerW - 130; 
                    item.vx = -Math.abs(item.vx) * 0.6 - 0.05; 
                }
                if (item.y > containerH - 100) { 
                    item.y = containerH - 100; 
                    item.vy = -Math.abs(item.vy) * 0.6 - 0.05; 
                }
                if (item.y < 60) { 
                    item.y = 60; 
                    item.vy = Math.abs(item.vy) * 0.6 + 0.05; 
                }

                item.el.style.transition = 'none';
                item.el.style.opacity = '0.85';
                item.el.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0) rotate(${item.rot.toFixed(1)}deg)`;
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

        const targetEl = heroNumber2 || section1;
        if (!targetEl) return;

        const targetRect = targetEl.getBoundingClientRect();
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;

        letterBubbles.forEach((bubble) => {
            const bubbleRect = bubble.getBoundingClientRect();
            const bubbleCenterX = bubbleRect.left + bubbleRect.width / 2;
            const bubbleCenterY = bubbleRect.top + bubbleRect.height / 2;

            const deltaX = targetCenterX - bubbleCenterX;
            const deltaY = targetCenterY - bubbleCenterY;

            bubble.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease';
            bubble.style.transform = `translate(${deltaX.toFixed(1)}px, ${deltaY.toFixed(1)}px) scale(0.18)`;
            bubble.style.opacity = '0';
        });

        // Reveal graphic Number 2 / Logo smoothly!
        if (heroNumber2) {
            heroNumber2.classList.remove('vanish');
        }

        // Start slow space-like floating physics for 8 mini icons strictly inside Cụm 1!
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
            const targetBaseXStr = computedStyle.getPropertyValue('--base-x').trim() || '0px';
            const targetBaseYStr = computedStyle.getPropertyValue('--base-y').trim() || '0px';
            const targetRotStr = computedStyle.getPropertyValue('--rot-final').trim() || '0deg';

            bubble.style.position = '';
            bubble.style.left = '';
            bubble.style.top = '';
            bubble.style.zIndex = '';
            bubble.style.pointerEvents = '';
            bubble.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease';
            bubble.style.transform = `translate3d(${targetBaseXStr}, ${targetBaseYStr}, 0) rotate(${targetRotStr})`;
            bubble.style.opacity = '1';
        });

        setTimeout(() => {
            if (currentState === 'floor') {
                bubblesContainer.classList.add('faces-active');
                allSection1Items.forEach((bubble) => {
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
        // Container auto-fit scale limit removed as requested
        bubblesContainer.style.transform = 'scale(1)';
    }

    window.addEventListener('resize', fitBubblesToContainer);
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
});
