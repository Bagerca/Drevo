// ФАЙЛ: js/ui/tree-renderer.js
import { DOMBuilder } from './dom-builder.js';
import { SvgDrawer } from './svg-drawer.js';
import { GraphAlgo } from '../data/graph-algo.js';

export class TreeRenderer {
  constructor(store, viewport) {
    this.store = store;
    this.viewport = viewport;
    this.treeContainer = document.getElementById('tree');
    this.svgLayer = document.getElementById('metro-lines');
    
    this.renderedNodes = new Set();
    this.treeLinks = [];
    this.crossLinks = [];
    this.currentFocusId = null;
    this.clickedFocusId = null;
    this.drawTimeout = null;

    this.resizeObserver = new ResizeObserver(() => this.scheduleDraw());
    this.resizeObserver.observe(this.viewport.wrapper);
    window.addEventListener('tree-layout-update', () => this.scheduleDraw());
    this.initInteraction();
  }

  scheduleDraw() {
    if (this.drawTimeout) clearTimeout(this.drawTimeout);
    this.drawTimeout = setTimeout(() => requestAnimationFrame(() => this.drawLines()), 100);
  }

  initInteraction() {
    this.treeContainer.addEventListener('click', (e) => {
      if (this.viewport.isPanning) return;
      const card = e.target.closest('.person-card');
      if (card) {
        const id = card.id.replace('card-', '');
        if (this.clickedFocusId === id) {
          this.clearHighlight(); 
          window.dispatchEvent(new CustomEvent('person-select', { detail: null }));
        } else {
          this.highlightPath(id);
          this.viewport.flyToElement(card);
          window.dispatchEvent(new CustomEvent('person-select', { detail: id }));
        }
      } else {
        this.clearHighlight(); 
        window.dispatchEvent(new CustomEvent('person-select', { detail: null }));
      }
    });
  }

  clearHighlight() {
    this.clickedFocusId = null;
    this.treeContainer.classList.remove('tree-dimmed');
    document.querySelectorAll('.path-active, .click-active').forEach(el => el.classList.remove('path-active', 'click-active'));
  }

  highlightPath(id) {
    this.clearHighlight();
    this.clickedFocusId = id;
    const allowedNodes = GraphAlgo.getFocusPath(this.store, id);
    this.treeContainer.classList.add('tree-dimmed');
    const activeCard = document.getElementById(`card-${id}`);
    if (activeCard) activeCard.classList.add('click-active');

    document.querySelectorAll('.person-card').forEach(card => {
      const cId = card.id.replace('card-', '');
      if (allowedNodes.has(cId)) card.classList.add('path-active');
    });
    document.querySelectorAll('.partner-connector').forEach(conn => {
      if (allowedNodes.has(conn.dataset.connectorId)) conn.classList.add('path-active');
    });
    document.querySelectorAll('.tree-link-path, .cross-link-path, .step-link-path').forEach(path => {
      if (allowedNodes.has(path.dataset.source) && allowedNodes.has(path.dataset.target)) path.classList.add('path-active');
    });
  }

  // ОПТИМИЗИРОВАНО: Батчинг операций DOM Read/Write для устранения Layout Thrashing
  fitTextSizes() {
    const nameTexts = Array.from(this.treeContainer.querySelectorAll('.person-name-text'));
    
    // Сброс размера у всех элементов без принудительного чтения стилей (Write)
    nameTexts.forEach(el => el.style.fontSize = '');

    // Единократное чтение стилей и размеров для всех карточек (Read)
    const metrics = nameTexts.map(el => {
      const sizePx = parseFloat(window.getComputedStyle(el).fontSize) || 15.2;
      return { el, sizePx, h: el.offsetHeight, maxH: sizePx * 1.2 * 2.2 };
    });

    // Отфильтровываем карточки, которым не нужна подгонка (оптимизирует 95% узлов)
    const toResize = metrics.filter(item => item.h > item.maxH);

    // Подгоняем только проблемные карточки (Write/Read цикл сведен к минимуму)
    toResize.forEach(item => {
      let currentSize = item.sizePx;
      while (item.el.offsetHeight > item.maxH && currentSize > 10) {
        currentSize -= 0.5;
        item.el.style.fontSize = `${currentSize}px`;
        item.maxH = currentSize * 1.2 * 2.2;
      }
    });
  }

  render(focusId = null) {
    this.clearHighlight(); 
    this.currentFocusId = focusId;
    this.treeContainer.innerHTML = '';
    this.renderedNodes.clear();
    this.treeLinks = [];
    this.crossLinks = [];
    this.svgLayer.innerHTML = '';

    let allowedNodes = new Set();
    if (this.currentFocusId) allowedNodes = GraphAlgo.getFocusPath(this.store, this.currentFocusId);

    const roots = this.store.getRoots();
    const ul = document.createElement('ul');
    
    roots.forEach(rootId => {
      if (this.currentFocusId && !allowedNodes.has(rootId)) return;
      const nodeEl = this.buildNode(rootId, allowedNodes, null);
      if (nodeEl) ul.appendChild(nodeEl);
    });
    
    this.treeContainer.appendChild(ul);
    setTimeout(() => {
      this.fitTextSizes(); 
      this.scheduleDraw();
      this.viewport.resetView();
    }, 50);
  }

  buildNode(personId, allowedNodes, parentColor) {
    if (this.renderedNodes.has(personId)) return null;

    const person = this.store.getPerson(personId);
    if (!person) return null;

    const color = person.familyId ? this.store.getColor(person.familyId) : parentColor;
    const li = document.createElement('li');
    li.dataset.nodeId = personId; 
    const unit = DOMBuilder.createFamilyUnit(personId);
    unit.appendChild(DOMBuilder.createCard(person, this.currentFocusId === person.id, color));
    this.renderedNodes.add(personId);

    const clusterNodes = new Set([personId]);

    if (person.partner) {
      const partner = this.store.getPerson(person.partner);
      if (partner) {
        if (!this.renderedNodes.has(partner.id)) {
          const partnerColor = partner.familyId ? this.store.getColor(partner.familyId) : color;
          if (!person.isGroup) {
            const connector = DOMBuilder.createPartnerConnector(color, partnerColor);
            const cId1 = personId;
            const cId2 = partner.id;
            connector.id = cId1 < cId2 ? `connector-${cId1}-${cId2}` : `connector-${cId2}-${cId1}`; 
            connector.dataset.connectorId = personId; 
            unit.appendChild(connector);
          }
          unit.appendChild(DOMBuilder.createCard(partner, this.currentFocusId === partner.id, partnerColor, true));
          this.renderedNodes.add(partner.id);
          clusterNodes.add(partner.id);
        } else {
          // Явно указываем тип 'cross' для перекрестных браков
          this.crossLinks.push({ sourceId: personId, targetId: partner.id, fromId: `card-${personId}`, toId: `card-${partner.id}`, color: color, type: 'cross' });
        }
      }
    }

    const childrenToRender = new Set();
    clusterNodes.forEach(clusterMemberId => {
      const member = this.store.getPerson(clusterMemberId);
      if (member.children) member.children.forEach(c => childrenToRender.add(c));
      if (member.stepChildren) member.stepChildren.forEach(c => childrenToRender.add(c));
    });

    const coParents = new Set();
    childrenToRender.forEach(childId => {
      const childBio = this.store.parentMap.get(childId) || new Set();
      childBio.forEach(pId => {
        if (!clusterNodes.has(pId) && !this.renderedNodes.has(pId)) coParents.add(pId);
      });
    });

    coParents.forEach(cpId => {
      const cpNode = this.store.getPerson(cpId);
      if (cpNode) {
        const spacer = document.createElement('div');
        spacer.style.width = '16px'; 
        unit.appendChild(spacer);
        
        const cpColor = cpNode.familyId ? this.store.getColor(cpNode.familyId) : color;
        unit.appendChild(DOMBuilder.createCard(cpNode, this.currentFocusId === cpNode.id, cpColor, true));
        this.renderedNodes.add(cpId);
        clusterNodes.add(cpId);
      }
    });

    li.appendChild(unit);

    if (childrenToRender.size > 0) {
      const childrenUl = document.createElement('ul');
      let hasVisibleChildren = false;

      childrenToRender.forEach(childId => {
        if (this.currentFocusId && !allowedNodes.has(childId)) return;
        
        const child = this.store.getPerson(childId);
        const childColor = child && child.familyId ? this.store.getColor(child.familyId) : color;
        
        const childLi = this.buildNode(childId, allowedNodes, childColor);
        if (childLi) {
          childrenUl.appendChild(childLi);
          hasVisibleChildren = true;
        }

        const clusterParents = [];
        clusterNodes.forEach(pId => {
          const isBio = this.store.parentMap.get(childId)?.has(pId);
          const isStep = this.store.stepParentMap.get(childId)?.has(pId);
          if (isBio || isStep) clusterParents.push({ id: pId, isBio, isStep });
        });

        const processed = new Set();
        clusterParents.forEach(pData => {
          if (processed.has(pData.id)) return;

          const pNode = this.store.getPerson(pData.id);
          const pColor = pNode.familyId ? this.store.getColor(pNode.familyId) : childColor;
          
          const partnerData = clusterParents.find(p => p.id === pNode.partner);

          if (partnerData) {
              processed.add(pData.id);
              processed.add(partnerData.id);

              const cId1 = pData.id;
              const cId2 = partnerData.id;
              const ringId = cId1 < cId2 ? `connector-${cId1}-${cId2}` : `connector-${cId2}-${cId1}`;

              const partnerNode = this.store.getPerson(partnerData.id);
              const partnerColor = partnerNode.familyId ? this.store.getColor(partnerNode.familyId) : childColor;

              const pushLink = (sourceId, fromId, targetColor, type) => {
                  const linkData = { sourceId, targetId: childId, fromId, toId: `card-${childId}`, color: targetColor, type };
                  if (childLi) this.treeLinks.push(linkData);
                  else if (this.renderedNodes.has(childId)) this.crossLinks.push(linkData);
              };

              if (pData.isBio && partnerData.isBio) {
                  pushLink(pData.id, ringId, childColor, 'bio'); 
              } else if (pData.isStep && partnerData.isStep) {
                  pushLink(pData.id, ringId, childColor, 'step'); 
              } else {
                  if (pData.isBio) {
                      pushLink(pData.id, `card-${pData.id}`, pColor, 'bio');
                  } else {
                      pushLink(pData.id, ringId, pColor, 'step');
                  }
                  
                  if (partnerData.isBio) {
                      pushLink(partnerData.id, `card-${partnerData.id}`, partnerColor, 'bio');
                  } else {
                      pushLink(partnerData.id, ringId, partnerColor, 'step');
                  }
              }
          } else {
              processed.add(pData.id);
              const type = pData.isStep ? 'step' : 'bio';
              const linkData = { sourceId: pData.id, targetId: childId, fromId: `card-${pData.id}`, toId: `card-${childId}`, color: pColor, type };
              if (childLi) this.treeLinks.push(linkData);
              else if (this.renderedNodes.has(childId)) this.crossLinks.push(linkData);
          }
        });
      });
      
      if (hasVisibleChildren) li.appendChild(childrenUl);
    }
    return li;
  }

  drawLines() {
    SvgDrawer.drawLines(this.svgLayer, this.viewport.wrapper, this.treeLinks, this.crossLinks, this.viewport.scale);
  }
}