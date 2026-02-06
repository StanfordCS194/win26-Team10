"""
Base class for pipeline steps.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
import logging

from api.pipeline.types import ParseArtifacts


class ParseStep(ABC):
    """Abstract base class for parse pipeline steps."""
    
    name: str = "base"
    
    def __init__(self):
        self.logger = logging.getLogger(f"pipeline.{self.name}")
    
    @abstractmethod
    def run(self, artifacts: ParseArtifacts) -> ParseArtifacts:
        """
        Execute the step and return updated artifacts.
        
        Args:
            artifacts: Current pipeline artifacts
            
        Returns:
            Updated artifacts with this step's outputs
        """
        pass
    
    def should_skip(self, artifacts: ParseArtifacts) -> bool:
        """
        Check if this step should be skipped.
        
        Override in subclasses to implement skip logic (e.g., output already exists).
        
        Args:
            artifacts: Current pipeline artifacts
            
        Returns:
            True if step should be skipped
        """
        return False
