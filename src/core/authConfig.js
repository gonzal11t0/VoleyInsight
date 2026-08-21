function readRequiredPassword(env, variableName) {
    const value = String(env?.[variableName] || '').trim();
    if (!value) {
        throw new Error(
            `Falta ${variableName}. Creá el archivo .env a partir de .env.example antes de iniciar VoleyInsight.`
        );
    }
    return value;
}

function loadAuthPasswords(env = process.env) {
    return Object.freeze({
        operator: readRequiredPassword(env, 'VOLEY_OPERATOR_PASSWORD'),
        public: readRequiredPassword(env, 'VOLEY_PUBLIC_PASSWORD')
    });
}

module.exports = {
    readRequiredPassword,
    loadAuthPasswords
};
