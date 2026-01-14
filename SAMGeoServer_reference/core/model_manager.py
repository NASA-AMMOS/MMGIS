"""Model manager for SAM3 model singleton."""
import threading
import torch
from samgeo import SamGeo3
from app.core.config import settings


class ModelManager:
    """Singleton manager for SAM3 model."""

    _instance = None
    _model = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def get_instance(cls):
        """Get the singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self):
        """Initialize SAM3 model (called at worker startup)."""
        if self._model is not None:
            print("Model already initialized")
            return

        print(f"Initializing SAM3 model from {settings.MODEL_PATH}")
        print(f"Using device: {settings.DEVICE}")

        # Detect device
        device = settings.DEVICE
        if device == "cuda" and not torch.cuda.is_available():
            print("CUDA requested but not available, falling back to CPU")
            device = "cpu"

        self._model = SamGeo3(
            backend="meta",
            checkpoint_path=settings.MODEL_PATH,
            device=device,
            enable_inst_interactivity=settings.ENABLE_INST_INTERACTIVITY,
            confidence_threshold=settings.CONFIDENCE_THRESHOLD
        )

        print("SAM3 model initialized successfully")

    def get_model(self) -> SamGeo3:
        """Get the initialized model."""
        if self._model is None:
            raise RuntimeError("Model not initialized. Call initialize() first.")
        return self._model

    @property
    def is_initialized(self) -> bool:
        """Check if model is initialized."""
        return self._model is not None
