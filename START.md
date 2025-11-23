# SEO Shield Proxy - Başlatma Rehberi

## 🚀 Hızlı Başlangıç

### 1. Bağımlılıkları Yükle

```bash
# Ana proxy için
npm install

# Admin Dashboard için
cd admin-dashboard
npm install
cd ..

# Demo SPA için  
cd demo-spa
npm install
cd ..
```

### 2. Ortam Değişkenlerini Ayarla

```bash
cp .env.example .env
# .env dosyasını düzenle:
# TARGET_URL=http://localhost:3000  # Demo SPA URL'i
```

### 3. Servisleri Başlat (3 Terminal Gerekli)

**Terminal 1 - Demo SPA:**
```bash
cd demo-spa
npm run dev
# http://localhost:3000 adresinde çalışacak
```

**Terminal 2 - SEO Shield Proxy:**
```bash
npm start
# http://localhost:8080 adresinde çalışacak
```

**Terminal 3 - Admin Dashboard:**
```bash
cd admin-dashboard
npm run dev
# http://localhost:3001 adresinde çalışacak (veya http://localhost:8080/admin)
```

## 📊 Erişim Noktaları

- **Demo SPA (Direkt):** http://localhost:3000
- **SEO Shield Proxy:** http://localhost:8080
- **Admin Dashboard:** http://localhost:8080/admin veya http://localhost:3001

## 🧪 Test Etme

### Bot olarak test:
```bash
curl -A "Googlebot" http://localhost:8080/
```

### İnsan kullanıcı olarak:
```bash
curl http://localhost:8080/
```

### WebSocket bağlantısını test:
Admin Dashboard'u tarayıcıda açın, real-time güncellemeleri göreceksiniz.

## 🐳 Docker ile Çalıştırma (Gelecek)

```bash
docker-compose up -d
```

Tüm servisler otomatik olarak başlayacak!
