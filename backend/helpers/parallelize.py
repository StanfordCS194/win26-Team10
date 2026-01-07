"""Helper for parallel execution of tasks."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, TypeVar, List, Any

T = TypeVar('T')
R = TypeVar('R')


def parallel_map(
    func: Callable[[T], R],
    items: List[T],
    max_workers: int = 10,
    progress_callback: Callable[[int, int], None] | None = None
) -> List[R]:
    """
    Execute func on each item in parallel using ThreadPoolExecutor.
    
    Args:
        func: Function to apply to each item
        items: List of items to process
        max_workers: Maximum number of parallel workers
        progress_callback: Optional callback(completed, total) for progress updates
    
    Returns:
        List of results in the same order as input items
    """
    if not items:
        return []
    
    results = [None] * len(items)
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks with their indices
        future_to_idx = {
            executor.submit(func, item): idx
            for idx, item in enumerate(items)
        }
        
        completed = 0
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            results[idx] = future.result()
            completed += 1
            
            if progress_callback:
                progress_callback(completed, len(items))
    
    return results

