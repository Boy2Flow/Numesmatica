/**
 * ═══════════════════════════════ ADMIN PANEL LOGIC (PREMIUM EX) ═════════════════ 
 * Improved with Sidebar management, Session persistence, and Image Previews.
 */

class AdminPanel {
    constructor(appInstance) {
        this.app = appInstance;
        this.password = "Alexander2026"; 
        this.addedCoins = JSON.parse(localStorage.getItem('admin_added_coins')) || [];
        this.editingId = null;

        this.init();
    }

    init() {
        this.setupTriggers();
        this.setupModals();
        this.setupForm();
        this.renderAddedList();
        this.setupImagePreview();
        this.setupClearSession();
    }

    setupTriggers() {
        // Logo Triple Click
        const logoIcon = document.querySelector('.logo-icon');
        if (logoIcon) {
            logoIcon.addEventListener('click', (e) => {
                if (e.detail === 3) this.showLogin();
            });
        }

        // Invisible Corner Click
        const trigger = document.getElementById('admin-trigger');
        if (trigger) {
            trigger.addEventListener('click', (e) => {
                if (e.detail === 3) this.showLogin();
            });
        }

        // Alt+Shift+A Shortcut
        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.shiftKey && e.code === 'KeyA') {
                this.showLogin();
            }
        });
    }

    setupModals() {
        const loginOverlay = document.getElementById('login-overlay');
        const adminOverlay = document.getElementById('admin-panel-overlay');
        
        document.getElementById('login-close').onclick = () => loginOverlay.classList.remove('active');
        document.getElementById('admin-panel-close').onclick = () => adminOverlay.classList.remove('active');

        document.getElementById('btn-login-exec').onclick = () => this.handleLogin();
        document.getElementById('admin-password').onkeydown = (e) => {
            if (e.key === 'Enter') this.handleLogin();
        };

        // Export data.js
        document.getElementById('btn-export-db').onclick = () => this.exportDatabase();
    }

    showLogin() {
        document.getElementById('login-overlay').classList.add('active');
        document.getElementById('admin-password').focus();
    }

    handleLogin() {
        const passInput = document.getElementById('admin-password');
        if (passInput.value === this.password) {
            document.getElementById('login-overlay').classList.remove('active');
            document.getElementById('admin-panel-overlay').classList.add('active');
            passInput.value = '';
            this.renderAddedList();
        } else {
            this.app.showToast('Acceso denegado');
            passInput.style.borderColor = '#ff4757';
            setTimeout(() => passInput.style.borderColor = '', 1000);
        }
    }

    setupForm() {
        const form = document.getElementById('admin-coin-form');
        const btnGenCode = document.getElementById('btn-gen-code');
        const codeOutput = document.getElementById('code-output');

        form.onsubmit = (e) => {
            e.preventDefault();
            this.saveCoin();
        };

        btnGenCode.onclick = () => {
            const coin = this.getFormData();
            const code = JSON.stringify(coin, null, 2);
            codeOutput.textContent = code;
            codeOutput.style.display = 'block';
            navigator.clipboard.writeText(code).then(() => {
                this.app.showToast('JSON copiado exitosamente');
            });
        };
    }

    getFormData() {
        const imgInput = document.getElementById('a-images').value;
        const images = imgInput.split(',').map(s => s.trim()).filter(s => s !== '');
        
        return {
            id: this.editingId || `moneda-${Date.now()}`,
            name: document.getElementById('a-name').value,
            year: parseInt(document.getElementById('a-year').value),
            period: document.getElementById('a-period').value,
            ruler: document.getElementById('a-ruler').value || 'N/A',
            country: "España",
            mint: document.getElementById('a-mint').value || 'Madrid',
            weight: document.getElementById('a-weight').value || '0g',
            purity: document.getElementById('a-purity').value || '',
            metal: document.getElementById('a-metal').value,
            condition: document.getElementById('a-condition').value,
            price: parseFloat(document.getElementById('a-price').value),
            images: images,
            description: document.getElementById('a-description').value,
            history: "Pieza catalogada profesionalmente para Numismática Alexander.",
            featured: document.getElementById('a-period').value === 'bullion',
            views: 0,
            stock: 1
        };
    }

    saveCoin() {
        const coin = this.getFormData();
        
        if (this.editingId) {
            const index = this.addedCoins.findIndex(c => c.id === this.editingId);
            if (index !== -1) {
                this.addedCoins[index] = coin;
                const globalIndex = window.COINS_DATA.findIndex(c => c.id === this.editingId);
                if (globalIndex !== -1) window.COINS_DATA[globalIndex] = coin;
            }
            this.editingId = null;
        } else {
            this.addedCoins.push(coin);
            window.COINS_DATA.push(coin);
        }

        localStorage.setItem('admin_added_coins', JSON.stringify(this.addedCoins));
        this.app.showToast('✅ Producto guardado localmente');
        
        document.getElementById('admin-coin-form').reset();
        document.getElementById('code-output').style.display = 'none';
        document.getElementById('a-preview-img').style.display = 'none';
        this.renderAddedList();
        
        if (this.app.currentSection === 'catalogo') this.app.renderCatalog();
    }

    renderAddedList() {
        const list = document.getElementById('admin-items-list');
        if (!list) return;

        if (this.addedCoins.length === 0) {
            list.innerHTML = '<p style="color: #444; font-size: 0.8rem; text-align: center; margin-top: 20px;">No hay monedas nuevas en esta sesión local.</p>';
            return;
        }

        list.innerHTML = this.addedCoins.map(coin => `
            <div class="added-item-card" data-id="${coin.id}">
                <img src="${coin.images[0] || 'https://via.placeholder.com/50'}" class="added-item-img">
                <div class="added-item-info">
                    <h4>${coin.name}</h4>
                    <p>${coin.year} • ${coin.price}€</p>
                </div>
                <button class="delete-item" title="Eliminar">×</button>
            </div>
        `).join('');

        list.querySelectorAll('.added-item-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.classList.contains('delete-item')) {
                    this.deleteCoin(card.dataset.id);
                    return;
                }
                this.loadCoinToForm(card.dataset.id);
            };
        });
    }

    loadCoinToForm(id) {
        const coin = this.addedCoins.find(c => c.id === id);
        if (!coin) return;

        this.editingId = id;
        document.getElementById('a-name').value = coin.name;
        document.getElementById('a-year').value = coin.year;
        document.getElementById('a-period').value = coin.period;
        document.getElementById('a-ruler').value = coin.ruler;
        document.getElementById('a-metal').value = coin.metal;
        document.getElementById('a-purity').value = coin.purity;
        document.getElementById('a-weight').value = coin.weight;
        document.getElementById('a-mint').value = coin.mint;
        document.getElementById('a-condition').value = coin.condition;
        document.getElementById('a-price').value = coin.price;
        document.getElementById('a-images').value = coin.images.join(', ');
        document.getElementById('a-description').value = coin.description;

        this.updatePreview(coin.images[0]);
        this.app.showToast('Cargando: ' + coin.name);
    }

    deleteCoin(id) {
        if (!confirm('¿Eliminar esta moneda del historial local?')) return;
        
        this.addedCoins = this.addedCoins.filter(c => c.id !== id);
        window.COINS_DATA = window.COINS_DATA.filter(c => c.id !== id);
        
        localStorage.setItem('admin_added_coins', JSON.stringify(this.addedCoins));
        this.renderAddedList();
        this.app.showToast('Moneda eliminada localmente');
        
        if (this.app.currentSection === 'catalogo') this.app.renderCatalog();
    }

    setupImagePreview() {
        const imgInput = document.getElementById('a-images');
        imgInput.addEventListener('input', () => {
            const firstImg = imgInput.value.split(',')[0].trim();
            this.updatePreview(firstImg);
        });
    }

    updatePreview(url) {
        const preview = document.getElementById('a-preview-img');
        if (url) {
            preview.src = url;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    }

    setupClearSession() {
        const btn = document.getElementById('btn-clear-admin');
        btn.onclick = () => {
            if (confirm('¿Deseas vaciar todas las monedas añadidas localmente? Esta acción no se puede deshacer.')) {
                // Remove each added coin from COINS_DATA
                this.addedCoins.forEach(coin => {
                    window.COINS_DATA = window.COINS_DATA.filter(c => c.id !== coin.id);
                });
                this.addedCoins = [];
                localStorage.removeItem('admin_added_coins');
                this.renderAddedList();
                this.app.showToast('Sesión local vaciada');
                if (this.app.currentSection === 'catalogo') this.app.renderCatalog();
            }
        };
    }

    exportDatabase() {
        const fullData = JSON.stringify(window.COINS_DATA, null, 2);
        const periodsInfo = JSON.stringify(window.PERIODS_INFO, null, 2);
        
        const content = `/** 
 * Numismática Alexander - Banco de Datos 
 * Este archivo ha sido generado automáticamente desde el Panel de Administración.
 */

let COINS_DATA = ${fullData};

const PERIODS_INFO = ${periodsInfo};
`;
        
        const blob = new Blob([content], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.app.showToast('✅ Descargando archivo "data.js" actualizado');
    }
}
