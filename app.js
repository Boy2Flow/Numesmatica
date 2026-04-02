/**
 * ═══════════════════════════════ CORE LOGIC ═══════════════════════════════ 
 */

document.addEventListener('DOMContentLoaded', () => {
    const app = new NumismaticaApp();
    app.init();
});

class NumismaticaApp {
    constructor() {
        this.currentSection = 'home';
        this.favorites = JSON.parse(localStorage.getItem('numis_favs')) || [];
        this.viewMode = 'grid';
        this.sortBy = 'year-asc';
        this.filters = {
            period: '',
            category: '',
            continent: '',
            material: '',
            rarity: '',
            yearMin: 1000,
            yearMax: 2025,
            search: ''
        };
        
        // State persistence
        this.savedSection = localStorage.getItem('numis_current_section');
        this.savedCoinId = localStorage.getItem('numis_current_coin');
    }

    init() {
        this.setupNavigation();
        this.setupEventListeners();
        this.updateFavBadge();
        this.setupContactForm();
        this.populateContactSubjects();

        // Restore state
        if (this.savedSection) {
            if (this.savedSection === 'coin-detail' && this.savedCoinId) {
                this.showCoinDetail(this.savedCoinId);
            } else {
                this.navigateTo(this.savedSection);
            }
        }
    }

    // ──────────────────── NAVIGATION ────────────────────
    setupNavigation() {
        // Handle all links with data-section
        document.body.addEventListener('click', (e) => {
            const link = e.target.closest('[data-section]');
            if (!link) return;

            e.preventDefault();
            const section = link.getAttribute('data-section');
            const filter = link.getAttribute('data-filter');
            const period = link.getAttribute('data-period');
            const continent = link.getAttribute('data-continent');
            
            if (section === 'catalogo') {
                this.filters.search = '';
                this.filters.period = period || '';
                this.filters.continent = continent || '';
                this.filters.category = filter || '';
                
                // If it's a direct period/continent click, we imply the parent filter
                if (period && !filter) {
                    const monarquiaPeriods = ['reyes-catolicos', 'austrias', 'borbones', 'republica'];
                    if (monarquiaPeriods.includes(period)) this.filters.category = 'monarquia';
                    if (period === 'extranjeras') this.filters.category = 'mundial';
                }
            }
            
            this.navigateTo(section);
        });
    }

    navigateTo(sectionId) {
        // Update UI
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`section-${sectionId}`);
        if (target) {
            target.classList.add('active');
            window.scrollTo(0, 0);
            this.currentSection = sectionId;
            
            // Sync menu active state
            document.querySelectorAll('.nav-link').forEach(l => {
                l.classList.toggle('active', l.getAttribute('data-section') === sectionId);
            });

            // Specific section logic
            if (sectionId === 'catalogo') {
                this.renderCatalog();
            }
            if (sectionId === 'favorites') this.renderFavorites();
            
            // Save state
            localStorage.setItem('numis_current_section', sectionId);
            if (sectionId !== 'coin-detail') {
                localStorage.removeItem('numis_current_coin');
            }
        }
    }

    // ──────────────────── RENDERERS ────────────────────
    // ──────────────────── CATALOG ────────────────────
    createCoinCard(coin) {
        const primaryImg = coin.images[0] || 'https://via.placeholder.com/400';
        const secondaryImg = coin.images[1] || primaryImg;
        
        const isBullion = coin.period === 'bullion';
        
        return `
            <div class="coin-card ${isBullion ? 'bullion' : ''}" data-coin-id="${coin.id}">
                <div class="coin-card-img">
                    <img src="${primaryImg}" 
                         alt="${coin.name}" 
                         loading="lazy" 
                         data-anverse="${primaryImg}" 
                         data-reverse="${secondaryImg}"
                         onmouseover="this.src=this.dataset.reverse" 
                         onmouseout="this.src=this.dataset.anverse">
                    ${coin.stock === 0 ? '<div class="badge-out-of-stock">Sin Stock</div>' : ''}
                    <div class="coin-card-overlay">
                        <button class="btn-view-quick">Ver Detalle</button>
                    </div>
                </div>
                <div class="coin-card-info">
                    <span class="coin-card-period">${this.getSectionTitle(coin.period).toUpperCase()}</span>
                    <h3 class="coin-card-title">${coin.name}</h3>
                    <div class="coin-card-meta">
                        <span class="coin-card-year">${coin.year}</span>
                        <span class="coin-card-price">${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(coin.price)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    getSectionTitle(periodId) {
        const info = PERIODS_INFO[periodId];
        return info ? info.title : this.capitalize(periodId);
    }

    capitalize(str) {
        if (!str) return '';
        return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    attachCardEvents(container) {
        container.querySelectorAll('.coin-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-coin-id');
                this.showCoinDetail(id);
            });
        });
    }

    // ──────────────────── CATALOG ────────────────────
    renderCatalog() {
        const grid = document.getElementById('coins-grid');
        const filtered = this.getFilteredCoins();
        
        if (filtered.length === 0) {
            grid.innerHTML = '<div class="no-results">No se han encontrado monedas con estos filtros.</div>';
        } else {
            grid.innerHTML = filtered.map(coin => this.createCoinCard(coin)).join('');
            this.attachCardEvents(grid);
        }

        document.getElementById('catalog-count').textContent = `${filtered.length} monedas encontradas`;
    }

    getFilteredCoins() {
        let filtered = COINS_DATA.filter(coin => {
            if (this.filters.category === 'monarquia') {
                const monarquiaPeriods = ['reyes-catolicos', 'austrias', 'borbones', 'republica'];
                if (!monarquiaPeriods.includes(coin.period)) return false;
            } else if (this.filters.category === 'mundial') {
                if (coin.period !== 'extranjeras' && !coin.continent) return false;
                if (this.filters.continent && coin.continent !== this.filters.continent) return false;
            } else if (this.filters.category === 'bullion') {
                if (coin.material !== 'oro' && coin.period !== 'bullion') return false;
            }

            if (this.filters.period && coin.period !== this.filters.period) return false;
            if (this.filters.material && coin.material !== this.filters.material) return false;
            if (this.filters.rarity && coin.rarity !== this.filters.rarity) return false;
            if (coin.year < this.filters.yearMin || coin.year > this.filters.yearMax) return false;
            
            if (this.filters.search) {
                const s = this.filters.search;
                const inName = coin.name.toLowerCase().includes(s);
                const inRuler = (coin.ruler || '').toLowerCase().includes(s);
                const inMint = (coin.mint || '').toLowerCase().includes(s);
                const inDesc = (coin.description || '').toLowerCase().includes(s);
                if (!inName && !inRuler && !inMint && !inDesc) return false;
            }
            
            return true;
        });

        // Sorting
        filtered.sort((a, b) => {
            switch(this.sortBy) {
                case 'newest': return COINS_DATA.indexOf(b) - COINS_DATA.indexOf(a);
                case 'year-asc': return a.year - b.year;
                case 'year-desc': return b.year - a.year;
                case 'value-desc': return b.price - a.price;
                case 'value-asc': return a.price - b.price;
                case 'name-asc': return a.name.localeCompare(b.name);
                case 'rarity-desc': return (b.rarityScore || 0) - (a.rarityScore || 0);
                default: return 0;
            }
        });

        return filtered;
    }

    applyFiltersFromDropdown(period) {
        // Sync filter chips in sidebar
        const chips = document.querySelectorAll('#chip-period .chip');
        chips.forEach(c => {
            c.classList.toggle('active', c.getAttribute('data-value') === period);
        });
        this.renderCatalog();
    }

    // ──────────────────── DETAIL PAGE ────────────────────
    showCoinDetail(id) {
        const coin = COINS_DATA.find(c => c.id === id);
        if (!coin) return;

        localStorage.setItem('numis_current_coin', id);
        this.navigateTo('coin-detail');
        
        // Add bullion class to layout if needed
        const detailLayout = document.querySelector('.coin-detail-layout');
        detailLayout.classList.toggle('bullion', coin.period === 'bullion');

        // Gallery reset
        this.currentImageIndex = 0;
        this.currentCoinImages = coin.images;
        const updateGallery = () => {
            const currentImg = this.currentCoinImages[this.currentImageIndex];
            document.getElementById('gallery-main-img').src = currentImg;
            document.getElementById('gallery-label').textContent = this.currentImageIndex === 0 ? 'Anverso' : 'Reverso';
            const navPrev = document.getElementById('gallery-prev');
            const navNext = document.getElementById('gallery-next');
            if (navPrev) navPrev.style.display = this.currentCoinImages.length > 1 ? 'flex' : 'none';
            if (navNext) navNext.style.display = this.currentCoinImages.length > 1 ? 'flex' : 'none';
        };

        // Navigation setup
        document.getElementById('gallery-prev').onclick = (e) => {
            e.stopPropagation();
            this.currentImageIndex = (this.currentImageIndex - 1 + this.currentCoinImages.length) % this.currentCoinImages.length;
            updateGallery();
        };
        document.getElementById('gallery-next').onclick = (e) => {
            e.stopPropagation();
            this.currentImageIndex = (this.currentImageIndex + 1) % this.currentCoinImages.length;
            updateGallery();
        };

        // Fill data
        document.getElementById('coin-detail-name').textContent = coin.name;
        document.getElementById('detail-bc-name').textContent = coin.name;
        updateGallery();
        // Favorites button state
        const favBtn = document.getElementById('btn-fav-detail');
        if (favBtn) {
            const isFav = this.favorites.includes(coin.id);
            favBtn.classList.toggle('active', isFav);
            favBtn.onclick = () => this.toggleFavorite(coin.id);
        }

        const priceEl = document.getElementById('coin-price');
        priceEl.textContent = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(coin.price);
        
        // Stock status in detail
        const badgesContainer = document.getElementById('coin-badges');
        badgesContainer.innerHTML = coin.stock === 0 
            ? '<span class="badge-status out">Agotado</span>' 
            : '<span class="badge-status in">Disponible</span>';
        
        if (coin.featured) {
            badgesContainer.innerHTML += '<span class="badge-featured">Destacada</span>';
        }

        // Descripción e historia removidas

        // Specs
        const specsGrid = document.getElementById('coin-specs-grid');
        specsGrid.innerHTML = `
            <div class="spec-item"><span class="spec-label">Año</span><span class="spec-value">${coin.year}</span></div>
            <div class="spec-item"><span class="spec-label">Periodo</span><span class="spec-value">${this.getSectionTitle(coin.period)}</span></div>
            <div class="spec-item"><span class="spec-label">Gobernante</span><span class="spec-value">${coin.ruler}</span></div>
            <div class="spec-item"><span class="spec-label">Ceca</span><span class="spec-value">${coin.mint}</span></div>
            <div class="spec-item"><span class="spec-label">Peso</span><span class="spec-value">${coin.weight}</span></div>
            <div class="spec-item"><span class="spec-label">Estado</span><span class="spec-value">${coin.condition}</span></div>
        `;

        this.setupMagnifier();
    }

    setupMagnifier() {
        const container = document.getElementById('magnifier-container');
        const img = document.getElementById('gallery-main-img');
        const lens = document.getElementById('magnifier-lens');
        const result = document.getElementById('magnifier-result');

        container.onmousemove = (e) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            lens.style.display = 'block';
            result.style.display = 'block';
            
            // Handle image path correctly
            result.style.backgroundImage = `url("${img.src.replace(/"/g, '%22')}")`;
            
            const zoom = 2.5;
            result.style.backgroundSize = `${container.clientWidth * zoom}px ${container.clientHeight * zoom}px`;

            // Calculate lens position - centered on mouse
            let lensX = x - lens.offsetWidth / 2;
            let lensY = y - lens.offsetHeight / 2;

            // Constrain lens within container
            lensX = Math.max(0, Math.min(lensX, container.clientWidth - lens.offsetWidth));
            let maxLensY = container.clientHeight - lens.offsetHeight;
            lensY = Math.max(0, Math.min(lensY, maxLensY));

            lens.style.left = lensX + 'px';
            lens.style.top = lensY + 'px';

            // Calculate background position (normalized 0-100)
            const fx = (lensX / (container.clientWidth - lens.offsetWidth)) * 100;
            const fy = (lensY / (container.clientHeight - lens.offsetHeight)) * 100;
            
            result.style.backgroundPosition = `${fx}% ${fy}%`;
        };

        container.onmouseleave = () => {
            lens.style.display = 'none';
            result.style.display = 'none';
        };
    }

    // ──────────────────── HELPERS ────────────────────
    setupEventListeners() {
        // Filter chips
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const parent = chip.parentElement.id;
                const value = chip.getAttribute('data-value');
                
                // Toggle active
                chip.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                if (parent === 'chip-period') this.filters.period = value;
                if (parent === 'chip-material') this.filters.material = value;
                if (parent === 'chip-rarity') this.filters.rarity = value;

                this.renderCatalog();
            });
        });

        // Search overlay
        const searchBtn = document.getElementById('search-toggle');
        const searchOverlay = document.getElementById('search-overlay');
        const searchClose = document.getElementById('search-close');

        searchBtn.addEventListener('click', () => searchOverlay.classList.add('active'));
        searchClose.addEventListener('click', () => searchOverlay.classList.remove('active'));

        // Footer/Navbar Favorites logic now handled by generic data-section=favorites

        // Sorting
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.renderCatalog();
            });
        }

        // Year Range
        const yearMin = document.getElementById('year-min');
        const yearMax = document.getElementById('year-max');
        const yearMinLabel = document.getElementById('year-min-label');
        const yearMaxLabel = document.getElementById('year-max-label');

        if (yearMin && yearMax) {
            const updateYears = () => {
                if (parseInt(yearMin.value) > parseInt(yearMax.value)) {
                    yearMin.value = yearMax.value;
                }
                this.filters.yearMin = parseInt(yearMin.value);
                this.filters.yearMax = parseInt(yearMax.value);
                yearMinLabel.textContent = this.filters.yearMin;
                yearMaxLabel.textContent = this.filters.yearMax;
                this.renderCatalog();
            };

            yearMin.addEventListener('input', updateYears);
            yearMax.addEventListener('input', updateYears);
        }

        // Search execution
        const searchExecBtn = document.getElementById('btn-search-exec');
        const searchInput = document.getElementById('search-input');
        
        const performSearch = () => {
            const materialEl = document.getElementById('f-material');
            const rarityEl = document.getElementById('f-rarity');
            const periodEl = document.getElementById('f-period');

            this.filters.search = searchInput.value.toLowerCase();
            this.filters.period = periodEl ? periodEl.value : '';
            this.filters.material = materialEl ? materialEl.value : '';
            this.filters.rarity = rarityEl ? rarityEl.value : '';
            this.filters.country = document.getElementById('f-country').value;
            this.navigateTo('catalogo');
            
            // Closures if needed
            // document.getElementById('search-overlay').classList.remove('active');
        };

        if (searchExecBtn) {
            searchExecBtn.addEventListener('click', () => {
                performSearch();
                document.getElementById('search-overlay').classList.remove('active');
            });
        }

        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                    document.getElementById('search-overlay').classList.remove('active');
                }
            });

            // Live search in background
            searchInput.addEventListener('input', () => {
                this.filters.search = searchInput.value.toLowerCase();
                if (this.currentSection === 'catalogo') {
                    this.renderCatalog();
                }
            });
        }
    }

    toggleFavorite(id) {
        const index = this.favorites.indexOf(id);
        if (index === -1) {
            this.favorites.push(id);
            this.showToast('Añadido a favoritos');
        } else {
            this.favorites.splice(index, 1);
            this.showToast('Eliminado de favoritos');
        }
        
        localStorage.setItem('numis_favs', JSON.stringify(this.favorites));
        this.updateFavBadge();
        
        const favBtn = document.getElementById('btn-fav-detail');
        if (favBtn) {
            favBtn.classList.toggle('active', this.favorites.includes(id));
        }
    }

    updateFavBadge() {
        const badge = document.getElementById('fav-badge');
        if (badge) badge.textContent = this.favorites.length;
    }

    // ──────────────────── UTILS ────────────────────
    getSectionTitle(periodId) {
        const info = PERIODS_INFO[periodId];
        return info ? info.title : this.capitalize(periodId);
    }

    populateContactSubjects() {
        const select = document.getElementById('contact-subject');
        if (!select) return;
        
        // Remove existing options except the first placeholder
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Add each coin from the data
        COINS_DATA.forEach(coin => {
            const option = document.createElement('option');
            option.value = coin.name;
            option.textContent = coin.name;
            select.appendChild(option);
        });
    }

    setupContactForm() {
        const form = document.getElementById('contact-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.showToast('Mensaje enviado con éxito. Nos pondremos en contacto pronto.');
                form.reset();
            });
        }
    }

    renderFavorites() {
        const container = document.getElementById('favorites-grid');
        if (!container) return;
        
        const favCoins = COINS_DATA.filter(c => this.favorites.includes(c.id));
        
        if (favCoins.length === 0) {
            container.innerHTML = `
                <div class="no-results" style="grid-column: 1/-1; padding: 100px 0;">
                    <p style="font-size: 1.2rem; color: var(--text-muted);">No tienes monedas guardadas en favoritos.</p>
                    <button class="btn-primary" style="margin-top: 20px;" data-section="catalogo">Explorar Catálogo</button>
                </div>
            `;
            // Re-attach navigation for the CTA button
            container.querySelector('button').onclick = () => this.navigateTo('catalogo');
        } else {
            container.innerHTML = favCoins.map(coin => this.createCoinCard(coin)).join('');
            this.attachCardEvents(container);
        }
    }

    showToast(msg) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = 'toast-msg';
        toast.textContent = msg;
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('visible'), 100);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }
}
