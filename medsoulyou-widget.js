/**
 * medsoulyou-widget.js
 *
 * Önálló, framework nélküli widget a MedSoulYou valós Medio-időpontjainak
 * megjelenítésére és lefoglalására az eredményoldalon.
 *
 * HASZNÁLAT:
 *   <div id="medsoulyou-booking"></div>
 *   <script src="/medsoulyou-widget.js"></script>
 *   <script>
 *     MedSoulYouBooking.render(
 *       document.getElementById('medsoulyou-booking'),
 *       recommendedCategory
 *     );
 *   </script>
 *
 * A category-nek pontosan egyeznie kell a medio-mapping.json-ban és a
 * meglévő kérdéssorban használt szakterület-nevekkel.
 */
(function () {
    const CSS_VARS_FALLBACK = {
          primary: 'var(--color-primary, #0F172A)',
          action: 'var(--color-action, #2F6FED)',
          secondary: 'var(--color-secondary, #16BFC8)',
          success: 'var(--color-success, #34C38F)',
          surface: 'var(--color-surface, #FFFFFF)',
          background: 'var(--color-background, #F8FAFC)',
          border: 'var(--color-border, #E2E8F0)',
    };

   let stylesInjected = false;

   function injectStyles() {
         if (stylesInjected) return;
         stylesInjected = true;
         const style = document.createElement('style');
         style.textContent = `
               .msy-widget { font-family: 'Manrope', sans-serif; color: ${CSS_VARS_FALLBACK.primary}; }
                     .msy-widget__title { font-weight: 700; font-size: 1rem; margin-bottom: 12px; }
                           .msy-widget__days { display: flex; flex-direction: column; gap: 14px; }
                                 .msy-widget__day-label { font-size: 0.85rem; font-weight: 600; opacity: 0.7; margin-bottom: 6px; }
                                       .msy-widget__slots { display: flex; flex-wrap: wrap; gap: 8px; }
                                             .msy-slot-btn {
                                                     border: 1px solid ${CSS_VARS_FALLBACK.border};
                                                             background: ${CSS_VARS_FALLBACK.surface};
                                                                     color: ${CSS_VARS_FALLBACK.primary};
                                                                             border-radius: 8px; padding: 8px 14px; font-size: 0.9rem;
                                                                                     cursor: pointer; transition: all .15s ease;
                                                                                           }
                                                                                                 .msy-slot-btn:hover { border-color: ${CSS_VARS_FALLBACK.action}; color: ${CSS_VARS_FALLBACK.action}; }
                                                                                                       .msy-widget__empty { font-size: 0.9rem; opacity: 0.75; }
                                                                                                             .msy-widget__fallback-link { color: ${CSS_VARS_FALLBACK.action}; font-weight: 600; text-decoration: underline; }
                                                                                                                   .msy-modal-backdrop {
                                                                                                                           position: fixed; inset: 0; background: rgba(15,23,42,.55);
                                                                                                                                   display: flex; align-items: center; justify-content: center;
                                                                                                                                           z-index: 1000; padding: 16px;
                                                                                                                                                 }
                                                                                                                                                       .msy-modal {
                                                                                                                                                               background: ${CSS_VARS_FALLBACK.surface}; border-radius: 16px;
                                                                                                                                                                       max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto;
                                                                                                                                                                               padding: 24px; font-family: 'Manrope', sans-serif;
                                                                                                                                                                                     }
                                                                                                                                                                                           .msy-modal h3 { margin: 0 0 4px; color: ${CSS_VARS_FALLBACK.primary}; }
                                                                                                                                                                                                 .msy-modal p.msy-modal__sub { margin: 0 0 18px; font-size: 0.85rem; opacity: 0.7; }
                                                                                                                                                                                                       .msy-field { margin-bottom: 12px; }
                                                                                                                                                                                                             .msy-field label { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 4px; }
                                                                                                                                                                                                                   .msy-field input, .msy-field select {
                                                                                                                                                                                                                           width: 100%; box-sizing: border-box; padding: 9px 10px;
                                                                                                                                                                                                                                   border: 1px solid ${CSS_VARS_FALLBACK.border}; border-radius: 8px; font-size: 0.9rem;
                                                                                                                                                                                                                                         }
                                                                                                                                                                                                                                               .msy-field-row { display: flex; gap: 10px; }
                                                                                                                                                                                                                                                     .msy-field-row .msy-field { flex: 1; }
                                                                                                                                                                                                                                                           .msy-consent { display: flex; gap: 8px; align-items: flex-start; margin: 16px 0; font-size: 0.8rem; }
                                                                                                                                                                                                                                                                 .msy-actions { display: flex; gap: 10px; margin-top: 8px; }
                                                                                                                                                                                                                                                                       .msy-btn {
                                                                                                                                                                                                                                                                               flex: 1; border: none; border-radius: 8px; padding: 12px; font-weight: 600;
                                                                                                                                                                                                                                                                                       cursor: pointer; font-size: 0.95rem;
                                                                                                                                                                                                                                                                                             }
                                                                                                                                                                                                                                                                                                   .msy-btn--primary { background: ${CSS_VARS_FALLBACK.action}; color: #fff; }
                                                                                                                                                                                                                                                                                                         .msy-btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
                                                                                                                                                                                                                                                                                                               .msy-btn--ghost { background: transparent; border: 1px solid ${CSS_VARS_FALLBACK.border}; color: ${CSS_VARS_FALLBACK.primary}; }
                                                                                                                                                                                                                                                                                                                     .msy-error { color: #DC2626; font-size: 0.85rem; margin-top: 8px; }
                                                                                                                                                                                                                                                                                                                           .msy-success { color: ${CSS_VARS_FALLBACK.success}; font-weight: 600; }
                                                                                                                                                                                                                                                                                                                               `;
         document.head.appendChild(style);
   }

   function groupByDay(slots) {
         const groups = {};
         slots.forEach((slot) => {
                 const day = slot.date.slice(0, 10);
                 groups[day] = groups[day] || [];
                 groups[day].push(slot);
         });
         return groups;
   }

   function formatTime(iso) {
         const d = new Date(iso);
         return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
   }

   function formatDay(dayStr) {
         const d = new Date(dayStr);
         return d.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' });
   }

   // v2.9 (Mick jelzése): a szabad időpontra kattintva NE az általános
   // mymedio.hu főoldalra vigyen, hanem konkrétan ARRA az orvosra és
   // időpontra -- a MedSoulYou oldala ezt query-paraméterekkel támogatja
   // (leellenőrizve valódi böngészőben), pontosan a Medio API-ból már
   // ismert mezőkkel (specializationId, doctorId, locationId, date).
   function buildMedSoulYouDeepLink(slot) {
         if (slot && slot.doctorId && slot.specializationId && slot.locationId && slot.date) {
               const datePart = slot.date.slice(0, 10);
               const timePart = slot.date.slice(11, 16);
               const selectedTime = encodeURIComponent(`${datePart} ${timePart}`);
               return `https://medsoulyou.mymedio.hu/appointment-confirm?specializationId=${slot.specializationId}&doctorId=${slot.doctorId}&selectedTime=${selectedTime}&institutionId=${slot.locationId}`;
         }
         return 'https://medsoulyou.mymedio.hu';
   }

   async function render(container, category, options) {
         options = options || {};
         injectStyles();
         container.innerHTML = '';
         container.classList.add('msy-widget');

      const title = document.createElement('div');
         title.className = 'msy-widget__title';
         title.textContent = 'Foglalj időpontot a MedSoulYou-nál';
         container.appendChild(title);

      const body = document.createElement('div');
         container.appendChild(body);
         body.innerHTML = '<div class="msy-widget__empty">Elérhető időpontok betöltése…</div>';

      let data;
         try {
                 const res = await fetch(
                           `/api/medsoulyou-slots?category=${encodeURIComponent(category)}`
                         );
                 data = await res.json();
         } catch (err) {
                 data = { available: false, slots: [] };
         }

      body.innerHTML = '';

      if (!data.available || !data.slots || data.slots.length === 0) {
              const empty = document.createElement('div');
              empty.className = 'msy-widget__empty';
              empty.innerHTML =
                        'Jelenleg nincs elérhető online időpontfoglalás ehhez a szakterülethez. ' +
                        '<a class="msy-widget__fallback-link" href="https://medsoulyou.mymedio.hu" target="_blank" rel="noopener">Foglalj itt a MedSoulYou oldalán</a>.';
              body.appendChild(empty);
              return;
      }

      const groups = groupByDay(data.slots);
         const daysWrap = document.createElement('div');
         daysWrap.className = 'msy-widget__days';

      Object.keys(groups)
           .sort()
           .forEach((day) => {
                     const dayBlock = document.createElement('div');
                     const dayLabel = document.createElement('div');
                     dayLabel.className = 'msy-widget__day-label';
                     dayLabel.textContent = formatDay(day);
                     dayBlock.appendChild(dayLabel);

                            const slotsWrap = document.createElement('div');
                     slotsWrap.className = 'msy-widget__slots';

                            groups[day].forEach((slot) => {
                                        const btn = document.createElement('button');
                                        btn.type = 'button';
                                        btn.className = 'msy-slot-btn';
                                        btn.textContent = formatTime(slot.date);
                                        // SZÁNDÉKOSAN NEM openBookingModal() (TAJ-szám/születési adat bekérő
                                        // űrlap) -- amíg nincs jogász/DPO jóváhagyás a beteg-adatok GDPR-
                                        // megfelelő gyűjtésére/továbbítására (ld. api/medsoulyou-book.js teteje),
                                        // a szabad időpont kattintása a meglévő, adatot NEM gyűjtő külső
                                        // MedSoulYou-oldalra visz. v2.9: konkrétan ARRA az orvosra/időpontra
                                        // mutató mélylinkkel (leellenőrizve valódi böngészőben, hogy a
                                        // mymedio.hu ezt támogatja) -- nem csak az általános főoldalra.
                                        btn.addEventListener('click', () => window.open(buildMedSoulYouDeepLink(slot), '_blank', 'noopener'));
                                        slotsWrap.appendChild(btn);
                            });

                            dayBlock.appendChild(slotsWrap);
                     daysWrap.appendChild(dayBlock);
           });

      body.appendChild(daysWrap);
   }

    function openBookingModal(category, slot, options) {
      injectStyles();
      const backdrop = document.createElement('div');
      backdrop.className = 'msy-modal-backdrop';
      const modal = document.createElement('div');
      modal.className = 'msy-modal';
      backdrop.appendChild(modal);

    const dateLabel = new Date(slot.date).toLocaleString('hu-HU', {
            weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    modal.innerHTML = `
          <h3>Időpont foglalása</h3>
                <p class="msy-modal__sub">MedSoulYou — ${dateLabel}</p>
                      <form id="msy-booking-form">
                              <div class="msy-field">
                                        <label>Teljes név *</label>
                                                  <input name="patientName" required maxlength="50" />
                                                          </div>
                                                                  <div class="msy-field-row">
                                                                            <div class="msy-field">
                                                                                        <label>Telefonszám *</label>
                                                                                                    <input name="patientPhone" type="tel" required placeholder="+36..." />
                                                                                                              </div>
                                                                                                                        <div class="msy-field">
                                                                                                                                    <label>E-mail *</label>
                                                                                                                                                <input name="patientEmail" type="email" required />
                                                                                                                                                          </div>
                                                                                                                                                                  </div>
                                                                                                                                                                          <div class="msy-field-row">
                                                                                                                                                                                    <div class="msy-field">
                                                                                                                                                                                                <label>Születési dátum *</label>
                                                                                                                                                                                                            <input name="patientDateOfBirth" type="date" required />
                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                                <div class="msy-field">
                                                                                                                                                                                                                                            <label>Nem *</label>
                                                                                                                                                                                                                                                        <select name="patientGender" required>
                                                                                                                                                                                                                                                                      <option value="">Válassz…</option>
                                                                                                                                                                                                                                                                                    <option value="Male">Férfi</option>
                                                                                                                                                                                                                                                                                                  <option value="Female">Nő</option>
                                                                                                                                                                                                                                                                                                              </select>
                                                                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                        <div class="msy-field-row">
                                                                                                                                                                                                                                                                                                                                                  <div class="msy-field">
                                                                                                                                                                                                                                                                                                                                                              <label>Születési hely *</label>
                                                                                                                                                                                                                                                                                                                                                                          <input name="patientBirthPlace" required />
                                                                                                                                                                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                                                                                                                                                                                              <div class="msy-field">
                                                                                                                                                                                                                                                                                                                                                                                                          <label>Anyja neve *</label>
                                                                                                                                                                                                                                                                                                                                                                                                                      <input name="patientMothersName" required />
                                                                                                                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                <div class="msy-field">
                                                                                                                                                                                                                                                                                                                                                                                                                                                          <label>TAJ szám *</label>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <input name="patientTAJ" required placeholder="000-000-000" />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <div class="msy-field-row">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              <div class="msy-field">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          <label>Irányítószám *</label>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <input name="billingZip" required />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          <div class="msy-field">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <label>Település *</label>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  <input name="billingSettlement" required />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <div class="msy-field">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <label>Cím *</label>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                <input name="billingAddress" required placeholder="Utca, házszám" />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                <input type="hidden" name="billingCountry" value="Magyarország" />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <label class="msy-consent">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  <input type="checkbox" name="consent" required />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <span>Hozzájárulok, hogy a fenti adataimat a HovaForduljak a MedSoulYou (Medio foglalási rendszer) felé továbbítsa kizárólag ezen időpont lefoglalása céljából.</span>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    </label>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <div class="msy-error" id="msy-form-error" style="display:none;"></div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <div class="msy-actions">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              <button type="button" class="msy-btn msy-btn--ghost" id="msy-cancel-btn">Mégse</button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <button type="submit" class="msy-btn msy-btn--primary" id="msy-submit-btn">Foglalás megerősítése</button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      </form>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          `;

    document.body.appendChild(backdrop);

    modal.querySelector('#msy-cancel-btn').addEventListener('click', () => {
            document.body.removeChild(backdrop);
    });

    backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) document.body.removeChild(backdrop);
    });

    const form = modal.querySelector('#msy-booking-form');
      form.addEventListener('submit', async (e) => {
              e.preventDefault();
              const errorBox = modal.querySelector('#msy-form-error');
              const submitBtn = modal.querySelector('#msy-submit-btn');
              errorBox.style.display = 'none';
              submitBtn.disabled = true;
              submitBtn.textContent = 'Foglalás folyamatban…';

                                  const formData = new FormData(form);
              const payload = Object.fromEntries(formData.entries());
              payload.consent = form.consent.checked;
              payload.category = category;
              payload.date = slot.date;
              payload.length = slot.length;
              payload.doctorId = slot.doctorId;

                                  try {
                                            const res = await fetch('/api/medsoulyou-book', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify(payload),
                                            });
                                            const result = await res.json();
                                            if (!res.ok || !result.success) {
                                                        throw new Error(result.error || 'Ismeretlen hiba történt a foglalás során.');
                                            }

                modal.innerHTML = `
                          <h3>Foglalás megerősítve</h3>
                                    <p class="msy-success">A MedSoulYou-nál lefoglaltuk az időpontodat ${dateLabel}-kor.</p>
                                              <p class="msy-modal__sub">Visszaigazoló azonosító: ${result.authorizationCode || result.bookingId}</p>
                                                        <div class="msy-actions">
                                                                    <button type="button" class="msy-btn msy-btn--primary" id="msy-close-btn">Bezárás</button>
                                                                              </div>
                                                                                      `;
                                            modal.querySelector('#msy-close-btn').addEventListener('click', () => {
                                                        document.body.removeChild(backdrop);
                                            });

                if (typeof options.onBooked === 'function') {
                            options.onBooked(result);
                }
                                  } catch (err) {
                                            errorBox.textContent = err.message;
                                            errorBox.style.display = 'block';
                                            submitBtn.disabled = false;
                                            submitBtn.textContent = 'Foglalás megerősítése';
                                  }
      });
}

  window.MedSoulYouBooking = { render };
})();
