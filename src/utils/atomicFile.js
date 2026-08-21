const fs = require('fs').promises;
const path = require('path');

function validarJson(data, validate) {
    if (typeof validate === 'function' && !validate(data)) {
        const error = new Error('El archivo JSON no tiene la estructura esperada.');
        error.code = 'EJSONINVALID';
        throw error;
    }
    return data;
}

async function escribirTemporal(filePath, contenido) {
    const temporal = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    const handle = await fs.open(temporal, 'wx');
    try {
        await handle.writeFile(contenido, 'utf-8');
        await handle.sync();
    } finally {
        await handle.close();
    }
    return temporal;
}

async function reemplazarArchivo(temporal, filePath) {
    try {
        await fs.rename(temporal, filePath);
        return;
    } catch (error) {
        if (!['EEXIST', 'EPERM', 'ENOTEMPTY'].includes(error.code)) throw error;
    }

    // Windows no siempre permite reemplazar un archivo existente con rename.
    // Primero apartamos el original: si cualquier paso falla, lo restauramos.
    const anterior = `${filePath}.${process.pid}.${Date.now()}.old`;
    let apartado = false;
    try {
        await fs.rename(filePath, anterior);
        apartado = true;
        await fs.rename(temporal, filePath);
        await fs.unlink(anterior).catch(() => {});
    } catch (error) {
        if (apartado) {
            const destinoExiste = await fs.access(filePath).then(() => true).catch(() => false);
            if (!destinoExiste) await fs.rename(anterior, filePath).catch(() => {});
        }
        throw error;
    }
}

async function writeTextAtomic(filePath, contenido) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporal = await escribirTemporal(filePath, String(contenido));
    try {
        await reemplazarArchivo(temporal, filePath);
    } finally {
        await fs.unlink(temporal).catch(() => {});
    }
}

async function writeJsonAtomic(filePath, data, { backup = true, validate } = {}) {
    validarJson(data, validate);
    const contenido = `${JSON.stringify(data, null, 2)}\n`;
    // Verifica la serialización antes de tocar el archivo definitivo.
    validarJson(JSON.parse(contenido), validate);

    if (backup) {
        try {
            const anterior = await fs.readFile(filePath, 'utf-8');
            validarJson(JSON.parse(anterior), validate);
            await writeTextAtomic(`${filePath}.bak`, anterior);
        } catch (error) {
            // Un archivo inexistente no necesita respaldo. Un archivo corrupto no
            // debe reemplazar el último .bak válido.
            if (error.code !== 'ENOENT' && !['SyntaxError', 'EJSONINVALID'].includes(error.name) && error.code !== 'EJSONINVALID') {
                throw error;
            }
        }
    }

    await writeTextAtomic(filePath, contenido);
}

async function leerJson(filePath, validate) {
    const contenido = await fs.readFile(filePath, 'utf-8');
    return validarJson(JSON.parse(contenido), validate);
}

async function readJsonRecoverable(filePath, options = {}) {
    const tieneFallback = Object.prototype.hasOwnProperty.call(options, 'fallback');
    const validate = options.validate;
    let errorPrincipal = null;

    try {
        return { data: await leerJson(filePath, validate), source: 'primary', recovered: false };
    } catch (error) {
        errorPrincipal = error;
    }

    try {
        const data = await leerJson(`${filePath}.bak`, validate);
        if (options.restore !== false) {
            await writeJsonAtomic(filePath, data, { backup: false, validate }).catch(() => {});
        }
        return { data, source: 'backup', recovered: true, primaryError: errorPrincipal };
    } catch (errorBackup) {
        if (tieneFallback && errorPrincipal?.code === 'ENOENT' && errorBackup?.code === 'ENOENT') {
            return { data: options.fallback, source: 'fallback', recovered: false };
        }
        const error = new Error(`No se pudo leer ${path.basename(filePath)} ni su respaldo válido.`);
        error.code = 'EJSONUNRECOVERABLE';
        error.cause = errorPrincipal;
        throw error;
    }
}

module.exports = {
    readJsonRecoverable,
    writeJsonAtomic,
    writeTextAtomic
};
