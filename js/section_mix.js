/* ==========================================================================
   SECTION MIX - BIDIRECTIONAL CONVERGING & PUSH OUT SCROLL ANIMATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const bubblesContainer = document.getElementById('bubblesContainer');
    const heroNumber2 = document.getElementById('heroNumber2');
    const bubbleItems = document.querySelectorAll('.bubble-item');
    const section2 = document.getElementById('section2');

    let currentState = 'num-2'; // 'num-2' or 'banner-row'

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

            bubble.style.transform = `translate(${deltaX.toFixed(1)}px, ${deltaY.toFixed(1)}px) scale(0.2)`;
            bubble.style.opacity = '0';
        });
    }

    // FORWARD ANIMATION: 1 -> 2 (Bung ra từ số 2 thành dải chữ SocioLogic)
    function flyOutToBannerRow() {
        if (currentState === 'banner-row') return;
        currentState = 'banner-row';

        // Step 1: Fade out & vanish number2.png image asset in Section 1
        if (heroNumber2) {
            heroNumber2.classList.add('vanish');
        }

        // Step 2: Clear inline origin transforms so CSS flight transitions take over smoothly
        bubbleItems.forEach((bubble) => {
            bubble.style.transition = '';
            bubble.style.transform = '';
            bubble.style.opacity = '';
        });

        // Step 3: Push out 10 individual speech bubbles from number2.png position to Section 2!
        bubblesContainer.classList.remove('state-num-2');
        bubblesContainer.classList.add('state-banner-row');

        // Step 4: ONLY AFTER landing at final positions, add faces-active to show eyes & mouths!
        setTimeout(() => {
            if (currentState === 'banner-row') {
                bubblesContainer.classList.add('faces-active');
            }
        }, 850);
    }

    // REVERSE ANIMATION: 2 -> 1 (Gom dải chữ SocioLogic bay ngược lại vị trí ban đầu thành số 2)
    function flyBackToNumber2Center() {
        if (currentState === 'num-2') return;
        currentState = 'num-2';

        if (!heroNumber2) return;

        // Step 1: Hide active facial expressions
        bubblesContainer.classList.remove('faces-active');

        const num2Rect = heroNumber2.getBoundingClientRect();
        const num2CenterX = num2Rect.left + num2Rect.width / 2;
        const num2CenterY = num2Rect.top + num2Rect.height / 2;

        // Step 2: Animate each bubble flying back to number2.png center while shrinking
        bubbleItems.forEach((bubble) => {
            const bubbleRect = bubble.getBoundingClientRect();
            const bubbleCenterX = bubbleRect.left + bubbleRect.width / 2;
            const bubbleCenterY = bubbleRect.top + bubbleRect.height / 2;

            const deltaX = num2CenterX - bubbleCenterX;
            const deltaY = num2CenterY - bubbleCenterY;

            bubble.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease';
            bubble.style.transform = `translate(${deltaX.toFixed(1)}px, ${deltaY.toFixed(1)}px) scale(0.2)`;
            bubble.style.opacity = '0';
        });

        // Step 3: Re-appear number2.png graphic image right as bubbles merge back into center
        setTimeout(() => {
            if (currentState === 'num-2') {
                if (heroNumber2) {
                    heroNumber2.classList.remove('vanish');
                }
                bubblesContainer.classList.remove('state-banner-row');
                bubblesContainer.classList.add('state-num-2');
            }
        }, 550);
    }

    // SCROLL OBSERVER FOR BIDIRECTIONAL ANIMATION SEQUENCE
    const observerOptions = {
        root: null,
        rootMargin: '-10% 0px -15% 0px',
        threshold: 0.15
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                // SCROLL DOWN (1 -> 2): Bung từ số 2 thành dải chữ
                flyOutToBannerRow();
            } else {
                // SCROLL UP (2 -> 1): Gom các chữ gom lại vị trí ban đầu thành số 2
                const rect = section2.getBoundingClientRect();
                if (rect.top > window.innerHeight * 0.3) {
                    flyBackToNumber2Center();
                }
            }
        });
    }, observerOptions);

    if (section2) {
        sectionObserver.observe(section2);
    }

    // Initial origin calculation
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
