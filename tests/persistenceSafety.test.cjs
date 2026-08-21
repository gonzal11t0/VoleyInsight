const assert = require('node:assert/strict');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { readJsonRecoverable, writeJsonAtomic } = require('../src/utils/atomicFile');
const DataRepository = require('../src/repositories/dataRepository');

(async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'voleyinsight-persistence-'));
    try {
        const manualPath = path.join(tempDir, 'puntos_manuales_123.json');
        await writeJsonAtomic(manualPath, [{ punto: 1 }], { validate: Array.isArray });
        await writeJsonAtomic(manualPath, [{ punto: 1 }, { punto: 2 }], { validate: Array.isArray });
        assert.deepEqual(
            JSON.parse(await fs.readFile(`${manualPath}.bak`, 'utf-8')),
            [{ punto: 1 }],
            'cada reemplazo conserva el último archivo válido'
        );

        await fs.writeFile(manualPath, '{ archivo cortado', 'utf-8');
        const recovered = await readJsonRecoverable(manualPath, { validate: Array.isArray });
        assert.equal(recovered.source, 'backup');
        assert.deepEqual(recovered.data, [{ punto: 1 }]);
        assert.deepEqual(JSON.parse(await fs.readFile(manualPath, 'utf-8')), [{ punto: 1 }]);

        const csv = [
            'timestamp,set,home_team,away_team,home_score,away_score,scorer,serving,home_run,away_run,lead,phase,event',
            '2026-08-21T00:00:00.000Z,1,LOCAL,VISITANTE,0,0,,,0,0,0,EARLY,POINT',
            '2026-08-21T00:00:01.000Z,1,LOCAL,VISITANTE,1,0,HOME,AWAY,1,0,1,EARLY,SIDEOUT_HOME',
            '2026-08-21T00:00:02.000Z,1,LOCAL,VISITANTE,1,1,AWAY,HOME,0,1,0,EARLY,SIDEOUT_AWAY',
            '2026-08-21T00:00:03.000Z,1,LOCAL,VISITANTE,2,1,HOME,AWAY,1,0,1,EARLY,SIDEOUT_HOME'
        ].join('\n');
        await fs.writeFile(path.join(tempDir, 'match_456.csv'), `${csv}\n`, 'utf-8');
        await writeJsonAtomic(path.join(tempDir, 'match_456.json'), [{
            timestamp: '2026-08-21T00:00:03.000Z',
            set: 1,
            homeTeam: 'LOCAL',
            awayTeam: 'VISITANTE',
            homeScore: 2,
            awayScore: 1,
            scorer: 'HOME',
            event: 'SIDEOUT_HOME'
        }], { backup: false, validate: Array.isArray });

        const repository = new DataRepository(456, tempDir);
        const history = await repository.loadJSON();
        assert.equal(history.filter(item => item.scorer).length, 3, 'el CSV repone el prefijo perdido al reiniciar');
        assert.equal(history.at(-1).homeScore, 2);
        assert.equal(history.at(-1).awayScore, 1);
        assert.equal(JSON.parse(await fs.readFile(path.join(tempDir, 'match_456.json'), 'utf-8')).length, 4);

        console.log('persistenceSafety: tests OK');
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
