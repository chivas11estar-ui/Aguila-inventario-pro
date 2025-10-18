// ============================================================
// Águila Inventario Pro - Módulo: auth.js
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
//
// Este archivo forma parte del sistema Águila Inventario Pro,
// desarrollado para promotores de PepsiCo con funcionalidades
// de gestión, auditoría y sincronización de inventario.
//
// Queda prohibida la reproducción, distribución o modificación
// sin autorización expresa del autor.
// ============================================================

// Iniciar sesión
async function login(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
    document.getElementById("auth-setup").style.display = "none";
    document.getElementById("app-container").style.display = "block";
    showToast("Bienvenido de nuevo 👋", "success");
  } catch (error) {
    console.error("Error en login:", error);
    showToast("Error al iniciar sesión: " + error.message, "error");
  }
}

// Registrar usuario
async function register(data) {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(data.email, data.password);
    const uid = userCredential.user.uid;

    await db.ref("users/" + uid).set({
      determinante: data.determinante,
      storeName: data.storeName,
      promoterName: data.promoterName,
      email: data.email
    });

    document.getElementById("auth-setup").style.display = "none";
    document.getElementById("app-container").style.display = "block";
    showToast("Registro exitoso ✅", "success");
  } catch (error) {
    console.error("Error en registro:", error);
    showToast("Error al registrar: " + error.message, "error");
  }
}

// Recuperar contraseña
async function recoverPassword(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    showToast("Se envió un enlace de recuperación a tu correo 📧", "success");
    switchForm("login-form");
  } catch (error) {
    console.error("Error en recuperación:", error);
    showToast("Error al recuperar contraseña: " + error.message, "error");
  }
}

// Cerrar sesión
async function logout() {
  try {
    await auth.signOut();
    document.getElementById("app-container").style.display = "none";
    document.getElementById("auth-setup").style.display = "block";
    switchForm("login-form");
    showToast("Sesión cerrada correctamente 👋", "success");
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    showToast("Error al cerrar sesión: " + error.message, "error");
  }
}