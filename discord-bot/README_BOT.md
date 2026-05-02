# 🤖 Nova Roleplay - Discord Bot & API

هذا المجلد يحتوي على البوت المدمج الذي يربط بين خادم الـ MTA والموقع والديسكورد.

## 🚀 طريقة التشغيل

1. **تثبيت المكتبات:**
   ```bash
   cd discord-bot
   npm install
   ```

2. **إعداد ملف البيئة:**
   قم بإنشاء ملف باسم `.env` داخل هذا المجلد وضع فيه الإعدادات التالية:
   ```env
   GAME_BOT_TOKEN="توكن_البوت_هنا"
   GAME_BOT_CLIENT_ID="آيدي_البوت_هنا"
   DISCORD_GUILD_ID="آيدي_السيرفر_هنا"

   # رومات السجلات (IDs)
   LOG_CHANNEL_MTA=1432703261533798552
   LOG_CHANNEL_COMMANDS=1432703261533798552
   LOG_CHANNEL_AUTH=1432703261533798552
   LOG_CHANNEL_ADMIN=1432703261533798552
   LOG_CHANNEL_STORE=1432703261533798552
   LOG_CHANNEL_FINANCE=1432703261533798552
   LOG_CHANNEL_SUBMISSIONS=1432703261533798552
   LOG_CHANNEL_VISITS=1432703261533798552

   # الحماية وقاعدة البيانات
   VITE_DISCORD_BOT_API_KEY="FL-RP_9x2KzL8!vQpmWn5&7ZtY2uBvR1_VXL"
   PORT=3001
   MTA_DB_HOST="localhost"
   MTA_DB_USER="root"
   MTA_DB_PASSWORD=""
   MTA_DB_NAME="mta_server"
   ```

3. **تشغيل البوت:**
   ```bash
   npm start
   ```

## 🛠️ المميزات
- **نظام الربط:** أوامر `/link` و `/unlink` و `/showlinkstatus`.
- **نظام السجلات المتقدم:** سجلات منفصلة لكل نوع من العمليات (دخول، خروج، زيارات، إشراف، مالي).
- **API مدمج:** يوفر واجهة برمجية للموقع لجلب بيانات الأعضاء وإرسال التنبيهات.
- **حماية عالية:** تشفير الاتصال بين الموقع والبوت باستخدام API Key.
