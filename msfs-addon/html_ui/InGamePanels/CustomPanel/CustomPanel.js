/* =============================================================================
   SKYLEDGER PIREP — MSFS toolbar panel
   -----------------------------------------------------------------------------
   Tracks a flight from inside the sim using SimVars and produces a PIREP at the
   end of the leg (landing rate + any overspeed/stall/overstress). The PIREP is:
     - auto-submitted to your Supabase project if a pairing code is entered, and
     - always shown as a copyable code you can paste on the Skyledger website.
   The website applies it to the open leg through its normal grading pipeline.

   Drop-in: this reuses the maximus toolbar template's prebuilt registration
   (panel-id PANEL_CUSTOM_PANEL, custom element <ingamepanel-custom>), so no MSFS
   SDK build is required if you start from that template's package.
   ============================================================================= */
const SKY_SUPA_URL  = 'https://qoaipsfcidpymboojfwa.supabase.co';
const SKY_SUPA_ANON = 'sb_publishable_6Pj7jeRN0AQBcjl44MoCNA_zjsvFs79';

class IngamePanelCustomPanel extends TemplateElement {
    constructor() {
        super(...arguments);
        this.started = false;
        this.tracking = false;
        this.timer = null;
        this.reset();
    }
    reset() {
        this.cap = { departed:false, landingFpm:0, overspeed:false, stall:false, overstress:false, maxG:1, crashed:false };
        this.wasAir = false;
        this.lastVs = 0;
        this.depPos = null;
        this.t0 = 0;
        this.landed = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this.initUI();
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.timer) clearInterval(this.timer);
    }
    q(sel) { return this.querySelector(sel); }
    initUI() {
        if (this.started) return;
        this.started = true;
        const self = this;

        let code = '';
        try { code = window.localStorage.getItem('sky_pair') || ''; } catch (e) {}
        const ce = this.q('#sky-code'); if (ce) ce.value = code;

        const on = (sel, fn) => { const el = self.q(sel); if (el) el.addEventListener('click', fn); };
        on('#sky-start', () => self.start());
        on('#sky-stop', () => self.finalize(true));
        on('#sky-copy', () => self.copyCode());
        on('#sky-savecode', () => {
            const v = (self.q('#sky-code').value || '').trim().toUpperCase();
            try { window.localStorage.setItem('sky_pair', v); } catch (e) {}
            self.setStatus('Pairing code saved.');
        });

        this.timer = setInterval(() => self.tick(), 250);
    }
    sv(name, unit) { try { return SimVar.GetSimVarValue(name, unit); } catch (e) { return 0; } }
    tick() {
        const onG = !!this.sv('SIM ON GROUND', 'Bool');
        const gs  = this.sv('GROUND VELOCITY', 'knots');
        const vs  = this.sv('VERTICAL SPEED', 'feet per minute');
        const alt = this.sv('PLANE ALTITUDE', 'feet');

        this.setText('#sky-phase', onG ? (gs > 8 ? 'TAXI' : 'ON GROUND') : 'AIRBORNE');
        this.setText('#sky-gs', Math.round(gs) + ' kt');
        this.setText('#sky-alt', Math.round(alt).toLocaleString() + ' ft');
        this.setText('#sky-vs', Math.round(vs) + ' fpm');

        if (!this.tracking) return;

        if (!onG) {
            if (gs > 40) this.cap.departed = true;
            if (this.sv('OVERSPEED WARNING', 'Bool')) this.cap.overspeed = true;
            if (this.sv('STALL WARNING', 'Bool')) this.cap.stall = true;
            const g = this.sv('G FORCE', 'GForce');
            if (g) { this.cap.maxG = Math.max(this.cap.maxG, g); if (g > 2.7 || g < -0.6) this.cap.overstress = true; }
            this.lastVs = vs;
            this.wasAir = true;
        } else {
            if (this.wasAir && this.cap.departed) { this.cap.landingFpm = Math.abs(this.lastVs || vs); this.landed = true; }
            this.wasAir = false;
            if (this.landed && this.cap.departed && gs < 35) this.finalize(false); // auto-file after rollout
        }
    }
    start() {
        this.reset();
        this.tracking = true;
        this.depPos = [this.sv('PLANE LATITUDE', 'degrees'), this.sv('PLANE LONGITUDE', 'degrees')];
        this.t0 = Date.now();
        this.setStatus('Tracking… fly the leg and land at the destination.');
        this.setText('#sky-state', '\u25CF RECORDING');
        const out = this.q('#sky-out'); if (out) out.value = '';
        this.setSubmit('');
    }
    finalize(manual) {
        if (!this.tracking) return;
        this.tracking = false;
        this.setText('#sky-state', manual ? '\u25A0 STOPPED' : '\u2713 LANDED');
        const p = {
            v: 1,
            code: (this.q('#sky-code').value || '').trim().toUpperCase(),
            ts: Date.now(),
            dep: this.depPos,
            arr: [this.sv('PLANE LATITUDE', 'degrees'), this.sv('PLANE LONGITUDE', 'degrees')],
            blockHrs: +(((Date.now() - this.t0) / 3600000).toFixed(2)),
            cap: this.cap
        };
        let codeStr = '';
        try { codeStr = btoa(unescape(encodeURIComponent(JSON.stringify(p)))); } catch (e) { codeStr = JSON.stringify(p); }
        const out = this.q('#sky-out'); if (out) out.value = codeStr;
        this.setStatus(this.cap.departed
            ? ('Landing ' + Math.round(this.cap.landingFpm) + ' fpm — PIREP ready.')
            : 'No airborne segment detected — PIREP saved anyway.');
        this.submit(p);
    }
    submit(p) {
        if (!p.code) { this.setSubmit('No pairing code — copy the code below into the website.'); return; }
        if (!SKY_SUPA_URL || SKY_SUPA_URL.indexOf('http') !== 0) { this.setSubmit('Auto-submit off — copy the code into the website.'); return; }
        const self = this;
        try {
            fetch(SKY_SUPA_URL + '/rest/v1/pireps', {
                method: 'POST',
                headers: {
                    'apikey': SKY_SUPA_ANON,
                    'Authorization': 'Bearer ' + SKY_SUPA_ANON,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ code: p.code, data: p })
            }).then(r => {
                self.setSubmit((r && r.ok) ? '\u2713 Submitted — it will appear on your active trip.' : 'Submit failed (' + (r && r.status) + ') — copy the code instead.');
            }).catch(() => self.setSubmit('Submit failed (network blocked?) — copy the code into the website.'));
        } catch (e) {
            self.setSubmit('Submit failed — copy the code into the website.');
        }
    }
    copyCode() {
        const out = this.q('#sky-out'); if (!out) return;
        out.select();
        try { document.execCommand('copy'); this.setSubmit('Copied — paste it on the website.'); }
        catch (e) { this.setSubmit('Select the code and press Ctrl+C.'); }
    }
    setText(sel, t) { const el = this.q(sel); if (el) el.textContent = t; }
    setStatus(t) { this.setText('#sky-status', t); }
    setSubmit(t) { this.setText('#sky-submit', t); }
}
window.customElements.define('ingamepanel-custom', IngamePanelCustomPanel);
checkAutoload();
