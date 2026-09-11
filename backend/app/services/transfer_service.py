import asyncio
import logging
import uuid
from typing import Dict, Optional
from app.models import PlatformEnum, TransferRequest, TransferTask, TransferTrackResult, Track
from app.platforms.manager import manager
from app.services.matcher import find_best_match
from app.services.transfer_db import (
    init_transfer_db,
    cleanup_old_transfers,
    save_task_record,
    save_track_result,
    load_task_from_db
)

logger = logging.getLogger("harmonix.transfer")

class TransferService:
    def __init__(self):
        self.tasks: Dict[str, TransferTask] = {}
        init_transfer_db()
        cleanup_old_transfers(days=30)

    def get_task(self, task_id: str) -> Optional[TransferTask]:
        task = self.tasks.get(task_id)
        if task is not None:
            return task
        db_task = load_task_from_db(task_id)
        if db_task is not None:
            self.tasks[task_id] = db_task
            return db_task
        return None

    async def start_transfer(self, req: TransferRequest) -> TransferTask:
        task_id = str(uuid.uuid4())
        task = TransferTask(
            task_id=task_id,
            source_platform=req.source_platform,
            target_platform=req.target_platform,
            status="running",
            message="Получение списка треков из источника..."
        )
        self.tasks[task_id] = task
        save_task_record(task)

        # Запускаем фоновую задачу
        asyncio.create_task(self._run_transfer(task_id, req))
        return task

    async def _run_transfer(self, task_id: str, req: TransferRequest):
        task = self.tasks[task_id]
        try:
            src_adapter = manager.get_adapter(req.source_platform)
            target_adapter = manager.get_adapter(req.target_platform)

            # 1. Получаем треки из источника
            source_tracks = src_adapter.get_playlist_tracks(req.source_playlist_id)
            if not source_tracks:
                task.status = "failed"
                task.message = "Не удалось найти треки в выбранном плейлисте источника"
                save_task_record(task)
                return

            task.total = len(source_tracks)
            task.message = f"Найдено {task.total} треков. Подготовка целевого плейлиста..."
            save_task_record(task)

            # 2. Создаем или выбираем целевой плейлист
            pl_name = req.target_playlist_name or f"Перенос: {req.source_platform.value.upper()} в {req.target_platform.value.upper()}"
            target_playlist = None
            if req.create_new:
                target_playlist = target_adapter.create_playlist(
                    title=pl_name,
                    description=f"Автоматически перенесено сервисом Harmonix ({req.source_platform.value} -> {req.target_platform.value})"
                )
                target_playlist_id = target_playlist.id if target_playlist else "favorites"
            else:
                target_playlist_id = "favorites"

            task.target_playlist_name = pl_name
            save_task_record(task)

            # 3. Сопоставляем каждый трек с адаптивной задержкой
            matched_tracks_to_add = []
            current_delay = 0.35  # Базовая пауза 0.3-0.5 сек
            consecutive_errors = 0

            for index, src_track in enumerate(source_tracks, start=1):
                task.message = f"Сопоставление ({index}/{task.total}): {src_track.artist} - {src_track.title}"
                
                try:
                    # Поисковый запрос
                    query = f"{src_track.artist} {src_track.title}"
                    candidates = target_adapter.search_tracks(query, limit=5)
                    
                    best_match, score = find_best_match(src_track, candidates)

                    if best_match and score >= 65.0:
                        status = "matched" if score >= 80.0 else "low_confidence"
                        res = TransferTrackResult(
                            source_track=src_track,
                            matched_track=best_match,
                            confidence=score,
                            status=status
                        )
                        task.results.append(res)
                        task.matched += 1
                        matched_tracks_to_add.append(best_match)
                    else:
                        res = TransferTrackResult(
                            source_track=src_track,
                            matched_track=None,
                            confidence=score,
                            status="not_found"
                        )
                        task.results.append(res)
                        task.failed += 1

                    # Успешный шаг: сбрасываем счетчик ошибок и плавно возвращаем паузу к базовой
                    consecutive_errors = 0
                    current_delay = max(0.3, current_delay * 0.9)

                except Exception as track_err:
                    logger.warning(
                        f"Ошибка переноса трека '{src_track.artist} - {src_track.title}': {track_err}",
                        exc_info=False
                    )
                    res = TransferTrackResult(
                        source_track=src_track,
                        matched_track=None,
                        confidence=0.0,
                        status="error",
                        error_detail=str(track_err)
                    )
                    task.results.append(res)
                    task.failed += 1

                    # Ошибка: адаптивно увеличиваем задержку
                    consecutive_errors += 1
                    current_delay = min(5.0, max(0.5, current_delay * 1.5 + (consecutive_errors * 0.3)))

                task.processed = index
                save_track_result(task_id, res)
                save_task_record(task)

                # Адаптивная пауза между треками
                await asyncio.sleep(current_delay)

            # 4. Добавляем сопоставленные треки в целевой сервис
            if matched_tracks_to_add:
                task.message = f"Добавление {len(matched_tracks_to_add)} треков в {req.target_platform.value.upper()}..."
                save_task_record(task)
                try:
                    added_count = target_adapter.add_tracks_to_playlist(target_playlist_id, matched_tracks_to_add)
                except Exception as add_err:
                    logger.error(f"Ошибка при добавлении треков в целевой плейлист: {add_err}")
                    added_count = 0
            else:
                added_count = 0

            task.status = "completed"
            task.message = f"Перенос завершен! Успешно сопоставлено и добавлено {added_count} из {task.total} треков."
            save_task_record(task)

        except Exception as e:
            logger.error(f"Ошибка в процессе переноса: {e}", exc_info=True)
            task.status = "failed"
            task.message = f"Ошибка: {str(e)}"
            save_task_record(task)

transfer_service = TransferService()
