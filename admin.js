/**
 * ═══════════════════════════════ ADMIN PANEL LOGIC (SUPABASE CLOUD) ═════════════════ 
 * Fully automated cloud database integration for GitHub Pages hosting.
 */

class AdminPanel {
    constructor(appInstance) {
        this.app = appInstance;
        this.password = "Alexander2026"; 
        this.editingId = null;

        this.init();
    }

    init() {
        this.setupTriggers();
        this.setupModals();
        this.setupForm();
        this.renderAddedList(); 
        this.setupImagePreview();
    }

    setupTriggers() {
        const logoIcon = document.querySelector('.logo-icon');
        if (logoIcon) {
            logoIcon.addEventListener('click', (e) => {
                if (e.detail === 3) this.showLogin();
            });
        }

        const trigger = document.getElementById('admin-trigger');
        if (trigger) {
            trigger.addEventListener('click', (e) => {
                if (e.detail === 3) this.showLogin();
            });
        }

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

        // Migration/Setup button
        const btnSync = document.getElementById('btn-export-db');
        btnSync.innerHTML = '<span>☁️</span> Migrar Datos a la Nube';
        btnSync.onclick = () => this.migrateData();

        // Clear local button
        document.getElementById('btn-clear-admin').onclick = () => {
            this.app.showToast('ℹ️ El historial ahora reside en Supabase Cloud');
        };
    }

    async migrateData() {
        if (!confirm('¿Deseas subir todas las monedas actuales de data.js a Supabase? (Solo se subirán las que no existan)')) return;

        this.app.showToast('🚀 Iniciando migración...');
        let count = 0;
        
        for (const coin of window.COINS_DATA) {
            try {
                // Ensure the coin object matches the DB structure exactly
                const { error } = await window.supabase
                    .from('coins')
                    .upsert({
                        id: coin.id,
                        name: coin.name,
                        year: coin.year,
                        period: coin.period,
                        ruler: coin.ruler || 'N/A',
                        country: coin.country || 'España',
                        mint: coin.mint || 'Madrid',
                        weight: coin.weight || '0g',
                        purity: coin.purity || '',
                        metal: coin.metal || '',
                        condition: coin.condition || '',
                        price: coin.price || 0,
                        images: coin.images,
                        description: coin.description || '',
                        history: coin.history || '',
                        variants: coin.variants || '',
                        market: coin.market || '',
                        featured: coin.featured || false,
                        views: coin.views || 0,
                        stock: coin.stock || 1
                    });
                if (!error) count++;
                else console.error('Error upserting coin:', error);
            } catch (err) {
                console.error('Error migrando individual:', err);
            }
        }
        
        this.app.showToast(`✅ Sincronización completa: ${count} monedas.`);
        this.renderAddedList();
        if (this.app.currentSection === 'catalogo') this.app.renderCatalog();
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

        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.saveCoinToCloud();
        };

        btnGenCode.onclick = () => {
            const coin = this.getFormData();
            const code = JSON.stringify(coin, null, 2);
            codeOutput.textContent = code;
            codeOutput.style.display = 'block';
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
            history: "Pieza catalogada en Alexander Cloud.",
            featured: document.getElementById('a-period').value === 'bullion',
            stock: 1
        };
    }

    async saveCoinToCloud() {
        const coin = this.getFormData();
        this.app.showToast('⏳ Guardando en la nube...');

        try {
            const { error } = await window.supabase
                .from('coins')
                .upsert(coin);

            if (error) throw error;

            this.app.showToast('✨ ¡Moneda publicada con éxito!');
            
            // Refresh local data
            const index = window.COINS_DATA.findIndex(c => c.id === coin.id);
            if (index !== -1) window.COINS_DATA[index] = coin;
            else window.COINS_DATA.push(coin);

            this.editingId = null;
            document.getElementById('admin-coin-form').reset();
            document.getElementById('a-preview-img').style.display = 'none';
            this.renderAddedList();
            
            if (this.app.currentSection === 'catalogo') this.app.renderCatalog();
        } catch (err) {
            console.error('Error guardando en Supabase:', err);
            this.app.showToast('❌ Error al guardar en la nube');
        }
    }

    async renderAddedList() {
        const list = document.getElementById('admin-items-list');
        if (!list) return;

        // Fetch all from cloud for the list
        try {
            const { data: coins } = await window.supabase.from('coins').select('*').order('created_at', { ascending: false });
            
            if (!coins || coins.length === 0) {
                list.innerHTML = '<p style="color: #444; font-size: 0.8rem; text-align: center; margin-top: 20px;">Nube vacía. Pulsa migrar para empezar.</p>';
                return;
            }

            list.innerHTML = coins.map(coin => `
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
                        this.deleteCoinFromCloud(card.dataset.id);
                        return;
                    }
                    this.loadCoinToFormFromData(coins.find(c => c.id === card.dataset.id));
                };
            });
        } catch (err) {
            list.innerHTML = '<p style="color: grey;">Error conectando a la nube.</p>';
        }
    }

    loadCoinToFormFromData(coin) {
        if (!coin) return;

        this.editingId = coin.id;
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
    }

    async deleteCoinFromCloud(id) {
        if (!confirm('¿Eliminar esta moneda permanentemente de la nube?')) return;
        
        try {
            const { error } = await window.supabase
                .from('coins')
                .delete()
                .eq('id', id);

            if (error) throw error;
            
            window.COINS_DATA = window.COINS_DATA.filter(c => c.id !== id);
            this.renderAddedList();
            this.app.showToast('✅ Eliminada de la nube');
            if (this.app.currentSection === 'catalogo') this.app.renderCatalog();
        } catch (err) {
            this.app.showToast('❌ Error al eliminar');
        }
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
}
