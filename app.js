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
        this.currentSection = 'home';
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
                console.warn("⚠️ Nube vacía. Usando datos de data.js.");
                if (typeof COINS_DATA === 'undefined') window.COINS_DATA = [];
            }

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
            this.navigateTo('home');
        }
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-links a, .hero-cta button, .footer-links a, .btn-favorites, .bc-item.link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                if (section) {
                    e.preventDefault();
                    this.navigateTo(section);
                }
            });
        });
    }

    navigateTo(sectionId) {
        console.log('Navigating to:', sectionId);
        this.currentSection = sectionId;
        localStorage.setItem('numis_current_section', sectionId);
        
        // Update Active Link UI
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionId);
        });

        // Toggle visibility of all major views matching HTML IDs (section-NAME)
        const views = ['home', 'catalogo', 'favorites', 'contacto', 'coin-detail'];
        views.forEach(id => {
            const el = document.getElementById(`section-${id}`);
            if (el) el.classList.remove('active');
        });

        const activeEl = document.getElementById(`section-${sectionId}`);
        if (activeEl) {
            activeEl.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            console.warn(`Section ID section-${sectionId} not found in DOM`);
        }

        // Section-specific logic
        if (sectionId === 'catalogo') {
            this.renderCatalog();
        } else if (sectionId === 'favorites') {
            this.renderFavorites();
        }
    }

    renderCatalog() {
        const container = document.getElementById('coins-grid');
        if (!container) return;

        let filtered = window.COINS_DATA || [];

        // Apply filters
        if (this.currentFilter !== 'todos') {
            filtered = filtered.filter(coin => coin.period === this.currentFilter);
        }

        // Apply Search
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(coin => 
                coin.name.toLowerCase().includes(q) || 
                (coin.description && coin.description.toLowerCase().includes(q)) ||
                (coin.year && coin.year.toString().includes(q))
            );
        }

        const countEl = document.getElementById('catalog-count');
        if (countEl) countEl.textContent = `${filtered.length} monedas encontradas`;

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 100px 0;">
                    <h3 style="color: var(--primary); font-family: 'Cinzel', serif;">No se encontraron piezas</h3>
                    <p style="color: var(--text-muted);">Intenta ajustar los filtros de búsqueda.</p>
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
                    <span class="coin-card-period">${(coin.period || '').toUpperCase()}</span>
                    <h3 class="coin-card-title">${coin.name}</h3>
                    <div class="coin-card-footer">
                        <span class="coin-card-year">${coin.year || 'S/A'}</span>
                        <span class="coin-card-price">${this.formatCurrency(coin.price || 0)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    attachCardEvents() {
        document.querySelectorAll('.coin-card-img-wrapper, .coin-card-content').forEach(el => {
            el.onclick = (e) => {
                if (e.target.closest('.btn-fav')) return;
                const id = el.closest('.coin-card').dataset.id;
                this.showCoinDetail(id);
            };
        });

        document.querySelectorAll('.btn-fav').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = btn.dataset.id;
                this.toggleFavorite(id, btn);
            };
        });
    }

    showCoinDetail(coinId) {
        const coin = window.COINS_DATA.find(c => c.id === coinId);
        if (!coin) return;

        this.navigateTo('coin-detail');
        localStorage.setItem('numis_current_coin', coinId);
        
        const detailContainer = document.getElementById('section-coin-detail');
        if (detailContainer) {
            // We need to keep the breadcrumb but update content
            const detailName = document.getElementById('detail-bc-name');
            if (detailName) detailName.textContent = coin.name;
            
            const mainImg = document.getElementById('gallery-main-img');
            if (mainImg) mainImg.src = coin.images[0] || '';
            
            const nameH1 = document.getElementById('coin-detail-name');
            if (nameH1) nameH1.textContent = coin.name;
            
            const priceEl = document.getElementById('coin-price');
            if (priceEl) priceEl.textContent = this.formatCurrency(coin.price || 0);

            const specs = document.getElementById('coin-specs-grid');
            if (specs) {
                specs.innerHTML = `
                    <div class="spec-item"><span class="spec-label">Periodo</span><span class="spec-value">${PERIODS_INFO[coin.period]?.title || coin.period}</span></div>
                    <div class="spec-item"><span class="spec-label">Año</span><span class="spec-value">${coin.year}</span></div>
                    <div class="spec-item"><span class="spec-label">Gobernante</span><span class="spec-value">${coin.ruler}</span></div>
                    <div class="spec-item"><span class="spec-label">Metal</span><span class="spec-value">${coin.metal}</span></div>
                    <div class="spec-item"><span class="spec-label">Ceca</span><span class="spec-value">${coin.mint}</span></div>
                    <div class="spec-item"><span class="spec-label">Conservación</span><span class="spec-value">${coin.condition}</span></div>
                `;
            }

            // Badges
            const badgeCont = document.getElementById('coin-badges');
            if (badgeCont) {
                badgeCont.innerHTML = `<span class="badge-status ${coin.stock > 0 ? 'in' : 'out'}">${coin.stock > 0 ? 'Disponible' : 'Cerrada'}</span>`;
            }
        }
    }

    setupEventListeners() {
        const filters = document.querySelectorAll('.filter-item');
        filters.forEach(f => {
            f.addEventListener('click', () => {
                filters.forEach(item => item.classList.remove('active'));
                f.classList.add('active');
                this.currentFilter = f.dataset.filter;
                this.renderCatalog();
            });
        });

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderCatalog();
            });
        }

        // Hamburger
        const ham = document.getElementById('hamburger');
        const links = document.getElementById('nav-links');
        if (ham && links) {
            ham.addEventListener('click', () => {
                links.classList.toggle('active');
                ham.classList.toggle('active');
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
        if (this.currentSection === 'favorites') this.renderFavorites();
    }

    renderFavorites() {
        const container = document.getElementById('favorites-grid');
        if (!container) return;
        
        const favCoins = window.COINS_DATA.filter(c => this.favorites.includes(c.id));
        
        if (favCoins.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: grey;">No has guardado ninguna pieza todavía.</p>`;
            return;
        }

        container.innerHTML = favCoins.map(coin => this.createCoinCard(coin)).join('');
        this.attachCardEvents();
    }

    updateFavBadge() {
        const badge = document.getElementById('fav-badge');
        if (badge) {
            badge.textContent = this.favorites.length;
            badge.style.display = this.favorites.length > 0 ? 'flex' : 'none';
        }
    }

    setupContactForm() {
        const form = document.getElementById('contact-form');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                this.showToast('Solicitud enviada con éxito');
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
