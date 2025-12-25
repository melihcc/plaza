import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

/* FIREBASE */
const firebaseConfig = {
  apiKey: "AIzaSyAnPVgBNvBcwBjiNSCEWnnNb-cE8getjYc",
  authDomain: "sedaiplazaapp.firebaseapp.com",
  projectId: "sedaiplazaapp",
  storageBucket: "sedaiplazaapp.appspot.com",
  messagingSenderId: "171611145009",
  appId: "1:171611145009:web:38e59996c6c4c015c16610"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const EXCEL_PATH = "deneme.xlsx";

/* UI */
const loginCard = document.getElementById("loginCard");
const userPanel = document.getElementById("userPanel");
const adminPanel = document.getElementById("adminPanel");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginMsg = document.getElementById("loginMsg");

const logoutBtn = document.getElementById("logoutBtn");
const logoutBtn2 = document.getElementById("logoutBtn2");

const userTitle = document.getElementById("userTitle");
const userMeta = document.getElementById("userMeta");
const userExcelStatus = document.getElementById("userExcelStatus");
const userDebtBody = document.getElementById("userDebtBody");
const userTotal = document.getElementById("userTotal");

const adminTitle = document.getElementById("adminTitle");
const adminMeta = document.getElementById("adminMeta");
const adminExcelStatus = document.getElementById("adminExcelStatus");
const officeGrid = document.getElementById("officeGrid");

const uploadExcelBtn = document.getElementById("uploadExcelBtn");
const excelFileInput = document.getElementById("excelFileInput");

/* EVENTS */
loginBtn.addEventListener("click", login);

[emailInput, passwordInput].forEach(i => {
  i.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      login();
    }
  });
  i.addEventListener("input", () => {
    i.classList.remove("input-error");
    loginMsg.textContent = "";
  });
});

if (logoutBtn) logoutBtn.onclick = () => signOut(auth);
if (logoutBtn2) logoutBtn2.onclick = () => signOut(auth);
if (uploadExcelBtn) uploadExcelBtn.onclick = () => excelFileInput.click();

/* HELPERS */
function fmtTL(n) {
  return (Number(n) || 0).toLocaleString("tr-TR") + " ₺";
}

function authMessage(code) {
  return {
    "auth/invalid-email": "Geçerli bir e-posta adresi giriniz.",
    "auth/user-not-found": "Bu e-posta ile kayıtlı kullanıcı bulunamadı.",
    "auth/wrong-password": "Şifre hatalı.",
    "auth/invalid-credential": "E-posta veya şifre hatalı.",
    "auth/too-many-requests": "Çok fazla deneme yapıldı. Lütfen bekleyin.",
    "auth/network-request-failed": "İnternet bağlantısı hatası."
  }[code] || "Giriş yapılamadı. Lütfen tekrar deneyin.";
}

/* LOGIN */
async function login() {
  loginMsg.textContent = "";
  emailInput.classList.remove("input-error", "shake");
  passwordInput.classList.remove("input-error", "shake");

  if (!emailInput.value.trim()) {
    emailInput.classList.add("input-error", "shake");
    loginMsg.textContent = "E-posta adresi boş olamaz.";
    return;
  }

  if (!passwordInput.value) {
    passwordInput.classList.add("input-error", "shake");
    loginMsg.textContent = "Şifre boş olamaz.";
    return;
  }

  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );
  } catch (e) {
    passwordInput.classList.add("input-error", "shake");
    loginMsg.textContent = authMessage(e.code);
  }
}

/* FIRESTORE */
async function getUser(email) {
  const snap = await getDocs(collection(db, email));
  return snap.docs[0].data();
}

/* EXCEL */
async function loadWorkbook() {
  const url = await getDownloadURL(ref(storage, EXCEL_PATH));
  const buf = await fetch(url).then(r => r.arrayBuffer());
  return XLSX.read(buf, { type: "array" });
}

function extractDate(wb) {
  const sheet = wb.Sheets["GENEL"];
  if (!sheet) return "";

  // Yeni tarih hücresi: A26
  const cell = sheet["A26"];
  if (!cell || typeof cell.v !== "string") return "";

  // Beklenen format:
  // "TARİH 08-12-2025 SAAT : 15:30"
  const match = cell.v.match(
    /(\d{2})[-./](\d{2})[-./](\d{4}).*?(\d{2}:\d{2})/
  );

  if (!match) return "";

  const [, day, month, year, time] = match;

  // Ekranda düzgün gösterim
  return `${day}.${month}.${year} ${time}`;
}


function parseGenel(wb) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["GENEL"], { header: 1 });
  const map = new Map();
  rows.forEach(r => {
    for (let i = 0; i < r.length - 1; i += 2) {
      if (r[i] && !isNaN(r[i + 1])) map.set(String(r[i]), Number(r[i + 1]));
    }
  });
  return map;
}

function parseDemirbas(wb) {
  // Sayfa adını esnek bul (DEMİRBAŞ / DEMIRBAS varyasyonları)
  const sheetName =
    (wb.SheetNames || []).find(n => String(n).toUpperCase().includes("DEMİRBAŞ")) ||
    (wb.SheetNames || []).find(n => String(n).toUpperCase().includes("DEMIRBAS")) ||
    "DEMİRBAŞ";

  const ws = wb.Sheets[sheetName];
  const map = new Map();
  if (!ws) return map;

  // raw:false -> "1.500,00 ₺" gibi görünen değerleri string olarak yakalamaya yardımcı olur
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

  // Para değerini sayıya çevir (TR format: 1.500,00 ₺)
  const moneyToNumber = (val) => {
    if (val === null || val === undefined) return 0;

    // Direkt sayı geldiyse
    if (typeof val === "number") return isFinite(val) ? val : 0;

    let s = String(val).trim();
    if (!s || s === "-" || s.includes("-")) return 0; // "- ₺" gibi

    // ₺, boşluk vb. at
    s = s.replace(/[₺\s]/g, "");

    // TR format: 1.500,00 => 1500.00
    // önce binlik noktaları sil, sonra virgülü noktaya çevir
    s = s.replace(/\./g, "").replace(/,/g, ".");

    const num = parseFloat(s);
    return isFinite(num) ? num : 0;
  };

  // Header satırını ve kolonları bul
  let headerRow = -1;
  let officeCol = -1;
  let totalCol = -1;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").toUpperCase();
      if (officeCol === -1 && cell.includes("OFİS") && cell.includes("NO")) officeCol = c;
      if (totalCol === -1 && cell.includes("TOPLAM")) totalCol = c;
    }
    if (officeCol !== -1 && totalCol !== -1) {
      headerRow = r;
      break;
    }
  }

  if (headerRow === -1) return map;

  // Verileri oku
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const officeRaw = row[officeCol];

    if (officeRaw === "" || officeRaw === null || officeRaw === undefined) break;

    const office = String(officeRaw).trim();
    if (!office) break;

    const totalRaw = row[totalCol];
    const total = moneyToNumber(totalRaw);

    map.set(office, total);
  }

  return map;
}


/* ADMIN UPLOAD */
excelFileInput.addEventListener("change", async e => {
  const f = e.target.files[0];
  if (!f) return;
  await uploadBytes(ref(storage, EXCEL_PATH), f);
  await loadAdmin(auth.currentUser.email);
});

/* SCREENS */
async function loadUser(email) {
  loginCard.style.display = "none";
  userPanel.style.display = "block";

  const user = await getUser(email);
  const wb = await loadWorkbook();
  const aidat = parseGenel(wb);
  const date = extractDate(wb);

  userTitle.textContent = `${user.name} ${user.surname}`;
  userMeta.textContent = email;
  userDebtBody.innerHTML = "";

  let total = 0;
  user.no.forEach(no => {
    const d = aidat.get(String(no)) || 0;
    total += d;
    userDebtBody.innerHTML += `
      <tr><td>${no}</td><td>${fmtTL(d)}</td></tr>`;
  });

  userTotal.textContent = fmtTL(total);
  userExcelStatus.textContent =
    "Aidat bilgileri güncel" + (date ? ` (Son güncelleme: ${date})` : "");
}

async function loadAdmin(email) {
  // Paneller
  loginCard.style.display = "none";
  userPanel.style.display = "none";
  adminPanel.style.display = "block";

  // Kullanıcı bilgisi
  const user = await getUser(email);

  // Excel verileri
  const wb = await loadWorkbook();
  const aidatMap = parseGenel(wb);
  const demirbasMap = parseDemirbas(wb);
  const dateStr = extractDate(wb);

  // Üst başlıklar
  adminTitle.textContent = `${user.name} ${user.surname}`;
  adminMeta.textContent = email;

  // Grid temizle
  officeGrid.innerHTML = "";

  /* ------------------------------
     OFİSLERİ SAYISAL SIRALA
  -------------------------------- */
  const offices = [...new Set([
    ...aidatMap.keys(),
    ...demirbasMap.keys()
  ])]
    .map(v => String(v).trim())
    .filter(v => v.length > 0)
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ""), 10);
      const nb = parseInt(b.replace(/\D/g, ""), 10);

      const aNum = Number.isFinite(na);
      const bNum = Number.isFinite(nb);

      if (aNum && bNum) return na - nb;     // 1,2,3,10...
      if (aNum && !bNum) return -1;
      if (!aNum && bNum) return 1;
      return a.localeCompare(b, "tr");      // fallback
    });

  /* ------------------------------
     KARTLARI BAS
  -------------------------------- */
  offices.forEach(ofis => {
    const aidat = aidatMap.get(ofis) || 0;
    const demirbas = demirbasMap.get(ofis) || 0;

    officeGrid.innerHTML += `
      <div class="officeCard">
        <h4>Ofis ${ofis}</h4>
        <p>Aidat: <b>${fmtTL(aidat)}</b></p>
        <p>Demirbaş: <b>${fmtTL(demirbas)}</b></p>
      </div>
    `;
  });

  // Alt bilgi
  adminExcelStatus.textContent =
    "Tüm ofisler güncel" +
    (dateStr ? ` (Son güncelleme: ${dateStr})` : "");
}


/* AUTH STATE */
onAuthStateChanged(auth, async u => {
  if (!u) {
    loginCard.style.display = "block";
    userPanel.style.display = "none";
    adminPanel.style.display = "none";
    return;
  }
  const user = await getUser(u.email);
  user.admin ? loadAdmin(u.email) : loadUser(u.email);
});
