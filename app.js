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

/* FUNCTIONS */
const functions = getFunctions(app, "us-central1");
const createUserWithData = httpsCallable(functions, "createUserWithData");
const listAllUsers = httpsCallable(functions, "listAllUsers");
const deleteUserWithData = httpsCallable(functions, "deleteUserWithData");

const EXCEL_PATH = "deneme.xlsx";

/* ================= CACHE ================= */
let cachedWorkbook = null;
let cachedAidatMap = null;
let cachedDemirbasMap = null;
let cachedDateStr = "";

/* UI */
const loginCard = document.getElementById("loginCard");
const userPanel = document.getElementById("userPanel");
const adminPanel = document.getElementById("adminPanel");

const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginMsg = document.getElementById("loginMsg");

const logoutBtn = document.getElementById("logoutBtn");
const logoutBtn2 = document.getElementById("logoutBtn2");

const officeGrid = document.getElementById("officeGrid");
const uploadExcelBtn = document.getElementById("uploadExcelBtn");
const excelFileInput = document.getElementById("excelFileInput");

const showAidatBtn = document.getElementById("showAidatBtn");
const showCreateUserBtn = document.getElementById("showCreateUserBtn");
const showUserListBtn = document.getElementById("showUserListBtn");

const createUserCard = document.getElementById("createUserCard");
const userListCard = document.getElementById("userListCard");
const userListBody = document.getElementById("userListBody");

/* CREATE USER */
const createUserBtn = document.getElementById("createUserBtn");
const createUserMsg = document.getElementById("createUserMsg");
const newUserEmail = document.getElementById("newUserEmail");
const newUserPassword = document.getElementById("newUserPassword");
const newUserName = document.getElementById("newUserName");
const newUserSurname = document.getElementById("newUserSurname");
const newUserNo = document.getElementById("newUserNo");
const newUserAdmin = document.getElementById("newUserAdmin");

/* ================= EVENTS ================= */
loginBtn.onclick = login;
logoutBtn.onclick = () => signOut(auth);
logoutBtn2.onclick = () => signOut(auth);
uploadExcelBtn.onclick = () => excelFileInput.click();

/* ================= TOGGLE ================= */
function hideAllAdminViews() {
  officeGrid.style.display = "none";
  createUserCard.style.display = "none";
  userListCard.style.display = "none";
}

showAidatBtn.onclick = async () => {
  hideAllAdminViews();
  officeGrid.style.display = "grid";
  await renderAidatGrid();
};

showCreateUserBtn.onclick = () => {
  hideAllAdminViews();
  createUserCard.style.display = "block";
};

showUserListBtn.onclick = async () => {
  hideAllAdminViews();
  userListCard.style.display = "block";
  await loadUserList();
};

/* ================= LOGIN ================= */
async function login() {
  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );
  } catch {
    loginMsg.textContent = "Giriş yapılamadı";
  }
}

/* ================= USER DATA ================= */
async function getUser(email) {
  const snap = await getDocs(collection(db, email));
  return snap.docs[0].data();
}

/* ================= USER LIST ================= */
async function loadUserList() {
  userListBody.innerHTML = "";
  const res = await listAllUsers();
  const users = res.data.users;

  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.name} ${u.surname}</td>
      <td>${u.email}</td>
      <td>${(u.no || []).join(", ")}</td>
      <td>${u.admin ? "✔️" : ""}</td>
      <td>${u.admin ? `<span class="lock">🔒</span>` : `<span class="delete-btn" data-email="${u.email}">✖</span>`}</td>
    `;
    userListBody.appendChild(tr);
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.onclick = async () => {
      const email = btn.dataset.email;
      if (!confirm(`${email} silinsin mi?`)) return;
      await deleteUserWithData({ email });
      await loadUserList();
    };
  });
}

/* ================= CREATE USER ================= */
createUserBtn.onclick = async () => {
  createUserMsg.textContent = "";
  try {
    await createUserWithData({
      email: newUserEmail.value.trim(),
      password: newUserPassword.value,
      name: newUserName.value.trim(),
      surname: newUserSurname.value.trim(),
      admin: newUserAdmin.checked,
      no: newUserNo.value.split(",").map(x => x.trim()).filter(Boolean)
    });

    createUserMsg.textContent = "Kullanıcı oluşturuldu ✔";
    newUserEmail.value = "";
    newUserPassword.value = "";
    newUserName.value = "";
    newUserSurname.value = "";
    newUserNo.value = "";
    newUserAdmin.checked = false;
  } catch (e) {
    createUserMsg.textContent = e.message || "Hata oluştu";
  }
};

/* ================= EXCEL ================= */
async function loadWorkbook() {
  const url = await getDownloadURL(ref(storage, EXCEL_PATH));
  const buf = await fetch(url).then(r => r.arrayBuffer());
  return XLSX.read(buf, { type: "array" });
}

function extractDate(wb) {
  const c = wb.Sheets["GENEL"]?.["A26"];
  if (!c?.v) return "";
  const m = c.v.match(/(\d{2})[-./](\d{2})[-./](\d{4}).*?(\d{2}:\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]} ${m[4]}` : "";
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
  if (!ws) return new Map();
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

  const toNum = v => {
    if (typeof v === "number") return v;
    if (!v) return 0;
    return Number(String(v).replace(/[₺\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
  };

  const map = new Map();
  for (let i = 1; i < rows.length; i++) {
    const o = String(rows[i][0] || "").trim();
    if (/^\d+$/.test(o)) map.set(o, toNum(rows[i][4]));
  }
  return map;
}

function fmtTL(n) {
  return (Number(n) || 0).toLocaleString("tr-TR") + " ₺";
}

async function ensureAidatLoaded() {
  if (cachedWorkbook) return;
  cachedWorkbook = await loadWorkbook();
  cachedAidatMap = parseGenel(cachedWorkbook);
  cachedDemirbasMap = parseDemirbas(cachedWorkbook);
  cachedDateStr = extractDate(cachedWorkbook);
}

async function renderAidatGrid() {
  await ensureAidatLoaded();
  officeGrid.innerHTML = "";

  const offices = [...new Set([...cachedAidatMap.keys(), ...cachedDemirbasMap.keys()])]
    .sort((a, b) => parseInt(a) - parseInt(b));

  offices.forEach(o => {
    officeGrid.innerHTML += `
      <div class="officeCard">
        <h4>Ofis ${o}</h4>
        <p>Aidat: <b>${fmtTL(cachedAidatMap.get(o) || 0)}</b></p>
        <p>Demirbaş: <b>${fmtTL(cachedDemirbasMap.get(o) || 0)}</b></p>
        ${cachedDateStr ? `<p style="font-size:12px;color:#64748b">Son güncelleme: ${cachedDateStr}</p>` : ""}
      </div>
    `;
  });
}

excelFileInput.onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  await uploadBytes(ref(storage, EXCEL_PATH), f);
  cachedWorkbook = null;
  await renderAidatGrid();
};

/* ================= AUTH ================= */
onAuthStateChanged(auth, async user => {
  if (!user) {
    loginCard.style.display = "block";
    userPanel.style.display = "none";
    adminPanel.style.display = "none";
    return;
  }

  const u = await getUser(user.email);
  loginCard.style.display = "none";

  if (u.admin) {
    adminPanel.style.display = "block";
    hideAllAdminViews();
    officeGrid.style.display = "grid";
    await renderAidatGrid();
  } else {
    userPanel.style.display = "block";
  }
});
