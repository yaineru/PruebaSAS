# Checklist de seguridad

- [ ] Probar que un usuario no pueda leer otra empresa.
- [ ] Probar que un usuario no pueda escribir en otra empresa.
- [ ] Probar URL manipulada `/activos/{id_de_otra_empresa}`.
- [ ] Probar permisos por rol.
- [ ] Probar que `OPERARIO` no administre usuarios.
- [ ] Probar que `SUPERVISOR` no administre usuarios.
- [ ] Probar rate limiting de login.
- [ ] Probar CSRF con `Origin` inválido.
- [ ] Probar carga de archivo MIME no permitido.
- [ ] Probar archivo mayor a 50 MB.
- [ ] Revisar auditoría de inserciones, actualizaciones y eliminaciones.
- [ ] Rotar claves si fueron compartidas fuera de canales seguros.
- [ ] Configurar alertas de actividad sospechosa.
- [ ] Ejecutar `npm audit` y revisar vulnerabilidades antes de release.
- [ ] Resolver vulnerabilidades moderadas de `next/postcss` con actualización compatible, sin downgrade rompedor.
