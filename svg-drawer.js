// ФАЙЛ: js/ui/svg-drawer.js

export class SvgDrawer {
  static drawLines(svgLayer, wrapper, treeLinks, crossLinks, scale) {
    if (!svgLayer || !wrapper) return;
    svgLayer.innerHTML = '';

    const scrollW = wrapper.scrollWidth;
    const scrollH = wrapper.scrollHeight;
    svgLayer.style.width = scrollW + 'px';
    svgLayer.style.height = scrollH + 'px';
    svgLayer.setAttribute('viewBox', `0 0 ${scrollW} ${scrollH}`);

    const rectCache = new Map();
    const wrapRect = wrapper.getBoundingClientRect();
    const currentScale = scale || 1;
    const RADIUS = 12;

    const getLocalPoint = (element, alignX = 0.5, alignY = 1.0) => {
      let rect = rectCache.get(element);
      if (!rect) {
        rect = element.getBoundingClientRect();
        rectCache.set(element, rect);
      }
      return {
        x: (rect.left - wrapRect.left) / currentScale + (rect.width / currentScale) * alignX,
        y: (rect.top - wrapRect.top) / currentScale + (rect.height / currentScale) * alignY,
        width: rect.width / currentScale,
        height: rect.height / currentScale,
        left: (rect.left - wrapRect.left) / currentScale,
        top: (rect.top - wrapRect.top) / currentScale
      };
    };

    const createPathElement = (d, color, source, target, type) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      if (type === 'cross') path.setAttribute('class', 'cross-link-path');
      else if (type === 'step') path.setAttribute('class', 'step-link-path');
      else path.setAttribute('class', 'tree-link-path');

      if (source) path.dataset.source = source;
      if (target) path.dataset.target = target;
      if (color) path.style.stroke = color;
      return path;
    };

    const allLinks = [
      ...treeLinks.map(l => ({ ...l, isCross: false })),
      ...crossLinks.map(l => ({ ...l, isCross: true }))
    ];

    const incomingMap = new Map();
    const sourceGroups = new Map();

    // 1. Извлекаем координаты и жестко группируем по источнику (чтобы братья были на одной линии)
    allLinks.forEach(link => {
      const elFrom = document.getElementById(link.fromId);
      const elTo = document.getElementById(link.toId);
      if (!elFrom || !elTo) return;

      const ring = elFrom.querySelector('.ring');
      const fromSourceEl = ring || elFrom;
      const fromBounds = getLocalPoint(fromSourceEl, 0.5, 1.0);
      const toBounds = getLocalPoint(elTo, 0.5, 0.0);

      link.x1 = fromBounds.x;
      link.y1 = fromBounds.y;
      link.cardLeft = toBounds.left;
      link.cardWidth = toBounds.width;
      link.y2 = toBounds.y;

      const unitFrom = elFrom.closest('.family-unit');
      link.unitBottomY = link.y1;
      if (unitFrom) {
        link.unitBottomY = getLocalPoint(unitFrom, 0.5, 1.0).y;
      }

      if (!incomingMap.has(link.toId)) incomingMap.set(link.toId, []);
      incomingMap.get(link.toId).push(link);

      if (link.type === 'bio' || link.type === 'step') {
        const sourceKey = `${link.fromId}_${link.type}`;
        if (!sourceGroups.has(sourceKey)) sourceGroups.set(sourceKey, []);
        sourceGroups.get(sourceKey).push(link);
      }
    });

    // 2. Распределяем порты на карточках детей
    incomingMap.forEach((links) => {
      links.sort((a, b) => (a.x1 || 0) - (b.x1 || 0));
      const totalPorts = links.length;
      links.forEach((link, index) => {
        const portFraction = (index + 1) / (totalPorts + 1);
        link.x2 = link.cardLeft + (link.cardWidth * portFraction);
      });
    });

    // 3. Вычисляем идеальную высоту шины для КАЖДОГО родителя
    sourceGroups.forEach((group) => {
      const localChildren = group.filter(l => !l.isCross);
      let highestTargetY = Math.min(...group.map(l => l.y2));
      
      if (localChildren.length > 0) {
        highestTargetY = Math.min(...localChildren.map(l => l.y2));
      }

      const parentBottom = group[0].unitBottomY;
      // Временно сохраняем идеальную середину для этой группы (массива)
      group.idealBusY = parentBottom + (highestTargetY - parentBottom) / 2;
    });

    // 4. СИСТЕМА КОРИДОРОВ (Раздвигаем разные шины, если они легли друг на друга)
    const corridors = new Map();
    sourceGroups.forEach((group) => {
      // Группируем шины, которые оказались на одной высоте (в пределах 10px)
      const corridorKey = Math.round(group.idealBusY / 10) * 10;
      if (!corridors.has(corridorKey)) corridors.set(corridorKey, []);
      corridors.get(corridorKey).push(group);
    });

    corridors.forEach((groupsArray) => {
      // Сортируем: Кровные семьи выше, Отчимы ниже
      groupsArray.sort((groupA, groupB) => {
        const weightA = groupA[0].type === 'step' ? 2 : 1;
        const weightB = groupB[0].type === 'step' ? 2 : 1;
        return weightA - weightB;
      });

      const spacing = 12; // Шаг в пикселях между параллельными шинами разных отцов
      const totalBuses = groupsArray.length;
      const startOffset = -((totalBuses - 1) * spacing) / 2;

      // Раздвигаем шины внутри коридора и раздаем финальную Y-координату детям
      groupsArray.forEach((group, index) => {
        const finalBusY = group.idealBusY + startOffset + (index * spacing);
        group.forEach(link => {
          link.assignedBusY = finalBusY;
        });
      });
    });

    const fragment = document.createDocumentFragment();

    // 5. Построение путей
    allLinks.forEach(link => {
      if (link.x1 === undefined || link.x2 === undefined) return;

      if (link.isCross) {
        if (link.type === 'bio' || link.type === 'step') {
          // Кросс-линия использует свою строго выделенную шину
          const busY = link.assignedBusY;
          const dirX = link.x2 > link.x1 ? 1 : -1;
          
          const takeoffDistance = Math.min(120, Math.max(30, Math.abs(link.x2 - link.x1) * 0.25));
          const takeoffX = link.x1 + (dirX * takeoffDistance);
          const safeR = Math.min(RADIUS, Math.abs(busY - link.y1) / 2, takeoffDistance / 2);

          // Умный горизонтальный импульс при взлете в другую семью
          const cp1x = takeoffX + (link.x2 - takeoffX) * 0.5;
          const cp1y = busY;
          const cp2x = link.x2;
          const cp2y = link.y2 - Math.abs(link.y2 - busY) * 0.5;

          const d = `M ${link.x1} ${link.y1} ` +
                    `L ${link.x1} ${busY - safeR} ` +
                    `Q ${link.x1} ${busY} ${link.x1 + dirX * safeR} ${busY} ` +
                    `L ${takeoffX} ${busY} ` +
                    `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${link.x2} ${link.y2}`;

          fragment.appendChild(createPathElement(d, link.color, link.sourceId, link.targetId, link.type));
        } else {
          // Дуги партнерских связей
          const cp1x = link.x1;
          const cp1y = link.y1 + Math.abs(link.y2 - link.y1) * 0.4;
          const cp2x = link.x2;
          const cp2y = link.y2 - Math.abs(link.y2 - link.y1) * 0.4;
          
          const d = `M ${link.x1} ${link.y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${link.x2} ${link.y2}`;
          fragment.appendChild(createPathElement(d, link.color, link.sourceId, link.targetId, 'cross'));
        }
      } else {
        // Локальные дети (родные братья/сестры на общей шине)
        let d = '';
        if (Math.abs(link.x1 - link.x2) < 2) {
          d = `M ${link.x1} ${link.y1} L ${link.x2} ${link.y2}`;
        } else {
          const busY = link.assignedBusY;
          const dirX = link.x2 > link.x1 ? 1 : -1;
          
          const currentRadius = Math.min(
            RADIUS,
            Math.abs(link.x2 - link.x1) / 2,
            Math.abs(busY - link.y1) / 2,
            Math.abs(link.y2 - busY) / 2
          );

          d = `M ${link.x1} ${link.y1} ` +
              `L ${link.x1} ${busY - currentRadius} ` +
              `Q ${link.x1} ${busY} ${link.x1 + dirX * currentRadius} ${busY} ` +
              `L ${link.x2 - dirX * currentRadius} ${busY} ` +
              `Q ${link.x2} ${busY} ${link.x2} ${busY + currentRadius} ` +
              `L ${link.x2} ${link.y2}`;
        }
        fragment.appendChild(createPathElement(d, link.color, link.sourceId, link.targetId, link.type));
      }
    });

    svgLayer.appendChild(fragment);
  }
}