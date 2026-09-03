/* ==========================================================================
   SECTION 6 - PROXIMITY-BASED EYE TRACKING & IDLE SVG EYE SWITCHER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const sec6Wrapper = document.querySelector('.section-6-wrapper');
    if (!sec6Wrapper) return;

    const PROXIMITY_THRESHOLD = 400;
    const MAX_PUPIL_SHIFT = 6.5;

    let mouseX = -9999;
    let mouseY = -9999;
    let ticking = false;

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (!ticking) {
            requestAnimationFrame(updateSection6Eyes);
            ticking = true;
        }
    });

    function updateSection6Eyes() {
        ticking = false;

        const bubbleWrappers = sec6Wrapper.querySelectorAll('.sec6-bubble-wrapper');
        bubbleWrappers.forEach((bubble) => {
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
        const bubbleWrappers = sec6Wrapper.querySelectorAll('.sec6-bubble-wrapper');
        bubbleWrappers.forEach((bubble) => {
            bubble.classList.remove('active-near');
            const pupils = bubble.querySelectorAll('.pupil');
            pupils.forEach((pupil) => {
                pupil.style.transform = 'translate(0px, 0px)';
            });
        });
    });
});
