import { App as CapApp } from '@capacitor/app';
import { useEffect } from 'react';

export type BackHandler = () => boolean;

interface RegisteredHandler {
  id: string;
  handler: BackHandler;
  priority: number;
}

class BackNavigationManager {
  private handlers: RegisteredHandler[] = [];
  private lastBackPressTime = 0;
  private toastTimeout: any = null;
  private isInitialized = false;

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Обработка системного жеста "Назад" и кнопки Back в Android приложении (Capacitor)
    try {
      CapApp.addListener('backButton', () => {
        this.handleBack(true);
      });
    } catch (e) {
      console.warn('Capacitor backButton listener init warning:', e);
    }

    // 2. Обработка жеста "Назад" в мобильном браузере / PWA через History API
    window.addEventListener('popstate', () => {
      const handled = this.handleBack(false);
      if (handled) {
        // Если обработали (закрыли окно), восстанавливаем историю, чтобы следующий жест тоже сработал
        window.history.pushState({ app: 'harmonix' }, '');
      }
    });

    // 3. Распознавание экранного свайпа от левого края (Touch gesture edge swipe)
    let touchStartX = 0;
    let touchStartY = 0;
    let isEdgeSwipe = false;

    window.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          // Свайп считается краевым, если начался у левого края (до 40px)
          isEdgeSwipe = touchStartX <= 40;
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchend',
      (e) => {
        if (!isEdgeSwipe || e.changedTouches.length !== 1) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);

        // Горизонтальный свайп вправо > 70px и угол отклонения по вертикали < 50px
        if (deltaX > 70 && deltaY < 50) {
          this.handleBack(false);
        }
        isEdgeSwipe = false;
      },
      { passive: true }
    );

    // Инициализируем стартовую точку истории для PWA
    try {
      if (!window.history.state?.app) {
        window.history.replaceState({ app: 'harmonix' }, '');
      }
    } catch {}
  }

  /**
   * Регистрация обработчика назад (например, закрытие модалки или переход на вкладку плеера)
   */
  public register(id: string, handler: BackHandler, priority = 10): () => void {
    this.handlers = this.handlers.filter((h) => h.id !== id);
    this.handlers.push({ id, handler, priority });
    // Сортируем: высокий приоритет первым
    this.handlers.sort((a, b) => b.priority - a.priority);

    // Добавляем запись в историю для браузерного свайпа
    try {
      window.history.pushState({ handlerId: id, app: 'harmonix' }, '');
    } catch {}

    return () => {
      this.unregister(id);
    };
  }

  public unregister(id: string) {
    this.handlers = this.handlers.filter((h) => h.id !== id);
  }

  /**
   * Выполнение действия "Назад"
   */
  public handleBack(fromSystemButton = true): boolean {
    // 1. Проверяем зарегистрированные обработчики (модалки, вкладки)
    for (const item of this.handlers) {
      try {
        const handled = item.handler();
        if (handled) {
          // Обработчик успешно перехватил действие (закрыл экран)
          return true;
        }
      } catch (err) {
        console.error('Error executing back handler for', item.id, err);
      }
    }

    // 2. Если ничего не открыто и мы на главном экране приложения
    if (fromSystemButton) {
      const now = Date.now();
      if (now - this.lastBackPressTime < 2000) {
        // Двойное нажатие "Назад" на главном экране — закрываем приложение
        try {
          CapApp.exitApp();
        } catch {}
      } else {
        this.lastBackPressTime = now;
        this.showExitToast();
      }
    }

    return false;
  }

  private showExitToast() {
    let toast = document.getElementById('harmonix-exit-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'harmonix-exit-toast';
      toast.className =
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#161922]/95 border border-white/20 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-lg pointer-events-none transition-all duration-300 transform opacity-0 translate-y-2 flex items-center gap-2';
      toast.innerHTML = '<span>Нажмите «Назад» ещё раз для выхода</span>';
      document.body.appendChild(toast);
    }

    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 8px)';
      }
    }, 2000);
  }
}

export const backNavigation = new BackNavigationManager();

/**
 * React-хук для привязки компонента к системному жесту "Назад"
 */
export function useBackNavigation(
  id: string,
  isActive: boolean,
  onBack: () => void,
  priority = 10
) {
  useEffect(() => {
    if (!isActive) return;

    const unregister = backNavigation.register(
      id,
      () => {
        onBack();
        return true;
      },
      priority
    );

    return () => unregister();
  }, [id, isActive, onBack, priority]);
}
