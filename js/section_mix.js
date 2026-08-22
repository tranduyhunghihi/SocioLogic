/* ==========================================================================
   SECTION MIX - EXACT CONVERGING ORIGIN BURST SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const bubblesContainer = document.getElementById('bubblesContainer');
    const heroNumber2 = document.getElementById('heroNumber2');
    const bubbleItems = document.querySelectorAll('.bubble-item');
    const section2 = document.getElementById('section2');

    // DYNAMICALLY CALCULATE INDIVIDUAL BUBBLE VECTORS CONVERGING AT number2.png CENTER
    function updateOriginPositions() {
        if (!bubblesContainer.classList.contains('state-num-2')) return;
        if (!heroNumber2) return;

        const num2Rect = heroNumber2.getBoundingClientRect();
        const num2CenterX = num2Rect.left + num2Rect.width / 2;
        const num2CenterY = num2Rect.top + num2Rect.height / 2;

        bubbleItems.forEach((bubble) => {
            const bubbleRect = bubble.getBoundingClientRect();
            const bubbleCenterX = bubbleRect.left + bubbleRect.width / 2;
            const bubbleCenterY = bubbleRect.top + bubbleRect.height / 2;

            // Individual delta from each bubble's resting position to number2.png center
            const deltaX = num2CenterX - bubbleCenterX;
            const deltaY = num2CenterY - bubbleCenterY;

            bubble.style.transform = `translate(${deltaX.toFixed(1)}px, ${deltaY.toFixed(1)}px) scale(0.25)`;
            bubble.style.opacity = '0';
        });
    }

    // SCROLL OBSERVER FOR PUSH OUT ANIMATION SEQUENCE
    const observerOptions = {
        root: null,
        rootMargin: '-10% 0px -15% 0px',
        threshold: 0.15
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                // USER SCROLLED DOWN INTO SECTION 2!
                
                // Step 1: Fade out & vanish number2.png image asset in Section 1
                if (heroNumber2) {
                    heroNumber2.classList.add('vanish');
                }

                // Step 2: Clear inline origin transforms so CSS transitions take over smoothly
                bubbleItems.forEach((bubble) => {
                    bubble.style.transform = '';
                    bubble.style.opacity = '';
                });

                // Step 3: Push out 10 individual speech bubbles from number2.png position to Section 2!
                bubblesContainer.classList.remove('state-num-2');
                bubblesContainer.classList.add('state-banner-row');

                // Step 4: ONLY AFTER landing at final positions, add faces-active to show eyes & mouths!
                setTimeout(() => {
                    bubblesContainer.classList.add('faces-active');
                }, 900); // 900ms delay matches flight completion!

            } else {
                // USER SCROLLED BACK UP TO SECTION 1!
                const rect = section2.getBoundingClientRect();
                if (rect.top > window.innerHeight * 0.4) {
                    if (heroNumber2) {
                        heroNumber2.classList.remove('vanish');
                    }
                    bubblesContainer.classList.remove('faces-active');
                    bubblesContainer.classList.remove('state-banner-row');
                    bubblesContainer.classList.add('state-num-2');
                    
                    // Recalculate dynamic origin positions at number2.png
                    updateOriginPositions();
                }
            }
        });
    }, observerOptions);

    if (section2) {
        sectionObserver.observe(section2);
    }

    // Initial origin calculation (delay slightly for DOM layout render)
    setTimeout(updateOriginPositions, 100);
    window.addEventListener('resize', updateOriginPositions);

    // PROXIMITY-BASED EYE TRACKING
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

        // ONLY track eyes if faces are active!
        if (!bubblesContainer.classList.contains('faces-active')) return;

        bubbleItems.forEach((bubble) => {
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
    }

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
