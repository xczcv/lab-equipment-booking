# Перевірка PR і staging

## Локальні докази

- Навмисно некоректний subject дав код 1. Додавання коміту з коректним subject у той самий діапазон теж дало код 1. `scripts/check-commits.js` перевіряє кожен коміт PR, крім merge-комітів. [Перший прогін](../evidence/lab04-ci-local.txt) · [Перевірка діапазону](../evidence/lab04-ci-format-drill.txt)
- Для демонстрації червоного й зеленого CI використовуйте помилку форматування в коміті з коректним subject. Локально обидва subjects пройшли перевірку діапазону. `make check` впав на неформатованому файлі й пройшов після окремого виправного коміту. [Локальний прогін](../evidence/lab04-ci-format-drill.txt)
- `make container-check` збирає образ із SHA HEAD, створює одноразову PostgreSQL, перевіряє 503 від `/ready` без індексів, застосовує індекси окремою командою та звіряє 200, SHA в `/version` і статус Docker. [Контейнерний прогін](../evidence/lab04-container.txt)

## GitHub після дозволу на публікацію

1. Після появи workflow на GitHub створіть тимчасову гілку `test/ci-format-gate` від чистої бази, яка вже містить цей workflow. Увімкніть обов’язковий PR для `main` і required check `quality`, використовуючи назву з GitHub. Приберіть обхід для облікових записів, на яких демонструється gate.
2. Створіть тестовий коміт з неформатованим файлом і коректним subject. Одноразовий параметр `core.hooksPath` дозволяє саме цьому тестовому коміту дійти до CI.

   ```sh
   printf '%s\n' 'export const ciFormatProbe={enabled:true}' > ci-format-probe.js
   git add ci-format-probe.js
   git -c core.hooksPath=/dev/null commit -m "test: introduce an intentional CI formatting error"
   ```

3. Після погодження опублікуйте негативний коміт і відкрийте демонстраційний PR. Для цього одного push пропустіть локальний `pre-push`, який також виконує форматтер. Після виправлення наступний push виконується зі звичайним hook.

   ```sh
   git -c core.hooksPath=/dev/null push -u origin test/ci-format-gate
   ```

   Збережіть URL червоного check `quality`, SHA його head і стан merge gate в інтерфейсі GitHub.

4. Виправте форматування окремим комітом і після погодженого push у той самий PR зафіксуйте зелений `quality` та стан gate. Після демонстрації закрийте тестовий PR без merge.

   ```sh
   npm exec -- prettier --write ci-format-probe.js
   git add ci-format-probe.js
   git commit -m "test: fix the intentional CI formatting error"
   ```

GitHub checks і merge gate очікують перевірки на опублікованому PR.

## Публічний staging після дозволу

1. Погодьте платний план і застосуйте Render Blueprint з [render.yaml](../render.yaml). Staging-БД використовує приватне з'єднання. Якщо сервіс і БД вже існують, звірте налаштування Blueprint перед застосуванням.
2. У GitHub environment `staging` задайте secret `RENDER_API_KEY` та variables `RENDER_SERVICE_ID` і `STAGING_URL`. Використайте HTTPS-адресу сервісу і дозвольте розгортання з `main`.
3. Після merge дочекайтеся зелених `quality` і `staging`. Збережіть їхні URL, запис Render deployment, відповідь 200 від публічного `/ready` і JSON із тим самим SHA від `/version`. За потреби запустіть `node dist/maintenance/seed.js` з Render Shell на демонстраційній БД.
4. Для змін схеми узгодьте expand/contract зі старою активною версією. Великі індекси готуйте окремою операцією з образу до розгортання. Після перерваного `CREATE INDEX CONCURRENTLY` перевірте `pg_index` і підготуйте ремонт невалідного індексу перед повтором. Застосовані міграційні файли залишайте сталими.

Публічний Render deployment, його готовність і SHA очікують першого підтвердженого запуску.
