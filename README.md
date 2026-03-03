# Этернос — Telegram Mini App (текстовый квест)

Готовый проект mini-app (Telegram WebApp): фэнтези-квест с выбором, сохранением и фоновой музыкой.

## Запуск
```bash
npm i
npm run dev
```

## Сборка
```bash
npm run build
npm run preview
```

## Подключение к Telegram (BotFather)
1) Создай бота в @BotFather.
2) Настройки бота → Menu Button / Web App.
3) Укажи HTTPS URL на игру (GitHub Pages / Vercel / Netlify).
4) Открой чат с ботом → кнопка меню откроет mini app.

## Где что лежит
- Сюжет: `src/data/story.ru.json` (узлы, выборы, эффекты, условия)
- Музыка: `public/assets/audio/bg.mp3` (ваш прикреплённый файл)
- Движок: `src/engine.ts`
- UI: `src/App.tsx`


## Новое в v3
- Репутация по фракциям: деревня, охотники, Орден, драконы
- Провалы: при падении HP до 0 наступает "Провал"
- Лор-книга: открываемые записи (`src/data/lore.ru.json`)
- Облачные сохранения: Telegram CloudStorage (если доступно)
- Вибро-отклик: только в напряженных моментах (урон/финал/провал)
