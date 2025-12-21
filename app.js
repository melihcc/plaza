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

/* ================= FIREBASE ================= */
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

/* ================= UI (SADECE VAR OLANLAR) ================= */
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

/* ================= EVENT BINDINGS ================= */
loginBtn.addEventListener("click", login);

/* ENTER ile giriş */
[emailInput, passwordInput].forEach(input => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      login();
    }
  });
});

if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth));
if (logoutBtn2) logoutBtn2.addEventListener("click", () => signOut(auth));

if (uploadExcelBtn && excelFileInput) {
  uploadExcelBtn.addEventListener("click", () => excelFileInput.click());
}

/* ================= HELPERS ================= */
function fmtTL(n) {
  return (Number(n) || 0).toLocaleString("tr-TR") + " ₺";
}

/* ================= AUTH ================= */
async function login() {
  loginMsg.textContent = "";
  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );
  } catch (e) {
    loginMsg.textContent = e.message;
  }
}

/* ================= FIRESTORE ================= */
async function getUserByEmail(email) {
  const snap = await getDocs(collection(db, email));
  if (snap.empty) throw new Error("Kullanıcı Firestore kaydı bulunamadı.");
  return snap.docs[0].data();
}

/* ================= EXCEL ================= */
async function loadWorkbook() {
  const url = await getDownloadURL(ref(storage, EXCEL_PATH));
  const buf = await fetch(url).then(r => r.arrayBuffer());
  return XLSX.read(buf, { type: "array" });
}

/* TARİH – GENEL!I1 */
function extractUpdateDateFromGenel(wb) {
  const sheet = wb.Sheets["GENEL"];
  if (!sheet) return null;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
  const cell = rows?.[0]?.[8]; // I1

  if (!cell || typeof cell !== "string") return null;

  const m = cell.match(/(\d{2})-(\d{2})-(\d{4}).*?(\d{2}:\d{2})/);
  if (!m) return null;

  return `${m[1]}.${m[2]}.${m[3]} ${m[4]}`;
}

function parseGenel(wb) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["GENEL"], { header: 1 });
  const map = new Map();
  rows.forEach(r => {
    for (let i = 0; i < r.length - 1; i += 2) {
      if (r[i] && !isNaN(r[i + 1])) {
        map.set(String(r[i]), Number(r[i + 1]));
      }
    }
  });
  return map;
}

function parseDemirbas(wb) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["DEMİRBAŞ"], { header: 1 });
  const map = new Map();
  rows.forEach(r => {
    if (r[0] && !isNaN(r[4])) {
      map.set(String(r[0]), Number(r[4]));
    }
  });
  return map;
}

/* ================= ADMIN UPLOAD ================= */
if (excelFileInput) {
  excelFileInput.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    adminExcelStatus.textContent = "Excel yükleniyor...";
    await uploadBytes(ref(storage, EXCEL_PATH), file);
    await loadAdminScreen(auth.currentUser.email);
  });
}

/* ================= SCREENS ================= */
async function loadUserScreen(email) {
  adminPanel.style.display = "none";
  userPanel.style.display = "block";

  const user = await getUserByEmail(email);
  const wb = await loadWorkbook();
  const aidatMap = parseGenel(wb);
  const dateStr = extractUpdateDateFromGenel(wb);

  userTitle.textContent = `${user.name} ${user.surname}`;
  userMeta.textContent = email;

  userDebtBody.innerHTML = "";
  let total = 0;

  user.no.forEach(no => {
    const d = aidatMap.get(String(no)) || 0;
    total += d;
    userDebtBody.innerHTML += `
      <tr>
        <td>${no}</td>
        <td>${fmtTL(d)}</td>
      </tr>`;
  });

  userTotal.textContent = fmtTL(total);
  userExcelStatus.textContent =
    "Aidat bilgileri güncel" +
    (dateStr ? ` (Son güncelleme: ${dateStr})` : "");
}

async function loadAdminScreen(email) {
  userPanel.style.display = "none";
  adminPanel.style.display = "block";

  const user = await getUserByEmail(email);
  const wb = await loadWorkbook();
  const aidatMap = parseGenel(wb);
  const demirbasMap = parseDemirbas(wb);
  const dateStr = extractUpdateDateFromGenel(wb);

  adminTitle.textContent = `${user.name} ${user.surname}`;
  adminMeta.textContent = email;

  officeGrid.innerHTML = "";

  const all = new Set([...aidatMap.keys(), ...demirbasMap.keys()]);
  [...all].sort((a, b) => a - b).forEach(ofis => {
    officeGrid.innerHTML += `
      <div class="officeCard">
        <h4>Ofis ${ofis}</h4>
        <p>Aidat: <b>${fmtTL(aidatMap.get(ofis) || 0)}</b></p>
        <p>Demirbaş: <b>${fmtTL(demirbasMap.get(ofis) || 0)}</b></p>
      </div>
    `;
  });

  adminExcelStatus.textContent =
    "Tüm ofisler güncel" +
    (dateStr ? ` (Son güncelleme: ${dateStr})` : "");
}

/* ================= AUTH STATE ================= */
onAuthStateChanged(auth, async user => {
  if (!user) {
    loginCard.style.display = "block";
    userPanel.style.display = "none";
    adminPanel.style.display = "none";
    return;
  }

  loginCard.style.display = "none";

  const u = await getUserByEmail(user.email);
  if (u.admin) {
    await loadAdminScreen(user.email);
  } else {
    await loadUserScreen(user.email);
  }
});
