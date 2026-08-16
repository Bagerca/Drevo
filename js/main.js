import { Logger } from './utils/logger.js';
import { GraphStore } from './data/graph-store.js';
import { ViewportController } from './ui/viewport.js';
import { TreeRenderer } from './ui/tree-renderer.js';
import { UIManager } from './ui/ui-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
  Logger.info('Инициализация приложения...');

  const store = new GraphStore();
  const viewport = new ViewportController('tree-container', 'tree-wrapper');
  const renderer = new TreeRenderer(store, viewport);
  // Передаем viewport в UIManager для работы смарт-камеры
  const ui = new UIManager(renderer, store, viewport);

  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    store.processData(data);
    
    ui.initSearchData(); // Инициализация поиска
    ui.hideLoader();
    
    // Рендерим дерево при старте, чтобы фон за модалкой не был пустым
    renderer.render();
    
  } catch (error) {
    Logger.error('Критическая ошибка загрузки', error);
    ui.showError('Ошибка загрузки данных. Проверьте JSON.');
  }
});