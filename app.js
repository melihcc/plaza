// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

/** 1) Firebase config (Firebase Console -> Project settings -> Web app) */
const firebaseConfig = {
  apiKey: "AIzaSyAnPVgBNvBcwBjiNSCEWnnNb-cE8getjYc",
  authDomain: "sedaiplazaapp.firebaseapp.com",
  projectId: "sedaiplazaapp",
  storageBucket: "sedaiplazaapp.appspot.com",
  messagingSenderId: "171611145009",
  appId: "1:171611145009:web:38e59996c6c4c015c16610",
  measurementId: "G-B5FZWLZ4NW"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

/** 2) UI refs */
const loginCard = document.getElementById("loginCard");
const dash = document.getElementById("dash");
const loginMsg = document.getElementById("loginMsg");

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");

const welcomeEl = document.getElementById("welcome");
const metaEl = document.getElementById("meta");
const excelInfoEl = document.getElementById("excelInfo");

const tbody = document.getElementById("debtTbody");
const totalDebtEl = document.getElementById("totalDebt");

/** 3) Excel dosya yolu (Storage içindeki path) */
const EXCEL_STORAGE_PATH = "deneme.xlsx"; // Storage'da dosyanın adı/klasörü neyse onu yaz

/** 4) Helpers */
function fmtMoney(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function setLoginMsg(text, isErr = false) {
  loginMsg.textContent = text;
  loginMsg.style.color = isErr ? "crimson" : "green";
}

function setExcelInfo(text) {
  excelInfoEl.textContent = text || "";
}

/**
 * GENEL sayfasından ofisNo -> borç map'i çıkarır.
 * Format: aynı satırda 4 çift kolon gibi: (A,B) (C,D) (E,F) (G,H)
 * Header vs. boşları otomatik atlar.
 */
function parseGenelSheet(workbook) {
  const sheet = workbook.Sheets["GENEL"];
  if (!sheet) throw new Error("Excel içinde 'GENEL' sayfası bulunamadı.");

  // Sheet'i 2D array olarak al (raw: true -> sayıları bozmaz)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  const map = new Map(); // officeNo(string) -> debt(number)
  let extractedCount = 0;

  for (const row of rows) {
    if (!row || row.length < 2) continue;

    // satırı ikişerli gez (0-1,2-3,4-5,6-7,...)
    for (let i = 0; i < row.length - 1; i += 2) {
      const office = row[i];
      const debt = row[i + 1];

      // ofis no sayısal veya sayısal string ise al
      const officeNo = (office !== null && office !== undefined) ? String(office).trim() : "";
      if (!officeNo) continue;
      if (!/^\d+$/.test(officeNo)) continue; // sadece tam sayı ofis no

      // borç sayısal olmalı
      const debtNum = Number(debt);
      if (!Number.isFinite(debtNum)) continue;

      map.set(officeNo, debtNum);
      extractedCount++;
    }
  }

  if (map.size === 0) {
    throw new Error("GENEL sayfasından ofis/borç verisi çekilemedi. Format değişmiş olabilir.");
  }

  return { map, extractedCount };
}

/**
 * Kullanıcının email'i ile aynı isimdeki koleksiyondan
 * ilk dokümandaki no[] değerlerini çeker.
 */
async function getUserOfficeNosByEmail(email) {
  const colRef = collection(db, email);
  const snap = await getDocs(colRef);

  if (snap.empty) {
    throw new Error(`Firestore'da '${email}' adlı koleksiyon bulunamadı veya boş.`);
  }

  // Eğer koleksiyonda birden fazla doc varsa: ilkini alıyoruz.
  // İstersen burada admin:true veya farklı bir kritere göre seçebiliriz.
  const doc = snap.docs[0];
  const data = doc.data();

  const name = data?.name ?? "";
  const surname = data?.surname ?? "";
  const isAdmin = !!data?.admin;

  const noArr = Array.isArray(data?.no) ? data.no.map(String) : [];
  if (noArr.length === 0) {
    throw new Error("Kullanıcı dokümanında 'no' array boş veya yok.");
  }

  // temizle (sadece sayılar)
  const officeNos = noArr.map(s => s.trim()).filter(s => /^\d+$/.test(s));

  return { name, surname, isAdmin, officeNos };
}

/**
 * Storage'dan Excel indir -> parse -> kullanıcı no[] ile eşleştir -> tablo bas
 */
async function loadAndRenderDebts(userEmail) {
  setExcelInfo("Excel indiriliyor...");

  // 1) User office nos
  const userInfo = await getUserOfficeNosByEmail(userEmail);

  // 2) Excel download url
  const url = await getDownloadURL(ref(storage, EXCEL_STORAGE_PATH));

  // 3) Fetch excel bytes
  const res = await fetch(url);
  if (!res.ok) throw new Error("Excel indirilemedi (Storage).");
  const arrayBuf = await res.arrayBuffer();

  // 4) Parse
  const workbook = XLSX.read(arrayBuf, { type: "array" });
  const { map: debtMap } = parseGenelSheet(workbook);

  // 5) Match and render
  tbody.innerHTML = "";
  let total = 0;

  for (const officeNo of userInfo.officeNos) {
    const debt = debtMap.has(officeNo) ? debtMap.get(officeNo) : null;

    const tr = document.createElement("tr");
    const tdNo = document.createElement("td");
    tdNo.textContent = officeNo;

    const tdDebt = document.createElement("td");
    tdDebt.className = "right";
    tdDebt.textContent = (debt === null) ? "Excel’de yok" : fmtMoney(debt);

    tr.appendChild(tdNo);
    tr.appendChild(tdDebt);
    tbody.appendChild(tr);

    if (debt !== null && Number.isFinite(Number(debt))) total += Number(debt);
  }

  totalDebtEl.textContent = fmtMoney(total);
  setExcelInfo(`Excel okundu. Son güncellemede yeni dosya yüklersen "Yenile" de.`);
  return userInfo;
}

/** 5) Auth UI actions */
loginBtn.addEventListener("click", async () => {
  try {
    setLoginMsg("");
    await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
  } catch (e) {
    setLoginMsg(e.message, true);
  }
});

registerBtn.addEventListener("click", async () => {
  try {
    setLoginMsg("");
    await createUserWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
    setLoginMsg("Kayıt başarılı. Giriş yapıldı.");
  } catch (e) {
    setLoginMsg(e.message, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

refreshBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user?.email) return;
  try {
    await loadAndRenderDebts(user.email);
  } catch (e) {
    alert(e.message);
  }
});

/** 6) Session handling */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginCard.classList.remove("hide");
    dash.classList.add("hide");
    tbody.innerHTML = "";
    totalDebtEl.textContent = "0";
    setExcelInfo("");
    return;
  }

  // logged in
  loginCard.classList.add("hide");
  dash.classList.remove("hide");

  try {
    const info = await loadAndRenderDebts(user.email);
    welcomeEl.textContent = `Hoş geldin, ${info.name} ${info.surname}`.trim() || `Hoş geldin`;
    metaEl.textContent = `${user.email} • ${info.isAdmin ? "Admin" : "Kullanıcı"} • Ofis sayısı: ${info.officeNos.length}`;
  } catch (e) {
    alert(e.message);
    welcomeEl.textContent = "Hoş geldin";
    metaEl.textContent = user.email;
  }
});
