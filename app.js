/**
 * ═══════════════════════════════ CORE LOGIC (FULL NAV EDITION) ═══════════════════════════════ 
 * Advanced navigation including support for "Monarquía Española" grouping.
 */

document.addEventListener('DOMContentLoaded', async () => {
    window.app = new NumismaticaApp();
    await window.app.init();
    if (typeof AdminPanel !== 'undefined') window.adminPanel = new AdminPanel(window.app);
});

class NumismaticaApp {
    constructor() {
        this.currentSection = 'home';
        this.favorites = JSON.parse(localStorage.getItem('numis_favs')) || [];
        this.searchQuery = '';
        this.activeFilters = { category: 'todos', period: 'todos', continent: null, metal: null };
        this.savedSection = localStorage.getItem('numis_current_section');
        this.savedCoinId = localStorage.getItem('numis_current_coin');
        
        // Gallery State
        this.currentCoinImages = [];
        this.currentImageIndex = 0;
    }

    async init() {
        // Fallback inicial con datos locales
        window.COINS_DATA = (typeof COINS_DATA !== 'undefined') ? COINS_DATA : [];
        if (typeof window.PERIODS_INFO === 'undefined') {
            window.PERIODS_INFO = (typeof PERIODS_INFO !== 'undefined') ? PERIODS_INFO : {
                "reyes-catolicos": { title: "Reyes Católicos" },
                "austrias": { title: "Austrias" },
                "borbones": { title: "Borbones" },
                "republica": { title: "República" },
                "extranjeras": { title: "Mundiales" },
                "bullion": { title: "Bullion" }
            };
        }

        // Setup UI immediately so navigation works even if data is loading
        this.setupNavigation();
        this.setupEventListeners();
        this.updateFavBadge();

        // Load data in background
        this.loadData().then(() => {
            if (this.savedSection) {
                if (this.savedSection === 'coin-detail' && this.savedCoinId) this.showCoinDetail(this.savedCoinId, false);
                else this.navigateTo(this.savedSection, false);
            } else { 
                this.navigateTo('home', false); 
            }
            // Replace initial state with current state to avoid about:blank back issue
            history.replaceState({ 
                section: this.currentSection, 
                filters: this.activeFilters,
                coinId: localStorage.getItem('numis_current_coin')
            }, "", "");
            
            // Re-render current section if it's dynamic
            if (this.currentSection === 'catalogo') this.renderCatalog();
            if (this.currentSection === 'favorites') this.renderFavorites();
        });
    }

    async loadData() {
        try {
            // First try Supabase if available
            if (typeof supabase !== 'undefined') {
                window.supabase = supabase.createClient("https://krzigbuwlckknmryavmh.supabase.co", "sb_publishable_SFh8-__5q4rZ74XtkjFUxA_sfuPCUKo");
                const { data, error } = await window.supabase.from('coins').select('*');
                
                if (!error && data && data.length > 0) {
                    window.COINS_DATA = data;
                    return; // Loaded from cloud
                }
            }
            
            // Fallback to data.json if Supabase fails or is empty
            const response = await fetch('data.json');
            if (response.ok) {
                const jsonData = await response.json();
                if (jsonData.coins) window.COINS_DATA = jsonData.coins;
                if (jsonData.periods) window.PERIODS_INFO = jsonData.periods;
            }
        } catch (e) { 
            console.error("Data load failed, using local data.js fallback:", e); 
            // window.COINS_DATA already has data from data.js if it was loaded
        }
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('[data-section]');
        navLinks.forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                const d = link.dataset;
                
                // Reset Filters
                this.activeFilters = { category: d.filter || 'todos', period: d.period || 'todos', continent: d.continent || null, metal: d.metal || null };
                
                this.navigateTo(d.section);
            };
        });
    }

    navigateTo(sectionId, saveHistory = true) {
        this.currentSection = sectionId;
        localStorage.setItem('numis_current_section', sectionId);
        
        // Update browser history
        if (saveHistory) {
            const state = { 
                section: sectionId, 
                filters: this.activeFilters,
                coinId: localStorage.getItem('numis_current_coin')
            };
            history.pushState(state, "", "");
        }

        // Update active class for nav links
        document.querySelectorAll('.nav-links a, .btn-favorites').forEach(l => {
            const isMatch = l.dataset.section === sectionId;
            l.classList.toggle('active', isMatch);
        });

        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        
        const activeEl = document.getElementById(`section-${sectionId}`);
        if (activeEl) activeEl.classList.add('active');

        if (sectionId === 'catalogo') this.renderCatalog();
        else if (sectionId === 'favorites') this.renderFavorites();
        
        document.getElementById('nav-links')?.classList.remove('active');
        document.getElementById('hamburger')?.classList.remove('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    renderFavorites() {
        const container = document.getElementById('favorites-grid');
        if (!container) return;

        const filtered = window.COINS_DATA.filter(c => this.favorites.includes(c.id));

        if (filtered.length === 0) {
            container.innerHTML = `<div class="empty-state"><h3>Aún no tienes favoritos seleccionados.</h3></div>`;
            return;
        }

        container.innerHTML = filtered.map(c => this.createCoinCard(c)).join('');
        this.attachCardEvents();
    }

    renderCatalog() {
        const container = document.getElementById('coins-grid');
        if (!container) return;

        let filtered = window.COINS_DATA;

        // Smart Category Filtering
        const cat = this.activeFilters.category;
        if (cat === 'monarquia') {
            filtered = filtered.filter(c => ['reyes-catolicos', 'austrias', 'borbones', 'republica'].includes(c.period));
        } else if (cat === 'bullion') {
            filtered = filtered.filter(c => c.period === 'bullion');
        } else if (cat === 'mundial') {
            filtered = filtered.filter(c => c.period === 'extranjeras');
        }

        // Specific Detailed Filtering
        if (this.activeFilters.period !== 'todos') filtered = filtered.filter(c => c.period === this.activeFilters.period);
        if (this.activeFilters.continent) filtered = filtered.filter(c => c.continent === this.activeFilters.continent);
        if (this.activeFilters.metal) filtered = filtered.filter(c => c.metal === this.activeFilters.metal);

        // Search
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)));
        }

        const countEl = document.getElementById('catalog-count');
        if (countEl) countEl.textContent = `${filtered.length} piezas encontradas`;

        if (filtered.length === 0) {
            container.innerHTML = `<div class="empty-state"><h3>Sin resultados en esta categoría.</h3></div>`;
            return;
        }

        container.innerHTML = filtered.map(c => this.createCoinCard(c)).join('');
        this.attachCardEvents();
    }

    createCoinCard(coin) {
        const isFav = this.favorites.includes(coin.id);
        const img1 = coin.images?.[0] || 'https://via.placeholder.com/400';
        const img2 = coin.images?.[1] || img1;
        return `
            <div class="coin-card" data-id="${coin.id}">
                <div class="coin-card-img-wrapper"><img src="${img1}" class="img-anverse"><img src="${img2}" class="img-reverse"><button class="btn-fav ${isFav ? 'active' : ''}" data-id="${coin.id}"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button></div>
                <div class="coin-card-content">
                    <span class="coin-card-period">${(coin.period || '').toUpperCase()}</span>
                    <h3 class="coin-card-title">${coin.name}</h3>
                    <div class="coin-card-footer">
                        <span class="coin-year">${coin.year > 0 ? coin.year : ''}</span>
                        <span class="coin-price">${this.formatCurrency(coin.price)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    attachCardEvents() {
        document.querySelectorAll('.coin-card-img-wrapper, .coin-card-title').forEach(el => {
            el.onclick = () => this.showCoinDetail(el.closest('.coin-card').dataset.id);
        });
        document.querySelectorAll('.btn-fav').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); this.toggleFavorite(btn.dataset.id, btn); };
        });
    }

    showCoinDetail(coinId, saveHistory = true) {
        const coin = window.COINS_DATA.find(c => c.id === coinId);
        if (!coin) return;
        localStorage.setItem('numis_current_coin', coinId);
        this.navigateTo('coin-detail', saveHistory);
        
        this.currentCoinImages = coin.images || [];
        this.currentImageIndex = 0;
        
        document.getElementById('coin-detail-name').textContent = coin.name;
        this.updateGalleryImage();
        
        document.getElementById('coin-price').textContent = this.formatCurrency(coin.price || 0);
        document.getElementById('coin-specs-grid').innerHTML = `
            <div class="spec-item"><span class="spec-label">Año</span><span class="spec-value">${coin.year}</span></div>
            <div class="spec-item"><span class="spec-label">Periodo</span><span class="spec-value">${PERIODS_INFO[coin.period]?.title || coin.period}</span></div>
            <div class="spec-item"><span class="spec-label">Metal</span><span class="spec-value">${coin.metal}</span></div>
            <div class="spec-item"><span class="spec-label">Ceca</span><span class="spec-value">${coin.mint}</span></div>
            <div class="spec-item"><span class="spec-label">Peso</span><span class="spec-value">${coin.weight}</span></div>
        `;
        this.initZoom();
    }

    changeGalleryImage(delta) {
        if (this.currentCoinImages.length <= 1) return;
        this.currentImageIndex = (this.currentImageIndex + delta + this.currentCoinImages.length) % this.currentCoinImages.length;
        this.updateGalleryImage();
    }

    initZoom() {
        const container = document.getElementById('magnifier-container'), 
              img = document.getElementById('gallery-main-img'), 
              lens = document.getElementById('magnifier-lens'), 
              result = document.getElementById('magnifier-result');
        if (!container || !img || !lens || !result) return;

        // Suavizamos el zoom aumentando el tamaño de la lente (menos aumento relativo)
        lens.style.width = '200px'; 
        lens.style.height = '200px';

        container.onmousemove = (e) => {
            lens.style.display = result.style.display = 'block';
            const rect = container.getBoundingClientRect();
            let x = e.clientX - rect.left - (lens.offsetWidth/2), y = e.clientY - rect.top - (lens.offsetHeight/2);
            if (x < 0) x = 0; if (x > rect.width - lens.offsetWidth) x = rect.width - lens.offsetWidth;
            if (y < 0) y = 0; if (y > rect.height - lens.offsetHeight) y = rect.height - lens.offsetHeight;
            lens.style.left = x + 'px'; lens.style.top = y + 'px';
            
            // Factor de aumento reducido (más suave al ojear la moneda)
            const zoomFactor = 1.8; 
            result.style.backgroundImage = `url('${img.src}')`;
            result.style.backgroundSize = (rect.width * zoomFactor) + 'px ' + (rect.height * zoomFactor) + 'px';
            
            // Calculamos la posición del fondo para que coincida con la lente
            const ratioX = (rect.width * zoomFactor - rect.width) / (rect.width - lens.offsetWidth);
            const ratioY = (rect.height * zoomFactor - rect.height) / (rect.height - lens.offsetHeight);
            result.style.backgroundPosition = `-${x * ratioX}px -${y * ratioY}px`;
        };
        container.onmouseleave = () => lens.style.display = result.style.display = 'none';
    }

    setupEventListeners() {
        document.getElementById('search-input')?.addEventListener('input', (e) => { this.searchQuery = e.target.value; this.renderCatalog(); });
        // Mobile Menu
        const ham = document.getElementById('hamburger'), links = document.getElementById('nav-links');
        if (ham && links) ham.onclick = () => { links.classList.toggle('active'); ham.classList.toggle('active'); };

        // Search Overlay
        const searchToggle = document.getElementById('search-toggle');
        const searchOverlay = document.getElementById('search-overlay');
        const searchClose = document.getElementById('search-close');
        
        if (searchToggle && searchOverlay) {
            searchToggle.onclick = () => searchOverlay.classList.add('active');
        }
        if (searchClose && searchOverlay) {
            searchClose.onclick = () => searchOverlay.classList.remove('active');
        }

        // Search Execution
        const searchBtn = document.getElementById('btn-search-exec');
        if (searchBtn) {
            searchBtn.onclick = () => {
                const input = document.getElementById('search-input');
                this.searchQuery = input ? input.value : '';
                this.navigateTo('catalogo');
                searchOverlay?.classList.remove('active');
            };
        }

        // Gallery Navigation
        document.getElementById('gallery-prev')?.addEventListener('click', () => this.changeGalleryImage(-1));
        document.getElementById('gallery-next')?.addEventListener('click', () => this.changeGalleryImage(1));
        document.getElementById('btn-fullscreen')?.addEventListener('click', () => this.openLightbox());
        
        // Lightbox Navigation
        document.getElementById('lightbox-close')?.addEventListener('click', () => this.closeLightbox());
        document.getElementById('lightbox-prev')?.addEventListener('click', () => this.changeGalleryImage(-1));
        document.getElementById('lightbox-next')?.addEventListener('click', () => this.changeGalleryImage(1));
        document.getElementById('lightbox')?.addEventListener('click', (e) => { if(e.target.id === 'lightbox') this.closeLightbox(); });

        // Keyboard Navigation
        document.addEventListener('keydown', (e) => {
            const isLightboxActive = document.getElementById('lightbox')?.classList.contains('active');
            if (this.currentSection === 'coin-detail' || isLightboxActive) {
                if (e.key === 'ArrowLeft') this.changeGalleryImage(-1);
                if (e.key === 'ArrowRight') this.changeGalleryImage(1);
                if (e.key === 'Escape') this.closeLightbox();
            }
        });

        this.setupContactForm();

        // Browser Back/Forward Support
        window.onpopstate = (e) => {
            if (e.state) {
                if (e.state.filters) this.activeFilters = e.state.filters;
                if (e.state.section === 'coin-detail' && e.state.coinId) {
                    this.showCoinDetail(e.state.coinId, false);
                } else {
                    this.navigateTo(e.state.section, false);
                }
            }
        };
    }

    openLightbox() {
        const lightbox = document.getElementById('lightbox');
        if (!lightbox) return;
        lightbox.classList.add('active');
        this.updateLightboxImage();
    }

    closeLightbox() {
        const lightbox = document.getElementById('lightbox');
        if (lightbox) lightbox.classList.remove('active');
    }

    updateLightboxImage() {
        const img = document.getElementById('lightbox-img');
        const caption = document.getElementById('lightbox-caption');
        if (!img) return;

        img.src = this.currentCoinImages[this.currentImageIndex] || '';
        if (caption) {
            caption.textContent = `${document.getElementById('coin-detail-name').textContent} — ${this.currentImageIndex === 0 ? 'Anverso' : 'Reverso'}`;
        }
    }

    updateGalleryImage() {
        const img = document.getElementById('gallery-main-img');
        const label = document.getElementById('gallery-label');
        if (!img) return;

        img.src = this.currentCoinImages[this.currentImageIndex] || '';
        if (label) {
            label.textContent = this.currentImageIndex === 0 ? 'Anverso' : 'Reverso';
        }

        // Controlar visibilidad de flechas según cantidad de imágenes
        const hasMultiple = this.currentCoinImages.length > 1;
        const prev = document.getElementById('gallery-prev');
        const next = document.getElementById('gallery-next');
        const lPrev = document.getElementById('lightbox-prev');
        const lNext = document.getElementById('lightbox-next');

        if (prev && next) prev.style.display = next.style.display = hasMultiple ? 'flex' : 'none';
        if (lPrev && lNext) lPrev.style.display = lNext.style.display = hasMultiple ? 'flex' : 'none';

        // Si el lightbox está abierto, lo actualizamos también
        if (document.getElementById('lightbox')?.classList.contains('active')) {
            this.updateLightboxImage();
        }
    }

    toggleFavorite(id, btn) {
        const idx = this.favorites.indexOf(id);
        if (idx === -1) { this.favorites.push(id); btn.classList.add('active'); }
        else { this.favorites.splice(idx, 1); btn.classList.remove('active'); }
        localStorage.setItem('numis_favs', JSON.stringify(this.favorites));
        this.updateFavBadge();
    }

    updateFavBadge() {
        const badge = document.getElementById('fav-badge');
        if (badge) { badge.textContent = this.favorites.length; badge.style.display = this.favorites.length > 0 ? 'flex' : 'none'; }
    }

    formatCurrency(v) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v); }

    setupContactForm() {
        const form = document.getElementById('contact-form');
        if (!form) return;

        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            const subject = encodeURIComponent(`Consulta — Numismática Alexander`);
            const body = encodeURIComponent(`Teléfono: ${data.phone}\nEmail: ${data.email}\n\nMensaje:\n${data.message}`);
            
            window.location.href = `mailto:Vreneli2024@gmail.com?subject=${subject}&body=${body}`;
            
            this.showToast('Abriendo gestor de correo...');
        };
    }

    showToast(msg) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
}
