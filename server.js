// 1. Gerekli Modülleri Dahil Etme
// dotenv: Ortam değişkenlerini .env dosyasından yüklemek için (yerelde çalışırken)
require('dotenv').config();
const express = require('express'); // Express framework'ünü dahil et
const mongoose = require('mongoose'); // MongoDB ile etkileşim için Mongoose'u dahil et
const cors = require('cors'); // CORS politikalarını yönetmek için cors'u dahil et

// 2. Express Uygulamasını Başlatma
const app = express();
// Portu ortam değişkeninden al (hosting platformları için) veya varsayılan 3000'i kullan
const port = process.env.PORT || 3000;

// 3. Middleware'ler (Ara Yazılımlar)
// Gelen JSON istek gövdelerini ayrıştırmak için
app.use(express.json());
// CORS'u etkinleştir: Bu, frontend'inizin (Netlify'da) backend'inize (Render'da) istek atabilmesi için önemlidir.
// Güvenlik için, üretimde belirli bir frontend URL'sine izin vermek daha iyidir:
// app.use(cors({ origin: 'https://sizin-netlify-adresiniz.netlify.app' }));
app.use(cors()); // Şimdilik tüm kaynaklara izin ver

// 4. MongoDB Atlas Bağlantısı
// MongoDB Atlas bağlantı dizesini ortam değişkeninden al (güvenlik için)
// !!! Lütfen `MONGO_URI` ortam değişkeninizi ayarladığınızdan emin olun.
// Bu, MongoDB Atlas'tan aldığınız bağlantı dizesi olmalı.
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
    .then(() => console.log('MongoDB\'ye başarıyla bağlandı!'))
    .catch(err => console.error('MongoDB bağlantı hatası:', err));

// 5. Veritabanı Şeması ve Model Tanımlama (Mongoose ile)
// Fatih Projesi BT Rehberliği Başvuru Formu için şema tanımlama
const applicationSchema = new mongoose.Schema({
    tcNo: {
        type: String,
        required: [true, 'T.C. Kimlik Numarası gereklidir.'],
        unique: true, // Her T.C. Kimlik Numarasının sadece bir başvuru yapabilmesini sağlar
        minlength: [11, 'T.C. Kimlik Numarası 11 haneli olmalıdır.'],
        maxlength: [11, 'T.C. Kimlik Numarası 11 haneli olmalıdır.']
    },
    fullName: { type: String, required: [true, 'Ad Soyad gereklidir.'] },
    branch: String, // Branş (Örn: Bilişim Teknolojileri)
    email: { type: String, required: [true, 'E-posta gereklidir.'], unique: true },
    phone: String, // Telefon Numarası
    weeklyHours: Number, // Haftalık BT Rehberliği Saati
    certificateDate: String, // Eğitim Sertifika Tarihi
    normStatus: String, // Norm Durumu
    preferences: Object, // Tercihleri içeren obje (örn: { ilTercihi: "Bursa", ilceTercihi: "Nilüfer" })
    specialRequest: String, // Özel Durumlar / İstekler
    teacherDate: String, // Öğretmen Olarak Atanma Tarihi
    applicationId: { type: String, unique: true }, // Otomatik oluşturulacak benzersiz başvuru ID'si
    submissionDate: { type: Date, default: Date.now }, // Başvuru tarihi (otomatik olarak atanır)
    academicYear: { type: String, default: '2025-2026' }, // Akademik yıl
    semester: { type: String, default: 'I. Dönem' }, // Dönem
    status: { type: String, default: 'Beklemede' } // Başvuru durumu
});

// Mongoose Modeli oluşturma
// Bu model 'applications' adında bir koleksiyon oluşturacak (çoğul halini alır)
const Application = mongoose.model('Application', applicationSchema);

// 6. API Endpoint'i Tanımlama (`POST` isteği)
app.post('/api/btr-applications', async (req, res) => {
    try {
        // Frontend'den gelen verileri al
        const formData = req.body;

        // Basit bir benzersiz Başvuru ID'si oluşturma
        // Gerçek projelerde daha sağlam, çakışmayan ID'ler üretmek önemlidir
        const count = await Application.countDocuments();
        const newApplicationId = `BTR-<span class="math-inline">\{new Date\(\)\.getFullYear\(\)\}\-</span>{(count + 1).toString().padStart(4, '0')}`;
 // Örn: BTR-2025-0001

        // Yeni başvuru dokümanını oluştur
        const newApplication = new Application({
            ...formData, // Frontend'den gelen tüm alanları kopyala
            applicationId: newApplicationId,
            // submissionDate, academicYear, semester, status varsayılan olarak şemada ayarlandı
        });

        // Dokümanı veritabanına kaydet
        await newApplication.save();

        // Başarılı yanıt gönder
        res.status(201).json({
            success: true,
            message: 'Başvuru başarıyla kaydedildi!',
            applicationId: newApplicationId
        });

    } catch (error) {
        console.error('Başvuru kaydederken hata oluştu:', error);

        // MongoDB'den gelen belirli hata kodlarını yakalama (örn: unique alan ihlali)
        if (error.code === 11000) { // Duplicate key error (benzersiz olması gereken bir alan zaten varsa)
            if (error.keyPattern && error.keyPattern.tcNo) {
                return res.status(409).json({ success: false, message: 'Bu T.C. Kimlik Numarası ile zaten başvuru yapılmış.' });
            }
            if (error.keyPattern && error.keyPattern.email) {
                return res.status(409).json({ success: false, message: 'Bu E-posta adresi ile zaten başvuru yapılmış.' });
            }
        }
        // Mongoose doğrulama hatalarını yakalama (örn: required alanlar boşsa)
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }

        // Diğer sunucu hataları
        res.status(500).json({ success: false, message: 'Sunucu hatası: Başvuru kaydedilemedi. Lütfen daha sonra tekrar deneyin.' });
    }
});

// 7. Sunucuyu Başlatma
app.listen(port, () => {
    console.log(`Backend sunucu http://localhost:${port} adresinde çalışıyor`);
});
