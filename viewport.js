// ФАЙЛ: js/ui/viewport.js

export class ViewportController {
  constructor(containerId, wrapperId) {
    this.container = document.getElementById(containerId);
    this.wrapper = document.getElementById(wrapperId);
    
    this.scale = 1;
    this.pointX = 0;
    this.pointY = 0;
    
    this.isPanning = false;
    this.startX = 0;
    this.startY = 0;
    this.rafId = null;
    this.animationId = null; 
    
    // Кеширование размеров контейнера для производительности 60 FPS
    this.contRect = this.container.getBoundingClientRect();
    this.resizeObserver = new ResizeObserver(() => {
      this.contRect = this.container.getBoundingClientRect();
    });
    this.resizeObserver.observe(this.container);
    
    this.initEvents();
  }

  initEvents() {
    const cancelAnimation = () => {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    };

    this.container.addEventListener('mousedown', (e) => {
      cancelAnimation();
      e.preventDefault();
      this.isPanning = true;
      this.startX = e.clientX - this.pointX;
      this.startY = e.clientY - this.pointY;
      this.container.style.cursor = 'grabbing';
    });

    // passive: true для мыши не нужен, т.к. mousemove не блокирует скролл, 
    // но мы используем requestAnimationFrame для синхронизации с монитором.
    window.addEventListener('mousemove', (e) => {
      if (!this.isPanning) return;
      this.pointX = e.clientX - this.startX;
      this.pointY = e.clientY - this.startY;
      this.scheduleTransform();
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.container.style.cursor = 'grab';
    });

    this.container.addEventListener('wheel', (e) => {
      cancelAnimation();
      e.preventDefault();
      
      const mouseX = e.clientX - this.contRect.left;
      const mouseY = e.clientY - this.contRect.top;

      const targetX = (mouseX - this.pointX) / this.scale;
      const targetY = (mouseY - this.pointY) / this.scale;

      const delta = e.wheelDelta ? e.wheelDelta : -e.deltaY;
      const zoomFactor = 1.1; 
      let newScale = delta > 0 ? this.scale * zoomFactor : this.scale / zoomFactor;
      newScale = Math.min(Math.max(0.15, newScale), 3); 

      this.pointX = mouseX - targetX * newScale;
      this.pointY = mouseY - targetY * newScale;
      this.scale = newScale;

      this.scheduleTransform();
    }, { passive: false });

    let initialDist = 0, initialScale = 1;
    let initialFocalX = 0, initialFocalY = 0;
    let initialPointX = 0, initialPointY = 0;

    this.container.addEventListener('touchstart', (e) => {
      cancelAnimation();
      if (e.touches.length === 1) {
        this.isPanning = true;
        this.startX = e.touches[0].clientX - this.pointX;
        this.startY = e.touches[0].clientY - this.pointY;
      } else if (e.touches.length === 2) {
        this.isPanning = false;
        const t1 = e.touches[0];
        const t2 = e.touches[1];

        initialDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        initialFocalX = ((t1.clientX + t2.clientX) / 2) - this.contRect.left;
        initialFocalY = ((t1.clientY + t2.clientY) / 2) - this.contRect.top;
        initialScale = this.scale;
        initialPointX = this.pointX;
        initialPointY = this.pointY;
      }
    }, { passive: false });

    this.container.addEventListener('touchmove', (e) => {
      e.preventDefault(); 
      if (this.isPanning && e.touches.length === 1) {
        this.pointX = e.touches[0].clientX - this.startX;
        this.pointY = e.touches[0].clientY - this.startY;
        this.scheduleTransform();
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];

        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const ratio = 1 + ((currentDist / initialDist) - 1) * 0.65; 
        let newScale = initialScale * ratio;
        newScale = Math.min(Math.max(0.15, newScale), 3);

        const currentFocalX = ((t1.clientX + t2.clientX) / 2) - this.contRect.left;
        const currentFocalY = ((t1.clientY + t2.clientY) / 2) - this.contRect.top;

        const imageFocalX = (initialFocalX - initialPointX) / initialScale;
        const imageFocalY = (initialFocalY - initialPointY) / initialScale;

        this.pointX = currentFocalX - imageFocalX * newScale;
        this.pointY = currentFocalY - imageFocalY * newScale;
        this.scale = newScale;

        this.scheduleTransform();
      }
    }, { passive: false });

    window.addEventListener('touchend', () => { this.isPanning = false; });

    document.getElementById('btn-zoom-in').addEventListener('click', () => { cancelAnimation(); this.zoomCenter(1.25); });
    document.getElementById('btn-zoom-out').addEventListener('click', () => { cancelAnimation(); this.zoomCenter(1 / 1.25); });
    document.getElementById('btn-zoom-fit').addEventListener('click', () => { cancelAnimation(); this.resetView(); });
  }

  flyToElement(element) {
    if (!element) return;
    if (this.animationId) cancelAnimationFrame(this.animationId);

    const rect = element.getBoundingClientRect();
    const wrapRect = this.wrapper.getBoundingClientRect();

    const targetCenterX = ((rect.left - wrapRect.left) / this.scale) + ((rect.width / this.scale) / 2);
    const targetCenterY = ((rect.top - wrapRect.top) / this.scale) + ((rect.height / this.scale) / 2);

    const targetScale = this.scale;
    const targetX = (this.contRect.width / 2) - (targetCenterX * targetScale);
    const targetY = (this.contRect.height / 2) - (targetCenterY * targetScale);

    const startX = this.pointX;
    const startY = this.pointY;

    const duration = 700;
    const startTime = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeOutCubic(progress);

      this.pointX = startX + (targetX - startX) * ease;
      this.pointY = startY + (targetY - startY) * ease;

      this.scheduleTransform();

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  zoomCenter(factor) {
    const cx = this.contRect.width / 2;
    const cy = this.contRect.height / 2;
    
    const targetX = (cx - this.pointX) / this.scale;
    const targetY = (cy - this.pointY) / this.scale;
    
    const newScale = Math.min(Math.max(0.15, this.scale * factor), 3);
    
    this.pointX = cx - targetX * newScale;
    this.pointY = cy - targetY * newScale;
    this.scale = newScale;
    
    this.scheduleTransform();
  }

  scheduleTransform() {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.wrapper.style.transform = `translate3d(${this.pointX}px, ${this.pointY}px, 0) scale(${this.scale})`;
      this.rafId = null;
    });
  }

  resetView() {
    this.scale = 1;
    this.pointX = (this.contRect.width - this.wrapper.clientWidth) / 2;
    this.pointY = 40;
    this.scheduleTransform();
  }
}