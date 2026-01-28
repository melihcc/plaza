const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();

exports.createUserWithData = onCall(
  { region: "us-central1" },
  async (request) => {

    // 1. Context Auth Check
    if (!request.auth) {
       throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const callerEmail = request.auth.token.email;

    // 2. Admin Check
    // "Firestore’da çağıranın e-posta adına sahip collection’dan admin=true kontrolü yapılsın"
    const adminQuery = await admin.firestore()
      .collection(callerEmail)
      .where('admin', '==', true)
      .get();

    if (adminQuery.empty) {
      throw new HttpsError('permission-denied', 'Permission denied');
    }

    // Parameters
    const { email, password, name, surname, admin: isAdmin, no } = request.data;

    // Password Validation
    if (!password || password.length < 6) {
      throw new HttpsError('invalid-argument', 'Password must be at least 6 characters');
    }

    // 3. Create Auth User
    try {
      await admin.auth().createUser({
        email: email,
        password: password,
        displayName: `${name} ${surname}`
      });
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Email already exists');
      }
      throw new HttpsError('internal', e.message);
    }

    // 4. Firestore Add
    // collection(email) -> add({...})
    await admin.firestore().collection(email).add({
        name,
        surname,
        admin: isAdmin,
        no
    });

    return { success: true };
  }
);
