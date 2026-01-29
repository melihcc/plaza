const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();

/* =================================================
   CREATE USER WITH DATA
   - Admin kontrolü: callerEmail/id/admin === true
   - Firestore: doc("id") standardı
================================================= */
exports.createUserWithData = onCall(
  { region: "us-central1" },
  async (request) => {

    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const callerEmail = request.auth.token.email;

    // 2. Admin check (TEK DOĞRU YER)
    const adminDoc = await admin.firestore()
      .collection(callerEmail)
      .doc("id")
      .get();

    if (!adminDoc.exists || adminDoc.data().admin !== true) {
      throw new HttpsError("permission-denied", "Admin only");
    }

    // 3. Parameters
    const { email, password, name, surname, admin: isAdmin, no } = request.data;

    if (!email || !password) {
      throw new HttpsError("invalid-argument", "Email and password required");
    }

    if (password.length < 6) {
      throw new HttpsError(
        "invalid-argument",
        "Password must be at least 6 characters"
      );
    }

    // 4. Create Auth user
    try {
      await admin.auth().createUser({
        email,
        password,
        displayName: `${name} ${surname}`
      });
    } catch (e) {
      if (e.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Email already exists");
      }
      throw new HttpsError("internal", e.message);
    }

    // 5. Firestore → TEK DOKÜMAN: id
    await admin.firestore()
      .collection(email)
      .doc("id")
      .set({
        name,
        surname,
        admin: isAdmin === true,
        no: Array.isArray(no) ? no : []
      });

    return {
      success: true,
      user: {
        email,
        name,
        surname,
        admin: isAdmin === true,
        no: Array.isArray(no) ? no : []
      }
    };
  }
);

/* =================================================
   LIST ALL USERS
   - KAYNAK: Firebase Authentication
   - Detay: Firestore collection(email)/doc("id")
   - listCollections KULLANILMIYOR
================================================= */
exports.listAllUsers = onCall(
  { region: "us-central1" },
  async (request) => {

    // Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const callerEmail = request.auth.token.email;

    // Admin check
    const adminDoc = await admin.firestore()
      .collection(callerEmail)
      .doc("id")
      .get();

    if (!adminDoc.exists || adminDoc.data().admin !== true) {
      throw new HttpsError("permission-denied", "Admin only");
    }

    const users = [];
    let nextPageToken;

    do {
      const res = await admin.auth().listUsers(1000, nextPageToken);
      nextPageToken = res.pageToken;

      for (const u of res.users) {
        const email = u.email;
        if (!email) continue;

        const idDoc = await admin.firestore()
          .collection(email)
          .doc("id")
          .get();

        if (!idDoc.exists) continue;

        const d = idDoc.data();

        users.push({
          uid: u.uid,
          email,
          name: d.name,
          surname: d.surname,
          admin: d.admin === true,
          no: d.no || []
        });
      }
    } while (nextPageToken);

    return { users };
  }
);

/* =================================================
   DELETE USER WITH DATA
   - UID Auth üzerinden
   - Firestore collection(email) tamamen silinir
================================================= */
exports.deleteUserWithData = onCall(
  { region: "us-central1" },
  async (request) => {

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const callerEmail = request.auth.token.email;
    const { email } = request.data;

    if (!email) {
      throw new HttpsError("invalid-argument", "Email is required");
    }

    // Admin check
    const adminDoc = await admin.firestore()
      .collection(callerEmail)
      .doc("id")
      .get();

    if (!adminDoc.exists || adminDoc.data().admin !== true) {
      throw new HttpsError("permission-denied", "Admin only");
    }

    // Target user data
    const targetIdDoc = await admin.firestore()
      .collection(email)
      .doc("id")
      .get();

    if (!targetIdDoc.exists) {
      throw new HttpsError("not-found", "User data not found");
    }

    if (targetIdDoc.data().admin === true) {
      throw new HttpsError(
        "failed-precondition",
        "Admin users cannot be deleted"
      );
    }

    // AUTH DELETE
    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().deleteUser(userRecord.uid);

    // FIRESTORE DELETE (collection içindeki her şey)
    const docs = await admin.firestore().collection(email).listDocuments();
    const batch = admin.firestore().batch();
    docs.forEach(doc => batch.delete(doc));
    await batch.commit();

    return { success: true };
  }
);
