from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sistema Multimarca"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    # Supabase Postgres: postgresql+psycopg://postgres:<password>@<host>:5432/postgres?sslmode=require
    DATABASE_URL: str
    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    # Backward-compatible name for deployments that already use this variable.
    SUPABASE_SECRET_KEY: str | None = None
    SUPABASE_PRODUCT_IMAGES_BUCKET: str = "product-images"

    @property
    def SUPABASE_STORAGE_KEY(self) -> str | None:
        return self.SUPABASE_SERVICE_ROLE_KEY or self.SUPABASE_SECRET_KEY

    class Config:
        env_file = ".env"
        extra = "ignore"
        case_sensitive = True

settings = Settings()
