/* ==========================================================================
   SECTION 4 - HÀNH TRÌNH CỦA SOCIOLOGIC (COUNT-UP ANIMATION & VIDEO SCRIPT)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. COUNT-UP ANIMATION (0 -> 10000+) WHEN SCROLLED INTO VIEW
    const statNumbers = document.querySelectorAll('.stat-number');
    const statsGrid = document.querySelector('.stats-grid');
    let hasAnimated = false;

    // Easing Function: Ease-Out Quad for smooth decelerating count-up
    function easeOutQuad(t) {
        return t * (2 - t);
    }

    function animateCountUp(el, target, duration = 2200) {
        const startTime = performance.now();

        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutQuad(progress);

            const currentValue = Math.floor(easedProgress * target);
            el.textContent = currentValue.toLocaleString('en-US');

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            } else {
                el.textContent = target.toLocaleString('en-US');
            }
        }

        requestAnimationFrame(updateCounter);
    }

    function triggerAllCounters() {
        if (hasAnimated) return;
        hasAnimated = true;

        statNumbers.forEach((el) => {
            const target = parseInt(el.getAttribute('data-target'), 10) || 10000;
            animateCountUp(el, target);
        });
    }

    // Use IntersectionObserver to trigger animation when scrolled into view
    if ('IntersectionObserver' in window && statsGrid) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    triggerAllCounters();
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.25 });

        observer.observe(statsGrid);
    } else {
        // Fallback for older browsers
        triggerAllCounters();
    }

    // 2. VIDEO PLAYER INTERACTION
    const videoContainer = document.getElementById('videoContainer');
    const playBtn = document.getElementById('playBtn');
    const journeyVideo = document.getElementById('journeyVideo');

    if (videoContainer) {
        videoContainer.addEventListener('click', () => {
            videoContainer.classList.add('playing');
            if (journeyVideo && journeyVideo.currentSrc) {
                journeyVideo.play().catch(() => {
                    console.log('Video play interrupted or placeholder source used.');
                });
            }
        });
    }

});
