/* ==========================================================================
   SECTION 2 - INTERACTIVE PROXIMITY EYE TRACKING SCRIPT (SIGNIFICANTLY LARGER EYES)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const bubbleItems = document.querySelectorAll('.bubble-item');
    const PROXIMITY_THRESHOLD = 340; // Proximity threshold in pixels
    const MAX_PUPIL_SHIFT = 11.0;    // Maximum pupil shift distance in pixels (Scaled for larger 20px pupils)

    let mouseX = -9999;
    let mouseY = -9999;
    let ticking = false;

    // Track mouse position globally
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

        bubbleItems.forEach((bubble) => {
            const rect = bubble.getBoundingClientRect();
            const bubbleCenterX = rect.left + rect.width / 2;
            const bubbleCenterY = rect.top + rect.height / 2;

            // Calculate Euclidean distance from mouse to bubble center
            const deltaX = mouseX - bubbleCenterX;
            const deltaY = mouseY - bubbleCenterY;
            const distance = Math.hypot(deltaX, deltaY);

            const pupils = bubble.querySelectorAll('.pupil');

            // ONLY activate eyes if mouse is within proximity threshold!
            if (distance < PROXIMITY_THRESHOLD) {
                bubble.classList.add('active-near');

                pupils.forEach((pupil) => {
                    const pupilRect = pupil.getBoundingClientRect();
                    const pupilCenterX = pupilRect.left + pupilRect.width / 2;
                    const pupilCenterY = pupilRect.top + pupilRect.height / 2;

                    // Calculate angle towards mouse
                    const angle = Math.atan2(mouseY - pupilCenterY, mouseX - pupilCenterX);
                    
                    // Intensity increases as mouse gets closer to bubble
                    const proximityFactor = Math.pow(1 - (distance / PROXIMITY_THRESHOLD), 0.7);
                    const shift = Math.min(MAX_PUPIL_SHIFT, proximityFactor * MAX_PUPIL_SHIFT);

                    const shiftX = Math.cos(angle) * shift;
                    const shiftY = Math.sin(angle) * shift;

                    pupil.style.transform = `translate(${shiftX.toFixed(2)}px, ${shiftY.toFixed(2)}px)`;
                });
            } else {
                // Mouse is too far away: eyes stay calm and centered
                bubble.classList.remove('active-near');
                pupils.forEach((pupil) => {
                    pupil.style.transform = 'translate(0px, 0px)';
                });
            }
        });
    }

    // Reset pupils if mouse leaves window
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
