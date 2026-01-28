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

/* 🔽 EKLENEN: FUNCTIONS */
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

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

/* 🔽 EKLENEN: FUNCTIONS INIT */
const functions = getFunctions(app, "us-central1");
const createUserWithData = httpsCallable(functions, "createUserWithData");

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

/* 🔽 EKLENEN: ADMIN TOGGLE + FORM */
const showAidatBtn = document.getElementById("showAidatBtn");
const showCreateUserBtn = document.getElementById("showCreateUserBtn");

const createUserCard = document.getElementById("createUserCard");
const createUserBtn = document.getElementById("createUserBtn");
const createUserMsg = document.getElementById("createUserMsg");

const newUserEmail = document.getElementById("newUserEmail");
const newUserPassword = document.getElementById("newUserPassword");
const newUserName = document.getElementById("newUserName");
const newUserSurname = document.getElementById("newUserSurname");
const newUserNo = document.getElementById("newUserNo");
const newUserAdmin = document.getElementById("newUserAdmin");

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

/* 🔽 EKLENEN: ADMIN PANEL TOGGLE */
if (showCreateUserBtn) {
  showCreateUserBtn.onclick = () => {
    officeGrid.style.visibility = "hidden";
    officeGrid.style.height = "0";
    officeGrid.style.overflow = "hidden";

    createUserCard.style.display = "block";
  };
}

if (showAidatBtn) {
  showAidatBtn.onclick = () => {
    officeGrid.style.visibility = "visible";
    officeGrid.style.height = "auto";
    officeGrid.style.overflow = "initial";

    createUserCard.style.display = "none";
  };
}

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

  const cell = sheet["A26"];
  if (!cell || typeof cell.v !== "string") return "";

  const match = cell.v.match(
    /(\d{2})[-./](\d{2})[-./](\d{4}).*?(\d{2}:\d{2})/
  );

  if (!match) return "";

  const [, day, month, year, time] = match;
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
  const ws = wb.Sheets["DEMİRBAŞ"];
  const map = new Map();
  if (!ws) return map;

  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: ""
  });

  const toNumber = (val) => {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "number") return val;

    let s = String(val).trim();
    if (!s || s === "-") return 0;
    s = s.replace(/[₺\s]/g, "");
    s = s.replace(/\./g, "").replace(/,/g, ".");
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const officeRaw = String(row[0] ?? "").trim();
    if (!officeRaw || !/^\d+$/.test(officeRaw)) continue;

    const office = officeRaw;
    const total = toNumber(row[4]);
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

/* 🔽 EKLENEN: CREATE USER */
if (createUserBtn) {
  createUserBtn.onclick = async () => {
    createUserMsg.textContent = "";

    const data = {
      email: newUserEmail.value.trim(),
      password: newUserPassword.value,
      name: newUserName.value.trim(),
      surname: newUserSurname.value.trim(),
      admin: newUserAdmin.checked,
      no: newUserNo.value
        .split(",")
        .map(x => x.trim())
        .filter(Boolean)
    };

    try {
      await createUserWithData(data);
      createUserMsg.textContent = "Kullanıcı başarıyla oluşturuldu.";
    } catch (e) {
      createUserMsg.textContent = e?.message || "Kullanıcı oluşturulamadı.";
    }
  };
}

/* SCREENS */
async function loadUser(email) {
  loginCard.style.display = "none";
  adminPanel.style.display = "none";
  userPanel.style.display = "block";

  const user = await getUser(email);

  userTitle.textContent = `${user.name} ${user.surname}`;
  userMeta.textContent = email;

  const wb = await loadWorkbook();
  const aidatMap = parseGenel(wb);
  const demirbasMap = parseDemirbas(wb);
  const dateStr = extractDate(wb);

  userDebtBody.innerHTML = "";
  let grandTotal = 0;

  user.no.forEach(ofis => {
    const aidat = aidatMap.get(String(ofis)) || 0;
    const demirbas = demirbasMap.get(String(ofis)) || 0;
    const total = aidat + demirbas;

    grandTotal += total;

    userDebtBody.innerHTML += `
      <tr>
        <td>Ofis ${ofis}</td>
        <td>${fmtTL(aidat)}</td>
        <td>${fmtTL(demirbas)}</td>
        <td><b>${fmtTL(total)}</b></td>
      </tr>
    `;
  });

  userTotal.textContent = fmtTL(grandTotal);

  userExcelStatus.textContent =
    "Aidat bilgileri güncel" +
    (dateStr ? ` (Son güncelleme: ${dateStr})` : "");
}

async function loadAdmin(email) {
  loginCard.style.display = "none";
  userPanel.style.display = "none";
  adminPanel.style.display = "block";

  const user = await getUser(email);

  const wb = await loadWorkbook();
  const aidatMap = parseGenel(wb);
  const demirbasMap = parseDemirbas(wb);
  const dateStr = extractDate(wb);

  adminTitle.textContent = `${user.name} ${user.surname}`;
  adminMeta.textContent = email;

  officeGrid.innerHTML = "";

  const offices = [...new Set([
    ...aidatMap.keys(),
    ...demirbasMap.keys()
  ])]
    .map(v => String(v).trim())
    .filter(v => v.length > 0)
    .sort((a, b) => parseInt(a) - parseInt(b));

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
