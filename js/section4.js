/* ==========================================================================
   SECTION 4 - HÀNH TRÌNH CỦA SOCIOLOGIC (COUNT-UP ANIMATION & VIDEO SCRIPT)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. STRICT VIEWPORT ANIMATION - COUNT-UP RUNS EXACTLY ONCE WHEN ENTERING VIEWPORT
    const statsGrid = document.querySelector('.stats-grid');
    const statNumbers = document.querySelectorAll('.stat-number');
    const section4El = document.getElementById('section-4') || document.querySelector('.section-4-wrapper') || document.getElementById('sec4-countup');

    let hasAnimatedNumbers = false;

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

    function triggerAllCountersOnce() {
        if (hasAnimatedNumbers) return;
        hasAnimatedNumbers = true;

        statNumbers.forEach((el) => {
            const target = parseInt(el.getAttribute('data-target'), 10) || 1000;
            el.textContent = '0';
            animateCountUp(el, target, 2200);
        });
    }

    // IntersectionObserver: Controls background radial expansion/contraction and 1-time count-up
    const targetObserved = statsGrid || section4El;

    if ('IntersectionObserver' in window && targetObserved) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    // Smoothly Bung/Expand Background Outwards
                    if (section4El) section4El.classList.add('is-visible');

                    // Stats Count-Up RUNS EXACTLY ONCE PERMANENTLY!
                    if (!hasAnimatedNumbers) {
                        triggerAllCountersOnce();
                    }
                } else {
                    // Smoothly Contract/Shrink Background Back Down into Center Top Point
                    if (section4El) section4El.classList.remove('is-visible');
                }
            });
        }, { threshold: 0.15 });

        observer.observe(targetObserved);
    } else {
        if (section4El) section4El.classList.add('is-visible');
        triggerAllCountersOnce();
    }

    // 2. VIDEO PLAYER INTERACTION
    const videoContainer = document.getElementById('videoContainer');
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
