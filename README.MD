
# Technical Test - Software Developer [CSI]

### Worker & Job Processing

Jalankan project dengan melakukan
```
git clone https://github.com/dibazalfa/csi-technical-test.git
cd csi-technical-test
npm install
```
Copy file `.env.example` menjadi `env` dan lengkapi configurasinya

Setelah itu, lakukan generate database menggunakan command berikut
```
npx prisma generate
```

**1. Cara menjalankan API & Worker**

Untuk menjalankan API gunakan command
```
npm run dev
```
Kirim request menggunakan file `request.http` yang sudah tersedia (jangan lupa untuk mengganti port pada base_url) 

**note:** tidak perlu mengganti `idempotency_key` karena sudah digenerate secara random 

Untuk menjalankan worker, buka terminal baru dan gunakan command
```
npm run worker
```
Jika ingin menjalankan 2 worker sekaligus di latar belakang, gunakan command
```
pm2 start src/worker.js -i 2
```
Matikan worker yang berjalan di latar belakang dengan command
```
pm2 stop all
```

**2. Strategi Keputusan Teknis**

- Menggunakan struktur modular berbasis tiga lapisan utama (RSC) untuk pembuatan code API untuk memisahkan fungsi setiap code. Repository langsung terhubung ke database, service untuk logika bisnis dan pemrosesan data, dan controller berhubungan langsung dengan client (mengirim request dan menerima response).

- Validasi idempotency_key diatur pada `notif.service.js` karena berhubungan langsung dengan repository yang terhubung ke database

- Validasi `channelType = ['email', 'sms']` diatur pada `notif.controller.js` karena berhubungan dengan input dari client, dilakukan agar request yang akan dikirim sudah sesuai dengan service

- Membuat folder src/db agar tidak perlu melakukan export module PrismaClient di setiap file, bisa langsung `require('../db')`

- Menggunakan `$transaction` dan `$queryRaw` pada function `claimJob` agar dapat menggunakan query `FOR UPDATE SKIP LOCKED` karena prisma belum memiliki API langsung untuk hal tersebut, sehingga harus menggunakan query raw. Query `FOR UPDATE` hanya dapat dijalankan di dalam `$transaction`

- Polling interval dilakukan menggunakan `await sleep()`. Hal ini dilakukan untuk menghindari overlap yang dapat terjadi pada `setTimeout` tanpa `await`. Pada code, jika tidak terdapat job, maka service akan berhenti selama 3 detik sebelum melakukan pengecekan ulang. Di setiap akhir iterasi akan diberi jeda 300ms agar proses tidak berjalan secara terus menerus. 

- Terdapat sistem logging untuk memantau response dan status job saat selesai dieksekusi. Log yang tersimpan adalah hasil eksekusi dari job yang sukses, perlu diulang (retry), dan gagal (permanen). Code terdapat pada `utils/logger.js` dan dipanggil pada `src/worker.js`

- Dalam proses pengembangan code, terdapat `await sleep(1000)` pada akhir `processLoop)` di `src/worker.js` yang kini telah di comment agar nonaktif. Hal ini dilakukan agar perubahan status selama proses eksekusi job dapat terlihat lebih jelas. Seluruh status job secara realtime dapat dilihat menggunakan endpoint `/internal/queue/stats` 

**3. Deskripsi Strategi retry/backoff/jitter**

- Job akan mendapatkan status "RETRY" jika gagal dieksekusi lebih dari max_attempts. **RETRY** akan terus dilakukan sebanyak max_attempts (pada code ini default nya adalah 5) dan jika gagal lebih dari itu maka status akan menjadi "FAILED"
```
async function markJobRetryorFail(job) {
...
const status = attempts < max ? 'RETRY' : 'FAILED'
...
}
```

- **Backoff** akan dipanggil di setiap job yang memiliki status "RETRY". Semakin banyak attempt yang telah dilakukan oleh job, maka akan semakin lama backoff delay, hal ini dilakukan untuk memberikan jeda agar job tidak langsung dieksekusi ulang dalam waktu yang singkat. (Pada code ini dilakukan max attempt sebanyak 5 kali, dengan waktu backoff 1s, 2s, 4s, 8s, 16s). 
```
function backoffDelay(attempt) {
  const base = Math.pow(2, Math.max(0, attempt - 1)) // 1,2,4,8,16
  ...
}

async function markJobRetryorFail(job) {
...
const delay = status === 'RETRY' ? backoffDelay(attempts) : 0
const nextRunAt = status === 'RETRY' ? new Date(Date.now() + delay) : job.next_run_at
...
}
```

- Pada code ini, **Jitter** di-generate secara random dalam 0-30% agar tidak ada job yang di-retry di waktu yang bersamaan. Waktu backoff akan ditambahkan nilai jitter sehingga tidak ada retry yang dilakukan serentak.  
```
function backoffDelay(attempt) {
    const base = Math.pow(2, Math.max(0, attempt - 1)) // 1,2,4,8,16
    const jitter = Math.random() * 0.3
    return Math.ceil(base * (1 + jitter)) * 1000
}
```

**4. Mekanisme anti double-processing yang dipakai**

Pada function `claimJob` di `src/worker.js` menggunakan query berikut
```
WHERE id = (
  SELECT id FROM notification_jobs
  WHERE status IN ('PENDING','RETRY') AND next_run_at <= NOW()
  ORDER BY next_run_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
```
Worker hanya akan menjalankan Job dengan status "PENDING" dan "RETRY" dan dieksekusi berdasarkan urutan Job yang dibuat terlebih dahulu. 

Query berikut:

```
FOR UPDATE SKIP LOCKED
```
digunakan agar worker lain tidak dapat menjalankan Job yang sama (karena sudah di-lock) sehingga tidak akan terjadi double-processing