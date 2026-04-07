/**
 * ═══════════════════════════════ CORE LOGIC (CLOUD ENHANCED) ═══════════════════════════════ 
 */

document.addEventListener('DOMContentLoaded', async () => {
    window.app = new NumismaticaApp();
    await window.app.init();
    
    // Initialize Admin Panel
    if (typeof AdminPanel !== 'undefined') {
        window.adminPanel = new AdminPanel(window.app);
    }
});

class NumismaticaApp {
    constructor() {
        this.currentSection = 'inicio';
        this.favorites = JSON.parse(localStorage.getItem('numis_favs')) || [];
        this.searchQuery = '';
        this.currentFilter = 'todos';
        
        // State persistence
        this.savedSection = localStorage.getItem('numis_current_section');
        this.savedCoinId = localStorage.getItem('numis_current_coin');
    }

    async init() {
        // Supabase configuration
        const SB_URL = "https://krzigbuwlckknmryavmh.supabase.co";
        const SB_KEY = "sb_publishable_SFh8-__5q4rZ74XtkjFUxA_sfuPCUKo";
        
        try {
            window.supabase = supabase.createClient(SB_URL, SB_KEY);
            console.log("☁️ Conectando a Supabase...");

            const { data: coins, error } = await window.supabase
                .from('coins')
                .select('*');
            
            if (error) throw error;
            
            if (coins && coins.length > 0) {
                window.COINS_DATA = coins;
                console.log(`📦 Datos cargados de la nube: ${coins.length} monedas.`);
            } else {
                console.warn("⚠️ Nube vacía. Usando datos de respaldo (data.js).");
                // window.COINS_DATA already populated by data.js script tag
            }

            // Ensure PERIODS_INFO exists
            if (typeof PERIODS_INFO === 'undefined') {
                window.PERIODS_INFO = {
                    "reyes-catolicos": { title: "Reyes Católicos", start: 1474, end: 1516, rulers: ["Fernando", "Isabel"] },
                    "austrias": { title: "Dinastía de los Austrias", start: 1516, end: 1700, rulers: ["Carlos I", "Felipe II", "Felipe III", "Felipe IV", "Carlos II"] },
                    "borbones": { title: "Casa de Borbón", start: 1700, end: 1931, rulers: ["Felipe V", "Carlos III", "Alfonso XII", "Alfonso XIII"] },
                    "republica": { title: "República", start: 1931, end: 1939, rulers: ["I República", "II República"] },
                    "extranjeras": { title: "Monedas Extranjeras", start: -500, end: 2024, rulers: ["Varios"] },
                    "bullion": { title: "Inversión Bullion", start: 2000, end: 2025, rulers: ["Metales Preciosos"] }
                };
            }
        } catch (error) {
            console.error('❌ Error Supabase:', error);
            this.showToast('⚠️ Usando modo local (sin conexión nube)');
        }

        this.setupNavigation();
        this.setupEventListeners();
        this.updateFavBadge();
        this.setupContactForm();

        // Restore state or show Home
        if (this.savedSection) {
            if (this.savedSection === 'coin-detail' && this.savedCoinId) {
                this.showCoinDetail(this.savedCoinId);
            } else {
                this.navigateTo(this.savedSection);
            }
        } else {
            this.navigateTo('inicio');
        }
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-links a, .hero-cta button, .footer-links a');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const section = e.target.closest('a, button').dataset.section;
                if (section) {
                    e.preventDefault();
                    this.navigateTo(section);
                }
            });
        });
    }

    navigateTo(sectionId) {
        this.currentSection = sectionId;
        localStorage.setItem('numis_current_section', sectionId);
        
        // Update Active Link UI
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionId);
        });

        // Toggle visibility of all major views
        const views = ['inicio', 'catalogo', 'favoritos', 'contacto', 'coin-detail'];
        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });

        const activeEl = document.getElementById(sectionId);
        if (activeEl) {
            activeEl.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Section-specific logic
        if (sectionId === 'catalogo') {
            this.renderCatalog();
        } else if (sectionId === 'favoritos') {
            this.renderFavorites();
        }
    }

    renderCatalog() {
        const container = document.getElementById('catalog-grid');
        if (!container) return;

        let filtered = window.COINS_DATA;

        // Apply filters
        if (this.currentFilter !== 'todos') {
            filtered = filtered.filter(coin => coin.period === this.currentFilter);
        }

        // Apply Search
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(coin => 
                coin.name.toLowerCase().includes(q) || 
                coin.description.toLowerCase().includes(q) ||
                coin.year.toString().includes(q)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No se encontraron piezas</h3>
                    <p>Intenta ajustar los filtros de búsqueda.</p>
                </div>`;
            return;
        }

        container.innerHTML = filtered.map(coin => this.createCoinCard(coin)).join('');
        this.attachCardEvents();
    }

    createCoinCard(coin) {
        const isFav = this.favorites.includes(coin.id);
        const firstImg = coin.images && coin.images.length > 0 ? coin.images[0] : 'https://via.placeholder.com/400';
        
        return `
            <div class="coin-card" data-id="${coin.id}">
                <div class="coin-card-img-wrapper">
                    <img src="${firstImg}" alt="${coin.name}" loading="lazy">
                    <button class="btn-fav ${isFav ? 'active' : ''}" data-id="${coin.id}" title="Favoritos">
                        <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </button>
                    ${coin.featured ? '<span class="coin-badge-featured">Joyas</span>' : ''}
                </div>
                <div class="coin-card-content">
                    <span class="coin-card-period">${coin.period.toUpperCase()}</span>
                    <h3 class="coin-card-title">${coin.name}</h3>
                    <div class="coin-card-footer">
                        <span class="coin-card-year">${coin.year}</span>
                        <span class="coin-card-price">${this.formatCurrency(coin.price)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    attachCardEvents() {
        // Detail View Click
        document.querySelectorAll('.coin-card-img-wrapper, .coin-card-content').forEach(el => {
            el.onclick = (e) => {
                if (e.target.closest('.btn-fav')) return;
                const id = el.closest('.coin-card').dataset.id;
                this.showCoinDetail(id);
            };
        });

        // Favorite Toggle Click
        document.querySelectorAll('.btn-fav').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.toggleFavorite(id, btn);
            };
        });
    }

    showCoinDetail(coinId) {
        const coin = window.COINS_DATA.find(c => c.id === coinId);
        if (!coin) return;

        this.currentSection = 'coin-detail';
        localStorage.setItem('numis_current_section', 'coin-detail');
        localStorage.setItem('numis_current_coin', coinId);
        
        // Setup detail view UI
        this.navigateTo('coin-detail');
        
        const detailContainer = document.getElementById('coin-detail');
        detailContainer.innerHTML = this.createDetailTemplate(coin);
        
        this.initGallery(coin.images);
        this.setupMagnifier();
    }

    createDetailTemplate(coin) {
        return `
            <div class="section-container">
                <div class="coin-detail-header">
                    <button class="btn-back" onclick="app.navigateTo('catalogo')">← Volver al Catálogo</button>
                </div>
                <div class="coin-detail-layout">
                    <div class="coin-gallery">
                        <div class="main-image-container glass-effect" id="magnifier-container">
                            <img src="${coin.images[0]}" id="main-image" class="main-image">
                            <div id="magnifier-glass"></div>
                            <div id="magnifier-result" class="magnifier-result"></div>
                        </div>
                        <div class="gallery-thumbs">
                            ${coin.images.map((img, idx) => `
                                <div class="thumb ${idx === 0 ? 'active' : ''}" data-src="${img}">
                                    <img src="${img}">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="coin-info">
                        <div class="coin-info-header">
                            <span class="badge-status ${coin.stock > 0 ? 'in' : 'out'}">${coin.stock > 0 ? 'Disponible' : 'Consultar'}</span>
                            ${coin.featured ? '<span class="badge-featured">Pieza Destacada</span>' : ''}
                            <h1 class="coin-title">${coin.name}</h1>
                            <div class="coin-price-tag">${this.formatCurrency(coin.price)}</div>
                        </div>
                        
                        <div class="coin-description">
                            <p>${coin.description}</p>
                        </div>

                        <div class="coin-specs-grid">
                            <div class="spec-item">
                                <span class="spec-label">Periodo</span>
                                <span class="spec-value">${PERIODS_INFO[coin.period]?.title || coin.period}</span>
                            </div>
                            <div class="spec-item">
                                <span class="spec-label">Año</span>
                                <span class="spec-value">${coin.year}</span>
                            </div>
                            <div class="spec-item">
                                <span class="spec-label">Gobernante</span>
                                <span class="spec-value">${coin.ruler}</span>
                            </div>
                            <div class="spec-item">
                                <span class="spec-label">Peso</span>
                                <span class="spec-value">${coin.weight}</span>
                            </div>
                            <div class="spec-item">
                                <span class="spec-label">Metal</span>
                                <span class="spec-value">${coin.metal}</span>
                            </div>
                            <div class="spec-item">
                                <span class="spec-label">Ceca</span>
                                <span class="spec-value">${coin.mint}</span>
                            </div>
                            <div class="spec-item">
                                <span class="spec-label">Conservación</span>
                                <span class="spec-value">${coin.condition}</span>
                            </div>
                            ${coin.purity ? `<div class="spec-item">
                                <span class="spec-label">Ley / Pureza</span>
                                <span class="spec-value">${coin.purity}</span>
                            </div>` : ''}
                        </div>

                        <div class="coin-history">
                            <h3 class="history-title">Contexto Histórico</h3>
                            <p>${coin.history}</p>
                        </div>

                        <div class="coin-actions">
                            <button class="btn-primary btn-cta btn-whatsapp" onclick="app.contactCollector('${coin.id}')">
                                Consultar Disponibilidad
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initGallery(images) {
        const thumbs = document.querySelectorAll('.thumb');
        const mainImg = document.getElementById('main-image');
        
        thumbs.forEach(thumb => {
            thumb.addEventListener('mouseenter', () => {
                thumbs.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
                mainImg.src = thumb.dataset.src;
                // Re-init magnifier result if needed
                this.setupMagnifier();
            });
        });
    }

    setupMagnifier() {
        const img = document.getElementById('main-image');
        const result = document.getElementById('magnifier-result');
        const glass = document.getElementById('magnifier-glass');
        const container = document.getElementById('magnifier-container');
        if (!img || !result || !glass) return;

        container.onmousemove = (e) => {
            glass.style.display = 'block';
            result.style.display = 'block';
            
            const rect = img.getBoundingClientRect();
            const x = e.pageX - rect.left - window.pageXOffset;
            const y = e.pageY - rect.top - window.pageYOffset;
            
            let posX = x - (glass.offsetWidth / 2);
            let posY = y - (glass.offsetHeight / 2);
            
            if (posX < 0) posX = 0;
            if (posX > img.width - glass.offsetWidth) posX = img.width - glass.offsetWidth;
            if (posY < 0) posY = 0;
            if (posY > img.height - glass.offsetHeight) posY = img.height - glass.offsetHeight;
            
            glass.style.left = posX + 'px';
            glass.style.top = posY + 'px';
            
            const ratioX = result.offsetWidth / glass.offsetWidth;
            const ratioY = result.offsetHeight / glass.offsetHeight;
            
            result.style.backgroundImage = `url('${img.src}')`;
            result.style.backgroundSize = (img.width * ratioX) + 'px ' + (img.height * ratioY) + 'px';
            result.style.backgroundPosition = `-${posX * ratioX}px -${posY * ratioY}px`;
        };
        
        container.onmouseleave = () => {
            glass.style.display = 'none';
            result.style.display = 'none';
        }
    }

    setupEventListeners() {
        // Category Filters
        const filters = document.querySelectorAll('.filter-item');
        filters.forEach(f => {
            f.addEventListener('click', () => {
                filters.forEach(item => item.classList.remove('active'));
                f.classList.add('active');
                this.currentFilter = f.dataset.filter;
                this.renderCatalog();
            });
        });

        // Search Input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderCatalog();
            });
        }
    }

    toggleFavorite(id, btn) {
        const index = this.favorites.indexOf(id);
        if (index === -1) {
            this.favorites.push(id);
            btn.classList.add('active');
            this.showToast('Añadido a favoritos');
        } else {
            this.favorites.splice(index, 1);
            btn.classList.remove('active');
            this.showToast('Eliminado de favoritos');
        }
        localStorage.setItem('numis_favs', JSON.stringify(this.favorites));
        this.updateFavBadge();
        if (this.currentSection === 'favoritos') this.renderFavorites();
    }

    renderFavorites() {
        const container = document.getElementById('fav-grid');
        if (!container) return;
        
        const favCoins = window.COINS_DATA.filter(c => this.favorites.includes(c.id));
        
        if (favCoins.length === 0) {
            container.innerHTML = `<p class="empty-favs">No has guardado ninguna pieza todavía.</p>`;
            return;
        }

        container.innerHTML = favCoins.map(coin => this.createCoinCard(coin)).join('');
        this.attachCardEvents();
    }

    updateFavBadge() {
        const badge = document.getElementById('fav-count');
        if (badge) {
            badge.textContent = this.favorites.length;
            badge.style.display = this.favorites.length > 0 ? 'flex' : 'none';
        }
    }

    contactCollector(coinId) {
        const coin = window.COINS_DATA.find(c => c.id === coinId);
        const text = `Hola, estoy interesado en la pieza: ${coin.name} (${coin.year}) con referencia ${coin.id}. ¿Podría darme más información?`;
        const url = `https://wa.me/34600000000?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    setupContactForm() {
        const form = document.getElementById('contact-form-exec');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                this.showToast('Mensaje enviado. Le contactaremos pronto.');
                form.reset();
            };
        }
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
    }

    showToast(msg) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast-msg';
        toast.textContent = msg;
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('visible'), 100);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
}
