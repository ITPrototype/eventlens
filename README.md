# EventLens — Windows Event Viewer (Flask + HTML)

Oddiy Event Viewer'dan qulayroq: tez qidiruv, saralash, filtrlar, timeline va avtomatik "Findings".

## Ishga tushirish
1. Python 3.9+ o'rnatilgan bo'lsin.
2. `run.bat` ni ikki marta bosing (venv + Flask o'zi o'rnatiladi, brauzer ochiladi).
3. **Security** logini o'qish uchun `run_admin.bat` ni ishlating (Administrator huquqi kerak).

Qo'lda: `pip install -r requirements.txt` → `python app.py` → http://127.0.0.1:5000

Windows bo'lmagan kompyuterda (yoki `EV_DEMO=1`) sinov uchun demo ma'lumot ko'rsatadi.

## Imkoniyatlar
- Application / System / Security / All + boshqa istalgan log (More logs)
- Qidiruv: `id:4624,4625` `id:7000-7045` `src:disk` `user:admin` `level:error,warn` `level:fail`
  `"aniq ibora"` `-dcom` (chiqarib tashlash) `/regex/`
- Timeline: sichqoncha bilan surib vaqt oralig'iga zoom, bosib tozalash
- Findings: kutilmagan reboot, BSOD, servis crash, disk xatolari, yangi servis, log tozalandi,
  4625 (brute-force: eng ko'p IP va akkaunt) va h.k. — bosilsa filtr bo'ladi
- Event ID va Source bo'yicha Top ro'yxat (bosish = filtr, Alt+bosish = chiqarib tashlash)
- Event detali: tushuntirish, to'liq xabar, XML, nusxalash, internetdan qidirish
- Saralash (ustun sarlavhasi), Live (15 s), CSV/JSON eksport
- Klavishlar: `/` qidiruv · `j`/`k` yoki ↑/↓ · `Esc` · `r`

## Muhim
- Server faqat `127.0.0.1` da ishlaydi (loglar maxfiy). Tarmoqqa ochmang.
- Loglar PowerShell `Get-WinEvent` orqali o'qiladi; katta hajm (20 000+) sekinroq bo'lishi mumkin.
- Port o'zgartirish: `set EV_PORT=8080`
