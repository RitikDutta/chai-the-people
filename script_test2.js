console.log("Chai ThePeople Home Page Loaded");

const svgCanvas = document.getElementById('smokeCanvas');

function createSmokeCurve() {
    // Simple throttle to prevent double-firing on slower devices
    if (document.hidden) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add('smoke-path');

    // --- CURVE LOGIC ---
    // We draw narrower curves now for a more elegant look
    const startX = 50;
    const startY = 180;

    // Reduced random sway for smoother visual flow
    const endX = 50 + (Math.random() * 60 - 30); // Increased spread (was 30-15)
    const endY = 0;

    const cp1x = 50 + (Math.random() * 60 - 30); // Increased spread (was 40-20)
    const cp1y = 120;

    const cp2x = 50 + (Math.random() * 80 - 40); // Increased spread (was 60-30)
    const cp2y = 60;

    const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
    path.setAttribute("d", d);

    // Slightly randomized duration
    const duration = Math.random() * 1.5 + 3.5; // 3.5s to 5s
    path.style.animationDuration = `${duration}s`;

    svgCanvas.appendChild(path);

    // Cleanup
    setTimeout(() => {
        path.remove();
    }, duration * 1000);
}

// 300ms is a sweet spot for performance vs visual density
if (svgCanvas) {
    setInterval(createSmokeCurve, 300);
}

// Scroll Effects
document.addEventListener('DOMContentLoaded', () => {
    const teaCupContainer = document.querySelector('.tea-cup-container');
    const scrollTexts = document.querySelectorAll('.scroll-text');

    // Parallax & Transition for Tea Cup
    const placeholder = document.getElementById('tea-cup-placeholder');

    function updateTeaCupPosition() {
        const scrollY = window.scrollY;
        const placeholderRect = placeholder.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Default Parallax State (Section 1 & 2)
        // Cup is fixed at bottom: 0, left: 0
        // We apply a small parallax
        let targetX = 0;
        let targetY = scrollY * 0.15;
        let scale = 1;

        // Transition Logic
        // When the placeholder starts coming into view (or slightly before), we start moving the cup towards it.
        // We want the cup to land exactly on the placeholder when the placeholder is in its final position (centered vertically).

        // Calculate where the placeholder is relative to the viewport
        const placeholderTop = placeholderRect.top;
        const placeholderLeft = placeholderRect.left;

        // Define the "Transition Zone"
        // Start transitioning when placeholder is entering from the bottom
        // End transitioning when placeholder is near the center
        const startTransition = windowHeight; // When placeholder is at bottom of screen
        const endTransition = windowHeight / 2; // When placeholder is at center of screen

        if (placeholderTop < startTransition) {
            // Calculate progress (0 to 1)
            // 0 = at startTransition (bottom of screen)
            // 1 = at endTransition (center of screen)
            let progress = (startTransition - placeholderTop) / (startTransition - endTransition);

            // If we scroll PAST the docking point (progress > 1), we want the cup to STAY docked.
            // So we don't clamp to 1 if we want it to stay there relative to the viewport?
            // Wait, if it's fixed, and we set transform, it stays fixed on screen.
            // If we want it to scroll AWAY with Section 3, we need to change strategy.
            // But the user said "use the same teacup which get scrolled on the section 2, then it will get fixed and get on section 3".
            // This implies it lands on Section 3 and STAYS there (moves up with the page as you scroll past Section 3).

            // To make it move UP with the page (stick to Section 3), we need to switch from 'fixed' to 'absolute' or manually adjust transform to counteract scroll.
            // Or simpler: Once progress >= 1 (docked), we calculate the transform such that it matches the placeholder's screen position exactly.
            // Since placeholder moves up as we scroll, the cup should too.

            // If progress > 1, placeholderTop decreases (goes up).
            // We want cup to follow placeholderTop.
            // Our logic `finalTranslateY = placeholderTop - currentVisualY` ALREADY does this!
            // `placeholderTop` is dynamic based on scroll.
            // So if we just unclamp progress (or handle progress > 1 same as 1 but keep updating targetY with new placeholderTop), it should work.

            // Let's allow progress to go above 1, but keep the interpolation at "end state" logic, just updating coordinates.

            progress = Math.max(progress, 0); // Only clamp bottom

            let effectiveProgress = Math.min(progress, 1); // For scale and easing
            const ease = t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            const easedProgress = ease(effectiveProgress);

            // We need to know the cup's dimensions/margins dynamically for robustness
            const cupImg = document.querySelector('.tea-cup-img');
            const cupStyle = window.getComputedStyle(cupImg);
            const marginLeft = parseFloat(cupStyle.marginLeft);
            const marginBottom = parseFloat(cupStyle.marginBottom);
            const cupHeight = cupImg.offsetHeight;

            // Target translation relative to the fixed container's original position
            // The fixed container is at 0,0. The cup is at marginLeft, windowHeight - cupHeight - marginBottom.

            // We want the cup's top-left to be at placeholderLeft, placeholderTop.
            // Currently cup's top-left is at: marginLeft, windowHeight - cupHeight - marginBottom.

            // Recalculate these every frame
            const currentVisualX = marginLeft;
            const currentVisualY = windowHeight - cupHeight - marginBottom;

            const finalTranslateX = placeholderLeft - currentVisualX;
            const finalTranslateY = placeholderTop - currentVisualY; // placeholderTop changes with scroll!

            // Scale interpolation
            const startScale = 1;
            const endScale = 150 / 120; // 1.25

            // If progress >= 1, we are fully docked. We should just stick to finalTranslateY.
            // If progress < 1, we interpolate.

            if (progress >= 1) {
                targetX = finalTranslateX;
                targetY = finalTranslateY;
                scale = endScale;
            } else {
                targetX = 0 + (finalTranslateX - 0) * easedProgress; // startX is 0
                targetY = scrollY * 0.15 + (finalTranslateY - scrollY * 0.15) * easedProgress; // startY is scrollY * 0.15
                scale = startScale + (endScale - startScale) * easedProgress;
            }
        } else {
            // Reset if we scroll back up
            targetX = 0;
            targetY = scrollY * 0.15;
            scale = 1;
        }

        teaCupContainer.style.transform = `translate(${targetX}px, ${targetY}px) scale(${scale})`;
    }

    window.addEventListener('scroll', () => {
        window.requestAnimationFrame(updateTeaCupPosition);
    });

    // Initial call
    updateTeaCupPosition();

    // Intersection Observer for Text
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.2 // Trigger when 20% visible
    });

    scrollTexts.forEach(text => {
        observer.observe(text);
    });
});
