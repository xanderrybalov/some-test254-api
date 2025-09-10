# Docker Development Guide

## Запуск локального розвитку

### 1. Базовий запуск
```bash
# Запустити всі сервіси (PostgreSQL, Redis, API)
docker-compose up

# Запустити у фоновому режимі
docker-compose up -d

# Переглядати логи API (тут ви побачите міграції)
docker-compose logs -f api
```

### 2. Результат міграцій
При запуску ви побачите:
```
api_1  | 🚀 Starting Movies API...
api_1  | ⏳ Waiting for database to be fully ready...
api_1  | 🔍 Migration status:
api_1  | ┌─────────────────────────┬─────────────┐
api_1  | │         Migration       │    Status   │
api_1  | ├─────────────────────────┼─────────────┤
api_1  | │ 1704000000000_init      │    DONE     │
api_1  | │ 1757342057748_add-pos.. │    DONE     │
api_1  | │ 1757407627000_add-aut.. │    DONE     │
api_1  | └─────────────────────────┴─────────────┘
api_1  | 📦 Running migrations...
api_1  | ✅ Migrations finished!
api_1  | 🌟 Starting server...
```

### 3. Команды для управління

```bash
# Зупинити всі сервіси
docker-compose down

# Зупинити і видалити volumes (очистити БД)
docker-compose down -v

# Пересобрать API контейнер
docker-compose build api

# Запустить тільки PostgreSQL та Redis
docker-compose up postgres redis

# Виконати міграции вручну
docker-compose exec api npm run migrate:docker

# Подивитися статус міграцій
docker-compose exec api npm run migrate:up -- --dry-run
```

### 4. Змінні оточення
Створіть `.env` файл для локального розвитку:
```bash
OMDB_API_KEY=your-actual-api-key-here
```

### 5. Доступ до сервісів
- **API**: http://localhost:8080
- **Health Check**: http://localhost:8080/health
- **PostgreSQL**: localhost:5432
  - Database: `movies`
  - User: `movies_user`
  - Password: `movies_pass`
- **Redis**: localhost:6379

### 6. Трублшутинг

**Проблема**: Міграції не виконуються
```bash
# Перевірити логи БД
docker-compose logs postgres

# Виконати міграції вручну
docker-compose exec api npm run migrate:up
```

**Проблема**: API не запускається
```bash
# Перевірити статус контейнерів
docker-compose ps

# Перевірити логи API
docker-compose logs api
```

**Проблема**: "Database not found"
```bash
# Пересоздать volumes
docker-compose down -v
docker-compose up
```
