/* ==========================================================================
   SECTION 4 - HÀNH TRÌNH CỦA SOCIOLOGIC (PER-CARD SCROLL COUNT-UP)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    const section4El = document.getElementById('section-4') || document.querySelector('.section-4-wrapper') || document.getElementById('sec4-countup');
    const statCards = document.querySelectorAll('.stat-card');

    // Easing Function: Ease-Out Quad for smooth decelerating count-up
    function easeOutQuad(t) {
        return t * (2 - t);
    }

    function animateCountUp(el, target, duration = 2000) {
        const startTime = performance.now();

        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutQuad(progress);

            const currentValue = Math.floor(easedProgress * target);
            el.textContent = currentValue;

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            } else {
                el.textContent = target;
            }
        }

        requestAnimationFrame(updateCounter);
    }

    // Per-Card Scroll Observer: Starts count-up animation ONLY when each individual card scrolls into view!
    if ('IntersectionObserver' in window && statCards.length > 0) {
        const cardObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const card = entry.target;
                    const statNumber = card.querySelector('.stat-number');
                    if (statNumber && !statNumber.dataset.animated) {
                        statNumber.dataset.animated = 'true';
                        const target = parseInt(statNumber.getAttribute('data-target'), 10) || 1000;
                        statNumber.textContent = '0';
                        animateCountUp(statNumber, target, 2000);
                    }
                }
            });
        }, { threshold: 0.3 });

        statCards.forEach((card) => {
            cardObserver.observe(card);
        });
    } else {
        // Fallback if IntersectionObserver is not supported
        statCards.forEach((card) => {
            const statNumber = card.querySelector('.stat-number');
            if (statNumber) {
                const target = parseInt(statNumber.getAttribute('data-target'), 10) || 1000;
                animateCountUp(statNumber, target, 2000);
            }
        });
    }

    // Section 4 background glow observer
    if ('IntersectionObserver' in window && section4El) {
        const bgObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    section4El.classList.add('is-visible');
                } else {
                    section4El.classList.remove('is-visible');
                }
            });
        }, { threshold: 0.1 });

        bgObserver.observe(section4El);
    } else if (section4El) {
        section4El.classList.add('is-visible');
    }

    // Video Player Interaction
    const videoContainer = document.getElementById('videoContainer');
    const journeyVideo = document.getElementById('journeyVideo');

    if (videoContainer) {
        videoContainer.addEventListener('click', () => {
            videoContainer.classList.add('playing');
            if (journeyVideo && journeyVideo.currentSrc) {
                journeyVideo.play().catch(() => {});
            }
        });
    }
});
