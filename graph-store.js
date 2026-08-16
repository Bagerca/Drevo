import { Logger } from '../utils/logger.js';

export class GraphStore {
  constructor() {
    this.nodes = new Map();
    this.parentMap = new Map();       // Биологические родители
    this.stepParentMap = new Map();   // Приемные родители / Отчимы
    
    // Обновленная гармоничная и контрастная палитра семей
    this.familyColors = {
      'bebiya': '#ef4444',        // Красный
      'sviridov': '#2563eb',      // Синий
      'braun': '#92400e',         // Тёплый коричневый
      'vishnyakov': '#9f1239',    // Бордовый / Спелая вишня
      'liana': '#059669',         // Изумрудно-зеленый
      'trofimov': '#7c3aed',      // Индиго / Фиолетовый
      'danilov': '#0284c7',       // Лазурный / Cyan
      'natasha_fam': '#0d9488',   // Бирюзовый / Teal
      'nadezhda_fam': '#db2777',  // Розовый / Маджента
      'marina_fam': '#d97706',    // Янтарно-оранжевый
      'default': '#64748b'        // Сдержанный нейтральный серый
    };
  }

  processData(data) {
    data.forEach(person => this.nodes.set(person.id, person));
    
    // Двусторонние связи для супругов
    for (const person of this.nodes.values()) {
      if (person.partner && this.nodes.has(person.partner)) {
        const partnerNode = this.nodes.get(person.partner);
        partnerNode.partner = person.id;
      }
    }

    // Записываем явных кровных и приемных родителей
    for (const parent of this.nodes.values()) {
      if (parent.children) {
        parent.children.forEach(childId => {
          if (!this.parentMap.has(childId)) this.parentMap.set(childId, new Set());
          this.parentMap.get(childId).add(parent.id);
        });
      }
      if (parent.stepChildren) {
        parent.stepChildren.forEach(childId => {
          if (!this.stepParentMap.has(childId)) this.stepParentMap.set(childId, new Set());
          this.stepParentMap.get(childId).add(parent.id);
        });
      }
    }
    
    // Автоматически назначаем партнера родителем ТОЛЬКО если у ребенка нет 2-х явных кровных родителей
    for (const person of this.nodes.values()) {
      if (person.partner && person.children) {
        const partnerId = person.partner;
        person.children.forEach(childId => {
          if (!this.parentMap.has(childId)) this.parentMap.set(childId, new Set());
          
          const bioParents = this.parentMap.get(childId);
          const stepParents = this.stepParentMap.get(childId) || new Set();
          
          // Если партнер не отчим и у ребенка нет 2 кровных отцов/матерей - делаем партнеру кровную связь
          if (!stepParents.has(partnerId) && !bioParents.has(partnerId) && bioParents.size < 2) {
             bioParents.add(partnerId);
             const partnerNode = this.nodes.get(partnerId);
             if (!partnerNode.children) partnerNode.children = [];
             if (!partnerNode.children.includes(childId)) partnerNode.children.push(childId);
          }
        });
      }
    }
    
    Logger.info('Граф проиндексирован (палитра семей обновлена)', { nodes: this.nodes.size });
  }

  getPerson(id) { return this.nodes.get(id); }
  getColor(familyId) { return this.familyColors[familyId] || this.familyColors['default']; }
  
  getRoots() { 
    return Array.from(this.nodes.keys()).filter(id => {
      const person = this.nodes.get(id);
      
      if (this.parentMap.has(id) && this.parentMap.get(id).size > 0) return false;
      if (this.stepParentMap.has(id) && this.stepParentMap.get(id).size > 0) return false;
      
      if (person.partner) {
        const partnerId = person.partner;
        if (this.parentMap.has(partnerId) && this.parentMap.get(partnerId).size > 0) return false;
        if (this.stepParentMap.has(partnerId) && this.stepParentMap.get(partnerId).size > 0) return false;
        
        if (id > partnerId) return false;
      } else {
        if (person.children && person.children.length > 0) {
          const isFloatingCoParent = person.children.every(childId => {
            const bio = this.parentMap.get(childId) || new Set();
            const step = this.stepParentMap.get(childId) || new Set();
            const otherBio = bio.has(id) ? bio.size - 1 : bio.size;
            const otherStep = step.has(id) ? step.size - 1 : step.size;
            return (otherBio + otherStep) > 0;
          });
          
          if (isFloatingCoParent) return false;
        }
      }
      return true;
    }); 
  }
  
  getAllPersons() { return Array.from(this.nodes.values()); }
}