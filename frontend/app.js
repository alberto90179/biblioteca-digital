class BibliotecaApp {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.token = localStorage.getItem('token');
        this.usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
        this.init();
    }

    init() {
        this.checkAuth();
        this.bindEvents();
        this.loadData();
    }

    checkAuth() {
        if (this.token && this.usuario) {
            this.showAuthenticatedUI();
        } else {
            this.showPublicUI();
        }
    }

    showAuthenticatedUI() {
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('login-link').style.display = 'none';
        document.getElementById('user-name').textContent = this.usuario.nombre;
        document.getElementById('tabs').style.display = 'flex';
        
        // Mostrar elementos de admin si corresponde
        if (this.usuario.rol === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = 'block';
            });
        }
    }

    showPublicUI() {
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('login-link').style.display = 'block';
        document.getElementById('tabs').style.display = 'none';
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.style.display = 'none';
        });
        document.getElementById('dashboard-tab').style.display = 'block';
    }

    bindEvents() {
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Botones de acción
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('add-libro-btn').addEventListener('click', () => this.showLibroModal());
        document.getElementById('add-prestamo-btn').addEventListener('click', () => this.showPrestamoModal());

        // Formularios
        document.getElementById('profile-form').addEventListener('submit', (e) => this.updateProfile(e));
        document.getElementById('libro-form').addEventListener('submit', (e) => this.saveLibro(e));
        document.getElementById('prestamo-form').addEventListener('submit', (e) => this.createPrestamo(e));

        // Búsqueda
        document.getElementById('search-input').addEventListener('input', (e) => this.searchLibros(e.target.value));

        // Modales
        document.querySelectorAll('.close, .cancel-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Cerrar modal al hacer click fuera
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModals();
            });
        });
    }

    switchTab(tabName) {
        // Actualizar botones de tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Actualizar contenido de tabs
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Cargar datos específicos del tab
        if (tabName === 'libros') this.loadLibros();
        if (tabName === 'prestamos') this.loadPrestamos();
        if (tabName === 'admin') this.loadAdminData();
    }

    async loadData() {
        if (!this.token) return;

        try {
            await Promise.all([
                this.loadStats(),
                this.loadMyPrestamos(),
                this.loadLibros(),
                this.loadPrestamos()
            ]);
        } catch (error) {
            this.showError('Error cargando datos');
        }
    }

    async loadStats() {
        try {
            const [librosRes, prestamosRes, usuariosRes] = await Promise.all([
                this.apiCall('/libros'),
                this.apiCall('/prestamos'),
                this.usuario.rol === 'admin' ? this.apiCall('/usuarios') : Promise.resolve({ data: { usuarios: [] } })
            ]);

            const stats = {
                totalLibros: librosRes.data.libros.length,
                totalPrestamos: prestamosRes.data.prestamos.length,
                prestamosActivos: prestamosRes.data.prestamos.filter(p => p.estado === 'activo').length,
                totalUsuarios: usuariosRes.data.usuarios.length
            };

            this.renderStats(stats);
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    renderStats(stats) {
        const statsGrid = document.getElementById('stats-grid');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.totalLibros}</div>
                <div class="stat-label">Total Libros</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.totalPrestamos}</div>
                <div class="stat-label">Total Préstamos</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.prestamosActivos}</div>
                <div class="stat-label">Préstamos Activos</div>
            </div>
            ${this.usuario.rol === 'admin' ? `
            <div class="stat-card">
                <div class="stat-number">${stats.totalUsuarios}</div>
                <div class="stat-label">Total Usuarios</div>
            </div>
            ` : ''}
        `;
    }

    async loadMyPrestamos() {
        try {
            const res = await this.apiCall(`/prestamos/usuario/${this.usuario.id}`);
            const prestamos = res.data.prestamos.slice(0, 5); // Mostrar solo los 5 más recientes
            this.renderMyPrestamos(prestamos);
        } catch (error) {
            console.error('Error cargando mis préstamos:', error);
        }
    }

    renderMyPrestamos(prestamos) {
        const container = document.getElementById('my-prestamos');
        
        if (prestamos.length === 0) {
            container.innerHTML = '<div class="empty-state">No tienes préstamos activos</div>';
            return;
        }

        container.innerHTML = prestamos.map(prestamo => `
            <div class="prestamo-item ${prestamo.estado}">
                <div class="item-header">
                    <div class="item-title">${prestamo.libroId.titulo}</div>
                    <span class="item-status status-${prestamo.estado}">${prestamo.estado.toUpperCase()}</span>
                </div>
                <div class="item-details">
                    <div><strong>Autor:</strong> ${prestamo.libroId.autor}</div>
                    <div><strong>Préstamo:</strong> ${new Date(prestamo.fechaPrestamo).toLocaleDateString()}</div>
                    <div><strong>Devolución:</strong> ${new Date(prestamo.fechaDevolucion).toLocaleDateString()}</div>
                </div>
            </div>
        `).join('');
    }

    async loadLibros() {
        try {
            const res = await this.apiCall('/libros');
            this.renderLibros(res.data.libros);
        } catch (error) {
            this.showError('Error cargando libros');
        }
    }

    renderLibros(libros) {
        const container = document.getElementById('libros-grid');
        
        if (libros.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay libros disponibles</div>';
            return;
        }

        container.innerHTML = libros.map(libro => `
            <div class="libro-card">
                <div class="libro-image">
                    ${libro.imagen ? 
                        `<img src="${libro.imagen}" alt="${libro.titulo}" class="libro-image">` : 
                        '📚'
                    }
                </div>
                <div class="libro-title">${libro.titulo}</div>
                <div class="libro-author">por ${libro.autor}</div>
                <div class="libro-isbn">ISBN: ${libro.isbn}</div>
                ${libro.descripcion ? `<div class="libro-desc">${libro.descripcion}</div>` : ''}
                <div class="libro-stats">
                    <div class="libro-availability">
                        <span class="badge ${libro.ejemplaresDisponibles > 0 ? 'text-success' : 'text-danger'}">
                            ${libro.ejemplaresDisponibles} disponible(s) de ${libro.ejemplares}
                        </span>
                    </div>
                    ${this.usuario.rol === 'admin' ? `
                    <div class="libro-actions">
                        <button class="btn btn-secondary btn-sm" onclick="app.editLibro('${libro._id}')">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="app.deleteLibro('${libro._id}')">Eliminar</button>
                    </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    async loadPrestamos() {
        try {
            const endpoint = this.usuario.rol === 'admin' ? '/prestamos' : `/prestamos/usuario/${this.usuario.id}`;
            const res = await this.apiCall(endpoint);
            this.renderPrestamos(res.data.prestamos);
        } catch (error) {
            this.showError('Error cargando préstamos');
        }
    }

    renderPrestamos(prestamos) {
        const container = document.getElementById('prestamos-list');
        
        if (prestamos.length === 0) {
            container.innerHTML = '<div class="empty-state">No hay préstamos registrados</div>';
            return;
        }

        container.innerHTML = prestamos.map(prestamo => `
            <div class="prestamo-item ${prestamo.estado}">
                <div class="item-header">
                    <div class="item-title">${prestamo.libroId.titulo}</div>
                    <span class="item-status status-${prestamo.estado}">${prestamo.estado.toUpperCase()}</span>
                </div>
                <div class="item-details">
                    <div><strong>Autor:</strong> ${prestamo.libroId.autor}</div>
                    <div><strong>Usuario:</strong> ${prestamo.usuarioId?.nombre || this.usuario.nombre}</div>
                    <div><strong>Préstamo:</strong> ${new Date(prestamo.fechaPrestamo).toLocaleDateString()}</div>
                    <div><strong>Devolución:</strong> ${new Date(prestamo.fechaDevolucion).toLocaleDateString()}</div>
                    ${prestamo.fechaDevolucionReal ? 
                        `<div><strong>Devuelto:</strong> ${new Date(prestamo.fechaDevolucionReal).toLocaleDateString()}</div>` : ''}
                </div>
                ${this.usuario.rol === 'admin' && prestamo.estado === 'activo' ? `
                <div class="item-actions">
                    <button class="btn btn-success btn-sm" onclick="app.devolverLibro('${prestamo._id}')">Marcar Devuelto</button>
                    <button class="btn btn-danger btn-sm" onclick="app.deletePrestamo('${prestamo._id}')">Eliminar</button>
                </div>
                ` : ''}
            </div>
        `).join('');
    }

    async loadAdminData() {
        if (this.usuario.rol !== 'admin') return;

        try {
            const [usuariosRes, librosRes] = await Promise.all([
                this.apiCall('/usuarios'),
                this.apiCall('/libros')
            ]);

            this.renderUsuarios(usuariosRes.data.usuarios);
            this.renderAdminLibros(librosRes.data.libros);
        } catch (error) {
            this.showError('Error cargando datos de administración');
        }
    }

    renderUsuarios(usuarios) {
        const container = document.getElementById('usuarios-list');
        container.innerHTML = usuarios.map(usuario => `
            <div class="admin-item">
                <div class="item-header">
                    <div class="item-title">${usuario.nombre}</div>
                    <span class="badge">${usuario.rol}</span>
                </div>
                <div class="item-details">
                    <div><strong>Email:</strong> ${usuario.email}</div>
                    <div><strong>Registro:</strong> ${new Date(usuario.fechaRegistro).toLocaleDateString()}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="app.editUsuario('${usuario._id}')">Editar</button>
                    ${usuario._id !== this.usuario.id ? `
                    <button class="btn btn-danger btn-sm" onclick="app.deleteUsuario('${usuario._id}')">Eliminar</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    renderAdminLibros(libros) {
        const container = document.getElementById('admin-libros-list');
        container.innerHTML = libros.map(libro => `
            <div class="admin-item">
                <div class="item-header">
                    <div class="item-title">${libro.titulo}</div>
                    <span class="badge ${libro.ejemplaresDisponibles > 0 ? 'text-success' : 'text-danger'}">
                        ${libro.ejemplaresDisponibles}/${libro.ejemplares}
                    </span>
                </div>
                <div class="item-details">
                    <div><strong>Autor:</strong> ${libro.autor}</div>
                    <div><strong>ISBN:</strong> ${libro.isbn}</div>
                    <div><strong>Disponibles:</strong> ${libro.ejemplaresDisponibles} de ${libro.ejemplares}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="app.editLibro('${libro._id}')">Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteLibro('${libro._id}')">Eliminar</button>
                </div>
            </div>
        `).join('');
    }

    // Métodos para modales
    showLibroModal(libro = null) {
        const modal = document.getElementById('libro-modal');
        const title = document.getElementById('libro-modal-title');
        const form = document.getElementById('libro-form');

        if (libro) {
            title.textContent = 'Editar Libro';
            this.populateLibroForm(libro);
        } else {
            title.textContent = 'Agregar Libro';
            form.reset();
            document.getElementById('libro-id').value = '';
        }

        modal.style.display = 'block';
    }

    populateLibroForm(libro) {
        document.getElementById('libro-id').value = libro._id;
        document.getElementById('libro-titulo').value = libro.titulo;
        document.getElementById('libro-autor').value = libro.autor;
        document.getElementById('libro-isbn').value = libro.isbn;
        document.getElementById('libro-editorial').value = libro.editorial || '';
        document.getElementById('libro-año').value = libro.año || '';
        document.getElementById('libro-genero').value = libro.genero || '';
        document.getElementById('libro-descripcion').value = libro.descripcion || '';
        document.getElementById('libro-ejemplares').value = libro.ejemplares;
        document.getElementById('libro-imagen').value = libro.imagen || '';
    }

    async showPrestamoModal() {
        try {
            const [usuariosRes, librosRes] = await Promise.all([
                this.apiCall('/usuarios'),
                this.apiCall('/libros')
            ]);

            this.populatePrestamoForm(usuariosRes.data.usuarios, librosRes.data.libros);
            document.getElementById('prestamo-modal').style.display = 'block';
        } catch (error) {
            this.showError('Error cargando datos para préstamo');
        }
    }

    populatePrestamoForm(usuarios, libros) {
        const usuarioSelect = document.getElementById('prestamo-usuario');
        const libroSelect = document.getElementById('prestamo-libro');

        usuarioSelect.innerHTML = '<option value="">Seleccionar usuario...</option>' +
            usuarios.map(u => `<option value="${u._id}">${u.nombre} (${u.email})</option>`).join('');

        libroSelect.innerHTML = '<option value="">Seleccionar libro...</option>' +
            libros.filter(l => l.ejemplaresDisponibles > 0)
                .map(l => `<option value="${l._id}">${l.titulo} - ${l.autor} (Disponibles: ${l.ejemplaresDisponibles})</option>`)
                .join('');

        // Establecer fecha de devolución mínima (mañana)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('prestamo-fecha-devolucion').min = tomorrow.toISOString().split('T')[0];
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    // Métodos para formularios
    async updateProfile(e) {
        e.preventDefault();
        
        try {
            const formData = {
                nombre: document.getElementById('profile-nombre').value,
                email: document.getElementById('profile-email').value
            };

            const res = await this.apiCall('/auth/perfil', 'PUT', formData);
            
            this.usuario = res.data.usuario;
            localStorage.setItem('usuario', JSON.stringify(this.usuario));
            this.showAuthenticatedUI();
            this.showSuccess('Perfil actualizado correctamente');
        } catch (error) {
            this.showError('Error actualizando perfil');
        }
    }

    async saveLibro(e) {
        e.preventDefault();
        
        try {
            const formData = {
                titulo: document.getElementById('libro-titulo').value,
                autor: document.getElementById('libro-autor').value,
                isbn: document.getElementById('libro-isbn').value,
                editorial: document.getElementById('libro-editorial').value,
                año: document.getElementById('libro-año').value,
                genero: document.getElementById('libro-genero').value,
                descripcion: document.getElementById('libro-descripcion').value,
                ejemplares: parseInt(document.getElementById('libro-ejemplares').value),
                imagen: document.getElementById('libro-imagen').value
            };

            const libroId = document.getElementById('libro-id').value;
            const method = libroId ? 'PUT' : 'POST';
            const endpoint = libroId ? `/libros/${libroId}` : '/libros';

            await this.apiCall(endpoint, method, formData);
            
            this.closeModals();
            this.loadLibros();
            this.loadAdminData();
            this.showSuccess(`Libro ${libroId ? 'actualizado' : 'creado'} correctamente`);
        } catch (error) {
            this.showError(`Error ${document.getElementById('libro-id').value ? 'actualizando' : 'creando'} libro`);
        }
    }

    async createPrestamo(e) {
        e.preventDefault();
        
        try {
            const formData = {
                usuarioId: document.getElementById('prestamo-usuario').value,
                libroId: document.getElementById('prestamo-libro').value,
                fechaDevolucion: document.getElementById('prestamo-fecha-devolucion').value
            };

            await this.apiCall('/prestamos', 'POST', formData);
            
            this.closeModals();
            this.loadPrestamos();
            this.loadStats();
            this.showSuccess('Préstamo creado correctamente');
        } catch (error) {
            this.showError('Error creando préstamo');
        }
    }

    // Métodos para acciones
    async editLibro(id) {
        try {
            const res = await this.apiCall(`/libros/${id}`);
            this.showLibroModal(res.data.libro);
        } catch (error) {
            this.showError('Error cargando libro');
        }
    }

    async deleteLibro(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar este libro?')) return;

        try {
            await this.apiCall(`/libros/${id}`, 'DELETE');
            this.loadLibros();
            this.loadAdminData();
            this.showSuccess('Libro eliminado correctamente');
        } catch (error) {
            this.showError('Error eliminando libro');
        }
    }

    async devolverLibro(id) {
        try {
            await this.apiCall(`/prestamos/${id}/devolver`, 'PUT');
            this.loadPrestamos();
            this.loadStats();
            this.loadMyPrestamos();
            this.showSuccess('Libro marcado como devuelto');
        } catch (error) {
            this.showError('Error devolviendo libro');
        }
    }

    async deletePrestamo(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar este préstamo?')) return;

        try {
            await this.apiCall(`/prestamos/${id}`, 'DELETE');
            this.loadPrestamos();
            this.loadStats();
            this.showSuccess('Préstamo eliminado correctamente');
        } catch (error) {
            this.showError('Error eliminando préstamo');
        }
    }

    async searchLibros(query) {
        if (query.length < 2) {
            this.loadLibros();
            return;
        }

        try {
            const res = await this.apiCall(`/libros/buscar/${query}`);
            this.renderLibros(res.data.libros);
        } catch (error) {
            this.showError('Error buscando libros');
        }
    }

    // Utilidades
    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (this.token) {
            options.headers.Authorization = `Bearer ${this.token}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${this.apiBase}${endpoint}`, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Error en la petición');
        }

        return result;
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = 'index.html';
    }

    showSuccess(message) {
        alert(message); // En una implementación real, usarías un sistema de notificaciones más elegante
    }

    showError(message) {
        alert(`Error: ${message}`);
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BibliotecaApp();
});