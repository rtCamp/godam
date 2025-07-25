export function initSidebar() {
    initImageGallery();
    addCloseSidebarListener();
}

function addCloseSidebarListener() {
    const modalContainer = document.querySelector('.godam-product-modal-container.open');
    const sidebarClose = modalContainer.querySelector('.godam-sidebar-close');
    sidebarClose.addEventListener('click', () => {
        const sidebarElement = modalContainer.querySelector('.godam-product-sidebar');
        sidebarElement.classList.add('close');
        modalContainer?.querySelector('.godam-product-modal-content')?.classList?.add('no-sidebar');
        modalContainer?.querySelector('.godam-product-modal-content')?.classList?.remove('sidebar');
    });
}

function initImageGallery() {
    // Find the open modal container
    const modalContainer = document.querySelector('.godam-product-modal-container.open');
    
    if (!modalContainer) {
        console.log('No open modal container found');
        return;
    }

    // Get gallery elements
    const mainImage = modalContainer.querySelector('.godam-main-image img');
    const thumbnails = modalContainer.querySelectorAll('.godam-thumbnail-item');
    const thumbnailImages = modalContainer.querySelectorAll('.godam-thumbnail-image');
    const thumbnailTrack = modalContainer.querySelector('.godam-thumbnail-track');
    const prevBtn = modalContainer.querySelector('.godam-thumbnail-prev');
    const nextBtn = modalContainer.querySelector('.godam-thumbnail-next');

    if (!mainImage || thumbnails.length === 0) {
        console.log('Gallery elements not found');
        return;
    }

    // Initialize gallery
    function initGallery() {
        // Add click event listeners to thumbnails
        thumbnails.forEach((thumbnail, index) => {
            thumbnail.addEventListener('click', () => {
                showImage(index);
            });

            // Add keyboard support
            thumbnail.setAttribute('tabindex', '0');
            thumbnail.setAttribute('role', 'button');
            thumbnail.setAttribute('aria-label', `View image ${index + 1}`);
            
            thumbnail.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    showImage(index);
                }
            });
        });

        // Initialize horizontal scroll navigation
        initHorizontalScroll();
        
        // Add touch/swipe support for mobile
        initTouchSupport();
        
        // Add mouse wheel support
        initMouseWheelSupport();
    }

    function showImage(index) {
        // Remove active class from all thumbnails
        thumbnails.forEach(thumb => {
            thumb.classList.remove('active');
        });

        // Add active class to clicked thumbnail
        if (thumbnails[index]) {
            thumbnails[index].classList.add('active');
        }

        // Update main image
        if (thumbnailImages[index]) {
            mainImage.src = thumbnailImages[index].src;
            mainImage.alt = thumbnailImages[index].alt;
        }

        // Add smooth transition effect
        mainImage.style.opacity = '0';
        setTimeout(() => {
            mainImage.style.opacity = '1';
        }, 150);
    }

    function initHorizontalScroll() {
        const scrollStep = 120; // pixels to scroll per click (thumbnail width + gap)
        let currentScrollLeft = 0;
        const maxScrollLeft = thumbnailTrack.scrollWidth - thumbnailTrack.clientWidth;

        function updateNavigationButtons() {
            if (prevBtn) {
                prevBtn.disabled = currentScrollLeft <= 0;
                prevBtn.style.opacity = currentScrollLeft <= 0 ? '0.3' : '1';
            }
            if (nextBtn) {
                nextBtn.disabled = currentScrollLeft >= maxScrollLeft;
                nextBtn.style.opacity = currentScrollLeft >= maxScrollLeft ? '0.3' : '1';
            }
        }

        function scrollThumbnails(direction) {
            const newScrollLeft = currentScrollLeft + (direction * scrollStep);
            
            // Clamp scroll position
            currentScrollLeft = Math.max(0, Math.min(newScrollLeft, maxScrollLeft));
            
            thumbnailTrack.scrollTo({
                left: currentScrollLeft,
                behavior: 'smooth'
            });
            
            updateNavigationButtons();
        }

        // Add click event listeners to navigation buttons
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                scrollThumbnails(-1);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                scrollThumbnails(1);
            });
        }

        // Update scroll position on manual scroll
        thumbnailTrack.addEventListener('scroll', () => {
            currentScrollLeft = thumbnailTrack.scrollLeft;
            updateNavigationButtons();
        });

        // Initialize button states
        updateNavigationButtons();
    }

    function initMouseWheelSupport() {
        thumbnailTrack.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const scrollAmount = e.deltaY > 0 ? 1 : -1;
            const scrollStep = 60; // Smaller step for wheel scrolling
            
            const currentScrollLeft = thumbnailTrack.scrollLeft;
            const newScrollLeft = currentScrollLeft + (scrollAmount * scrollStep);
            const maxScrollLeft = thumbnailTrack.scrollWidth - thumbnailTrack.clientWidth;
            
            thumbnailTrack.scrollTo({
                left: Math.max(0, Math.min(newScrollLeft, maxScrollLeft)),
                behavior: 'smooth'
            });
        });
    }

    function initTouchSupport() {
        let startX = 0;
        let endX = 0;
        const mainImageContainer = modalContainer.querySelector('.godam-main-image');

        if (!mainImageContainer) return;

        mainImageContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        });

        mainImageContainer.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            handleSwipe();
        });

        function handleSwipe() {
            const swipeThreshold = 50;
            const diff = startX - endX;
            const currentActiveIndex = Array.from(thumbnails).findIndex(thumb => 
                thumb.classList.contains('active')
            );

            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0 && currentActiveIndex < thumbnails.length - 1) {
                    // Swipe left - next image
                    showImage(currentActiveIndex + 1);
                } else if (diff < 0 && currentActiveIndex > 0) {
                    // Swipe right - previous image
                    showImage(currentActiveIndex - 1);
                }
            }
        }
    }

    // Initialize the gallery
    initGallery();


}