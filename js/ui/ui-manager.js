// ФАЙЛ: js/ui/ui-manager.js

export class UIManager {
  constructor(renderer, store, viewport) {
    this.renderer = renderer;
    this.store = store;
    this.viewport = viewport;
    
    this.modal = document.getElementById('welcome-modal');
    this.searchInput = document.getElementById('person-search');
    this.autocompleteList = document.getElementById('autocomplete-list');
    
    this.btnShowAll = document.getElementById('btn-show-all');
    this.btnReset = document.getElementById('btn-reset');
    this.btnSearch = document.getElementById('btn-search'); 
    this.loader = document.getElementById('loader');
    this.themeToggle = document.getElementById('theme-toggle');

    this.panel = document.getElementById('person-panel');
    this.panelCloseBtn = document.getElementById('close-panel');
    this.panelAvatar = document.getElementById('panel-avatar');
    this.panelName = document.getElementById('panel-name');
    this.panelDates = document.getElementById('panel-dates');
    this.panelBadge = document.getElementById('panel-badge');
    this.panelBio = document.getElementById('panel-bio');

    this.searchableData = [];
    this.searchTimeout = null; // Переменная для дебаунса

    this.initTheme();
    this.initEvents();
  }

  hideLoader() {
    this.loader.style.opacity = '0';
    setTimeout(() => this.loader.style.display = 'none', 400);
  }

  showError(msg) {
    this.loader.innerHTML = `<p style="color: #ef4444; font-weight: bold;">${msg}</p>`;
  }

  initSearchData() {
    this.searchableData = this.store.getAllPersons()
      .filter(p => !p.isGroup) 
      .sort((a, b) => a.name.localeCompare(b.name));
      
    this.renderAutocomplete('');
  }

  initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
      this.themeToggle.textContent = '☀️ Светлая тема';
    } else {
      this.themeToggle.textContent = '🌙 Темная тема';
    }

    this.themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const isDark = document.body.classList.contains('dark-theme');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      this.themeToggle.textContent = isDark ? '☀️ Светлая тема' : '🌙 Темная тема';
    });
  }

  renderAutocomplete(query) {
    this.autocompleteList.innerHTML = '';
    
    const lowerQuery = query ? query.toLowerCase() : '';
    
    const filtered = this.searchableData.filter(p => {
      if (!lowerQuery) return true; 
      const searchString = (p.name + ' ' + (p.dates || '')).toLowerCase();
      return searchString.includes(lowerQuery);
    });

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'autocomplete-item empty';
      empty.textContent = 'Никого не найдено...';
      this.autocompleteList.appendChild(empty);
    } else {
      filtered.forEach(p => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        
        let highlightedName = p.name;
        if (lowerQuery) {
          const regex = new RegExp(`(${query})`, "gi");
          highlightedName = p.name.replace(regex, "<strong>$1</strong>");
        }
        
        let avatarHtml = '';
        if (p.photo && p.photo.trim() !== '') {
          avatarHtml = `<img src="${p.photo}" class="search-avatar" alt="" onerror="this.remove()">`;
        }

        let badgeHtml = '';
        if (p.familyId) {
          const color = this.store.getColor(p.familyId);
          const bgColor = color + '26';
          badgeHtml = `<span class="family-badge" style="color: ${color}; background-color: ${bgColor};">${p.familyId.toUpperCase()}</span>`;
        }

        item.innerHTML = `
          ${avatarHtml}
          <div class="search-info">
            <div class="search-name">${highlightedName}</div>
            <div class="search-sub">
              ${p.dates ? `<span class="search-dates">${p.dates}</span>` : ''}
              ${badgeHtml}
            </div>
          </div>
        `;
        
        item.addEventListener('click', () => {
          this.searchInput.value = '';
          this.triggerRenderAndFly(p.id);
        });
        
        this.autocompleteList.appendChild(item);
      });
    }
  }

  openPanel(id) {
    if (!id) {
      this.panel.classList.add('hidden');
      return;
    }
    
    const person = this.store.getPerson(id);
    if (!person) return;

    this.panelName.textContent = person.name;
    
    if (person.dates) {
      this.panelDates.textContent = person.dates;
      this.panelDates.style.display = 'inline-block';
    } else {
      this.panelDates.style.display = 'none';
    }

    if (person.familyId) {
      const color = this.store.getColor(person.familyId);
      this.panelBadge.textContent = person.familyId.toUpperCase();
      this.panelBadge.style.color = color;
      this.panelBadge.style.backgroundColor = color + '26';
      this.panelBadge.style.display = 'inline-block';
    } else {
      this.panelBadge.style.display = 'none';
    }

    this.panelAvatar.innerHTML = '';
    const borderColor = person.familyId ? this.store.getColor(person.familyId) : 'var(--border-color)';
    if (person.photo) {
       this.panelAvatar.innerHTML = `<img src="${person.photo}" alt="" onerror="this.parentElement.innerHTML='<div class=\\'panel-avatar-empty\\' style=\\'border-color: ${borderColor}\\'></div>'">`;
    } else {
       this.panelAvatar.innerHTML = `<div class="panel-avatar-empty" style="border-color: ${borderColor}"></div>`;
    }

    if (person.bio && person.bio.trim() !== '') {
      this.panelBio.textContent = person.bio;
      this.panelBio.classList.remove('empty-bio');
    } else {
      this.panelBio.textContent = 'Описание отсутствует...';
      this.panelBio.classList.add('empty-bio');
    }

    this.panel.classList.remove('hidden');
  }

  triggerRenderAndFly(id) {
    this.renderer.render(id);
    this.modal.classList.add('hidden');
    
    this.btnReset.style.display = id ? 'block' : 'none';
    
    if (id) {
      this.openPanel(id);
      setTimeout(() => {
        const card = document.getElementById(`card-${id}`);
        if (card) {
          this.renderer.highlightPath(id); 
          this.viewport.flyToElement(card); 
        }
      }, 100);
    } else {
      this.openPanel(null); 
      this.viewport.resetView(); 
    }
  }

  initEvents() {
    // ОПТИМИЗАЦИЯ: Вводим Debounce для поля поиска (задержка 150мс)
    this.searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      this.searchTimeout = setTimeout(() => {
        this.renderAutocomplete(query);
      }, 150);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.modal.classList.contains('hidden')) {
          this.modal.classList.add('hidden');
        } else if (!this.panel.classList.contains('hidden')) {
          this.openPanel(null);
        }
      }
    });

    this.btnShowAll.addEventListener('click', () => this.triggerRenderAndFly(null));
    
    this.btnReset.addEventListener('click', () => {
      this.triggerRenderAndFly(null);
      this.renderer.clearHighlight();
      this.openPanel(null);
      this.btnReset.style.display = 'none';
    });
    
    this.btnSearch.addEventListener('click', () => {
      this.searchInput.value = '';
      this.renderAutocomplete('');
      this.modal.classList.remove('hidden');
      setTimeout(() => this.searchInput.focus(), 100);
    });

    window.addEventListener('person-select', (e) => {
      const id = e.detail;
      this.openPanel(id);
      this.btnReset.style.display = id ? 'block' : 'none';
    });

    this.panelCloseBtn.addEventListener('click', () => {
       this.openPanel(null);
    });
  }
}
