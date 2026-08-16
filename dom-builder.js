// ФАЙЛ: dom-builder.js

export class DOMBuilder {
  static createCard(person, isFocus, color, isPartner = false) {
    const card = document.createElement('div');
    card.className = 'person-card' + (isPartner ? ' partner-card' : '');
    
    if (person.isGroup) card.classList.add('group-card');
    card.id = `card-${person.id}`; 
    if (isFocus) card.classList.add('highlight');
    
    // Цвет записываем в CSS-переменную
    if (color) card.style.setProperty('--branch-color', color);

    // БЕЗОПАСНАЯ ЗАГРУЗКА КАРТИНКИ
    if (person.photo && person.photo.trim() !== '') {
      const wrap = document.createElement('div');
      wrap.className = 'avatar-wrapper';
      
      const img = document.createElement('img');
      img.className = 'avatar-img';
      img.alt = person.name || '';
      
      // Если картинка не найдена (404)
      img.onerror = () => {
        if (wrap.parentElement) {
          wrap.remove(); // Удаляем обертку (карточка становится компактной)
          // Даем сигнал перерисовать линии
          window.dispatchEvent(new Event('tree-layout-update'));
        }
      };
      
      img.src = person.photo;
      wrap.appendChild(img);
      card.appendChild(wrap);
    }
    
    // НОВОЕ: Создаем контейнер и текстовый узел для адаптивного имени
    const nameContainer = document.createElement('div');
    nameContainer.className = 'person-name-container';
    
    const nameText = document.createElement('span');
    nameText.className = 'person-name-text';
    nameText.textContent = person.name || '???';
    
    nameContainer.appendChild(nameText);
    card.appendChild(nameContainer);
    
    if (person.dates && person.dates.trim() !== '') {
      const datesEl = document.createElement('div');
      datesEl.className = 'person-dates';
      datesEl.textContent = person.dates;
      card.appendChild(datesEl);
    }

    return card;
  }

  static createFamilyUnit(personId) {
    const unit = document.createElement('div');
    unit.className = 'family-unit';
    unit.id = `unit-${personId}`; 
    return unit;
  }

  static createPartnerConnector(leftColor, rightColor) {
    const connector = document.createElement('div');
    connector.className = 'partner-connector';
    if (leftColor) connector.style.setProperty('--left-color', leftColor);
    if (rightColor) connector.style.setProperty('--right-color', rightColor);
    
    connector.innerHTML = '<div class="ring"></div>';
    return connector;
  }
}