import sqlite3
import time
import logging
from typing import Optional, List, Dict, Any
from app.config import DATA_DIR
from app.models import PlatformEnum, TransferTask, TransferTrackResult, Track

logger = logging.getLogger("harmonix.transfer_db")

DB_PATH = DATA_DIR / "transfers.db"

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_transfer_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transfer_tasks (
                task_id TEXT PRIMARY KEY,
                source_platform TEXT,
                target_platform TEXT,
                status TEXT,
                total_tracks INT DEFAULT 0,
                matched_tracks INT DEFAULT 0,
                failed_tracks INT DEFAULT 0,
                processed_tracks INT DEFAULT 0,
                target_playlist_name TEXT,
                target_playlist_id TEXT,
                message TEXT,
                created_at REAL,
                updated_at REAL
            )
        """)
        try:
            conn.execute("ALTER TABLE transfer_tasks ADD COLUMN target_playlist_id TEXT")
        except sqlite3.OperationalError:
            pass
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transfer_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT,
                source_title TEXT,
                source_artist TEXT,
                matched_title TEXT,
                matched_artist TEXT,
                matched_id TEXT,
                confidence REAL,
                status TEXT,
                error_message TEXT,
                FOREIGN KEY(task_id) REFERENCES transfer_tasks(task_id) ON DELETE CASCADE
            )
        """)
        conn.commit()

def cleanup_old_transfers(days: int = 30) -> int:
    """Удаляет задачи старше указанного количества дней (по умолчанию 30)"""
    cutoff = time.time() - (days * 86400)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM transfer_results WHERE task_id IN (SELECT task_id FROM transfer_tasks WHERE created_at < ?)", (cutoff,))
        cur.execute("DELETE FROM transfer_tasks WHERE created_at < ?", (cutoff,))
        deleted = cur.rowcount
        conn.commit()
        if deleted > 0:
            logger.info(f"Очищено {deleted} устаревших задач переноса старше {days} дней")
        return deleted

def save_task_record(task: TransferTask, created_at: Optional[float] = None, updated_at: Optional[float] = None):
    """Создает или обновляет запись задачи в SQLite"""
    now = time.time()
    up_time = updated_at or now
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT created_at FROM transfer_tasks WHERE task_id = ?", (task.task_id,))
        row = cur.fetchone()
        cr_time = row["created_at"] if row else (created_at or now)

        conn.execute("""
            INSERT INTO transfer_tasks (
                task_id, source_platform, target_platform, status,
                total_tracks, matched_tracks, failed_tracks, processed_tracks,
                target_playlist_name, target_playlist_id, message, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(task_id) DO UPDATE SET
                status = excluded.status,
                total_tracks = excluded.total_tracks,
                matched_tracks = excluded.matched_tracks,
                failed_tracks = excluded.failed_tracks,
                processed_tracks = excluded.processed_tracks,
                target_playlist_name = excluded.target_playlist_name,
                target_playlist_id = excluded.target_playlist_id,
                message = excluded.message,
                updated_at = excluded.updated_at
        """, (
            task.task_id,
            task.source_platform.value if hasattr(task.source_platform, "value") else str(task.source_platform),
            task.target_platform.value if hasattr(task.target_platform, "value") else str(task.target_platform),
            task.status,
            task.total,
            task.matched,
            task.failed,
            task.processed,
            task.target_playlist_name,
            task.target_playlist_id,
            task.message,
            cr_time,
            up_time
        ))
        conn.commit()

def save_track_result(task_id: str, res: TransferTrackResult):
    """Сохраняет единичный результат сопоставления трека"""
    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO transfer_results (
                task_id, source_title, source_artist,
                matched_title, matched_artist, matched_id,
                confidence, status, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            task_id,
            res.source_track.title,
            res.source_track.artist,
            res.matched_track.title if res.matched_track else None,
            res.matched_track.artist if res.matched_track else None,
            res.matched_track.id if res.matched_track else None,
            res.confidence,
            res.status,
            res.error_detail
        ))
        conn.commit()

def resolve_pending_results(task_id: str, confirmed_ids: List[str]):
    """Обновляет статусы спорных результатов в SQLite при подтверждении/отклонении"""
    with get_db_connection() as conn:
        for cid in confirmed_ids:
            conn.execute(
                """
                UPDATE transfer_results
                SET status = 'matched'
                WHERE task_id = ? AND (matched_id = ? OR source_title = ? OR id = ?)
                """,
                (task_id, cid, cid, cid)
            )
        conn.execute(
            "UPDATE transfer_results SET status = 'rejected' WHERE task_id = ? AND status = 'pending_review'",
            (task_id,)
        )
        conn.commit()

def load_task_from_db(task_id: str) -> Optional[TransferTask]:
    """Восстанавливает TransferTask и ее results из SQLite"""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM transfer_tasks WHERE task_id = ?", (task_id,))
        task_row = cur.fetchone()
        if not task_row:
            return None

        cur.execute("SELECT * FROM transfer_results WHERE task_id = ? ORDER BY id ASC", (task_id,))
        result_rows = cur.fetchall()

        results: List[TransferTrackResult] = []
        for r in result_rows:
            source_track = Track(
                id=f"src_{r['id']}",
                title=r["source_title"] or "Неизвестный трек",
                artist=r["source_artist"] or "Неизвестный исполнитель",
                platform=PlatformEnum(task_row["source_platform"])
            )
            matched_track = None
            if r["matched_id"] or r["matched_title"]:
                matched_track = Track(
                    id=r["matched_id"] or f"match_{r['id']}",
                    title=r["matched_title"] or "",
                    artist=r["matched_artist"] or "",
                    platform=PlatformEnum(task_row["target_platform"])
                )
            results.append(
                TransferTrackResult(
                    source_track=source_track,
                    matched_track=matched_track,
                    confidence=float(r["confidence"] or 0.0),
                    status=r["status"] or "matched",
                    error_detail=r["error_message"]
                )
            )

        keys = task_row.keys() if hasattr(task_row, "keys") else []
        pl_id = task_row["target_playlist_id"] if "target_playlist_id" in keys else None

        return TransferTask(
            task_id=task_row["task_id"],
            source_platform=PlatformEnum(task_row["source_platform"]),
            target_platform=PlatformEnum(task_row["target_platform"]),
            status=task_row["status"],
            total=task_row["total_tracks"] or 0,
            processed=task_row["processed_tracks"] or 0,
            matched=task_row["matched_tracks"] or 0,
            failed=task_row["failed_tracks"] or 0,
            target_playlist_name=task_row["target_playlist_name"],
            target_playlist_id=pl_id,
            message=task_row["message"] or "",
            results=results
        )

def get_transfer_history(limit: int = 20, offset: int = 0) -> Dict[str, Any]:
    """Возвращает историю переносов с пагинацией"""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as count FROM transfer_tasks")
        total = cur.fetchone()["count"]

        cur.execute("""
            SELECT task_id, source_platform, target_platform, status,
                   total_tracks, matched_tracks, failed_tracks,
                   target_playlist_name, created_at, updated_at
            FROM transfer_tasks
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """, (limit, offset))
        rows = cur.fetchall()

        items = []
        for r in rows:
            items.append({
                "task_id": r["task_id"],
                "source_platform": r["source_platform"],
                "target_platform": r["target_platform"],
                "status": r["status"],
                "total_tracks": r["total_tracks"],
                "matched_tracks": r["matched_tracks"],
                "failed_tracks": r["failed_tracks"],
                "target_playlist_name": r["target_playlist_name"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"]
            })

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": items
        }
