# Логотип Helper

Источник — изображение логотипа, предоставленное пользователем. Прозрачная версия подготовлена встроенным инструментом imagegen, затем экспортирована в размеры для сайта и иконок. Нового шрифта или сторонних изображений нет.

- `assets/helper-logo.png` — прозрачный логотип, 960 × 290.
- `icon-512.png`, `icon-192.png` — значок устанавливаемого приложения.
- `apple-touch-icon.png` — значок iPhone, 180 × 180.
- `favicon.png` — значок вкладки, 64 × 64.

В CSS тёмной темы осветляется только надпись. Цветной знак не меняется. Иконки имеют непрозрачную светло-фиолетовую подложку; скругление применяет операционная система. Старый SVG со знаком «h·» удалён.

Промпт встроенного imagegen, `transparent_background: true`:

> Edit the supplied Helper logo, solely removing the white background to genuine alpha transparency. Preserve the exact original logo design, exact black 'Helper' lettering and letterforms, spacing, purple/blue 3D checklist notebook, silver rings, purple orbital ribbon and star. Do not redesign, retype, rearrange, add or remove any logo details. Keep horizontal composition and same proportions, trim unnecessary empty margins with a small even transparent padding. Clean crisp edges without white matte or halo; retain all white/lavender parts of the notebook itself fully opaque. This is a production web logo cutout, not a mockup. Transparent background.
