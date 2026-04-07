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
    }

    async init() {
        try {
            window.supabase = supabase.createClient("https://krzigbuwlckknmryavmh.supabase.co", "sb_publishable_SFh8-__5q4rZ74XtkjFUxA_sfuPCUKo");
            const { data } = await window.supabase.from('coins').select('*');
            window.COINS_DATA = data || [];
            
            if (typeof PERIODS_INFO === 'undefined') {
                window.PERIODS_INFO = {
                    "reyes-catolicos": { title: "Reyes Católicos" },
                    "austrias": { title: "Austrias" },
                    "borbones": { title: "Borbones" },
                    "republica": { title: "República" },
                    "extranjeras": { title: "Mundiales" },
                    "bullion": { title: "Bullion" }
                };
            }
        } catch (e) { console.error(e); }

        this.setupNavigation();
        this.setupEventListeners();
        this.updateFavBadge();
        
        if (this.savedSection) {
            if (this.savedSection === 'coin-detail' && this.savedCoinId) this.showCoinDetail(this.savedCoinId);
            else this.navigateTo(this.savedSection);
        } else { this.navigateTo('home'); }
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

    navigateTo(sectionId) {
        this.currentSection = sectionId;
        localStorage.setItem('numis_current_section', sectionId);
        
        document.querySelectorAll('.nav-links a').forEach(l => l.classList.toggle('active', l.dataset.section === sectionId));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        
        const activeEl = document.getElementById(`section-${sectionId}`);
        if (activeEl) activeEl.classList.add('active');

        if (sectionId === 'catalogo') this.renderCatalog();
        else if (sectionId === 'favorites') this.renderFavorites();
        
        document.getElementById('nav-links')?.classList.remove('active');
        document.getElementById('hamburger')?.classList.remove('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
                <div class="coin-card-content"><span class="coin-card-period">${(coin.period || '').toUpperCase()}</span><h3 class="coin-card-title">${coin.name}</h3><div class="coin-card-footer"><span>${coin.year}</span><span>${this.formatCurrency(coin.price)}</span></div></div>
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

    showCoinDetail(coinId) {
        const coin = window.COINS_DATA.find(c => c.id === coinId);
        if (!coin) return;
        this.navigateTo('coin-detail');
        localStorage.setItem('numis_current_coin', coinId);
        document.getElementById('coin-detail-name').textContent = coin.name;
        document.getElementById('gallery-main-img').src = coin.images?.[0] || '';
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
        const ham = document.getElementById('hamburger'), links = document.getElementById('nav-links');
        if (ham && links) ham.onclick = () => { links.classList.toggle('active'); ham.classList.toggle('active'); };
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
}
