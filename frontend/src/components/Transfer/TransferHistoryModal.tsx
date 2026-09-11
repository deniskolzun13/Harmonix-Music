import React, { useState, useEffect } from 'react';
import { History, X, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Music2 } from 'lucide-react';
import { TransferTask } from '../../types';
import { getTransferHistory } from '../../api';
import { useBackNavigation } from '../../services/backNavigation';

interface TransferHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTask: (task: TransferTask) => void;
}

export const TransferHistoryModal: React.FC<TransferHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectTask,
}) => {
  const [tasks, setTasks] = useState<TransferTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'waiting_review' | 'failed'>('all');

  useBackNavigation('transfer_history_modal', isOpen, onClose, 70);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const statusParam = filter === 'all' ? undefined : filter;
    getTransferHistory(statusParam)
      .then((res) => {
        if (isMounted) {
          setTasks(res.items || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(err);
          setError('Не удалось загрузить историю переносов');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, filter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full sm:max-w-lg bg-[#161a23] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slideUp text-white select-none max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400">
              <History size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold">История переносов</h3>
              <p className="text-[11px] text-gray-400">Сохраняется в SQLite базе данных</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Фильтры */}
        <div className="flex gap-2 py-3 overflow-x-auto flex-shrink-0">
          {[
            { id: 'all', label: 'Все' },
            { id: 'completed', label: 'Успешные' },
            { id: 'waiting_review', label: 'Спорные (на проверке)' },
            { id: 'failed', label: 'Ошибки' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filter === f.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Список задач */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-3">
              <RefreshCw size={24} className="animate-spin text-blue-500" />
              <p className="text-xs">Загрузка истории...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-sm font-medium text-red-400 mb-1">{error}</p>
              <p className="text-xs text-gray-500">Убедитесь, что сервер Harmonix запущен</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Music2 size={32} className="mx-auto mb-2 text-gray-600" />
              <p className="text-sm font-semibold text-gray-300">В истории пока пусто</p>
              <p className="text-xs text-gray-500 mt-1">
                Здесь будут сохраняться все выполненные переносы плейлистов
              </p>
            </div>
          ) : (
            tasks.map((task) => {
              const dateStr = task.created_at
                ? new Date(task.created_at).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Недавно';

              const successPercent =
                task.total > 0 ? Math.round((task.matched / task.total) * 100) : 0;

              return (
                <div
                  key={task.task_id}
                  onClick={() => {
                    onSelectTask(task);
                    onClose();
                  }}
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer group active:scale-[0.99]"
                >
                  {/* Верхняя строка: Платформы и статус */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                      <span className="uppercase px-2 py-0.5 rounded bg-white/10 text-white">
                        {task.source_platform}
                      </span>
                      <ArrowRight size={12} className="text-gray-500" />
                      <span className="uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        {task.target_platform}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        task.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : task.status === 'waiting_review'
                          ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                          : task.status === 'failed'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {task.status === 'completed' && <CheckCircle2 size={10} />}
                      {task.status === 'waiting_review' && <AlertCircle size={10} />}
                      {task.status === 'completed'
                        ? 'Готово'
                        : task.status === 'waiting_review'
                        ? 'Требует проверки'
                        : task.status === 'failed'
                        ? 'Ошибка'
                        : 'В процессе'}
                    </span>
                  </div>

                  {/* Название целевого плейлиста */}
                  <h4 className="text-sm font-semibold text-white truncate mb-1">
                    {task.target_playlist_name || 'Перенос плейлиста'}
                  </h4>

                  {/* Статистика и дата */}
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
                    <span>
                      Перенесено: <strong className="text-white">{task.matched}</strong> из{' '}
                      {task.total} ({successPercent}%)
                    </span>
                    <span className="text-gray-500">{dateStr}</span>
                  </div>

                  {/* Прогресс-бар */}
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full transition-all ${
                        task.status === 'completed'
                          ? 'bg-emerald-500'
                          : task.status === 'waiting_review'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${successPercent}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
