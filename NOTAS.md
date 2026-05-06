# Notas del lab — Reflexión

**¿Por qué es importante que el mensaje de error del login sea genérico?**

Es fundamental para evitar que personas malintencionadas puedan comprobar si una persona, identificada por su correo, está registrada en una web o servicio.

---

**¿Qué información NO deberías guardar nunca en el payload del JWT?**

La contraseña e información de especial protección en el RGPD.

---

**¿Por qué usamos `bcrypt.compare` en lugar de hashear la contraseña y compararla con `===`?**

Porque bcrypt.compare hace dos procesos: extrae el salt del hash almacenado en la base de datos, hashea la contraseña recibida con ese salt, y compara los resultados. Con `===` daría siempre false porque sin usar el mismo salt, el mismo input produce siempre un hash diferente.
