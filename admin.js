/**
 * ═══════════════════════════════ ADMIN PANEL (SOLID VERSION - NO DEPENDENCIES) ═════════════════ 
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
        const logo = document.querySelector('.logo-icon');
        if (logo) logo.onclick = (e) => { if (e.detail === 3) this.showLogin(); };
        const trigger = document.getElementById('admin-trigger');
        if (trigger) trigger.onclick = (e) => { if (e.detail === 3) this.showLogin(); };
        window.onkeydown = (e) => { if (e.altKey && e.shiftKey && e.code === 'KeyA') this.showLogin(); };
    }

    setupModals() {
        if (document.getElementById('login-close')) document.getElementById('login-close').onclick = () => document.getElementById('login-overlay').classList.remove('active');
        if (document.getElementById('admin-panel-close')) document.getElementById('admin-panel-close').onclick = () => document.getElementById('admin-panel-overlay').classList.remove('active');
        if (document.getElementById('btn-login-exec')) document.getElementById('btn-login-exec').onclick = () => this.handleLogin();
        if (document.getElementById('btn-export-db')) document.getElementById('btn-export-db').onclick = () => this.forceMigrate();
    }

    async forceMigrate() {
        if (!window.supabase) { alert('Conectando a la nube...'); return; }
        const data = window.COINS_DATA;
        if (!data || data.length === 0) { alert('No hay datos en data.js'); return; }
        if (!confirm(`¿Subir ${data.length} monedas?`)) return;

        for (const c of data) {
            try {
                await window.supabase.from('coins').upsert({
                    id: c.id, name: c.name, year: c.year, period: c.period,
                    ruler: c.ruler || 'N/A', continent: c.continent || null, 
                    metal: c.metal || null, price: c.price || 0,
                    images: c.images || [], description: c.description || ''
                });
            } catch (e) { console.error(e); }
        }
        alert('📦 Todas las monedas se han sincronizado con la nube.');
        this.renderAddedList();
    }

    handleLogin() {
        const p = document.getElementById('admin-password');
        if (p && p.value === this.password) {
            document.getElementById('login-overlay').classList.remove('active');
            document.getElementById('admin-panel-overlay').classList.add('active');
            p.value = '';
            this.renderAddedList();
        } else { alert('Contraseña incorrecta'); }
    }

    setupForm() {
        const form = document.getElementById('admin-coin-form');
        if (!form) return;

        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.saveCoinToCloud();
        };

        const btnGen = document.getElementById('btn-gen-code');
        if (btnGen) {
            btnGen.onclick = () => {
                const json = JSON.stringify(this.getFormData(), null, 2);
                document.getElementById('code-output').textContent = json;
            };
        }
    }

    getFormData() {
        const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
        const imagesRaw = getVal('a-images') || "";
        const images = imagesRaw.split(',').map(s => s.trim()).filter(s => s !== '');
        
        return {
            id: this.editingId || `moneda-${Date.now()}`,
            name: getVal('a-name'),
            year: parseInt(getVal('a-year')) || 0,
            period: getVal('a-period'),
            ruler: getVal('a-ruler') || 'N/A',
            continent: getVal('a-continent') || null,
            metal: getVal('a-metal') || null,
            purity: getVal('a-purity') || '',
            weight: getVal('a-weight') || '',
            mint: getVal('a-mint') || '',
            condition: getVal('a-condition') || 'EBC',
            price: parseFloat(getVal('a-price')) || 0,
            images: images,
            description: getVal('a-description') || '',
            stock: 1
        };
    }

    async saveCoinToCloud() {
        if (!window.supabase) { alert('No hay conexión con Supabase'); return; }
        const coin = this.getFormData();

        try {
            const { error } = await window.supabase.from('coins').upsert(coin);
            if (error) throw error;

            alert('✨ Moneda guardada con éxito en la nube.');
            this.editingId = null;
            document.getElementById('admin-coin-form').reset();
            if (document.getElementById('a-preview-img')) document.getElementById('a-preview-img').style.display = 'none';
            this.renderAddedList();
            if (this.app && this.app.renderCatalog) this.app.renderCatalog();
        } catch (e) {
            console.error(e);
            alert('Error al guardar: ' + (e.message || 'Error técnico'));
        }
    }

    async renderAddedList() {
        const list = document.getElementById('admin-items-list');
        if (!list || !window.supabase) return;
        try {
            const { data } = await window.supabase.from('coins').select('*').order('created_at', { ascending: false });
            list.innerHTML = (data || []).map(c => `
                <div class="added-item-card" data-id="${c.id}">
                    <img src="${c.images?.[0] || ''}" class="added-item-img">
                    <div class="added-item-info"><h4>${c.name}</h4><p>${c.year} • ${c.price}€</p></div>
                    <button class="delete-item">×</button>
                </div>
            `).join('');
            list.querySelectorAll('.added-item-card').forEach(card => {
                card.onclick = (e) => {
                    if (e.target.classList.contains('delete-item')) this.deleteCoinFromCloud(card.dataset.id);
                    else this.loadCoinToFormFromData(data.find(coin => coin.id === card.dataset.id));
                };
            });
        } catch (e) { console.error(e); }
    }

    loadCoinToFormFromData(c) {
        if (!c) return;
        this.editingId = c.id;
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        setVal('a-name', c.name);
        setVal('a-year', c.year);
        setVal('a-period', c.period);
        setVal('a-ruler', c.ruler);
        setVal('a-continent', c.continent);
        setVal('a-metal', c.metal);
        setVal('a-purity', c.purity);
        setVal('a-weight', c.weight);
        setVal('a-mint', c.mint);
        setVal('a-condition', c.condition);
        setVal('a-price', c.price);
        setVal('a-description', c.description);
        setVal('a-images', c.images ? c.images.join(', ') : '');
        this.updatePreview(c.images?.[0]);
    }

    async deleteCoinFromCloud(id) {
        if (!confirm('¿Eliminar pieza de la nube?')) return;
        try {
            await window.supabase.from('coins').delete().eq('id', id);
            this.renderAddedList();
            if (this.app && this.app.renderCatalog) this.app.renderCatalog();
        } catch (e) { alert('Error al borrar'); }
    }

    setupImagePreview() {
        const inp = document.getElementById('a-images');
        if (inp) inp.oninput = () => {
            const first = inp.value.split(',')[0].trim();
            this.updatePreview(first);
        };
    }

    updatePreview(url) {
        const p = document.getElementById('a-preview-img');
        if (p) { if (url) { p.src = url; p.style.display = 'block'; } else { p.style.display = 'none'; } }
    }

    showLogin() { if (document.getElementById('login-overlay')) document.getElementById('login-overlay').classList.add('active'); }
}
